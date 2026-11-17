import { createServer, request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pipeline } from 'node:stream/promises'
import { SITE } from '../auth/chain.ts'
import type { TransportPoolStatus } from '../protocol.ts'
import { CONCURRENCY_DEFAULTS, KNOWN_MODELS, ModelQueue, QueueError } from './concurrency.ts'
import type { ConcurrencyOptions, ModelRequest, ModelSlot } from './concurrency.ts'

export type EffectiveTransport = 'direct' | 'webvpn'

export interface ProxyAuth {
  token: string
  mode: EffectiveTransport
  cookie: string
  tunnelPrefix: string
}

export interface ProxyOptions {
  port: number
  host?: string
  maxBodyBytes?: number
  concurrency?: ConcurrencyOptions
  resolveAuth: () => Promise<ProxyAuth | null>
  refresh: () => Promise<boolean>
  log: (message: string) => void
}

export interface ProxyStatus {
  listening: boolean
  port: number
  lastError: string | null
  queueEnabled: boolean
  pools: TransportPoolStatus[]
}

export interface RunningProxy {
  readonly port: number
  status(): ProxyStatus
  setQueueEnabled(enabled: boolean): void
  reset(): void
  close(): Promise<void>
}

/** Local transport metadata for a DSH title request. */
export const TITLE_REQUEST_HEADER = 'x-dsh-thu-automad-title'

const REQUEST_HEADERS = new Set([
  'host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length',
  'authorization', 'cookie', 'accept-encoding', TITLE_REQUEST_HEADER,
])
const RESPONSE_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'location'])
const MAX_BODY_BYTES = 64 * 1024 * 1024
const UPSTREAM_IDLE_MS = 10 * 60 * 1000
const LOGIN_FAILURE_INTERVAL_MS = 15_000
const LOGIN_SUCCESS_INTERVAL_MS = 5_000

interface UpstreamResponse {
  status: number
  headers: IncomingHttpHeaders
  stream: IncomingMessage
}

interface ForwardRequest {
  method: string
  path: string
  body: Buffer
  headers: IncomingHttpHeaders
  signal: AbortSignal
}

class RelayError extends Error {
  constructor(readonly status: number, message: string, readonly code = 'thu_automad_transport') {
    super(message)
  }
}

export async function startTransportProxy(options: ProxyOptions): Promise<RunningProxy> {
  const concurrency = options.concurrency ?? CONCURRENCY_DEFAULTS
  const queue = new ModelQueue(concurrency)
  const host = options.host ?? '127.0.0.1'
  let order = 0
  let login: Promise<ProxyAuth | null> | undefined
  let loginRetryAt = 0

  /** A single WebVPN recovery serves concurrent callers. */
  const recover = (): Promise<ProxyAuth | null> => {
    if (login !== undefined) return login
    if (Date.now() < loginRetryAt) return Promise.resolve(null)
    login = Promise.resolve().then(async () => {
      let auth: ProxyAuth | null = null
      try {
        if (await options.refresh()) auth = await options.resolveAuth()
        return auth
      } catch (error) {
        options.log(`re-authentication failed: ${describe(error)}`)
        return null
      } finally {
        loginRetryAt = Date.now() + (auth === null ? LOGIN_FAILURE_INTERVAL_MS : LOGIN_SUCCESS_INTERVAL_MS)
        login = undefined
      }
    })
    return login
  }

  /** Use the current route, recovering a login gate once when necessary. */
  const forward = async (request: ForwardRequest): Promise<UpstreamResponse> => {
    let auth = await options.resolveAuth()
    request.signal.throwIfAborted()
    if (auth === null) {
      throw new RelayError(503, 'no campus token is configured yet. Open 设置 → 清华 MadModel and renew once', 'missing_credential')
    }
    if (auth.mode === 'webvpn' && auth.cookie === '') {
      auth = await recover()
      request.signal.throwIfAborted()
      if (auth === null || auth.mode === 'webvpn' && auth.cookie === '') {
        throw gateError('no WebVPN tunnel session could be established')
      }
    }

    let upstream = await dispatch(request, auth)
    if (!isGate(upstream, request.path)) return upstream
    drain(upstream.stream)
    const next = await recover()
    request.signal.throwIfAborted()
    if (next === null || next.mode === 'webvpn' && next.cookie === '') throw gateError(gateDetail(upstream))
    upstream = await dispatch(request, next)
    if (!isGate(upstream, request.path)) return upstream
    drain(upstream.stream)
    throw gateError(gateDetail(upstream))
  }

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const method = request.method ?? 'GET'
    const rawPath = request.url ?? '/'
    const path = normalizePath(rawPath)
    if (path === null) {
      sendError(response, 404, `unsupported request path (${method} ${rawPath})`, 'not_found')
      return
    }
    if (method === 'GET' && path === '/v1/models') {
      sendJson(response, 200, {
        object: 'list',
        data: KNOWN_MODELS.map(id => ({ id, object: 'model', owned_by: 'madmodel' })),
      })
      return
    }

    const controller = new AbortController()
    const { signal } = controller
    response.once('close', () => {
      if (!response.writableFinished) controller.abort()
    })
    const position = order++

    let body: Buffer
    try {
      body = await readBody(request, options.maxBodyBytes ?? MAX_BODY_BYTES)
    } catch (error) {
      sendError(response, 413, describe(error), 'request_too_large')
      return
    }
    if (signal.aborted || response.destroyed) return
    const facts = completionFacts(body)
    const heartbeat = queueHeartbeat(response, concurrency)
    const job: ModelRequest | null = method === 'GET' ? null : {
      model: facts.model,
      order: position,
      title: request.headers[TITLE_REQUEST_HEADER] === '1',
      signal,
      onWait: () => { if (facts.stream) heartbeat.start() },
    }
    const outgoing = { method, path, body, headers: request.headers, signal }

    try {
      let retry = false
      for (;;) {
        let slot: ModelSlot | null = null
        let success = false
        const releaseAborted = (): void => { slot?.release(false) }
        try {
          if (job !== null) slot = await queue.acquire(job, retry)
          heartbeat.admitted()
          signal.throwIfAborted()
          signal.addEventListener('abort', releaseAborted, { once: true })

          const upstream = await forward(outgoing)
          if (signal.aborted || response.destroyed) {
            upstream.stream.destroy()
            return
          }
          if (slot !== null && upstream.status === 429 && queue.queueEnabled) {
            drain(upstream.stream)
            queue.refused(facts.model, slot, retryAfterMs(upstream.headers))
            retry = true
            continue
          }
          heartbeat.stop()
          if (slot !== null) {
            if (isSuccess(upstream.status)) slot.accepted()
            if (upstream.status >= 500 && upstream.status < 600) queue.noteUpstreamError(facts.model, upstream.status)
          }
          const activeSlot = slot
          success = await deliver(
            upstream, response,
            () => { activeSlot?.started() },
            () => { if (activeSlot !== null) queue.noteUpstreamError(facts.model, null) },
          )
          return
        } catch (error) {
          if (signal.aborted) return
          if (error instanceof QueueError) sendError(response, 503, error.message)
          else if (error instanceof RelayError) sendError(response, error.status, error.message, error.code)
          else {
            if (slot !== null) queue.noteUpstreamError(facts.model, null)
            sendError(response, 502, `upstream unreachable: ${describe(error)}`)
          }
          return
        } finally {
          signal.removeEventListener('abort', releaseAborted)
          slot?.release(success)
        }
      }
    } finally {
      heartbeat.stop()
    }
  }

  const state = { listening: false, lastError: null as string | null }
  const server = createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      options.log(`request failed: ${describe(error)}`)
      sendError(response, 500, describe(error), 'proxy_error')
    })
  })
  server.on('clientError', (_error, socket) => { socket.destroy() })
  server.on('error', (error) => {
    state.lastError = describe(error)
    options.log(`server error: ${state.lastError}`)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, host, () => {
      server.off('error', reject)
      resolve()
    })
  })
  server.unref()
  state.listening = true
  const address = server.address()
  const port = address !== null && typeof address === 'object' ? address.port : options.port
  options.log(`listening on http://${host}:${port}/v1`)

  return {
    port,
    status: () => ({ ...state, port, queueEnabled: queue.queueEnabled, pools: queue.snapshot() }),
    setQueueEnabled: (enabled) => { queue.setEnabled(enabled) },
    reset: () => {
      server.closeAllConnections()
      queue.reset()
    },
    close: async () => {
      state.listening = false
      queue.reset()
      await new Promise<void>((resolve) => {
        server.close(() => { resolve() })
        server.closeAllConnections()
      })
    },
  }
}

function completionFacts(body: Buffer): { model: string; stream: boolean } {
  try {
    const parsed = JSON.parse(body.toString('utf8')) as { model?: unknown; stream?: unknown } | null
    return {
      model: typeof parsed?.model === 'string' && parsed.model ? parsed.model : '<unknown>',
      stream: parsed?.stream === true,
    }
  } catch {
    return { model: '<unknown>', stream: false }
  }
}

function normalizePath(raw: string): string | null {
  let path = raw
  if (/^https?:\/\//iu.test(path)) {
    try {
      const url = new URL(path)
      path = url.pathname + url.search
    } catch {
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

function dispatch(request: ForwardRequest, auth: ProxyAuth): Promise<UpstreamResponse> {
  const base = auth.mode === 'webvpn' ? auth.tunnelPrefix : SITE
  const url = new URL(base.replace(/\/+$/u, '') + request.path)
  const headers = copyHeaders(request.headers, REQUEST_HEADERS)
  headers.authorization = `Bearer ${auth.token}`
  headers['content-length'] = String(request.body.length)
  headers['accept-encoding'] = 'identity'
  if (auth.mode === 'webvpn') headers.cookie = auth.cookie
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const outgoing = send(url, { method: request.method, headers, signal: request.signal }, (stream) => {
      resolve({ status: stream.statusCode ?? 502, headers: stream.headers, stream })
    })
    outgoing.setTimeout(UPSTREAM_IDLE_MS, () => {
      outgoing.destroy(new Error('the upstream connection became idle'))
    })
    outgoing.on('error', reject)
    outgoing.end(request.body)
  })
}

function copyHeaders(source: IncomingHttpHeaders, excluded: ReadonlySet<string>): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && !excluded.has(key.toLowerCase())) result[key] = value
  }
  return result
}

function isGate(upstream: UpstreamResponse, path: string): boolean {
  return upstream.status >= 300 && upstream.status < 400
    || path.startsWith('/v1/chat/') && isSuccess(upstream.status)
      && String(upstream.headers['content-type'] ?? '').includes('text/html')
}

function gateDetail(upstream: UpstreamResponse): string {
  return upstream.status >= 300 && upstream.status < 400
    ? `the school's gateway redirected the request (HTTP ${upstream.status})`
    : `the school's gateway answered with its application page (HTTP ${upstream.status})`
}

function gateError(detail: string): RelayError {
  return new RelayError(502, `${detail} and re-authentication did not establish a usable session. `
    + 'Open 设置 → 清华 MadModel and press 立即续期, then retry')
}

function retryAfterMs(headers: IncomingHttpHeaders): number | null {
  const value = headers['retry-after']
  const text = Array.isArray(value) ? value[0] : value
  if (text === undefined) return null
  const seconds = Number(text)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000
  const date = Date.parse(text)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null
}

function drain(stream: IncomingMessage): void {
  stream.on('error', () => {})
  stream.resume()
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300
}

/** Keep an already queued SSE connection open until its request can be sent. */
function queueHeartbeat(response: ServerResponse, options: ConcurrencyOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  const stop = (): void => {
    clearTimeout(timer)
    clearInterval(interval)
    timer = undefined
    interval = undefined
  }
  response.once('close', stop)
  return {
    start: () => {
      if (timer !== undefined || response.headersSent || response.destroyed) return
      timer = setTimeout(() => {
        if (response.destroyed || response.writableEnded) return
        response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' })
        response.write(': thu-automad: waiting for a free model slot\n\n')
        interval = setInterval(() => { response.write(': thu-automad: still waiting\n\n') }, options.heartbeatMs)
      }, options.heartbeatAfterMs)
    },
    admitted: () => { if (!response.headersSent) stop() },
    stop,
  }
}

async function deliver(
  upstream: UpstreamResponse, response: ServerResponse, onStart: () => void, onFailure: () => void,
): Promise<boolean> {
  if (response.destroyed || response.writableEnded) {
    upstream.stream.destroy()
    return false
  }
  const success = isSuccess(upstream.status)
  const sse = String(upstream.headers['content-type'] ?? '').includes('text/event-stream')
  if (response.headersSent && (!success || !sse)) {
    const detail = (await readSmall(upstream.stream)).trim().slice(0, 300)
    sendError(response, upstream.status, `upstream answered HTTP ${upstream.status}${detail ? `: ${detail}` : ''}`)
    return false
  }
  if (!response.headersSent) {
    response.writeHead(upstream.status, copyHeaders(upstream.headers, RESPONSE_HEADERS))
    if (success && sse) response.flushHeaders()
  }
  const onError = (): void => {
    if (!response.destroyed && !response.writableEnded) onFailure()
  }
  upstream.stream.once('error', onError)
  upstream.stream.once('data', onStart)
  try {
    await pipeline(upstream.stream, response)
    return success
  } catch {
    return false
  } finally {
    upstream.stream.off('error', onError)
    upstream.stream.off('data', onStart)
  }
}

async function readSmall(stream: IncomingMessage): Promise<string> {
  const limit = 4_096
  let text = ''
  stream.setEncoding('utf8')
  try {
    for await (const chunk of stream) {
      text += String(chunk).slice(0, limit - text.length)
      if (text.length >= limit) break
    }
  } catch {
    // Keep the detail already received if the upstream closed early.
  }
  return text
}

async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  let length = 0
  for await (const part of request) {
    const chunk: Uint8Array = part
    length += chunk.length
    if (length > limit) throw new Error(`request body exceeds ${limit} bytes`)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, length)
}

function sendError(response: ServerResponse, status: number, text: string, type = 'thu_automad_transport'): void {
  if (response.destroyed || response.writableEnded) return
  const error = { message: `thu-automad: ${text}`, type }
  if (response.headersSent) {
    response.end(`event: error\ndata: ${JSON.stringify({ error: { ...error, status } })}\n\n`)
  } else sendJson(response, status, { error })
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(body)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
