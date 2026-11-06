/**
 * Admission-control knobs for the loopback transport.
 *
 * The school's gateway counts in-flight completions per account and refuses the
 * ones above its limit with a 429. That limit is upstream's, so the proxy cannot
 * raise it; what it can do is never exceed it, never surface the refusal to the
 * conversation, and use the capacity it does have without wasting slots.
 *
 * The values here are conservative starting points. The effective limit is
 * learned at runtime: it grows after a run of successes and halves on a 429, so
 * a deployment does not have to know today's number in advance.
 * @module dsh-thu-automad/transport/concurrency
 */

/** One model's admission policy. */
export interface ConcurrencyOptions {
  /** In-flight completions allowed before requests start queueing. */
  initial: number
  /** Ceiling the learned limit may grow to. */
  max: number
  /** Floor the learned limit may shrink to. */
  min: number
  /**
   * Per-model ceilings. The school limits each model separately (measured:
   * V4.1-Flash 3, Qwen 3.8 4, R1 1), so a value here replaces both the initial
   * limit and the ceiling for that model.
   */
  perModel?: Readonly<Record<string, number>>
  /** Consecutive completed requests before the limit grows by one. */
  growAfter: number
  /** Requests that may wait for a slot; beyond it new requests are refused. */
  queueLimit: number
  /**
   * Longest a request may wait for a slot, in milliseconds. `0` means no
   * plugin-imposed limit: the request waits until a slot frees, the client
   * disconnects, or the host's own request budget expires.
   */
  maxWaitMs: number
  /** Delay before a queued streaming request starts its keepalive comments. */
  heartbeatAfterMs: number
  /** Interval between those keepalive comments. */
  heartbeatMs: number
  /** First pause after a 429; doubles on each further 429. */
  cooldownMs: number
  /** Ceiling for that pause. */
  maxCooldownMs: number
}

/** Models the gateway advertises; seeded so every queue is visible before use. */
export const KNOWN_MODELS = [
  'DeepSeek-V4.1-Flash',
  'qwen3.8-27b',
  'DeepSeek-R1-W8A8',
] as const

/** Documented defaults, restated in README.md and cordis.patch.yml. */
export const CONCURRENCY_DEFAULTS = {
  // The gateway's own per-model limit is 3 (madmodel's modelList.max_tokens).
  // Start and cap there so the learned value never exceeds what the account can
  // actually run; a 429 still halves it and it grows back after successes.
  initial: 3,
  max: 3,
  perModel: {},
  min: 1,
  growAfter: 4,
  queueLimit: 32,
  // The user asked for "wait until it can continue", so no plugin-side ceiling:
  // the wait ends when capacity appears or the caller gives up.
  maxWaitMs: 0,
  heartbeatAfterMs: 20_000,
  heartbeatMs: 15_000,
  cooldownMs: 5_000,
  maxCooldownMs: 120_000,
} as const satisfies ConcurrencyOptions