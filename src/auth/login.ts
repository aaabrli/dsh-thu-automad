/** Sign in through campus SSO or WebVPN and redeem the session ticket. */

import {
  CHECK_URL, FORM_URL, TICKET_CONSUMER, loadAuth,
} from './chain.ts'
import type { TwoFactorHandler, VendoredCookieJar } from './chain.ts'

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

  // Read the ticket from the success page or its redirect.
  const fromBody = /[?&]ticket=([^"&'<>\s]+)/iu.exec(body)
  const fromRedirect = /[?&]ticket=([^"&#]+)/u.exec(redirect)
  let ticket: string | null = fromBody !== null
    ? decodeURIComponent(fromBody[1] as string)
    : fromRedirect !== null ? decodeURIComponent(fromRedirect[1] as string) : null
  let source: TicketSource = fromBody !== null ? 'body' : 'redirect'

  if (ticket === null) {
    // Normalize the missing slash in campus login redirect URLs.
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

  return {
    token,
    expiresAt: auth.jwtExpiresAt(token),
    cookie: jar.headerFor(auth.TUNNEL_COOKIE_SCOPE),
    ticketSource: source,
    durationMs: Date.now() - started,
  }

}

/** Run the off-campus login chain: WebVPN session, info-portal roaming, and ticket redemption on the tunneled madmodel path. */
export async function loginViaWebVpn(request: LoginRequest): Promise<LoginOutcome> {
  const auth = loadAuth()
  const started = Date.now()
  // The WebVPN client owns the tunnel cookie jar.
  const client = new auth.MadmodelAuthClient(new auth.CookieJar())
  const result = await client.getMadModelToken({
    username: request.username,
    password: request.password,
    fingerPrint: request.fingerprint,
    ...request.handler === undefined ? {} : { twoFactorHandler: request.handler },
  })
  return {
    token: result.token,
    expiresAt: result.expiresAt,
    cookie: result.cookie,
    ticketSource: 'webvpn',
    durationMs: Date.now() - started,
  }
}

/** Follow redirects until a ticket appears in one of the URLs. */
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
