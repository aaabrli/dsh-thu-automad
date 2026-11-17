/** Persist the device fingerprint, tunnel session and renewal timestamps. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-credentials'
import type { CredentialKey, CredentialRecord } from '@deepseek-ai/dsh-credentials'

/** Record key this plugin owns. */
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
  /** WebVPN tunnel cookie header value the token must be presented with, or null. */
  tunnelCookie: string | null
  /** Epoch milliseconds when that tunnel cookie was acquired, or null. */
  tunnelCookieAt: number | null
}

/** Facts of a session nothing has recorded yet. */
const EMPTY: SessionFacts = {
  fingerprint: null,
  lastRenewAt: null,
  lastExpiresAt: null,
  twoFactorAt: null,
  unattendedRenewals: 0,
  tunnelCookie: null,
  tunnelCookieAt: null,
}

/** Read and write this plugin's session record. */
export class SessionStore {
  /**
   * @param ctx - plugin context owning the credentials service.
   */
  constructor(private readonly ctx: Context) {}

  /** Read the stored facts. */
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

  /** Return the stored device fingerprint, generating and storing one on first use. */
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
    tunnelCookie: typeof raw.tunnelCookie === 'string' && raw.tunnelCookie.length > 0
      ? raw.tunnelCookie
      : null,
    tunnelCookieAt: milliseconds(raw.tunnelCookieAt),
  }
}

/** Read one stored timestamp, rejecting anything a clock could not have produced. */
function milliseconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
