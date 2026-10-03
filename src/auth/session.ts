/**
 * Durable facts about the authenticated session, kept in the credentials
 * record space rather than alongside the token.
 *
 * The device fingerprint is the identity the school's trusted-device list holds.
 * Losing it is not a cache miss: the next renewal is treated as an unknown
 * device and demands a two-factor answer, which is the difference between a
 * renewal that runs unattended for months and one that asks a human every six
 * hours. So it is written through the credentials seam's cross-process
 * serialized read-modify-write, at the same protection level as the password,
 * instead of being regenerated per process.
 *
 * The same record carries the renewal history the status page reports, because
 * "when did this last succeed" and "has a two-factor answer been followed by an
 * unattended renewal" are facts about the session, not about this process.
 * @module dsh-thu-automad/auth/session
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-credentials'
import type { CredentialKey, CredentialRecord } from '@deepseek-ai/dsh-credentials'

/**
 * Record key this plugin owns.
 *
 * Written as a literal because this package resolves no harness runtime value;
 * `scope/id` with both segments matching the seam's own `[a-z][a-z0-9-]*`
 * grammar is exactly what `credentialKey('thu-automad', 'session')` produces.
 */
const SESSION_KEY = 'thu-automad/session' as CredentialKey

/** Shape of the fingerprint the chain generates: 16 random bytes, hex encoded. */
const FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/u

/** Durable session facts. Every field is absent until something writes it. */
export interface SessionFacts {
  /** Device fingerprint presented to the school, or null before the first login. */
  fingerprint: string | null
  /** Epoch milliseconds of the last successful renewal, or null. */
  lastRenewAt: number | null
  /** Expiry of the token that renewal produced, in epoch milliseconds, or null. */
  lastExpiresAt: number | null
  /** Epoch milliseconds a two-factor challenge was last answered, or null. */
  twoFactorAt: number | null
  /** Successful renewals completed without a two-factor answer since that challenge. */
  unattendedRenewals: number
}

/** Facts of a session nothing has recorded yet. */
const EMPTY: SessionFacts = {
  fingerprint: null,
  lastRenewAt: null,
  lastExpiresAt: null,
  twoFactorAt: null,
  unattendedRenewals: 0,
}

/** Read and write this plugin's session record. */
export class SessionStore {
  /**
   * @param ctx - plugin context owning the credentials service.
   */
  constructor(private readonly ctx: Context) {}

  /**
   * Read the stored facts.
   *
   * The payload crosses a durable boundary, so it is validated rather than
   * trusted: a hand-edited or older document must degrade to "nothing known"
   * instead of feeding a malformed fingerprint to the login chain.
   * @returns the stored facts, or {@link EMPTY} when nothing is stored.
   */
  async read(): Promise<SessionFacts> {
    return readFacts(await this.ctx.credentials.readRecord(SESSION_KEY))
  }

  /**
   * Merge a patch into the stored facts.
   * @param patch - fields to replace.
   * @returns the facts after the write.
   */
  async write(patch: Partial<SessionFacts>): Promise<SessionFacts> {
    let next: SessionFacts = EMPTY
    await this.ctx.credentials.modifyRecord(SESSION_KEY, (current) => {
      next = { ...readFacts(current), ...patch }
      return Promise.resolve(grant(next))
    })
    return next
  }

  /**
   * Return the stored device fingerprint, generating and storing one on first use.
   *
   * A fingerprint is reused for the life of the record, never rotated: the
   * school only extends trust to a fingerprint it has seen, and a fresh one
   * would discard a window that is still open.
   * @param generate - produces a new fingerprint when none is stored.
   * @returns the fingerprint now on record.
   */
  async ensureFingerprint(generate: () => string): Promise<string> {
    let chosen = ''
    await this.ctx.credentials.modifyRecord(SESSION_KEY, (current) => {
      const facts = readFacts(current)
      if (facts.fingerprint !== null) {
        chosen = facts.fingerprint
        return Promise.resolve(current)
      }
      chosen = generate()
      return Promise.resolve(grant({ ...facts, fingerprint: chosen }))
    })
    return chosen
  }
}

/** Wrap facts in the grant record shape the seam stores opaque payloads in. */
function grant(facts: SessionFacts): CredentialRecord {
  return { kind: 'grant', payload: facts }
}

/** Read stored facts out of one record value, validating every field. */
function readFacts(record: CredentialRecord | undefined): SessionFacts {
  if (record === undefined || record.kind !== 'grant') return EMPTY
  const payload = record.payload
  if (typeof payload !== 'object' || payload === null) return EMPTY
  const raw = payload as Record<string, unknown>
  const fingerprint = typeof raw.fingerprint === 'string' && FINGERPRINT_PATTERN.test(raw.fingerprint)
    ? raw.fingerprint
    : null
  return {
    fingerprint,
    lastRenewAt: milliseconds(raw.lastRenewAt),
    lastExpiresAt: milliseconds(raw.lastExpiresAt),
    twoFactorAt: milliseconds(raw.twoFactorAt),
    unattendedRenewals: typeof raw.unattendedRenewals === 'number'
      && Number.isSafeInteger(raw.unattendedRenewals) && raw.unattendedRenewals >= 0
      ? raw.unattendedRenewals
      : 0,
  }
}

/** Read one stored timestamp, rejecting anything a clock could not have produced. */
function milliseconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
