/**
 * Local behavioral check for the built browser half. It is not part of the
 * harness repository; run it from this package directory:
 *
 *   ../node_modules/.bin/tsx checks/client-smoke.ts
 *
 * The bundle is a closure factory the Web client's module table executes, so
 * this check reproduces that contract: stub `window.__ModuleLoader__` and the
 * injected `require`, load the artifact the client scan would read from
 * `package.json`, and drive the real `apply` against a stub browser Context.
 *
 * It also runs the components through a minimal hook runtime, because the
 * interesting browser-side behavior — a dialog that only appears when the Host
 * parked a question, a settings page that says whether a secret is stored —
 * lives in what the second render draws, not in what the first one returns.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { AuthSettingsRequest, AutomadStatus, AuthConfigStatus, RenewStatus, TokenStatus } from '../src/protocol.ts'

/** One graph row the stub module loader captured. */
interface BootRow {
  id: string
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

/** Minimal read-and-subscribe source shape this check asserts on. */
interface StatusSource {
  getSnapshot(): { status: AutomadStatus | null; unreachable: boolean }
  subscribe(listener: () => void): () => void
}

/** What a stubbed JSX runtime hands back in place of a React element. */
interface ElementDescriptor {
  type: unknown
  props: Record<string, unknown>
}

// ── the browser environment the bundle expects ─────────────────────────────

let booted: BootRow | undefined
const styleTags: { dataset: Record<string, string>; textContent: string; removed: boolean }[] = []
const documentListeners = new Map<string, (() => void)[]>()

Object.assign(globalThis, {
  window: {
    __ModuleLoader__: {
      load: (row: BootRow) => { booted = row },
    },
    setInterval: () => 0,
    clearInterval: () => {},
  },
  document: {
    visibilityState: 'visible',
    head: { appendChild: () => {} },
    addEventListener: (type: string, handler: () => void) => {
      documentListeners.set(type, [...documentListeners.get(type) ?? [], handler])
    },
    removeEventListener: (type: string, handler: () => void) => {
      documentListeners.set(type, (documentListeners.get(type) ?? []).filter(entry => entry !== handler))
    },
    createElement: () => {
      const tag = { dataset: {} as Record<string, string>, textContent: '', removed: false, remove: () => { tag.removed = true } }
      styleTags.push(tag)
      return tag
    },
  },
})

/** Hook slots of the current render pass. */
let hooks: unknown[] = []
/** Effects queued by the current render pass. */
let pendingEffects: (() => void)[] = []
let hookIndex = 0

/** Minimal React surface: state that persists, effects that run once per pass. */
const reactStub = {
  memo: (component: unknown) => component,
  useState: (initial: unknown) => {
    const at = hookIndex
    hookIndex += 1
    if (!(at in hooks)) hooks[at] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    const set = (next: unknown): void => {
      hooks[at] = typeof next === 'function' ? (next as (current: unknown) => unknown)(hooks[at]) : next
    }
    return [hooks[at], set]
  },
  useRef: (initial: unknown) => {
    const at = hookIndex
    hookIndex += 1
    if (!(at in hooks)) hooks[at] = { current: initial }
    return hooks[at]
  },
  useEffect: (run: () => void) => { pendingEffects.push(run) },
  createElement: () => null,
  Fragment: Symbol('Fragment'),
}

/**
 * Render one component through the stub runtime.
 *
 * A state write from an effect is only visible on the next pass, which is the
 * same reason a real component renders twice; the check therefore returns the
 * tree after effects have had their chance to run.
 */
function render<P>(component: unknown, props: P): unknown {
  hookIndex = 0
  pendingEffects = []
  let tree = (component as (p: P) => unknown)(props)
  if (pendingEffects.length > 0) {
    const queued = pendingEffects
    pendingEffects = []
    for (const run of queued) run()
    hookIndex = 0
    tree = (component as (p: P) => unknown)(props)
  }
  return tree
}

/** Reset the hook runtime so an unrelated component starts clean. */
function resetHooks(): void {
  hooks = []
  hookIndex = 0
  pendingEffects = []
}

const descriptor = (type: unknown, props: Record<string, unknown> = {}): ElementDescriptor => ({ type, props })

/**
 * Stand-in for one `ui-primitives` control.
 *
 * The primitive itself is the shell's business; what this plugin is responsible
 * for is *what it asked the primitive to show*, so each stub records its props
 * and {@link flatten} walks the children and footer it was handed.
 */
const primitive = (kind: string) => (props: Record<string, unknown>): ElementDescriptor => ({ type: kind, props })

const MODULES: Record<string, unknown> = {
  react: reactStub,
  'react-dom': {},
  'react/jsx-runtime': { jsx: descriptor, jsxs: descriptor, Fragment: Symbol('Fragment') },
  '@deepseek-ai/dsh-client-ui-primitives': {
    IconWarningOutlineRegular: () => null,
    IconRightUpOutlineRegular: () => null,
    Button: primitive('Button'),
    Input: primitive('Input'),
    Checkbox: primitive('Checkbox'),
    Modal: primitive('Modal'),
  },
}

const requireStub = (specifier: string): unknown => {
  if (!(specifier in MODULES)) throw new Error(`client-smoke: unexpected runtime import "${specifier}"`)
  return MODULES[specifier]
}

// ── the artifact package.json publishes ────────────────────────────────────

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, unknown>
  dsh: { client: { platform: string; inject?: string[] }; bundle: { patch: string } }
}
assert.equal(manifest.exports['./client'], './lib/client.js')
assert.equal(manifest.dsh.client.platform, 'web')
assert.match(manifest.dsh.bundle.patch, /cordis\.patch\.yml$/u)

await import(new URL('../lib/client.js', import.meta.url).href)

assert.ok(booted !== undefined, 'the bundle must register itself with window.__ModuleLoader__')
assert.equal(booted.id, 'dsh-thu-automad')

const plugin = booted.factory(requireStub)
assert.equal(plugin.name, 'thu-automad')
assert.deepEqual(plugin.inject, ['slots', 'locale'])
assert.equal(typeof plugin.apply, 'function')

// ── the browser Context the plugin registers against ───────────────────────

/** One slot registration the stub registry captured. */
interface RegisteredSlot {
  name: string
  id?: string
  locale: string
  order?: number
  children?: Record<string, unknown>
  face: Record<string, unknown>
  component: unknown
}

/** Stub browser Context plus the registrations it captured. */
interface ClientHarness {
  ctx: Context
  locales: { ns: string; dicts: Record<string, Record<string, string>> }[]
  slots: RegisteredSlot[]
  disposers: (() => void)[]
}

/** Build the slots, locale, and effect surface the plugin uses. */
function harness(): ClientHarness {
  const locales: ClientHarness['locales'] = []
  const slots: RegisteredSlot[] = []
  const disposers: (() => void)[] = []
  const ctx = {
    effect: (run: () => unknown) => {
      const disposer = run()
      if (typeof disposer === 'function') disposers.push(disposer as () => void)
      return disposer
    },
    locale: {
      register: (ns: string, dicts: Record<string, Record<string, string>>) => {
        locales.push({ ns, dicts })
        return () => {}
      },
      bind: () => (key: string) => key,
    },
    slots: {
      inject: (name: string, contribute: () => unknown) => {
        assert.ok(
          [
            'conversation.composer.dock',
            'conversation.composer.statusPillReading',
            'shell.overlay',
            'settings.section',
          ].includes(name),
          `unexpected slot ${name}`,
        )
        contribute()
        return () => {}
      },
      register: (options: Omit<RegisteredSlot, 'face' | 'component'> & { inject?: () => Record<string, unknown> }, component: unknown) => {
        slots.push({ ...options, face: options.inject?.() ?? {}, component })
        return () => {}
      },
    },
  }
  return { ctx: ctx as unknown as Context, locales, slots, disposers }
}

// ── a well-formed status the Host would serve ──────────────────────────────

const HOUR = 3_600_000

/** Configuration presence the Host reports, with every reference stored. */
const auth = (overrides: Partial<AuthConfigStatus> = {}): AuthConfigStatus => ({
  credentialRef: 'TSINGHUA_API_KEY',
  usernameRef: 'MADMODEL_USERNAME',
  passwordRef: 'MADMODEL_PASSWORD',
  deviceName: 'dsh-madmodel',
  tunnel: false,
  usernameConfigured: true,
  usernameDisplay: '2023000000',
  usernameSource: 'file',
  passwordConfigured: true,
  tokenConfigured: true,
  shadowedRefs: [],
  ...overrides,
})

/** Renewal schedule the Host reports. */
const renew = (overrides: Partial<RenewStatus> = {}): RenewStatus => ({
  enabled: true,
  phase: 'scheduled',
  lastAttemptAt: null,
  nextAttemptAt: Date.now() + 5 * HOUR,
  lastCode: null,
  lastMessage: null,
  noProgress: false,
  twoFactorAt: null,
  unattendedRenewals: 0,
  ...overrides,
})

/** One complete wire status; individual cases override fields. */
const status = (overrides: Partial<AutomadStatus> = {}, token: Partial<TokenStatus> = {}): AutomadStatus => ({
  plugin: 'thu-automad',
  appliedAt: Date.now() - HOUR,
  uptimeSeconds: 3600,
  token: {
    state: 'ok',
    label: 'Tsinghua DeepSeek',
    credentialRef: 'TSINGHUA_API_KEY',
    credentialConfigured: true,
    source: 'user-env',
    issuedAt: Date.now() - HOUR,
    expiresAt: Date.now() + 5 * HOUR,
    changedAt: null,
    verifiedAt: null,
    rejectedAt: null,
    rejectedMessage: null,
    warnBeforeMs: 30 * 60_000,
    observedAt: Date.now(),
    ...token,
  },
  renew: renew(),
  policy: { rules: [], counts: { retry: 0, switch: 0, fail: 0, ask: 0, renew: 0 }, last: null },
  twoFactor: null,
  auth: auth(),
  observedAt: Date.now(),
  ...overrides,
})

/** Point the stub transport at one response body. */
function serve(body: unknown, init: ResponseInit = {}): string[] {
  const seen: string[] = []
  Object.assign(globalThis, {
    fetch: (input: string) => {
      seen.push(input)
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, ...init }))
    },
  })
  return seen
}

/** Let the controller's in-flight poll settle. */
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 4; turn += 1) await new Promise(resolve => setImmediate(resolve))
}

/** Force one poll through the focus-refresh path. */
const repoll = async (): Promise<void> => {
  for (const handler of documentListeners.get('visibilitychange') ?? []) handler()
  await settle()
}

// ── registration ───────────────────────────────────────────────────────────

const urls = serve(status())
const h = harness()
;(plugin.apply as (ctx: Context) => void)(h.ctx)

assert.equal(h.locales.length, 1)
assert.equal(h.locales[0]?.ns, 'thu-automad')
const dictionaries = h.locales[0]?.dicts ?? {}
assert.ok(dictionaries.en !== undefined && dictionaries.zh !== undefined, 'both languages register')
assert.deepEqual(
  Object.keys(dictionaries.zh ?? {}).sort(),
  Object.keys(dictionaries.en ?? {}).sort(),
  'every key is translated in both languages',
)
assert.ok(Object.keys(dictionaries.en ?? {}).length >= 50, 'the page and the dialog are fully worded')

const reading = h.slots.find(slot => slot.name === 'conversation.composer.statusPillReading')
const dock = h.slots.find(slot => slot.name === 'conversation.composer.dock')
const overlays = h.slots.filter(slot => slot.name === 'shell.overlay')
const section = h.slots.find(slot => slot.name === 'settings.section')

assert.ok(reading !== undefined, 'the reading registers into the status link seat')
assert.ok(dock !== undefined, 'the status link takes the composer dock seat')
assert.equal(dock.id, 'thu-automad-status')
assert.ok(
  Object.keys(dock.children ?? {}).includes('conversation.composer.statusPillReading'),
  'the link authorizes the reading seat it renders',
)
assert.equal(overlays.length, 2, 'the overlay carries both the notice and the dialog')
assert.deepEqual(overlays.map(slot => slot.id).sort(), ['thu-automad-notice', 'thu-automad-two-factor'])
assert.ok(section !== undefined, 'the settings page registers')
assert.equal(section.id, 'thu-automad')
assert.equal(section.locale, 'thu-automad')
assert.equal(typeof section.component, 'function', 'the registrations carry components, not elements')

const source = reading.face.hooks?.automadStatus as StatusSource | undefined
assert.ok(source !== undefined, 'the reading receives the status source through the hooks compartment')
for (const slot of [...overlays, section]) {
  assert.equal(slot.face.hooks?.automadStatus, source, 'every seat reads one source')
  assert.equal(typeof slot.face.actions, 'object', 'every posting seat receives the action set')
  assert.equal(typeof slot.face.refresh, 'function', 'every posting seat can refresh the status')
}

// The stylesheet is mounted once, keyed so a hot reload cannot stack copies.
// It must carry this plugin's own surfaces and no hand-rolled control: styling a
// button here is what previously named a `--dsw-alias-button-*` token that does
// not exist, and rendered the primary action as an unlabelled block.
assert.equal(styleTags.length, 1)
assert.equal(styleTags[0]?.dataset.plugin, 'dsh-thu-automad')
const stylesheet = styleTags[0]?.textContent ?? ''
assert.match(stylesheet, /\.taReading\b/u)
assert.match(stylesheet, /\.taSettings\b/u)
assert.doesNotMatch(stylesheet, /\.taButton\b|\.taInput\b|\.taBackdrop\b/u, 'controls come from ui-primitives')

// ── polling, validation, and the subscription contract ─────────────────────

/** Framework hooks and locale seat every component in this check renders with. */
const t = (key: string, params?: Record<string, unknown>): string =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    dictionaries.en?.[key] ?? key,
  )
const baseProps = {
  useAutomadStatus: (select: (value: { status: AutomadStatus | null; unreachable: boolean }) => unknown) =>
    select(source.getSnapshot()),
  t,
}

// ── the reading the status link renders ────────────────────────────────────

// Before the first read settles there is nothing truthful to show; the link
// around it is what stays visible, so this must not be an error or placeholder.
resetHooks()
assert.equal(render(reading.component, baseProps), null, 'nothing is drawn before the first read settles')

await settle()
assert.deepEqual(urls, ['api/thu-automad/status'], 'the route is document-relative')
assert.equal(source.getSnapshot().status?.token.state, 'ok')
assert.equal(source.getSnapshot().unreachable, false)
assert.equal(source.getSnapshot(), source.getSnapshot(), 'the snapshot keeps its identity between changes')

const settled = render(reading.component, baseProps) as ElementDescriptor
assert.equal(settled.type, 'span')
assert.equal(settled.props.className, 'taReading')
assert.equal(settled.props['data-thu-automad-reading'], true)
const readingChildren = settled.props.children as unknown[]
const glyph = flatten(readingChildren[0]).find(node => node.type === 'span' && String(node.props.className).includes('taPillIcon'))
assert.ok(glyph !== undefined)
assert.equal(glyph.props['aria-hidden'], 'true')
assert.match(stylesheet, /--ta-mark-image: url\("data:image\/svg\+xml,/u, 'the pill and card use the shared glyph')
assert.match(String(readingChildren[1]), /left$/, 'the reading is just the remaining lifetime')

// ── the settings page ──────────────────────────────────────────────────────

resetHooks()
const sectionProps = { ...baseProps, actions: {}, refresh: () => {}, close: () => {} }
const page = render(section.component, sectionProps) as ElementDescriptor
assert.equal(page.type, 'div')
assert.equal(page.props.className, 'taSettings')
const flat = flatten(page)
assert.ok(textOf(flat).includes('Tsinghua MadModel'), 'the page names itself')
assert.ok(flat.some(node => node.type === 'Button' && node.props.children === 'Edit' && node.props['aria-expanded'] === false))
assert.equal(flat.filter(node => node.type === 'Input').length, 0, 'no credential input is always-on')
const connection = flat.find(node => node.props.className === 'taGroup' && textOf(flatten(node)).includes('Sign-in account'))
assert.ok(connection !== undefined, 'the account has a card')
assert.match(textOf(flatten(connection)), /Local endpoint.*Tunnel session.*Sign-in account/u, 'all three rows share the connection card')

{
  const requests: AuthSettingsRequest[] = []
  const props = {
    ...sectionProps,
    actions: { saveIdentity: async (request: AuthSettingsRequest) => {
      requests.push(request)
      return requests.length === 1
        ? { ok: false, errors: [{ field: 'password', code: 'refused', message: 'fixture refusal' }], auth: auth() }
        : { ok: true, errors: [], auth: auth() }
    } },
  }
  const renderForm = () => flatten(render(section.component, props))
  const button = (nodes: ElementDescriptor[], text: string) => nodes.find(node => node.type === 'Button' && node.props.children === text)
  const input = (nodes: ElementDescriptor[], field: 'username' | 'password') => nodes.find(node => node.type === 'Input' && node.props.id === `thu-automad-${field}`)
  const enter = (nodes: ElementDescriptor[], field: 'username' | 'password', value: string) =>
    (input(nodes, field)?.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
  const click = (node: ElementDescriptor | undefined) => (node?.props.onClick as () => void)()
  const submit = async (nodes: ElementDescriptor[]) => {
    (nodes.find(node => node.type === 'form')?.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault() {} })
    await settle()
  }

  click(button(flat, 'Edit'))
  let opened = renderForm()
  enter(opened, 'password', 'discarded draft')
  click(button(renderForm(), 'Cancel'))
  click(button(renderForm(), 'Edit'))
  opened = renderForm()
  assert.equal(input(opened, 'password')?.props.value, '', 'cancel discards the draft')
  click(opened.find(node => node.props['aria-label'] === 'Clear · Unified-auth password'))
  assert.equal(requests.length, 0, 'clearing is staged until save')
  opened = renderForm()
  assert.equal(input(opened, 'password')?.props.disabled, true)
  click(opened.find(node => node.props['aria-label'] === 'Undo · Unified-auth password'))
  opened = renderForm()
  enter(opened, 'username', '2023000001')
  enter(opened, 'password', 'fixture password')
  await submit(renderForm())
  assert.deepEqual(requests, [{ username: '2023000001', password: 'fixture password' }])
  const partial = renderForm()
  assert.equal(input(partial, 'username')?.props.value, '', 'the successful draft is released')
  assert.equal(input(partial, 'password')?.props['aria-invalid'], true, 'the refusal belongs to the failed field')
  await submit(partial)
  assert.deepEqual(requests[1], { password: 'fixture password' }, 'retry sends only the pending field')
  click(renderForm().find(node => node.props['aria-label'] === 'Clear · Unified-auth password'))
  await submit(renderForm())
  assert.deepEqual(requests[2], { password: null }, 'confirmed clear sends only the selected field')
}

// The form appears when the identity is not configured (and on demand otherwise).
serve(status({
  auth: auth({
    usernameConfigured: false, passwordConfigured: false, usernameDisplay: null, usernameSource: null,
  }),
}))
await repoll()
resetHooks()
const blankPage = flatten(render(section.component, sectionProps) as ElementDescriptor)
const inputs = blankPage.filter(node => node.type === 'Input')
assert.deepEqual(inputs.map(node => node.props.id), ['thu-automad-username', 'thu-automad-password'])
assert.equal(inputs[0]?.props.type, 'text')
assert.equal(inputs[1]?.props.type, 'password', 'the password is masked')
assert.equal(inputs[0]?.props.value, '', 'an input never starts from a stored secret')
assert.equal(inputs[0]?.props.placeholder, 'Enter your student ID')

// The controls are the shell's primitives, not hand-rolled ones: a primary
// action must go through the variant the theme actually styles.
const buttons = blankPage.filter(node => node.type === 'Button')
assert.ok(buttons.some(node => node.props.children === 'Renew now'), 'the manual trigger is a primitive button')
const submitButton = buttons.filter(node => node.props.type === 'submit')
assert.equal(submitButton.length, 1, 'the account has one save action')
assert.equal(submitButton[0]?.props.disabled, true, 'there is nothing to submit in an empty form')

// A reference the launching environment pins read-only is reported, because a
// save would otherwise look like it worked while the value never changes.
serve(status({ auth: auth({ shadowedRefs: ['MADMODEL_PASSWORD'] }) }))
await repoll()
resetHooks()
const shadowed = flatten(render(section.component, sectionProps) as ElementDescriptor)
assert.ok(
  shadowed.some(node => String(node.props.className ?? '') === 'taError'),
  'a shadowed reference is called out on the page',
)

// A failure the Host reported as a stable code is described in the reader's
// language. Echoing the Host's own English diagnostic into a Chinese page is a
// page the reader has to translate.
serve(status({
  renew: renew({ phase: 'needs-human', lastAttemptAt: Date.now(), lastCode: 'NO_CREDENTIALS', lastMessage: 'no student id or password is stored under MADMODEL_USERNAME / MADMODEL_PASSWORD' }),
}))
await repoll()
resetHooks()
const failed = textOf(flatten(render(section.component, sectionProps) as ElementDescriptor))
assert.match(failed, /No student id or password is stored yet/u, 'a known code renders localized copy')
assert.doesNotMatch(failed, /no student id or password is stored under/u, 'not the Host\u2019s raw diagnostic')

// The status popover is the shell's stat card, not a plugin skin: the same
// four-row definition list, the same panel surface, and one concurrency reading
// per model so a single "3 running" total cannot hide which model is saturated.
serve(status({
  renew: renew({ phase: 'needs-human', lastAttemptAt: Date.now(), lastCode: 'NO_CREDENTIALS' }),
  transport: {
    enabled: true,
    mode: 'auto',
    effective: 'webvpn',
    port: 43110,
    listening: true,
    lastError: null,
    tunnelCookieAt: Date.now() - HOUR,
    lastProbeAt: Date.now() - 60_000,
    lastProbeVerdict: 'ok',
    pools: [
      { model: 'DeepSeek-V4.1-Flash', limit: 3, ceiling: 3, inFlight: 3, queued: 0, pausedUntil: null },
      { model: 'qwen3.8-27b', limit: 4, ceiling: 4, inFlight: 1, queued: 0, pausedUntil: null },
      { model: 'DeepSeek-R1-W8A8', limit: 1, ceiling: 1, inFlight: 0, queued: 2, pausedUntil: null },
    ],
    queueLimit: 32,
  },
}))
await repoll()
resetHooks()
const card = flatten(render(dock.component, { ...baseProps, renderSlot: () => null }) as ElementDescriptor)
assert.deepEqual(
  card.filter(node => node.type === 'dt').map(node => node.props.children),
  [t('settings.overview.token'), t('settings.overview.network'), t('settings.overview.renew'), t('settings.section.queue')],
  'the card carries the shell\u2019s four definition rows',
)
const human = card.find(node => node.type === 'dd' && node.props.children === t('settings.renew.needsHuman'))
assert.equal(human?.props['data-tone'], 'error', 'the status card shows the needs-human renewal state')
assert.deepEqual(
  card.filter(node => node.type === 'span' && node.props.className === 'taPoolCount').map(node => node.props.children),
  ['3/3', '1/4', '0/1', '+2'],
  'every model reports its own share of the eight admission slots',
)
assert.ok(
  card.some(node => node.type === 'span' && node.props.className === 'taPool' && node.props['data-tone'] === 'warn'),
  'a model at its ceiling is marked',
)
assert.match(stylesheet, /--dsw-specific-menu/u, 'the popover uses the shell\u2019s menu surface')
assert.match(stylesheet, /grid-template-columns:\s*minmax\(76px,\s*auto\)\s*minmax\(0,\s*1fr\)/u, 'and the shell\u2019s definition-list grid')

// The transport and concurrency facts are part of the page: where requests go,
// what the local endpoint is, and how many requests are running or waiting.
serve(status({
  transport: {
    enabled: true,
    mode: 'auto',
    effective: 'webvpn',
    port: 43110,
    listening: true,
    lastError: null,
    tunnelCookieAt: Date.now() - HOUR,
    lastProbeAt: Date.now() - 60_000,
    lastProbeVerdict: 'ok',
    pools: [{ model: 'DeepSeek-V4.1-Flash', limit: 2, inFlight: 2, queued: 3, pausedUntil: null }],
    queueLimit: 32,
  },
}))
await repoll()
resetHooks()
const transportPage = textOf(flatten(render(section.component, sectionProps) as ElementDescriptor))
assert.match(transportPage, /WebVPN tunnel/u, 'the current network path is shown')
assert.match(transportPage, /127\.0\.0\.1:43110/u, 'the local endpoint is shown')
assert.match(transportPage, /2 of 2 running · 3 queued/u, 'per-model admission is shown')
assert.match(transportPage, /Queue waiting/u, 'the queue can be paused')
assert.match(transportPage, /Pause queue/u, 'the control reflects the enabled queue')
assert.match(transportPage, /Reset transport/u, 'a stuck transport can be reset')

// A 429 pause is rendered as a countdown rather than a bare "waiting".
serve(status({
  transport: {
    enabled: true,
    mode: 'auto',
    effective: 'webvpn',
    port: 43110,
    listening: true,
    lastError: null,
    tunnelCookieAt: null,
    lastProbeAt: null,
    lastProbeVerdict: null,
    pools: [{ model: 'DeepSeek-V4.1-Flash', limit: 1, inFlight: 0, queued: 1, pausedUntil: Date.now() + 60_000 }],
    queueLimit: 32,
  },
}))
await repoll()
resetHooks()
const pausedPage = textOf(flatten(render(section.component, sectionProps) as ElementDescriptor))
assert.match(pausedPage, /429 cooldown/u, 'a paused model says why it is not running')

// ── the two-factor dialog ──────────────────────────────────────────────────

resetHooks()
assert.equal(
  render(overlays.find(slot => slot.id === 'thu-automad-two-factor')?.component, { ...baseProps, actions: {}, refresh: () => {} }),
  null,
  'no dialog is drawn while no challenge is outstanding',
)

serve(status({ twoFactor: { stage: 'method', methods: ['wechat', 'mobile', 'totp'], phone: '138****8888', method: null, askedAt: Date.now(), expiresAt: Date.now() + 60_000 } }, { state: 'expiring' }))
await repoll()
resetHooks()
const dialog = render(
  overlays.find(slot => slot.id === 'thu-automad-two-factor')?.component,
  { ...baseProps, actions: {}, refresh: () => {} },
) as ElementDescriptor
const dialogTree = flatten(dialog)
const modal = dialogTree.find(node => node.type === 'Modal')
assert.ok(modal !== undefined, 'the dialog asks the shell primitive to draw itself')
assert.equal(modal.props.open, true)
assert.equal(modal.props.title, 'Device verification')
assert.equal(typeof modal.props.onClose, 'function', 'dismissing the modal cancels the renewal')
const radios = dialogTree.filter(node => node.type === 'input' && node.props.type === 'radio')
assert.deepEqual(radios.map(node => node.props.value), ['wechat', 'mobile', 'totp'])
assert.deepEqual(
  dialogTree.filter(node => node.type === 'Checkbox').map(node => node.props.checked),
  [true],
  'registering this device starts enabled, which is what buys the unattended window',
)
assert.ok(textOf(dialogTree).includes('WeChat'), 'methods are named in the reader\u2019s language')

// The submit control lives in the modal's footer and addresses the body's form,
// so it is a real submit button rather than a click handler beside one.
const submit = dialogTree.find(node => node.type === 'Button' && node.props.type === 'submit')
assert.equal(submit?.props.variant, 'primary', 'the primary action uses the styled variant')
assert.equal(submit?.props.form, 'thu-automad-two-factor-form')
assert.equal(submit?.props.disabled, false, 'the first offered method is preselected, so it is ready')
assert.equal(radios.find(node => node.props.checked)?.props.value, 'wechat', 'and that is what is preselected')

// The code stage has no methods to offer; it asks for the six digits instead.
serve(status({ twoFactor: { stage: 'code', methods: [], phone: null, method: 'totp', askedAt: Date.now(), expiresAt: Date.now() + 60_000 } }, { state: 'expiring' }))
await repoll()
resetHooks()
const codeStage = flatten(render(
  overlays.find(slot => slot.id === 'thu-automad-two-factor')?.component,
  { ...baseProps, actions: {}, refresh: () => {} },
) as ElementDescriptor)
const codeInput = codeStage.find(node => node.type === 'Input' && node.props.maxLength === 6)
assert.ok(codeInput !== undefined, 'the code stage asks for six digits')
assert.equal(codeInput?.props.inputMode, 'numeric')
assert.equal(codeInput?.props['data-modal-autofocus'], true, 'and takes the modal\u2019s initial focus')
assert.equal(codeStage.filter(node => node.type === 'input' && node.props.type === 'radio').length, 0, 'no method list remains')

// ── malformed and failing transports ───────────────────────────────────────

serve({ state: 'definitely-not-a-state', label: 'x' })
await repoll()
assert.equal(source.getSnapshot().unreachable, true, 'an unknown token state is refused at the wire boundary')
assert.equal(source.getSnapshot().status?.token.state, 'expiring', 'the last known status survives')

serve(status({ renew: {} as RenewStatus }))
await repoll()
assert.equal(source.getSnapshot().unreachable, true, 'a payload missing required fields is refused')

serve({}, { status: 500 })
await repoll()
assert.equal(source.getSnapshot().unreachable, true)

Object.assign(globalThis, { fetch: () => Promise.reject(new Error('offline')) })
await repoll()
assert.equal(source.getSnapshot().unreachable, true, 'a rejected fetch leaves the last known status in place')

// ── disposal ───────────────────────────────────────────────────────────────

assert.equal(h.disposers.length, 3, 'dictionaries, stylesheet, and polling each own a disposer')
for (const dispose of h.disposers) dispose()
assert.equal(styleTags[0]?.removed, true, 'disposal removes the injected stylesheet')
assert.equal((documentListeners.get('visibilitychange') ?? []).length, 0, 'disposal removes the focus listener')

console.log('client-smoke: ok')

/**
 * Every descriptor in one rendered tree, depth first.
 *
 * A function-typed element is invoked and its result walked, because the
 * interesting assertions are about what a helper component draws — the labelled
 * input inside `IdentityField`, the badge inside `Badge`. Those helpers are
 * stateless by construction, so invoking them here cannot disturb the hook
 * slots the outer component is still holding.
 * @param root - tree returned by {@link render}.
 * @returns every element it contains, helpers expanded.
 */
function flatten(root: unknown): ElementDescriptor[] {
  const found: ElementDescriptor[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry)
      return
    }
    if (typeof node !== 'object' || node === null) return
    const element = node as ElementDescriptor
    if (typeof element.type === 'undefined' || typeof element.props !== 'object') return
    found.push(element)
    if (typeof element.type === 'function') {
      visit((element.type as (props: Record<string, unknown>) => unknown)(element.props))
      return
    }
    for (const child of Object.values(element.props)) {
      if (child === element) continue
      visit(child)
    }
  }
  visit(root)
  return found
}

/** Concatenated string children of one rendered tree. */
function textOf(nodes: readonly ElementDescriptor[]): string {
  const parts: string[] = []
  for (const node of nodes) {
    for (const child of Object.values(node.props)) {
      if (typeof child === 'string') parts.push(child)
      else if (Array.isArray(child)) {
        for (const entry of child) if (typeof entry === 'string') parts.push(entry)
      }
    }
  }
  return parts.join(' ')
}
