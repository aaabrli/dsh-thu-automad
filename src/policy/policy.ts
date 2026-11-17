/** Match failure rules and apply per-step retry and route choices. */

import type { Choice, Resolution, Route, Rule } from './config.ts'

/** How long a route override stays claimable before it is treated as stale. */
const OVERRIDE_TTL_MS = 5 * 60 * 1000

/**
 * Select the first rule that matches one failure.
 * @param rules - configured rules in declaration order.
 * @param provider - provider route the failed request targeted.
 * @param code - normalized failure code.
 * @returns the first matching rule, or undefined when none matches.
 */
export function matchRule(rules: readonly Rule[], provider: string, code: string): Rule | undefined {
  return rules.find(rule =>
    (rule.provider.length === 0 || rule.provider.includes(provider))
    && (rule.code.length === 0 || rule.code.includes(code)))
}

/**
 * Convert one answer choice into the resolution it performs.
 * @param choice - the picked (or fallback) choice.
 * @returns the resolution to execute.
 */
export function resolutionOf(choice: Choice): Resolution {
  if (choice.action === 'switch') {
    // Validation guarantees a target for this action.
    return { action: 'switch', to: choice.to as Route }
  }
  return { action: choice.action }
}

/**
 * Fill one configured question's placeholders.
 * @param text - configured question text.
 * @param values - substitution values; an unknown key is left verbatim.
 * @returns the rendered question.
 */
export function substitute(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match)
}

/** Route overrides and self-granted attempts, keyed by one turn and step. */
export class StepRoutes {
  private readonly overrides = new Map<string, { to: Route; at: number }>()
  private readonly owned = new Map<string, number>()
  private readonly failures = new Map<string, { count: number; at: number }>()

  /**
   * Record the route the next attempt of one step must use.
   * @param key - turn and step identity.
   * @param to - route to apply on re-entry.
   * @param now - current epoch milliseconds.
   */
  set(key: string, to: Route, now: number): void {
    this.prune(now)
    this.overrides.set(key, { to, at: now })
  }

  /**
   * Consume the route recorded for one step.
   * @param key - turn and step identity.
   * @returns the route to apply, or undefined when this step has none.
   */
  take(key: string): Route | undefined {
    const entry = this.overrides.get(key)
    if (entry === undefined) return undefined
    this.overrides.delete(key)
    return entry.to
  }

  /**
   * Drop one step's pending override.
   * @param key - turn and step identity.
   */
  forget(key: string): void {
    this.overrides.delete(key)
  }

  /** Count one more failure of a step, for a rule that retries before it acts. */
  countFailure(key: string, now: number): number {
    this.prune(now)
    const count = (this.failures.get(key)?.count ?? 0) + 1
    this.failures.set(key, { count, at: now })
    return count
  }

  /** Claim the single attempt this plugin grants for one recovery of a step. */
  claimOwn(key: string, kind: string, now: number): boolean {
    this.prune(now)
    const slot = `${key}#${kind}`
    if (this.owned.has(slot)) return false
    this.owned.set(slot, now)
    return true
  }

  /** Drop entries old enough that no live attempt can claim them. */
  private prune(now: number): void {
    for (const [key, entry] of this.overrides) {
      if (now - entry.at > OVERRIDE_TTL_MS) this.overrides.delete(key)
    }
    for (const [key, at] of this.owned) {
      if (now - at > OVERRIDE_TTL_MS) this.owned.delete(key)
    }
    for (const [key, entry] of this.failures) {
      if (now - entry.at > OVERRIDE_TTL_MS) this.failures.delete(key)
    }
  }
}

/**
 * Key one turn and step as the two halves of a switch agree on.
 * @param turn - turn index.
 * @param step - step index.
 * @returns the stable key.
 */
export function stepKey(turn: number, step: number): string {
  return `${String(turn)}:${String(step)}`
}
