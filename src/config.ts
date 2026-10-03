/**
 * Configuration for both halves of the plugin, validated at load.
 *
 * Three families share one `config` mapping because they share one failure
 * site: the credential watch decides *when* a token needs replacing, the auth
 * block says *how* to replace it, and the rules say what a request does when a
 * replacement is not the answer. Every value a deployment could reasonably want
 * to change lives here; the school's endpoint constants do not, because they
 * are a reverse-engineered external specification rather than a preference.
 *
 * This package ships outside the harness workspace and therefore resolves no
 * harness runtime value, including the shared schema package. It validates its
 * own fields instead and throws from `apply`, which fails the plugin's fiber at
 * the same moment a declared schema would, with a message naming the field.
 * @module dsh-thu-automad/config
 */

import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { Rule } from './policy/config.ts'
import { resolveRules } from './policy/config.ts'

/** Periodic verification of a credential the provider can reject early. */
export interface ProbeOptions {
  /** Absolute HTTP(S) URL answering a plain authenticated `GET`. */
  url: string
  /** Interval between probes, in milliseconds. */
  intervalMs: number
}

/** Credential lifecycle observation, shared with the watch. */
export interface TokenWatchOptions {
  /** Credential reference holding the current token; also what renewal writes. */
  credentialRef: CredentialRef
  /** Provider display name the UI shows. */
  label: string
  /** Remaining lifetime at or below which the state reads `expiring`. */
  warnBeforeMs: number
  /** Provider routes whose refusals this plugin attributes to the credential. */
  providers: readonly string[]
  /** Request probe, absent while disabled. */
  probe: ProbeOptions | undefined
}

/** How the student identity that authorizes a renewal is obtained. */
export interface AuthOptions {
  /** Credential reference holding the student id (auth-probe's `MADMODEL_USERNAME`). */
  usernameRef: CredentialRef
  /** Credential reference holding the unified-auth password (`MADMODEL_PASSWORD`). */
  passwordRef: CredentialRef
  /** Route the upstream token check through the WebVPN tunnel. */
  tunnel: boolean
}

/** When and how a token is re-acquired. */
export interface RenewOptions {
  /** Whether the scheduled renewal may run at all. */
  autoRenew: boolean
  /** How far ahead of `exp` a renewal is attempted. Zero disables the schedule. */
  refreshAheadMs: number
  /** How often the renewer re-evaluates the token deadline, in milliseconds. */
  checkIntervalMs: number
  /** How long a human has to answer the two-factor dialog, in milliseconds. */
  twoFactorTimeoutMs: number
  /** Whether a freshly acquired token is proven against the upstream before it is stored. */
  verifyAfterRenew: boolean
  /** Model id the verification call names. */
  verifyModel: string
}

/** Validated options the Host half runs on. */
export interface AutomadOptions extends TokenWatchOptions {
  /** Student identity and transport choice for a renewal. */
  auth: AuthOptions
  /** Renewal schedule and interaction budget. */
  renew: RenewOptions
  /** Ordered failure rules the policy half runs on. */
  rules: readonly Rule[]
}

/** Documented defaults, restated in README.md and cordis.patch.yml. */
const DEFAULTS = {
  credentialRef: 'TSINGHUA_API_KEY',
  label: 'Tsinghua API',
  warnBeforeMs: 30 * 60 * 1000,
  providers: ['tsinghua'],
  probeIntervalMs: 0,
  probeUrl: '',
  usernameRef: 'MADMODEL_USERNAME',
  passwordRef: 'MADMODEL_PASSWORD',
  tunnel: false,
  autoRenew: true,
  refreshAheadMs: 60 * 60 * 1000,
  checkIntervalMs: 60 * 1000,
  twoFactorTimeoutMs: 5 * 60 * 1000,
  verifyAfterRenew: true,
  verifyModel: 'DeepSeek-V4.1-Flash',
} as const satisfies Record<string, unknown>

/** Grammar the credentials seam itself accepts for a reference. */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u

/** Floor for a configured probe interval; a token does not rot by the second. */
const MIN_PROBE_INTERVAL_MS = 60 * 1000

/** Floor for the renewal evaluation tick; below this the schedule is noise. */
const MIN_CHECK_INTERVAL_MS = 10 * 1000

/**
 * Validate one raw config value from cordis.yml.
 * @param config - raw `config` mapping of the loader row, absent when omitted.
 * @returns the options the Host half runs on.
 * @throws Error naming the offending field, before any capability registers.
 */
export function resolveOptions(config: unknown): AutomadOptions {
  const record = asRecord(config)
  for (const key of Object.keys(record)) {
    if (key !== 'rules' && !(key in DEFAULTS)) {
      throw new Error(`thu-automad: unknown config key "${key}"`)
    }
  }

  const credentialRef = ref(record, 'credentialRef', DEFAULTS.credentialRef)
  const label = text(record, 'label', DEFAULTS.label)
  if (label.length === 0) throw new Error('thu-automad: label must not be empty')
  const warnBeforeMs = count(record, 'warnBeforeMs', DEFAULTS.warnBeforeMs)
  const providers = names(record, 'providers', DEFAULTS.providers)
  const intervalMs = count(record, 'probeIntervalMs', DEFAULTS.probeIntervalMs)
  const probeUrl = text(record, 'probeUrl', DEFAULTS.probeUrl)

  let probe: ProbeOptions | undefined
  if (intervalMs !== 0) {
    if (intervalMs < MIN_PROBE_INTERVAL_MS) {
      throw new Error(`thu-automad: probeIntervalMs must be 0 (disabled) or at least ${String(MIN_PROBE_INTERVAL_MS)}`)
    }
    if (probeUrl.length === 0) {
      throw new Error('thu-automad: probeUrl is required when probeIntervalMs is set')
    }
    const parsed = new URL(probeUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('thu-automad: probeUrl must be an absolute HTTP(S) URL')
    }
    probe = { url: parsed.href, intervalMs }
  }

  const auth: AuthOptions = {
    usernameRef: ref(record, 'usernameRef', DEFAULTS.usernameRef),
    passwordRef: ref(record, 'passwordRef', DEFAULTS.passwordRef),
    tunnel: boolean(record, 'tunnel', DEFAULTS.tunnel),
  }

  const refreshAheadMs = count(record, 'refreshAheadMs', DEFAULTS.refreshAheadMs)
  const checkIntervalMs = count(record, 'checkIntervalMs', DEFAULTS.checkIntervalMs)
  if (checkIntervalMs < MIN_CHECK_INTERVAL_MS) {
    throw new Error(`thu-automad: checkIntervalMs must be at least ${String(MIN_CHECK_INTERVAL_MS)}`)
  }
  // A renewal that lands after the warning window would paint the pill amber
  // and then green again on every ordinary cycle, which destroys the meaning of
  // amber. The narrower window is the one that must contain the wider.
  if (refreshAheadMs !== 0 && refreshAheadMs < warnBeforeMs) {
    throw new Error('thu-automad: refreshAheadMs must be 0 (disabled) or at least warnBeforeMs')
  }
  const twoFactorTimeoutMs = count(record, 'twoFactorTimeoutMs', DEFAULTS.twoFactorTimeoutMs)
  if (twoFactorTimeoutMs === 0) throw new Error('thu-automad: twoFactorTimeoutMs must be positive')
  const verifyModel = text(record, 'verifyModel', DEFAULTS.verifyModel)
  if (verifyModel.length === 0) throw new Error('thu-automad: verifyModel must not be empty')

  const rules = resolveRules(record.rules)
  for (const [index, rule] of rules.entries()) {
    // A `renew` rule for a provider this plugin does not watch could never
    // succeed; failing at load beats leaving a rule that can only time out.
    if (rule.action === 'renew' && (rule.provider.length === 0 || rule.provider.some(name => !providers.includes(name)))) {
      throw new Error(
        `thu-automad: rules[${String(index)}].when.provider must name a watched provider `
        + `(${providers.join(', ') || 'none configured'}) for action "renew"`,
      )
    }
  }

  // The credentials seam brands a reference at its own factory, which this
  // package deliberately does not import at runtime; the grammar above is that
  // factory's own, so the brand stays a compile-time-only assertion.
  return {
    credentialRef,
    label,
    warnBeforeMs,
    providers,
    probe,
    auth,
    renew: {
      autoRenew: boolean(record, 'autoRenew', DEFAULTS.autoRenew),
      refreshAheadMs,
      checkIntervalMs,
      twoFactorTimeoutMs,
      verifyAfterRenew: boolean(record, 'verifyAfterRenew', DEFAULTS.verifyAfterRenew),
      verifyModel,
    },
    rules,
  }
}

/** Read the raw config as a mapping, accepting an omitted or empty one. */
function asRecord(config: unknown): Record<string, unknown> {
  if (config === undefined || config === null) return {}
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('thu-automad: config must be a mapping')
  }
  return config as Record<string, unknown>
}

/** Read one optional string field. */
function text(record: Record<string, unknown>, key: string, fallback: string): string {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw new Error(`thu-automad: ${key} must be a string`)
  return value
}

/** Read one optional boolean field. */
function boolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error(`thu-automad: ${key} must be a boolean`)
  return value
}

/** Read one optional non-negative integer field. */
function count(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`thu-automad: ${key} must be a non-negative integer`)
  }
  return value
}

/** Read one optional array of non-empty provider route names. */
function names(record: Record<string, unknown>, key: string, fallback: readonly string[]): readonly string[] {
  const value = record[key]
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`thu-automad: ${key} must be an array of non-empty provider route names`)
  }
  return value as string[]
}

/** Read one optional credential reference, validated at the seam's own grammar. */
function ref(record: Record<string, unknown>, key: string, fallback: string): CredentialRef {
  const value = text(record, key, fallback)
  if (!REF_PATTERN.test(value)) {
    throw new Error(`thu-automad: ${key} "${value}" must be an environment-variable name`)
  }
  return value as CredentialRef
}
