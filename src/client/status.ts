/** Poll host status and publish changes to UI subscribers. */

import type { AutomadStatus } from '../protocol.ts'
import { STATUS_PATH, isAutomadStatus, routeOf } from '../protocol.ts'

/** Poll cadence: short enough that a parked two-factor question appears promptly. */
const POLL_INTERVAL_MS = 5_000

/** What render code reads. */
export interface AutomadSnapshot {
  /** Latest validated Host status, or null before the first successful read. */
  status: AutomadStatus | null
  /** Whether the most recent read failed, leaving `status` as the last known value. */
  unreachable: boolean
}

/** Read-and-subscribe source the slot registrations expose as a bound hook. */
export interface AutomadStatusSource {
  /**
   * Read the current snapshot.
   * @returns the same object until a displayed fact changes.
   */
  getSnapshot(): AutomadSnapshot
  /**
   * Observe snapshot changes.
   * @param listener - called after each published change.
   * @returns a disposer removing the listener.
   */
  subscribe(listener: () => void): () => void
}

/** Poll the Host status route and publish what it reports. */
export class AutomadStatusController implements AutomadStatusSource {
  private snapshot: AutomadSnapshot = { status: null, unreachable: false }
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | undefined
  private inFlight = false

  /** @returns the current snapshot. */
  getSnapshot = (): AutomadSnapshot => this.snapshot

  /**
   * @param listener - called after each published change.
   * @returns a disposer removing the listener.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Begin polling, and read once immediately.
   * @returns a disposer stopping the schedule and the focus listener.
   */
  start(): () => void {
    void this.poll()
    this.timer = setInterval(() => { void this.poll() }, POLL_INTERVAL_MS)
    // Refresh when the application becomes visible.
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void this.poll()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      if (this.timer !== undefined) clearInterval(this.timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  /** Read the status route once and publish the outcome. */
  async poll(): Promise<void> {
    if (this.inFlight) return
    this.inFlight = true
    try {
      const response = await fetch(routeOf(STATUS_PATH), {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (!response.ok) {
        this.publishUnreachable()
        return
      }
      const decoded: unknown = await response.json()
      if (!isAutomadStatus(decoded)) {
        this.publishUnreachable()
        return
      }
      this.publish({ status: decoded, unreachable: false })
    } catch (_statusRouteUnreachable) {
      this.publishUnreachable()
    } finally {
      this.inFlight = false
    }
  }

  /** Keep the last known status while marking the route unreachable. */
  private publishUnreachable(): void {
    this.publish({ status: this.snapshot.status, unreachable: true })
  }

  /** Replace the snapshot when a displayed fact moved, then notify listeners. */
  private publish(next: AutomadSnapshot): void {
    if (sameSnapshot(this.snapshot, next)) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}

/** Whether two snapshots render identically. */
function sameSnapshot(left: AutomadSnapshot, right: AutomadSnapshot): boolean {
  if (left.unreachable !== right.unreachable) return false
  if (left.status === null || right.status === null) return left.status === right.status
  return displayable(left.status) === displayable(right.status)
}

/** Encode one status with its read-stamped fields removed. */
function displayable(status: AutomadStatus): string {
  const { observedAt: _observedAt, uptimeSeconds: _uptimeSeconds, ...rest } = status
  const { observedAt: _tokenObservedAt, ...token } = rest.token
  return JSON.stringify({ ...rest, token })
}
