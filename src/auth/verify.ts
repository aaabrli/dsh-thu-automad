/**
 * Prove that a token the gateway issued is a token the gateway accepts.
 *
 * Issuance and acceptance are different facts. The school's endpoint hands out
 * a JWT on a successful ticket redemption, but the upstream model API is what
 * decides whether that JWT is usable, and it reports a refusal with HTTP 200
 * and a business code rather than a 401 — so a rotation that only checked for
 * "the POST returned something" would store a token that fails the very next
 * model request.
 *
 * The request is a single-token completion, the cheapest shape that exercises
 * the real path without producing content.
 * @module dsh-thu-automad/auth/verify
 */

import { SITE } from './chain.ts'

/** Longest response body carried into a diagnostic. */
const BODY_CHARS = 200

/** Verdict of one upstream probe. */
export type ProbeVerdict =
  /** The gateway answered a completion. */
  | 'ok'
  /** The request never reached the gateway. */
  | 'network'
  /** The gateway answered a redirect, which means the transport lost its session. */
  | 'session'
  /** The gateway answered, and refused the credential. */
  | 'rejected'
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
  /** Milliseconds until response headers arrived. */
  ms: number
  /** Milliseconds until the body was consumed. */
  totalMs: number
  /** Short description of a non-ok verdict. */
  detail?: string
  /** The site's business code, when the refusal carried one. */
  code?: number | null
  /** Truncated response body, for diagnostics. */
  body?: string
  /** Token usage the gateway reported. */
  usage?: unknown
  /** URL the probe targeted. */
  url: string
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
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(cookie !== '' && tunnelMode ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        max_tokens: 1,
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return { ok: false, verdict: 'network', ms: Date.now() - started, totalMs: Date.now() - started, detail, url }
  }
  const headerMs = Date.now() - started

  let text = ''
  try {
    text = await response.text()
  } catch (_unreadableBody) {
    // The status and headers already say everything a verdict needs.
  }
  const totalMs = Date.now() - started

  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch (_notJson) {
    // Falls through to the shape checks below.
  }
  const record = typeof json === 'object' && json !== null ? json as Record<string, unknown> : null

  if (response.status >= 300 && response.status < 400) {
    return {
      ok: false, verdict: 'session', status: response.status, ms: headerMs, totalMs,
      detail: `HTTP ${String(response.status)} redirect; the transport lost its session`, url,
    }
  }
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false, verdict: 'rejected', status: response.status, ms: headerMs, totalMs,
      detail: `HTTP ${String(response.status)}: the upstream refused this credential`,
      body: text.slice(0, BODY_CHARS), url,
    }
  }
  if (response.status >= 200 && response.status < 300 && record !== null && Array.isArray(record.choices)) {
    return { ok: true, verdict: 'ok', status: response.status, ms: headerMs, totalMs, usage: record.usage ?? null, url }
  }
  // The site reports every business failure inside `{data, status, message,
  // success}` while the HTTP status stays 200, so matching the HTTP status
  // alone would read "no permission" as success. An expired or refused token
  // arrives here as `success: false`, never as a 401.
  if (record !== null && record.success === false && !Array.isArray(record.choices)) {
    const code = typeof record.status === 'number' ? record.status : null
    const message = typeof record.message === 'string' ? record.message : ''
    return {
      ok: false, verdict: 'rejected', status: response.status, ms: headerMs, totalMs,
      detail: `business code ${String(code)}: ${message}`, code, url,
    }
  }
  return {
    ok: false, verdict: 'other', status: response.status, ms: headerMs, totalMs,
    detail: 'the response is neither a completion nor a known refusal',
    body: text.slice(0, BODY_CHARS), url,
  }
}
