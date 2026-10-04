/**
 * Local behavioral check for the merged failure policy. It is not part of the
 * harness repository; run it from this package directory:
 *
 *   ../node_modules/.bin/tsx checks/policy-smoke.ts
 *
 * It loads `src/index.ts` (no build step) and drives the real listeners against
 * the shared stub Context, so rule matching, delegation, the short-circuiting
 * `fail`, the two-event switch, `afterRetries`, the `ask` fallbacks, and the
 * new `renew` action are exercised rather than described.
 */

import assert from 'node:assert/strict'
import { apply, resolveOptions, resolveRules } from '../src/index.ts'
import { STEP, TURN, failure, fire, harness, settle, token } from './harness.ts'

const HOUR = 3_600_000

/** A token that is comfortably valid, so the renewal schedule stays idle. */
const FRESH = token(Date.now(), Date.now() + 5 * HOUR)

/** Configuration one case runs on; every field but `rules` keeps its default. */
const config = (rules: unknown): Record<string, unknown> => ({ credentialRef: 'TSINGHUA_API_KEY', rules })

/** Apply the plugin to a fresh harness holding one valid token. */
async function boot(rules: unknown, options: Parameters<typeof harness>[0] = {}): Promise<ReturnType<typeof harness>> {
  const h = harness({ values: { TSINGHUA_API_KEY: FRESH }, ...options })
  apply(h.ctx, config(rules))
  await settle()
  return h
}

// ── rule validation ────────────────────────────────────────────────────────

assert.deepEqual(resolveRules([]), [], 'an empty list disables the policy half')
assert.throws(() => resolveRules(undefined), /rules is required/u)
assert.throws(() => resolveRules({}), /must be a list/u)
assert.throws(() => resolveRules([{ action: 'fail', surprise: 1 }]), /unknown key "surprise"/u)
assert.throws(() => resolveRules([{ when: { model: 'x' }, action: 'fail' }]), /when: unknown key "model"/u)
assert.throws(() => resolveRules([{ action: 'nope' }]), /must be one of retry, switch, fail, ask, renew/u)
assert.throws(() => resolveRules([{ action: 'switch' }]), /\.to must be a mapping/u)
assert.throws(() => resolveRules([{ action: 'switch', to: { provider: 'p', model: 'm' }, ask: {} }]), /ask is only valid for action "ask"/u)
assert.throws(() => resolveRules([{ action: 'fail', to: { provider: 'p', model: 'm' } }]), /to is only valid for action "switch"/u)
assert.throws(() => resolveRules([{ action: 'ask', ask: { question: 'q', choices: [] } }]), /choices must be a non-empty list/u)
assert.throws(
  () => resolveRules([{
    action: 'ask',
    ask: { question: 'q', choices: [{ label: 'a', action: 'retry' }, { label: 'a', action: 'fail' }], unavailable: { label: 'u', action: 'fail' } },
  }]),
  /labels must be unique/u,
)
// A switch is decided per failure and never remembered, so the field that once
// carried that memory is gone rather than silently accepted.
assert.throws(() => resolveRules([{ action: 'fail', cooldownMs: 300_000 }]), /unknown key "cooldownMs"/u)
assert.throws(() => resolveRules([{ action: 'fail', afterRetries: 1.5 }]), /afterRetries must be a non-negative integer/u)

// The renew action's own contract: a fallback is mandatory, and only the
// fallback's own shape is allowed.
assert.throws(() => resolveRules([{ action: 'renew' }]), /onFailure is required for action "renew"/u)
assert.throws(() => resolveRules([{ action: 'renew', onFailure: 'renew' }]), /onFailure must be one of retry, switch, fail, ask/u)
assert.throws(() => resolveRules([{ action: 'renew', onFailure: 'switch' }]), /\.to must be a mapping/u)
assert.throws(() => resolveRules([{ action: 'renew', onFailure: 'ask' }]), /ask must be a mapping/u)
assert.throws(
  () => resolveRules([{ action: 'fail', onFailure: 'fail' }]),
  /onFailure is only valid for action "renew"/u,
)

// A `renew` rule for a provider this plugin does not watch can never succeed,
// so it must fail at load rather than wait out a timeout on every failure.
assert.throws(
  () => resolveOptions(config([{ when: { provider: ['elsewhere'] }, action: 'renew', onFailure: 'fail' }])),
  /must name a watched provider/u,
)
assert.throws(
  () => resolveOptions(config([{ action: 'renew', onFailure: 'fail' }])),
  /must name a watched provider/u,
)
assert.throws(() => resolveOptions({ rules: [{ action: 'fail' }], nope: 1 }), /unknown config key "nope"/u)
assert.throws(() => resolveOptions({ rules: [{ action: 'fail' }], credentialRef: '1BAD' }), /must be an environment-variable name/u)
assert.throws(
  () => resolveOptions({ rules: [{ action: 'fail' }], warnBeforeMs: HOUR, refreshAheadMs: 60_000 }),
  /refreshAheadMs must be 0 \(disabled\) or at least warnBeforeMs/u,
)
assert.throws(() => resolveOptions({ rules: [{ action: 'fail' }], probeIntervalMs: 1000, probeUrl: 'https://x.test' }), /at least 60000/u)
assert.throws(() => resolveOptions({ rules: [{ action: 'fail' }], probeIntervalMs: 60_000 }), /probeUrl is required/u)
assert.throws(() => resolveOptions({ rules: [{ action: 'fail' }], checkIntervalMs: 1 }), /checkIntervalMs must be at least/u)

// ── the short-circuiting fail ──────────────────────────────────────────────

{
  const h = await boot([{ when: { code: ['AUTH'] }, action: 'fail' }])
  const { result, delegated } = await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve('downstream'))
  assert.equal(result, undefined, 'fail resolves with no action')
  assert.equal(delegated, 0, 'fail never delegates: a rule that says give up must not be retried by anyone else')
}

// ── retry delegation and the single self-granted attempt ───────────────────

{
  const h = await boot([{ when: { code: ['SERVER'] }, action: 'retry' }])
  const downstream = await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve({ kind: 'retry' }))
  assert.deepEqual(downstream.result, { kind: 'retry' }, 'retry passes the downstream answer through')
  assert.equal(downstream.delegated, 1)

  const exhausted = await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  assert.deepEqual(exhausted.result, { kind: 'retry' }, 'a spent retry budget earns one plugin-owned attempt')
  const again = await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  assert.equal(again.result, undefined, 'the plugin-owned attempt is granted at most once per step')
}

// ── the two-event switch ───────────────────────────────────────────────────

{
  const target = { provider: 'deepseek-official', model: 'deepseek-flash' }
  const h = await boot([{ when: { provider: ['tsinghua'] }, action: 'switch', to: target }])
  const decided = await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  assert.deepEqual(decided.result, { kind: 'retry' }, 'a switch grants the attempt that applies it')

  const applied = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'old' }))
  assert.deepEqual(applied.result, { ...target }, 'the recorded route replaces the provider and model')
  const consumed = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'old' }))
  assert.deepEqual(consumed.result, { provider: 'tsinghua', model: 'old' }, 'an override is consumed once')
}

// A switch to the route that was already in use changes nothing and must not
// be reported as a change.
{
  const h = await boot([{ when: { provider: ['tsinghua'] }, action: 'switch', to: { provider: 'tsinghua', model: 'same' } }])
  await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  const applied = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'same' }))
  assert.deepEqual(applied.result, { provider: 'tsinghua', model: 'same' }, 'an identical route is returned unchanged')
}

// A switch is not a repeat of the request that failed, so it must still apply
// when an earlier recovery of the same step already spent the plain-retry slot.
{
  const target = { provider: 'deepseek-official', model: 'deepseek-flash' }
  const h = await boot([
    { when: { code: ['SERVER'] }, action: 'retry' },
    { when: { code: ['AUTH'] }, action: 'switch', to: target },
  ])
  const spent = await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  assert.deepEqual(spent.result, { kind: 'retry' }, 'the earlier failure spends the plain retry')

  const switched = await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve(undefined))
  assert.deepEqual(switched.result, { kind: 'retry' }, 'a switch decided afterwards still earns its own attempt')

  const applied = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'old' }))
  assert.deepEqual(applied.result, target, 'and the chosen route actually changes')

  const again = await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve(undefined))
  assert.equal(again.result, undefined, 'switching to one target is still granted at most once per step')
}

// ── afterRetries ───────────────────────────────────────────────────────────

{
  const h = await boot([{
    when: { provider: ['tsinghua'], code: ['PI_AI_ERROR'] },
    action: 'fail',
    afterRetries: 2,
  }])
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const delegated = await fire(h, 'agent/request-error', failure('tsinghua', 'PI_AI_ERROR'), () => Promise.resolve(undefined))
    assert.equal(delegated.delegated, 1, `failure ${String(attempt)} within the budget is left to the retry owner`)
    assert.equal(delegated.result, undefined)
  }
  const acted = await fire(h, 'agent/request-error', failure('tsinghua', 'PI_AI_ERROR'), () => Promise.resolve(undefined))
  assert.equal(acted.delegated, 0, 'the failure past the budget is the rule\u2019s to answer')
  assert.equal(acted.result, undefined, 'and this rule answers it with fail')

  // The count is per turn and step, so a different step starts over.
  const otherStep = await fire(h, 'agent/request-error', failure('tsinghua', 'PI_AI_ERROR', STEP + 1), () => Promise.resolve(undefined))
  assert.equal(otherStep.delegated, 1, 'the budget is counted per step')
}

// ── nothing is remembered between failures ─────────────────────────────────

// An answered switch applies to the step that needed it and is forgotten
// afterwards: the next failure on the same provider walks the rules again and
// asks, rather than silently reusing the route the human picked last time.
{
  const target = { provider: 'deepseek-official', model: 'deepseek-flash' }
  const h = await boot([{
    when: { provider: ['tsinghua'] },
    action: 'ask',
    ask: {
      question: 'q',
      choices: [{ label: 'switch away', action: 'switch', to: target }],
      unavailable: { label: 'fail', action: 'fail' },
    },
  }])
  h.answer = { selected: ['switch away'] }
  const first = await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  assert.deepEqual(first.result, { kind: 'retry' }, 'the answered switch grants this step its attempt')
  assert.equal(h.asked.length, 1, 'the first failure asks')

  const second = await fire(h, 'agent/request-error', failure('tsinghua', 'TRANSPORT', STEP + 1), () => Promise.resolve(undefined))
  assert.equal(h.asked.length, 2, 'the next failure asks again instead of reusing the remembered switch')
  assert.deepEqual(second.result, { kind: 'retry' }, 'and the fresh answer decides it')
}

// The reported sequence, end to end with the shipped rule shapes: an unanswered
// SERVER/TRANSPORT question falls back to its configured switch, and the next
// PI_AI_ERROR failure still has to ask once its retry budget is spent instead of
// inheriting that route.
{
  const away = { provider: 'deepseek-official', model: 'deepseek-flash' }
  const h = await boot([
    {
      when: { provider: ['tsinghua'], code: ['SERVER', 'TRANSPORT'] },
      action: 'ask',
      ask: { question: 'q', choices: [{ label: 'switch', action: 'switch', to: away }], unavailable: { label: 'auto switch', action: 'switch', to: away } },
    },
    {
      when: { provider: ['tsinghua'], code: ['PI_AI_ERROR'] },
      action: 'ask',
      afterRetries: 5,
      ask: { question: 'q', choices: [{ label: 'switch', action: 'switch', to: away }], unavailable: { label: 'give up', action: 'fail' } },
    },
  ], { withQuestions: false })

  await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  const firstStep = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'x' }))
  assert.deepEqual(firstStep.result, away, 'an unanswered question falls back to its configured switch')

  const nextStep = STEP + 1
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const delegated = await fire(h, 'agent/request-error', failure('tsinghua', 'PI_AI_ERROR', nextStep), () => Promise.resolve(undefined))
    assert.equal(delegated.delegated, 1, `attempt ${String(attempt)} stays with the retry owner`)
  }
  const past = await fire(h, 'agent/request-error', failure('tsinghua', 'PI_AI_ERROR', nextStep), () => Promise.resolve(undefined))
  assert.equal(past.result, undefined, 'the failure past the budget gives up rather than reusing the earlier switch')
  const secondStep = await fire(h, 'agent/request', { turn: TURN, step: nextStep }, () => Promise.resolve({ provider: 'tsinghua', model: 'x' }))
  assert.deepEqual(secondStep.result, { provider: 'tsinghua', model: 'x' }, 'no model was switched behind the human')
}

// ── ask, and every way it falls back ───────────────────────────────────────

/** One rule whose question offers a switch and a retry. */
const ASK_RULE = [{
  when: { provider: ['tsinghua'] },
  action: 'ask',
  ask: {
    question: '{provider} failed with {code}: {message}',
    choices: [
      { label: 'switch', action: 'switch', to: { provider: 'deepseek-official', model: 'deepseek-flash' } },
      { label: 'keep trying', action: 'retry' },
    ],
    timeoutMs: 1000,
    unavailable: { label: 'auto', action: 'switch', to: { provider: 'deepseek-official', model: 'deepseek-flash' } },
  },
}]

{
  const h = await boot(ASK_RULE)
  h.answer = { selected: ['keep trying'] }
  await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  assert.equal(h.asked.length, 1)
  assert.equal(h.asked[0]?.question, 'tsinghua failed with SERVER: tsinghua answered SERVER', 'the question substitutes its placeholders')
  assert.deepEqual(h.asked[0]?.optionLabels, ['switch', 'keep trying'])
  const applied = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'x' }))
  assert.deepEqual(applied.result, { provider: 'tsinghua', model: 'x' }, 'an answered retry records no route override')
}

{
  const h = await boot(ASK_RULE)
  h.answer = { selected: ['switch'] }
  await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  const applied = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'x' }))
  assert.deepEqual(applied.result, { provider: 'deepseek-official', model: 'deepseek-flash' }, 'an answered switch takes effect')
}

for (const [name, answer, options] of [
  ['no question service', { selected: ['switch'] }, { withQuestions: false }],
  ['a rejected question', new Error('no answerer'), {}],
  ['an unrecognized answer', { selected: ['not an option'] }, {}],
] as const) {
  const h = await boot(ASK_RULE, options)
  h.answer = answer
  await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve(undefined))
  const applied = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'x' }))
  assert.deepEqual(applied.result, { provider: 'deepseek-official', model: 'deepseek-flash' }, `${name} falls back to unavailable`)
}

// ── the renew action ───────────────────────────────────────────────────────

// With no stored identity there is nothing to sign in with, so a `renew` rule
// must fall through to its configured fallback rather than hold the waterfall.
{
  const h = await boot([{ when: { provider: ['tsinghua'], code: ['AUTH'] }, action: 'renew', onFailure: 'fail' }])
  const { result, delegated } = await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve('downstream'))
  assert.equal(result, undefined, 'a renewal that cannot run falls back to fail')
  assert.equal(delegated, 0, 'and the fallback short-circuits like any other fail')
  const status = await import('../src/protocol.ts')
  assert.equal(typeof status.isAutomadStatus, 'function')
}

{
  const h = await boot([{ when: { provider: ['tsinghua'], code: ['AUTH'] }, action: 'renew', onFailure: 'retry' }])
  const { result, delegated } = await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve({ kind: 'retry' }))
  assert.deepEqual(result, { kind: 'retry' }, 'a renew fallback of retry delegates to the retry owner')
  assert.equal(delegated, 1)
}

{
  const h = await boot([{ when: { provider: ['tsinghua'], code: ['AUTH'] }, action: 'renew', onFailure: 'ask', ask: {
    question: 'renewal needs you',
    choices: [{ label: 'give up', action: 'fail' }],
    unavailable: { label: 'give up', action: 'fail' },
  } }])
  h.answer = { selected: ['give up'] }
  await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve(undefined))
  assert.equal(h.asked.length, 1, 'a renew fallback of ask reaches the human')
  assert.equal(h.asked[0]?.question, 'renewal needs you')
}

{
  const h = await boot([{ when: { provider: ['tsinghua'], code: ['AUTH'] }, action: 'renew', onFailure: 'switch', to: { provider: 'deepseek-official', model: 'deepseek-flash' } }])
  await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve(undefined))
  const applied = await fire(h, 'agent/request', { turn: TURN, step: STEP }, () => Promise.resolve({ provider: 'tsinghua', model: 'x' }))
  assert.deepEqual(applied.result, { provider: 'deepseek-official', model: 'deepseek-flash' }, 'a renew fallback of switch takes effect')
}

// The action is recorded beside the outcome: a renewal that needed a human ends
// in whatever `onFailure` named, so the action counts alone would hide it.
{
  const h = await boot([{ when: { provider: ['tsinghua'], code: ['AUTH'] }, action: 'renew', onFailure: 'fail' }])
  await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve(undefined))
  const { body } = await (await import('./harness.ts')).call(h, '/api/thu-automad/status')
  const policy = body.policy as { counts: Record<string, number> }
  assert.equal(policy.counts.renew, 1, 'the renewal attempt is counted')
  assert.equal(policy.counts.fail, 1, 'and so is the action it fell back to')
}

// ── first match wins ───────────────────────────────────────────────────────

{
  const h = await boot([
    { when: { provider: ['tsinghua'] }, action: 'fail' },
    { when: { code: ['AUTH'] }, action: 'retry' },
  ])
  const first = await fire(h, 'agent/request-error', failure('tsinghua', 'AUTH'), () => Promise.resolve('downstream'))
  assert.equal(first.result, undefined, 'the earlier matching rule wins')
  assert.equal(first.delegated, 0)
}

// An unmatched failure belongs entirely to whatever else owns recovery.
{
  const h = await boot([{ when: { provider: ['elsewhere'] }, action: 'fail' }])
  const { result, delegated } = await fire(h, 'agent/request-error', failure('tsinghua', 'SERVER'), () => Promise.resolve('downstream'))
  assert.equal(result, 'downstream', 'an unmatched failure is delegated untouched')
  assert.equal(delegated, 1)
}

// ── the watch's own feed into the policy ───────────────────────────────────

{
  const h = await boot([{ when: { code: ['AUTH'] }, action: 'retry' }])
  const listener = h.listeners.get('llm/stream')
  assert.ok(listener !== undefined, 'the credential watch observes provider streams')
  const refusing = (async function* () {
    throw Object.assign(new Error('refused'), { code: 'AUTH', status: 401 })
  })()
  await assert.rejects(async () => {
    for await (const _chunk of await listener({ provider: 'tsinghua' } as never, (() => refusing) as never) as AsyncIterable<unknown>) {
      // The refusal is the point of this stream.
    }
  })
  await settle()
  const { body } = await (await import('./harness.ts')).call(h, '/api/thu-automad/status')
  assert.equal((body.token as { state: string }).state, 'rejected', 'a provider refusal is attributed to the credential')
}

console.log('policy-smoke: ok')
