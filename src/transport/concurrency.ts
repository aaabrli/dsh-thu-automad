import type { TransportPoolStatus } from '../protocol.ts'

export interface ConcurrencyOptions {
  max: number
  perModel?: Readonly<Record<string, number>>
  queueLimit: number
  maxWaitMs: number
  heartbeatAfterMs: number
  heartbeatMs: number
  cooldownMs: number
}

export const KNOWN_MODELS = ['DeepSeek-V4.1-Flash', 'qwen3.8-27b', 'DeepSeek-R1-W8A8'] as const

export const CONCURRENCY_DEFAULTS = {
  max: 3,
  perModel: { 'qwen3.8-27b': 4, 'DeepSeek-R1-W8A8': 1 },
  queueLimit: 32,
  maxWaitMs: 0,
  heartbeatAfterMs: 20_000,
  heartbeatMs: 15_000,
  cooldownMs: 1_000,
} as const satisfies ConcurrencyOptions

export interface ModelSlot {
  accepted(): void
  started(): void
  release(success: boolean): void
}

export interface ModelRequest {
  model: string
  order: number
  title: boolean
  signal: AbortSignal
  onWait(): void
}

interface Waiter {
  request: ModelRequest
  grant(slot: ModelSlot): void
  reject(error: unknown): void
}

interface GatewayWait {
  retryAt: number
  serverUntil: number
  trial: ModelSlot | null
}

interface Pool {
  limit: number
  active: Map<ModelSlot, 'starting' | 'responding'>
  queue: Waiter[]
  gateway: GatewayWait | null
  wake: ReturnType<typeof setTimeout> | undefined
  upstreamError: { status: number | null; at: number } | null
}

export class QueueError extends Error {}

/** Owns the fixed slots and waiting requests for each model. */
export class ModelQueue {
  private readonly pools = new Map<string, Pool>()
  private enabled = true

  constructor(private readonly options: ConcurrencyOptions) {
    for (const model of KNOWN_MODELS) this.pool(model)
  }

  get queueEnabled(): boolean { return this.enabled }

  snapshot(): TransportPoolStatus[] {
    const now = Date.now()
    return Array.from(this.pools, ([model, pool]) => ({
      model,
      limit: pool.limit,
      inFlight: pool.active.size,
      starting: [...pool.active.values()].filter(phase => phase === 'starting').length,
      queued: pool.queue.length,
      pausedUntil: pool.gateway !== null && pool.gateway.retryAt > now ? pool.gateway.retryAt : null,
      recovering: pool.gateway?.trial != null && pool.gateway.retryAt <= now,
      upstreamError: pool.upstreamError === null ? null : { ...pool.upstreamError },
    }))
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    for (const pool of this.pools.values()) {
      if (!enabled) pool.gateway = null
      this.pump(pool)
    }
  }

  reset(): void {
    for (const pool of this.pools.values()) {
      clearTimeout(pool.wake)
      pool.wake = undefined
      pool.gateway = null
      pool.active.clear()
      for (const waiter of pool.queue.splice(0)) waiter.reject(new QueueError('the transport was reset'))
    }
  }

  acquire(request: ModelRequest, retry: boolean): ModelSlot | Promise<ModelSlot> {
    request.signal.throwIfAborted()
    const pool = this.pool(request.model)
    if (!this.enabled) return this.grant(pool)
    const earlier = pool.queue.findIndex(({ request: other }) => request.title === other.title
      ? request.order < other.order
      : !request.title)
    const index = earlier < 0 ? pool.queue.length : earlier
    if (index === 0 && this.canStart(pool, request.title)) return this.grant(pool)
    if (!retry && pool.queue.length >= this.options.queueLimit) {
      throw new QueueError(`${pool.queue.length} requests are already waiting for "${request.model}"`)
    }
    return new Promise<ModelSlot>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const cleanup = (): void => {
        clearTimeout(timer)
        request.signal.removeEventListener('abort', onAbort)
      }
      const waiter: Waiter = {
        request,
        grant: (slot) => { cleanup(); resolve(slot) },
        reject: (error) => { cleanup(); reject(error) },
      }
      const discard = (error: unknown): void => {
        const position = pool.queue.indexOf(waiter)
        if (position < 0) return
        pool.queue.splice(position, 1)
        waiter.reject(error)
        this.pump(pool)
      }
      const onAbort = (): void => { discard(request.signal.reason) }
      pool.queue.splice(index, 0, waiter)
      request.signal.addEventListener('abort', onAbort, { once: true })
      if (this.options.maxWaitMs > 0) {
        timer = setTimeout(() => {
          discard(new QueueError(`waited ${this.options.maxWaitMs} ms for "${request.model}"`))
        }, this.options.maxWaitMs)
      }
      request.onWait()
      this.pump(pool)
    })
  }

  refused(model: string, slot: ModelSlot, retryAfterMs: number | null): void {
    const pool = this.pool(model)
    const now = Date.now()
    const serverDelay = retryAfterMs ?? 0
    const retryAt = now + (serverDelay > 0 ? serverDelay : this.options.cooldownMs)
    const gateway = pool.gateway ??= { retryAt, serverUntil: 0, trial: null }
    if (gateway.trial === slot) gateway.retryAt = retryAt
    if (serverDelay > 0) gateway.serverUntil = Math.max(gateway.serverUntil, now + serverDelay)
    gateway.retryAt = Math.max(gateway.retryAt, gateway.serverUntil)
  }

  noteUpstreamError(model: string, status: number | null): void {
    this.pool(model).upstreamError = { status, at: Date.now() }
  }

  private pool(model: string): Pool {
    const current = this.pools.get(model)
    if (current !== undefined) return current
    const specificLimit = this.options.perModel?.[model]
    const pool: Pool = {
      limit: typeof specificLimit === 'number' ? specificLimit : this.options.max,
      active: new Map(),
      queue: [],
      gateway: null,
      wake: undefined,
      upstreamError: null,
    }
    this.pools.set(model, pool)
    return pool
  }

  private canStart(pool: Pool, title: boolean): boolean {
    if (!this.enabled) return true
    const limit = title ? Math.max(1, pool.limit - 1) : pool.limit
    const gateway = pool.gateway
    return pool.active.size < limit
      && (gateway === null || gateway.trial === null && Date.now() >= gateway.retryAt)
  }

  private grant(pool: Pool): ModelSlot {
    const slot: ModelSlot = {
      accepted: () => {
        const gateway = pool.gateway
        if (gateway?.trial !== slot) return
        gateway.trial = null
        if (Date.now() >= gateway.serverUntil) pool.gateway = null
        this.pump(pool)
      },
      started: () => {
        if (pool.active.has(slot)) pool.active.set(slot, 'responding')
      },
      release: (success) => {
        if (!pool.active.delete(slot)) return
        const gateway = pool.gateway
        if (gateway?.trial === slot) gateway.trial = null
        if (success) {
          pool.upstreamError = null
          // An actual completion frees capacity. Honor any deadline sent by the gateway.
          if (gateway !== null) gateway.retryAt = gateway.serverUntil
        }
        this.pump(pool)
      },
    }
    pool.active.set(slot, 'starting')
    if (pool.gateway !== null) pool.gateway.trial = slot
    return slot
  }

  private pump(pool: Pool): void {
    clearTimeout(pool.wake)
    pool.wake = undefined
    for (;;) {
      const waiter = pool.queue[0]
      if (waiter === undefined) return
      const delay = (pool.gateway?.retryAt ?? 0) - Date.now()
      if (delay > 0) {
        pool.wake = setTimeout(() => this.pump(pool), Math.min(delay, 2_147_483_647))
        pool.wake.unref()
        return
      }
      if (!this.canStart(pool, waiter.request.title)) return
      pool.queue.shift()
      waiter.grant(this.grant(pool))
    }
  }
}
