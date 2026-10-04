/**
 * Host half of the Tsinghua MadModel automation plugin.
 *
 * Three capabilities that share one failure site are composed here:
 *
 * - **Watch** (`src/watch.ts`): what the stored credential says about itself,
 *   how much lifetime it has left, and whether the gateway has refused it.
 * - **Renew** (`src/renew.ts`): when that lifetime runs short, log in through
 *   the vendored authentication chain and write the replacement token.
 * - **Policy** (`src/policy/`): what a model request does when it fails — retry,
 *   switch, ask, give up, or, for a provider this plugin can re-authenticate,
 *   renew first and retry.
 *
 * They are one plugin because they are one decision. Separately, the watch sees
 * a 401 but cannot repair it, the policy sees a failure but cannot tell an
 * expired token from a truncated stream, and the renewal never learns that a
 * request just failed. Together, `{code: [AUTH]} → renew` becomes expressible:
 * re-authenticate on the spot, retry if it worked, ask a human only if it did
 * not.
 *
 * The browser half is reached through exact Fetch routes on the Host
 * Connection: one read-only status document, one two-factor answer, one manual
 * renewal trigger. The credential form itself writes through the shipped
 * `credentials` Remote namespace, so no route of ours touches a secret.
 * @module dsh-thu-automad
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent, RequestErrorAction } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import type { GenerateOptions, LlmCallConfig, StreamChunk } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-user-questions'
import { DEVICE_NAME } from './auth/chain.ts'
import { resolveOptions } from './config.ts'
import type { AutomadOptions } from './config.ts'
import { matchRule, resolutionOf, stepKey, substitute, StepRoutes } from './policy/policy.ts'
import type { AskSpec, Choice, Resolution, Route, Rule } from './policy/config.ts'
import { StatusLedger } from './policy/status.ts'
import { RENEW_PATH, SETTINGS_PATH, STATUS_PATH, TWO_FACTOR_PATH } from './protocol.ts'
import type {
  ActionOutcome, AuthConfigStatus, AuthSettingsRequest, AutomadStatus, SettingsFieldError, SettingsOutcome, TwoFactorAnswer,
} from './protocol.ts'
import { Renewer } from './renew.ts'
import { TokenWatch } from './watch.ts'

export { resolveOptions } from './config.ts'
export { readTokenTimes } from './jwt.ts'
export { isAuthRefusal } from './watch.ts'
export { resolveRules } from './policy/config.ts'
export { matchRule, stepKey } from './policy/policy.ts'
export { SETTINGS_PATH, STATUS_PATH, TWO_FACTOR_PATH, RENEW_PATH, isAutomadStatus, isTokenStatus, routeOf } from './protocol.ts'
export type { AuthOptions, AutomadOptions, ProbeOptions, RenewOptions, TokenWatchOptions } from './config.ts'
export type { AskSpec, Choice, ChoiceAction, Resolution, Route, Rule, RuleAction } from './policy/config.ts'
export type { DecisionCounts, LastDecision, RuleSummary, StatusSnapshot } from './policy/status.ts'
export type { AutomadStatus, AuthConfigStatus, RenewPhase, RenewStatus, TokenState, TokenStatus, TwoFactorAnswer, TwoFactorPrompt } from './protocol.ts'
export type { TokenTimes } from './jwt.ts'
export type { SessionFacts } from './auth/session.ts'
export type { LoginOutcome, TicketSource } from './auth/login.ts'
export type { ProbeResult, ProbeVerdict } from './auth/verify.ts'

/** Cordis plugin name; the browser half uses the same string. */
export const name = 'thu-automad'

/** The credentials seam is required; Connection is read only when it is present. */
export const inject = ['credentials']

/** Stable id the asked question is answered by. */
const QUESTION_ID = 'thu-automad'

/** Renewal budget the failure waterfall grants one `renew` action, in milliseconds. */
const BUDGET_MS = 5 * 60 * 1000

/** The part of one failed-request payload a decision reads. */
interface FailureFacts {
  /** Agent whose request failed; it carries the session a question is asked on. */
  agent: Agent
  /** Provider route the failed request targeted. */
  provider: string
  /** Turn cancellation lifetime. */
  signal: AbortSignal
  /** Normalized failure facts. */
  failure: { code: string; message: string }
}

/** One decided failure. */
interface Decision {
  /** What the policy will do. */
  resolution: Resolution
  /** Whether the human answered rather than the rule alone. */
  asked: boolean
}

/**
 * Apply the credential watch, the renewal schedule, and the failure policy.
 * @param ctx - plugin context; the connection and question services are read optionally.
 * @param config - raw `config` mapping from cordis.yml; validated here.
 */
export function apply(ctx: Context, config: unknown): void {
  const options = resolveOptions(config)
  const watch = new TokenWatch(ctx, options)
  const renewer = new Renewer(ctx, options)
  const steps = new StepRoutes()
  const ledger = new StatusLedger()
  const providers = new Set(options.providers)

  ctx.effect(() => {
    // Read once at load so a token that is already due renews before the first
    // interval elapses.
    void renewer.tick()
    const timer = setInterval(() => { void renewer.tick() }, options.renew.checkIntervalMs)
    return () => {
      clearInterval(timer)
      renewer.stop()
    }
  }, 'thu-automad: renewal schedule')

  // The optional authenticated probe. It exists for a credential that is not a
  // JWT and therefore states no expiry, where neither the clock nor a refusal
  // can say whether it is still good.
  if (options.probe !== undefined) {
    const { intervalMs } = options.probe
    ctx.effect(() => {
      // Read once at load so a credential that is already dead is known before
      // the first interval.
      void watch.probe()
      const timer = setInterval(() => { void watch.probe() }, intervalMs)
      return () => { clearInterval(timer) }
    }, 'thu-automad: credential probe')
  }

  // Connection may activate after this plugin does, and `ctx.get` reads once
  // rather than waiting. A composition without Connection still gets the watch,
  // the schedule, and the policy; it only loses the browser reach.
  ctx.inject(['connection'], (routeCtx) => {
    routeCtx.effect(
      () => registerRoutes(routeCtx, options, watch, renewer, ledger),
      'thu-automad: routes',
    )
    routeCtx.logger.info(`thu-automad: routes at ${STATUS_PATH}, ${SETTINGS_PATH}, ${TWO_FACTOR_PATH}, ${RENEW_PATH}`)
  })

  // Every model request to a watched provider is evidence about the token: a
  // refusal records it, and a clean completion retires an earlier one.
  ctx.on('llm/stream', (request: GenerateOptions, next: () => AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk> => {
    const stream = next()
    return providers.has(request.provider) ? watchStream(watch, request.provider, stream) : stream
  }, { global: true })

  ctx.on('agent/request-error', async (payload, next): Promise<RequestErrorAction> => {
    const rule = matchRule(options.rules, payload.provider, payload.failure.code)
    // An unmatched failure belongs entirely to whatever else owns recovery.
    if (rule === undefined) return await next()

    const now = Date.now()
    const key = stepKey(payload.turn, payload.step)

    // A rule may let the retry owner wear this step out first. While the step
    // has failed no more often than `afterRetries`, the failure is delegated
    // untouched, so the retry owner's own budget — and the "(n/5)" progress the
    // UI shows for it — stays in charge; the rule acts on the failure after
    // that. Zero, the default, acts on the first failure.
    if (rule.afterRetries > 0 && steps.countFailure(key, now) <= rule.afterRetries) return await next()

    // Nothing is remembered between failures: every one walks the rules again,
    // so an outage that spans turns asks each time rather than quietly reusing
    // the route an earlier answer picked.
    let decision: Decision
    if (rule.action === 'renew') {
      // Counted beside the action, not as one: what happened to the request is
      // the resolution below, and this records that the credential was
      // re-acquired on the way there.
      ledger.noteRenewal()
      decision = await renewFirst(ctx, renewer, payload, rule)
    } else {
      decision = await decide(ctx, payload, rule)
    }
    const { resolution } = decision
    ledger.record(payload.provider, payload.failure.code, resolution, decision.asked, now)

    // `fail` short-circuits on purpose: a rule that says "give up" must not be
    // overruled by a later recovery listener that would retry anyway.
    if (resolution.action === 'fail') return undefined
    if (resolution.action === 'retry') {
      const downstream = await next()
      if (downstream !== undefined) return downstream
      // The retry owner's budget is spent — which is exactly when a rule with
      // `afterRetries` asks — so grant the one attempt the answer needs.
      if (!steps.claimOwn(key, 'retry', now)) return undefined
      return { kind: 'retry' }
    }
    // `renew` never reaches here: it resolves to a retry or to `onFailure`.
    if (resolution.action !== 'switch') return undefined

    steps.set(key, resolution.to, now)
    const downstream = await next()
    if (downstream !== undefined) return downstream
    // Nothing else will retry, so grant the one attempt the switch needs. The
    // claim names the target route, so a switch still applies when an earlier
    // recovery of this step already spent the plain-retry slot.
    if (!steps.claimOwn(key, routeTag(resolution.to), now)) {
      steps.forget(key)
      return undefined
    }
    return { kind: 'retry' }
  })

  ctx.on('agent/request', async (payload, next): Promise<LlmCallConfig> => {
    const seed = await next()
    const to = steps.take(stepKey(payload.turn, payload.step))
    if (to === undefined) return seed
    if (seed.provider === to.provider && seed.model === to.model) return seed
    // Replacing the route is what makes the switch real; the loop logs the
    // changed header and attributes the reply to the provider that answered.
    return { ...seed, provider: to.provider, model: to.model }
  })

  // Read the stored credential once at load. Without this the watch has no
  // fingerprint until the first status read, so a refusal recorded by the very
  // first model request could not be dated against the value that caused it —
  // and a renewal would leave the pill red. The read owns nothing, so its
  // effect has nothing to release.
  ctx.effect(() => {
    void watch.refresh()
    return () => {}
  }, 'thu-automad: initial credential read')

  if (options.renew.autoRenew && options.renew.refreshAheadMs > 0) {
    const { checkIntervalMs } = options.renew
    ctx.effect(() => {
      // Read once at load so a token that is already due renews before the
      // first interval elapses.
      void renewer.tick()
      const timer = setInterval(() => { void renewer.tick() }, checkIntervalMs)
      return () => {
        clearInterval(timer)
        renewer.stop()
      }
    }, 'thu-automad: renewal schedule')
  }

  // Unconditional, so the terminal always carries a load signal even when the
  // composition has no Connection and therefore no routes.
  ctx.logger.info(
    `thu-automad: active with ${String(options.rules.length)} rule(s), `
    + `watching ${[...providers].join(', ') || '(no provider)'}`,
  )
}

/** Recovery-kind tag for a switch, so each target route earns its own attempt. */
function routeTag(to: Route): string {
  return `switch:${to.provider}/${to.model}`
}

/**
 * Register the three exact routes the browser half addresses.
 * @param ctx - context providing the Host Connection.
 * @param options - validated plugin options.
 * @param watch - credential observer the status route reads.
 * @param renewer - renewal owner the action routes drive.
 * @param ledger - policy ledger the status route reports.
 * @returns a disposer removing every registration.
 */
function registerRoutes(
  ctx: Context,
  options: AutomadOptions,
  watch: TokenWatch,
  renewer: Renewer,
  ledger: StatusLedger,
): () => void {
  const connection = ctx.connection
  const disposers = [
    connection.fetch.register({
      path: STATUS_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async () => {
        await watch.refresh()
        await renewer.refreshFacts()
        const policy = ledger.snapshot(options.rules, true)
        const status: AutomadStatus = {
          plugin: policy.plugin,
          appliedAt: policy.appliedAt,
          uptimeSeconds: policy.uptimeSeconds,
          token: watch.snapshot(),
          renew: renewer.snapshot(),
          policy: { rules: policy.rules, counts: policy.decisions, last: policy.last },
          twoFactor: renewer.twoFactor.snapshot(),
          auth: await authConfigStatus(ctx, options),
          observedAt: Date.now(),
        }
        return Response.json(status, { headers: { 'cache-control': 'no-store' } })
      },
    }),
    connection.fetch.register({
      path: TWO_FACTOR_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const body = await readJson(request)
        const answer = parseTwoFactorAnswer(body)
        if (answer === null) return json({ ok: false, error: 'the body is not a two-factor answer' }, 400)
        const outcome = renewer.twoFactor.answer(answer)
        if (outcome === 'none') return json({ ok: false, error: 'no two-factor challenge is outstanding' }, 409)
        if (outcome === 'stale') return json({ ok: false, error: 'the challenge is waiting for a different stage' }, 409)
        if (outcome === 'invalid') return json({ ok: false, error: 'that answer is not valid for this stage' }, 400)
        return json({ ok: true })
      },
    }),
    connection.fetch.register({
      path: SETTINGS_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const body = await readJson(request)
        const parsed = parseSettingsRequest(body)
        if (parsed === null) return json({ ok: false, error: 'the body is not an auth-settings request' }, 400)
        const errors = await applySettings(ctx, options, parsed)
        const outcome: SettingsOutcome = { ok: errors.length === 0, errors, auth: await authConfigStatus(ctx, options) }
        return json({ ...outcome })
      },
    }),
    connection.fetch.register({
      path: RENEW_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async () => {
        renewer.clearBackoff()
        const outcome = await renewer.ensureFresh('manual')
        return json({ ok: true, renewed: outcome.renewed, code: outcome.code, message: outcome.message })
      },
    }),
  ]
  return () => {
    for (const dispose of disposers) void dispose()
  }
}

/**
 * Answer a failure with a renewal attempt, then execute whatever that implies.
 * @param ctx - plugin context, for the optional question service.
 * @param renewer - owner of the login attempt.
 * @param payload - the failed request the rule matched.
 * @param rule - the matched `renew` rule.
 * @returns the resolution to execute and whether a human chose it.
 */
async function renewFirst(
  ctx: Context,
  renewer: Renewer,
  payload: FailureFacts,
  rule: Rule,
): Promise<Decision> {
  // The waterfall must not be held open indefinitely, and it must respect the
  // turn's own cancellation. The two-factor budget is the long pole, so it
  // bounds the whole attempt.
  const signal = AbortSignal.any([payload.signal, AbortSignal.timeout(BUDGET_MS)])
  const outcome = await renewer.ensureFresh('refusal', signal)
  if (outcome.renewed) return { resolution: { action: 'retry' }, asked: false }
  return await fallback(ctx, payload, rule)
}

/** Resolve a `renew` rule's `onFailure` into the resolution to execute. */
async function fallback(ctx: Context, payload: FailureFacts, rule: Rule): Promise<Decision> {
  switch (rule.onFailure) {
    case 'switch':
      // Validation guarantees a target for this action.
      return { resolution: { action: 'switch', to: rule.to as Route }, asked: false }
    case 'ask':
      return await ask(ctx, payload, rule.ask as AskSpec)
    case 'fail':
      return { resolution: { action: 'fail' }, asked: false }
    case 'retry':
      return { resolution: { action: 'retry' }, asked: false }
    default:
      // Validation rejects a `renew` rule without `onFailure`, so this arm is
      // unreachable; giving up is the only safe reading if it ever is not.
      return { resolution: { action: 'fail' }, asked: false }
  }
}

/**
 * Turn one non-renew rule into the resolution to execute.
 * @param ctx - plugin context, for the optional question service.
 * @param payload - the failed request the rule matched.
 * @param rule - the matched rule.
 * @returns the resolution to execute and whether a human chose it.
 */
async function decide(ctx: Context, payload: FailureFacts, rule: Rule): Promise<Decision> {
  if (rule.action !== 'ask') {
    return {
      // Validation guarantees a target for this action.
      resolution: rule.action === 'switch' ? { action: 'switch', to: rule.to! } : { action: rule.action },
      asked: false,
    }
  }
  return await ask(ctx, payload, rule.ask as AskSpec)
}

/** Put one configured question to the human and map the answer back to an action. */
async function ask(ctx: Context, payload: FailureFacts, spec: AskSpec): Promise<Decision> {
  const questions = ctx.get('userQuestions')
  if (questions === undefined) return { resolution: resolutionOf(spec.unavailable), asked: false }
  try {
    const answer = await questions.ask({
      questions: [{
        id: QUESTION_ID,
        question: substitute(spec.question, {
          provider: payload.provider,
          code: payload.failure.code,
          message: payload.failure.message,
        }),
        detail: payload.failure.message,
        options: spec.choices.map((choice: Choice) => ({ label: choice.label })),
      }],
      agent: payload.agent,
      // The turn signal alone would leave a dismissed question pending forever.
      signal: AbortSignal.any([payload.signal, AbortSignal.timeout(spec.timeoutMs)]),
    })
    const selected = answer.answers.find(item => item.id === QUESTION_ID)?.selected[0]
    const chosen = spec.choices.find(choice => choice.label === selected)
    return chosen === undefined
      ? { resolution: resolutionOf(spec.unavailable), asked: false }
      : { resolution: resolutionOf(chosen), asked: true }
  } catch (_unanswerable) {
    // A delegated child has no human answerer, a timeout expires, and a
    // withdrawn question aborts: each falls back to the configured action
    // rather than stalling the turn.
    return { resolution: resolutionOf(spec.unavailable), asked: false }
  }
}

/** Report which renewal credentials exist and whether the launching environment pins them. */
async function authConfigStatus(ctx: Context, options: AutomadOptions): Promise<AuthConfigStatus> {
  const refs: readonly CredentialRef[] = [
    options.credentialRef, options.auth.usernameRef, options.auth.passwordRef,
  ]
  const described = await Promise.all(refs.map(async (ref) => {
    const info = await ctx.credentials.describe(ref)
    return { ref, configured: info.configured, writable: info.writable }
  }))
  const of = (ref: CredentialRef): { configured: boolean; writable: boolean } =>
    described.find(entry => entry.ref === ref) ?? { configured: false, writable: true }
  return {
    credentialRef: options.credentialRef,
    usernameRef: options.auth.usernameRef,
    passwordRef: options.auth.passwordRef,
    deviceName: DEVICE_NAME,
    tunnel: options.auth.tunnel,
    usernameConfigured: of(options.auth.usernameRef).configured,
    passwordConfigured: of(options.auth.passwordRef).configured,
    tokenConfigured: of(options.credentialRef).configured,
    shadowedRefs: described.filter(entry => !entry.writable).map(entry => entry.ref),
  }
}

/** Wrap one provider stream so its outcome updates the watch. */
async function* watchStream(
  watch: TokenWatch,
  provider: string,
  stream: AsyncIterable<StreamChunk>,
): AsyncIterable<StreamChunk> {
  let completed = false
  try {
    for await (const chunk of stream) yield chunk
    completed = true
  } catch (error) {
    watch.observe(provider, error)
    throw error
  } finally {
    // Only a fully consumed stream proves the request succeeded; a consumer
    // that stopped early learned nothing about the credential either way.
    if (completed) watch.settle(provider)
  }
}

/** Read a request body as JSON, reporting a malformed one as absent. */
async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch (_notJson) {
    return undefined
  }
}

/** Validate one posted settings request. */
function parseSettingsRequest(body: unknown): AuthSettingsRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const record = body as Record<string, unknown>
  const field = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined
    if (value === null) return null
    return typeof value === 'string' ? value : undefined
  }
  const username = field(record.username)
  const password = field(record.password)
  if (record.username !== undefined && username === undefined) return null
  if (record.password !== undefined && password === undefined) return null
  return {
    ...username === undefined ? {} : { username },
    ...password === undefined ? {} : { password },
  }
}

/**
 * Write the identity a renewal logs in with.
 *
 * An empty or cleared field unsets the reference rather than storing an empty
 * string, because the seam treats an empty stored value as absent everywhere
 * and would otherwise leave a row that looks configured and is not.
 * @param ctx - context providing the credentials service.
 * @param options - validated plugin options.
 * @param request - the validated request.
 * @returns one entry per refused field; empty when every write succeeded.
 */
async function applySettings(
  ctx: Context,
  options: AutomadOptions,
  request: AuthSettingsRequest,
): Promise<SettingsFieldError[]> {
  const refs = { username: options.auth.usernameRef, password: options.auth.passwordRef }
  const errors: SettingsFieldError[] = []
  for (const field of ['username', 'password'] as const) {
    const value = request[field]
    if (value === undefined) continue
    try {
      if (value === null || value.trim() === '') await ctx.credentials.unset(refs[field])
      else await ctx.credentials.set(refs[field], value.trim())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push({
        field,
        // The seam's own refusal to write over a launching-environment value is
        // the one failure a user can act on, and it must not be flattened into
        // a generic error.
        code: message.includes('read-only by the launching environment') ? 'shadowed' : 'refused',
        message,
      })
    }
  }
  return errors
}

/** Validate one posted two-factor answer. */
function parseTwoFactorAnswer(body: unknown): TwoFactorAnswer | null {
  if (typeof body !== 'object' || body === null) return null
  const record = body as Record<string, unknown>
  if (record.stage === 'cancel') return { stage: 'cancel' }
  if (record.stage === 'method') {
    if (typeof record.method !== 'string' || record.method.length === 0) return null
    return { stage: 'method', method: record.method, trustDevice: record.trustDevice !== false }
  }
  if (record.stage === 'code') {
    if (typeof record.code !== 'string') return null
    return { stage: 'code', code: record.code }
  }
  return null
}

/** Serialize one route result as JSON. */
function json(value: ActionOutcome | Record<string, unknown>, status = 200): Response {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}
