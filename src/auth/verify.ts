/** Check network reachability and verify campus tokens with the model gateway. */

import { setTimeout as delay } from 'node:timers/promises'
import { SITE } from './chain.ts'
import { KNOWN_MODELS } from '../transport/concurrency.ts'

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

/** Ask the direct host whether this process can reach the gateway without the WebVPN tunnel. */
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
  void response.body?.cancel().catch(() => {})
  if (response.status >= 300 && response.status < 400) return 'offcampus'
  if (response.status >= 500) return 'unknown'
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
  /** Verify through WebVPN. */
  tunnelMode?: boolean
  /** WebVPN prefix to prepend when `tunnelMode` is set. */
  tunnelPrefix?: string
  /** Budget for the whole request, in milliseconds. */
  timeoutMs?: number
  signal?: AbortSignal
}

/** Ask the upstream whether it accepts a token. */
export async function probeUpstream(options: ProbeOptions): Promise<ProbeResult> {
  const { token, model, cookie = '', tunnelMode = false, tunnelPrefix = '', timeoutMs = 60_000 } = options
  const base = tunnelMode && tunnelPrefix !== '' ? `${tunnelPrefix}/v1` : `${SITE}/v1`
  const url = `${base}/chat/completions`
  const started = Date.now()
  let response: Response
  try {
    const timeout = AbortSignal.timeout(timeoutMs)
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
      signal: options.signal === undefined ? timeout : AbortSignal.any([timeout, options.signal]),
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

/** Delay before starting the remaining model probes. */
const FALLBACK_DELAY_MS = 750

/** A completion from any model proves the shared credential works. */
export async function verifyCampusToken(options: ProbeOptions): Promise<ProbeResult> {
  const cancel = new AbortController()
  const signal = options.signal === undefined
    ? cancel.signal : AbortSignal.any([options.signal, cancel.signal])
  const primary = probeUpstream({ ...options, signal })
  const tryOtherModels = Promise.race([
    primary.then(result => !result.ok),
    delay(FALLBACK_DELAY_MS, true, { signal }).catch(() => false),
  ])
  const probes = [
    primary,
    ...KNOWN_MODELS.filter(model => model !== options.model).map(async model => {
      if (!await tryOtherModels || signal.aborted) return undefined
      return probeUpstream({ ...options, model, signal })
    }),
  ]
  try {
    return await Promise.any(probes.map(async probe => {
      const result = await probe
      if (result?.ok) return result
      throw result
    }))
  } catch {
    const results = await Promise.all(probes)
    // If no model accepted the token, preserve the strongest gateway evidence.
    for (const verdict of ['rejected', 'session', 'rate-limited', 'unavailable', 'network'] as const) {
      const match = results.find(result => result?.verdict === verdict)
      if (match !== undefined) return match
    }
    return await primary
  } finally {
    cancel.abort()
  }
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
