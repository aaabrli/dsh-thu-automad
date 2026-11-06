/**
 * Composer dock pill: this plugin's status, as a small popover card.
 *
 * The pill stays the same reading the {@link STATUS_PILL_READING} seat paints;
 * clicking it opens a compact summary of the same states shown in settings.
 * @module dsh-thu-automad/client/StatusLink
 */

import { memo, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { AutomadStatus } from '../protocol.ts'
import type { ReadingInjected } from './Reading.tsx'
import { NS } from './locale.ts'
import { STATUS_PILL_READING } from './slots.ts'
import { css } from './styles.ts'
import { useCountdown } from './use-countdown.ts'
import { Badge, BrandMark, LifetimeMeter, networkReading, renewalReading, tokenReading } from './visuals.tsx'

/** Full props of the composer dock occupant. */
export type StatusLinkProps =
  & PropsRuntime<'conversation.composer.dock'>
  & PropsRenderSlots<typeof STATUS_PILL_READING>
  & PropsLocale<typeof NS>
  & InjectFace<ReadingInjected>

/** Minimal surface of the native popover API used here. */
interface PopoverElement extends HTMLElement {
  showPopover?: () => void
  hidePopover?: () => void
}

/**
 * Composer dock pill opening a compact status card.
 * @param props - framework hooks, the reading seat, locale, and live status.
 * @returns the dock button and its card.
 */
export const StatusLink = memo(function StatusLink({
  renderSlot, t, useAutomadStatus,
}: StatusLinkProps) {
  const { status, unreachable } = useAutomadStatus(value => value)
  const remaining = useCountdown(status?.token.expiresAt ?? null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const card = cardRef.current
    const button = buttonRef.current
    if (card === null || button === null) return
    const sync = (): void => { setOpen(card.matches(':popover-open')) }
    const reposition = (): void => {
      if (card.matches(':popover-open')) positionCard(card, button)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reposition)
    observer?.observe(card)
    card.addEventListener('toggle', sync)
    window.addEventListener('resize', reposition)
    return () => {
      card.removeEventListener('toggle', sync)
      window.removeEventListener('resize', reposition)
      observer?.disconnect()
    }
  }, [])

  const toggle = (): void => {
    const card = cardRef.current as PopoverElement | null
    const button = buttonRef.current
    if (card === null || button === null) return
    if (typeof card.showPopover !== 'function') return
    if (card.matches(':popover-open')) {
      card.hidePopover?.()
      return
    }
    card.showPopover()
    positionCard(card, button)
  }

  return (
    <span className={css.linkWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={css.link}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="thu-automad-status-card"
        title={t('link.title')}
        onClick={toggle}
      >
        {renderSlot(STATUS_PILL_READING, {})}
        {/* Names the control on its own before the reading settles. */}
        <span className={css.hidden}>{t('link.label')}</span>
      </button>
      <div
        ref={cardRef}
        id="thu-automad-status-card"
        popover="auto"
        className={css.statusCard}
        role="dialog"
        aria-label={t('settings.title')}
      >
        <div className={css.cardHead}>
          <BrandMark />
          <span className={css.cardTitle}>{t('settings.title')}</span>
        </div>
        {status === null ? (
          <p className={css.note}>{t(unreachable ? 'pill.unavailable' : 'link.loading')}</p>
        ) : (
          <>
            <div className={css.cardToken}>
              <CardRow label={t('settings.overview.token')}>
                {remaining === null ? null : <span className={css.note}>{t('settings.overview.remaining', { remaining })}</span>}
                <Badge {...tokenReading(status.token.state, t)} />
              </CardRow>
              <LifetimeMeter token={status.token} />
            </div>
            <div className={css.cardRows}>
              <CardRow label={t('settings.overview.network')}><Badge {...networkReading(status.transport, t)} /></CardRow>
              <CardRow label={t('settings.overview.renew')}><Badge {...renewalReading(status.renew, t)} /></CardRow>
              <CardRow label={t('settings.section.queue')}>{queueSummary(status, t)}</CardRow>
            </div>
          </>
        )}
      </div>
    </span>
  )
})

/** Keep the card near its button and inside the available viewport. */
function positionCard(card: HTMLElement, button: HTMLElement): void {
  const margin = 8
  const anchor = button.getBoundingClientRect()
  const { width, height } = card.getBoundingClientRect()
  const above = anchor.top - height - margin
  const top = above >= margin ? above : anchor.bottom + margin
  card.style.top = `${String(Math.max(margin, Math.min(top, window.innerHeight - height - margin)))}px`
  card.style.left = `${String(Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin)))}px`
}

function CardRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={css.cardRow}>
      <span className={css.cardLabel}>{label}</span>
      <div className={css.cardValue}>{children}</div>
    </div>
  )
}

/** One compact line for the three per-model pools. */
function queueSummary(status: AutomadStatus, t: TranslateNS<typeof NS>): ReactNode {
  const pools = status.transport?.pools ?? []
  if (pools.length === 0) return '—'
  const running = pools.reduce((sum, pool) => sum + pool.inFlight, 0)
  const queued = pools.reduce((sum, pool) => sum + pool.queued, 0)
  const paused = pools.some(pool => pool.pausedUntil !== null && pool.pausedUntil > Date.now())
  return (
    <Badge
      tone={queued > 0 || paused ? 'warn' : 'idle'}
      text={t('link.cardQueue', { running: String(running), queued: String(queued) })}
    />
  )
}
