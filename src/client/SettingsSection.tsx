/**
 * Settings page for the Tsinghua MadModel credential and its transport.
 *
 * Three questions belong on one page because they are one subject: where model
 * requests are going (campus direct or WebVPN tunnel), whether the school token
 * behind them is alive, and what happens when the gateway refuses a request for
 * concurrency. The connection card groups local transport and the account used
 * to renew access.
 *
 * The account summary shows the configured student id. The password field
 * starts empty and stores only changes the user submits.
 *
 * Every control is a `ui-primitives` component; the layout follows the local
 * plugins' settings language: a 680px column, 16px cards with hairline
 * separators, and a monochrome ink scale.
 * @module dsh-thu-automad/client/SettingsSection
 */

import { memo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  InjectFace, PropsLocale, PropsRuntime, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {
  AuthSettingsRequest, AutomadStatus, SettingsFieldError, TransportPoolStatus, TransportStatus,
} from '../protocol.ts'
import type { RenewTriggerOutcome } from './actions.ts'
import type { AutomadFace } from './face.ts'
import { formatDateTime, formatTime } from './format.ts'
import { NS } from './locale.ts'
import { css } from './styles.ts'
import { useCountdown } from './use-countdown.ts'
import { Badge, BrandMark, LifetimeMeter, networkReading, renewalReading, tokenReading } from './visuals.tsx'
import type { Tone } from './visuals.tsx'

/** Full props of the settings section. */
export type SettingsProps =
  & PropsRuntime<'settings.section'>
  & PropsLocale<typeof NS>
  & InjectFace<AutomadFace>

const EMPTY_IDENTITY: Required<AuthSettingsRequest> = { username: '', password: '' }

/**
 * Settings page for the Tsinghua MadModel credential and transport.
 * @param props - framework hooks, injected status source and actions, and locale seat.
 * @returns the page, or null before the first status read settles.
 */
export const SettingsSection = memo(function SettingsSection({
  useAutomadStatus, actions, refresh, t,
}: SettingsProps) {
  const { status } = useAutomadStatus(value => value)
  const [drafts, setDrafts] = useState(EMPTY_IDENTITY)
  const [fieldErrors, setFieldErrors] = useState<readonly SettingsFieldError[]>([])
  const [saving, setSaving] = useState(false)
  const [writeState, setWriteState] = useState<'saved' | 'unreachable' | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [renewResult, setRenewResult] = useState<{ outcome: RenewTriggerOutcome; previousAttempt: number | null } | null>(null)
  const [identityEditing, setIdentityEditing] = useState<boolean | null>(null)
  const [queueBusy, setQueueBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  const remaining = useCountdown(status?.token.expiresAt ?? null)

  if (status === null) {
    return (
      <div className={css.settings}>
        <SettingsHeader t={t} />
      </div>
    )
  }

  const { auth, renew, transport } = status
  const pools = transport?.pools ?? []
  const usernameDisplay = auth.usernameDisplay ?? null
  const identityConfigured = auth.usernameConfigured && auth.passwordConfigured
  const identityOpen = identityEditing ?? !identityConfigured
  const fields = [
    {
      field: 'username',
      label: t('settings.username.label'),
      placeholder: t('settings.username.placeholder'),
      configured: auth.usernameConfigured,
      readOnly: auth.shadowedRefs.includes(auth.usernameRef),
    },
    {
      field: 'password',
      label: t('settings.password.label'),
      placeholder: t('settings.password.placeholder'),
      configured: auth.passwordConfigured,
      readOnly: auth.shadowedRefs.includes(auth.passwordRef),
    },
  ] as const
  const changes: AuthSettingsRequest = {}
  for (const { field, configured, readOnly } of fields) {
    const draft = drafts[field]
    if (!readOnly && (draft === null ? configured : draft.trim() !== '')) changes[field] = draft
  }
  const hasChanges = changes.username !== undefined || changes.password !== undefined

  const changeField = (field: keyof AuthSettingsRequest, value: string | null): void => {
    setDrafts(current => ({ ...current, [field]: value }))
    setFieldErrors(current => current.filter(error => error.field !== field))
    setWriteState(null)
  }

  const toggleIdentity = (): void => {
    setIdentityEditing(!identityOpen)
    if (identityOpen) {
      setDrafts(EMPTY_IDENTITY)
      setFieldErrors([])
      setWriteState(null)
    }
  }

  const saveIdentity = async (): Promise<void> => {
    if (saving || !hasChanges) return
    setIdentityEditing(true)
    setSaving(true)
    setWriteState(null)
    setFieldErrors([])
    try {
      const outcome = await actions.saveIdentity(changes)
      if (outcome === null || !Array.isArray(outcome.errors)) {
        setWriteState('unreachable')
        return
      }
      setFieldErrors(outcome.errors)
      setDrafts(current => {
        const next = { ...current }
        for (const { field } of fields) {
          if (changes[field] !== undefined && errorFor(outcome.errors, field) === undefined) next[field] = ''
        }
        return next
      })
      if (outcome.ok) setWriteState('saved')
    } finally {
      setSaving(false)
      refresh()
    }
  }

  const renewNow = async (): Promise<void> => {
    setRenewing(true)
    setRenewResult(null)
    try {
      const outcome = await actions.renewNow()
      if (outcome !== null) setRenewResult({ outcome, previousAttempt: renew.lastAttemptAt })
      refresh()
    } finally {
      setRenewing(false)
    }
  }

  let renewalDetail: string | null = null
  if (!renewing && renew.phase !== 'running') {
    if (renewResult?.previousAttempt === renew.lastAttemptAt) renewalDetail = renewResultCopy(renewResult.outcome, t)
    else if (renew.lastAttemptAt !== null) renewalDetail = lastResultText(status, t)
  }
  const queueEnabled = transport?.queueEnabled ?? true
  const controlQueue = async (queue: boolean): Promise<void> => {
    setQueueBusy(true)
    try {
      await actions.controlTransport({ queue })
      refresh()
    } finally {
      setQueueBusy(false)
    }
  }
  const resetTransport = async (): Promise<void> => {
    setResetBusy(true)
    try {
      await actions.controlTransport({ reset: true })
      refresh()
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <div className={css.settings}>
      <SettingsHeader t={t} />

      <h3 className={css.sectionTitle}>{t('settings.section.overview')}</h3>
      <div className={css.group}>
        <Row
          label={t('settings.overview.network')}
          value={<Badge {...networkReading(transport, t)} />}
        />
        <Row
          label={t('settings.overview.token')}
          hint={tokenHint(status, t)}
          value={(
            <>
              <Badge {...tokenReading(status.token.state, t)} />
              {remaining === null ? null : <span className={css.note}>{t('settings.overview.remaining', { remaining })}</span>}
            </>
          )}
        />
        <div className={css.meterRow}><LifetimeMeter token={status.token} /></div>
        <div className={css.row}>
          <div className={css.rowMain}>
            <span className={css.rowLabel}>{t('settings.overview.renew')}</span>
            <span className={css.rowHint}>{renewHint(status, t) ?? t('settings.renew.actionHint')}</span>
            {renewalDetail === null ? null : <span className={css.rowNote} role="status">{renewalDetail}</span>}
          </div>
          <div className={css.rowValue}>
            <Badge {...renewalReading(renew, t)} />
            <Button size="sm" variant="primary" onClick={() => { void renewNow() }} disabled={renewing || renew.phase === 'running'}>
              {renewing ? t('settings.renew.now.busy') : t('settings.renew.now')}
            </Button>
          </div>
        </div>
        <Row
          label={t('settings.overview.verify')}
          hint={t('settings.overview.trusted', { name: auth.deviceName })}
          value={(
            <span className={css.note}>
              {renew.twoFactorAt === null
                ? t('settings.overview.unverified')
                : t('settings.overview.verified', { time: formatTime(renew.twoFactorAt) })}
            </span>
          )}
        />
      </div>

      <h3 className={css.sectionTitle}>{t('settings.section.queue')}</h3>
      <div className={css.group}>
        {pools.length === 0
          ? <div className={css.empty}>{t('settings.queue.empty')}</div>
          : pools.map(pool => <PoolRow key={pool.model} pool={pool} t={t} />)}
        <div className={css.row}>
          <div className={css.rowMain}>
            <span className={css.rowLabel}>{t('settings.queue.control')}</span>
            <span className={css.rowHint}>{t('settings.queue.actionsHint')}</span>
          </div>
          <div className={css.rowValue}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { void controlQueue(!queueEnabled) }}
              disabled={queueBusy || transport === undefined || !transport.enabled}
            >
              {queueBusy
                ? t('settings.queue.pauseBusy')
                : queueEnabled ? t('settings.queue.pause') : t('settings.queue.resume')}
            </Button>
            <Button size="sm" onClick={() => { void resetTransport() }} disabled={resetBusy || transport === undefined}>
              {resetBusy ? t('settings.queue.resetBusy') : t('settings.queue.resetAction')}
            </Button>
          </div>
        </div>
      </div>
      <h3 className={css.sectionTitle}>{t('settings.section.transport')}</h3>
      <div className={css.group}>
        <Row
          label={t('settings.transport.endpoint')}
          value={<span className={css.mono}>{transport === undefined ? '—' : t('settings.transport.value', { port: String(transport.port) })}</span>}
        />
        <Row
          label={t('settings.transport.tunnel')}
          value={<span className={css.note}>{tunnelText(transport, t)}</span>}
        />
        <div className={`${css.row} ${css.accountRow}`}>
          <div className={css.rowMain}>
            <span className={css.rowLabel} id="thu-automad-account">{t('settings.identity.account')}</span>
            <span className={usernameDisplay === null ? css.rowHint : css.identityValue}>
              {usernameDisplay ?? t('settings.identity.accountHint')}
            </span>
          </div>
          <div className={css.rowValue}>
            <Badge
              tone={identityConfigured ? 'ok' : 'idle'}
              text={t(identityConfigured ? 'settings.field.configured' : 'settings.field.unconfigured')}
            />
            <Button
              size="sm"
              variant={identityOpen ? 'ghost' : 'outline'}
              onClick={toggleIdentity}
              disabled={saving}
              aria-controls="thu-automad-identity"
              aria-expanded={identityOpen}
            >
              {identityOpen
                ? t(hasChanges ? 'settings.identity.cancel' : 'settings.identity.collapse')
                : t(identityConfigured ? 'settings.identity.edit' : 'settings.identity.configure')}
            </Button>
          </div>
        </div>
        <div id="thu-automad-identity" hidden={!identityOpen}>
          {identityOpen ? (
            <form
              className={css.identityEditor}
              aria-labelledby="thu-automad-account"
              onSubmit={event => {
                event.preventDefault()
                void saveIdentity()
              }}
            >
              <div className={css.identityFields}>
                {fields.map(props => (
                  <IdentityField
                    key={props.field}
                    {...props}
                    value={drafts[props.field]}
                    saving={saving}
                    error={errorFor(fieldErrors, props.field)}
                    onChange={value => { changeField(props.field, value) }}
                    t={t}
                  />
                ))}
              </div>
              <div className={css.identityFooter}>
                <div className={css.identityHelp}>
                  <p className={css.note}>{t('settings.identity.intro')}</p>
                  {writeState === 'saved' ? <p className={css.note} role="status">{t('settings.saved')}</p> : null}
                  {writeState === 'unreachable' ? <p className={css.error} role="alert">{t('settings.error.unreachable')}</p> : null}
                </div>
                <Button size="sm" variant="primary" type="submit" disabled={saving || !hasChanges}>
                  {saving ? t('settings.saving') : t('settings.save')}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
      {transport?.lastError === null || transport?.lastError === undefined ? null : (
        <p className={css.error}>{t('settings.transport.error', { message: transport.lastError })}</p>
      )}
      {auth.shadowedRefs.length === 0 ? null : (
        <p className={css.error}>{t('settings.error.shadowed', { field: auth.shadowedRefs.join(', ') })}</p>
      )}
    </div>
  )
})

function SettingsHeader({ t }: { t: TranslateNS<typeof NS> }) {
  return (
    <header className={css.header}>
      <div className={css.headerBrand}>
        <BrandMark />
        <h2 className={css.h2}>{t('settings.title')}</h2>
      </div>
      <ul className={css.headerFeatures} role="list">
        <li>{t('settings.header.network')}</li>
        <li>{t('settings.header.renewal')}</li>
        <li>{t('settings.header.queue')}</li>
      </ul>
    </header>
  )
}

/** One label/value row with an optional second line. */
function Row({
  label, hint, value,
}: {
  label: string
  hint?: string
  value: ReactNode
}) {
  return (
    <div className={css.row}>
      <div className={css.rowMain}>
        <span className={css.rowLabel}>{label}</span>
        {hint === undefined ? null : <span className={css.rowHint}>{hint}</span>}
      </div>
      <div className={css.rowValue}>{value}</div>
    </div>
  )
}

/** One model's live admission state. */
function PoolRow({ pool, t }: { pool: TransportPoolStatus; t: TranslateNS<typeof NS> }) {
  const cooldown = useCountdown(pool.pausedUntil)
  const paused = pool.pausedUntil !== null && pool.pausedUntil > Date.now()
  const tone: Tone = paused || pool.queued > 0 ? 'warn' : 'ok'
  const ceiling = pool.ceiling ?? pool.limit
  const shrunk = pool.limit < ceiling ? ` · ${t('settings.queue.shrunk', { limit: String(pool.limit) })}` : ''
  const statusText = paused && cooldown !== null
    ? t('settings.queue.cooldown', { remaining: cooldown })
    : pool.queued > 0
      ? t('settings.queue.waiting')
      : t('settings.queue.normal')
  return (
    <div className={css.row}>
      <div className={css.rowMain}>
        <span className={`${css.rowLabel} ${css.mono}`.trim()}>{pool.model}</span>
        <span className={css.rowHint}>
          {t('settings.queue.running', {
            inFlight: String(pool.inFlight),
            limit: String(ceiling),
            queued: String(pool.queued),
          }) + shrunk}
        </span>
      </div>
      <div className={css.rowValue}><Badge tone={tone} text={statusText} /></div>
    </div>
  )
}

/** One credential input with an optional staged removal. */
function IdentityField({
  field, label, placeholder, configured, readOnly, value, saving, error, onChange, t,
}: {
  field: keyof AuthSettingsRequest
  label: string
  placeholder: string
  configured: boolean
  readOnly: boolean
  value: string | null
  saving: boolean
  error: SettingsFieldError | undefined
  onChange: (value: string | null) => void
  t: TranslateNS<typeof NS>
}) {
  const inputId = `thu-automad-${field}`
  const removing = value === null
  const clearAction = t(removing ? 'settings.field.undoClear' : 'settings.clear')
  return (
    <div className={css.field}>
      <div className={css.fieldHeader}>
        <label className={css.fieldLabel} htmlFor={inputId}>{label}</label>
        {readOnly ? <span className={css.fieldState}>{t('settings.field.readOnly')}</span> : configured ? (
          <Button
            size="sm"
            className={css.fieldClear}
            disabled={saving}
            onClick={() => { onChange(removing ? '' : null) }}
            aria-label={`${clearAction} · ${label}`}
          >
            {clearAction}
          </Button>
        ) : null}
      </div>
      <Input
        className={css.fieldInput}
        id={inputId}
        type={field === 'password' ? 'password' : 'text'}
        autoComplete={field === 'password' ? 'current-password' : 'username'}
        placeholder={removing ? t('settings.field.clearPending') : placeholder}
        value={value ?? ''}
        disabled={saving || readOnly || removing}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${inputId}-error`}
        onChange={(event) => { onChange(event.target.value) }}
      />
      {error === undefined ? null : (
        <p className={css.error} id={`${inputId}-error`} role="alert">
          {error.code === 'shadowed'
            ? t('settings.error.shadowed', { field: label })
            : t('settings.error.refused', { field: label, message: error.message })}
        </p>
      )}
    </div>
  )
}

function tunnelText(transport: TransportStatus | undefined, t: TranslateNS<typeof NS>): string {
  if (transport?.effective === 'direct') return t('settings.transport.tunnelNone')
  if (transport?.effective !== 'webvpn') return '—'
  return transport.tunnelCookieAt === null
    ? t('settings.transport.tunnelPending')
    : t('settings.transport.tunnelAt', { time: formatTime(transport.tunnelCookieAt) })
}

/** Second line under the renewal row. */
function renewHint(status: AutomadStatus, t: TranslateNS<typeof NS>): string | undefined {
  const { renew } = status
  if (!renew.enabled) return undefined
  const parts: string[] = []
  if (renew.phase !== 'scheduled' && renew.nextAttemptAt !== null) {
    parts.push(t('settings.overview.next', { time: formatTime(renew.nextAttemptAt) }))
  }
  if (renew.unattendedRenewals > 0) {
    parts.push(t('settings.overview.unattended', { count: String(renew.unattendedRenewals) }))
  }
  return parts.length === 0 ? undefined : parts.join(' · ')
}

/** Second line under the token row: where it came from and when it lapses. */
function tokenHint(status: AutomadStatus, t: TranslateNS<typeof NS>): string | undefined {
  const parts: string[] = []
  if (status.token.source !== null) parts.push(t('settings.overview.source', { source: status.token.source }))
  if (status.token.expiresAt !== null) {
    parts.push(t('settings.overview.expiresAt', { time: formatDateTime(status.token.expiresAt) }))
  }
  return parts.length === 0 ? undefined : parts.join(' · ')
}

/**
 * One sentence about the last renewal attempt.
 * @param status - latest Host status.
 * @param t - bound locale seat.
 * @returns the localized sentence.
 */
function lastResultText(status: AutomadStatus, t: TranslateNS<typeof NS>): string {
  const { renew } = status
  if (renew.lastCode === null) return t('settings.renew.lastOk', { time: formatTime(renew.lastAttemptAt) })
  const reason = renewFailureText(renew.lastCode, renew.lastMessage, t)
  if (reason !== null) return t('settings.renew.lastFailure', { reason })
  return renew.lastMessage === null
    ? t('settings.renew.lastFailure', { reason: renew.lastCode })
    : t('settings.renew.detail', { message: renew.lastMessage })
}

/**
 * Localized reason for one failure code, or null when no code covers it.
 * @param code - stable code the Host reported.
 * @param diagnostic - optional HTTP status and media type from the probe.
 * @param t - bound locale seat.
 * @returns the localized reason, or null to fall back to the Host's message.
 */
function renewFailureText(code: string, diagnostic: string | null, t: TranslateNS<typeof NS>): string | null {
  let reason: string
  switch (code) {
    case 'NO_CREDENTIALS': return t('settings.renew.result.noCredentials')
    case 'NO_PROGRESS': return t('settings.renew.result.noProgress')
    case 'WRITE_REFUSED': return t('settings.renew.result.writeRefused')
    case 'TOKEN_REJECTED': reason = t('settings.renew.result.rejected'); break
    case 'PROBE_RATE_LIMITED': reason = t('settings.renew.result.rateLimited'); break
    case 'PROBE_SESSION_LOST': reason = t('settings.renew.result.sessionLost'); break
    case 'PROBE_UNREACHABLE': reason = t('settings.renew.result.probeUnreachable'); break
    case 'PROBE_UNAVAILABLE': reason = t('settings.renew.result.probeUnavailable'); break
    case 'PROBE_UNEXPECTED': reason = t('settings.renew.result.probeUnexpected'); break
    case 'JUST_RENEWED': return t('settings.renew.result.renewed')
    default:
      return code.startsWith('TWO_FACTOR_') || code === 'BAD_CREDENTIALS'
        ? t('settings.renew.result.needsHuman')
        : null
  }
  return diagnostic?.startsWith('HTTP ') === true && diagnostic.includes(' · ')
    ? t('settings.renew.result.probeDetail', { reason, detail: diagnostic })
    : reason
}

/** The refusal recorded for one field, if any. */
function errorFor(
  errors: readonly SettingsFieldError[],
  field: 'username' | 'password',
): SettingsFieldError | undefined {
  return errors.find(entry => entry.field === field)
}

/** Localized sentence for one manual renewal outcome. */
function renewResultCopy(outcome: RenewTriggerOutcome, t: TranslateNS<typeof NS>): string {
  if (outcome.renewed) return t('settings.renew.result.renewed')
  return (outcome.code === null ? null : renewFailureText(outcome.code, outcome.message, t))
    ?? t('settings.renew.result.failed', { message: outcome.message ?? '' })
}
