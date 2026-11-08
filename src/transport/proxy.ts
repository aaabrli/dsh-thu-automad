/**
 * Loopback OpenAI-compatible transport for the madmodel gateway.
 *
 * The gateway's direct host name is reachable only from the campus network: off
 * campus the school's load balancer answers every request with a redirect into
 * the unified-auth OAuth form. The school's WebVPN tunnel fronts the same
 * application at `https://webvpn.tsinghua.edu.cn/https/<hash>/...`, but it only
 * serves requests that carry the tunnel session cookie. A provider row cannot
 * supply a cookie that the renewal replaces every few hours, so this module
 * serves the provider a stable local endpoint and owns the transport instead.
 *
 * ## Two upstreams, one queue
 *
 * In `direct` mode a request goes straight to the site; in `webvpn` mode it goes
 * through the tunnel prefix with the current cookie. Which one a request uses is
 * decided by the renewal owner (network probing), not here.
 *
 * The gateway counts in-flight completions per account and answers the ones over
 * its limit with 429. That limit belongs to the school, so the only honest
 * response is admission control: hold a request locally until a slot frees,
 * hand it to the gateway then, and if a 429 still arrives, pause the model and
 * retry the same request instead of failing the turn. A conversation that is
 * waiting is kept alive by SSE comments, so "wait, then continue" survives the
 * client's own idle timeouts.
 *
 * Request bodies are buffered (bounded) for one reason: a gate, an expired
 * tunnel session, or a 429 must be retried without losing the body. Responses
 * are streamed, so SSE chunks reach the provider as the upstream produces them.
 *
 * ## A gate is not an answer
 *
 * When a fresh session still cannot get past the school's gate, that response is
 * reported locally as a failure with the one action that repairs it. Forwarding
 * it would let the provider follow a relative login `Location` back into this
 * loopback server, producing a 404 on `/login` where the model should have been
 * — a broken-model error for what is really a missing off-campus session.
 * @module dsh-thu-automad/transport/proxy
 */

import { createServer, request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { SITE } from '../auth/chain.ts'
import type { ConcurrencyOptions } from './concurrency.ts'
import { CONCURRENCY_DEFAULTS, KNOWN_MODELS } from './concurrency.ts'

/** Which upstream a request uses. */
export type EffectiveTransport = 'direct' | 'webvpn'

/** Facts the server needs before one upstream request. */
export interface ProxyAuth {
  /** Bearer token the provider would have sent. */
  token: string
  /** Upstream the request must use. */
  mode: EffectiveTransport
  /** WebVPN tunnel cookie header value; empty in direct mode. */
  cookie: string
  /** Tunnel prefix (origin plus `/https/<hash>`) for webvpn mode. */
  tunnelPrefix: string
}

/** One model's queue, as the status document reports it. */
export interface ProxyPoolStatus {
  /** Model id the queued requests name. */
  model: string
  /** In-flight completions currently allowed. */
  limit: number
  /** Gateway ceiling for this model. */
  ceiling: number
  /** Completions currently running upstream. */
  inFlight: number
  /** Requests waiting for a slot. */
  queued: number
  /** Epoch milliseconds the 429 pause ends, or null when not paused. */
  pausedUntil: number | null
}

/** Options one proxy server is built with. */
export interface ProxyOptions {
  /** Loopback port to listen on. */
  port: number
  /** Listen address; loopback by default. */
  host?: string
  /** Largest buffered request body, in bytes. */
  maxBodyBytes?: number
  /** Admission-control policy; defaults are used when omitted. */
  concurrency?: ConcurrencyOptions
  /** Current transport facts, or null while no token is configured. */
  resolveAuth: () => Promise<ProxyAuth | null>
  /**
   * Re-establish the transport after the school's gate refused a request, and
   * report whether a usable session now exists.
   *
   * This is the difference between a recoverable session problem and a broken
   * turn: returning false makes the proxy report the gate as a failure the user
   * can act on, instead of forwarding a login redirect into the provider client.
   */
  refresh: () => Promise<boolean>
  /** Diagnostic sink; never receives credentials. */
  log: (message: string) => void
}

/** What one running server reports about itself. */
export interface ProxyStatus {
  /** Whether the server is accepting connections. */
  listening: boolean
  /** Port it listens on. */
  port: number
  /** Last bind or runtime error, when one happened. */
  lastError: string | null
  /** Whether new requests still wait for a slot. */
  queueEnabled: boolean
  /** Per-model admission state. */
  pools: ProxyPoolStatus[]
}

/** Handle one running server. */
export interface RunningProxy {
  /** Port it listens on. */
  readonly port: number
  /** Read the current server facts. */
  status(): ProxyStatus
  /** Turn admission control on or off. */
  setQueueEnabled(enabled: boolean): void
  /** Drop every in-flight slot and queued request, then close live connections. */
  reset(): void
  /** Stop accepting requests and close every connection. */
  close(): Promise<void>
}

/** Headers this proxy owns; they never travel from the client to the upstream. */
const OWNED_HEADERS = new Set([
  'host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length',
  'authorization', 'cookie', 'accept-encoding',
])

/**
 * Response headers the proxy must not copy to its own client.
 *
 * The transport headers are the HTTP layer's. `location` is here for a
 * different reason: a redirect is how the school's gate answers a request it
 * does not want to serve, and a relative `Location` handed to a provider client
 * is resolved against *this* loopback origin — the provider then asks the proxy
 * for `/login` and gets a 404 instead of an answer. A gate is converted into a
 * reported failure before headers are copied, and this is the second line of
 * defence against a path that forgets to.
 */
const RESPONSE_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'location',
])

/** Headers a keepalive response needs. */
const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-store',
  connection: 'keep-alive',
} as const

/** Default request-body ceiling; images arrive base64-encoded inside JSON. */
const DEFAULT_MAX_BODY_BYTES = 64 * 1024 * 1024

/** Socket inactivity budget for one upstream request. */
const UPSTREAM_IDLE_MS = 10 * 60 * 1000

/**
 * How long a failed re-authentication stands before another one is attempted.
 *
 * A login is a scarce, externally visible action: the school allows one attempt
 * per identity at a time, and a retry storm against a wrong password or a gate
 * that no tunnel can pass must not become a login storm. The provider's own
 * retries arrive within a few seconds of each other, so this window collapses
 * one turn's worth of retries into one login attempt.
 */
const RECOVERY_FAILURE_COOLDOWN_MS = 15_000

/**
 * Floor between two *successful* re-authentications.
 *
 * A gate that survives a freshly minted session is not a session problem, and
 * answering it with another login would spend the account's attempt budget on
 * nothing.
 */
const RECOVERY_SUCCESS_INTERVAL_MS = 5_000

/** How much of an upstream error body is read for one diagnostic line. */
const ERROR_BODY_LIMIT = 4096

/** Completion facts parsed out of a request body. */
interface CompletionFacts {
  /** Model id the body names, or a shared key when it names none. */
  model: string
  /** Whether the caller asked for an SSE stream. */
  stream: boolean
}

/** One upstream response whose body is still streaming. */
interface UpstreamResponse {
  status: number
  headers: IncomingHttpHeaders
  stream: IncomingMessage
}

/**
 * One re-authentication, shared by every request that needs it.
 *
 * The provider retries a failed step immediately and repeatedly, so five
 * requests can ask for a new session within one second. The school issues one
 * login per identity at a time; a per-request attempt would either duplicate
 * the fingerprint's registration or fail against the first one.
 */
interface Recovery {
  /** When the attempt started, or finished once `running` is null. */
  at: number
  /** Whether it produced a usable session. */
  usable: boolean
  /** The attempt in flight, or null once it settled. */
  running: Promise<ProxyAuth | null> | null
}

/** Keepalive state for one queued streaming request. */
interface WaitingState {
  /** Set once the client is gone or the server stopped. */
  stopped: boolean
  /** Whether the SSE keepalive already wrote response headers. */
  headersSent: boolean
  /** Pending timer that starts the keepalive. */
  heartbeatTimer: ReturnType<typeof setTimeout> | undefined
  /** Running keepalive comment interval. */
  heartbeat: ReturnType<typeof setInterval> | undefined
}

/** One request waiting for a model slot. */
interface Waiter {
  /** Tracked keepalive state; shared across a retry. */
  waiting: WaitingState
  /** Response the keepalive writes to. */
  response: ServerResponse
  /** Whether the caller asked for a stream. */
  stream: boolean
  /** When the request entered the queue. */
  queuedAt: number
  /** Resolver for the granted slot. */
  resolve: (slot: Slot | null) => void
  /** Rejector for queue refusals. */
  reject: (error: Error) => void
  /** Whether this waiter already received a slot. */
  granted: boolean
}

/** A granted slot. Release is idempotent and must happen once. */
interface Slot {
  /** Return the slot; `success` feeds the adaptive limit. */
  release(success: boolean): void
}

/** One model's admission state. */
interface Pool {
  model: string
  /** Completions currently allowed. */
  limit: number
  /** Gateway ceiling for this model; growth stops here. */
  ceiling: number
  /** Completions running upstream. */
  inFlight: number
  /** Completed requests since the limit last moved. */
  successes: number
  /** Current pause after a 429. */
  cooldownMs: number
  /** Epoch milliseconds the pause ends. */
  pausedUntil: number
  /** Waiting requests, oldest first. */
  queue: Waiter[]
  /** Pending pump timer while paused. */
  pumpTimer: ReturnType<typeof setTimeout> | undefined
  /** Re-entrancy guard for the pump. */
  pumping: boolean
}

/** Stable reason one queue operation was refused. */
type QueueCode = 'queue_full' | 'queue_timeout' | 'client_gone'

/** Error a queue refusal carries. */
class QueueError extends Error {
  constructor(message: string, readonly code: QueueCode) {
    super(message)
    this.name = 'QueueError'
  }
}

/**
 * A per-model admission controller.
 *
 * It knows nothing about HTTP: the server asks for a slot, hands the request to
 * the upstream, and reports the outcome. The limit starts conservative, grows
 * after a run of successful completions, and halves on a 429; a 429 also pauses
 * the whole model for a growing cooldown so a burst does not keep hammering the
 * gateway.
 */
class Scheduler {
  private readonly pools = new Map<string, Pool>()
  private enabled = true

  /**
   * @param options - admission policy.
   * @param log - diagnostic sink.
   * @param models - model ids to expose before their first request.
   */
  constructor(
    private readonly options: ConcurrencyOptions,
    private readonly log: (message: string) => void,
    models: readonly string[] = [],
  ) {
    for (const model of models) this.poolFor(model)
  }

  /** Whether new requests still wait for capacity. */
  get queueEnabled(): boolean {
    return this.enabled
  }

  /**
   * Turn admission control on or off.
   *
   * Off is the escape hatch for a queue the user cannot clear: waiting requests
   * start immediately and later arrivals bypass the limit, accepting that the
   * gateway may answer 429 instead of the queue answering "wait forever".
   * @param enabled - whether requests should wait for a slot.
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (!enabled) {
      for (const pool of this.pools.values()) {
        while (pool.queue.length > 0) {
          const waiter = pool.queue.shift()
          if (waiter === undefined) break
          this.stopHeartbeat(waiter.waiting)
          waiter.resolve(this.grant(pool))
        }
      }
      return
    }
    for (const pool of this.pools.values()) this.pump(pool)
  }

  /**
   * Forget every in-flight request and drop the queue.
   *
   * The proxy calls this only after closing its own connections, so the slots
   * it forgets belong to responses that no longer have a client.
   */
  reset(): void {
    for (const pool of this.pools.values()) {
      for (const waiter of pool.queue.splice(0)) {
        this.stopHeartbeat(waiter.waiting)
        waiter.reject(new QueueError('thu-automad: the transport was reset', 'queue_timeout'))
      }
      pool.inFlight = 0
      pool.limit = this.initialFor(pool.model)
      pool.successes = 0
      pool.cooldownMs = this.options.cooldownMs
      pool.pausedUntil = 0
    }
  }

  /** Per-model admission facts for the status document. */
  snapshot(): ProxyPoolStatus[] {
    const now = Date.now()
    return [...this.pools.values()].map(pool => ({
      model: pool.model,
      limit: pool.limit,
      ceiling: pool.ceiling,
      inFlight: pool.inFlight,
      queued: pool.queue.length,
      pausedUntil: pool.pausedUntil > now ? pool.pausedUntil : null,
    }))
  }

  /**
   * Wait for a model slot.
   * @param model - model id the request names.
   * @param stream - whether the request is a stream; only streams get keepalives.
   * @param response - response the keepalive writes to.
   * @param waiting - keepalive state shared across retries.
   * @returns the granted slot, or null when the client disappeared first.
   */
  async acquire(
    model: string,
    stream: boolean,
    response: ServerResponse,
    waiting: WaitingState,
  ): Promise<Slot | null> {
    const pool = this.poolFor(model)
    if (waiting.stopped || response.destroyed || response.writableEnded) return null
    // Bypass admission entirely when the user turned the queue off.
    if (!this.enabled) return this.grant(pool)
    // A new arrival never jumps a queue that is already waiting: only an empty
    // queue may take a slot directly.
    if (pool.queue.length === 0 && this.canGrant(pool)) return this.grant(pool)
    if (pool.queue.length >= this.options.queueLimit) {
      throw new QueueError(
        `thu-automad: ${String(pool.queue.length)} requests are already waiting for "${model}"`,
        'queue_full',
      )
    }
    return await new Promise<Slot | null>((resolve, reject) => {
      const waiter: Waiter = {
        waiting,
        response,
        stream,
        queuedAt: Date.now(),
        resolve,
        reject,
        granted: false,
      }
      pool.queue.push(waiter)
      this.armHeartbeat(waiter)
      if (this.options.maxWaitMs > 0) {
        const timer = setTimeout(() => {
          const index = pool.queue.indexOf(waiter)
          if (index < 0) return
          pool.queue.splice(index, 1)
          this.stopHeartbeat(waiting)
          reject(new QueueError(`thu-automad: waited ${String(this.options.maxWaitMs)} ms for "${model}"`, 'queue_timeout'))
        }, this.options.maxWaitMs)
        const originalResolve = waiter.resolve
        const originalReject = waiter.reject
        waiter.resolve = (slot) => { clearTimeout(timer); originalResolve(slot) }
        waiter.reject = (error) => { clearTimeout(timer); originalReject(error) }
      }
      this.pump(pool)
    })
  }

  /** Remove a still-queued request because its client disconnected. */
  cancel(waiting: WaitingState): void {
    waiting.stopped = true
    this.stopHeartbeat(waiting)
    for (const pool of this.pools.values()) {
      const index = pool.queue.findIndex(waiter => waiter.waiting === waiting)
      if (index < 0) continue
      const [waiter] = pool.queue.splice(index, 1)
      waiter?.reject(new QueueError('thu-automad: client disconnected while waiting', 'client_gone'))
      return
    }
  }

  /** Pause a model after the gateway refused one of its requests with 429. */
  noteRateLimit(model: string, retryAfterMs: number | null): void {
    const pool = this.poolFor(model)
    const pause = Math.max(pool.cooldownMs, retryAfterMs ?? 0)
    pool.pausedUntil = Math.max(pool.pausedUntil, Date.now() + pause)
    pool.cooldownMs = Math.min(this.options.maxCooldownMs, pool.cooldownMs * 2)
    // Halve gently: 3 → 2 → 1. One refusal usually means a burst (background
    // title/suggestion calls, another window), not that the account can only
    // run one request. Repeated refusals still reach the floor.
    pool.limit = Math.max(this.options.min, Math.ceil(pool.limit / 2))
    pool.successes = 0
    this.log(
      `"${model}" answered 429: pausing ${String(pause)} ms, limit now ${String(pool.limit)}, `
      + `${String(pool.queue.length)} queued`,
    )
    this.pump(pool)
  }

  /** Stop a keepalive, if one is running. */
  stopHeartbeat(waiting: WaitingState): void {
    if (waiting.heartbeatTimer !== undefined) clearTimeout(waiting.heartbeatTimer)
    if (waiting.heartbeat !== undefined) clearInterval(waiting.heartbeat)
    waiting.heartbeatTimer = undefined
    waiting.heartbeat = undefined
  }

  /** Return the pool for one model, creating it on first use. */
  private poolFor(model: string): Pool {
    let pool = this.pools.get(model)
    if (pool === undefined) {
      const limit = this.initialFor(model)
      pool = {
        model,
        limit,
        ceiling: Math.max(limit, this.ceilingFor(model)),
        inFlight: 0,
        successes: 0,
        cooldownMs: this.options.cooldownMs,
        pausedUntil: 0,
        queue: [],
        pumpTimer: undefined,
        pumping: false,
      }
      this.pools.set(model, pool)
    }
    return pool
  }

  /** Configured per-model limit, falling back to the global initial value. */
  private initialFor(model: string): number {
    return this.options.perModel?.[model] ?? this.options.initial
  }

  /** Gateway ceiling for one model, never below its configured limit. */
  private ceilingFor(model: string): number {
    return this.options.perModel?.[model] ?? this.options.max
  }

  /** Whether a request may start on this model right now. */
  private canGrant(pool: Pool): boolean {
    return pool.inFlight < pool.limit && Date.now() >= pool.pausedUntil
  }

  /** Hand one slot out and count it. */
  private grant(pool: Pool): Slot {
    pool.inFlight += 1
    let released = false
    return {
      release: (success: boolean) => {
        if (released) return
        released = true
        pool.inFlight = Math.max(0, pool.inFlight - 1)
        if (success) {
          pool.successes += 1
          pool.cooldownMs = this.options.cooldownMs
          if (pool.successes >= this.options.growAfter && pool.limit < pool.ceiling) {
            pool.limit += 1
            pool.successes = 0
            this.log(`"${pool.model}" completed ${String(this.options.growAfter)} in a row: limit now ${String(pool.limit)}`)
          }
        }
        this.pump(pool)
      },
    }
  }

  /** Start a queued request when a slot exists. */
  private pump(pool: Pool): void {
    if (pool.pumping) return
    pool.pumping = true
    try {
      for (;;) {
        while (pool.queue.length > 0 && pool.queue[0]?.waiting.stopped === true) pool.queue.shift()
        if (pool.queue.length === 0) return
        const now = Date.now()
        if (now < pool.pausedUntil) {
          this.schedulePump(pool, pool.pausedUntil - now)
          return
        }
        if (pool.inFlight >= pool.limit) return
        const waiter = pool.queue.shift()
        if (waiter === undefined) return
        if (waiter.waiting.stopped) continue
        waiter.granted = true
        this.stopHeartbeat(waiter.waiting)
        waiter.resolve(this.grant(pool))
      }
    } finally {
      pool.pumping = false
    }
  }

  /** Wake the pump once a pause ends. */
  private schedulePump(pool: Pool, delayMs: number): void {
    if (pool.pumpTimer !== undefined) return
    pool.pumpTimer = setTimeout(() => {
      pool.pumpTimer = undefined
      this.pump(pool)
    }, Math.max(10, delayMs + 5))
  }

  /** Start keeping a queued streaming request's connection alive. */
  private armHeartbeat(waiter: Waiter): void {
    const { waiting, response } = waiter
    if (!waiter.stream || waiting.heartbeatTimer !== undefined || waiting.heartbeat !== undefined) return
    if (waiting.stopped || waiting.headersSent) return
    const delay = Math.max(10, this.options.heartbeatAfterMs - (Date.now() - waiter.queuedAt))
    waiting.heartbeatTimer = setTimeout(() => {
      waiting.heartbeatTimer = undefined
      if (waiting.stopped || waiter.granted) return
      try {
        response.writeHead(200, SSE_HEADERS)
        response.write(': thu-automad: waiting for a free model slot\n\n')
        waiting.headersSent = true
      } catch (_clientGone) {
        waiting.stopped = true
        return
      }
      waiting.heartbeat = setInterval(() => {
        if (waiting.stopped) return
        try {
          response.write(`: thu-automad: still waiting (${String(Date.now() - waiter.queuedAt)} ms)\n\n`)
        } catch (_clientGone) {
          waiting.stopped = true
        }
      }, Math.max(10, this.options.heartbeatMs))
    }, delay)
  }
}

/**
 * Start the loopback proxy and resolve once it accepts connections.
 * @param options - port, transport facts, refresh callback, and diagnostics.
 * @returns the running server, or a rejected promise when the port is unusable.
 */
export async function startTransportProxy(options: ProxyOptions): Promise<RunningProxy> {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  const scheduler = new Scheduler(options.concurrency ?? CONCURRENCY_DEFAULTS, options.log, KNOWN_MODELS)
  const state: ProxyStatus = { listening: false, port: options.port, lastError: null, pools: [] }
  let recovery: Recovery | null = null

  const resolveAuth = async (): Promise<ProxyAuth | null> => {
    try {
      return await options.resolveAuth()
    } catch (error) {
      options.log(`could not read transport facts: ${describe(error)}`)
      return null
    }
  }

  /**
   * Ask for a usable session once, sharing the attempt with every caller.
   *
   * No caller ever waits on a login that another caller already started, and no
   * settled attempt is repeated inside its cooldown window. That is what keeps
   * "a stale tunnel cookie buys exactly one re-authentication" true even when a
   * whole turn's retries arrive together.
   * @returns transport facts that are now usable, or null when none exist.
   */
  const recoverTransport = async (): Promise<ProxyAuth | null> => {
    if (recovery !== null) {
      if (recovery.running !== null) return await recovery.running
      const wait = recovery.usable ? RECOVERY_SUCCESS_INTERVAL_MS : RECOVERY_FAILURE_COOLDOWN_MS
      if (Date.now() - recovery.at < wait) return null
    }
    const entry: Recovery = { at: Date.now(), usable: false, running: null }
    entry.running = (async (): Promise<ProxyAuth | null> => {
      let usable = false
      try {
        usable = await options.refresh()
      } catch (error) {
        options.log(`re-authentication failed: ${describe(error)}`)
      }
      const next = usable ? await resolveAuth() : null
      entry.usable = next !== null
      entry.at = Date.now()
      return next
    })()
    recovery = entry
    try {
      return await entry.running
    } finally {
      entry.running = null
    }
  }

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const rawPath = request.url ?? '/'
    const method = request.method ?? 'GET'
    const path = normalizeRequestPath(rawPath)
    if (path === null) {
      sendJson(response, 404, {
        error: {
          message: `thu-automad: unsupported request path (${method} ${rawPath})`,
          type: 'not_found',
        },
      })
      return
    }
    if (path !== rawPath) options.log(`normalized ${method} ${rawPath} -> ${path}`)

    // Model discovery is served locally: the provider catalogue is static, and
    // forwarding this to the campus host would hand an SDK the application's
    // HTML shell. It needs no credential.
    if (method === 'GET' && path === '/v1/models') {
      sendJson(response, 200, {
        object: 'list',
        data: [{ id: 'DeepSeek-V4.1-Flash', object: 'model', owned_by: 'madmodel' }],
      })
      return
    }
    let body: Buffer
    try {
      body = await readBody(request, maxBodyBytes)
    } catch (error) {
      sendJson(response, 413, {
        error: { message: `thu-automad: ${describe(error)}`, type: 'request_too_large' },
      })
      return
    }
    const auth = await resolveAuth()
    if (auth === null) {
      sendJson(response, 503, {
        error: {
          message: 'thu-automad: no campus token is configured yet; fill in 设置 → 清华 MadModel and renew once',
          type: 'missing_credential',
        },
      })
      return
    }

    // A tunnel session is not optional in webvpn mode: the WebVPN prefix
    // answers an unauthenticated request with the school's login page, and that
    // page is precisely what the provider client must never receive. Establish
    // the session first and only then decide whether the request can be served.
    let session = auth
    if (session.mode === 'webvpn' && session.cookie === '') {
      const recovered = await recoverTransport()
      if (recovered === null) {
        sendJson(response, 502, {
          error: {
            message: gateMessage('no WebVPN tunnel session could be established'),
            type: 'thu_automad_transport',
          },
        })
        return
      }
      session = recovered
    }

    // Model discovery is a cheap GET, not a completion: no slot is needed and a
    // 429 there would not be about concurrency. A gate still gets one
    // re-authentication, like a completion does.
    if (method === 'GET') {
      let currentAuth = session
      let recovered = false
      for (;;) {
        let upstream: UpstreamResponse
        try {
          upstream = await dispatch(method, path, body, request.headers, currentAuth)
        } catch (error) {
          sendJson(response, 502, {
            error: { message: `thu-automad: upstream unreachable: ${describe(error)}`, type: 'transport_error' },
          })
          return
        }
        if (isGateResponse(upstream, path)) {
          drain(upstream.stream)
          if (!recovered) {
            recovered = true
            const next = await recoverTransport()
            if (next !== null) {
              currentAuth = next
              continue
            }
          }
          sendJson(response, 502, {
            error: { message: gateMessage(gateDetail(upstream)), type: 'thu_automad_transport' },
          })
          return
        }
        handOff(upstream, response, false, () => {})
        return
      }
    }

    const facts = completionFacts(body)
    const waiting: WaitingState = {
      stopped: false,
      headersSent: false,
      heartbeatTimer: undefined,
      heartbeat: undefined,
    }
    let activeSlot: Slot | null = null
    const onClose = (): void => {
      if (response.writableEnded) return
      waiting.stopped = true
      scheduler.cancel(waiting)
      // A client can disappear between the slot grant and the upstream answer.
      // The slot belongs to this response, so closing it releases the slot even
      // when delivery never starts (otherwise the pool leaks capacity).
      activeSlot?.release(false)
      activeSlot = null
    }
    response.once('close', onClose)
    try {
      for (;;) {
        let slot: Slot | null
        try {
          slot = await scheduler.acquire(facts.model, facts.stream, response, waiting)
        } catch (error) {
          if (error instanceof QueueError && error.code === 'client_gone') return
          const message = error instanceof Error ? error.message : String(error)
          fail(response, waiting, 503, message)
          return
        }
        if (slot === null) return
        activeSlot = slot
        if (waiting.stopped || response.destroyed) {
          slot.release(false)
          activeSlot = null
          return
        }
        try {
          let currentAuth = session
          let recovered = false
          for (;;) {
            let upstream: UpstreamResponse
            try {
              upstream = await dispatch(method, path, body, request.headers, currentAuth)
            } catch (error) {
              slot.release(false)
              slot = null
              activeSlot = null
              fail(response, waiting, 502, `thu-automad: upstream unreachable: ${describe(error)}`)
              return
            }
            if (upstream.status === 429) {
              drain(upstream.stream)
              scheduler.noteRateLimit(facts.model, retryAfterMs(upstream.headers))
              slot.release(false)
              slot = null
              activeSlot = null
              break
            }
            if (isGateResponse(upstream, path)) {
              // The school's gate answered, not the gateway. Handing this
              // response on would let the provider resolve its redirect against
              // this loopback origin and turn a session problem into a 404 for
              // `/login`, which it has no way to report as anything but a
              // broken model. Convert it here, once, after one recovery try.
              drain(upstream.stream)
              if (!recovered) {
                recovered = true
                const next = await recoverTransport()
                if (next !== null) {
                  currentAuth = next
                  continue
                }
              }
              scheduler.stopHeartbeat(waiting)
              slot.release(false)
              slot = null
              activeSlot = null
              fail(response, waiting, 502, gateMessage(gateDetail(upstream)))
              return
            }
            scheduler.stopHeartbeat(waiting)
            if (waiting.stopped || response.destroyed) {
              drain(upstream.stream)
              slot.release(false)
              slot = null
              activeSlot = null
              return
            }
            const owned = slot
            slot = null
            activeSlot = null
            handOff(upstream, response, waiting.headersSent, (success) => { owned.release(success) })
            return
          }
        } finally {
          slot?.release(false)
          activeSlot = null
        }
      }
    } finally {
      response.off('close', onClose)
      scheduler.stopHeartbeat(waiting)
      activeSlot?.release(false)
      activeSlot = null
    }
  }

  const server = createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      options.log(`request failed: ${describe(error)}`)
      if (response.headersSent) response.destroy()
      else {
        sendJson(response, 500, {
          error: { message: `thu-automad: ${describe(error)}`, type: 'proxy_error' },
        })
      }
    })
  })
  server.on('clientError', (_error, socket) => { socket.destroy() })
  server.on('error', (error: Error) => {
    state.lastError = describe(error)
    options.log(`server error: ${state.lastError}`)
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = (): void => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(options.port, options.host ?? '127.0.0.1')
  })
  state.listening = true
  // A port of 0 asks the OS for one; report the port it actually chose.
  const address = server.address()
  if (address !== null && typeof address === 'object') state.port = address.port
  // A leaked server must not keep the host process alive on its own.
  server.unref()
  options.log(`listening on http://${options.host ?? '127.0.0.1'}:${String(state.port)}/v1`)

  return {
    port: state.port,
    status: () => ({ ...state, queueEnabled: scheduler.queueEnabled, pools: scheduler.snapshot() }),
    setQueueEnabled: (enabled: boolean) => { scheduler.setEnabled(enabled) },
    reset: () => {
      scheduler.reset()
      // Responses already in flight belong to the counters the reset forgot;
      // closing their connections makes the browser retry from a clean state.
      server.closeAllConnections()
    },
    close: async () => {
      state.listening = false
      await new Promise<void>((resolve) => {
        server.close(() => { resolve() })
        server.closeAllConnections()
      })
    },
  }
}

/** Parse the model and stream flag out of a completion body. */
function completionFacts(body: Buffer): CompletionFacts {
  try {
    const parsed = JSON.parse(body.toString('utf8')) as Record<string, unknown>
    const model = typeof parsed.model === 'string' && parsed.model !== '' ? parsed.model : '__default__'
    return { model, stream: parsed.stream === true }
  } catch (_notJson) {
    return { model: '__default__', stream: false }
  }
}

/**
 * Turn whatever an OpenAI-compatible client sent into the one path shape the
 * upstream understands.
 *
 * Clients disagree about whether `baseURL` already carries `/v1`: the official
 * SDK appends `chat/completions` to it, while a bare origin or a health probe
 * can arrive as `/`, `/models`, or `/v1` with no trailing slash. Normalizing
 * here keeps one routing rule and gives a 404 that names the path instead of a
 * generic refusal.
 * @param raw - the request target as received.
 * @returns a `/v1/...` path, or null when no endpoint shape matches.
 */
function normalizeRequestPath(raw: string): string | null {
  let path = raw
  if (/^https?:\/\//iu.test(path)) {
    try {
      const parsed = new URL(path)
      path = parsed.pathname + parsed.search
    } catch (_notAUrl) {
      return null
    }
  }
  if (path === '/' || path === '/v1' || path === '/v1/') return '/v1/models'
  if (path.startsWith('/v1/')) return path
  for (const suffix of ['/chat/completions', '/completions', '/models', '/embeddings', '/responses']) {
    if (path === suffix || path.startsWith(`${suffix}?`)) return `/v1${path}`
  }
  return null
}

/**
 * Send one request to the transport's upstream.
 * @param method - HTTP method from the client.
 * @param path - request path beginning with `/v1/`.
 * @param body - buffered request body.
 * @param incoming - client headers, copied minus the ones this proxy owns.
 * @param auth - token and transport facts.
 * @returns the response once headers arrived; the body is still streaming.
 */
function dispatch(
  method: string,
  path: string,
  body: Buffer,
  incoming: IncomingHttpHeaders,
  auth: ProxyAuth,
): Promise<UpstreamResponse> {
  const base = auth.mode === 'webvpn' ? auth.tunnelPrefix : SITE
  const url = new URL(base.replace(/\/+$/u, '') + path)
  const headers = copyRequestHeaders(incoming)
  headers['authorization'] = `Bearer ${auth.token}`
  headers['content-length'] = String(body.length)
  // Compressed upstream bodies would need a second stream transform only to be
  // handed to a client that asked for identity; ask for identity instead.
  headers['accept-encoding'] = 'identity'
  if (auth.mode === 'webvpn' && auth.cookie !== '') headers['cookie'] = auth.cookie

  return new Promise<UpstreamResponse>((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const request = send(url, { method, headers }, (upstream) => {
      resolve({ status: upstream.statusCode ?? 502, headers: upstream.headers, stream: upstream })
    })
    request.setTimeout(UPSTREAM_IDLE_MS, () => {
      request.destroy(new Error(`upstream did not answer within ${String(UPSTREAM_IDLE_MS)} ms`))
    })
    request.on('error', reject)
    request.end(body)
  })
}

/** Copy client headers minus the ones this proxy owns. */
function copyRequestHeaders(incoming: IncomingHttpHeaders): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(incoming)) {
    if (value === undefined) continue
    if (OWNED_HEADERS.has(name.toLowerCase())) continue
    headers[name] = Array.isArray(value) ? value.join(', ') : value
  }
  return headers
}

/**
 * Whether a response is the school's gate rather than the gateway's answer.
 *
 * A redirect is the gate itself: the OAuth form off campus, or the WebVPN login
 * page when the tunnel session is missing or expired. A completion answered
 * with the application's HTML shell is the same gate wearing HTTP 200, which no
 * completion ever is; `/v1/models` legitimately answers with that shell on
 * campus, so it is excluded.
 *
 * The distinction matters beyond retries: a gate must never reach the client.
 * Its `Location` is usually relative, and a provider client resolves it against
 * this loopback origin, so forwarding it produces a `GET /login` against the
 * proxy instead of a model answer.
 * @param response - upstream response headers.
 * @param path - request path.
 * @returns true when the response is a gate the proxy must handle itself.
 */
function isGateResponse(response: UpstreamResponse, path: string): boolean {
  if (response.status >= 300 && response.status < 400) return true
  if (!path.startsWith('/v1/chat/')) return false
  if (response.status < 200 || response.status >= 300) return false
  const type = String(response.headers['content-type'] ?? '')
  return type.includes('text/html')
}

/** Name one gate response the transport could not get past. */
function gateDetail(response: UpstreamResponse): string {
  if (response.status >= 300 && response.status < 400) {
    return `the school's gateway redirected the request (HTTP ${String(response.status)})`
  }
  return `the school's gateway answered with its application page (HTTP ${String(response.status)})`
}

/**
 * Wording for a gate the transport failed to resolve, including the one action
 * that actually repairs it. No credential, URL or cookie value is included.
 * @param detail - what the upstream did, from {@link gateDetail}.
 * @returns the message the provider reports for this turn.
 */
function gateMessage(detail: string): string {
  return `thu-automad: ${detail} and re-authentication did not establish a usable session. `
    + 'Off campus this needs the WebVPN tunnel: open 设置 → 清华 MadModel and press 立即续期, then retry'
}

/** Read a `Retry-After` header as milliseconds, when present and usable. */
function retryAfterMs(headers: IncomingHttpHeaders): number | null {
  const value = headers['retry-after']
  const text = Array.isArray(value) ? value[0] : value
  if (text === undefined) return null
  const seconds = Number(text)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 3_600_000)
  const date = Date.parse(text)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return null
}

/** Discard one response body the proxy will not deliver. */
function drain(stream: IncomingMessage): void {
  stream.on('error', () => {})
  stream.resume()
}

/**
 * Deliver one upstream response to the client and report when it ended.
 *
 * When the keepalive already sent SSE headers, a non-SSE answer (an
 * authentication refusal, a 5xx, a JSON body) cannot be delivered as JSON any
 * more; it becomes an SSE `error` event with the same status and a short
 * message. That is a rare path: it needs a request that waited long enough for
 * the keepalive to start and then failed for a non-429 reason.
 * @param upstream - response already received.
 * @param response - client response.
 * @param headersSent - whether the SSE keepalive already wrote headers.
 * @param done - called once when delivery ends, with whether it was a success.
 */
function handOff(
  upstream: UpstreamResponse,
  response: ServerResponse,
  headersSent: boolean,
  done: (success: boolean) => void,
): void {
  let finished = false
  const finish = (success: boolean): void => {
    if (finished) return
    finished = true
    done(success)
  }
  const success = upstream.status >= 200 && upstream.status < 300

  if (response.destroyed || response.writableEnded) {
    upstream.stream.destroy()
    finish(false)
    return
  }

  if (headersSent) {
    const type = String(upstream.headers['content-type'] ?? '')
    if (success && type.includes('text/event-stream')) {
      response.on('finish', () => { finish(true) })
      response.on('close', () => { finish(false) })
      upstream.stream.on('error', () => { response.destroy() })
      upstream.stream.pipe(response)
      return
    }
    void readSmall(upstream.stream).then((text) => {
      const detail = text.trim().slice(0, 300)
      const message = detail === ''
        ? `thu-automad: upstream answered HTTP ${String(upstream.status)} after the request was queued`
        : `thu-automad: upstream answered HTTP ${String(upstream.status)} after the request was queued: ${detail}`
      try {
        response.write(`event: error\ndata: ${JSON.stringify({ error: { message, type: 'thu_automad_transport', status: upstream.status } })}\n\n`)
        response.end()
      } catch (_clientGone) {
        response.destroy()
      }
      finish(false)
    })
    return
  }

  const headers: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(upstream.headers)) {
    if (value === undefined) continue
    if (RESPONSE_HOP_HEADERS.has(name.toLowerCase())) continue
    headers[name] = value
  }
  response.writeHead(upstream.status, headers)
  response.on('finish', () => { finish(success) })
  response.on('close', () => { finish(false) })
  upstream.stream.on('error', () => { response.destroy() })
  upstream.stream.on('close', () => {
    if (!response.writableEnded) finish(false)
  })
  upstream.stream.pipe(response)
}

/** Read at most a small diagnostic body, never hanging on a missing end. */
async function readSmall(stream: IncomingMessage): Promise<string> {
  return await new Promise<string>((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    stream.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > ERROR_BODY_LIMIT) {
        stream.destroy()
        resolve(Buffer.concat(chunks).toString('utf8'))
        return
      }
      chunks.push(chunk)
    })
    stream.on('end', () => { resolve(Buffer.concat(chunks).toString('utf8')) })
    stream.on('error', () => { resolve(Buffer.concat(chunks).toString('utf8')) })
  })
}

/** Read one request body into a buffer, refusing anything over the ceiling. */
function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        request.destroy()
        reject(new Error(`request body exceeds ${String(limit)} bytes`))
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => { resolve(Buffer.concat(chunks)) })
    request.on('error', reject)
  })
}

/** Fail a request that may already be in its keepalive SSE stream. */
function fail(response: ServerResponse, waiting: WaitingState, status: number, message: string): void {
  if (!waiting.headersSent) {
    sendJson(response, status, { error: { message, type: 'thu_automad_transport' } })
    return
  }
  try {
    response.write(`event: error\ndata: ${JSON.stringify({ error: { message, type: 'thu_automad_transport', status } })}\n\n`)
    response.end()
  } catch (_clientGone) {
    response.destroy()
  }
}

/** Serialize one OpenAI-shaped error and close the response. */
function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    'cache-control': 'no-store',
  })
  response.end(body)
}

/** Read a short description out of any thrown value. */
function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}