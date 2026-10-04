/**
 * Configured failure policy: ordered rules that decide what one failed model
 * request does next.
 *
 * This package ships outside the harness workspace and therefore resolves no
 * harness runtime value, including the shared schema package. It validates its
 * own fields instead and throws from `apply`, which fails the plugin's fiber at
 * the same moment a declared schema would, with a message naming the field.
 *
 * The `renew` action is the one addition over the standalone policy plugin: a
 * credential refusal is no longer terminal for a provider whose token this
 * package can re-acquire, so `onFailure` names what happens when the renewal
 * itself cannot proceed.
 * @module dsh-thu-automad/policy/config
 */

/** One provider route a request may be sent to. */
export interface Route {
  /** Registered provider route name, such as `tsinghua`. */
  provider: string
  /** Model id passed to that route. */
  model: string
}

/** Actions a rule (or one answer choice) may select. */
export type ChoiceAction = 'retry' | 'switch' | 'fail'

/** Actions a rule may declare; `ask` defers the choice to the human, `renew` re-acquires the credential first. */
export type RuleAction = ChoiceAction | 'ask' | 'renew'

/** Actions a `renew` rule's `onFailure` may name; everything a choice may do, plus asking. */
export type FallbackAction = ChoiceAction | 'ask'

/** One selectable answer, carrying what it does. */
export interface Choice {
  /** Text shown to the human; also the answer this choice is matched by. */
  label: string
  /** Action performed when this choice is picked. */
  action: ChoiceAction
  /** Required by `switch`. */
  to?: Route
}

/** The question one rule asks when a matching request fails. */
export interface AskSpec {
  /** Question text; `{provider}`, `{code}`, and `{message}` are substituted. */
  question: string
  /** Selectable answers, at least one. */
  choices: readonly Choice[]
  /** How long to wait for an answer before taking `unavailable`. */
  timeoutMs: number
  /** Taken when nobody can answer: a delegated child, a timeout, or no UI. */
  unavailable: Choice
}

/** One ordered rule. */
export interface Rule {
  /** Provider routes this rule matches; empty matches every route. */
  provider: readonly string[]
  /** Failure codes this rule matches; empty matches every code. */
  code: readonly string[]
  /** What a matching failure does next. */
  action: RuleAction
  /** Required by `action: 'switch'`. */
  to?: Route
  /** Required by `action: 'ask'`, and by `action: 'renew'` with `onFailure: 'ask'`. */
  ask?: AskSpec
  /**
   * How many failures of one turn-and-step this rule leaves to whatever else
   * owns retries before it acts at all.
   *
   * Each delegated failure is the retry owner's to answer, so this is how a
   * rule retries first and acts only once that budget is spent: with the
   * harness retry owner's `maxRetries: 5`, `afterRetries: 5` shows its five
   * "(n/5)" attempts and brings the rule in on the sixth failure. Zero acts on
   * the first failure.
   */
  afterRetries: number
  /**
   * Required by `action: 'renew'`: what happens once renewal failed, needed a
   * human, or had nothing to re-acquire. Never `renew` itself — a renewal that
   * keeps failing must not loop.
   */
  onFailure: FallbackAction | undefined
}

/** What one resolved rule tells the recovery to do. */
export type Resolution =
  | { action: 'retry' }
  | { action: 'switch'; to: Route }
  | { action: 'fail' }
  | { action: 'renew' }

/** Documented defaults, restated in README.md. */
const DEFAULT_TIMEOUT_MS = 120_000

const CHOICE_ACTIONS: readonly string[] = ['retry', 'switch', 'fail']
const RULE_ACTIONS: readonly string[] = [...CHOICE_ACTIONS, 'ask', 'renew']
const FALLBACK_ACTIONS: readonly string[] = [...CHOICE_ACTIONS, 'ask']
const RULE_KEYS: readonly string[] = ['when', 'action', 'to', 'ask', 'afterRetries', 'onFailure']

/** Message prefix every rule-validation error carries, so the failing field is unambiguous. */
const PREFIX = 'thu-automad: rules'

/**
 * Validate one raw `rules` value from cordis.yml.
 * @param raw - the `rules` list itself.
 * @returns the ordered rules the plugin runs on.
 * @throws Error naming the offending field, before any capability registers.
 */
export function resolveRules(raw: unknown): Rule[] {
  if (raw === undefined) {
    throw new Error(`${PREFIX} is required; an empty list disables the policy half`)
  }
  if (!Array.isArray(raw)) throw new Error(`${PREFIX} must be a list`)
  return raw.map((entry, index) => rule(entry, `rules[${String(index)}]`))
}

/** Validate one rule entry. */
function rule(value: unknown, path: string): Rule {
  const record = asRecord(value, path)
  for (const key of Object.keys(record)) {
    if (!RULE_KEYS.includes(key)) throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`)
  }
  const when = record.when === undefined ? {} : asRecord(record.when, `${path}.when`)
  for (const key of Object.keys(when)) {
    if (key !== 'provider' && key !== 'code') {
      throw new Error(`${PREFIX}: ${path}.when: unknown key "${key}"`)
    }
  }
  const action = member(record.action, RULE_ACTIONS, `${path}.action`)
  const provider = names(when.provider, `${path}.when.provider`)
  const code = names(when.code, `${path}.when.code`)
  const afterRetries = budget(record.afterRetries, `${path}.afterRetries`)

  if (action === 'renew') {
    if (record.onFailure === undefined) {
      throw new Error(`${PREFIX}: ${path}.onFailure is required for action "renew"`)
    }
    const onFailure = member(record.onFailure, FALLBACK_ACTIONS, `${path}.onFailure`) as FallbackAction
    if (onFailure === 'switch') {
      if (record.ask !== undefined) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`)
      return { provider, code, action, to: route(record.to, `${path}.to`), afterRetries, onFailure }
    }
    if (onFailure === 'ask') {
      if (record.to !== undefined) throw new Error(`${PREFIX}: ${path}.to is only valid for a "switch" target`)
      return { provider, code, action, ask: askSpec(record.ask, `${path}.ask`), afterRetries, onFailure }
    }
    if (record.to !== undefined) throw new Error(`${PREFIX}: ${path}.to is only valid for a "switch" target`)
    if (record.ask !== undefined) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`)
    return { provider, code, action, afterRetries, onFailure }
  }

  if (record.onFailure !== undefined) {
    throw new Error(`${PREFIX}: ${path}.onFailure is only valid for action "renew"`)
  }
  if (action === 'switch') {
    if (record.ask !== undefined) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`)
    return { provider, code, action, to: route(record.to, `${path}.to`), afterRetries, onFailure: undefined }
  }
  if (action === 'ask') {
    if (record.to !== undefined) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`)
    return { provider, code, action, ask: askSpec(record.ask, `${path}.ask`), afterRetries, onFailure: undefined }
  }
  if (record.to !== undefined) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`)
  if (record.ask !== undefined) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`)
  return { provider, code, action: action as ChoiceAction, afterRetries, onFailure: undefined }
}

/** Read one optional non-negative delegated-failure budget; absent means none. */
function budget(value: unknown, path: string): number {
  if (value === undefined) return 0
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${PREFIX}: ${path} must be a non-negative integer`)
  }
  return value
}

/** Validate one `ask` block. */
function askSpec(value: unknown, path: string): AskSpec {
  const record = asRecord(value, path)
  for (const key of Object.keys(record)) {
    if (!['question', 'choices', 'timeoutMs', 'unavailable'].includes(key)) {
      throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`)
    }
  }
  const question = record.question
  if (typeof question !== 'string' || question.length === 0) {
    throw new Error(`${PREFIX}: ${path}.question must be a non-empty string`)
  }
  const rawChoices = record.choices
  if (!Array.isArray(rawChoices) || rawChoices.length === 0) {
    throw new Error(`${PREFIX}: ${path}.choices must be a non-empty list`)
  }
  const choices = rawChoices.map((entry, index) => choice(entry, `${path}.choices[${String(index)}]`))
  const labels = new Set(choices.map(entry => entry.label))
  if (labels.size !== choices.length) {
    throw new Error(`${PREFIX}: ${path}.choices labels must be unique; an answer is matched by label`)
  }
  const timeout = record.timeoutMs
  if (timeout !== undefined && (typeof timeout !== 'number' || !Number.isSafeInteger(timeout) || timeout <= 0)) {
    throw new Error(`${PREFIX}: ${path}.timeoutMs must be a positive integer`)
  }
  return {
    question,
    choices,
    timeoutMs: timeout ?? DEFAULT_TIMEOUT_MS,
    unavailable: choice(record.unavailable, `${path}.unavailable`),
  }
}

/** Validate one answer choice. */
function choice(value: unknown, path: string): Choice {
  const record = asRecord(value, path)
  for (const key of Object.keys(record)) {
    if (!['label', 'action', 'to'].includes(key)) {
      throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`)
    }
  }
  const label = record.label
  if (typeof label !== 'string' || label.length === 0) {
    throw new Error(`${PREFIX}: ${path}.label must be a non-empty string`)
  }
  const action = member(record.action, CHOICE_ACTIONS, `${path}.action`) as ChoiceAction
  if (action === 'switch') return { label, action, to: route(record.to, `${path}.to`) }
  if (record.to !== undefined) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`)
  return { label, action }
}

/** Validate one `{ provider, model }` route. */
function route(value: unknown, path: string): Route {
  const record = asRecord(value, path)
  for (const key of Object.keys(record)) {
    if (key !== 'provider' && key !== 'model') {
      throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`)
    }
  }
  const provider = record.provider
  const model = record.model
  if (typeof provider !== 'string' || provider.length === 0) {
    throw new Error(`${PREFIX}: ${path}.provider must be a non-empty string`)
  }
  if (typeof model !== 'string' || model.length === 0) {
    throw new Error(`${PREFIX}: ${path}.model must be a non-empty string`)
  }
  return { provider, model }
}

/** Read one optional list of match names; an omitted list matches everything. */
function names(value: unknown, path: string): readonly string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`${PREFIX}: ${path} must be a list of non-empty strings`)
  }
  return value as string[]
}

/** Read one required member of a closed vocabulary. */
function member(value: unknown, allowed: readonly string[], path: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${PREFIX}: ${path} must be one of ${allowed.join(', ')}`)
  }
  return value
}

/** Read one value as a mapping. */
function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${PREFIX}: ${path} must be a mapping`)
  }
  return value as Record<string, unknown>
}
