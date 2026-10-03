/**
 * The wire contract shared by this plugin's two halves.
 *
 * Nothing here touches Node or the browser: the Host half produces an
 * {@link AutomadStatus}, the browser half validates exactly that value after
 * decoding it, and both sides address the same route constants. The credential
 * value, the student id, the password, and the identity claims a campus JWT
 * carries never appear in any of these documents.
 * @module dsh-thu-automad/protocol
 */

import type { DecisionCounts, LastDecision, RuleSummary } from './policy/status.ts'

/** Exact Fetch route serving the merged status document, as registered below `/api`. */
export const STATUS_PATH = '/api/thu-automad/status'

/** Exact Fetch route accepting the student identity the renewal logs in with. */
export const SETTINGS_PATH = '/api/thu-automad/auth-settings'

/** Exact Fetch route accepting one two-factor answer. */
export const TWO_FACTOR_PATH = '/api/thu-automad/two-factor'

/** Exact Fetch route triggering one renewal attempt. */
export const RENEW_PATH = '/api/thu-automad/renew'

/**
 * Document-relative form of a route. A relative reference keeps the route
 * reachable when a deployment mounts the GUI below a subpath.
 * @param path - absolute route path beginning with `/api`.
 * @returns the same path without its leading slash.
 */
export function routeOf(path: string): string {
  return path.slice(1)
}

/** Document-relative form of {@link STATUS_PATH}, for anchors and fetches. */
export const STATUS_ROUTE = routeOf(STATUS_PATH)

/**
 * Token lifecycle as the browser presents it.
 *
 * `rejected` outranks the clock: a provider refusal is evidence, while `exp`
 * is only the issuer's intention.
 */
export type TokenState = 'missing' | 'unknown' | 'ok' | 'expiring' | 'expired' | 'rejected'

/**
 * One resolved credential's lifecycle facts. The value itself never appears
 * here, and neither do the identity claims a campus JWT carries.
 */
export interface TokenStatus {
  /** Current lifecycle state. */
  state: TokenState
  /** Configured display label for the provider this credential feeds. */
  label: string
  /** Credential reference (environment-variable name) the status describes. */
  credentialRef: string
  /** Whether the reference currently resolves to a non-empty value. */
  credentialConfigured: boolean
  /** Source layer that supplied the value, or null while unconfigured. */
  source: string | null
  /** Token issue time in epoch milliseconds, when its payload carries one. */
  issuedAt: number | null
  /** Token expiry in epoch milliseconds, when its payload carries one. */
  expiresAt: number | null
  /** When the stored value last changed, in epoch milliseconds. */
  changedAt: number | null
  /** Last confirmed working request or probe, in epoch milliseconds. */
  verifiedAt: number | null
  /** When the provider last refused the credential, in epoch milliseconds. */
  rejectedAt: number | null
  /** Provider refusal text, when one was recorded. */
  rejectedMessage: string | null
  /** Remaining lifetime at or below which the state reads `expiring`. */
  warnBeforeMs: number
  /** Host clock when this value was produced, in epoch milliseconds. */
  observedAt: number
}

/** Where the renewal schedule stands. */
export type RenewPhase =
  /** The schedule is configured off. */
  | 'off'
  /** Nothing to do: the token is comfortably valid or renewal is not configured. */
  | 'idle'
  /** A deadline is known and the next evaluation is in the future. */
  | 'scheduled'
  /** A sign-in is in flight. */
  | 'running'
  /** The last attempt replaced the credential. */
  | 'ok'
  /** The school returned the same token, so nothing was actually renewed. */
  | 'stalled'
  /** Only a human can unblock this: a two-factor answer, or a corrected password. */
  | 'needs-human'
  /** The last attempt failed for a reason worth retrying. */
  | 'error'

/** What the Host has done and will do about the credential's expiry. */
export interface RenewStatus {
  /** Whether the schedule may run at all. */
  enabled: boolean
  /** Current schedule position. */
  phase: RenewPhase
  /** Epoch milliseconds of the last attempt, or null before the first one. */
  lastAttemptAt: number | null
  /** Epoch milliseconds the next attempt is due, or null when none is scheduled. */
  nextAttemptAt: number | null
  /** Stable failure code from the last attempt, or null after a success. */
  lastCode: string | null
  /** Human-readable, credential-free description of the last attempt. */
  lastMessage: string | null
  /** Whether the last attempt returned a token whose expiry did not advance. */
  noProgress: boolean
  /** When a two-factor challenge was last answered, or null if never. */
  twoFactorAt: number | null
  /** Successful renewals completed without a two-factor answer since the last one. */
  unattendedRenewals: number
}

/** Policy-half facts, projected from the decision ledger. */
export interface PolicyStatus {
  /** Configured rules, in match order. */
  rules: readonly RuleSummary[]
  /** Counts by action. */
  counts: DecisionCounts
  /** The most recent decision, or null before any matching failure. */
  last: LastDecision | null
}

/** One outstanding two-factor challenge waiting for a human answer. */
export interface TwoFactorPrompt {
  /** Which answer the Host is waiting for. */
  stage: 'method' | 'code'
  /** Verification methods the school offered; empty at the code stage. */
  methods: readonly string[]
  /** Masked phone number the school reported, when it offered the SMS method. */
  phone: string | null
  /** Method chosen at the method stage, present at the code stage. */
  method: string | null
  /** Epoch milliseconds the challenge was raised. */
  askedAt: number
  /** Epoch milliseconds the challenge gives up at. */
  expiresAt: number
}

/** Whether the identity a renewal needs is present, and whether it can be replaced. */
export interface AuthConfigStatus {
  /** Credential reference the token is stored under. */
  credentialRef: string
  /** Credential reference the student id is stored under. */
  usernameRef: string
  /** Credential reference the password is stored under. */
  passwordRef: string
  /** Device name the school's trusted-device list shows; fixed by the authentication library. */
  deviceName: string
  /** Whether the upstream check goes through the WebVPN tunnel. */
  tunnel: boolean
  /** Whether the student id currently resolves. */
  usernameConfigured: boolean
  /** Whether the password currently resolves. */
  passwordConfigured: boolean
  /** Whether the token under `credentialRef` currently resolves. */
  tokenConfigured: boolean
  /** References the launching environment supplies read-only, so a write would be shadowed. */
  shadowedRefs: readonly string[]
}

/** The published status document. */
export interface AutomadStatus {
  /** Plugin name, so a fetched document identifies itself. */
  plugin: string
  /** Epoch milliseconds this plugin's `apply` completed. */
  appliedAt: number
  /** Seconds since `appliedAt`, as of this read. */
  uptimeSeconds: number
  /** Credential lifecycle facts. */
  token: TokenStatus
  /** Renewal schedule facts. */
  renew: RenewStatus
  /** Policy ledger facts. */
  policy: PolicyStatus
  /** Outstanding two-factor challenge, or null. */
  twoFactor: TwoFactorPrompt | null
  /** Configuration presence for the renewal identity. */
  auth: AuthConfigStatus
  /** Host clock when this value was produced, in epoch milliseconds. */
  observedAt: number
}

/** Body accepted by {@link SETTINGS_PATH}. An omitted field is left unchanged; null clears it. */
export interface AuthSettingsRequest {
  /** Student id to store, or null to clear it. */
  username?: string | null
  /** Password to store, or null to clear it. */
  password?: string | null
}

/** Body accepted by the renewal trigger route. */
export interface RenewTriggerRequest {
  /** Why the caller asked; recorded in the renewal status. */
  reason?: string
}

/** One answer to an outstanding two-factor challenge. */
export type TwoFactorAnswer =
  | { stage: 'method'; method: string; trustDevice: boolean }
  | { stage: 'code'; code: string }
  | { stage: 'cancel' }

/** One refused field of a settings write. */
export interface SettingsFieldError {
  /** Which field the refusal belongs to. */
  field: 'username' | 'password'
  /** Stable reason the client renders localized copy from. */
  code: 'shadowed' | 'refused'
  /** Raw diagnostic text from the credentials seam. */
  message: string
}

/** Outcome of one accepted settings write. */
export interface SettingsOutcome {
  /** Whether every requested write succeeded. */
  ok: boolean
  /** Per-field refusals, empty when `ok`. */
  errors: readonly SettingsFieldError[]
  /** Fresh configuration presence, so the caller need not re-read the status route. */
  auth: AuthConfigStatus
}

/** Outcome of one accepted two-factor answer or renewal trigger. */
export interface ActionOutcome {
  /** Whether the Host accepted the request. */
  ok: boolean
  /** Why it was rejected, when it was. */
  error?: string
}

const TOKEN_STATES: readonly string[] = ['missing', 'unknown', 'ok', 'expiring', 'expired', 'rejected']
const RENEW_PHASES: readonly string[] = ['off', 'idle', 'scheduled', 'running', 'ok', 'stalled', 'needs-human', 'error']

/**
 * Whether a decoded response is a status this browser half understands.
 * @param value - decoded JSON response body.
 * @returns true when every displayed field is present and well typed.
 */
export function isAutomadStatus(value: unknown): value is AutomadStatus {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.plugin === 'string'
    && typeof record.appliedAt === 'number'
    && typeof record.uptimeSeconds === 'number'
    && typeof record.observedAt === 'number'
    && isTokenStatus(record.token)
    && isRenewStatus(record.renew)
    && isPolicyStatus(record.policy)
    && isAuthConfigStatus(record.auth)
    && (record.twoFactor === null || isTwoFactorPrompt(record.twoFactor))
}

/**
 * Whether a decoded value is a token status this browser half understands.
 * @param value - decoded JSON value.
 * @returns true when every displayed field is present and well typed.
 */
export function isTokenStatus(value: unknown): value is TokenStatus {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.state === 'string' && TOKEN_STATES.includes(record.state)
    && typeof record.label === 'string'
    && typeof record.credentialRef === 'string'
    && typeof record.credentialConfigured === 'boolean'
    && typeof record.warnBeforeMs === 'number'
    && typeof record.observedAt === 'number'
    && isOptionalText(record.source)
    && isOptionalText(record.rejectedMessage)
    && isOptionalNumber(record.issuedAt)
    && isOptionalNumber(record.expiresAt)
    && isOptionalNumber(record.changedAt)
    && isOptionalNumber(record.verifiedAt)
    && isOptionalNumber(record.rejectedAt)
}

/** Whether a decoded value is a renewal status this browser half understands. */
function isRenewStatus(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.enabled === 'boolean'
    && typeof record.phase === 'string' && RENEW_PHASES.includes(record.phase)
    && typeof record.noProgress === 'boolean'
    && typeof record.unattendedRenewals === 'number'
    && isOptionalNumber(record.lastAttemptAt)
    && isOptionalNumber(record.nextAttemptAt)
    && isOptionalNumber(record.twoFactorAt)
    && isOptionalText(record.lastCode)
    && isOptionalText(record.lastMessage)
}

/** Whether a decoded value is a policy status this browser half understands. */
function isPolicyStatus(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.rules)
    && typeof record.counts === 'object' && record.counts !== null
    && (record.last === null || typeof record.last === 'object')
}

/** Whether a decoded value is an auth-configuration status this browser half understands. */
function isAuthConfigStatus(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.credentialRef === 'string'
    && typeof record.usernameRef === 'string'
    && typeof record.passwordRef === 'string'
    && typeof record.deviceName === 'string'
    && typeof record.tunnel === 'boolean'
    && typeof record.usernameConfigured === 'boolean'
    && typeof record.passwordConfigured === 'boolean'
    && typeof record.tokenConfigured === 'boolean'
    && Array.isArray(record.shadowedRefs)
}

/** Whether a decoded value is a two-factor challenge this browser half understands. */
function isTwoFactorPrompt(value: unknown): value is TwoFactorPrompt {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (record.stage === 'method' || record.stage === 'code')
    && Array.isArray(record.methods)
    && typeof record.askedAt === 'number'
    && typeof record.expiresAt === 'number'
    && isOptionalText(record.phone)
    && isOptionalText(record.method)
}

/** Whether a wire field is a number or null. */
function isOptionalNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

/** Whether a wire field is a string or null. */
function isOptionalText(value: unknown): boolean {
  return value === null || typeof value === 'string'
}
