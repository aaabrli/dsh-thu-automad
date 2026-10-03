/**
 * Stub Context shared by this package's Host-side checks. It is not part of the
 * harness repository; it exists so the real `apply` can be driven without a
 * running dsh.
 *
 * The pieces are deliberately thin: an event registry, an effect collector, a
 * credentials seam backed by two plain maps, an exact-Fetch registry, and a
 * controllable clock through `setInterval`. Anything a check needs to observe
 * is captured here rather than mocked per case, so a check reads as a statement
 * about the plugin.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CredentialRecord } from '@deepseek-ai/dsh-credentials'

/** One captured event listener. */
export type Listener = (payload: never, next: () => Promise<never>) => Promise<unknown>

/** One registered exact Fetch route. */
export interface StubRoute {
  path: string
  methods: readonly string[]
  fetch: (request: Request) => Promise<Response>
}

/** One recorded question the policy asked. */
export interface AskedQuestion {
  question: string
  optionLabels: string[]
}

/** What one call to `userQuestions.ask` should do. */
export type QuestionAnswer = { selected: string[] } | Error

/** Options one harness is built with. */
export interface HarnessOptions {
  /** Values the credentials seam resolves, by reference. */
  values?: Record<string, string>
  /** Records the credentials seam stores, by key. */
  records?: Record<string, CredentialRecord>
  /** References the launching environment supplies read-only. */
  shadowed?: readonly string[]
  /** Set to false to model a composition without the question service. */
  withQuestions?: boolean
  /** Set to false to model Connection activating after this plugin does. */
  withConnection?: boolean
}

/** Stub Context plus everything the plugin registered through it. */
export interface Harness {
  ctx: Context
  listeners: Map<string, Listener>
  asked: AskedQuestion[]
  /** Mutated by a case to choose what the question service answers. */
  answer: QuestionAnswer
  routes: StubRoute[]
  logs: string[]
  disposers: (() => void)[]
  /** Values currently stored, shared with the plugin under test. */
  values: Record<string, string>
  /** Records currently stored. */
  records: Record<string, CredentialRecord>
  /** References a write must refuse, modelling the launching environment. */
  shadowed: Set<string>
  /** The renewal tick body, captured instead of scheduled. */
  readonly tick: (() => void) | undefined
  /** Deliver Connection to a plugin that is waiting for it. */
  deliverConnection: () => void
  /** Run the renewal tick and let its promise chain settle. */
  runTick: () => Promise<void>
  /** Run the credential-probe tick, when one is configured, and settle. */
  runProbe: () => Promise<void>
}

/** Install a `setInterval` that records instead of scheduling, and restore it. */
function captureIntervals(): { restore: () => void; callbacks: (() => void)[] } {
  const original = globalThis.setInterval
  const callbacks: (() => void)[] = []
  Object.assign(globalThis, {
    setInterval: (run: () => void) => {
      callbacks.push(run)
      return 0
    },
    clearInterval: () => {},
  })
  return { restore: () => { Object.assign(globalThis, { setInterval: original }) }, callbacks }
}

/** Let every pending microtask and one timer turn settle. */
export async function settle(turns = 6): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) await new Promise(resolve => setImmediate(resolve))
}

/**
 * Build the event, effect, credential, question, connection, and logging
 * surface the Host half uses.
 * @param options - initial credential state and composition shape.
 * @returns the stub Context and everything it captured.
 */
export function harness(options: HarnessOptions = {}): Harness {
  const listeners = new Map<string, Listener>()
  const asked: AskedQuestion[] = []
  const routes: StubRoute[] = []
  const logs: string[] = []
  const disposers: (() => void)[] = []
  const values: Record<string, string> = { ...options.values }
  const records: Record<string, CredentialRecord> = { ...options.records }
  const shadowed = new Set(options.shadowed ?? [])
  const intervals = captureIntervals()
  const waiting: ((routeCtx: unknown) => unknown)[] = []

  const state: Harness = {
    ctx: undefined as unknown as Context,
    listeners,
    asked,
    answer: { selected: [] },
    routes,
    logs,
    disposers,
    values,
    records,
    shadowed,
    // Read lazily: the plugin registers its interval while `apply` runs, which
    // happens after this object is built.
    get tick() { return intervals.callbacks[0] },
    deliverConnection: () => {
      for (const callback of waiting.splice(0)) callback(ctx)
    },
    runTick: async () => {
      intervals.callbacks[0]?.()
      await settle()
    },
    runProbe: async () => {
      intervals.callbacks[1]?.()
      await settle()
    },
  }

  const credentials = {
    resolve: async (ref: string) => {
      const value = values[ref]
      return value === undefined ? undefined : { value, source: 'user-env' }
    },
    describe: async (ref: string) => ({
      configured: values[ref] !== undefined,
      ...values[ref] === undefined ? {} : { source: 'user-env' },
      writable: !shadowed.has(ref),
    }),
    set: async (ref: string, value: string) => {
      if (shadowed.has(ref)) throw new Error(`credentials-local: "${ref}" is supplied read-only by the launching environment, so set would be shadowed; unset it in the shell you start dsh from instead`)
      if (value === '') throw new Error(`credentials-local: an empty value cannot be stored for "${ref}"; use unset`)
      values[ref] = value
    },
    unset: async (ref: string) => {
      if (shadowed.has(ref)) throw new Error(`credentials-local: "${ref}" is supplied read-only by the launching environment, so unset would be shadowed; unset it in the shell you start dsh from instead`)
      delete values[ref]
    },
    readRecord: async (key: string) => records[key],
    modifyRecord: async (key: string, mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) => {
      const next = await mutate(records[key])
      if (next !== undefined) records[key] = next
      return next
    },
  }

  const ctx = {
    on: (event: string, handler: Listener) => {
      listeners.set(event, handler)
      return () => {}
    },
    effect: (run: () => unknown) => {
      const disposer = run()
      if (typeof disposer === 'function') disposers.push(disposer as () => void)
      return disposer
    },
    logger: { info: (message: string) => { logs.push(message) } },
    credentials,
    inject: (deps: readonly string[], callback: (routeCtx: unknown) => unknown) => {
      if (!deps.includes('connection')) return Promise.resolve()
      if (options.withConnection !== false) callback(ctx)
      else waiting.push(callback)
      return Promise.resolve()
    },
    connection: {
      fetch: {
        register: (route: StubRoute) => {
          routes.push(route)
          // The real registry returns a disposer synchronously; only the
          // removal it performs is asynchronous.
          return () => Promise.resolve()
        },
      },
    },
    get: (service: string) => {
      // Models an eager read of an already-present Connection. The plugin must
      // not depend on this path — an eager read is what breaks a route
      // registration when Connection activates later.
      if (service === 'connection') {
        return options.withConnection !== false ? ctx.connection : undefined
      }
      if (service !== 'userQuestions' || options.withQuestions === false) return undefined
      return {
        ask: (request: { questions: { question: string; options?: { label: string }[] }[] }) => {
          const question = request.questions[0]
          asked.push({
            question: question?.question ?? '',
            optionLabels: (question?.options ?? []).map(option => option.label),
          })
          return state.answer instanceof Error
            ? Promise.reject(state.answer)
            : Promise.resolve({ answers: [{ id: 'thu-automad', selected: state.answer.selected }] })
        },
      }
    },
  }
  state.ctx = ctx as unknown as Context
  // A check that never disposes would otherwise leave the stub in place for the
  // next one; restoring here keeps each check independent.
  disposers.push(intervals.restore)
  return state
}

/** Fixed turn/step identity most cases reuse. */
export const TURN = 3
export const STEP = 7

/** One failed-request payload. */
export const failure = (provider: string, code: string, step = STEP): never => ({
  agent: { session: { id: 'session-test' } },
  turn: TURN,
  step,
  provider,
  failure: { code, message: `${provider} answered ${code}` },
  retryPolicy: undefined,
  signal: new AbortController().signal,
}) as never

/**
 * Invoke one captured listener, recording whether it delegated.
 * @param h - harness holding the listener.
 * @param event - event name.
 * @param payload - payload to hand it.
 * @param downstream - what the next listener would answer.
 * @returns the listener's result and how often it delegated.
 */
export async function fire(
  h: Harness,
  event: string,
  payload: unknown,
  downstream: () => Promise<unknown>,
): Promise<{ result: unknown; delegated: number }> {
  const listener = h.listeners.get(event)
  if (listener === undefined) throw new Error(`${event} must be registered`)
  let delegated = 0
  const result = await listener(payload as never, () => {
    delegated += 1
    return downstream() as Promise<never>
  })
  return { result, delegated }
}

/**
 * Find one registered route by path.
 * @param h - harness holding the routes.
 * @param path - absolute route path.
 * @returns the route.
 */
export function route(h: Harness, path: string): StubRoute {
  const found = h.routes.find(entry => entry.path === path)
  if (found === undefined) throw new Error(`route ${path} must be registered`)
  return found
}

/**
 * Send one request through a registered route.
 * @param h - harness holding the routes.
 * @param path - absolute route path.
 * @param init - request init; a JSON body is stringified by the caller.
 * @returns the decoded JSON body and the response status.
 */
export async function call(
  h: Harness,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await route(h, path).fetch(new Request(`http://localhost${path}`, init))
  const text = await response.text()
  const body = text === '' ? {} : JSON.parse(text) as Record<string, unknown>
  return { status: response.status, body }
}

/**
 * POST one JSON body to a route.
 * @param h - harness holding the routes.
 * @param path - absolute route path.
 * @param body - value to serialize.
 * @returns the decoded JSON reply and its status.
 */
export async function post(
  h: Harness,
  path: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return await call(h, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Build a compact JWT-shaped token with the given lifetime claims.
 * @param issuedAt - `iat` in epoch milliseconds.
 * @param expiresAt - `exp` in epoch milliseconds.
 * @returns a three-segment token whose payload decodes to those claims.
 */
export function token(issuedAt: number, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({
    iat: Math.round(issuedAt / 1000),
    exp: Math.round(expiresAt / 1000),
    zjh: '2023000000',
  })).toString('base64url')
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`
}
