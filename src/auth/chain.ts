/**
 * Loader and typed surface for the vendored Tsinghua authentication chain.
 *
 * The chain is reverse-engineered protocol knowledge — SM2-encrypted password
 * login, the school's two-factor handshake, ticket redemption — and this
 * package does not reimplement it. `vendor/madmodel/` holds a byte-identical
 * CommonJS copy with its SHA-256 recorded in `vendor/madmodel/README.md`, plus
 * a `package.json` marker that keeps the directory CommonJS despite the owning
 * package declaring `"type": "module"`. This module is the only place that
 * reaches it.
 *
 * It loads through `createRequire` rather than `import` on purpose. The module
 * installs a `globalThis.window.crypto` shim *before* it evaluates the vendored
 * SM2 library, because that library seeds its entropy pool at evaluation time
 * and would otherwise fall back to `Math.random` for the bytes that encrypt the
 * password. A static `import` would hoist the SM2 evaluation above the shim and
 * weaken the ciphertext silently. `require` is synchronous, so the transient
 * global it writes can never be observed by anything else.
 * @module dsh-thu-automad/auth/chain
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/** School SSO app id for the DEEPSEEK application: `md5('DEEPSEEK')`, fixed by the school. */
export const SSO_APP = 'd736f067a6705ab942df52f958a0f23b'

/** Identity-provider host every login step starts from. */
export const ID_PREFIX = 'https://id.tsinghua.edu.cn'

/**
 * madmodel site the redeemed token belongs to.
 *
 * The ticket chain and the upstream probe both build their URLs from this
 * constant, so this — not the provider row's `baseURL` — is the host a renewal
 * talks to. The two are configured independently and are not cross-checked:
 * pointing the route elsewhere changes model requests only.
 */
export const SITE = 'https://madmodel.cs.tsinghua.edu.cn'

/** Login form the direct path posts the encrypted password to. */
export const FORM_URL = `${ID_PREFIX}/do/off/ui/auth/login/form/${SSO_APP}/0`

/** Endpoint the login form posts to and that answers with the ticket redirect. */
export const CHECK_URL = `${ID_PREFIX}/do/off/ui/auth/login/check`

/** Endpoint that redeems a ticket for the madmodel JWT. */
export const TICKET_CONSUMER = `${SITE}/model-api/auth-login/check?ticket=`

/** Device name the vendored chain registers on the school's trusted-device list. */
export const DEVICE_NAME = 'dsh-madmodel'

/** The request shape the chain hands the two-factor handler at the method stage. */
export interface TwoFactorMethodRequest {
  /** Discriminant for the stage. */
  stage: 'method'
  /** Verification methods the school offered, in its own preference order. */
  methods: readonly string[]
  /** Masked phone number, when the SMS method is offered. */
  phone?: string | null
}

/** The request shape the chain hands the two-factor handler at the code stage. */
export interface TwoFactorCodeRequest {
  /** Discriminant for the stage. */
  stage: 'code'
  /** Method chosen at the previous stage. */
  method: string
  /** Masked phone number, when applicable. */
  phone?: string | null
}

/** One two-factor question the chain asks the caller. */
export type TwoFactorRequest = TwoFactorMethodRequest | TwoFactorCodeRequest

/** The object form of a method-stage answer. */
export interface TwoFactorSelection {
  /** One of the offered method ids. */
  method: string
  /** Whether to register this device as trusted; omitted means true. */
  trustDevice?: boolean
}

/**
 * Answer one two-factor question.
 *
 * At the method stage it returns a method id or a {@link TwoFactorSelection};
 * at the code stage it returns the six-digit code. A falsy or malformed answer
 * is how the chain is told to give up, which is why every path here must
 * eventually answer rather than hang.
 */
export type TwoFactorHandler = (request: TwoFactorRequest) => Promise<string | TwoFactorSelection>

/** Cookie store the chain carries across redirects. */
export interface VendoredCookieJar {
  /**
   * Absorb one response's `Set-Cookie` list.
   * @param url - URL the response came from.
   * @param setCookie - header values to store.
   */
  absorb(url: string, setCookie: readonly string[]): void
  /**
   * Render the `Cookie` header for one URL.
   * @param url - target URL.
   * @returns the header value, empty when nothing matches.
   */
  headerFor(url: string): string
}

/** What one successful password login produces before a ticket is redeemed. */
export interface IdentityResult {
  /** Success page body. */
  body: string
  /** Redirect the success page declared. */
  redirectUrl: string
  /** Base URL the page's own anchors resolve against. */
  anchorBase: string
}

/** Client for the direct (non-WebVPN) authentication chain. */
export interface VendoredAuthClient {
  /**
   * Password-login the application SSO form, completing two-factor when asked.
   * @param formUrl - login form to fetch.
   * @param checkUrl - endpoint the form posts to.
   * @param username - student id.
   * @param password - unified-auth password.
   * @param fingerPrint - device fingerprint to present.
   * @param handler - two-factor answerer, required for the chain to offer the handshake.
   * @returns the success page facts a ticket can be read from.
   */
  authenticateIdentity(
    formUrl: string,
    checkUrl: string,
    username: string,
    password: string,
    fingerPrint: string,
    handler?: TwoFactorHandler,
    existingFormPage?: unknown,
  ): Promise<IdentityResult>
}

/** The vendored module's exports this package uses. */
export interface VendoredAuth {
  /** Construct a chain client around one cookie jar. */
  MadmodelAuthClient: new (jar?: VendoredCookieJar) => VendoredAuthClient
  /** Construct an empty cookie jar. */
  CookieJar: new () => VendoredCookieJar
  /** Generate a 32-hex-character device fingerprint. */
  generateFingerprint(): string
  /** Read a JWT's `exp`, falling back to now + 5h when it cannot be decoded. */
  jwtExpiresAt(token: string): number
  /** Whether a redirect target is an allowed Tsinghua HTTPS host. */
  isAllowedRedirect(url: string): boolean
  /** Mask credential-bearing query parameters out of a URL for logging. */
  redactUrl(text: string): string
  /** Cookie scope covering the WebVPN tunnel. */
  TUNNEL_COOKIE_SCOPE: string
  /** WebVPN tunnel prefix for the madmodel origin. */
  MADMODEL_VPN_PREFIX: string
  /** Probe URL answering whether a tunnel session is live. */
  MADMODEL_TUNNEL_MODELS_URL: string
  /**
   * Ask the tunnel whether a session cookie is still accepted.
   * @param url - absolute URL to probe.
   * @param cookie - tunnel cookie header value.
   * @returns the classification.
   */
  probeWebvpnSession(url: string, cookie: string): Promise<'ok' | 'invalid' | 'network'>
}

/** Candidate locations of the vendored entry, relative to this module. */
const CANDIDATES = [
  '../vendor/madmodel/madmodel-auth.js',
  '../../vendor/madmodel/madmodel-auth.js',
  './vendor/madmodel/madmodel-auth.js',
]

let loaded: VendoredAuth | undefined

/**
 * Load the vendored authentication chain, once per process.
 * @returns the module's exports.
 * @throws Error when no vendored copy is present next to this plugin.
 */
export function loadAuth(): VendoredAuth {
  if (loaded !== undefined) return loaded
  const require = createRequire(import.meta.url)
  for (const candidate of CANDIDATES) {
    const path = fileURLToPath(new URL(candidate, import.meta.url))
    if (!existsSync(path)) continue
    loaded = require(path) as VendoredAuth
    return loaded
  }
  throw new Error(
    'thu-automad: the vendored authentication chain is missing; expected '
    + 'vendor/madmodel/madmodel-auth.js inside the installed package',
  )
}

/**
 * Read one error's stable code, when it carries one.
 * @param error - value a login step failed with.
 * @returns the code, or undefined when the value is not a coded chain error.
 */
export function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/**
 * Whether a chain error code means the school demanded a two-factor answer.
 * @param code - value from {@link authErrorCode}.
 * @returns true for every code the two-factor handshake can produce.
 */
export function isTwoFactorCode(code: string | undefined): code is string {
  return code !== undefined && code.startsWith('TWO_FACTOR_')
}

/**
 * Whether a chain error code means the stored identity is wrong or unusable.
 * @param code - value from {@link authErrorCode}.
 * @returns true when only a corrected credential can help.
 */
export function isIdentityCode(code: string | undefined): code is 'BAD_CREDENTIALS' {
  return code === 'BAD_CREDENTIALS'
}
