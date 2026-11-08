/**
 * Prove that a token the gateway issued is a token the gateway accepts.
 *
 * Issuance and acceptance are different facts. The school's endpoint hands out
 * a JWT on a successful ticket redemption, but the upstream model API is what
 * decides whether that JWT is usable. A permission refusal can also arrive as
 * a business error with HTTP 200.
 *
 * Ask for a single token using the same streaming path as a chat. Either a
 * valid SSE chunk or a normal JSON completion proves the candidate works.
 * @module dsh-thu-automad/auth/verify
 */

import { SITE } from './chain.ts'

/** The gateway's HTTP 200 response for denied permission. */
const PERMISSION_DENIED = 10003

/** A one-token probe needs only the first completion chunk. */
const MAX_STREAM_BYTES = 64 * 1024

/** Verdict of one upstream probe. */
export type ProbeVerdict =
  /** The gateway answered a completion. */
  | 'ok'
  /** The connection failed before a verdict could be read. */
  | 'network'
  /** The gateway answered a redirect, which means the transport lost its session. */
  | 'session'
  /** The gateway answered, and refused the credential. */
  | 'rejected'
  /** The gateway asked the caller to wait. */
  | 'rate-limited'
  /** The gateway reported a service failure. */
  | 'unavailable'
  /** The gateway answered something no known shape covers. */
  | 'other'

/** What one upstream probe concluded. */
export interface ProbeResult {
  /** Whether the gateway accepted the token. */
  ok: boolean
  /** Classification of the response. */
  verdict: ProbeVerdict
  /** HTTP status, absent on a transport failure. */
  status?: number
  /** Recognized media type, without parameters or arbitrary header values. */
  contentType?: string
  /** Milliseconds until response headers arrived. */
  ms: number
  /** Milliseconds until the verdict was known. */
  totalMs: number
  /** Short description of a non-ok verdict. */
  detail?: string
  /** The site's numeric business code, when present. */
  code?: number
  /** Token usage, when present in the completion. */
  usage?: unknown
  /** URL the probe targeted. */
  url: string
}

/** What the direct site says about the network this process runs on. */
export type SiteReachability =
  /** The site answered without redirecting: requests reach the gateway. */
  | 'campus'
  /** The site redirected into the unified-auth gate: only the tunnel works. */
  | 'offcampus'
  /** The probe could not decide; a transport failure is not a location. */
  | 'unknown'

/**
 * Ask the direct host whether this process can reach the gateway without the
 * WebVPN tunnel.
 *
 * The school's load balancer answers a campus request with the application
 * itself and an off-campus request with a redirect into the unified-auth OAuth
 * form, so the status of one unauthenticated GET separates the two networks
 * without touching credentials. A transport failure stays `unknown` rather than
 * guessing, because a flaky moment should not flip a working transport.
 * @param timeoutMs - probe budget; the site answers quickly when it answers.
 * @returns where this process appears to be, or that the probe could not tell.
 */
export async function probeDirectSite(timeoutMs = 8_000): Promise<SiteReachability> {
  let response: Response
  try {
    response = await fetch(`${SITE}/v1/models`, {
      headers: { accept: 'text/html,application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (_unreachable) {
    return 'unknown'
  }
  try { response.body?.cancel() } catch (_alreadyClosed) { /* nothing left to release */ }
  if (response.status >= 300 && response.status < 400) return 'offcampus'
  if (response.status >= 200) return 'campus'
  return 'unknown'
}

/** What one probe needs to know. */
export interface ProbeOptions {
  /** Token to present. */
  token: string
  /** Model id the probe names. */
  model: string
  /** Tunnel cookie header value, when the transport is the WebVPN tunnel. */
  cookie?: string
  /** Whether to go through the tunnel rather than straight to the site. */
  tunnelMode?: boolean
  /** WebVPN prefix to prepend when `tunnelMode` is set. */
  tunnelPrefix?: string
  /** Budget for the whole request, in milliseconds. */
  timeoutMs?: number
}

/**
 * Ask the upstream whether it accepts a token.
 *
 * Only a decisive answer is reported: a transport failure is its own verdict,
 * never a claim that the credential is bad.
 * @param options - token, model, transport choice, and timeout.
 * @returns the classification.
 */
export async function probeUpstream(options: ProbeOptions): Promise<ProbeResult> {
  const { token, model, cookie = '', tunnelMode = false, tunnelPrefix = '', timeoutMs = 60_000 } = options
  const base = tunnelMode && tunnelPrefix !== '' ? `${tunnelPrefix}/v1` : `${SITE}/v1`
  const url = `${base}/chat/completions`
  const started = Date.now()
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream, application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(cookie !== '' && tunnelMode ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        stream: true,
        max_tokens: 1,
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (_unreachable) {
    const elapsed = Date.now() - started
    return { ok: false, verdict: 'network', ms: elapsed, totalMs: elapsed, detail: 'No response from the gateway', url }
  }
  const status = response.status
  const contentType = probeMediaType(response.headers.get('content-type'))
  const facts = { status, contentType, ms: Date.now() - started, url }
  const failure = (verdict: Exclude<ProbeVerdict, 'ok'>, code?: number): ProbeResult => ({
    ...facts, ok: false, verdict, totalMs: Date.now() - started,
    ...code === undefined ? {} : { code },
    detail: `HTTP ${String(status)} · ${contentType}${code === undefined ? '' : ` · code ${String(code)}`}`,
  })
  const withoutBody = (verdict: Exclude<ProbeVerdict, 'ok'>): ProbeResult => {
    void response.body?.cancel().catch(() => {})
    return failure(verdict)
  }
  if (status >= 300 && status < 400) return withoutBody('session')
  if (status === 401 || status === 403) return withoutBody('rejected')
  if (status === 429) return withoutBody('rate-limited')
  if (status >= 500) return withoutBody('unavailable')
  if (contentType === 'text/html') return withoutBody('other')

  let record: Record<string, unknown> | null
  try {
    record = response.ok && contentType === 'text/event-stream'
      ? await readStreamEvidence(response.body)
      : jsonRecord(await response.text())
  } catch (_unreadableBody) {
    return failure('network')
  }
  if (response.ok && isCompletion(record)) {
    return { ...facts, ok: true, verdict: 'ok', totalMs: Date.now() - started, usage: record?.usage ?? null }
  }
  const code = businessCode(record)
  if (response.ok && record?.success === false && code === PERMISSION_DENIED) return failure('rejected', code)
  return failure('other', code)
}

/** Only include known media types in a user-facing diagnostic. */
function probeMediaType(header: string | null): string {
  switch (header?.split(';', 1)[0]?.trim().toLowerCase()) {
    case 'application/json': return 'application/json'
    case 'text/event-stream': return 'text/event-stream'
    case 'text/html': return 'text/html'
    case 'text/plain': return 'text/plain'
    default: return 'unknown content type'
  }
}

/** How many extra probes a busy gateway earns before its verdict stands. */
const BUSY_RETRIES = 2

/** Wait before the second busy probe; doubled for the one after it. */
const BUSY_DELAY_MS = 800

/**
 * Ask the upstream whether it accepts a token, giving a busy gateway another try.
 *
 * A 429 is the gateway queueing, not a verdict on the credential: it counts
 * in-flight completions per account and turns the extras away. Treating the
 * first one as "this token is unproven" makes a renewal fail — and re-login —
 * exactly when the account is busiest, which is the opposite of what the queue
 * in the transport already does with a 429 it meets directly.
 * @param options - token, model, transport choice, and timeout.
 * @returns the last classification, which is a verdict rather than a queue state.
 */
export async function probeUpstreamWithRetry(options: ProbeOptions): Promise<ProbeResult> {
  let result = await probeUpstream(options)
  for (let attempt = 1; attempt <= BUSY_RETRIES && result.verdict === 'rate-limited'; attempt += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, BUSY_DELAY_MS * attempt)
    })
    result = await probeUpstream(options)
  }
  return result
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function jsonRecord(text: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(text))
  } catch (_notJson) {
    return null
  }
}

/** A success must have a real choice, even when HTTP and SSE framing look fine. */
function isCompletion(record: Record<string, unknown> | null): boolean {
  if (record?.success === false || record?.error != null || !Array.isArray(record?.choices)) return false
  return record.choices.some((value: unknown) => {
    const choice = asRecord(value)
    return asRecord(choice?.message) !== null || asRecord(choice?.delta) !== null
  })
}

function businessCode(record: Record<string, unknown> | null): number | undefined {
  const value = record?.status ?? asRecord(record?.error)?.code
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

/** Read just enough SSE to distinguish an accepted completion from an error. */
async function readStreamEvidence(body: Response['body']): Promise<Record<string, unknown> | null> {
  if (body === null) return null
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return null
      bytes += value.byteLength
      if (bytes > MAX_STREAM_BYTES) return null
      pending += decoder.decode(value, { stream: true })
      const frames = pending.split(/\r?\n\r?\n/u)
      pending = frames.pop() ?? ''
      for (const frame of frames) {
        const data = frame.split(/\r?\n/u).filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /u, '')).join('\n')
        if (data === '[DONE]') return null
        const record = jsonRecord(data)
        if (record?.success === false || record?.error != null || isCompletion(record)) return record
      }
    }
  } finally {
    void reader.cancel().catch(() => {})
  }
}
