/**
 * Render a remaining lifetime as compact, monotonic-width text.
 *
 * The countdown is computed in the browser from the absolute deadline the Host
 * sent, so a slow poll never shifts the displayed figure and the Host never
 * has to publish a value per second.
 * @module dsh-thu-automad/client/format
 */

/** Milliseconds in one minute. */
const MINUTE_MS = 60_000

/** Milliseconds in one hour. */
const HOUR_MS = 60 * MINUTE_MS

/**
 * Format the distance from `now` to an absolute deadline.
 * @param expiresAt - deadline in epoch milliseconds; null states no deadline.
 * @param now - current epoch milliseconds.
 * @returns compact text such as `2h14m`, `24m`, `45s`, or null without a deadline.
 */
export function formatRemaining(expiresAt: number | null, now: number): string | null {
  if (expiresAt === null) return null
  const remaining = expiresAt - now
  if (remaining <= 0) return '0s'
  if (remaining >= HOUR_MS) {
    const hours = Math.floor(remaining / HOUR_MS)
    const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS)
    return minutes === 0 ? `${String(hours)}h` : `${String(hours)}h${String(minutes)}m`
  }
  if (remaining >= MINUTE_MS) return `${String(Math.floor(remaining / MINUTE_MS))}m`
  return `${String(Math.floor(remaining / 1000))}s`
}

/** Reader-local time for a scheduled or completed action. */
export function formatTime(at: number | null): string {
  return at === null ? '—' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(at)
}

/** Reader-local date and time for a token deadline. */
export function formatDateTime(at: number): string {
  return new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(at)
}

/** Familiar abbreviations for the models this plugin's provider row ships. */
const MODEL_LABELS: Record<string, string> = {
  'DeepSeek-V4.1-Flash': 'V4.1',
  'qwen3.8-27b': 'Qwen',
  'DeepSeek-R1-W8A8': 'R1',
}

/**
 * Short model name for the status card's concurrency row.
 *
 * The row carries one reading per model, so the name has to stay short enough
 * that three of them sit on one line while the full id stays available as the
 * element's title. Known ids get their familiar abbreviation; anything else
 * (a deployment that adds models) is shortened mechanically rather than
 * guessed at.
 * @param model - model id as the Host reports it.
 * @returns the compact label.
 */
export function modelLabel(model: string): string {
  const known = MODEL_LABELS[model]
  if (known !== undefined) return known
  const trimmed = model.replace(/^deepseek-/iu, '').replace(/-(?:w\d+a\d+|awq|gptq)$/iu, '')
  return trimmed.length <= 10 ? trimmed : `${trimmed.slice(0, 9)}…`
}
