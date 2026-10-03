/**
 * What the plugin has done since it loaded.
 *
 * A listener-only plugin is invisible: nothing about it can be observed from
 * outside the process, so "is it running" has no answer. This ledger is that
 * answer — it is published on a read-only route and therefore also proves the
 * plugin's own `apply` ran.
 * @module dsh-thu-automad/policy/status
 */

import type { Resolution, Route, Rule } from './config.ts'

/** How many times each action was selected for a failure. */
export interface DecisionCounts {
  /** Failures left to the retry owner's decision. */
  retry: number
  /** Decisions that moved a request to another route. */
  switch: number
  /** Failures the policy declared terminal. */
  fail: number
  /** Failures that reached the human as a question. */
  ask: number
  /** Failures the policy answered by re-acquiring the credential first. */
  renew: number
}

/** The last failure this plugin acted on. */
export interface LastDecision {
  /** Epoch milliseconds the decision was made. */
  at: number
  /** Provider route the failed request targeted. */
  provider: string
  /** Normalized failure code. */
  code: string
  /** Action the policy selected. */
  action: Resolution['action']
  /** Target route, for a switch. */
  to?: Route
  /** Whether the answer came from the human rather than the rule alone. */
  asked: boolean
}

/** One rule in the shape the status route reports it. */
export interface RuleSummary {
  /** Provider routes matched; empty means every route. */
  provider: readonly string[]
  /** Failure codes matched; empty means every code. */
  code: readonly string[]
  /** Configured action. */
  action: string
  /** Configured switch cooldown in milliseconds. */
  cooldownMs: number
  /** Configured delegated-failure budget that precedes this rule's action. */
  afterRetries: number
  /** Configured fallback for `action: renew`; absent for every other action. */
  onFailure?: string
}

/** The published status document. */
export interface StatusSnapshot {
  /** Plugin name, so a fetched document identifies itself. */
  plugin: string
  /** Epoch milliseconds this plugin's `apply` completed. */
  appliedAt: number
  /** Seconds since `appliedAt`, as of this read. */
  uptimeSeconds: number
  /** Whether the status route itself is registered. */
  routeRegistered: boolean
  /** Configured rules, in match order. */
  rules: readonly RuleSummary[]
  /** Counts by action. */
  decisions: DecisionCounts
  /** The most recent decision, or null before any matching failure. */
  last: LastDecision | null
}

/** Accumulate what the policy did, for the status route to report. */
export class StatusLedger {
  private readonly appliedAt = Date.now()
  private readonly decisions: DecisionCounts = { retry: 0, switch: 0, fail: 0, ask: 0, renew: 0 }
  private last: LastDecision | null = null

  /**
   * Record one acted-on failure.
   * @param provider - provider route the failed request targeted.
   * @param code - normalized failure code.
   * @param resolution - the action the policy selected.
   * @param asked - whether a human answered rather than the rule alone.
   * @param now - current epoch milliseconds.
   */
  record(provider: string, code: string, resolution: Resolution, asked: boolean, now: number): void {
    this.decisions[resolution.action] += 1
    if (asked) this.decisions.ask += 1
    this.last = {
      at: now,
      provider,
      code,
      action: resolution.action,
      ...resolution.action === 'switch' ? { to: resolution.to } : {},
      asked,
    }
  }

  /**
   * Record that one failure was answered by re-acquiring the credential.
   *
   * Counted beside the action rather than as one: a renewal that worked ends in
   * a retry, and one that needed a human ends in whatever `onFailure` named, so
   * the action counts say what happened to the request while this says how
   * often the credential was re-acquired to get there.
   */
  noteRenewal(): void {
    this.decisions.renew += 1
  }

  /**
   * Project the ledger and the loaded rules onto the wire document.
   * @param rules - the validated rules this plugin is running on.
   * @param routeRegistered - whether the status route is registered.
   * @returns the status document.
   */
  snapshot(rules: readonly Rule[], routeRegistered: boolean): StatusSnapshot {
    const now = Date.now()
    return {
      plugin: 'thu-automad',
      appliedAt: this.appliedAt,
      uptimeSeconds: Math.round((now - this.appliedAt) / 1000),
      routeRegistered,
      rules: rules.map(rule => ({
        provider: rule.provider,
        code: rule.code,
        action: rule.action,
        cooldownMs: rule.cooldownMs,
        afterRetries: rule.afterRetries,
        ...rule.onFailure === undefined ? {} : { onFailure: rule.onFailure },
      })),
      decisions: { ...this.decisions },
      last: this.last,
    }
  }
}
