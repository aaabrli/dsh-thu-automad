/** Track token expiry, authentication refusals and successful requests. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-credentials'
import type { ProbeOptions, TokenWatchOptions } from './config.ts'
import { readTokenTimes } from './jwt.ts'
import type { TokenState, TokenStatus } from './protocol.ts'

/** Longest provider refusal text carried to the UI. */
const MAX_REFUSAL_CHARS = 200

/** One recorded provider refusal. */
interface Refusal {
  /** Epoch milliseconds when the refusal was observed. */
  at: number
  /** Provider refusal text, truncated. */
  message: string
  /** Fingerprint of the value the provider refused, or null when the refusal was recorded before any value had been read. */
  fingerprint: string | null
}

/** Track the lifecycle of one credential reference over the plugin's lifetime. */
export class TokenWatch {
  private configured = false
  private source: string | null = null
  private fingerprint: string | null = null
  private issuedAt: number | null = null
  private expiresAt: number | null = null
  private changedAt: number | null = null
  private verifiedAt: number | null = null
  private refusal: Refusal | null = null

  /**
   * @param ctx - plugin context owning the credentials service.
   * @param options - validated plugin options.
   */
  constructor(private readonly ctx: Context, private readonly options: TokenWatchOptions) {}

  /** Re-resolve the reference and rebuild every fact derived from its value. */
  async refresh(): Promise<void> {
    const resolved = await this.ctx.credentials.resolve(this.options.credentialRef)
    if (resolved === undefined) {
      this.configured = false
      this.source = null
      this.fingerprint = null
      this.issuedAt = null
      this.expiresAt = null
      this.changedAt = null
      this.refusal = null
      return
    }
    const times = readTokenTimes(resolved.value)
    const fingerprint = `${resolved.value.length}:${String(times?.issuedAt ?? '')}:${String(times?.expiresAt ?? '')}`
    const previous = this.fingerprint
    this.fingerprint = fingerprint
    this.configured = true
    this.source = resolved.source
    this.issuedAt = times?.issuedAt ?? null
    this.expiresAt = times?.expiresAt ?? null
    // Date token changes after the first credential read.
    if (previous !== null && previous !== fingerprint) {
      this.changedAt = Date.now()
      this.refusal = null
      this.verifiedAt = null
    }
  }

  /**
   * Attribute one failed model request to this credential when it was refused.
   * @param provider - provider route the request targeted.
   * @param error - value the request failed with.
   */
  observe(provider: string, error: unknown): void {
    if (!this.options.providers.includes(provider)) return
    if (!isAuthRefusal(error)) return
    this.refusal = { at: Date.now(), message: refusalText(error), fingerprint: this.fingerprint }
  }

  /**
   * Record that one request to this provider completed, which proves the
   * credential currently works and retires an earlier refusal.
   * @param provider - provider route the request targeted.
   */
  settle(provider: string): void {
    if (!this.options.providers.includes(provider)) return
    this.verifiedAt = Date.now()
    this.refusal = null
  }

  /**
   * Ask the provider whether the credential still works, without spending a
   * generation. Only a decisive answer changes state: an unreachable probe
   * retains the current state.
   * @returns a promise settling once the probe has been classified.
   */
  async probe(): Promise<void> {
    const probe = this.options.probe
    if (probe === undefined) return
    const resolved = await this.ctx.credentials.resolve(this.options.credentialRef)
    if (resolved === undefined) return
    let response: Response
    try {
      response = await fetch(probe.url, {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${resolved.value}` },
        redirect: 'error',
      })
    } catch (_unreachableProbe) {
      // A network failure says nothing about the credential.
      return
    }
    this.classifyProbe(response.status, probe)
  }

  /**
   * Project the current facts onto the wire value the browser half renders.
   * @returns the status snapshot; the credential value is not part of it.
   */
  snapshot(): TokenStatus {
    const now = Date.now()
    return {
      state: this.state(now),
      label: this.options.label,
      credentialRef: this.options.credentialRef,
      credentialConfigured: this.configured,
      source: this.source,
      issuedAt: this.issuedAt,
      expiresAt: this.expiresAt,
      changedAt: this.changedAt,
      verifiedAt: this.verifiedAt,
      rejectedAt: this.refusal?.at ?? null,
      rejectedMessage: this.refusal?.message ?? null,
      warnBeforeMs: this.options.warnBeforeMs,
      observedAt: now,
    }
  }

  /** Apply one probe response's status code to the tracked facts. */
  private classifyProbe(status: number, probe: ProbeOptions): void {
    if (status === 401 || status === 403) {
      this.refusal = { at: Date.now(), message: `${probe.url} answered ${String(status)}`, fingerprint: this.fingerprint }
      return
    }
    if (status >= 200 && status < 300) {
      this.verifiedAt = Date.now()
      this.refusal = null
    }
  }

  /** Derive the lifecycle state from the tracked facts at one instant. */
  private state(now: number): TokenState {
    if (!this.configured) return 'missing'
    if (this.refusal !== null && this.refusalStands()) return 'rejected'
    if (this.expiresAt === null) return 'unknown'
    if (now >= this.expiresAt) return 'expired'
    return this.expiresAt - now <= this.options.warnBeforeMs ? 'expiring' : 'ok'
  }

  /** Whether the recorded refusal still describes the stored credential. */
  private refusalStands(): boolean {
    const refusal = this.refusal
    if (refusal === null) return false
    if (refusal.fingerprint !== null && this.fingerprint !== null && refusal.fingerprint !== this.fingerprint) {
      return false
    }
    return refusal.at >= (this.changedAt ?? 0)
  }
}

/** Whether a thrown value is a provider authentication refusal. */
export function isAuthRefusal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const record = error as Record<string, unknown>
  const failure = typeof record.failure === 'object' && record.failure !== null
    ? record.failure as Record<string, unknown>
    : undefined
  if (record.code === 'AUTH' || failure?.code === 'AUTH') return true
  const status = record.status ?? failure?.status
  return status === 401 || status === 403
}

/** Read a short, credential-free description of one failure. */
function refusalText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.length <= MAX_REFUSAL_CHARS ? message : `${message.slice(0, MAX_REFUSAL_CHARS)}…`
}
