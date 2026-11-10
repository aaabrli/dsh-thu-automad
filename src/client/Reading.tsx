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
import { BrandMark } from './visuals.tsx'
import type { Tone } from './visuals.tsx'

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
  const cooldownUntil = nearestCooldown(status)
  const cooldown = useCountdown(cooldownUntil)
  // Before the first read settles there is nothing truthful to show. The link
  // that renders this seat keeps its own content, so nothing here hides it.
  if (status === null && !unreachable) return null
  const shown: Presentation = status === null
    ? { text: t('pill.unavailable'), tone: 'idle' }
    : presentationOf(status, remaining, cooldown, t)
  const tone: Tone = unreachable ? 'idle' : shown.tone
  return (
    <span
      className={css.reading}
      data-tone={tone}
      data-thu-automad-reading
      title={t('pill.title', { label: status?.token.label ?? '', credentialRef: status?.token.credentialRef ?? '' })}
    >
      <BrandMark small />
      {shown.text}
    </span>
  )
})

/** Latest 429 cooldown across the model pools, or null when none is paused. */
function nearestCooldown(status: AutomadStatus | null): number | null {
  const pools = status?.transport?.pools ?? []
  let latest: number | null = null
  for (const pool of pools) {
    if (pool.pausedUntil === null) continue
    if (pool.pausedUntil <= Date.now()) continue
    latest = latest === null || pool.pausedUntil > latest ? pool.pausedUntil : latest
  }
  return latest
}

/** Map one status onto the text and weight the reading renders. */
function presentationOf(
  status: AutomadStatus,
  remaining: string | null,
  cooldown: string | null,
  t: TranslateNS<typeof NS>,
): Presentation {
  const { token, renew, transport } = status
  const label = token.label
  switch (token.state) {
    case 'expired': return { text: t('pill.expired', { label }), tone: 'error' }
    case 'rejected': return { text: t('pill.rejected', { label }), tone: 'error' }
    case 'missing': return { text: t('pill.missing', { label }), tone: 'idle' }
  }
  const pools = transport?.pools ?? []
  if (pools.some(pool => pool.upstreamError != null)) {
    return { text: t('pill.upstreamError', { label }), tone: 'error' }
  }
  const paused = pools.some(pool => pool.pausedUntil !== null && pool.pausedUntil > Date.now())
  if (paused) {
    return {
      text: t('pill.cooldown', { label, remaining: cooldown ?? '' }),
      tone: 'warn',
    }
  }
  const queued = pools.reduce((sum, pool) => sum + pool.queued, 0)
  if (queued > 0) {
    return { text: t('pill.queued', { label, count: String(queued) }), tone: 'warn' }
  }
  if (renew.lastCode === 'VERIFICATION_PENDING') {
    return { text: t('settings.renew.verificationPending'), tone: 'warn' }
  }
  const withRemaining = { label, remaining: remaining ?? '' }
  if (renew.phase === 'running' && (token.state === 'ok' || token.state === 'expiring')) {
    return { text: t('pill.renewing', { label }), tone: 'warn' }
  }
  switch (token.state) {
    case 'ok':
      return { text: t('pill.remaining', withRemaining), tone: 'ok' }
    case 'expiring':
      return { text: t('pill.remaining', withRemaining), tone: 'warn' }
    case 'unknown':
      return { text: t('pill.unknown', { label }), tone: 'idle' }
  }
}
