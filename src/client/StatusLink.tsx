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
import type { TransportStatus } from '../protocol.ts'
import type { ReadingInjected } from './Reading.tsx'
import { modelLabel } from './format.ts'
import { NS } from './locale.ts'
import { STATUS_PILL_READING } from './slots.ts'
import { css } from './styles.ts'
import { useCountdown } from './use-countdown.ts'
import { BrandMark, networkReading, renewalReading, tokenReading } from './visuals.tsx'
import type { Tone } from './visuals.tsx'

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
          <span className={css.cardTitle}>
            <BrandMark small />
            <span>{t('settings.title')}</span>
          </span>
          {remaining === null ? null : <span className={css.cardHeadValue}>{remaining}</span>}
        </div>
        <div className={css.cardRule} aria-hidden="true" />
        {status === null ? (
          <p className={css.note}>{t(unreachable ? 'pill.unavailable' : 'link.loading')}</p>
        ) : (
          <dl className={css.cardRows}>
            <CardRow label={t('settings.overview.token')} tone={tokenReading(status.token.state, t).tone}>
              {tokenReading(status.token.state, t).text}
            </CardRow>
            <CardRow label={t('settings.overview.network')} tone={networkReading(status.transport, t).tone}>
              {networkReading(status.transport, t).text}
            </CardRow>
            <CardRow label={t('settings.overview.renew')} tone={renewalReading(status.renew, t).tone}>
              {renewalReading(status.renew, t).text}
            </CardRow>
            <CardRow label={t('settings.section.queue')}>{poolReadings(status.transport, t)}</CardRow>
          </dl>
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

/** One definition-list row: term on the left, reading on the right. */
function CardRow({ label, tone = 'idle', children }: { label: string; tone?: Tone; children: ReactNode }) {
  return (
    <div className={css.cardRow}>
      <dt className={css.cardLabel}>{label}</dt>
      <dd className={css.cardValue} data-tone={tone}>{children}</dd>
    </div>
  )
}

/**
 * One reading per model: live completions against the gateway's own ceiling.
 *
 * The ceilings are per model (3 + 4 + 1 = 8 slots on the shipped configuration),
 * so a single "3 running" total hides which model is actually saturated. Each
 * group shows in-flight against that ceiling and appends the queue when one
 * exists; the full model id and the queue travel in the title.
 * @param transport - transport facts, absent while the loopback is starting.
 * @param t - locale seat.
 * @returns one element per known model, or an em dash before pools exist.
 */
function poolReadings(transport: TransportStatus | undefined, t: TranslateNS<typeof NS>): ReactNode {
  const pools = transport?.pools ?? []
  if (pools.length === 0) return '—'
  return pools.map((pool) => {
    // `ceiling` is optional on the wire; the admission limit is the same number
    // on a profile that never ramps, so an older Host still renders a reading.
    const ceiling = pool.ceiling ?? pool.limit
    const paused = pool.pausedUntil !== null && pool.pausedUntil > Date.now()
    const full = ceiling > 0 && pool.inFlight >= ceiling
    return (
      <span
        key={pool.model}
        className={css.pool}
        data-tone={paused ? 'error' : full ? 'warn' : 'idle'}
        title={`${pool.model} · ${t('link.cardQueue', { running: String(pool.inFlight), queued: String(pool.queued) })}`}
      >
        <span className={css.poolName}>{modelLabel(pool.model)}</span>
        <span className={css.poolCount}>{`${String(pool.inFlight)}/${String(ceiling)}`}</span>
        {pool.queued > 0 ? <span className={css.poolCount}>{`+${String(pool.queued)}`}</span> : null}
      </span>
    )
  })
}
