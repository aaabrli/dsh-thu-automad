/**
 * Behavioral check for the loopback transport.
 *
 * The proxy is the piece that lets the provider row work off campus, so the
 * cases here are the failure shapes that matter: a stale tunnel cookie must buy
 * exactly one re-authentication and one retry, the upstream must receive the
 * plugin's own Bearer and cookie rather than the provider's, SSE must reach the
 * client as it is produced, and a request without a configured token must fail
 * with a clear 503 instead of an empty success.
 *
 * Run from the package directory:
 *
 *   node node_modules/tsx/dist/cli.mjs checks/transport-smoke.ts
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { startTransportProxy } from '../src/transport/proxy.ts'
import { CONCURRENCY_DEFAULTS } from '../src/transport/concurrency.ts'

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

// Model discovery is served by the loopback itself: no credential, no upstream
// call, and no admission slot. This is the request shape an SDK picks when its
// baseURL handling drops `/v1`, and it must not turn into a 404.
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
  assert.equal(pools.find(pool => pool.model === 'DeepSeek-V4.1-Flash')?.ceiling, 3)
  assert.equal(pools.find(pool => pool.model === 'qwen3.8-27b')?.ceiling, 4)
  assert.equal(pools.find(pool => pool.model === 'DeepSeek-R1-W8A8')?.ceiling, 1)
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
  concurrency: Record<string, number>,
): Promise<Awaited<ReturnType<typeof startTransportProxy>>> {
  return await startTransportProxy({
    port: 0,
    concurrency: concurrency as never,
    resolveAuth: async () => ({ token: TOKEN, mode: 'webvpn', cookie: GOOD_COOKIE, tunnelPrefix: origin }),
    refresh: async () => false,
    log: () => {},
  })
}

/**
 * Two requests, one slot: the second must wait for the first to finish.
 */
{
  const gateway = await startCompletionGateway((_request, finish) => {
    finish(120, 'data: [DONE]\n\n')
  })
  const proxy = await startQueueProxy(gateway.origin, {
    initial: 1, max: 1, min: 1, growAfter: 10, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 1_000, heartbeatMs: 1_000, cooldownMs: 1_000, maxCooldownMs: 1_000,
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
    initial: 1, max: 1, min: 1, growAfter: 10, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 1_000, heartbeatMs: 1_000, cooldownMs: 20, maxCooldownMs: 40,
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

/**
 * A request that waits long enough for a keepalive gets SSE comments, then the
 * real answer on the same connection.
 */
{
  const gateway = await startCompletionGateway((_request, finish) => {
    finish(700, 'data: [DONE]\n\n')
  })
  const proxy = await startQueueProxy(gateway.origin, {
    initial: 1, max: 1, min: 1, growAfter: 10, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 50, heartbeatMs: 50, cooldownMs: 1_000, maxCooldownMs: 1_000,
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
    initial: 1, max: 1, min: 1, growAfter: 10, queueLimit: 1, maxWaitMs: 0,
    heartbeatAfterMs: 1_000, heartbeatMs: 1_000, cooldownMs: 1_000, maxCooldownMs: 1_000,
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

/**
 * A client that disconnects while its completion is open must return the slot.
 * Without that, an aborted turn leaves a phantom "in flight" request and every
 * later conversation waits for capacity that nothing is using.
 */
{
  const hanging = createServer((request, response) => {
    request.resume()
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write(': still open\n\n')
      // Deliberately no end: the client is the one that walks away.
    })
  })
  await new Promise<void>((resolve, reject) => {
    hanging.once('error', reject)
    hanging.listen(0, '127.0.0.1', () => { resolve() })
  })
  const origin = `http://127.0.0.1:${String((hanging.address() as AddressInfo).port)}`
  const proxy = await startQueueProxy(origin, {
    initial: 1, max: 1, min: 1, growAfter: 10, queueLimit: 8, maxWaitMs: 0,
    heartbeatAfterMs: 1_000, heartbeatMs: 1_000, cooldownMs: 1_000, maxCooldownMs: 1_000,
  })
  const send = (signal?: AbortSignal): Promise<Response> => fetch(
    `http://127.0.0.1:${String(proxy.port)}/v1/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'DeepSeek-V4.1-Flash', messages: [], stream: true }),
      ...(signal === undefined ? {} : { signal }),
    },
  )

  const controller = new AbortController()
  const first = await send(controller.signal)
  assert.equal(first.status, 200)
  controller.abort()
  await new Promise(resolve => setTimeout(resolve, 150))

  const second = await Promise.race([
    send(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => { reject(new Error('the aborted request leaked its admission slot')) }, 1_500)
    }),
  ])
  assert.equal(second.status, 200, 'the slot is returned after the client disconnects')
  await proxy.close()
  hanging.closeAllConnections()
  await new Promise<void>((resolve) => { hanging.close(() => { resolve() }) })
}

await gateway.close()
console.log('transport-smoke: ok')