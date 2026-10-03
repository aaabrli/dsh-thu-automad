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
import { login } from './auth/login.ts'
import type { LoginOutcome } from './auth/login.ts'
import { SessionStore } from './auth/session.ts'
import type { SessionFacts } from './auth/session.ts'
import type { AutomadOptions } from './config.ts'
import { readTokenTimes } from './jwt.ts'
import type { RenewPhase, RenewStatus } from './protocol.ts'
import { TwoFactorQueue } from './two-factor.ts'

/** How many times the retry delay may double before it stops growing. */
const MAX_BACKOFF_STEPS = 5

/** How far an expiry must advance for the school to have minted a new token. */
const PROGRESS_MARGIN_MS = 60_000

/** Longest failure text carried to the UI. */
const MAX_MESSAGE_CHARS = 300

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
  }

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

    let outcome: LoginOutcome
    try {
      outcome = await login({
        username,
        password,
        fingerprint,
        handler: this.twoFactor.handler(),
        ...this.options.renew.verifyAfterRenew
          ? { verify: { model: this.options.renew.verifyModel, tunnel: this.options.auth.tunnel } }
          : {},
      })
    } catch (error) {
      return this.recordFailure(...classify(error))
    } finally {
      // A caller that walked away must not leave a question parked for the next
      // attempt to trip over.
      if (signal?.aborted === true) this.twoFactor.cancel()
    }

    // A token the gateway explicitly refuses is worse than an old token: it
    // would be stored under the very reference the provider reads. A transport
    // failure proves nothing, so it does not discard a freshly issued token.
    const probe = outcome.probe
    if (probe !== undefined && !probe.ok && probe.verdict !== 'network') {
      return this.recordFailure('TOKEN_REJECTED', probe.detail ?? 'the upstream refused the new token', false)
    }

    if (previous !== null && outcome.expiresAt <= previous + PROGRESS_MARGIN_MS) {
      this.noProgress = true
      this.phase = 'stalled'
      this.lastCode = 'NO_PROGRESS'
      this.lastMessage = 'the school returned the same token: its expiry did not advance, so nothing was renewed'
      this.retryAt = null
      this.nextAttemptAt = outcome.expiresAt
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

    const attended = this.twoFactor.challengeMark() !== challengeMark
    const unattendedRenewals = attended ? 0 : this.facts.unattendedRenewals + 1
    this.facts = await this.session.write({
      lastRenewAt: Date.now(),
      lastExpiresAt: outcome.expiresAt,
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

/** Keep a diagnostic within the length the status page renders. */
function truncate(text: string): string {
  return text.length <= MAX_MESSAGE_CHARS ? text : `${text.slice(0, MAX_MESSAGE_CHARS)}…`
}
