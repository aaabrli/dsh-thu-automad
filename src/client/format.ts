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
