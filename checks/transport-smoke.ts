/** Check forwarding, streaming, per-model queues and cancellation. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { startTransportProxy, TITLE_REQUEST_HEADER } from '../src/transport/proxy.ts'
import type { ProxyOptions, RunningProxy } from '../src/transport/proxy.ts'
import { CONCURRENCY_DEFAULTS } from '../src/transport/concurrency.ts'
import type { ConcurrencyOptions } from '../src/transport/concurrency.ts'

const GOOD_COOKIE = 'wengine_vpn_ticket=good'
const STALE_COOKIE = 'wengine_vpn_ticket=stale'
const TOKEN = 'jwt-from-plugin'

/** What the fake gateway saw, so the forwarding facts can be asserted. */
interface Seen {
  path: string
  authorization: string | undefined
  cookie: string | undefined
  body: string
}

/** Start a fake gateway that answers like the tunneled madmodel host. */
async function startGateway(): Promise<{
  origin: string
  seen: Seen[]
  close: () => Promise<void>
}> {
  const seen: Seen[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => { body += chunk })
    request.on('end', () => {
      seen.push({
        path: request.url ?? '/',
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
        body,
      })
      const path = request.url ?? '/'
      if (path.startsWith('/v1/') && request.headers.cookie !== GOOD_COOKIE) {
        response.writeHead(302, { location: 'https://id.tsinghua.edu.cn/do/off/ui/auth/login' })
        response.end()
        return
      }
      if (path === '/v1/models') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ data: [{ id: 'DeepSeek-V4.1-Flash' }] }))
        return
      }
      if (path === '/v1/embeddings') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ data: [] }))
        return
      }
      if (path === '/v1/chat/completions') {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.write('data: {"choices":[{"delta":{"content":"he"}}]}\n\n')
        setTimeout(() => {
          response.write('data: {"choices":[{"delta":{"content":"llo"}}]}\n\n')
          response.end('data: [DONE]\n\n')
        }, 10)
        return
      }
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end('{"error":{"message":"not found"}}')
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { resolve() })
  })
  server.unref()
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${String(port)}`,
    seen,
    close: async () => {
      await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
    },
  }
}

const gateway = await startGateway()
let cookie = STALE_COOKIE
let refreshes = 0

const proxy = await startTransportProxy({
  port: 0,
  resolveAuth: async () => ({
    token: TOKEN,
    mode: 'webvpn',
    cookie,
    tunnelPrefix: gateway.origin,
  }),
  refresh: async () => {
    refreshes += 1
    cookie = GOOD_COOKIE
    return true
  },
  log: () => {},
})

// A stale cookie must be repaired and the request retried with the same body.
{
  const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/v1/embeddings`, {
    headers: { authorization: 'Bearer what-the-provider-sent' },
  })
  assert.equal(response.status, 200, 'a stale tunnel cookie is repaired and retried')
  assert.equal(refreshes, 1, 'exactly one re-authentication is spent')
  const last = gateway.seen.at(-1)
  assert.equal(last?.path, '/v1/embeddings', 'the normalized path reached the upstream')
  assert.equal(last?.authorization, `Bearer ${TOKEN}`, 'the plugin token replaces the provider token')
  assert.equal(last?.cookie, GOOD_COOKIE, 'the plugin cookie travels with the request')
}

// ── the school's gate never reaches the provider ──────────────────────────

/** Report a login gate after one unsuccessful session recovery. */
{
  let logins = 0
  const gate = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      response.writeHead(302, { location: '/login' })
      response.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    gate.once('error', reject)
    gate.listen(0, '127.0.0.1', () => { resolve() })
  })
  gate.unref()
  const origin = `http://127.0.0.1:${String((gate.address() as AddressInfo).port)}`
  const blocked = await startTransportProxy({
    port: 0,
    resolveAuth: async () => ({ token: TOKEN, mode: 'webvpn', cookie: GOOD_COOKIE, tunnelPrefix: origin }),
    refresh: async () => {
      logins += 1
      return false
    },
    log: () => {},
  })
  const send = (): Promise<Response> => fetch(`http://127.0.0.1:${String(blocked.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })

  const response = await send()
  assert.equal(response.status, 502, 'a gate is reported instead of being forwarded')
  assert.equal(response.headers.get('location'), null, 'a login redirect never reaches the provider')
  const body = await response.json() as { error: { message: string; type: string } }
  assert.equal(body.error.type, 'thu_automad_transport')
  assert.match(body.error.message, /redirected/u, 'the message says the gateway redirected')
  assert.match(body.error.message, /立即续期/u, 'the message names the one action that repairs it')
  assert.equal(logins, 1, 'one gate buys exactly one re-authentication')

  // The provider retries a failed step immediately; those retries must not each
  // cost the account a login attempt against the school.
  const retried = await send()
  assert.equal(retried.status, 502)
  await retried.text()
  assert.equal(logins, 1, 'a retry storm spends one login, not one per request')
  await blocked.close()
  await new Promise<void>((resolve) => { gate.close(() => { resolve() }) })
}

// ── the production shape: off campus with no tunnel session at all ────────

/**
 * The incident this transport was fixed for: the Wi-Fi switches to a phone
 * hotspot, the network decision flips to `webvpn`, and no session has ever been
 * established. The gateway must not be asked a question only a login page can
 * answer, and the provider must not receive that page either.
 */
{
  let dispatched = 0
  const silent = createServer((request, response) => {
    dispatched += 1
    request.resume()
    request.on('end', () => {
      response.writeHead(302, { location: '/login' })
      response.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    silent.once('error', reject)
    silent.listen(0, '127.0.0.1', () => { resolve() })
  })
  silent.unref()
  const origin = `http://127.0.0.1:${String((silent.address() as AddressInfo).port)}`
  const cold = await startTransportProxy({
    port: 0,
    resolveAuth: async () => ({ token: TOKEN, mode: 'webvpn', cookie: '', tunnelPrefix: origin }),
    refresh: async () => false,
    log: () => {},
  })
  const response = await fetch(`http://127.0.0.1:${String(cold.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })
  assert.equal(response.status, 502)
  const body = await response.json() as { error: { message: string } }
  assert.match(body.error.message, /no WebVPN tunnel session/u)
  assert.match(body.error.message, /立即续期/u)
  assert.equal(dispatched, 0, 'a request with no session is never dispatched to the gate')
  await cold.close()
  await new Promise<void>((resolve) => { silent.close(() => { resolve() }) })
}

/** Establish a WebVPN session before forwarding the completion. */
{
  let signedIn = false
  let logins = 0
  const cookies: (string | undefined)[] = []
  const tunnel = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      cookies.push(request.headers.cookie)
      if (request.headers.cookie !== GOOD_COOKIE) {
        response.writeHead(302, { location: '/login' })
        response.end()
        return
      }
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end('data: [DONE]\n\n')
    })
  })
  await new Promise<void>((resolve, reject) => {
    tunnel.once('error', reject)
    tunnel.listen(0, '127.0.0.1', () => { resolve() })
  })
  tunnel.unref()
  const origin = `http://127.0.0.1:${String((tunnel.address() as AddressInfo).port)}`
  const cold = await startTransportProxy({
    port: 0,
    resolveAuth: async () => ({
      token: TOKEN,
      mode: 'webvpn',
      cookie: signedIn ? GOOD_COOKIE : '',
      tunnelPrefix: origin,
    }),
    refresh: async () => {
      logins += 1
      signedIn = true
      return true
    },
    log: () => {},
  })
  const response = await fetch(`http://127.0.0.1:${String(cold.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })
  assert.equal(response.status, 200, 'the session is established before the request is dispatched')
  assert.equal(logins, 1, 'one sign-in, and no wasted gate round trip')
  assert.deepEqual(cookies, [GOOD_COOKIE], 'the gate was never asked without a session')
  await cold.close()
  await new Promise<void>((resolve) => { tunnel.close(() => { resolve() }) })
}

// Serve the configured model catalogue locally.
{
  const before = gateway.seen.length
  const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/v1/models`)
  assert.equal(response.status, 200, 'model discovery is answered locally')
  const body = await response.json() as { data: { id: string }[] }
  assert.equal(body.data[0]?.id, 'DeepSeek-V4.1-Flash')
  assert.equal(gateway.seen.length, before, 'discovery is not forwarded upstream')
  assert.equal(refreshes, 1, 'discovery needs no re-authentication')
}

// A baseURL without `/v1` is normalized instead of refused.
{
  const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [{ role: 'user', content: 'hi' }], stream: true }),
  })
  assert.equal(response.status, 200, 'a completion path without /v1 is normalized')
  assert.equal(gateway.seen.at(-1)?.path, '/v1/chat/completions')
}

// SSE must be delivered chunk by chunk, not buffered into one JSON body.
{
  const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [{ role: 'user', content: 'hi' }], stream: true }),
  })
  assert.equal(response.status, 200)
  assert.match(String(response.headers.get('content-type')), /text\/event-stream/u)
  const text = await response.text()
  assert.match(text, /he/u)
  assert.match(text, /llo/u)
  assert.match(text, /\[DONE\]/u)
  assert.equal(gateway.seen.at(-1)?.body.includes('"stream":true'), true, 'the request body reached the upstream')
}

// An unknown path is refused locally with the offending path in the message.
{
  const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/health`)
  assert.equal(response.status, 404)
  const body = await response.json() as { error: { message: string } }
  assert.match(body.error.message, /GET \/health/u)
}

await proxy.close()

// No token yet: the provider gets a clear answer, not a hang.
{
  const empty = await startTransportProxy({
    port: 0,
    resolveAuth: async () => null,
    refresh: async () => false,
    log: () => {},
  })
  const response = await fetch(`http://127.0.0.1:${String(empty.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })
  assert.equal(response.status, 503)
  const body = await response.json() as { error: { type: string } }
  assert.equal(body.error.type, 'missing_credential')
  await empty.close()

// The gateway limits each model separately; the seeded pools must report those
// ceilings before any request exists, so the settings page can label them.
{
  const perModel = await startTransportProxy({
    port: 0,
    concurrency: {
      ...CONCURRENCY_DEFAULTS,
      perModel: { 'qwen3.8-27b': 4, 'DeepSeek-R1-W8A8': 1 },
    },
    resolveAuth: async () => null,
    refresh: async () => false,
    log: () => {},
  })
  const pools = perModel.status().pools
  assert.equal(pools.find(pool => pool.model === 'DeepSeek-V4.1-Flash')?.limit, 3)
  assert.equal(pools.find(pool => pool.model === 'qwen3.8-27b')?.limit, 4)
  assert.equal(pools.find(pool => pool.model === 'DeepSeek-R1-W8A8')?.limit, 1)
  assert.equal(pools.every(pool => pool.inFlight === 0), true, 'idle pools start empty')
  await perModel.close()
}
}

// ── admission control ─────────────────────────────────────────────────────

/** Start a gateway that answers one chat completion per request. */
async function startCompletionGateway(
  respond: (request: { attempt: number; active: number }, finish: (delayMs: number, body: string) => void) => void,
): Promise<{ origin: string; close: () => Promise<void>; stats: { active: number; maxActive: number; attempts: number } }> {
  const stats = { active: 0, maxActive: 0, attempts: 0 }
  const server = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      stats.attempts += 1
      stats.active += 1
      stats.maxActive = Math.max(stats.maxActive, stats.active)
      respond({ attempt: stats.attempts, active: stats.active }, (delayMs, body) => {
        setTimeout(() => {
          stats.active -= 1
          response.writeHead(200, { 'content-type': 'text/event-stream' })
          response.end(body)
        }, delayMs)
      })
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { resolve() })
  })
  server.unref()
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${String(port)}`,
    stats,
    close: async () => { await new Promise<void>((resolve) => { server.close(() => { resolve() }) }) },
  }
}

/** Start a proxy bound to one fake gateway. */
async function startQueueProxy(
  origin: string,
  concurrency: Partial<ConcurrencyOptions>,
  overrides: Partial<Pick<ProxyOptions, 'resolveAuth'>> = {},
): Promise<Awaited<ReturnType<typeof startTransportProxy>>> {
  return await startTransportProxy({
    port: 0,
    concurrency: { ...CONCURRENCY_DEFAULTS, ...concurrency },
    resolveAuth: async () => ({ token: TOKEN, mode: 'webvpn', cookie: GOOD_COOKIE, tunnelPrefix: origin }),
    refresh: async () => false,
    log: () => {},
    ...overrides,
  })
}

/** Hold each upstream response until the test releases it. */
async function startHeldGateway() {
  const requests: { name: string; title: unknown; authorization: string | undefined; response: ServerResponse }[] = []
  const server = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      requests.push({
        name: String(request.headers['x-check-request']),
        title: request.headers[TITLE_REQUEST_HEADER],
        authorization: request.headers.authorization,
        response,
      })
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    origin: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    requests,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}

const flash = 'DeepSeek-V4.1-Flash'
const readingOf = (proxy: RunningProxy) => {
  const pool = proxy.status().pools.find(pool => pool.model === flash)
  assert.ok(pool)
  return pool
}

function sendCompletion(
  proxy: RunningProxy, name: string, { signal, title = false }: { signal?: AbortSignal; title?: boolean } = {},
): Promise<Response> {
  return fetch(`http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-check-request': name,
      ...(title ? { [TITLE_REQUEST_HEADER]: '1' } : {}),
    },
    body: JSON.stringify({ model: flash, messages: [], stream: true }),
    signal: signal === undefined ? AbortSignal.timeout(5_000) : signal,
  })
}

async function until(condition: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 2_500
  while (!condition() && Date.now() < deadline) await delay(10)
  assert.ok(condition(), message)
}

function finishStream(response: ServerResponse): void {
  if (!response.headersSent) response.writeHead(200, { 'content-type': 'text/event-stream' })
  response.end('data: [DONE]\n\n')
}

/**
 * Two requests, one slot: the second must wait for the first to finish.
 */
{
  const gateway = await startCompletionGateway((_request, finish) => {
    finish(120, 'data: [DONE]\n\n')
  })
  const proxy = await startQueueProxy(gateway.origin, {
    max: 1, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 1_000, heartbeatMs: 1_000, cooldownMs: 1_000,
  })
  const send = async (): Promise<number> => {
    const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
    })
    await response.text()
    return response.status
  }
  const [a, b] = await Promise.all([send(), send()])
  assert.equal(a, 200)
  assert.equal(b, 200)
  assert.equal(gateway.stats.maxActive, 1, 'a one-slot pool never runs two completions at once')
  await proxy.close()
  await gateway.close()
}

/**
 * A 429 is retried on the same request instead of surfacing to the caller.
 */
{
  let attempts = 0
  const server = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      attempts += 1
      if (attempts <= 2) {
        response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' })
        response.end('{"error":{"type":"rate_limit_error","code":429}}')
        return
      }
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end('data: [DONE]\n\n')
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { resolve() })
  })
  server.unref()
  const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  const proxy = await startQueueProxy(origin, {
    max: 1, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 1_000, heartbeatMs: 1_000, cooldownMs: 20,
  })
  const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })
  const text = await response.text()
  assert.equal(response.status, 200, 'the caller never sees the 429')
  assert.match(text, /\[DONE\]/u)
  assert.equal(attempts, 3, 'the same request was retried twice')
  await proxy.close()
  await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
}

// Extended upstream saturation does not reduce the model's slot limit.
{
  let attempts = 0
  const server = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      attempts += 1
      if (attempts <= 10) {
        response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' })
        response.end('{"error":{"type":"rate_limit_error","code":429}}')
        return
      }
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end('data: [DONE]\n\n')
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { resolve() })
  })
  server.unref()
  const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  const proxy = await startQueueProxy(origin, {
    max: 3, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 20, heartbeatMs: 20, cooldownMs: 20,
  })
  const reading = () => proxy.status().pools.find(pool => pool.model === 'DeepSeek-V4.1-Flash')
  const response = await fetch(`http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })
  const text = await response.text()
  assert.equal(response.status, 200, 'the refused request is served once a slot frees')
  assert.match(text, /\[DONE\]/u)
  assert.equal(attempts, 11, 'each refusal put the same request back in the queue')
  assert.equal(reading()?.limit, 3, 'the slot count comes from the model configuration')
  assert.equal(reading()?.queued, 0, 'nothing is left waiting after the answer')
  await proxy.close()
  await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
}

/**
 * A request that waits long enough for a keepalive gets SSE comments, then the
 * real answer on the same connection.
 */
{
  const gateway = await startCompletionGateway((_request, finish) => {
    finish(700, 'data: [DONE]\n\n')
  })
  const proxy = await startQueueProxy(gateway.origin, {
    max: 1, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 50, heartbeatMs: 50, cooldownMs: 1_000,
  })
  const send = (): Promise<Response> => fetch(`http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })
  const first = send()
  await new Promise(resolve => setTimeout(resolve, 80))
  const second = await send()
  const [firstText, secondText] = await Promise.all([first.then(r => r.text()), second.text()])
  assert.match(firstText, /\[DONE\]/u)
  assert.match(secondText, /thu-automad: waiting/u, 'the queued stream is kept alive with SSE comments')
  assert.match(secondText, /\[DONE\]/u, 'and still carries the upstream answer')
  await proxy.close()
  await gateway.close()
}

/**
 * A queue that is full refuses the next request with a clear 503 rather than
 * letting it wait forever.
 */
{
  const gateway = await startCompletionGateway((_request, finish) => {
    finish(600, 'data: [DONE]\n\n')
  })
  const proxy = await startQueueProxy(gateway.origin, {
    max: 1, queueLimit: 1, maxWaitMs: 0,
    heartbeatAfterMs: 1_000, heartbeatMs: 1_000, cooldownMs: 1_000,
  })
  const send = (): Promise<Response> => fetch(`http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
  })
  const first = send()
  await new Promise(resolve => setTimeout(resolve, 60))
  const second = send()
  await new Promise(resolve => setTimeout(resolve, 60))
  const third = await send()
  assert.equal(third.status, 503)
  const body = await third.json() as { error: { message: string } }
  assert.match(body.error.message, /already waiting/u)
  await Promise.all([first.then(r => r.text()), second.then(r => r.text())])
  await proxy.close()
  await gateway.close()
}

// Stopping a completion closes the upstream connection as well as its slot.
for (const streaming of [false, true]) {
  const held = await startHeldGateway()
  const proxy = await startQueueProxy(held.origin, { max: 1 })
  const controller = new AbortController()
  const result = sendCompletion(proxy, 'cancelled', { signal: controller.signal }).catch(error => error)
  try {
    await until(() => held.requests.length === 1, 'the gateway received the request')
    const { response } = held.requests[0]
    if (streaming) {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write('data: partial\n\n')
      assert.equal((await result).status, 200)
    }
    assert.equal(readingOf(proxy).inFlight, 1)
    controller.abort()
    await until(() => response.destroyed && readingOf(proxy).inFlight === 0, 'both gateway and proxy released the request')
    assert.equal(readingOf(proxy).upstreamError, null, 'a cancellation does not report an upstream outage')
    const next = sendCompletion(proxy, 'next')
    await until(() => held.requests.length === 2, 'the next request uses the freed slot')
    finishStream(held.requests[1].response)
    assert.match(await (await next).text(), /\[DONE\]/u)
  } finally {
    controller.abort()
    await proxy.close()
    await held.close()
  }
}

// Three overlapping 429s are one cooldown. Older requests keep their place even with a full queue.
{
  const held = await startHeldGateway()
  const proxy = await startQueueProxy(held.origin, { queueLimit: 1, cooldownMs: 50 })
  const pending: Promise<Response>[] = []
  try {
    for (const name of ['a', 'b', 'c']) {
      pending.push(sendCompletion(proxy, name))
      await until(() => held.requests.length === pending.length, 'the model used its configured slots')
    }
    pending.push(sendCompletion(proxy, 'd'))
    await until(() => readingOf(proxy).queued === 1, 'the new-request queue is full')
    for (const { response } of held.requests.slice(0, 3).reverse()) {
      response.writeHead(429, { 'retry-after': '1', 'content-type': 'application/json' })
      response.end('{}')
    }
    await until(() => readingOf(proxy).queued === 4, 'all previously admitted requests can requeue')
    const cooling = readingOf(proxy)
    assert.equal(cooling.limit, 3, 'overlapping refusals count as one cooldown')
    assert.ok((cooling.pausedUntil ?? 0) - Date.now() > 500, 'the gateway Retry-After is respected')
    await until(() => held.requests.length === 4, 'the cooldown starts one trial')
    await delay(50)
    assert.equal(held.requests.length, 4, 'other requests wait for the trial response')
    assert.equal(held.requests[3].name, 'a', 'the oldest refused request goes first')
    assert.equal(readingOf(proxy).recovering, true)
    held.requests[3].response.writeHead(200, { 'content-type': 'text/event-stream' })
    held.requests[3].response.flushHeaders()
    await until(() => held.requests.length === 6, 'an accepted trial reopens free slots while its stream is still open')
    assert.deepEqual(held.requests.slice(4, 6).map(request => request.name).sort(), ['b', 'c'])
    held.requests.slice(3, 6).forEach(({ response }) => finishStream(response))
    await until(() => held.requests.length === 7, 'the waiting newcomer is then sent')
    assert.equal(held.requests[6].name, 'd')
    finishStream(held.requests[6].response)
    await Promise.all(pending.map(async result => assert.match(await (await result).text(), /\[DONE\]/u)))
  } finally {
    await proxy.close()
    await held.close()
    await Promise.allSettled(pending)
  }
}

// A title waits behind a conversation when there is only one free slot.
{
  const held = await startHeldGateway()
  const proxy = await startQueueProxy(held.origin, {})
  const pending: Promise<Response>[] = []
  try {
    pending.push(sendCompletion(proxy, 'chat-a'), sendCompletion(proxy, 'chat-b'))
    await until(() => held.requests.length === 2, 'two chats are in progress')
    pending.push(sendCompletion(proxy, 'title', { title: true }))
    await until(() => readingOf(proxy).queued === 1, 'title waits for spare capacity')
    pending.push(sendCompletion(proxy, 'chat-c'))
    await until(() => held.requests.length === 3, 'chat starts without waiting behind the title')
    assert.equal(held.requests[2].name, 'chat-c')
    finishStream(held.requests[0].response)
    finishStream(held.requests[1].response)
    await until(() => held.requests.length === 4, 'title starts when capacity becomes available')
    assert.equal(held.requests[3].name, 'title')
    assert.equal(held.requests[3].title, undefined, 'the local title marker stays inside the proxy')
    finishStream(held.requests[2].response)
    finishStream(held.requests[3].response)
    await Promise.all(pending.map(async result => assert.match(await (await result).text(), /\[DONE\]/u)))
  } finally {
    await proxy.close()
    await held.close()
    await Promise.allSettled(pending)
  }
}

// A completion opens the queue immediately and the retry reads the current token.
{
  const held = await startHeldGateway()
  let currentToken = TOKEN
  const proxy = await startQueueProxy(held.origin, { cooldownMs: 30_000 }, {
    resolveAuth: async () => ({
      token: currentToken, mode: 'webvpn', cookie: GOOD_COOKIE, tunnelPrefix: held.origin,
    }),
  })
  try {
    const running = sendCompletion(proxy, 'running')
    await until(() => held.requests.length === 1, 'the first request occupies a slot')
    const refused = sendCompletion(proxy, 'refused')
    await until(() => held.requests.length === 2, 'there is spare local capacity for the second request')
    held.requests[1].response.writeHead(429)
    held.requests[1].response.end()
    await until(() => readingOf(proxy).queued === 1, 'the gateway refusal put the request back in the queue')
    assert.ok((readingOf(proxy).pausedUntil ?? 0) - Date.now() > 25_000)
    currentToken = 'renewed-fixture-token'
    finishStream(held.requests[0].response)
    await until(() => held.requests.length === 3, 'the actual completion wakes the queue without the fallback wait')
    assert.equal(held.requests[2].name, 'refused')
    assert.equal(held.requests[2].authorization, `Bearer ${currentToken}`)
    finishStream(held.requests[2].response)
    await Promise.all([running, refused].map(async result => assert.match(await (await result).text(), /\[DONE\]/u)))
  } finally {
    await proxy.close()
    await held.close()
  }
}

// Cancelling a locally queued request removes it before the next slot opens.
{
  const held = await startHeldGateway()
  const proxy = await startQueueProxy(held.origin, { max: 1 })
  const controller = new AbortController()
  try {
    const running = sendCompletion(proxy, 'running')
    await until(() => held.requests.length === 1, 'the first request occupies the slot')
    const waiting = sendCompletion(proxy, 'waiting', { signal: controller.signal }).catch(error => error)
    await until(() => readingOf(proxy).queued === 1, 'the second request is queued')
    controller.abort()
    assert.equal((await waiting).name, 'AbortError')
    await until(() => readingOf(proxy).queued === 0, 'the canceled request is removed')
    finishStream(held.requests[0].response)
    assert.match(await (await running).text(), /\[DONE\]/u)
    assert.equal(held.requests.length, 1, 'the canceled request never reaches the gateway')
  } finally {
    controller.abort()
    await proxy.close()
    await held.close()
  }
}

// An idle slot forwards the first real chunk while the upstream stream is still open.
{
  const held = await startHeldGateway()
  const proxy = await startQueueProxy(held.origin, { max: 1 })
  try {
    const pending = sendCompletion(proxy, 'first')
    await until(() => held.requests.length === 1, 'the request is dispatched without queueing')
    const { response } = held.requests[0]
    assert.equal(readingOf(proxy).queued, 0)
    assert.equal(readingOf(proxy).starting, 1)
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    response.write('data: {"choices":[{"delta":{"content":"1"}}]}\n\n')
    const streaming = await pending
    assert.equal(streaming.status, 200)
    const reader = streaming.body?.getReader()
    assert.ok(reader)
    const first = await reader.read()
    assert.match(new TextDecoder().decode(first.value), /"content":"1"/u)
    assert.equal(response.writableEnded, false, 'the gateway is still generating')
    assert.equal(readingOf(proxy).starting, 0)
    finishStream(response)
    while (!(await reader.read()).done) { /* consume the end of the same stream */ }
  } finally {
    await proxy.close()
    await held.close()
  }
}

await gateway.close()

// Service health is per model, survives an idle queue, and clears only after
// a successful completion. The provider remains the one bounded retry owner.
{
  let upstreamStatus = 502
  let truncate = false
  let sends = 0
  const service = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', chunk => { body += String(chunk) })
    request.on('end', () => {
      const { model } = JSON.parse(body) as { model: string }
      if (model !== flash) {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ choices: [{ message: { content: model } }] }))
        return
      }
      sends += 1
      if (truncate) {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')
        setTimeout(() => response.destroy(), 20)
        return
      }
      response.writeHead(upstreamStatus, { 'content-type': 'application/json' })
      response.end(upstreamStatus === 200 ? '{"choices":[{"message":{}}]}'
        : '{"error":{"message":"upstream unavailable","code":"upstream_unreachable"}}')
    })
  })
  await new Promise<void>(resolve => service.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${String((service.address() as AddressInfo).port)}`
  const healthProxy = await startQueueProxy(origin, { ...CONCURRENCY_DEFAULTS })
  const send = (model: string = flash) => fetch(`http://127.0.0.1:${String(healthProxy.port)}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages: [], stream: false }),
  })
  try {
    const failed = await send()
    assert.equal(failed.status, 502)
    assert.match(await failed.text(), /upstream_unreachable/u, 'the upstream diagnostic is preserved')
    let pool = healthProxy.status().pools.find(pool => pool.model === 'DeepSeek-V4.1-Flash')
    assert.equal(pool?.upstreamError?.status, 502)
    assert.equal(pool?.queued, 0)
    assert.equal(sends, 1, 'a 502 is not replayed by a second retry loop')
    await Promise.all(['qwen3.8-27b', 'DeepSeek-R1-W8A8'].map(async model => {
      const healthy = await send(model)
      assert.equal(healthy.status, 200)
      const answer = await healthy.json() as { choices: [{ message: { content: string } }] }
      assert.equal(answer.choices[0].message.content, model)
      assert.equal(healthProxy.status().pools.find(pool => pool.model === model)?.upstreamError, null)
    }))
    assert.equal(readingOf(healthProxy).upstreamError?.status, 502, 'healthy models do not change Flash health')
    upstreamStatus = 200
    const recovered = await send()
    await recovered.text()
    await new Promise(resolve => setImmediate(resolve))
    pool = healthProxy.status().pools.find(pool => pool.model === 'DeepSeek-V4.1-Flash')
    assert.equal(pool?.upstreamError, null, 'a successful request clears the last service failure')
    truncate = true
    const interrupted = await send()
    assert.equal(interrupted.status, 200)
    await assert.rejects(() => interrupted.text(), 'a truncated upstream response fails the client body read')
    await new Promise(resolve => setImmediate(resolve))
    pool = healthProxy.status().pools.find(pool => pool.model === 'DeepSeek-V4.1-Flash')
    assert.equal(pool?.upstreamError?.status, null)
    assert.ok(pool?.upstreamError?.at, 'an upstream interruption is recorded after headers were sent')
    await new Promise<void>(resolve => service.close(() => resolve()))
    const disconnected = await send()
    await disconnected.text()
    pool = healthProxy.status().pools.find(pool => pool.model === 'DeepSeek-V4.1-Flash')
    assert.equal(disconnected.status, 502)
    assert.equal(pool?.upstreamError?.status, null)
    assert.ok(pool?.upstreamError?.at, 'a connection failure is recorded without private diagnostic text')
  } finally {
    await healthProxy.close()
    service.closeAllConnections()
    await new Promise<void>(resolve => service.close(() => resolve()))
  }
}
console.log('transport-smoke: ok')
