/**
 * Reading this plugin's status link renders inside itself.
 *
 * It rides that link's `conversation.composer.statusPillReading` seat, so the
 * token deadline stays visible exactly where the user works. The reading
 * renders nothing until the first status read settles; the link around it stays
 * visible either way.
 *
 * A renewal that is in flight is what the amber reading means when the token is
 * still comfortably valid, so the reading says "renewing" rather than showing a
 * bare countdown — otherwise the one moment the plugin is doing something looks
 * identical to the moment it is not.
 * @module dsh-thu-automad/client/Reading
 */

import { memo } from 'react'
import type {
  InjectFace, PropsLocale, PropsRuntime, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { AutomadStatus } from '../protocol.ts'
import { NS } from './locale.ts'
import type { AutomadStatusSource } from './status.ts'
import { css } from './styles.ts'
import { useCountdown } from './use-countdown.ts'

/** Values this plugin injects into the reading. */
export interface ReadingInjected {
  /** Live status published by the polling controller. */
  hooks: { automadStatus: AutomadStatusSource }
}

/** Full props of the status link's reading seat. */
export type ReadingProps =
  & PropsRuntime<'conversation.composer.statusPillReading'>
  & PropsLocale<typeof NS>
  & InjectFace<ReadingInjected>

/** Visual weight of one reading. */
type Tone = 'ok' | 'warn' | 'error' | 'idle'

/** Text and weight one status renders as. */
interface Presentation {
  /** Localized reading text. */
  text: string
  /** Weight the reading draws with. */
  tone: Tone
}

/**
 * Reading reporting the watched credential's remaining lifetime.
 * @param props - framework hooks, injected status source, and locale seat.
 * @returns the reading, or null before the first status read settles.
 */
export const Reading = memo(function Reading({ useAutomadStatus, t }: ReadingProps) {
  const { status, unreachable } = useAutomadStatus(value => value)
  const remaining = useCountdown(status?.token.expiresAt ?? null)
  // Before the first read settles there is nothing truthful to show. The link
  // that renders this seat keeps its own content, so nothing here hides it.
  if (status === null && !unreachable) return null
  const shown: Presentation = status === null
    ? { text: t('pill.unavailable'), tone: 'idle' }
    : presentationOf(status, remaining, t)
  const tone: Tone = unreachable ? 'idle' : shown.tone
  return (
    <span
      className={`${css.reading} ${toneClass(tone)}`.trim()}
      data-thu-automad-reading
      title={t('pill.title', { credentialRef: status?.token.credentialRef ?? '' })}
    >
      <span className={`${css.dot} ${dotClass(tone)}`.trim()} aria-hidden="true" />
      {shown.text}
    </span>
  )
})

/** Map one status onto the text and weight the reading renders. */
function presentationOf(status: AutomadStatus, remaining: string | null, t: TranslateNS<typeof NS>): Presentation {
  const { token, renew } = status
  const label = token.label
  const withRemaining = { label, remaining: remaining ?? '' }
  if (renew.phase === 'running' && (token.state === 'ok' || token.state === 'expiring')) {
    return { text: t('pill.renewing', { label }), tone: 'warn' }
  }
  switch (token.state) {
    case 'ok':
      return { text: t('pill.remaining', withRemaining), tone: 'ok' }
    case 'expiring':
      return { text: t('pill.remaining', withRemaining), tone: 'warn' }
    case 'expired':
      return { text: t('pill.expired', { label }), tone: 'error' }
    case 'rejected':
      return { text: t('pill.rejected', { label }), tone: 'error' }
    case 'missing':
      return { text: t('pill.missing', { label }), tone: 'idle' }
    case 'unknown':
      return { text: t('pill.unknown', { label }), tone: 'idle' }
  }
}

/** Text-color class for one tone. */
function toneClass(tone: Tone): string {
  switch (tone) {
    case 'warn': return css.readingWarn
    case 'error': return css.readingError
    case 'ok':
    case 'idle':
      return ''
  }
}

/** Indicator-dot class for one tone. */
function dotClass(tone: Tone): string {
  switch (tone) {
    case 'ok': return css.dotOk
    case 'warn': return css.dotWarn
    case 'error': return css.dotError
    case 'idle': return css.dotIdle
  }
}
