/**
 * Turn an absolute deadline into live text on the reader's own clock.
 *
 * The Host publishes a deadline, never a countdown, so a slow poll cannot
 * shift the displayed figure. Recomputing here keeps that cost per second to
 * one string comparison: React bails out of the re-render whenever the
 * formatted text is unchanged.
 * @module dsh-thu-automad/client/use-countdown
 */

import { useEffect, useState } from 'react'
import { formatRemaining } from './format.ts'

/** Clock tick; the formatted text only changes when its own resolution does. */
const TICK_MS = 1000

/**
 * Read a formatted remaining lifetime that stays current.
 * @param expiresAt - absolute deadline in epoch milliseconds, or null.
 * @returns the formatted remaining lifetime, or null without a deadline.
 */
export function useCountdown(expiresAt: number | null): string | null {
  const [text, setText] = useState<string | null>(() => formatRemaining(expiresAt, Date.now()))
  useEffect(() => {
    setText(formatRemaining(expiresAt, Date.now()))
    if (expiresAt === null) return
    const timer = window.setInterval(() => { setText(formatRemaining(expiresAt, Date.now())) }, TICK_MS)
    return () => { window.clearInterval(timer) }
  }, [expiresAt])
  return text
}
