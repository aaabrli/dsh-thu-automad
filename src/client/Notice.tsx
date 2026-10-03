/**
 * Frame-wide notice for a credential the user still has to act on.
 *
 * It rides the shell's additive overlay seat, which floats above every column
 * and stays click-through except for this element. A notice appears only once
 * the state needs action, is dismissible, and re-arms itself when the state
 * changes — so acting on it, or a further decay, brings it back rather than
 * leaving a stale acknowledgement in place.
 *
 * A renewal that is in flight deliberately produces no notice: the plugin is
 * already doing the thing, and telling the user to do it would be wrong.
 * @module dsh-thu-automad/client/Notice
 */

import { memo, useEffect, useState } from 'react'
import { IconWarningOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  InjectFace, PropsLocale, PropsRuntime, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { AutomadStatus } from '../protocol.ts'
import type { AutomadFace } from './face.ts'
import { NS } from './locale.ts'
import { css } from './styles.ts'
import { useCountdown } from './use-countdown.ts'

/** Full props of the overlay occupant. */
export type NoticeProps =
  & PropsRuntime<'shell.overlay'>
  & PropsLocale<typeof NS>
  & InjectFace<AutomadFace>

/** Copy and weight of one actionable state. */
interface NoticeCopy {
  /** Headline. */
  title: string
  /** One sentence saying what to do. */
  body: string
  /** Visual weight. */
  tone: 'warn' | 'error'
  /** Stable key a dismissal is recorded against. */
  key: string
}

/**
 * Overlay notice telling the user what to do about the watched credential.
 * @param props - framework hooks, injected status source, and locale seat.
 * @returns the notice, or null while nothing needs action or it is dismissed.
 */
export const Notice = memo(function Notice({ useAutomadStatus, t }: NoticeProps) {
  const { status } = useAutomadStatus(value => value)
  const remaining = useCountdown(status?.token.expiresAt ?? null)
  const copy = status === null ? null : noticeCopy(status, remaining, t)
  const key = copy?.key ?? null
  const [dismissed, setDismissed] = useState<string | null>(null)

  // A state change is new information: an earlier dismissal covered a
  // different situation.
  useEffect(() => { setDismissed(null) }, [key])

  if (copy === null || key === null || dismissed === key) return null
  return (
    <div
      className={`${css.notice} ${copy.tone === 'error' ? css.noticeError : ''}`.trim()}
      role="status"
      data-thu-automad-notice
    >
      <span className={css.noticeIcon} aria-hidden="true"><IconWarningOutlineRegular size={16} /></span>
      <div className={css.noticeBody}>
        <span className={css.noticeTitle}>{copy.title}</span>
        <span className={css.noticeText}>{copy.body}</span>
      </div>
      <button type="button" className={css.noticeClose} onClick={() => { setDismissed(key) }}>
        {t('notice.dismiss')}
      </button>
    </div>
  )
})

/**
 * Copy for a state that needs the user to act, or null when none does.
 * @param status - latest Host status.
 * @param remaining - formatted remaining lifetime, or null.
 * @param t - bound locale seat.
 * @returns the notice copy, or null.
 */
function noticeCopy(status: AutomadStatus, remaining: string | null, t: TranslateNS<typeof NS>): NoticeCopy | null {
  const label = status.token.label
  const credentialRef = status.token.credentialRef
  switch (status.token.state) {
    case 'expired':
      return {
        tone: 'error',
        key: 'expired',
        title: t('notice.expired.title', { label }),
        body: t('notice.expired.body', { credentialRef }),
      }
    case 'rejected':
      return {
        tone: 'error',
        key: `rejected:${status.token.rejectedAt ?? 0}`,
        title: t('notice.rejected.title', { label }),
        body: t('notice.rejected.body', { credentialRef, reason: status.token.rejectedMessage ?? '' }),
      }
    case 'missing':
      return {
        tone: 'warn',
        key: 'missing',
        title: t('notice.missing.title', { label }),
        body: t('notice.missing.body', { credentialRef }),
      }
    case 'ok':
    case 'unknown':
      return null
    case 'expiring':
      return expiringCopy(status, label, remaining, t)
  }
}

/** Copy for the states a still-valid token can be in while a renewal runs. */
function expiringCopy(
  status: AutomadStatus,
  label: string,
  remaining: string | null,
  t: TranslateNS<typeof NS>,
): NoticeCopy | null {
  switch (status.renew.phase) {
    case 'running':
      // The plugin is already renewing; nothing is asked of the user.
      return null
    case 'needs-human':
      return {
        tone: 'error',
        key: 'needs-human',
        title: t('notice.needsHuman.title', { label }),
        body: t('notice.needsHuman.body'),
      }
    case 'stalled':
      return {
        tone: 'warn',
        key: 'stalled',
        title: t('notice.stalled.title', { label }),
        body: t('notice.stalled.body'),
      }
    case 'error':
      return {
        tone: 'error',
        key: `error:${status.renew.lastAttemptAt ?? 0}`,
        title: t('notice.needsHuman.title', { label }),
        body: t('notice.needsHuman.body'),
      }
    case 'off':
    case 'idle':
    case 'scheduled':
    case 'ok':
      return {
        tone: 'warn',
        key: `expiring:${status.renew.phase}`,
        title: t('notice.expiring.title', { label, remaining: remaining ?? '' }),
        body: t('notice.expiring.body'),
      }
  }
}
