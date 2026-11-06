/** Shared status readings and visual elements for settings and overlays. */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RenewStatus, TokenState, TokenStatus, TransportStatus } from '../protocol.ts'
import type { NS } from './locale.ts'
import { formatTime } from './format.ts'
import { css } from './styles.ts'

export type Tone = 'ok' | 'idle' | 'warn' | 'error'

interface Label {
  text: string
  tone: Tone
}

export function Badge({ text, tone }: Label) {
  return <span className={css.badge} data-tone={tone}>{text}</span>
}

/** The same glyph reads as a tile in headers and a small mark in the composer. */
export function BrandMark({ small = false }: { small?: boolean }) {
  if (small) return <span className={`${css.mark} ${css.pillIcon}`} aria-hidden="true" />
  return <span className={css.markTile} aria-hidden="true"><span className={css.mark} /></span>
}

const TOKEN_TONES: Record<TokenState, Tone> = {
  ok: 'ok', expiring: 'warn', expired: 'error', rejected: 'error', missing: 'idle', unknown: 'idle',
}

export function tokenReading(state: TokenState, t: TranslateNS<typeof NS>): Label {
  return { text: t(`settings.token.state.${state}`), tone: TOKEN_TONES[state] }
}

export function LifetimeMeter({ token }: { token: TokenStatus }) {
  const { expiresAt, issuedAt } = token
  if (expiresAt === null || issuedAt === null || expiresAt <= issuedAt) return null
  const ratio = (expiresAt - Date.now()) / (expiresAt - issuedAt)
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100)
  return (
    <div className={css.meter} data-tone={TOKEN_TONES[token.state]} aria-hidden="true">
      <div className={css.meterFill} style={{ width: `${String(percent)}%` }} />
    </div>
  )
}

export function networkReading(transport: TransportStatus | undefined, t: TranslateNS<typeof NS>): Label {
  if (transport?.enabled === false) return { text: t('settings.network.disabled'), tone: 'idle' }
  switch (transport?.effective) {
    case 'direct': return { text: t('settings.network.campus'), tone: 'ok' }
    case 'webvpn': return { text: t('settings.network.webvpn'), tone: 'ok' }
    default: return { text: t('settings.network.unknown'), tone: 'idle' }
  }
}

export function renewalReading(renew: RenewStatus, t: TranslateNS<typeof NS>): Label {
  switch (renew.phase) {
    case 'scheduled': return { text: t('settings.renew.scheduled', { time: formatTime(renew.nextAttemptAt) }), tone: 'idle' }
    case 'running': return { text: t('settings.renew.running'), tone: 'warn' }
    case 'ok': return { text: t('settings.renew.ok', { time: formatTime(renew.lastAttemptAt) }), tone: 'ok' }
    case 'stalled': return { text: t('settings.renew.stalled'), tone: 'warn' }
    case 'needs-human': return { text: t('settings.renew.needsHuman'), tone: 'error' }
    case 'error': return { text: t('settings.renew.error'), tone: 'error' }
    case 'off': return { text: t('settings.renew.off'), tone: 'idle' }
    case 'idle': return { text: t('settings.renew.idle'), tone: 'idle' }
  }
}
