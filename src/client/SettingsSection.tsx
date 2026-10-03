/**
 * Settings page for the credentials an unattended renewal signs in with.
 *
 * This is the auth-probe environment configuration, moved out of the shell:
 * the two values `MADMODEL_USERNAME` and `MADMODEL_PASSWORD` used to have to be
 * exported before starting dsh or written into a hand-made `.env.local`. Here
 * they are ordinary fields that write through the Host's credentials service,
 * under the same references the Host reads.
 *
 * The page never receives a stored secret. It can see whether a reference is
 * configured, where its value came from, and whether a write would be refused —
 * and it can replace or clear one — but no read path returns a value, which is
 * why the inputs always start empty and say so in their placeholder.
 *
 * Every control is a `ui-primitives` component: a feature package cannot import
 * another feature's component, so the primitives are the only place a button or
 * an input is shared, and they are what keeps this page's controls identical to
 * the settings pages shipped beside it.
 * @module dsh-thu-automad/client/SettingsSection
 */

import { memo, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  InjectFace, PropsLocale, PropsRuntime, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { AuthSettingsRequest, RenewPhase, SettingsFieldError, TokenState } from '../protocol.ts'
import type { AutomadStatus } from '../protocol.ts'
import type { RenewTriggerOutcome } from './actions.ts'
import type { AutomadFace } from './face.ts'
import { NS } from './locale.ts'
import { css } from './styles.ts'

/** Full props of the settings section. */
export type SettingsProps =
  & PropsRuntime<'settings.section'>
  & PropsLocale<typeof NS>
  & InjectFace<AutomadFace>

/** Badge weight of one reported state. */
type BadgeTone = 'ok' | 'idle' | 'warn' | 'error'

/**
 * Settings page for the Tsinghua MadModel credential.
 * @param props - framework hooks, injected status source and actions, and locale seat.
 * @returns the page, or null before the first status read settles.
 */
export const SettingsSection = memo(function SettingsSection({
  useAutomadStatus, actions, refresh, t,
}: SettingsProps) {
  const { status } = useAutomadStatus(value => value)
  const [drafts, setDrafts] = useState({ username: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<readonly SettingsFieldError[]>([])
  const [busy, setBusy] = useState<'username' | 'password' | null>(null)
  const [saved, setSaved] = useState<'username' | 'password' | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [renewResult, setRenewResult] = useState<RenewTriggerOutcome | null>(null)

  if (status === null) {
    return (
      <div className={css.section}>
        <h2 className={css.h2}>{t('settings.title')}</h2>
        <p className={css.p}>{t('settings.intro')}</p>
      </div>
    )
  }

  const auth = status.auth
  const write = async (field: 'username' | 'password', value: string | null): Promise<void> => {
    setBusy(field)
    setSaved(null)
    setFieldErrors([])
    setUnreachable(false)
    try {
      const payload: AuthSettingsRequest = field === 'username' ? { username: value } : { password: value }
      const outcome = await actions.saveIdentity(payload)
      if (outcome === null) {
        setUnreachable(true)
      } else {
        setFieldErrors(outcome.errors)
        if (outcome.ok) {
          setDrafts(current => ({ ...current, [field]: '' }))
          setSaved(field)
        }
      }
      refresh()
    } finally {
      setBusy(null)
    }
  }

  const renewNow = async (): Promise<void> => {
    setRenewing(true)
    setRenewResult(null)
    try {
      setRenewResult(await actions.renewNow())
      refresh()
    } finally {
      setRenewing(false)
    }
  }

  const renewText = renewTextOf(status.renew.phase, status.renew.lastAttemptAt, status.renew.nextAttemptAt, t)

  return (
    <div className={css.section}>
      <div>
        <h2 className={css.h2}>{t('settings.title')}</h2>
        <p className={css.p}>{t('settings.intro')}</p>
      </div>

      <section className={css.card} aria-labelledby="thu-automad-status-title">
        <h3 className={css.h3} id="thu-automad-status-title">{t('settings.status.title')}</h3>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('settings.token.label', { ref: auth.credentialRef })}</span>
          <span className={css.rowValue}>
            <Badge tone={tokenTone(status.token.state)} text={tokenText(status.token.state, t)} />
            <span className={css.note}>
              {status.token.credentialConfigured
                ? t('settings.token.configured', { source: status.token.source ?? '' })
                : t('settings.token.missing')}
            </span>
          </span>
        </div>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('settings.renew.label')}</span>
          <span className={css.rowValue}>
            <Badge tone={renewTone(status.renew.phase)} text={renewText} />
            {status.renew.unattendedRenewals > 0 && status.renew.enabled
              ? <span className={css.note}>{t('settings.renew.unattended', { count: String(status.renew.unattendedRenewals) })}</span>
              : null}
          </span>
        </div>
        {status.renew.lastAttemptAt === null ? null : (
          <p className={css.note}>{lastResultText(status, t)}</p>
        )}
        <p className={css.note}>{t('settings.device', { name: auth.deviceName })}</p>
        <p className={css.note}>
          {t('settings.tunnel', {
            mode: auth.tunnel ? t('settings.tunnel.webvpn') : t('settings.tunnel.direct'),
          })}
        </p>
      </section>

      <section className={css.card} aria-labelledby="thu-automad-identity-title">
        <h3 className={css.h3} id="thu-automad-identity-title">{t('settings.identity.title')}</h3>
        <p className={css.p}>{t('settings.identity.intro')}</p>
        <IdentityField
          field="username"
          label={t('settings.username.label')}
          placeholder={t('settings.username.placeholder', { ref: auth.usernameRef })}
          configured={auth.usernameConfigured}
          type="text"
          value={drafts.username}
          busy={busy === 'username'}
          saved={saved === 'username'}
          error={errorFor(fieldErrors, 'username')}
          onChange={value => { setDrafts(current => ({ ...current, username: value })) }}
          onSave={() => { void write('username', drafts.username) }}
          onClear={() => { void write('username', null) }}
          t={t}
        />
        <IdentityField
          field="password"
          label={t('settings.password.label')}
          placeholder={t('settings.password.placeholder', { ref: auth.passwordRef })}
          configured={auth.passwordConfigured}
          type="password"
          value={drafts.password}
          busy={busy === 'password'}
          saved={saved === 'password'}
          error={errorFor(fieldErrors, 'password')}
          onChange={value => { setDrafts(current => ({ ...current, password: value })) }}
          onSave={() => { void write('password', drafts.password) }}
          onClear={() => { void write('password', null) }}
          t={t}
        />
        {auth.shadowedRefs.length === 0 ? null : (
          <p className={css.error}>
            {t('settings.error.shadowed', { field: auth.shadowedRefs.join(', ') })}
          </p>
        )}
        {unreachable ? <p className={css.error}>{t('settings.error.unreachable')}</p> : null}
      </section>

      <div className={css.actions}>
        <Button variant="primary" onClick={() => { void renewNow() }} disabled={renewing}>
          {renewing ? t('settings.renew.now.busy') : t('settings.renew.now')}
        </Button>
        {renewResult === null ? null : (
          <span className={renewResult.renewed ? css.note : css.error}>
            {renewResultCopy(renewResult, t)}
          </span>
        )}
      </div>
    </div>
  )
})

/** One labelled credential input with its own save and clear actions. */
function IdentityField({
  field, label, placeholder, configured, type, value, busy, saved, error, onChange, onSave, onClear, t,
}: {
  field: 'username' | 'password'
  label: string
  placeholder: string
  configured: boolean
  type: 'text' | 'password'
  value: string
  busy: boolean
  saved: boolean
  error: SettingsFieldError | undefined
  onChange: (value: string) => void
  onSave: () => void
  onClear: () => void
  t: TranslateNS<typeof NS>
}) {
  const inputId = `thu-automad-${field}`
  return (
    <div className={css.field}>
      <label className={css.fieldLabel} htmlFor={inputId}>
        {label}
        <span className={css.fieldState}>
          {configured ? t('settings.field.configured') : t('settings.field.unconfigured')}
        </span>
      </label>
      <Input
        id={inputId}
        type={type}
        autoComplete={type === 'password' ? 'current-password' : 'username'}
        placeholder={placeholder}
        value={value}
        onChange={(event) => { onChange(event.target.value) }}
      />
      <div className={css.actions}>
        <Button onClick={onSave} disabled={busy || value.length === 0}>
          {busy ? t('settings.saving') : t('settings.save')}
        </Button>
        <Button onClick={onClear} disabled={busy || !configured}>
          {t('settings.clear')}
        </Button>
        {saved ? <span className={css.note}>{t('settings.saved')}</span> : null}
      </div>
      {error === undefined ? null : (
        <p className={css.error}>
          {error.code === 'shadowed'
            ? t('settings.error.shadowed', { field: label })
            : t('settings.error.refused', { field: label, message: error.message })}
        </p>
      )}
    </div>
  )
}

/** Small state pill. */
function Badge({ tone, text }: { tone: BadgeTone; text: string }) {
  return <span className={`${css.badge} ${badgeClass(tone)}`.trim()}>{text}</span>
}

/** Badge class for one tone. */
function badgeClass(tone: BadgeTone): string {
  switch (tone) {
    case 'ok': return css.badgeOk
    case 'warn': return css.badgeWarn
    case 'error': return css.badgeError
    case 'idle': return css.badgeIdle
  }
}

/** Reading of one token state. */
function tokenText(state: TokenState, t: TranslateNS<typeof NS>): string {
  switch (state) {
    case 'ok': return t('settings.token.state.ok')
    case 'expiring': return t('settings.token.state.expiring')
    case 'expired': return t('settings.token.state.expired')
    case 'rejected': return t('settings.token.state.rejected')
    case 'missing': return t('settings.token.state.missing')
    case 'unknown': return t('settings.token.state.unknown')
  }
}

/** Weight of one token state. */
function tokenTone(state: TokenState): BadgeTone {
  switch (state) {
    case 'ok': return 'ok'
    case 'expiring': return 'warn'
    case 'expired':
    case 'rejected':
      return 'error'
    case 'missing':
    case 'unknown':
      return 'idle'
  }
}

/** Reading of one renewal phase. */
function renewTextOf(
  phase: RenewPhase,
  lastAttemptAt: number | null,
  nextAttemptAt: number | null,
  t: TranslateNS<typeof NS>,
): string {
  switch (phase) {
    case 'off': return t('settings.renew.off')
    case 'idle': return t('settings.renew.idle')
    case 'scheduled':
      return t('settings.renew.scheduled', { time: formatTime(nextAttemptAt) })
    case 'running': return t('settings.renew.running')
    case 'ok': return t('settings.renew.ok', { time: formatTime(lastAttemptAt) })
    case 'stalled': return t('settings.renew.stalled')
    case 'needs-human': return t('settings.renew.needsHuman')
    case 'error': return t('settings.renew.error')
  }
}

/** Weight of one renewal phase. */
function renewTone(phase: RenewPhase): BadgeTone {
  switch (phase) {
    case 'ok': return 'ok'
    case 'running':
    case 'scheduled':
      return 'warn'
    case 'stalled':
    case 'error':
    case 'needs-human':
      return 'error'
    case 'off':
    case 'idle':
      return 'idle'
  }
}

/** Format one instant with the reader's own locale and clock. */
function formatTime(at: number | null): string {
  if (at === null) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
}

/**
 * One sentence about the last renewal attempt.
 *
 * The Host reports a stable code, so the sentence is written here rather than
 * echoing its diagnostic: a Chinese page that ends in an English error string is
 * a page the reader has to translate. The Host's own text is appended only when
 * no code covers it, which is the one case where it carries information the
 * reader cannot get otherwise.
 * @param status - latest Host status.
 * @param t - bound locale seat.
 * @returns the localized sentence.
 */
function lastResultText(status: AutomadStatus, t: TranslateNS<typeof NS>): string {
  const { renew } = status
  if (renew.lastCode === null) return t('settings.renew.lastOk', { time: formatTime(renew.lastAttemptAt) })
  const reason = renewFailureText(renew.lastCode, t)
  if (reason !== null) return t('settings.renew.lastFailure', { reason })
  return renew.lastMessage === null
    ? t('settings.renew.lastFailure', { reason: renew.lastCode })
    : t('settings.renew.detail', { message: renew.lastMessage })
}

/**
 * Localized reason for one failure code, or null when no code covers it.
 * @param code - stable code the Host reported.
 * @param t - bound locale seat.
 * @returns the localized reason, or null to fall back to the Host's message.
 */
function renewFailureText(code: string, t: TranslateNS<typeof NS>): string | null {
  switch (code) {
    case 'NO_CREDENTIALS': return t('settings.renew.result.noCredentials')
    case 'NO_PROGRESS': return t('settings.renew.result.noProgress')
    case 'WRITE_REFUSED': return t('settings.renew.result.writeRefused')
    case 'TOKEN_REJECTED': return t('settings.renew.result.rejected')
    case 'JUST_RENEWED': return t('settings.renew.result.renewed')
    default:
      return code.startsWith('TWO_FACTOR_') || code === 'BAD_CREDENTIALS'
        ? t('settings.renew.result.needsHuman')
        : null
  }
}

/** The refusal recorded for one field, if any. */
function errorFor(errors: readonly SettingsFieldError[], field: 'username' | 'password'): SettingsFieldError | undefined {
  return errors.find(entry => entry.field === field)
}

/** Localized sentence for one manual renewal outcome. */
function renewResultCopy(outcome: RenewTriggerOutcome, t: TranslateNS<typeof NS>): string {
  if (outcome.renewed) return t('settings.renew.result.renewed')
  switch (outcome.code) {
    case 'NO_CREDENTIALS': return t('settings.renew.result.noCredentials')
    case 'NO_PROGRESS': return t('settings.renew.result.noProgress')
    case 'WRITE_REFUSED': return t('settings.renew.result.writeRefused')
    case 'TOKEN_REJECTED': return t('settings.renew.result.rejected')
    default:
      return outcome.code !== null && outcome.code.startsWith('TWO_FACTOR_')
        ? t('settings.renew.result.needsHuman')
        : t('settings.renew.result.failed', { message: outcome.message ?? '' })
  }
}
