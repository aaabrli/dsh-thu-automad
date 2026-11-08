/**
 * The direct ticket path: password to JWT without the WebVPN layer.
 *
 * This is the chain `auth-probe/direct-login.js` validated against the live
 * school: password-login the DEEPSEEK application's SSO form through the
 * vendored library, read the ticket out of the success page, and redeem it at
 * the madmodel endpoint. The proxy this was reverse-engineered alongside
 * instead roams the info portal through a WebVPN session, but both routes
 * converge on the same `auth-login/check?ticket=` endpoint, and the direct one
 * needs no tunnel.
 *
 * The ticket is read from the response body first. Redeeming it needs the
 * ticket alone, so following the redirect the page advertises is a fallback
 * rather than a step — which also sidesteps the malformed redirect hosts the
 * school has been observed to emit.
 * @module dsh-thu-automad/auth/login
 */

import {
  CHECK_URL, FORM_URL, TICKET_CONSUMER, loadAuth,
} from './chain.ts'
import type { TwoFactorHandler, VendoredCookieJar } from './chain.ts'
import { probeUpstreamWithRetry } from './verify.ts'
import type { ProbeResult } from './verify.ts'

/** Longest hop chain followed while hunting a ticket. */
const MAX_HOPS = 12

/** Per-request timeout for the hops this module drives itself. */
const HOP_TIMEOUT_MS = 20_000

/** Where a ticket was found. */
export type TicketSource = 'body' | 'redirect' | 'chain' | 'webvpn'

/** What one login attempt produced. */
export interface LoginOutcome {
  /** The redeemed JWT. */
  token: string
  /** Expiry in epoch milliseconds, from the JWT's own claim. */
  expiresAt: number
  /** Tunnel cookie header value; empty on the direct path. */
  cookie: string
  /** Where the ticket came from, for diagnostics. */
  ticketSource: TicketSource
  /** Wall-clock duration of the login, in milliseconds. */
  durationMs: number
  /** Upstream probe result, when verification was requested. */
  probe?: ProbeResult
}

/** What one login attempt needs. */
export interface LoginRequest {
  /** Student id. */
  username: string
  /** Unified-auth password. */
  password: string
  /** Device fingerprint to present; reusing one is what buys an unattended window. */
  fingerprint: string
  /** Two-factor answerer; without it the chain cannot offer the handshake. */
  handler?: TwoFactorHandler
  /** Verify the redeemed token against the upstream before returning it. */
  verify?: {
    /** Model id the verification call names. */
    model: string
    /** Whether to verify through the WebVPN tunnel. */
    tunnel: boolean
  }
}

/**
 * Run one full password login and redeem the resulting ticket for a token.
 * @param request - identity, fingerprint, two-factor answerer, and verify choice.
 * @returns the token and where it came from.
 * @throws Error carrying the vendored chain's stable `code` when a step fails.
 */
export async function login(request: LoginRequest): Promise<LoginOutcome> {
  const auth = loadAuth()
  const started = Date.now()
  const jar = new auth.CookieJar()
  const client = new auth.MadmodelAuthClient(jar)

  const identity = await client.authenticateIdentity(
    FORM_URL,
    CHECK_URL,
    request.username,
    request.password,
    request.fingerprint,
    request.handler,
  )

  const body = String(identity.body ?? '')
  const redirect = String(identity.redirectUrl ?? '')

  // The success page carries the ticket in a link. Take it from the body first:
  // the endpoint only ever needs the ticket itself, so following the anchor
  // would spend a hop and inherit whatever host form the school emitted.
  const fromBody = /[?&]ticket=([^"&'<>\s]+)/iu.exec(body)
  const fromRedirect = /[?&]ticket=([^"&#]+)/u.exec(redirect)
  let ticket: string | null = fromBody !== null
    ? decodeURIComponent(fromBody[1] as string)
    : fromRedirect !== null ? decodeURIComponent(fromRedirect[1] as string) : null
  let source: TicketSource = fromBody !== null ? 'body' : 'redirect'

  if (ticket === null) {
    // Some success pages advertise a host with the path separator missing
    // (`...edu.cnauthlogin/...`), which `new URL` reads as one host. Repairing
    // that one form is cheaper than explaining the failure later.
    const repaired = redirect.replace(/^(https:\/\/[\w.-]+\.tsinghua\.edu\.cn)(?=[^/])/iu, '$1/')
    const chased = await chaseTicket(repaired, jar)
    ticket = chased
    source = 'chain'
  }

  if (ticket === null) {
    throw new Error('thu-automad: login succeeded but no ticket could be read from the success page')
  }

  const response = await fetch(TICKET_CONSUMER + encodeURIComponent(ticket), {
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  })
  const text = await response.text()
  let decoded: unknown = null
  try {
    decoded = JSON.parse(text)
  } catch (_notJson) {
    // Reported below as a redemption failure.
  }
  const record = typeof decoded === 'object' && decoded !== null ? decoded as Record<string, unknown> : null
  const token = typeof record?.data === 'string' ? record.data.trim() : ''
  if (token === '') {
    const message = typeof record?.message === 'string' ? record.message : text.slice(0, 200)
    throw new Error(`thu-automad: the ticket was refused at the token endpoint (HTTP ${String(response.status)}): ${message}`)
  }

  const outcome: LoginOutcome = {
    token,
    expiresAt: auth.jwtExpiresAt(token),
    cookie: jar.headerFor(auth.TUNNEL_COOKIE_SCOPE),
    ticketSource: source,
    durationMs: Date.now() - started,
  }

  if (request.verify !== undefined) {
    outcome.probe = await probeUpstreamWithRetry({
      token,
      model: request.verify.model,
      cookie: outcome.cookie,
      tunnelMode: request.verify.tunnel,
      tunnelPrefix: auth.MADMODEL_VPN_PREFIX,
    })
  }
  return outcome
}

/**
 * Run the off-campus login chain: WebVPN session, info-portal roaming, and
 * ticket redemption on the tunneled madmodel path.
 *
 * The direct chain above only works while the request reaches the gateway from
 * a campus address. Off campus the school redirects the direct host name into
 * the unified-auth OAuth form, so both the ticket redemption and later model
 * requests need the WebVPN tunnel; this function is that path. It returns the
 * tunnel cookie alongside the token because the tunnel rejects a bare Bearer.
 * @param request - identity, fingerprint, two-factor answerer, and verify choice.
 * @returns the token, the tunnel cookie, and where the ticket came from.
 * @throws Error carrying the vendored chain's stable `code` when a step fails.
 */
export async function loginViaWebVpn(request: LoginRequest): Promise<LoginOutcome> {
  const auth = loadAuth()
  const started = Date.now()
  // The chain hangs off a client that owns the cookie jar the tunnel session
  // lives in; the vendored entry exports the class, not a module-level
  // `getMadModelToken`. Spelling it as a module call throws before the first
  // request, which is exactly how this path was dead on arrival.
  const client = new auth.MadmodelAuthClient(new auth.CookieJar())
  const result = await client.getMadModelToken({
    username: request.username,
    password: request.password,
    fingerPrint: request.fingerprint,
    ...request.handler === undefined ? {} : { twoFactorHandler: request.handler },
  })
  const outcome: LoginOutcome = {
    token: result.token,
    expiresAt: result.expiresAt,
    cookie: result.cookie,
    ticketSource: 'webvpn',
    durationMs: Date.now() - started,
  }
  if (request.verify !== undefined) {
    // The token is only useful with the tunnel that issued it, so the probe
    // always follows the tunnel even when the caller asked for direct.
    outcome.probe = await probeUpstreamWithRetry({
      token: outcome.token,
      model: request.verify.model,
      cookie: outcome.cookie,
      tunnelMode: true,
      tunnelPrefix: auth.MADMODEL_VPN_PREFIX,
    })
  }
  return outcome
}

/**
 * Follow redirects until a ticket appears in one of the URLs.
 *
 * Every hop is checked against the vendored allowlist before it is requested,
 * so a compromised success page cannot send this process to a foreign host.
 * @param startUrl - repaired redirect the success page advertised.
 * @param jar - cookie jar shared with the login.
 * @returns the ticket, or null when no hop produced one.
 */
async function chaseTicket(startUrl: string, jar: VendoredCookieJar): Promise<string | null> {
  const auth = loadAuth()
  let url = startUrl
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    if (!auth.isAllowedRedirect(url)) return null
    const hit = /[?&]ticket=([^&#]+)/iu.exec(url)
    if (hit !== null) return decodeURIComponent(hit[1] as string)
    const cookie = jar.headerFor(url)
    let response: Response
    try {
      response = await fetch(url, {
        headers: cookie === '' ? {} : { Cookie: cookie },
        redirect: 'manual',
        signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
      })
    } catch (_hopUnreachable) {
      return null
    }
    try {
      jar.absorb(url, response.headers.getSetCookie())
    } catch (_noSetCookie) {
      // A hop without Set-Cookie is ordinary.
    }
    const location = response.headers.get('location')
    if (location === null || response.status < 300 || response.status >= 400) return null
    url = new URL(location, url).href
  }
  return null
}
