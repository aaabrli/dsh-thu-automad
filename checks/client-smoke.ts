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
import type { AutomadStatus, AuthConfigStatus, RenewStatus, TokenStatus } from '../src/protocol.ts'

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

await import(pathToFileURL(new URL('../lib/client.js', import.meta.url).pathname).href)

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
assert.match(stylesheet, /\.taSection\b/u)
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
const dot = readingChildren[0] as ElementDescriptor
assert.equal(dot.type, 'span')
assert.equal(dot.props.className, 'taDot taDotOk')
assert.equal(dot.props['aria-hidden'], 'true')
assert.match(String(readingChildren[1]), /Tsinghua DeepSeek · .* left$/)

// ── the settings page ──────────────────────────────────────────────────────

resetHooks()
const sectionProps = { ...baseProps, actions: {}, refresh: () => {}, close: () => {} }
const page = render(section.component, sectionProps) as ElementDescriptor
assert.equal(page.type, 'div')
assert.equal(page.props.className, 'taSection')
const flat = flatten(page)
assert.ok(textOf(flat).includes('Tsinghua MadModel credentials'), 'the page names itself')
assert.ok(textOf(flat).includes('MADMODEL_USERNAME'), 'the student id field names the reference it writes')

// Each identity field is one labelled input carrying its own save and clear,
// and the page can see whether the Host already holds a value without ever
// receiving one.
const fields = flat.filter(node => node.props.field === 'username' || node.props.field === 'password')
assert.deepEqual(fields.map(node => node.props.field), ['username', 'password'])
const inputs = flat.filter(node => node.type === 'Input')
assert.deepEqual(inputs.map(node => node.props.id), ['thu-automad-username', 'thu-automad-password'])
assert.equal(inputs[0]?.props.type, 'text')
assert.equal(inputs[1]?.props.type, 'password', 'the password is masked')
assert.equal(inputs[0]?.props.value, '', 'an input never starts from a stored secret')
assert.match(String(inputs[0]?.props.placeholder), /MADMODEL_USERNAME/u, 'the field names the reference it writes')

// The controls are the shell's primitives, not hand-rolled ones: a primary
// action must go through the variant the theme actually styles.
const buttons = flat.filter(node => node.type === 'Button')
assert.ok(buttons.length >= 5, 'each field saves and clears, and the page renews')
assert.equal(buttons.filter(node => node.props.variant === 'primary').length, 1, 'exactly one primary action')
assert.ok(buttons.some(node => node.props.children === 'Renew now'), 'the manual trigger is a primitive button')

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
assert.equal(modal.props.title, 'The school requires a second factor')
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
