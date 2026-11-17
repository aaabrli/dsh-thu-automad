/** Open the token and per-model status card from the composer. */

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
import { BrandMark, networkReading, poolFailureText, tokenReading } from './visuals.tsx'
import type { Tone } from './visuals.tsx'

/** Slots drawn as segments; above this a reading is numbers only. */
const MAX_SEGMENTS = 12

/** Full props of the composer dock occupant. */
export type StatusLinkProps =
  & PropsRuntime<'conversation.composer.dock'>
  & PropsRenderSlots<typeof STATUS_PILL_READING>
  & PropsLocale<typeof NS>
  & InjectFace<ReadingInjected>

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
    const card = cardRef.current
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

/** Remaining share of the token's own lifetime, tinted by its state. */
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

/** The renewal fact as one short value. */
function renewalFact(renew: RenewStatus, t: TranslateNS<typeof NS>): { text: string; tone: Tone } {
  if (renew.lastCode === 'VERIFICATION_PENDING') return { text: t('settings.renew.verificationPending'), tone: 'warn' }
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

/** The admission list shows the limit currently applied to each model. */
function poolReadings(transport: TransportStatus | undefined, t: TranslateNS<typeof NS>): ReactNode {
  const pools = transport?.pools ?? []
  if (pools.length === 0) return <span className={css.poolCount}>—</span>
  return pools.map(pool => <PoolRow key={pool.model} pool={pool} t={t} />)
}

/** Render one model's slot usage, queue and cooldown. */
function PoolRow({ pool, t }: { pool: TransportPoolStatus; t: TranslateNS<typeof NS> }) {
  const cooldown = useCountdown(pool.pausedUntil)
  const { limit, starting = 0 } = pool
  const paused = pool.pausedUntil !== null && pool.pausedUntil > Date.now()
  const full = limit > 0 && pool.inFlight >= limit
  const failure = poolFailureText(pool, t)
  const tone: Tone = failure !== null || paused ? 'error' : full || pool.recovering === true ? 'warn' : 'idle'
  const slots = limit > 0 && limit <= MAX_SEGMENTS
    ? Array.from({ length: limit }, (_unused, index) => index)
    : []
  const counts = t('link.cardQueue', { running: String(pool.inFlight), queued: String(pool.queued) })
  const wait = paused && cooldown !== null
    ? t('settings.queue.cooldown', { remaining: cooldown })
    : pool.recovering === true ? t('settings.queue.recovering')
      : starting > 0 ? t('settings.queue.starting', { count: String(starting) }) : null
  const detail = [failure, wait, counts].filter(value => value !== null).join(' · ')
  const modelStatus = failure === null ? wait : t('link.modelUnavailable')
  return (
    <span
      className={css.pool}
      title={detail}
    >
      <span className={css.poolName}>{pool.model}</span>
      <span className={css.poolQueued}>{pool.queued > 0 ? `+${String(pool.queued)}` : ''}</span>
      <span className={css.poolUsage}>
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
        <span className={css.poolCount} data-tone={tone}>{`${String(pool.inFlight)}/${String(limit)}`}</span>
      </span>
      {modelStatus !== null
        ? <span className={css.poolPaused} data-tone={paused || failure !== null ? 'error' : 'idle'}>{modelStatus}</span>
        : null}
    </span>
  )
}

/** The Host's explanation for the last failed renewal, for the row's tooltip. */
function renewalDetail(renew: RenewStatus, t: TranslateNS<typeof NS>): string | undefined {
  if (renew.lastCode === null) return undefined
  return renewFailureText(renew.lastCode, renew.lastMessage, t) ?? renew.lastMessage ?? renew.lastCode
}
