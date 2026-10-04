/**
 * Local behavioral check for the Host half. It is not part of the harness
 * repository; run it from this package directory:
 *
 *   ../node_modules/.bin/tsx checks/host-smoke.ts
 *
 * It loads `src/index.ts` (no build step) and drives the real `apply` against
 * the shared stub Context: the merged status document, the credential watch's
 * attribution, the renewal schedule's offline-decidable outcomes, the durable
 * session record, the two-factor queue, and every route.
 *
 * The one thing this check cannot do is complete a real sign-in: that chain
 * talks to the school, and there is no offline stand-in for it. The renewal
 * paths exercised here are exactly the ones that never reach the network, plus
 * the one where the network refusing is the expected outcome.
 */

import assert from 'node:assert/strict'
import { apply, isAutomadStatus, resolveOptions } from '../src/index.ts'
import { SessionStore } from '../src/auth/session.ts'
import { probeUpstream } from '../src/auth/verify.ts'
import { RENEW_PATH, SETTINGS_PATH, STATUS_PATH, TWO_FACTOR_PATH } from '../src/protocol.ts'
import { TwoFactorQueue } from '../src/two-factor.ts'
import { call, harness, post, route, settle, token } from './harness.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Rules one case runs on; the policy half is exercised in policy-smoke. */
const RULES = [{ when: { provider: ['tsinghua'], code: ['AUTH'] }, action: 'renew', onFailure: 'fail' }]

/** Configuration with everything but the named overrides at its default. */
const config = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  credentialRef: 'TSINGHUA_API_KEY',
  label: 'Tsinghua DeepSeek',
  rules: RULES,
  ...overrides,
})

// ── the status document ────────────────────────────────────────────────────

{
  const h = harness({
    values: { TSINGHUA_API_KEY: token(Date.now(), Date.now() + 5 * HOUR), MADMODEL_USERNAME: '2023000000', MADMODEL_PASSWORD: 'secret' },
  })
  apply(h.ctx, config())
  await settle()

  const { status, body } = await call(h, STATUS_PATH)
  assert.equal(status, 200)
  assert.ok(isAutomadStatus(body), 'the Host serves a document the browser half accepts')
  assert.equal(body.plugin, 'thu-automad')
  assert.equal((body.token as { state: string }).state, 'ok')
  assert.equal((body.token as { label: string }).label, 'Tsinghua DeepSeek')
  assert.equal((body.auth as { usernameConfigured: boolean }).usernameConfigured, true)
  assert.equal((body.auth as { passwordConfigured: boolean }).passwordConfigured, true)
  assert.equal((body.auth as { deviceName: string }).deviceName, 'dsh-madmodel', 'the device name the chain registers is reported')
  assert.deepEqual((body.auth as { shadowedRefs: string[] }).shadowedRefs, [])
  assert.deepEqual((body.policy as { rules: unknown[] }).rules.length, 1)
  assert.equal((body.renew as { enabled: boolean }).enabled, true)
  assert.equal((body.twoFactor as unknown), null)
  assert.equal(h.routes.length, 4, 'every route is registered once Connection is present')
  assert.ok(h.logs.some(line => line.includes('thu-automad: active')), 'the plugin announces its load')

  // The value itself is never published, under any key.
  const encoded = JSON.stringify(body)
  assert.ok(!encoded.includes('secret'), 'no stored secret reaches the status document')
  assert.ok(!encoded.includes('eyJ'), 'the token value never reaches the status document either')
}

// One URL serves two readers. A browser following the composer pill asks for
// HTML and must get the Chinese table; the browser half's poller asks for JSON
// and must keep getting the document it validates. Both come from the one
// registration, so a change to either representation has to keep the other.
{
  const h = harness({
    values: { TSINGHUA_API_KEY: token(Date.now(), Date.now() + 5 * HOUR), MADMODEL_USERNAME: '2023000000', MADMODEL_PASSWORD: 'secret' },
  })
  apply(h.ctx, config())
  await settle()

  const handle = route(h, STATUS_PATH)
  const navigation = await handle.fetch(new Request(`http://localhost${STATUS_PATH}`, {
    // The exact accept header a browser sends when opening the URL in a tab.
    headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' },
  }))
  assert.equal(navigation.status, 200)
  assert.equal(navigation.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(navigation.headers.get('vary'), 'accept', 'the representation is declared to vary on accept')
  const page = await navigation.text()
  assert.match(page, /^<!doctype html>/u)
  assert.match(page, /<html lang="zh-CN">/u)
  for (const label of ['重试', '切换', '失败', '询问次数', '续期', '策略介绍', '次数']) {
    assert.ok(page.includes(label), `the page words the table in Chinese: ${label}`)
  }
  assert.equal(
    page.match(/<td class="count">0<\/td>/gu)?.length,
    5,
    'every ledger counter has its own row, at zero before any failure is acted on',
  )
  // A browser navigation is not a poll: the page it renders is current as of
  // this read and must not be cached by an intermediary.
  assert.equal(navigation.headers.get('cache-control'), 'no-store')

  const polled = await handle.fetch(new Request(`http://localhost${STATUS_PATH}`, {
    headers: { accept: 'application/json' },
  }))
  assert.match(polled.headers.get('content-type') ?? '', /^application\/json/u)
  assert.ok(isAutomadStatus(await polled.json()), 'the poller still receives the wire document')

  // A request that states no preference is a script or a plain `curl`; JSON is
  // the answer it can parse.
  const bare = await handle.fetch(new Request(`http://localhost${STATUS_PATH}`))
  assert.match(bare.headers.get('content-type') ?? '', /^application\/json/u)

  // The label and the credential reference are deployment-supplied text, so
  // neither may reach the page as markup.
  const escaping = harness({ values: { TSINGHUA_API_KEY: token(Date.now(), Date.now() + 5 * HOUR) } })
  apply(escaping.ctx, config({ label: '<script>alert(1)</script>' }))
  await settle()
  const injected = await (await route(escaping, STATUS_PATH).fetch(new Request(`http://localhost${STATUS_PATH}`, {
    headers: { accept: 'text/html' },
  }))).text()
  assert.ok(!injected.includes('<script>alert(1)</script>'), 'a configured label cannot inject markup')
  assert.ok(injected.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'it is rendered as text instead')
}

// A reference the launching environment pins read-only is reported, because the
// settings page must say so instead of letting a save look successful.
{
  const h = harness({
    values: { TSINGHUA_API_KEY: token(Date.now(), Date.now() + 5 * HOUR), MADMODEL_PASSWORD: 'pinned' },
    shadowed: ['MADMODEL_PASSWORD'],
  })
  apply(h.ctx, config())
  await settle()
  const { body } = await call(h, STATUS_PATH)
  assert.deepEqual((body.auth as { shadowedRefs: string[] }).shadowedRefs, ['MADMODEL_PASSWORD'])
}

// ── the credential watch ───────────────────────────────────────────────────

{
  const h = harness({ values: { TSINGHUA_API_KEY: token(Date.now(), Date.now() + 5 * HOUR) } })
  apply(h.ctx, config())
  await settle()

  const { body: before } = await call(h, STATUS_PATH)
  assert.equal((before.token as { issuedAt: number | null }).issuedAt !== null, true, 'the JWT supplies the issue time')

  // A provider refusal is evidence about the credential, and it outranks the
  // clock: the token still has hours left.
  const listener = h.listeners.get('llm/stream')
  assert.ok(listener !== undefined)
  const refusing = (async function* () { throw Object.assign(new Error('401 from the gateway'), { code: 'AUTH' }) })()
  await assert.rejects(async () => {
    for await (const _ of await listener({ provider: 'tsinghua' } as never, (() => refusing) as never) as AsyncIterable<unknown>) {
      // The refusal is the point.
    }
  })
  const { body: refused } = await call(h, STATUS_PATH)
  assert.equal((refused.token as { state: string }).state, 'rejected')
  assert.match(String((refused.token as { rejectedMessage: string }).rejectedMessage), /401/u)

  // A refusal for a provider this plugin does not watch is not this
  // credential's problem.
  const other = (async function* () { throw Object.assign(new Error('nope'), { code: 'AUTH' }) })()
  await assert.rejects(async () => {
    for await (const _ of await listener({ provider: 'deepseek-official' } as never, (() => other) as never) as AsyncIterable<unknown>) {
      // Ignored on purpose.
    }
  })
  const { body: stillRefused } = await call(h, STATUS_PATH)
  assert.equal((stillRefused.token as { state: string }).state, 'rejected', 'another provider\u2019s refusal changes nothing')

  // A fully consumed stream is proof the credential works, and it retires the
  // refusal it disproves.
  const healthy = (async function* () { yield { type: 'text', text: 'ok' } })()
  const chunks: unknown[] = []
  for await (const chunk of await listener({ provider: 'tsinghua' } as never, (() => healthy) as never) as AsyncIterable<unknown>) {
    chunks.push(chunk)
  }
  assert.equal(chunks.length, 1, 'the watch passes chunks through untouched')
  const { body: cleared } = await call(h, STATUS_PATH)
  assert.equal((cleared.token as { state: string }).state, 'ok', 'a completed request clears the refusal')
  assert.equal((cleared.token as { rejectedAt: number | null }).rejectedAt, null)
}

// Replacing the token is noticed, and it drops a refusal recorded against the
// value that was replaced.
{
  const h = harness({ values: { TSINGHUA_API_KEY: token(Date.now(), Date.now() + HOUR) } })
  apply(h.ctx, config())
  await settle()
  const listener = h.listeners.get('llm/stream')
  const refusing = (async function* () { throw Object.assign(new Error('401'), { code: 'AUTH' }) })()
  await assert.rejects(async () => {
    for await (const _ of await listener?.({ provider: 'tsinghua' } as never, (() => refusing) as never) as AsyncIterable<unknown>) {
      // The refusal is the point.
    }
  })
  h.values.TSINGHUA_API_KEY = token(Date.now() + MINUTE, Date.now() + 7 * HOUR)
  const { body } = await call(h, STATUS_PATH)
  assert.equal((body.token as { state: string }).state, 'ok', 'a replaced token clears the old refusal')
  assert.equal((body.token as { changedAt: number | null }).changedAt !== null, true, 'and the replacement is dated')
}

// The optional probe is a third source of truth, and a 401 from it is a
// refusal; a transport failure is not.
{
  const h = harness({ values: { TSINGHUA_API_KEY: 'not-a-jwt' } })
  apply(h.ctx, config({ probeIntervalMs: 60_000, probeUrl: 'https://gateway.test/health' }))
  await settle()
  assert.equal(h.routes.length, 4)

  const statuses = [401, 200]
  Object.assign(globalThis, {
    fetch: () => Promise.resolve(new Response('', { status: statuses.shift() ?? 200 })),
  })
  await h.runProbe()
  const { body: refused } = await call(h, STATUS_PATH)
  assert.equal((refused.token as { state: string }).state, 'rejected', 'a 401 from the probe is a refusal')

  await h.runProbe()
  const { body: healthy } = await call(h, STATUS_PATH)
  assert.equal((healthy.token as { state: string }).state, 'unknown', 'a 2xx from the probe retires it, leaving the unknown clock')

  Object.assign(globalThis, { fetch: () => Promise.reject(new Error('offline')) })
  await h.runProbe()
  const { body: unreachable } = await call(h, STATUS_PATH)
  assert.equal((unreachable.token as { state: string }).state, 'unknown', 'an unreachable probe invents no failure')
}

// ── the renewal schedule ───────────────────────────────────────────────────

// A token with hours left schedules the next evaluation at its own deadline.
{
  const expiresAt = Date.now() + 5 * HOUR
  const h = harness({ values: { TSINGHUA_API_KEY: token(Date.now(), expiresAt) } })
  apply(h.ctx, config())
  await settle()
  const { body } = await call(h, STATUS_PATH)
  const renew = body.renew as { phase: string; nextAttemptAt: number }
  const tokenStatus = body.token as { expiresAt: number }
  assert.equal(renew.phase, 'scheduled')
  assert.equal(renew.nextAttemptAt, tokenStatus.expiresAt - HOUR, 'the schedule is the expiry less the renewal advance')
  assert.equal(tokenStatus.expiresAt, Math.round(expiresAt / 1000) * 1000, 'the deadline comes from the token\u2019s own claim')
}

// A token inside the advance window but with no stored identity cannot renew:
// that is a human's to fix, and it is reported as such rather than retried.
{
  const h = harness({ values: { TSINGHUA_API_KEY: token(Date.now() - 5 * HOUR, Date.now() + 5 * MINUTE) } })
  apply(h.ctx, config())
  await settle()
  const { body } = await call(h, STATUS_PATH)
  const renew = body.renew as { phase: string; lastCode: string; lastMessage: string }
  assert.equal(renew.phase, 'needs-human')
  assert.equal(renew.lastCode, 'NO_CREDENTIALS')
  assert.match(renew.lastMessage, /MADMODEL_USERNAME/u, 'the message names the references to fill in')
  assert.equal((body.twoFactor as unknown), null, 'a missing identity is not a two-factor question')
}

// With an identity stored, the attempt reaches the network; a refusing network
// is an `error` to retry, never a `needs-human`.
{
  Object.assign(globalThis, { fetch: () => Promise.reject(new Error('offline')) })
  const h = harness({
    values: {
      TSINGHUA_API_KEY: token(Date.now() - 5 * HOUR, Date.now() + 5 * MINUTE),
      MADMODEL_USERNAME: '2023000000',
      MADMODEL_PASSWORD: 'secret',
    },
  })
  apply(h.ctx, config())
  await settle()
  const { body } = await call(h, STATUS_PATH)
  const renew = body.renew as { phase: string; lastCode: string; nextAttemptAt: number }
  assert.equal(renew.phase, 'error')
  assert.equal(renew.lastCode, 'NETWORK_ERROR')
  assert.ok(renew.nextAttemptAt > Date.now(), 'a failure earns a retry in the future, not a busy loop')
}

// The schedule can be switched off, and then it says so instead of pretending
// to be idle.
{
  const h = harness({ values: { TSINGHUA_API_KEY: token(Date.now(), Date.now() + 5 * MINUTE) } })
  apply(h.ctx, config({ autoRenew: false }))
  await settle()
  const { body } = await call(h, STATUS_PATH)
  assert.equal((body.renew as { phase: string }).phase, 'off')
  assert.equal((body.renew as { enabled: boolean }).enabled, false)
}

// A manual trigger clears the backoff a previous failure earned, so a person
// who just fixed the cause is not made to wait it out.
{
  const h = harness({ values: { TSINGHUA_API_KEY: token(Date.now() - 5 * HOUR, Date.now() + 5 * MINUTE) } })
  apply(h.ctx, config())
  await settle()
  const { body } = await post(h, RENEW_PATH, {})
  assert.equal(body.ok, true)
  assert.equal(body.renewed, false)
  assert.equal(body.code, 'NO_CREDENTIALS', 'the trigger reports what the attempt concluded')
}

// ── the durable session record ─────────────────────────────────────────────

{
  const h = harness()
  apply(h.ctx, config())
  await settle()
  const store = new SessionStore(h.ctx)

  const empty = await store.read()
  assert.deepEqual(empty, { fingerprint: null, lastRenewAt: null, lastExpiresAt: null, twoFactorAt: null, unattendedRenewals: 0 })

  let generated = 0
  const first = await store.ensureFingerprint(() => { generated += 1; return 'a'.repeat(32) })
  assert.equal(first, 'a'.repeat(32))
  assert.equal(generated, 1)
  const again = await store.ensureFingerprint(() => { generated += 1; return 'b'.repeat(32) })
  assert.equal(again, 'a'.repeat(32), 'an existing fingerprint is reused, never rotated')
  assert.equal(generated, 1, 'and no replacement is even generated')

  await store.write({ lastRenewAt: 123, unattendedRenewals: 3 })
  const facts = await store.read()
  assert.equal(facts.lastRenewAt, 123)
  assert.equal(facts.unattendedRenewals, 3)
  assert.equal(facts.fingerprint, 'a'.repeat(32), 'a patch leaves the other fields alone')

  // A hand-edited document must degrade rather than feed a malformed
  // fingerprint to the login chain.
  h.records['thu-automad/session'] = { kind: 'grant', payload: { fingerprint: 'not-a-fingerprint', unattendedRenewals: -4 } }
  const repaired = await store.read()
  assert.equal(repaired.fingerprint, null)
  assert.equal(repaired.unattendedRenewals, 0)

  h.records['thu-automad/session'] = { kind: 'api-key', key: 'nonsense' }
  assert.equal((await store.read()).fingerprint, null, 'a record of the wrong kind is ignored')
}

// ── the two-factor queue ───────────────────────────────────────────────────

{
  let clock = 1_000
  const queue = new TwoFactorQueue(5 * MINUTE, () => clock)
  const handler = queue.handler()

  assert.equal(queue.snapshot(), null)

  const method = handler({ stage: 'method', methods: ['wechat', 'totp'], phone: null })
  const raised = queue.snapshot()
  assert.equal(raised?.stage, 'method')
  assert.deepEqual(raised?.methods, ['wechat', 'totp'])
  assert.equal(raised?.expiresAt, 1_000 + 5 * MINUTE)

  assert.equal(queue.answer({ stage: 'code', code: '123456' }), 'stale', 'an answer for the other stage is refused')
  assert.equal(queue.answer({ stage: 'method', method: 'sms', trustDevice: true }), 'invalid', 'a method the school never offered is refused')
  assert.equal(queue.answer({ stage: 'method', method: 'wechat', trustDevice: false }), 'accepted')
  assert.deepEqual(await method, { method: 'wechat', trustDevice: false })
  assert.equal(queue.snapshot(), null, 'an answered question stops being published')
  assert.equal(queue.answer({ stage: 'method', method: 'wechat', trustDevice: true }), 'none', 'and cannot be answered twice')

  const code = handler({ stage: 'code', method: 'totp' })
  assert.equal(queue.answer({ stage: 'code', code: '12345' }), 'invalid', 'a short code is refused')
  assert.equal(queue.answer({ stage: 'code', code: '123456' }), 'accepted')
  assert.equal(await code, '123456')

  const cancelled = handler({ stage: 'code', method: 'totp' })
  assert.equal(queue.answer({ stage: 'cancel' }), 'accepted')
  assert.equal(await cancelled, '', 'cancelling settles with the empty answer the chain reads as give-up')

  // The timeout is what keeps a renewal from hanging forever when nobody is
  // looking; it settles with the same give-up answer. A second queue carries a
  // millisecond budget so the check does not wait out the real one.
  const impatient = new TwoFactorQueue(20, () => clock)
  const abandoned = impatient.handler()({ stage: 'method', methods: ['totp'], phone: null })
  assert.equal(impatient.snapshot()?.stage, 'method')
  assert.equal(await abandoned, '', 'an unanswered question gives up on its own')
  assert.equal(impatient.snapshot(), null, 'and stops being published')
}

// ── the settings route ─────────────────────────────────────────────────────

{
  const h = harness()
  apply(h.ctx, config())
  await settle()

  const saved = await post(h, SETTINGS_PATH, { username: ' 2023000000 ', password: 'hunter2' })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.ok, true)
  assert.deepEqual(saved.body.errors, [])
  assert.equal(h.values.MADMODEL_USERNAME, '2023000000', 'the student id is stored trimmed')
  assert.equal(h.values.MADMODEL_PASSWORD, 'hunter2')
  assert.equal((saved.body.auth as { usernameConfigured: boolean }).usernameConfigured, true)

  // An omitted field is left alone; null clears it, rather than storing an
  // empty value the seam would read as absent anyway.
  const cleared = await post(h, SETTINGS_PATH, { password: null })
  assert.equal(cleared.body.ok, true)
  assert.equal(h.values.MADMODEL_PASSWORD, undefined)
  assert.equal(h.values.MADMODEL_USERNAME, '2023000000', 'the untouched field survives')
  const blank = await post(h, SETTINGS_PATH, { username: '   ' })
  assert.equal(blank.body.ok, true)
  assert.equal(h.values.MADMODEL_USERNAME, undefined, 'whitespace clears rather than stores')

  const malformed = await post(h, SETTINGS_PATH, { username: 42 })
  assert.equal(malformed.status, 400)
  assert.equal(malformed.body.ok, false)

  const notJson = await call(h, SETTINGS_PATH, { method: 'POST', body: 'not json' })
  assert.equal(notJson.status, 400, 'a body that is not JSON is refused rather than throwing')

  // A reference the launching environment pins read-only is reported with the
  // code the page renders localized copy from.
  h.shadowed.add('MADMODEL_PASSWORD')
  const refused = await post(h, SETTINGS_PATH, { password: 'cannot-write' })
  assert.equal(refused.body.ok, false)
  const errors = refused.body.errors as { field: string; code: string; message: string }[]
  assert.equal(errors[0]?.field, 'password')
  assert.equal(errors[0]?.code, 'shadowed')
  assert.match(errors[0]?.message ?? '', /read-only by the launching environment/u)
}

// ── the two-factor route ───────────────────────────────────────────────────

{
  const h = harness()
  apply(h.ctx, config())
  await settle()
  const none = await post(h, TWO_FACTOR_PATH, { stage: 'method', method: 'totp', trustDevice: true })
  assert.equal(none.status, 409, 'an answer with no outstanding question is a conflict, not a silent success')
  assert.equal(none.body.ok, false)

  const malformed = await post(h, TWO_FACTOR_PATH, { stage: 'code' })
  assert.equal(malformed.status, 400)

  const cancelled = await post(h, TWO_FACTOR_PATH, { stage: 'cancel' })
  assert.equal(cancelled.status, 409)
}

// ── the upstream probe's classification ────────────────────────────────────

{
  const probe = async (init: ResponseInit, body = ''): Promise<Awaited<ReturnType<typeof probeUpstream>>> => {
    Object.assign(globalThis, { fetch: () => Promise.resolve(new Response(body, init)) })
    return await probeUpstream({ token: 't', model: 'm' })
  }

  assert.equal((await probe({ status: 200 }, JSON.stringify({ choices: [{ message: {} }], usage: { total_tokens: 1 } }))).verdict, 'ok')
  assert.equal((await probe({ status: 401 })).verdict, 'rejected')
  assert.equal((await probe({ status: 403 })).verdict, 'rejected')
  assert.equal((await probe({ status: 302, headers: { location: '/login' } })).verdict, 'session')
  const business = await probe({ status: 200 }, JSON.stringify({ data: null, status: 10003, message: '抱歉哦，您无此权限！', success: false }))
  assert.equal(business.verdict, 'rejected', 'a refusal carried in a 200 body is still a refusal')
  assert.equal(business.code, 10003)
  assert.equal((await probe({ status: 200 }, 'not json')).verdict, 'other')
  Object.assign(globalThis, { fetch: () => Promise.reject(new Error('offline')) })
  const offline = await probeUpstream({ token: 't', model: 'm' })
  assert.equal(offline.verdict, 'network', 'a transport failure is never a claim about the credential')
}

// ── configuration validation ───────────────────────────────────────────────

assert.throws(() => resolveOptions({ rules: RULES, autoRenew: 'yes' }), /autoRenew must be a boolean/u)
assert.throws(() => resolveOptions({ rules: RULES, twoFactorTimeoutMs: 0 }), /twoFactorTimeoutMs must be positive/u)
assert.throws(() => resolveOptions({ rules: RULES, verifyModel: '' }), /verifyModel must not be empty/u)
assert.equal(resolveOptions({ rules: RULES }).renew.verifyAfterRenew, true)
assert.equal(resolveOptions({ rules: RULES }).auth.tunnel, false)
assert.equal(resolveOptions({ rules: RULES }).renew.refreshAheadMs, HOUR)

console.log('host-smoke: ok')
