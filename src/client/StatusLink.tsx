/**
 * Composer dock pill: this plugin's status, as a small popover card.
 *
 * The pill stays the same reading the {@link STATUS_PILL_READING} seat paints;
 * clicking it opens the compact summary.
 *
 * The card is laid out as a small instrument rather than a table: the remaining
 * lifetime is the figure the card exists to report, so it owns the one large
 * number, the two facts that rarely change sit quietly beside it, and the
 * bottom strip is the admission state of the gateway — one group per model, one
 * segment per slot that model is allowed. That strip is why the card is worth
 * opening at all: a single "3 running" total cannot say which model is
 * saturated.
 * @module dsh-thu-automad/client/StatusLink
 */

import { memo, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { RenewStatus, TokenStatus, TransportPoolStatus, TransportStatus } from '../protocol.ts'
import type { ReadingInjected } from './Reading.tsx'
import { formatTime } from './format.ts'
import { NS } from './locale.ts'
import { renewFailureText } from './renew-copy.ts'
import { STATUS_PILL_READING } from './slots.ts'
import { css } from './styles.ts'
import { useCountdown } from './use-countdown.ts'
import { BrandMark, networkReading, tokenReading } from './visuals.tsx'
import type { Tone } from './visuals.tsx'

/** Slots drawn as segments; above this a reading is numbers only. */
const MAX_SEGMENTS = 12

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

  const token = status === null ? null : tokenReading(status.token.state, t)

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
          <span className={css.cardGrow} />
          {token === null ? null : (
            <span className={css.cardState} data-tone={token.tone}>
              <i aria-hidden="true" />
              {token.text}
            </span>
          )}
        </div>
        {status === null ? (
          <p className={css.note}>{t(unreachable ? 'pill.unavailable' : 'link.loading')}</p>
        ) : (
          <>
            <div className={css.cardBody}>
              <div className={css.cardHero}>
                <b>{remaining ?? '—'}</b>
                <span>{t('link.cardRemaining')}</span>
              </div>
              <dl className={css.cardFacts}>
                <Fact label={t('settings.overview.network')} value={networkReading(status.transport, t)} />
                <Fact
                  label={t('settings.overview.renew')}
                  value={renewalFact(status.renew, t)}
                  title={renewalDetail(status.renew, t)}
                />
              </dl>
            </div>
            <LifetimeBar token={status.token} tone={token?.tone ?? 'idle'} />
            <div className={css.cardRule} aria-hidden="true" />
            <div className={css.cardPools}>{poolReadings(status.transport, t)}</div>
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

/** One right-aligned label/value pair in the facts column. */
function Fact({ label, value, title }: { label: string; value: { text: string; tone: Tone }; title?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-tone={value.tone} title={title}>{value.text}</dd>
    </div>
  )
}

/**
 * Remaining share of the token's own lifetime, tinted by its state.
 *
 * The ratio comes from the two timestamps the Host publishes, never from the
 * countdown text, so a stalled poll cannot move the bar.
 */
function LifetimeBar({ token, tone }: { token: TokenStatus; tone: Tone }) {
  const { expiresAt, issuedAt } = token
  if (expiresAt === null || issuedAt === null || expiresAt <= issuedAt) return null
  const ratio = Math.min(1, Math.max(0, (expiresAt - Date.now()) / (expiresAt - issuedAt)))
  return (
    <div className={css.cardLife} data-tone={tone} aria-hidden="true">
      <i style={{ width: `${String(Math.round(ratio * 100))}%` }} />
    </div>
  )
}

/**
 * The renewal fact as one short value.
 *
 * A scheduled or completed renewal is a time; everything else is a state word,
 * because "下次" printed beside a 续期 label says it twice. Tone is what carries
 * the difference between routine and trouble.
 */
function renewalFact(renew: RenewStatus, t: TranslateNS<typeof NS>): { text: string; tone: Tone } {
  switch (renew.phase) {
    case 'scheduled': return { text: formatTime(renew.nextAttemptAt), tone: 'idle' }
    case 'ok': return { text: formatTime(renew.lastAttemptAt), tone: 'idle' }
    case 'running': return { text: t('settings.renew.running'), tone: 'warn' }
    case 'stalled': return { text: t('settings.renew.stalled'), tone: 'warn' }
    case 'needs-human': return { text: t('settings.renew.needsHuman'), tone: 'error' }
    case 'error': return { text: t('settings.renew.error'), tone: 'error' }
    case 'off': return { text: t('settings.renew.off'), tone: 'idle' }
    case 'idle': return { text: t('settings.renew.idle'), tone: 'idle' }
  }
}

/**
 * The admission list: one row per model, against the gateway's own ceiling.
 *
 * The ceilings are per model (3 + 4 + 1 = 8 slots on the shipped configuration),
 * so one total hides which model is saturated — and a three-letter abbreviation
 * hides which model it is, which is the part a reader cannot verify. A row per
 * model fits the whole id, its slots and its queue without a legend.
 * @param transport - transport facts, absent while the loopback is starting.
 * @param t - locale seat.
 * @returns one row per known model.
 */
function poolReadings(transport: TransportStatus | undefined, t: TranslateNS<typeof NS>): ReactNode {
  const pools = transport?.pools ?? []
  if (pools.length === 0) return <span className={css.poolCount}>—</span>
  return pools.map(pool => <PoolRow key={pool.model} pool={pool} t={t} />)
}

/**
 * One model's row: slots, count, queue, and — while the gateway has it paused —
 * how long the 429 cooldown has left. The countdown lives here rather than in
 * the parent so only a paused row keeps a timer alive.
 */
function PoolRow({ pool, t }: { pool: TransportPoolStatus; t: TranslateNS<typeof NS> }) {
  const cooldown = useCountdown(pool.pausedUntil)
  // `ceiling` is optional on the wire; the admission limit is the same number
  // on a profile that never ramps, so an older Host still renders a reading.
  const ceiling = pool.ceiling ?? pool.limit
  const paused = pool.pausedUntil !== null && pool.pausedUntil > Date.now()
  const full = ceiling > 0 && pool.inFlight >= ceiling
  const tone: Tone = paused ? 'error' : full ? 'warn' : 'idle'
  const slots = ceiling > 0 && ceiling <= MAX_SEGMENTS
    ? Array.from({ length: ceiling }, (_unused, index) => index)
    : []
  const counts = t('link.cardQueue', { running: String(pool.inFlight), queued: String(pool.queued) })
  return (
    <span
      className={css.pool}
      title={paused && cooldown !== null ? `${t('settings.queue.cooldown', { remaining: cooldown })} · ${counts}` : counts}
    >
      <span className={css.poolName}>{pool.model}</span>
      {slots.length === 0 ? null : (
        <span className={css.segs} aria-hidden="true">
          {slots.map(index => (
            <i
              key={index}
              className={css.seg}
              data-on={index < pool.inFlight ? 'true' : undefined}
              data-tone={tone}
            />
          ))}
        </span>
      )}
      <span className={css.poolCount} data-tone={tone}>{`${String(pool.inFlight)}/${String(ceiling)}`}</span>
      {pool.queued > 0 ? <span className={css.poolQueued}>{`+${String(pool.queued)}`}</span> : null}
      {paused && cooldown !== null
        ? <span className={css.poolPaused}>{t('settings.queue.cooldown', { remaining: cooldown })}</span>
        : null}
    </span>
  )
}

/**
 * The Host's explanation for the last failed renewal, for the row's tooltip.
 *
 * The card only has room for a state word; the reason (and the Host's own
 * diagnostic when no code covers it) rides along in the title, so diagnosing a
 * failed renewal does not require opening the settings page.
 * @param renew - renewal state from the status document.
 * @param t - locale seat.
 * @returns the explanation, or undefined when the last attempt did not fail.
 */
function renewalDetail(renew: RenewStatus, t: TranslateNS<typeof NS>): string | undefined {
  if (renew.lastCode === null) return undefined
  return renewFailureText(renew.lastCode, renew.lastMessage, t) ?? renew.lastMessage ?? renew.lastCode
}