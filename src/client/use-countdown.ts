/** Update a countdown from a host-provided deadline. */

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
