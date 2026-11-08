/**
 * The renewal schedule: decide when the stored token is about to stop working,
 * re-acquire one through the vendored authentication chain, and report honestly
 * what happened.
 *
 * Three rules shape this state machine.
 *
 * The clock comes from the token itself. The campus JWT states its own `exp`,
 * so the deadline is exact and free; the schedule is "renew this far ahead of
 * that instant", not "poll and hope".
 *
 * A rotation is only a rotation if the expiry moved. The school will happily
 * hand back the token that is already expiring, and reporting that as success
 * would leave the status page green and the model failing — so a token whose
 * expiry did not advance is `stalled`, which is a distinct outcome with its own
 * copy, not a failure and not a success.
 *
 * Only a human can unblock a two-factor challenge or a wrong password, and the
 * background loop must never wait on one: it parks the challenge where the Web
 * UI can answer it, and gives up on its own timeout. `needs-human` is therefore
 * a resting state the plugin stays in until either the dialog is answered or
 * the stored credentials are corrected.
 * @module dsh-thu-automad/renew
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-credentials'
import { authErrorCode, isIdentityCode, isTwoFactorCode, loadAuth } from './auth/chain.ts'
import { login, loginViaWebVpn } from './auth/login.ts'
import type { LoginOutcome } from './auth/login.ts'
import { probeDirectSite } from './auth/verify.ts'
import type { ProbeVerdict } from './auth/verify.ts'
import { SessionStore } from './auth/session.ts'
import type { SessionFacts } from './auth/session.ts'
import type { AutomadOptions } from './config.ts'
import { readTokenTimes } from './jwt.ts'
import type { RenewPhase, RenewStatus, TransportPoolStatus, TunnelVerdict } from './protocol.ts'
import type { EffectiveTransport } from './transport/proxy.ts'
import { TwoFactorQueue } from './two-factor.ts'

/** How many times the retry delay may double before it stops growing. */
const MAX_BACKOFF_STEPS = 5

/** How far an expiry must advance for the school to have minted a new token. */
const PROGRESS_MARGIN_MS = 60_000

/** Longest failure text carried to the UI. */
const MAX_MESSAGE_CHARS = 300

const PROBE_FAILURE_CODES = {
  network: 'PROBE_UNREACHABLE',
  session: 'PROBE_SESSION_LOST',
  rejected: 'TOKEN_REJECTED',
  'rate-limited': 'PROBE_RATE_LIMITED',
  unavailable: 'PROBE_UNAVAILABLE',
  other: 'PROBE_UNEXPECTED',
} satisfies Record<Exclude<ProbeVerdict, 'ok'>, string>

/** How long one network decision stands before the next request re-probes it. */
const MODE_PROBE_INTERVAL_MS = 60 * 1000

/** Why a renewal was requested, for the recorded message. */
export type RenewReason = 'schedule' | 'refusal' | 'manual'

/** What one renewal attempt concluded. */
export interface RenewOutcome {
  /** Whether a new, verified token was written. */
  renewed: boolean
  /** Stable code describing the outcome, or null for a success. */
  code: string | null
  /** Credential-free description for the status page. */
  message: string | null
}

/** Run and observe the credential renewal. */
export class Renewer {
  private phase: RenewPhase = 'idle'
  private lastAttemptAt: number | null = null
  private nextAttemptAt: number | null = null
  private retryAt: number | null = null
  private lastCode: string | null = null
  private lastMessage: string | null = null
  private noProgress = false
  private failures = 0
  private inFlight: Promise<RenewOutcome> | undefined
  private stopped = false
  private lastRenewedAt: number | null = null
  private facts: SessionFacts = {
    fingerprint: null, lastRenewAt: null, lastExpiresAt: null, twoFactorAt: null, unattendedRenewals: 0,
    tunnelCookie: null, tunnelCookieAt: null,
  }

  /** WebVPN tunnel cookie the current token must be presented with, or empty. */
  private cookie = ''

  /** When that cookie was acquired, or null before the first tunnel login. */
  private cookieAt: number | null = null

  /** Transport the last decision selected. */
  private mode: EffectiveTransport | 'unknown' = 'unknown'

  /** When the direct host was last probed for reachability. */
  private modeProbedAt = 0

  /** When the tunnel was last kept alive, or null. */
  private probeAt: number | null = null

  /** What that keepalive probe concluded, or null. */
  private probeVerdict: TunnelVerdict | null = null

  /** Whether the loopback transport server is listening. */
  private proxyListening = false

  /** Why the loopback transport server is not listening, when it is not. */
  private proxyError: string | null = null

  /** Per-model admission state the loopback server last reported. */
  private proxyPools: TransportPoolStatus[] = []

  /** Questions the login chain parks here for the Web UI. */
  readonly twoFactor: TwoFactorQueue

  private readonly session: SessionStore

  /**
   * @param ctx - plugin context owning the credentials service.
   * @param options - validated plugin options.
   */
  constructor(private readonly ctx: Context, private readonly options: AutomadOptions) {
    this.twoFactor = new TwoFactorQueue(options.renew.twoFactorTimeoutMs)
    this.session = new SessionStore(ctx)
    if (!this.enabled) this.phase = 'off'
  }

  /** Whether the schedule may run at all. */
  private get enabled(): boolean {
    return this.options.renew.autoRenew && this.options.renew.refreshAheadMs > 0
  }

  /** Re-read the durable session facts the status document reports. */
  async refreshFacts(): Promise<void> {
    this.facts = await this.session.read()
    // The tunnel cookie is session state, not configuration: restoring it means
    // a host restart between renewals does not force a fresh school login.
    if (this.facts.tunnelCookie !== null
      && (this.cookie === '' || (this.facts.tunnelCookieAt ?? 0) > (this.cookieAt ?? 0))) {
      this.cookie = this.facts.tunnelCookie
      this.cookieAt = this.facts.tunnelCookieAt
    }
  }

  /**
   * Evaluate the deadline and renew when it is close enough.
   *
   * Called on a fixed tick rather than scheduled at one instant, because the
   * token can change underneath the schedule — a manual paste, another
   * process's renewal — and re-reading one JWT is cheaper than tracking every
   * way it could move.
   * @returns a promise settling once the evaluation finished.
   */
  async tick(): Promise<void> {
    if (this.stopped) return
    if (!this.enabled) {
      this.phase = 'off'
      this.nextAttemptAt = null
      return
    }
    const now = Date.now()
    if (this.retryAt !== null && now < this.retryAt) {
      this.nextAttemptAt = this.retryAt
      return
    }
    const resolved = await this.ctx.credentials.resolve(this.options.credentialRef)
    if (resolved === undefined) {
      // Nothing to renew yet. Whether that is a problem is the settings page's
      // judgement, not this loop's.
      this.phase = 'idle'
      this.nextAttemptAt = null
      return
    }
    const times = readTokenTimes(resolved.value)
    if (times?.expiresAt == null) {
      // No stated deadline means no schedule; the passive refusal path still
      // covers a token the gateway rejects.
      this.phase = 'idle'
      this.nextAttemptAt = now + this.options.renew.checkIntervalMs
      return
    }
    const due = times.expiresAt - this.options.renew.refreshAheadMs
    if (now < due) {
      this.phase = 'scheduled'
      this.nextAttemptAt = due
      return
    }
    await this.ensureFresh('schedule')
  }

  /**
   * Renew once, reusing an attempt already in flight.
   *
   * Two callers wanting a fresh token at the same moment must produce one
   * login, not two: the school allows one attempt per identity, and a second
   * concurrent login would either duplicate the fingerprint's registration or
   * fail against the first.
   * @param reason - why the renewal was requested.
   * @param signal - caller cancellation; abandons any parked two-factor question.
   * @returns what the attempt concluded.
   */
  async ensureFresh(reason: RenewReason, signal?: AbortSignal): Promise<RenewOutcome> {
    if (this.inFlight !== undefined) return await this.inFlight
    // A renewal that just succeeded is the answer to the failure that asked for
    // it, so a second failure of the same request must not buy a second login.
    // The retry owner grants a bounded number of attempts, and without this each
    // one would re-run the whole authentication chain against the school.
    if (reason !== 'manual' && this.lastRenewedAt !== null
      && Date.now() - this.lastRenewedAt < this.options.renew.checkIntervalMs) {
      return {
        renewed: false,
        code: 'JUST_RENEWED',
        message: 'a renewal already succeeded moments ago; the retry will use that token',
      }
    }
    const run = this.attempt(reason, signal)
    this.inFlight = run
    try {
      return await run
    } finally {
      this.inFlight = undefined
    }
  }

  /**
   * Forget the current retry delay so the next evaluation runs now.
   *
   * Used by the manual trigger: a person who just corrected a password must not
   * wait out a backoff earned by the previous failure.
   */
  clearBackoff(): void {
    this.retryAt = null
  }

  /** Abandon any parked question and stop scheduling. */
  stop(): void {
    this.stopped = true
    this.twoFactor.cancel()
  }

  /**
   * Project the current schedule onto the wire value.
   * @returns the renewal status; the credential value is not part of it.
   */
  snapshot(): RenewStatus {
    return {
      enabled: this.enabled && !this.stopped,
      phase: this.stopped ? 'off' : this.phase,
      lastAttemptAt: this.lastAttemptAt,
      nextAttemptAt: this.nextAttemptAt,
      lastCode: this.lastCode,
      lastMessage: this.lastMessage,
      noProgress: this.noProgress,
      twoFactorAt: this.facts.twoFactorAt,
      unattendedRenewals: this.facts.unattendedRenewals,
    }
  }

  /**
   * Transport facts for the status document and the loopback proxy.
   * @returns the configured and effective path, tunnel cookie age, probe verdict, and server state.
   */
  transportSnapshot(): {
    mode: AutomadOptions['transport']['mode']
    enabled: boolean
    port: number
    effective: EffectiveTransport | 'unknown'
    cookie: string
    cookieAt: number | null
    probeAt: number | null
    probeVerdict: TunnelVerdict | null
    listening: boolean
    lastError: string | null
    pools: TransportPoolStatus[]
  } {
    return {
      mode: this.options.transport.mode,
      enabled: this.options.transport.enabled,
      port: this.options.transport.port,
      effective: this.mode,
      cookie: this.cookie,
      cookieAt: this.cookieAt,
      probeAt: this.probeAt,
      probeVerdict: this.probeVerdict,
      listening: this.proxyListening,
      lastError: this.proxyError,
      pools: this.proxyPools,
    }
  }

  /** Record the loopback server's own state, for the status document. */
  noteProxy(state: { listening: boolean; lastError: string | null; pools?: TransportPoolStatus[] }): void {
    this.proxyListening = state.listening
    this.proxyError = state.lastError
    if (state.pools !== undefined) this.proxyPools = state.pools
  }

  /**
   * Decide which upstream requests must use.
   *
   * A pinned mode is returned as configured. `auto` asks the direct host: the
   * school answers a campus request with the application and an off-campus
   * request with a redirect into the unified-auth form, so one unauthenticated
   * GET separates the two. The decision is cached for a few minutes because a
   * per-request probe would double every call's latency, and re-probed on
   * demand after a failure that suggests the network changed.
   * @param force - probe even when the cached decision is still fresh.
   * @returns the transport the caller should use.
   */
  async detectTransport(force = false): Promise<EffectiveTransport> {
    if (!this.options.transport.enabled || this.options.transport.mode === 'direct') {
      this.mode = 'direct'
      return this.mode
    }
    if (this.options.transport.mode === 'webvpn') {
      this.mode = 'webvpn'
      return this.mode
    }
    const now = Date.now()
    if (!force && this.mode !== 'unknown' && now - this.modeProbedAt < MODE_PROBE_INTERVAL_MS) {
      return this.mode
    }
    const reachability = await probeDirectSite()
    if (reachability === 'campus') this.mode = 'direct'
    else if (reachability === 'offcampus') this.mode = 'webvpn'
    this.modeProbedAt = now
    // An undecided probe (transport failure) keeps the previous decision; on
    // the very first call there is none, and direct is the conservative guess
    // because it is what this plugin did before the tunnel existed.
    if (this.mode === 'unknown') return 'direct'
    return this.mode
  }

  /**
   * Make sure requests have a usable session on the current transport.
   * @returns whether the current transport can carry a request.
   */
  async ensureTunnelSession(): Promise<boolean> {
    const mode = await this.detectTransport()
    if (mode !== 'webvpn') return true
    if (this.cookie !== '') return true
    await this.ensureFresh('manual')
    return this.cookie !== ''
  }

  /**
   * Make the transport usable for the network this process is on now.
   *
   * This is what the loopback transport asks for after the school's gate has
   * refused a request. Two things are decided here, not guessed:
   *
   * The network decision is forced, because the gate just contradicted the
   * cached one — a Wi-Fi switch is exactly when that cache is wrong. On the
   * campus path the token already in hand is all a request needs, so returning
   * to campus recovers without touching the school at all.
   *
   * Off campus a request is only as good as its tunnel session, and a cookie can
   * outlive the session it belongs to. So the stored session is *verified*
   * rather than assumed: a live one needs no repair, an expired one must be
   * discarded before the login replaces it, and a probe that could not reach the
   * tunnel says nothing either way — the login is the only thing that can
   * improve that state, and a login that fails leaves the old cookie untouched,
   * so unreliable evidence never costs the current session.
   * @returns whether a usable transport now exists.
   */
  async ensureTransport(): Promise<boolean> {
    const mode = await this.detectTransport(true)
    if (mode !== 'webvpn') return true
    const verdict: TunnelVerdict = this.cookie === '' ? 'invalid' : await this.probeTunnelSession()
    if (verdict === 'ok') return true
    if (verdict === 'invalid') await this.discardTunnelSession()
    await this.ensureFresh('manual')
    return this.cookie !== ''
  }

  /**
   * Keep the WebVPN tunnel alive between token renewals.
   *
   * The tunnel drops an idle session after roughly two hours, which is shorter
   * than the token's own lifetime, so a token still inside its window would
   * otherwise stop working with no renewal due. An invalid verdict discards the
   * cookie and re-runs the chain; a network failure changes nothing.
   * @returns a promise settling once the probe and any repair finished.
   */
  async keepalive(): Promise<void> {
    if (this.stopped) return
    const mode = await this.detectTransport()
    if (mode !== 'webvpn') return
    if (this.cookie === '') {
      await this.ensureTunnelSession()
      return
    }
    const verdict = await this.probeTunnelSession()
    if (verdict !== 'invalid') return
    await this.discardTunnelSession()
    await this.ensureTunnelSession()
  }

  /**
   * Ask the tunnel whether the stored session cookie is still served.
   * @returns the verdict, recorded for the status page.
   */
  private async probeTunnelSession(): Promise<TunnelVerdict> {
    const auth = loadAuth()
    const verdict = await auth.probeWebvpnSession(auth.MADMODEL_TUNNEL_MODELS_URL, this.cookie)
    this.probeAt = Date.now()
    this.probeVerdict = verdict
    return verdict
  }

  /**
   * Forget the stored tunnel session.
   *
   * Discarding before a login matters: the login replaces the cookie only on
   * success, so a session the tunnel has already rejected would otherwise stay
   * in place and keep answering the login page.
   */
  private async discardTunnelSession(): Promise<void> {
    if (this.cookie === '' && this.facts.tunnelCookie === null) return
    this.cookie = ''
    this.cookieAt = null
    this.facts = await this.session.write({ tunnelCookie: null, tunnelCookieAt: null })
  }

  /** Run one renewal attempt and fold its outcome into the reported state. */
  private async attempt(reason: RenewReason, signal?: AbortSignal): Promise<RenewOutcome> {
    const now = Date.now()
    this.lastAttemptAt = now
    this.phase = 'running'
    this.nextAttemptAt = null
    this.lastCode = null
    this.lastMessage = null

    const username = await this.resolveText(this.options.auth.usernameRef)
    const password = await this.resolveText(this.options.auth.passwordRef)
    if (username === null || password === null) {
      return this.recordFailure(
        'NO_CREDENTIALS',
        `no student id or password is stored under ${this.options.auth.usernameRef} / ${this.options.auth.passwordRef}`,
        true,
      )
    }

    let fingerprint: string
    try {
      fingerprint = await this.session.ensureFingerprint(() => loadAuth().generateFingerprint())
    } catch (error) {
      return this.recordFailure('FINGERPRINT', describe(error), false)
    }

    const previous = readTokenTimes(
      (await this.ctx.credentials.resolve(this.options.credentialRef))?.value ?? '',
    )?.expiresAt ?? null
    const challengeMark = this.twoFactor.challengeMark()

    const mode = await this.detectTransport(true)

    let outcome: LoginOutcome
    try {
      outcome = await this.loginWith(mode, username, password, fingerprint)
    } catch (error) {
      // `auto` can lose a race with a network change: the probe said campus but
      // the gateway then answered with its unified-auth form. That is the one
      // direct failure worth retrying through the tunnel, because the response
      // is a login page rather than a refused credential.
      const retryThroughTunnel = mode === 'direct'
        && this.options.transport.enabled
        && this.options.transport.mode === 'auto'
        && looksLikeGate(error)
      if (!retryThroughTunnel) return this.recordFailure(...classify(error))
      this.mode = 'webvpn'
      this.modeProbedAt = Date.now()
      try {
        outcome = await this.loginWith('webvpn', username, password, fingerprint)
      } catch (tunnelError) {
        return this.recordFailure(...classify(tunnelError))
      }
    } finally {
      // A caller that walked away must not leave a question parked for the next
      // attempt to trip over.
      if (signal?.aborted === true) this.twoFactor.cancel()
    }

    // Leave the active token and its session in place until the candidate is
    // verified and has a later expiry.
    const probe = outcome.probe
    if (probe !== undefined && probe.verdict !== 'ok') {
      return this.recordFailure(
        PROBE_FAILURE_CODES[probe.verdict], probe.detail ?? 'The new token could not be verified', false,
      )
    }

    if (previous !== null && outcome.expiresAt <= previous + PROGRESS_MARGIN_MS) {
      this.noProgress = true
      this.phase = 'stalled'
      this.lastCode = 'NO_PROGRESS'
      this.lastMessage = 'the school returned the same token: its expiry did not advance, so nothing was renewed'
      this.retryAt = null
      this.nextAttemptAt = outcome.expiresAt
      // Nothing was renewed, but a session was still opened: the tunnel cookie
      // is not part of the token, and off campus it is the only thing that
      // makes the gateway answer at all. Dropping it here is how the WebVPN
      // path could never come up — a token that was not due yet meant "no
      // progress", and the one working cookie went with it.
      await this.adoptTunnelSession(outcome)
      return { renewed: false, code: 'NO_PROGRESS', message: this.lastMessage }
    }

    try {
      await this.ctx.credentials.set(this.options.credentialRef, outcome.token)
    } catch (error) {
      // The credential seam refuses a write its launching environment would
      // shadow. That is a configuration fault, not a renewal failure, and the
      // message it already carries is the useful one.
      return this.recordFailure('WRITE_REFUSED', describe(error), true)
    }

    // A tunnel cookie belongs to the token it came with. Activate it only
    // after the credential write succeeds.
    this.cookie = outcome.ticketSource === 'webvpn' ? outcome.cookie : ''
    this.cookieAt = this.cookie === '' ? null : Date.now()
    const attended = this.twoFactor.challengeMark() !== challengeMark
    const unattendedRenewals = attended ? 0 : this.facts.unattendedRenewals + 1
    this.facts = await this.session.write({
      lastRenewAt: Date.now(),
      lastExpiresAt: outcome.expiresAt,
      tunnelCookie: this.cookie === '' ? null : this.cookie,
      tunnelCookieAt: this.cookieAt,
      ...attended ? { twoFactorAt: this.twoFactor.challengeMark() } : {},
      unattendedRenewals,
    })

    this.failures = 0
    this.retryAt = null
    this.noProgress = false
    this.phase = 'ok'
    this.lastRenewedAt = Date.now()
    this.lastCode = null
    this.lastMessage = `renewed on ${reason}; the new token expires at ${new Date(outcome.expiresAt).toISOString()}`
    this.nextAttemptAt = outcome.expiresAt - this.options.renew.refreshAheadMs
    return { renewed: true, code: null, message: this.lastMessage }
  }

  /**
   * Adopt the WebVPN session a login opened, when it minted no new token.
   *
   * The tunnel cookie belongs to the session, not to the token: it is what makes
   * the tunneled host answer, and it stays valid while the old token does. The
   * two facts are therefore decided separately — only the token has to move for
   * a renewal to count, and only the cookie has to exist for the transport to
   * work off campus.
   * @param outcome - what the login produced.
   */
  private async adoptTunnelSession(outcome: LoginOutcome): Promise<void> {
    const cookie = outcome.ticketSource === 'webvpn' ? outcome.cookie : ''
    if (cookie === '') return
    this.cookie = cookie
    this.cookieAt = Date.now()
    this.facts = await this.session.write({
      tunnelCookie: this.cookie,
      tunnelCookieAt: this.cookieAt,
    })
  }

  /**
   * Run the authentication chain one transport selected.
   *
   * Verification follows the same transport: a token minted by the tunnel is
   * checked through the tunnel, and a direct login keeps the configured probe
   * choice. Every other input is transport-independent.
   * @param mode - transport this attempt uses.
   * @param username - student id.
   * @param password - unified-auth password.
   * @param fingerprint - device fingerprint to present.
   * @returns the login outcome, including the tunnel cookie when one exists.
   */
  private async loginWith(
    mode: EffectiveTransport,
    username: string,
    password: string,
    fingerprint: string,
  ): Promise<LoginOutcome> {
    const request = {
      username,
      password,
      fingerprint,
      handler: this.twoFactor.handler(),
      ...this.options.renew.verifyAfterRenew
        ? { verify: { model: this.options.renew.verifyModel, tunnel: mode === 'webvpn' || this.options.auth.tunnel } }
        : {},
    }
    return mode === 'webvpn' ? await loginViaWebVpn(request) : await login(request)
  }

  /**
   * Record a failed attempt and schedule the next one.
   * @param code - stable code for the UI.
   * @param message - credential-free description.
   * @param needsHuman - whether only a person can change this outcome.
   * @returns the outcome for the caller.
   */
  private recordFailure(code: string, message: string, needsHuman: boolean): RenewOutcome {
    const text = truncate(message)
    this.failures += 1
    this.phase = needsHuman ? 'needs-human' : 'error'
    this.lastCode = code
    this.lastMessage = text
    // Exponential from the evaluation tick, so a gateway outage does not turn
    // into a login attempt every minute, and a person who fixes the cause is
    // never more than a click away from retrying by hand.
    const steps = Math.min(this.failures, MAX_BACKOFF_STEPS)
    this.retryAt = Date.now() + this.options.renew.checkIntervalMs * 2 ** steps
    this.nextAttemptAt = this.retryAt
    return { renewed: false, code, message: text }
  }

  /** Resolve one credential reference to a trimmed non-empty value. */
  private async resolveText(ref: AutomadOptions['credentialRef']): Promise<string | null> {
    const resolved = await this.ctx.credentials.resolve(ref)
    if (resolved === undefined) return null
    const value = resolved.value.trim()
    return value === '' ? null : value
  }
}

/** Classify one thrown login failure into a reported code and whether a human is needed. */
function classify(error: unknown): [code: string, message: string, needsHuman: boolean] {
  const code = authErrorCode(error)
  const message = describe(error)
  if (isTwoFactorCode(code)) {
    return [code ?? 'TWO_FACTOR_REQUIRED', message, true]
  }
  if (isIdentityCode(code)) return [code, message, true]
  return [code ?? 'LOGIN_FAILED', message, false]
}

/** Read a short description out of any thrown value. */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return truncate(message)
}

/**
 * Whether a direct-chain failure is the school's network gate rather than a
 * credential verdict.
 *
 * Off campus the direct host answers with a redirect into the unified-auth
 * form; depending on where the redirect was followed, the symptom is the OAuth
 * host name, the login page's own markup, or a ticket endpoint that returned
 * HTML instead of JSON. None of those say anything about the password, and all
 * of them are worth one retry through the tunnel in `auto` mode.
 * @param error - value the direct chain failed with.
 * @returns true when the tunnel is the plausible repair.
 */
function looksLikeGate(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /thu-oauth|id\.tsinghua\.edu\.cn|sm2publicKey|<!doctype|<html|ticket was refused/iu.test(text)
}

/** Keep a diagnostic within the length the status page renders. */
function truncate(text: string): string {
  return text.length <= MAX_MESSAGE_CHARS ? text : `${text.slice(0, MAX_MESSAGE_CHARS)}…`
}
