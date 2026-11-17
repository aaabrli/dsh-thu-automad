// src/auth/chain.ts
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
var SSO_APP = "d736f067a6705ab942df52f958a0f23b";
var ID_PREFIX = "https://id.tsinghua.edu.cn";
var SITE = "https://madmodel.cs.tsinghua.edu.cn";
var FORM_URL = `${ID_PREFIX}/do/off/ui/auth/login/form/${SSO_APP}/0`;
var CHECK_URL = `${ID_PREFIX}/do/off/ui/auth/login/check`;
var TICKET_CONSUMER = `${SITE}/model-api/auth-login/check?ticket=`;
var DEVICE_NAME = "dsh-madmodel";
var loaded;
function loadAuth() {
  if (loaded !== void 0) return loaded;
  const entry = new URL(import.meta.url.endsWith(".ts") ? "../../vendor/madmodel/madmodel-auth.js" : "../vendor/madmodel/madmodel-auth.js", import.meta.url);
  loaded = createRequire(import.meta.url)(fileURLToPath(entry));
  return loaded;
}
function authErrorCode(error) {
  if (typeof error !== "object" || error === null) return void 0;
  const code = error.code;
  return typeof code === "string" && code.length > 0 ? code : void 0;
}
function isTwoFactorCode(code) {
  return code !== void 0 && code.startsWith("TWO_FACTOR_");
}
function isIdentityCode(code) {
  return code === "BAD_CREDENTIALS";
}

// src/policy/config.ts
var DEFAULT_TIMEOUT_MS = 12e4;
var CHOICE_ACTIONS = ["retry", "switch", "fail"];
var RULE_ACTIONS = [...CHOICE_ACTIONS, "ask", "renew"];
var FALLBACK_ACTIONS = [...CHOICE_ACTIONS, "ask"];
var RULE_KEYS = ["when", "action", "to", "ask", "afterRetries", "onFailure"];
var PREFIX = "thu-automad: rules";
function resolveRules(raw) {
  if (raw === void 0) {
    throw new Error(`${PREFIX} is required; an empty list disables the policy half`);
  }
  if (!Array.isArray(raw)) throw new Error(`${PREFIX} must be a list`);
  return raw.map((entry, index) => rule(entry, `rules[${String(index)}]`));
}
function rule(value, path) {
  const record = asRecord(value, path);
  for (const key of Object.keys(record)) {
    if (!RULE_KEYS.includes(key)) throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
  }
  const when = record.when === void 0 ? {} : asRecord(record.when, `${path}.when`);
  for (const key of Object.keys(when)) {
    if (key !== "provider" && key !== "code") {
      throw new Error(`${PREFIX}: ${path}.when: unknown key "${key}"`);
    }
  }
  const action = member(record.action, RULE_ACTIONS, `${path}.action`);
  const provider = names(when.provider, `${path}.when.provider`);
  const code = names(when.code, `${path}.when.code`);
  const afterRetries = budget(record.afterRetries, `${path}.afterRetries`);
  if (action === "renew") {
    if (record.onFailure === void 0) {
      throw new Error(`${PREFIX}: ${path}.onFailure is required for action "renew"`);
    }
    const onFailure = member(record.onFailure, FALLBACK_ACTIONS, `${path}.onFailure`);
    if (onFailure === "switch") {
      if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
      return { provider, code, action, to: route(record.to, `${path}.to`), afterRetries, onFailure };
    }
    if (onFailure === "ask") {
      if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for a "switch" target`);
      return { provider, code, action, ask: askSpec(record.ask, `${path}.ask`), afterRetries, onFailure };
    }
    if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for a "switch" target`);
    if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
    return { provider, code, action, afterRetries, onFailure };
  }
  if (record.onFailure !== void 0) {
    throw new Error(`${PREFIX}: ${path}.onFailure is only valid for action "renew"`);
  }
  if (action === "switch") {
    if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
    return { provider, code, action, to: route(record.to, `${path}.to`), afterRetries, onFailure: void 0 };
  }
  if (action === "ask") {
    if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`);
    return { provider, code, action, ask: askSpec(record.ask, `${path}.ask`), afterRetries, onFailure: void 0 };
  }
  if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`);
  if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
  return { provider, code, action, afterRetries, onFailure: void 0 };
}
function budget(value, path) {
  if (value === void 0) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${PREFIX}: ${path} must be a non-negative integer`);
  }
  return value;
}
function askSpec(value, path) {
  const record = asRecord(value, path);
  for (const key of Object.keys(record)) {
    if (!["question", "choices", "timeoutMs", "unavailable"].includes(key)) {
      throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
    }
  }
  const question = record.question;
  if (typeof question !== "string" || question.length === 0) {
    throw new Error(`${PREFIX}: ${path}.question must be a non-empty string`);
  }
  const rawChoices = record.choices;
  if (!Array.isArray(rawChoices) || rawChoices.length === 0) {
    throw new Error(`${PREFIX}: ${path}.choices must be a non-empty list`);
  }
  const choices = rawChoices.map((entry, index) => choice(entry, `${path}.choices[${String(index)}]`));
  const labels = new Set(choices.map((entry) => entry.label));
  if (labels.size !== choices.length) {
    throw new Error(`${PREFIX}: ${path}.choices labels must be unique; an answer is matched by label`);
  }
  const timeout = record.timeoutMs;
  if (timeout !== void 0 && (typeof timeout !== "number" || !Number.isSafeInteger(timeout) || timeout <= 0)) {
    throw new Error(`${PREFIX}: ${path}.timeoutMs must be a positive integer`);
  }
  return {
    question,
    choices,
    timeoutMs: timeout ?? DEFAULT_TIMEOUT_MS,
    unavailable: choice(record.unavailable, `${path}.unavailable`)
  };
}
function choice(value, path) {
  const record = asRecord(value, path);
  for (const key of Object.keys(record)) {
    if (!["label", "action", "to"].includes(key)) {
      throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
    }
  }
  const label = record.label;
  if (typeof label !== "string" || label.length === 0) {
    throw new Error(`${PREFIX}: ${path}.label must be a non-empty string`);
  }
  const action = member(record.action, CHOICE_ACTIONS, `${path}.action`);
  if (action === "switch") return { label, action, to: route(record.to, `${path}.to`) };
  if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`);
  return { label, action };
}
function route(value, path) {
  const record = asRecord(value, path);
  for (const key of Object.keys(record)) {
    if (key !== "provider" && key !== "model") {
      throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
    }
  }
  const provider = record.provider;
  const model = record.model;
  if (typeof provider !== "string" || provider.length === 0) {
    throw new Error(`${PREFIX}: ${path}.provider must be a non-empty string`);
  }
  if (typeof model !== "string" || model.length === 0) {
    throw new Error(`${PREFIX}: ${path}.model must be a non-empty string`);
  }
  return { provider, model };
}
function names(value, path) {
  if (value === void 0) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`${PREFIX}: ${path} must be a list of non-empty strings`);
  }
  return value;
}
function member(value, allowed, path) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${PREFIX}: ${path} must be one of ${allowed.join(", ")}`);
  }
  return value;
}
function asRecord(value, path) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${PREFIX}: ${path} must be a mapping`);
  }
  return value;
}

// src/transport/concurrency.ts
var KNOWN_MODELS = ["DeepSeek-V4.1-Flash", "qwen3.8-27b", "DeepSeek-R1-W8A8"];
var CONCURRENCY_DEFAULTS = {
  max: 3,
  perModel: { "qwen3.8-27b": 4, "DeepSeek-R1-W8A8": 1 },
  queueLimit: 32,
  maxWaitMs: 0,
  heartbeatAfterMs: 2e4,
  heartbeatMs: 15e3,
  cooldownMs: 1e3
};
var QueueError = class extends Error {
};
var ModelQueue = class {
  constructor(options) {
    this.options = options;
    for (const model of KNOWN_MODELS) this.pool(model);
  }
  options;
  pools = /* @__PURE__ */ new Map();
  enabled = true;
  get queueEnabled() {
    return this.enabled;
  }
  snapshot() {
    const now = Date.now();
    return Array.from(this.pools, ([model, pool]) => ({
      model,
      limit: pool.limit,
      inFlight: pool.active.size,
      starting: [...pool.active.values()].filter((phase) => phase === "starting").length,
      queued: pool.queue.length,
      pausedUntil: pool.gateway !== null && pool.gateway.retryAt > now ? pool.gateway.retryAt : null,
      recovering: pool.gateway?.trial != null && pool.gateway.retryAt <= now,
      upstreamError: pool.upstreamError === null ? null : { ...pool.upstreamError }
    }));
  }
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    for (const pool of this.pools.values()) {
      if (!enabled) pool.gateway = null;
      this.pump(pool);
    }
  }
  reset() {
    for (const pool of this.pools.values()) {
      clearTimeout(pool.wake);
      pool.wake = void 0;
      pool.gateway = null;
      pool.active.clear();
      for (const waiter of pool.queue.splice(0)) waiter.reject(new QueueError("the transport was reset"));
    }
  }
  acquire(request, retry) {
    request.signal.throwIfAborted();
    const pool = this.pool(request.model);
    if (!this.enabled) return this.grant(pool);
    const earlier = pool.queue.findIndex(({ request: other }) => request.title === other.title ? request.order < other.order : !request.title);
    const index = earlier < 0 ? pool.queue.length : earlier;
    if (index === 0 && this.canStart(pool, request.title)) return this.grant(pool);
    if (!retry && pool.queue.length >= this.options.queueLimit) {
      throw new QueueError(`${pool.queue.length} requests are already waiting for "${request.model}"`);
    }
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", onAbort);
      };
      const waiter = {
        request,
        grant: (slot) => {
          cleanup();
          resolve(slot);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        }
      };
      const discard = (error) => {
        const position = pool.queue.indexOf(waiter);
        if (position < 0) return;
        pool.queue.splice(position, 1);
        waiter.reject(error);
        this.pump(pool);
      };
      const onAbort = () => {
        discard(request.signal.reason);
      };
      pool.queue.splice(index, 0, waiter);
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (this.options.maxWaitMs > 0) {
        timer = setTimeout(() => {
          discard(new QueueError(`waited ${this.options.maxWaitMs} ms for "${request.model}"`));
        }, this.options.maxWaitMs);
      }
      request.onWait();
      this.pump(pool);
    });
  }
  refused(model, slot, retryAfterMs2) {
    const pool = this.pool(model);
    const now = Date.now();
    const serverDelay = retryAfterMs2 ?? 0;
    const retryAt = now + (serverDelay > 0 ? serverDelay : this.options.cooldownMs);
    const gateway = pool.gateway ??= { retryAt, serverUntil: 0, trial: null };
    if (gateway.trial === slot) gateway.retryAt = retryAt;
    if (serverDelay > 0) gateway.serverUntil = Math.max(gateway.serverUntil, now + serverDelay);
    gateway.retryAt = Math.max(gateway.retryAt, gateway.serverUntil);
  }
  noteUpstreamError(model, status) {
    this.pool(model).upstreamError = { status, at: Date.now() };
  }
  pool(model) {
    const current = this.pools.get(model);
    if (current !== void 0) return current;
    const specificLimit = this.options.perModel?.[model];
    const pool = {
      limit: typeof specificLimit === "number" ? specificLimit : this.options.max,
      active: /* @__PURE__ */ new Map(),
      queue: [],
      gateway: null,
      wake: void 0,
      upstreamError: null
    };
    this.pools.set(model, pool);
    return pool;
  }
  canStart(pool, title) {
    if (!this.enabled) return true;
    const limit = title ? Math.max(1, pool.limit - 1) : pool.limit;
    const gateway = pool.gateway;
    return pool.active.size < limit && (gateway === null || gateway.trial === null && Date.now() >= gateway.retryAt);
  }
  grant(pool) {
    const slot = {
      accepted: () => {
        const gateway = pool.gateway;
        if (gateway?.trial !== slot) return;
        gateway.trial = null;
        if (Date.now() >= gateway.serverUntil) pool.gateway = null;
        this.pump(pool);
      },
      started: () => {
        if (pool.active.has(slot)) pool.active.set(slot, "responding");
      },
      release: (success) => {
        if (!pool.active.delete(slot)) return;
        const gateway = pool.gateway;
        if (gateway?.trial === slot) gateway.trial = null;
        if (success) {
          pool.upstreamError = null;
          if (gateway !== null) gateway.retryAt = gateway.serverUntil;
        }
        this.pump(pool);
      }
    };
    pool.active.set(slot, "starting");
    if (pool.gateway !== null) pool.gateway.trial = slot;
    return slot;
  }
  pump(pool) {
    clearTimeout(pool.wake);
    pool.wake = void 0;
    for (; ; ) {
      const waiter = pool.queue[0];
      if (waiter === void 0) return;
      const delay2 = (pool.gateway?.retryAt ?? 0) - Date.now();
      if (delay2 > 0) {
        pool.wake = setTimeout(() => this.pump(pool), Math.min(delay2, 2147483647));
        pool.wake.unref();
        return;
      }
      if (!this.canStart(pool, waiter.request.title)) return;
      pool.queue.shift();
      waiter.grant(this.grant(pool));
    }
  }
};

// src/config.ts
var DEFAULTS = {
  credentialRef: "TSINGHUA_API_KEY",
  label: "Tsinghua API",
  warnBeforeMs: 30 * 60 * 1e3,
  providers: ["tsinghua"],
  probeIntervalMs: 0,
  probeUrl: "",
  usernameRef: "MADMODEL_USERNAME",
  passwordRef: "MADMODEL_PASSWORD",
  tunnel: false,
  autoRenew: true,
  refreshAheadMs: 60 * 60 * 1e3,
  checkIntervalMs: 60 * 1e3,
  twoFactorTimeoutMs: 5 * 60 * 1e3,
  verifyAfterRenew: true,
  verifyModel: "DeepSeek-V4.1-Flash"
};
var TRANSPORT_DEFAULTS = {
  enabled: true,
  mode: "auto",
  port: 43110,
  keepaliveMs: 20 * 60 * 1e3
};
var REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
var MIN_PROBE_INTERVAL_MS = 60 * 1e3;
var MIN_CHECK_INTERVAL_MS = 10 * 1e3;
function resolveOptions(config) {
  const record = asRecord2(config);
  for (const key of Object.keys(record)) {
    if (key !== "rules" && key !== "transport" && !(key in DEFAULTS)) {
      throw new Error(`thu-automad: unknown config key "${key}"`);
    }
  }
  const credentialRef = ref(record, "credentialRef", DEFAULTS.credentialRef);
  const label = text(record, "label", DEFAULTS.label);
  if (label.length === 0) throw new Error("thu-automad: label must not be empty");
  const warnBeforeMs = count(record, "warnBeforeMs", DEFAULTS.warnBeforeMs);
  const providers = names2(record, "providers", DEFAULTS.providers);
  const intervalMs = count(record, "probeIntervalMs", DEFAULTS.probeIntervalMs);
  const probeUrl = text(record, "probeUrl", DEFAULTS.probeUrl);
  let probe;
  if (intervalMs !== 0) {
    if (intervalMs < MIN_PROBE_INTERVAL_MS) {
      throw new Error(`thu-automad: probeIntervalMs must be 0 (disabled) or at least ${String(MIN_PROBE_INTERVAL_MS)}`);
    }
    if (probeUrl.length === 0) {
      throw new Error("thu-automad: probeUrl is required when probeIntervalMs is set");
    }
    const parsed = new URL(probeUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("thu-automad: probeUrl must be an absolute HTTP(S) URL");
    }
    probe = { url: parsed.href, intervalMs };
  }
  const auth = {
    usernameRef: ref(record, "usernameRef", DEFAULTS.usernameRef),
    passwordRef: ref(record, "passwordRef", DEFAULTS.passwordRef),
    tunnel: boolean(record, "tunnel", DEFAULTS.tunnel)
  };
  const transport = resolveTransport(record);
  const refreshAheadMs = count(record, "refreshAheadMs", DEFAULTS.refreshAheadMs);
  const checkIntervalMs = count(record, "checkIntervalMs", DEFAULTS.checkIntervalMs);
  if (checkIntervalMs < MIN_CHECK_INTERVAL_MS) {
    throw new Error(`thu-automad: checkIntervalMs must be at least ${String(MIN_CHECK_INTERVAL_MS)}`);
  }
  if (refreshAheadMs !== 0 && refreshAheadMs < warnBeforeMs) {
    throw new Error("thu-automad: refreshAheadMs must be 0 (disabled) or at least warnBeforeMs");
  }
  const twoFactorTimeoutMs = count(record, "twoFactorTimeoutMs", DEFAULTS.twoFactorTimeoutMs);
  if (twoFactorTimeoutMs === 0) throw new Error("thu-automad: twoFactorTimeoutMs must be positive");
  const verifyModel = text(record, "verifyModel", DEFAULTS.verifyModel);
  if (verifyModel.length === 0) throw new Error("thu-automad: verifyModel must not be empty");
  const rules = resolveRules(record.rules);
  for (const [index, rule2] of rules.entries()) {
    if (rule2.action === "renew" && (rule2.provider.length === 0 || rule2.provider.some((name2) => !providers.includes(name2)))) {
      throw new Error(
        `thu-automad: rules[${String(index)}].when.provider must name a watched provider (${providers.join(", ") || "none configured"}) for action "renew"`
      );
    }
  }
  return {
    credentialRef,
    label,
    warnBeforeMs,
    providers,
    probe,
    auth,
    renew: {
      autoRenew: boolean(record, "autoRenew", DEFAULTS.autoRenew),
      refreshAheadMs,
      checkIntervalMs,
      twoFactorTimeoutMs,
      verifyAfterRenew: boolean(record, "verifyAfterRenew", DEFAULTS.verifyAfterRenew),
      verifyModel
    },
    transport,
    rules
  };
}
function resolveTransport(record) {
  const raw = record.transport;
  if (raw !== void 0 && (typeof raw !== "object" || raw === null || Array.isArray(raw))) {
    throw new Error("thu-automad: transport must be a mapping");
  }
  const value = raw ?? {};
  for (const key of Object.keys(value)) {
    if (!["enabled", "mode", "port", "keepaliveMs", "concurrency"].includes(key)) {
      throw new Error(`thu-automad: unknown transport key "${key}"`);
    }
  }
  const mode = text(value, "mode", TRANSPORT_DEFAULTS.mode);
  if (mode !== "auto" && mode !== "direct" && mode !== "webvpn") {
    throw new Error("thu-automad: transport.mode must be one of auto, direct, webvpn");
  }
  const port = count(value, "port", TRANSPORT_DEFAULTS.port);
  if (port < 1024 || port > 65535) {
    throw new Error("thu-automad: transport.port must be an unused local port between 1024 and 65535");
  }
  const keepaliveMs = count(value, "keepaliveMs", TRANSPORT_DEFAULTS.keepaliveMs);
  if (keepaliveMs < 5 * 60 * 1e3) {
    throw new Error("thu-automad: transport.keepaliveMs must be at least 300000");
  }
  return {
    enabled: boolean(value, "enabled", TRANSPORT_DEFAULTS.enabled),
    mode,
    port,
    keepaliveMs,
    concurrency: resolveConcurrency(value.concurrency)
  };
}
function resolveConcurrency(raw) {
  if (raw !== void 0 && (typeof raw !== "object" || raw === null || Array.isArray(raw))) {
    throw new Error("thu-automad: transport.concurrency must be a mapping");
  }
  const value = raw ?? {};
  const known = /* @__PURE__ */ new Set([...Object.keys(CONCURRENCY_DEFAULTS), "initial", "min", "growAfter", "maxCooldownMs"]);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw new Error(`thu-automad: unknown transport.concurrency key "${key}"`);
  }
  const options = {
    max: count(value, "max", count(value, "initial", CONCURRENCY_DEFAULTS.max)),
    queueLimit: count(value, "queueLimit", CONCURRENCY_DEFAULTS.queueLimit),
    maxWaitMs: count(value, "maxWaitMs", CONCURRENCY_DEFAULTS.maxWaitMs),
    heartbeatAfterMs: count(value, "heartbeatAfterMs", CONCURRENCY_DEFAULTS.heartbeatAfterMs),
    heartbeatMs: count(value, "heartbeatMs", CONCURRENCY_DEFAULTS.heartbeatMs),
    cooldownMs: count(value, "cooldownMs", CONCURRENCY_DEFAULTS.cooldownMs),
    perModel: resolvePerModel(value.perModel)
  };
  if (options.max < 1) throw new Error("thu-automad: transport.concurrency.max must be at least 1");
  if (options.queueLimit < 1) throw new Error("thu-automad: transport.concurrency.queueLimit must be at least 1");
  if (options.heartbeatAfterMs < 1e3) {
    throw new Error("thu-automad: transport.concurrency.heartbeatAfterMs must be at least 1000");
  }
  if (options.heartbeatMs < 1e3) {
    throw new Error("thu-automad: transport.concurrency.heartbeatMs must be at least 1000");
  }
  if (options.cooldownMs < 1e3) {
    throw new Error("thu-automad: transport.concurrency.cooldownMs must be at least 1000");
  }
  return options;
}
function resolvePerModel(raw) {
  const result = { ...CONCURRENCY_DEFAULTS.perModel };
  if (raw === void 0) return result;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("thu-automad: transport.concurrency.perModel must be a mapping");
  }
  for (const [model, limit] of Object.entries(raw)) {
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
      throw new Error(`thu-automad: transport.concurrency.perModel["${model}"] must be a positive integer`);
    }
    result[model] = limit;
  }
  return result;
}
function asRecord2(config) {
  if (config === void 0 || config === null) return {};
  if (typeof config !== "object" || Array.isArray(config)) {
    throw new Error("thu-automad: config must be a mapping");
  }
  return config;
}
function text(record, key, fallback2) {
  const value = record[key];
  if (value === void 0) return fallback2;
  if (typeof value !== "string") throw new Error(`thu-automad: ${key} must be a string`);
  return value;
}
function boolean(record, key, fallback2) {
  const value = record[key];
  if (value === void 0) return fallback2;
  if (typeof value !== "boolean") throw new Error(`thu-automad: ${key} must be a boolean`);
  return value;
}
function count(record, key, fallback2) {
  const value = record[key];
  if (value === void 0) return fallback2;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`thu-automad: ${key} must be a non-negative integer`);
  }
  return value;
}
function names2(record, key, fallback2) {
  const value = record[key];
  if (value === void 0) return fallback2;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`thu-automad: ${key} must be an array of non-empty provider route names`);
  }
  return value;
}
function ref(record, key, fallback2) {
  const value = text(record, key, fallback2);
  if (!REF_PATTERN.test(value)) {
    throw new Error(`thu-automad: ${key} "${value}" must be an environment-variable name`);
  }
  return value;
}

// src/policy/policy.ts
var OVERRIDE_TTL_MS = 5 * 60 * 1e3;
function matchRule(rules, provider, code) {
  return rules.find((rule2) => (rule2.provider.length === 0 || rule2.provider.includes(provider)) && (rule2.code.length === 0 || rule2.code.includes(code)));
}
function resolutionOf(choice2) {
  if (choice2.action === "switch") {
    return { action: "switch", to: choice2.to };
  }
  return { action: choice2.action };
}
function substitute(text2, values) {
  return text2.replace(/\{(\w+)\}/gu, (match, name2) => values[name2] ?? match);
}
var StepRoutes = class {
  overrides = /* @__PURE__ */ new Map();
  owned = /* @__PURE__ */ new Map();
  failures = /* @__PURE__ */ new Map();
  /**
   * Record the route the next attempt of one step must use.
   * @param key - turn and step identity.
   * @param to - route to apply on re-entry.
   * @param now - current epoch milliseconds.
   */
  set(key, to, now) {
    this.prune(now);
    this.overrides.set(key, { to, at: now });
  }
  /**
   * Consume the route recorded for one step.
   * @param key - turn and step identity.
   * @returns the route to apply, or undefined when this step has none.
   */
  take(key) {
    const entry = this.overrides.get(key);
    if (entry === void 0) return void 0;
    this.overrides.delete(key);
    return entry.to;
  }
  /**
   * Drop one step's pending override.
   * @param key - turn and step identity.
   */
  forget(key) {
    this.overrides.delete(key);
  }
  /** Count one more failure of a step, for a rule that retries before it acts. */
  countFailure(key, now) {
    this.prune(now);
    const count2 = (this.failures.get(key)?.count ?? 0) + 1;
    this.failures.set(key, { count: count2, at: now });
    return count2;
  }
  /** Claim the single attempt this plugin grants for one recovery of a step. */
  claimOwn(key, kind, now) {
    this.prune(now);
    const slot = `${key}#${kind}`;
    if (this.owned.has(slot)) return false;
    this.owned.set(slot, now);
    return true;
  }
  /** Drop entries old enough that no live attempt can claim them. */
  prune(now) {
    for (const [key, entry] of this.overrides) {
      if (now - entry.at > OVERRIDE_TTL_MS) this.overrides.delete(key);
    }
    for (const [key, at] of this.owned) {
      if (now - at > OVERRIDE_TTL_MS) this.owned.delete(key);
    }
    for (const [key, entry] of this.failures) {
      if (now - entry.at > OVERRIDE_TTL_MS) this.failures.delete(key);
    }
  }
};
function stepKey(turn, step) {
  return `${String(turn)}:${String(step)}`;
}

// src/policy/status.ts
var StatusLedger = class {
  appliedAt = Date.now();
  decisions = { retry: 0, switch: 0, fail: 0, ask: 0, renew: 0 };
  last = null;
  /**
   * Record one acted-on failure.
   * @param provider - provider route the failed request targeted.
   * @param code - normalized failure code.
   * @param resolution - the action the policy selected.
   * @param asked - whether a human answered rather than the rule alone.
   * @param now - current epoch milliseconds.
   */
  record(provider, code, resolution, asked, now) {
    this.decisions[resolution.action] += 1;
    if (asked) this.decisions.ask += 1;
    this.last = {
      at: now,
      provider,
      code,
      action: resolution.action,
      ...resolution.action === "switch" ? { to: resolution.to } : {},
      asked
    };
  }
  /** Record that one failure was answered by re-acquiring the credential. */
  noteRenewal() {
    this.decisions.renew += 1;
  }
  /**
   * Project the ledger and the loaded rules onto the wire document.
   * @param rules - the validated rules this plugin is running on.
   * @param routeRegistered - whether the status route is registered.
   * @returns the status document.
   */
  snapshot(rules, routeRegistered) {
    const now = Date.now();
    return {
      plugin: "thu-automad",
      appliedAt: this.appliedAt,
      uptimeSeconds: Math.round((now - this.appliedAt) / 1e3),
      routeRegistered,
      rules: rules.map((rule2) => ({
        provider: rule2.provider,
        code: rule2.code,
        action: rule2.action,
        afterRetries: rule2.afterRetries,
        ...rule2.onFailure === void 0 ? {} : { onFailure: rule2.onFailure }
      })),
      decisions: { ...this.decisions },
      last: this.last
    };
  }
};

// src/protocol.ts
var STATUS_PATH = "/api/thu-automad/status";
var SETTINGS_PATH = "/api/thu-automad/auth-settings";
var TWO_FACTOR_PATH = "/api/thu-automad/two-factor";
var RENEW_PATH = "/api/thu-automad/renew";
var PROBE_PATH = "/api/thu-automad/probe";
var TRANSPORT_CONTROL_PATH = "/api/thu-automad/transport-control";
function routeOf(path) {
  return path.slice(1);
}
var STATUS_ROUTE = routeOf(STATUS_PATH);
var TOKEN_STATES = ["missing", "unknown", "ok", "expiring", "expired", "rejected"];
var RENEW_PHASES = ["off", "idle", "scheduled", "running", "ok", "stalled", "needs-human", "error"];
function isAutomadStatus(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return typeof record.plugin === "string" && typeof record.appliedAt === "number" && typeof record.uptimeSeconds === "number" && typeof record.observedAt === "number" && isTokenStatus(record.token) && isRenewStatus(record.renew) && (record.transport === void 0 || isTransportStatus(record.transport)) && isPolicyStatus(record.policy) && isAuthConfigStatus(record.auth) && (record.twoFactor === null || isTwoFactorPrompt(record.twoFactor));
}
function isTokenStatus(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return typeof record.state === "string" && TOKEN_STATES.includes(record.state) && typeof record.label === "string" && typeof record.credentialRef === "string" && typeof record.credentialConfigured === "boolean" && typeof record.warnBeforeMs === "number" && typeof record.observedAt === "number" && isOptionalText(record.source) && isOptionalText(record.rejectedMessage) && isOptionalNumber(record.issuedAt) && isOptionalNumber(record.expiresAt) && isOptionalNumber(record.changedAt) && isOptionalNumber(record.verifiedAt) && isOptionalNumber(record.rejectedAt);
}
function isRenewStatus(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return typeof record.enabled === "boolean" && typeof record.phase === "string" && RENEW_PHASES.includes(record.phase) && typeof record.noProgress === "boolean" && typeof record.unattendedRenewals === "number" && isOptionalNumber(record.lastAttemptAt) && isOptionalNumber(record.nextAttemptAt) && isOptionalNumber(record.twoFactorAt) && isOptionalText(record.lastCode) && isOptionalText(record.lastMessage);
}
function isTransportStatus(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return typeof record.enabled === "boolean" && (record.mode === "auto" || record.mode === "direct" || record.mode === "webvpn") && (record.effective === "direct" || record.effective === "webvpn" || record.effective === "unknown") && typeof record.port === "number" && Number.isFinite(record.port) && typeof record.listening === "boolean" && isOptionalText(record.lastError) && isOptionalNumber(record.tunnelCookieAt) && isOptionalNumber(record.lastProbeAt) && (record.lastProbeVerdict === null || record.lastProbeVerdict === "ok" || record.lastProbeVerdict === "invalid" || record.lastProbeVerdict === "network") && (record.pools === void 0 || isPoolList(record.pools)) && (record.queueEnabled === void 0 || typeof record.queueEnabled === "boolean") && (record.queueLimit === void 0 || typeof record.queueLimit === "number" && Number.isFinite(record.queueLimit));
}
function isPoolList(value) {
  if (!Array.isArray(value)) return false;
  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const pool = entry;
    return typeof pool.model === "string" && typeof pool.limit === "number" && Number.isFinite(pool.limit) && typeof pool.inFlight === "number" && Number.isFinite(pool.inFlight) && (pool.starting === void 0 || typeof pool.starting === "number" && Number.isInteger(pool.starting) && pool.starting >= 0 && pool.starting <= pool.inFlight) && typeof pool.queued === "number" && Number.isFinite(pool.queued) && isOptionalNumber(pool.pausedUntil) && (pool.recovering === void 0 || typeof pool.recovering === "boolean") && (pool.upstreamError === void 0 || isUpstreamError(pool.upstreamError));
  });
}
function isUpstreamError(value) {
  if (value === null) return true;
  if (typeof value !== "object") return false;
  const error = value;
  return typeof error.at === "number" && Number.isFinite(error.at) && (error.status === null || typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 500 && error.status <= 599);
}
function isPolicyStatus(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return Array.isArray(record.rules) && typeof record.counts === "object" && record.counts !== null && (record.last === null || typeof record.last === "object");
}
function isAuthConfigStatus(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return typeof record.credentialRef === "string" && typeof record.usernameRef === "string" && typeof record.passwordRef === "string" && typeof record.deviceName === "string" && typeof record.tunnel === "boolean" && typeof record.usernameConfigured === "boolean" && (record.usernameDisplay === void 0 || isOptionalText(record.usernameDisplay)) && (record.usernameSource === void 0 || isOptionalText(record.usernameSource)) && typeof record.passwordConfigured === "boolean" && typeof record.tokenConfigured === "boolean" && Array.isArray(record.shadowedRefs);
}
function isTwoFactorPrompt(value) {
  if (typeof value !== "object" || value === null) return false;
  const record = value;
  return (record.stage === "method" || record.stage === "code") && Array.isArray(record.methods) && typeof record.askedAt === "number" && typeof record.expiresAt === "number" && isOptionalText(record.phone) && isOptionalText(record.method);
}
function isOptionalNumber(value) {
  return value === null || typeof value === "number" && Number.isFinite(value);
}
function isOptionalText(value) {
  return value === null || typeof value === "string";
}

// src/renew.ts
import { createHash } from "node:crypto";

// src/auth/login.ts
var MAX_HOPS = 12;
var HOP_TIMEOUT_MS = 2e4;
async function login(request) {
  const auth = loadAuth();
  const started = Date.now();
  const jar = new auth.CookieJar();
  const client = new auth.MadmodelAuthClient(jar);
  const identity = await client.authenticateIdentity(
    FORM_URL,
    CHECK_URL,
    request.username,
    request.password,
    request.fingerprint,
    request.handler
  );
  const body = String(identity.body ?? "");
  const redirect = String(identity.redirectUrl ?? "");
  const fromBody = /[?&]ticket=([^"&'<>\s]+)/iu.exec(body);
  const fromRedirect = /[?&]ticket=([^"&#]+)/u.exec(redirect);
  let ticket = fromBody !== null ? decodeURIComponent(fromBody[1]) : fromRedirect !== null ? decodeURIComponent(fromRedirect[1]) : null;
  let source = fromBody !== null ? "body" : "redirect";
  if (ticket === null) {
    const repaired = redirect.replace(/^(https:\/\/[\w.-]+\.tsinghua\.edu\.cn)(?=[^/])/iu, "$1/");
    const chased = await chaseTicket(repaired, jar);
    ticket = chased;
    source = "chain";
  }
  if (ticket === null) {
    throw new Error("thu-automad: login succeeded but no ticket could be read from the success page");
  }
  const response = await fetch(TICKET_CONSUMER + encodeURIComponent(ticket), {
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS)
  });
  const text2 = await response.text();
  let decoded = null;
  try {
    decoded = JSON.parse(text2);
  } catch (_notJson) {
  }
  const record = typeof decoded === "object" && decoded !== null ? decoded : null;
  const token = typeof record?.data === "string" ? record.data.trim() : "";
  if (token === "") {
    const message = typeof record?.message === "string" ? record.message : text2.slice(0, 200);
    throw new Error(`thu-automad: the ticket was refused at the token endpoint (HTTP ${String(response.status)}): ${message}`);
  }
  return {
    token,
    expiresAt: auth.jwtExpiresAt(token),
    cookie: jar.headerFor(auth.TUNNEL_COOKIE_SCOPE),
    ticketSource: source,
    durationMs: Date.now() - started
  };
}
async function loginViaWebVpn(request) {
  const auth = loadAuth();
  const started = Date.now();
  const client = new auth.MadmodelAuthClient(new auth.CookieJar());
  const result = await client.getMadModelToken({
    username: request.username,
    password: request.password,
    fingerPrint: request.fingerprint,
    ...request.handler === void 0 ? {} : { twoFactorHandler: request.handler }
  });
  return {
    token: result.token,
    expiresAt: result.expiresAt,
    cookie: result.cookie,
    ticketSource: "webvpn",
    durationMs: Date.now() - started
  };
}
async function chaseTicket(startUrl, jar) {
  const auth = loadAuth();
  let url = startUrl;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    if (!auth.isAllowedRedirect(url)) return null;
    const hit = /[?&]ticket=([^&#]+)/iu.exec(url);
    if (hit !== null) return decodeURIComponent(hit[1]);
    const cookie = jar.headerFor(url);
    let response;
    try {
      response = await fetch(url, {
        headers: cookie === "" ? {} : { Cookie: cookie },
        redirect: "manual",
        signal: AbortSignal.timeout(HOP_TIMEOUT_MS)
      });
    } catch (_hopUnreachable) {
      return null;
    }
    try {
      jar.absorb(url, response.headers.getSetCookie());
    } catch (_noSetCookie) {
    }
    const location = response.headers.get("location");
    if (location === null || response.status < 300 || response.status >= 400) return null;
    url = new URL(location, url).href;
  }
  return null;
}

// src/auth/verify.ts
import { setTimeout as delay } from "node:timers/promises";
var PERMISSION_DENIED = 10003;
var MAX_STREAM_BYTES = 64 * 1024;
async function probeDirectSite(timeoutMs = 8e3) {
  let response;
  try {
    response = await fetch(`${SITE}/v1/models`, {
      headers: { accept: "text/html,application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (_unreachable) {
    return "unknown";
  }
  void response.body?.cancel().catch(() => {
  });
  if (response.status >= 300 && response.status < 400) return "offcampus";
  if (response.status >= 500) return "unknown";
  if (response.status >= 200) return "campus";
  return "unknown";
}
async function probeUpstream(options) {
  const { token, model, cookie = "", tunnelMode = false, tunnelPrefix = "", timeoutMs = 6e4 } = options;
  const base = tunnelMode && tunnelPrefix !== "" ? `${tunnelPrefix}/v1` : `${SITE}/v1`;
  const url = `${base}/chat/completions`;
  const started = Date.now();
  let response;
  try {
    const timeout = AbortSignal.timeout(timeoutMs);
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "text/event-stream, application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...cookie !== "" && tunnelMode ? { Cookie: cookie } : {}
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        stream: true,
        max_tokens: 1
      }),
      redirect: "manual",
      signal: options.signal === void 0 ? timeout : AbortSignal.any([timeout, options.signal])
    });
  } catch (_unreachable) {
    const elapsed = Date.now() - started;
    return { ok: false, verdict: "network", ms: elapsed, totalMs: elapsed, detail: "No response from the gateway", url };
  }
  const status = response.status;
  const contentType = probeMediaType(response.headers.get("content-type"));
  const facts = { status, contentType, ms: Date.now() - started, url };
  const failure = (verdict, code2) => ({
    ...facts,
    ok: false,
    verdict,
    totalMs: Date.now() - started,
    ...code2 === void 0 ? {} : { code: code2 },
    detail: `HTTP ${String(status)} \xB7 ${contentType}${code2 === void 0 ? "" : ` \xB7 code ${String(code2)}`}`
  });
  const withoutBody = (verdict) => {
    void response.body?.cancel().catch(() => {
    });
    return failure(verdict);
  };
  if (status >= 300 && status < 400) return withoutBody("session");
  if (status === 401 || status === 403) return withoutBody("rejected");
  if (status === 429) return withoutBody("rate-limited");
  if (status >= 500) return withoutBody("unavailable");
  if (contentType === "text/html") return withoutBody("other");
  let record;
  try {
    record = response.ok && contentType === "text/event-stream" ? await readStreamEvidence(response.body) : jsonRecord(await response.text());
  } catch (_unreadableBody) {
    return failure("network");
  }
  if (response.ok && isCompletion(record)) {
    return { ...facts, ok: true, verdict: "ok", totalMs: Date.now() - started, usage: record?.usage ?? null };
  }
  const code = businessCode(record);
  if (response.ok && record?.success === false && code === PERMISSION_DENIED) return failure("rejected", code);
  return failure("other", code);
}
function probeMediaType(header) {
  switch (header?.split(";", 1)[0]?.trim().toLowerCase()) {
    case "application/json":
      return "application/json";
    case "text/event-stream":
      return "text/event-stream";
    case "text/html":
      return "text/html";
    case "text/plain":
      return "text/plain";
    default:
      return "unknown content type";
  }
}
var FALLBACK_DELAY_MS = 750;
async function verifyCampusToken(options) {
  const cancel = new AbortController();
  const signal = options.signal === void 0 ? cancel.signal : AbortSignal.any([options.signal, cancel.signal]);
  const primary = probeUpstream({ ...options, signal });
  const tryOtherModels = Promise.race([
    primary.then((result) => !result.ok),
    delay(FALLBACK_DELAY_MS, true, { signal }).catch(() => false)
  ]);
  const probes = [
    primary,
    ...KNOWN_MODELS.filter((model) => model !== options.model).map(async (model) => {
      if (!await tryOtherModels || signal.aborted) return void 0;
      return probeUpstream({ ...options, model, signal });
    })
  ];
  try {
    return await Promise.any(probes.map(async (probe) => {
      const result = await probe;
      if (result?.ok) return result;
      throw result;
    }));
  } catch {
    const results = await Promise.all(probes);
    for (const verdict of ["rejected", "session", "rate-limited", "unavailable", "network"]) {
      const match = results.find((result) => result?.verdict === verdict);
      if (match !== void 0) return match;
    }
    return await primary;
  } finally {
    cancel.abort();
  }
}
function asRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function jsonRecord(text2) {
  try {
    return asRecord3(JSON.parse(text2));
  } catch (_notJson) {
    return null;
  }
}
function isCompletion(record) {
  if (record?.success === false || record?.error != null || !Array.isArray(record?.choices)) return false;
  return record.choices.some((value) => {
    const choice2 = asRecord3(value);
    return asRecord3(choice2?.message) !== null || asRecord3(choice2?.delta) !== null;
  });
}
function businessCode(record) {
  const value = record?.status ?? asRecord3(record?.error)?.code;
  return typeof value === "number" && Number.isSafeInteger(value) ? value : void 0;
}
async function readStreamEvidence(body) {
  if (body === null) return null;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let bytes = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) return null;
      bytes += value.byteLength;
      if (bytes > MAX_STREAM_BYTES) return null;
      pending += decoder.decode(value, { stream: true });
      const frames = pending.split(/\r?\n\r?\n/u);
      pending = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /u, "")).join("\n");
        if (data === "[DONE]") return null;
        const record = jsonRecord(data);
        if (record?.success === false || record?.error != null || isCompletion(record)) return record;
      }
    }
  } finally {
    void reader.cancel().catch(() => {
    });
  }
}

// src/auth/session.ts
var SESSION_KEY = "thu-automad/session";
var FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/u;
var EMPTY = {
  fingerprint: null,
  lastRenewAt: null,
  lastExpiresAt: null,
  twoFactorAt: null,
  unattendedRenewals: 0,
  tunnelCookie: null,
  tunnelCookieAt: null
};
var SessionStore = class {
  /**
   * @param ctx - plugin context owning the credentials service.
   */
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  /** Read the stored facts. */
  async read() {
    return readFacts(await this.ctx.credentials.readRecord(SESSION_KEY));
  }
  /**
   * Merge a patch into the stored facts.
   * @param patch - fields to replace.
   * @returns the facts after the write.
   */
  async write(patch) {
    let next = EMPTY;
    await this.ctx.credentials.modifyRecord(SESSION_KEY, (current) => {
      next = { ...readFacts(current), ...patch };
      return Promise.resolve(grant(next));
    });
    return next;
  }
  /** Return the stored device fingerprint, generating and storing one on first use. */
  async ensureFingerprint(generate) {
    let chosen = "";
    await this.ctx.credentials.modifyRecord(SESSION_KEY, (current) => {
      const facts = readFacts(current);
      if (facts.fingerprint !== null) {
        chosen = facts.fingerprint;
        return Promise.resolve(current);
      }
      chosen = generate();
      return Promise.resolve(grant({ ...facts, fingerprint: chosen }));
    });
    return chosen;
  }
};
function grant(facts) {
  return { kind: "grant", payload: facts };
}
function readFacts(record) {
  if (record === void 0 || record.kind !== "grant") return EMPTY;
  const payload = record.payload;
  if (typeof payload !== "object" || payload === null) return EMPTY;
  const raw = payload;
  const fingerprint = typeof raw.fingerprint === "string" && FINGERPRINT_PATTERN.test(raw.fingerprint) ? raw.fingerprint : null;
  return {
    fingerprint,
    lastRenewAt: milliseconds(raw.lastRenewAt),
    lastExpiresAt: milliseconds(raw.lastExpiresAt),
    twoFactorAt: milliseconds(raw.twoFactorAt),
    unattendedRenewals: typeof raw.unattendedRenewals === "number" && Number.isSafeInteger(raw.unattendedRenewals) && raw.unattendedRenewals >= 0 ? raw.unattendedRenewals : 0,
    tunnelCookie: typeof raw.tunnelCookie === "string" && raw.tunnelCookie.length > 0 ? raw.tunnelCookie : null,
    tunnelCookieAt: milliseconds(raw.tunnelCookieAt)
  };
}
function milliseconds(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// src/jwt.ts
function readTokenTimes(token) {
  const segments = token.split(".");
  if (segments.length !== 3) return void 0;
  const payload = segments[1];
  if (payload === void 0 || payload.length === 0) return void 0;
  const claims = decodeClaims(payload);
  if (claims === void 0) return void 0;
  const issuedAt = claimToMillis(claims.iat);
  const expiresAt = claimToMillis(claims.exp);
  if (issuedAt === null && expiresAt === null) return void 0;
  return { issuedAt, expiresAt };
}
function decodeClaims(segment) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch (_notJson) {
    return void 0;
  }
  return typeof parsed === "object" && parsed !== null ? parsed : void 0;
}
function claimToMillis(value) {
  return typeof value === "number" && Number.isFinite(value) ? value * 1e3 : null;
}

// src/two-factor.ts
var CODE_PATTERN = /^\d{6}$/u;
var TwoFactorQueue = class {
  /**
   * @param timeoutMs - how long a question stays open before it is abandoned.
   * @param now - clock, injectable so a check can drive time directly.
   */
  constructor(timeoutMs, now = Date.now) {
    this.timeoutMs = timeoutMs;
    this.now = now;
  }
  timeoutMs;
  now;
  pending = null;
  lastChallengeAt = null;
  /**
   * Build the callback the login chain asks.
   * @returns a handler that parks each question on this queue.
   */
  handler() {
    return async (request) => {
      if (this.pending !== null) {
        throw new Error("thu-automad: a two-factor challenge is already outstanding");
      }
      return await new Promise((resolve) => {
        const askedAt = this.now();
        const entry = {
          stage: request.stage,
          methods: request.stage === "method" ? [...request.methods] : [],
          phone: typeof request.phone === "string" ? request.phone : null,
          method: request.stage === "code" ? request.method : null,
          askedAt,
          expiresAt: askedAt + this.timeoutMs,
          settle: (answer) => {
            clearTimeout(entry.timer);
            if (this.pending === entry) this.pending = null;
            resolve(answer);
          },
          timer: setTimeout(() => {
            entry.settle("");
          }, this.timeoutMs)
        };
        this.lastChallengeAt = askedAt;
        this.pending = entry;
      });
    };
  }
  /**
   * Deliver one browser answer to the outstanding question.
   * @param answer - the answer the settings page or dialog posted.
   * @returns whether the question consumed it.
   */
  answer(answer) {
    const pending = this.pending;
    if (pending === null) return "none";
    if (answer.stage === "cancel") {
      pending.settle("");
      return "accepted";
    }
    if (answer.stage !== pending.stage) return "stale";
    if (answer.stage === "method") {
      if (!pending.methods.includes(answer.method)) return "invalid";
      this.lastChallengeAt = this.now();
      pending.settle({ method: answer.method, trustDevice: answer.trustDevice });
      return "accepted";
    }
    if (!CODE_PATTERN.test(answer.code)) return "invalid";
    pending.settle(answer.code);
    return "accepted";
  }
  /** Abandon an outstanding question, if any. */
  cancel() {
    this.pending?.settle("");
  }
  /**
   * Read the outstanding question for publication.
   * @returns the prompt, or null when the chain is not waiting on a human.
   */
  snapshot() {
    const pending = this.pending;
    if (pending === null) return null;
    return {
      stage: pending.stage,
      methods: pending.methods,
      phone: pending.phone,
      method: pending.method,
      askedAt: pending.askedAt,
      expiresAt: pending.expiresAt
    };
  }
  /** Read the timestamp of the latest two-factor challenge. */
  challengeMark() {
    return this.lastChallengeAt;
  }
};

// src/renew.ts
var MAX_BACKOFF_STEPS = 5;
var PROGRESS_MARGIN_MS = 6e4;
var MAX_MESSAGE_CHARS = 300;
var PROBE_FAILURE_CODES = {
  network: "PROBE_UNREACHABLE",
  session: "PROBE_SESSION_LOST",
  rejected: "TOKEN_REJECTED",
  "rate-limited": "PROBE_RATE_LIMITED",
  unavailable: "PROBE_UNAVAILABLE",
  other: "PROBE_UNEXPECTED"
};
var MODE_PROBE_INTERVAL_MS = 60 * 1e3;
var Renewer = class {
  /**
   * @param ctx - plugin context owning the credentials service.
   * @param options - validated plugin options.
   */
  constructor(ctx, options) {
    this.ctx = ctx;
    this.options = options;
    this.twoFactor = new TwoFactorQueue(options.renew.twoFactorTimeoutMs);
    this.session = new SessionStore(ctx);
    if (!this.enabled) this.phase = "off";
  }
  ctx;
  options;
  phase = "idle";
  lastAttemptAt = null;
  nextAttemptAt = null;
  retryAt = null;
  lastCode = null;
  lastMessage = null;
  noProgress = false;
  failures = 0;
  inFlight;
  lifetime = new AbortController();
  lastRenewedAt = null;
  pending;
  facts = {
    fingerprint: null,
    lastRenewAt: null,
    lastExpiresAt: null,
    twoFactorAt: null,
    unattendedRenewals: 0,
    tunnelCookie: null,
    tunnelCookieAt: null
  };
  /** WebVPN tunnel cookie the current token must be presented with, or empty. */
  cookie = "";
  /** When that cookie was acquired, or null before the first tunnel login. */
  cookieAt = null;
  /** Transport the last decision selected. */
  mode = "unknown";
  /** When the direct host was last probed for reachability. */
  modeProbedAt = 0;
  modeProbe;
  /** When the tunnel was last kept alive, or null. */
  probeAt = null;
  /** What that keepalive probe concluded, or null. */
  probeVerdict = null;
  /** Whether the loopback transport server is listening. */
  proxyListening = false;
  /** Why the loopback transport server is not listening, when it is not. */
  proxyError = null;
  /** Questions the login chain parks here for the Web UI. */
  twoFactor;
  session;
  /** Whether the schedule may run at all. */
  get enabled() {
    return this.options.renew.autoRenew && this.options.renew.refreshAheadMs > 0;
  }
  /** Re-read the durable session facts the status document reports. */
  async refreshFacts() {
    this.facts = await this.session.read();
    if (this.facts.tunnelCookie !== null && (this.cookie === "" || (this.facts.tunnelCookieAt ?? 0) > (this.cookieAt ?? 0))) {
      this.cookie = this.facts.tunnelCookie;
      this.cookieAt = this.facts.tunnelCookieAt;
    }
  }
  /** Evaluate the deadline and renew when it is close enough. */
  async tick() {
    if (this.lifetime.signal.aborted) return;
    if (this.options.transport.enabled) void this.detectTransport();
    if (!this.enabled) {
      this.phase = "off";
      this.nextAttemptAt = null;
      return;
    }
    const now = Date.now();
    if (this.retryAt !== null && now < this.retryAt) {
      this.nextAttemptAt = this.retryAt;
      return;
    }
    if (this.pending !== void 0) {
      await this.ensureFresh("schedule");
      return;
    }
    const resolved = await this.ctx.credentials.resolve(this.options.credentialRef);
    if (resolved === void 0) {
      this.phase = "idle";
      this.nextAttemptAt = null;
      return;
    }
    const times = readTokenTimes(resolved.value);
    if (times?.expiresAt == null) {
      this.phase = "idle";
      this.nextAttemptAt = now + this.options.renew.checkIntervalMs;
      return;
    }
    const due = times.expiresAt - this.options.renew.refreshAheadMs;
    if (now < due) {
      this.phase = "scheduled";
      this.nextAttemptAt = due;
      return;
    }
    await this.ensureFresh("schedule");
  }
  /** Renew once, reusing an attempt already in flight. */
  async ensureFresh(reason, signal) {
    if (this.isCancelled(signal)) return cancelledOutcome();
    if (this.inFlight !== void 0) return await this.inFlight;
    if (this.pending !== void 0 && reason !== "manual" && this.retryAt !== null && Date.now() < this.retryAt) {
      return { renewed: false, code: this.lastCode, message: this.lastMessage };
    }
    if (reason !== "manual" && this.lastRenewedAt !== null && Date.now() - this.lastRenewedAt < this.options.renew.checkIntervalMs) {
      return {
        renewed: false,
        code: "JUST_RENEWED",
        message: "a renewal already succeeded moments ago; the retry will use that token"
      };
    }
    const run = this.attempt(reason, signal);
    this.inFlight = run;
    try {
      return await run;
    } finally {
      this.inFlight = void 0;
    }
  }
  /** Forget the current retry delay so the next evaluation runs now. */
  clearBackoff() {
    this.retryAt = null;
  }
  isCancelled(signal) {
    return this.lifetime.signal.aborted || signal?.aborted === true;
  }
  cancelAttempt() {
    this.pending = void 0;
    this.phase = "idle";
    this.lastCode = "CANCELLED";
    this.lastMessage = "renewal cancelled before adopting the candidate";
    this.retryAt = null;
    this.nextAttemptAt = null;
    return cancelledOutcome();
  }
  /** Abandon any parked question and stop scheduling. */
  stop() {
    this.lifetime.abort();
    this.pending = void 0;
    this.twoFactor.cancel();
  }
  /**
   * Project the current schedule onto the wire value.
   * @returns the renewal status; the credential value is not part of it.
   */
  snapshot() {
    return {
      enabled: this.enabled && !this.lifetime.signal.aborted,
      phase: this.lifetime.signal.aborted ? "off" : this.phase,
      lastAttemptAt: this.lastAttemptAt,
      nextAttemptAt: this.nextAttemptAt,
      lastCode: this.lastCode,
      lastMessage: this.lastMessage,
      noProgress: this.noProgress,
      twoFactorAt: this.facts.twoFactorAt,
      unattendedRenewals: this.facts.unattendedRenewals
    };
  }
  /**
   * Transport facts for the status document and the loopback proxy.
   * @returns the configured and effective path, tunnel cookie age, probe verdict, and server state.
   */
  transportSnapshot() {
    return {
      mode: this.options.transport.mode,
      enabled: this.options.transport.enabled,
      port: this.options.transport.port,
      effective: this.mode,
      cookie: this.cookie,
      cookieAt: this.cookieAt,
      probeAt: this.probeAt,
      probeVerdict: this.probeVerdict,
      listening: this.proxyListening,
      lastError: this.proxyError
    };
  }
  /** Record the loopback server's own state, for the status document. */
  noteProxy(state) {
    this.proxyListening = state.listening;
    this.proxyError = state.lastError;
  }
  /** Decide which upstream requests must use. */
  async detectTransport(force = false) {
    if (!this.options.transport.enabled || this.options.transport.mode === "direct") {
      this.mode = "direct";
      return this.mode;
    }
    if (this.options.transport.mode === "webvpn") {
      this.mode = "webvpn";
      return this.mode;
    }
    if (!force && Date.now() - this.modeProbedAt < MODE_PROBE_INTERVAL_MS) {
      return this.mode === "unknown" ? "direct" : this.mode;
    }
    if (this.modeProbe !== void 0) return this.modeProbe;
    this.modeProbe = probeDirectSite().then((reachability) => {
      if (reachability === "campus") this.mode = "direct";
      else if (reachability === "offcampus") this.mode = "webvpn";
      this.modeProbedAt = Date.now();
      return this.mode === "unknown" ? "direct" : this.mode;
    }).finally(() => {
      this.modeProbe = void 0;
    });
    return this.modeProbe;
  }
  /** Select a route locally, including on the very first request after startup. */
  transportForRequest() {
    const configured = this.options.transport.mode;
    if (configured !== "auto") return configured;
    return this.mode === "webvpn" ? "webvpn" : "direct";
  }
  /**
   * Make sure requests have a usable session on the current transport.
   * @returns whether the current transport can carry a request.
   */
  async ensureTunnelSession() {
    const mode = await this.detectTransport();
    if (mode !== "webvpn") return true;
    if (this.cookie !== "") return true;
    await this.ensureFresh("manual");
    return this.cookie !== "";
  }
  /** Resolve the current route and restore its tunnel session. */
  async ensureTransport() {
    const mode = await this.detectTransport(true);
    if (mode !== "webvpn") return true;
    const verdict = this.cookie === "" ? "invalid" : await this.probeTunnelSession();
    if (verdict === "ok") return true;
    if (verdict === "invalid") await this.discardTunnelSession();
    await this.ensureFresh("manual");
    return this.cookie !== "";
  }
  /** Keep the WebVPN session active between token renewals. */
  async keepalive() {
    if (this.lifetime.signal.aborted) return;
    const mode = await this.detectTransport();
    if (mode !== "webvpn") return;
    if (this.cookie === "") {
      await this.ensureTunnelSession();
      return;
    }
    const verdict = await this.probeTunnelSession();
    if (verdict !== "invalid") return;
    await this.discardTunnelSession();
    await this.ensureTunnelSession();
  }
  /**
   * Ask the tunnel whether the stored session cookie is still served.
   * @returns the verdict, recorded for the status page.
   */
  async probeTunnelSession() {
    const auth = loadAuth();
    const verdict = await auth.probeWebvpnSession(auth.MADMODEL_TUNNEL_MODELS_URL, this.cookie);
    this.probeAt = Date.now();
    this.probeVerdict = verdict;
    return verdict;
  }
  /** Clear an invalid stored WebVPN session. */
  async discardTunnelSession() {
    if (this.cookie === "" && this.facts.tunnelCookie === null) return;
    this.cookie = "";
    this.cookieAt = null;
    this.facts = await this.session.write({ tunnelCookie: null, tunnelCookieAt: null });
  }
  /** Run one renewal attempt and fold its outcome into the reported state. */
  async attempt(reason, signal) {
    const now = Date.now();
    this.lastAttemptAt = now;
    this.phase = "running";
    this.noProgress = false;
    this.nextAttemptAt = null;
    this.lastCode = null;
    this.lastMessage = null;
    const username = await this.resolveText(this.options.auth.usernameRef);
    const password = await this.resolveText(this.options.auth.passwordRef);
    if (username === null || password === null) {
      this.pending = void 0;
      return this.recordFailure(
        "NO_CREDENTIALS",
        `no student id or password is stored under ${this.options.auth.usernameRef} / ${this.options.auth.passwordRef}`,
        true
      );
    }
    let fingerprint;
    try {
      fingerprint = await this.session.ensureFingerprint(() => loadAuth().generateFingerprint());
    } catch (error) {
      return this.recordFailure("FINGERPRINT", describe(error), false);
    }
    const currentToken = (await this.ctx.credentials.resolve(this.options.credentialRef))?.value ?? "";
    const previous = readTokenTimes(currentToken)?.expiresAt ?? null;
    const credentialHash = privateHash(currentToken);
    const identityHash = privateHash(JSON.stringify([username, password]));
    const mode = await this.detectTransport(true);
    const pending = this.pending;
    const reusable = pending !== void 0 && pending.credentialHash === credentialHash && pending.identityHash === identityHash && pending.outcome.expiresAt > now && pending.outcome.ticketSource === "webvpn" === (mode === "webvpn");
    if (!reusable) this.pending = void 0;
    if (pending !== void 0 && !reusable && reason === "schedule" && previous !== null && previous - this.options.renew.refreshAheadMs > now) {
      this.phase = "scheduled";
      this.retryAt = null;
      this.lastCode = null;
      this.lastMessage = null;
      this.nextAttemptAt = previous - this.options.renew.refreshAheadMs;
      return { renewed: false, code: null, message: null };
    }
    const challengeMark = reusable ? pending.challengeMark : this.twoFactor.challengeMark();
    let outcome;
    try {
      outcome = reusable ? pending.outcome : await this.loginWith(mode, username, password, fingerprint);
    } catch (error) {
      const retryThroughTunnel = mode === "direct" && this.options.transport.enabled && this.options.transport.mode === "auto" && looksLikeGate(error);
      if (!retryThroughTunnel) return this.recordFailure(...classify(error));
      this.mode = "webvpn";
      this.modeProbedAt = Date.now();
      try {
        outcome = await this.loginWith("webvpn", username, password, fingerprint);
      } catch (tunnelError) {
        return this.recordFailure(...classify(tunnelError));
      }
    } finally {
      if (signal?.aborted === true) this.twoFactor.cancel();
    }
    if (this.isCancelled(signal)) return this.cancelAttempt();
    const probeSignal = signal === void 0 ? this.lifetime.signal : AbortSignal.any([signal, this.lifetime.signal]);
    const probe = this.options.renew.verifyAfterRenew ? await verifyCampusToken({
      token: outcome.token,
      model: this.options.renew.verifyModel,
      cookie: outcome.cookie,
      tunnelMode: outcome.ticketSource === "webvpn" || this.options.auth.tunnel,
      tunnelPrefix: loadAuth().MADMODEL_VPN_PREFIX,
      signal: probeSignal
    }) : void 0;
    if (this.isCancelled(signal)) return this.cancelAttempt();
    const busy = probe?.verdict === "rate-limited";
    if (probe?.verdict === "unavailable" || probe?.verdict === "network") {
      this.pending = { outcome, credentialHash, identityHash, challengeMark };
      const result = this.recordFailure("VERIFICATION_PENDING", probe.detail ?? "Gateway verification is pending", false);
      this.phase = "scheduled";
      return result;
    }
    this.pending = void 0;
    if (probe !== void 0 && probe.verdict !== "ok" && !busy) {
      return this.recordFailure(
        PROBE_FAILURE_CODES[probe.verdict],
        probe.detail ?? "The new token could not be verified",
        false
      );
    }
    const [latestToken, latestUsername, latestPassword] = await Promise.all([
      this.ctx.credentials.resolve(this.options.credentialRef),
      this.resolveText(this.options.auth.usernameRef),
      this.resolveText(this.options.auth.passwordRef)
    ]);
    if (privateHash(latestToken?.value ?? "") !== credentialHash || privateHash(JSON.stringify([latestUsername, latestPassword])) !== identityHash) {
      return this.recordFailure("INPUT_CHANGED", "stored credentials changed during verification; retry using the current settings", false);
    }
    if (this.isCancelled(signal)) return this.cancelAttempt();
    if (outcome.expiresAt <= Date.now()) {
      return this.recordFailure("CANDIDATE_EXPIRED", "the candidate expired during verification; obtain a fresh token", false);
    }
    if (previous !== null && outcome.expiresAt <= previous + PROGRESS_MARGIN_MS) {
      this.noProgress = true;
      this.phase = "stalled";
      this.lastCode = "NO_PROGRESS";
      this.lastMessage = "the school returned the same token: its expiry did not advance, so nothing was renewed";
      this.retryAt = null;
      this.nextAttemptAt = outcome.expiresAt;
      await this.adoptTunnelSession(outcome);
      return { renewed: false, code: "NO_PROGRESS", message: this.lastMessage };
    }
    try {
      await this.ctx.credentials.set(this.options.credentialRef, outcome.token);
    } catch (error) {
      return this.recordFailure("WRITE_REFUSED", describe(error), true);
    }
    this.cookie = outcome.ticketSource === "webvpn" ? outcome.cookie : "";
    this.cookieAt = this.cookie === "" ? null : Date.now();
    const attended = this.twoFactor.challengeMark() !== challengeMark;
    const unattendedRenewals = attended ? 0 : this.facts.unattendedRenewals + 1;
    this.facts = await this.session.write({
      lastRenewAt: Date.now(),
      lastExpiresAt: outcome.expiresAt,
      tunnelCookie: this.cookie === "" ? null : this.cookie,
      tunnelCookieAt: this.cookieAt,
      ...attended ? { twoFactorAt: this.twoFactor.challengeMark() } : {},
      unattendedRenewals
    });
    this.failures = 0;
    this.retryAt = null;
    this.noProgress = false;
    this.phase = "ok";
    this.lastRenewedAt = Date.now();
    this.lastCode = null;
    this.lastMessage = `renewed on ${reason}; the new token expires at ${new Date(outcome.expiresAt).toISOString()}` + (busy ? " (the gateway was rate-limiting, so it was not verified first)" : "");
    this.nextAttemptAt = outcome.expiresAt - this.options.renew.refreshAheadMs;
    return { renewed: true, code: null, message: this.lastMessage };
  }
  /** Adopt the WebVPN session a login opened, when it minted no new token. */
  async adoptTunnelSession(outcome) {
    const cookie = outcome.ticketSource === "webvpn" ? outcome.cookie : "";
    if (cookie === "") return;
    this.cookie = cookie;
    this.cookieAt = Date.now();
    this.facts = await this.session.write({
      tunnelCookie: this.cookie,
      tunnelCookieAt: this.cookieAt
    });
  }
  /**
   * Run the authentication chain one transport selected.
   *
   * @param mode - transport this attempt uses.
   * @param username - student id.
   * @param password - unified-auth password.
   * @param fingerprint - device fingerprint to present.
   * @returns the login outcome, including the tunnel cookie when one exists.
   */
  async loginWith(mode, username, password, fingerprint) {
    const request = {
      username,
      password,
      fingerprint,
      handler: this.twoFactor.handler()
    };
    return mode === "webvpn" ? await loginViaWebVpn(request) : await login(request);
  }
  /**
   * Record a failed attempt and schedule the next one.
   * @param code - stable code for the UI.
   * @param message - credential-free description.
   * @param needsHuman - whether only a person can change this outcome.
   * @returns the outcome for the caller.
   */
  recordFailure(code, message, needsHuman) {
    const text2 = truncate(message);
    this.failures += 1;
    this.phase = needsHuman ? "needs-human" : "error";
    this.lastCode = code;
    this.lastMessage = text2;
    const steps = Math.min(this.failures, MAX_BACKOFF_STEPS);
    this.retryAt = Date.now() + this.options.renew.checkIntervalMs * 2 ** steps;
    this.nextAttemptAt = this.retryAt;
    return { renewed: false, code, message: text2 };
  }
  /** Resolve one credential reference to a trimmed non-empty value. */
  async resolveText(ref2) {
    const resolved = await this.ctx.credentials.resolve(ref2);
    if (resolved === void 0) return null;
    const value = resolved.value.trim();
    return value === "" ? null : value;
  }
};
function privateHash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function cancelledOutcome() {
  return { renewed: false, code: "CANCELLED", message: "renewal cancelled" };
}
function classify(error) {
  const code = authErrorCode(error);
  const message = describe(error);
  if (isTwoFactorCode(code)) {
    return [code ?? "TWO_FACTOR_REQUIRED", message, true];
  }
  if (isIdentityCode(code)) return [code, message, true];
  return [code ?? "LOGIN_FAILED", message, false];
}
function describe(error) {
  const message = error instanceof Error ? error.message : String(error);
  return truncate(message);
}
function looksLikeGate(error) {
  const text2 = error instanceof Error ? error.message : String(error);
  return /thu-oauth|id\.tsinghua\.edu\.cn|sm2publicKey|<!doctype|<html|ticket was refused/iu.test(text2);
}
function truncate(text2) {
  return text2.length <= MAX_MESSAGE_CHARS ? text2 : `${text2.slice(0, MAX_MESSAGE_CHARS)}\u2026`;
}

// src/watch.ts
var MAX_REFUSAL_CHARS = 200;
var TokenWatch = class {
  /**
   * @param ctx - plugin context owning the credentials service.
   * @param options - validated plugin options.
   */
  constructor(ctx, options) {
    this.ctx = ctx;
    this.options = options;
  }
  ctx;
  options;
  configured = false;
  source = null;
  fingerprint = null;
  issuedAt = null;
  expiresAt = null;
  changedAt = null;
  verifiedAt = null;
  refusal = null;
  /** Re-resolve the reference and rebuild every fact derived from its value. */
  async refresh() {
    const resolved = await this.ctx.credentials.resolve(this.options.credentialRef);
    if (resolved === void 0) {
      this.configured = false;
      this.source = null;
      this.fingerprint = null;
      this.issuedAt = null;
      this.expiresAt = null;
      this.changedAt = null;
      this.refusal = null;
      return;
    }
    const times = readTokenTimes(resolved.value);
    const fingerprint = `${resolved.value.length}:${String(times?.issuedAt ?? "")}:${String(times?.expiresAt ?? "")}`;
    const previous = this.fingerprint;
    this.fingerprint = fingerprint;
    this.configured = true;
    this.source = resolved.source;
    this.issuedAt = times?.issuedAt ?? null;
    this.expiresAt = times?.expiresAt ?? null;
    if (previous !== null && previous !== fingerprint) {
      this.changedAt = Date.now();
      this.refusal = null;
      this.verifiedAt = null;
    }
  }
  /**
   * Attribute one failed model request to this credential when it was refused.
   * @param provider - provider route the request targeted.
   * @param error - value the request failed with.
   */
  observe(provider, error) {
    if (!this.options.providers.includes(provider)) return;
    if (!isAuthRefusal(error)) return;
    this.refusal = { at: Date.now(), message: refusalText(error), fingerprint: this.fingerprint };
  }
  /**
   * Record that one request to this provider completed, which proves the
   * credential currently works and retires an earlier refusal.
   * @param provider - provider route the request targeted.
   */
  settle(provider) {
    if (!this.options.providers.includes(provider)) return;
    this.verifiedAt = Date.now();
    this.refusal = null;
  }
  /**
   * Ask the provider whether the credential still works, without spending a
   * generation. Only a decisive answer changes state: an unreachable probe
   * retains the current state.
   * @returns a promise settling once the probe has been classified.
   */
  async probe() {
    const probe = this.options.probe;
    if (probe === void 0) return;
    const resolved = await this.ctx.credentials.resolve(this.options.credentialRef);
    if (resolved === void 0) return;
    let response;
    try {
      response = await fetch(probe.url, {
        method: "GET",
        headers: { accept: "application/json", authorization: `Bearer ${resolved.value}` },
        redirect: "error"
      });
    } catch (_unreachableProbe) {
      return;
    }
    this.classifyProbe(response.status, probe);
  }
  /**
   * Project the current facts onto the wire value the browser half renders.
   * @returns the status snapshot; the credential value is not part of it.
   */
  snapshot() {
    const now = Date.now();
    return {
      state: this.state(now),
      label: this.options.label,
      credentialRef: this.options.credentialRef,
      credentialConfigured: this.configured,
      source: this.source,
      issuedAt: this.issuedAt,
      expiresAt: this.expiresAt,
      changedAt: this.changedAt,
      verifiedAt: this.verifiedAt,
      rejectedAt: this.refusal?.at ?? null,
      rejectedMessage: this.refusal?.message ?? null,
      warnBeforeMs: this.options.warnBeforeMs,
      observedAt: now
    };
  }
  /** Apply one probe response's status code to the tracked facts. */
  classifyProbe(status, probe) {
    if (status === 401 || status === 403) {
      this.refusal = { at: Date.now(), message: `${probe.url} answered ${String(status)}`, fingerprint: this.fingerprint };
      return;
    }
    if (status >= 200 && status < 300) {
      this.verifiedAt = Date.now();
      this.refusal = null;
    }
  }
  /** Derive the lifecycle state from the tracked facts at one instant. */
  state(now) {
    if (!this.configured) return "missing";
    if (this.refusal !== null && this.refusalStands()) return "rejected";
    if (this.expiresAt === null) return "unknown";
    if (now >= this.expiresAt) return "expired";
    return this.expiresAt - now <= this.options.warnBeforeMs ? "expiring" : "ok";
  }
  /** Whether the recorded refusal still describes the stored credential. */
  refusalStands() {
    const refusal = this.refusal;
    if (refusal === null) return false;
    if (refusal.fingerprint !== null && this.fingerprint !== null && refusal.fingerprint !== this.fingerprint) {
      return false;
    }
    return refusal.at >= (this.changedAt ?? 0);
  }
};
function isAuthRefusal(error) {
  if (typeof error !== "object" || error === null) return false;
  const record = error;
  const failure = typeof record.failure === "object" && record.failure !== null ? record.failure : void 0;
  if (record.code === "AUTH" || failure?.code === "AUTH") return true;
  const status = record.status ?? failure?.status;
  return status === 401 || status === 403;
}
function refusalText(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= MAX_REFUSAL_CHARS ? message : `${message.slice(0, MAX_REFUSAL_CHARS)}\u2026`;
}

// src/transport/proxy.ts
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { pipeline } from "node:stream/promises";
var TITLE_REQUEST_HEADER = "x-dsh-thu-automad-title";
var REQUEST_HEADERS = /* @__PURE__ */ new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "authorization",
  "cookie",
  "accept-encoding",
  TITLE_REQUEST_HEADER
]);
var RESPONSE_HEADERS = /* @__PURE__ */ new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "location"]);
var MAX_BODY_BYTES = 64 * 1024 * 1024;
var UPSTREAM_IDLE_MS = 10 * 60 * 1e3;
var LOGIN_FAILURE_INTERVAL_MS = 15e3;
var LOGIN_SUCCESS_INTERVAL_MS = 5e3;
var RelayError = class extends Error {
  constructor(status, message, code = "thu_automad_transport") {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
};
async function startTransportProxy(options) {
  const concurrency = options.concurrency ?? CONCURRENCY_DEFAULTS;
  const queue = new ModelQueue(concurrency);
  const host = options.host ?? "127.0.0.1";
  let order = 0;
  let login2;
  let loginRetryAt = 0;
  const recover = () => {
    if (login2 !== void 0) return login2;
    if (Date.now() < loginRetryAt) return Promise.resolve(null);
    login2 = Promise.resolve().then(async () => {
      let auth = null;
      try {
        if (await options.refresh()) auth = await options.resolveAuth();
        return auth;
      } catch (error) {
        options.log(`re-authentication failed: ${describe2(error)}`);
        return null;
      } finally {
        loginRetryAt = Date.now() + (auth === null ? LOGIN_FAILURE_INTERVAL_MS : LOGIN_SUCCESS_INTERVAL_MS);
        login2 = void 0;
      }
    });
    return login2;
  };
  const forward = async (request) => {
    let auth = await options.resolveAuth();
    request.signal.throwIfAborted();
    if (auth === null) {
      throw new RelayError(503, "no campus token is configured yet. Open \u8BBE\u7F6E \u2192 \u6E05\u534E MadModel and renew once", "missing_credential");
    }
    if (auth.mode === "webvpn" && auth.cookie === "") {
      auth = await recover();
      request.signal.throwIfAborted();
      if (auth === null || auth.mode === "webvpn" && auth.cookie === "") {
        throw gateError("no WebVPN tunnel session could be established");
      }
    }
    let upstream = await dispatch(request, auth);
    if (!isGate(upstream, request.path)) return upstream;
    drain(upstream.stream);
    const next = await recover();
    request.signal.throwIfAborted();
    if (next === null || next.mode === "webvpn" && next.cookie === "") throw gateError(gateDetail(upstream));
    upstream = await dispatch(request, next);
    if (!isGate(upstream, request.path)) return upstream;
    drain(upstream.stream);
    throw gateError(gateDetail(upstream));
  };
  const handle = async (request, response) => {
    const method = request.method ?? "GET";
    const rawPath = request.url ?? "/";
    const path = normalizePath(rawPath);
    if (path === null) {
      sendError(response, 404, `unsupported request path (${method} ${rawPath})`, "not_found");
      return;
    }
    if (method === "GET" && path === "/v1/models") {
      sendJson(response, 200, {
        object: "list",
        data: KNOWN_MODELS.map((id) => ({ id, object: "model", owned_by: "madmodel" }))
      });
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    response.once("close", () => {
      if (!response.writableFinished) controller.abort();
    });
    const position = order++;
    let body;
    try {
      body = await readBody(request, options.maxBodyBytes ?? MAX_BODY_BYTES);
    } catch (error) {
      sendError(response, 413, describe2(error), "request_too_large");
      return;
    }
    if (signal.aborted || response.destroyed) return;
    const facts = completionFacts(body);
    const heartbeat = queueHeartbeat(response, concurrency);
    const job = method === "GET" ? null : {
      model: facts.model,
      order: position,
      title: request.headers[TITLE_REQUEST_HEADER] === "1",
      signal,
      onWait: () => {
        if (facts.stream) heartbeat.start();
      }
    };
    const outgoing = { method, path, body, headers: request.headers, signal };
    try {
      let retry = false;
      for (; ; ) {
        let slot = null;
        let success = false;
        const releaseAborted = () => {
          slot?.release(false);
        };
        try {
          if (job !== null) slot = await queue.acquire(job, retry);
          heartbeat.admitted();
          signal.throwIfAborted();
          signal.addEventListener("abort", releaseAborted, { once: true });
          const upstream = await forward(outgoing);
          if (signal.aborted || response.destroyed) {
            upstream.stream.destroy();
            return;
          }
          if (slot !== null && upstream.status === 429 && queue.queueEnabled) {
            drain(upstream.stream);
            queue.refused(facts.model, slot, retryAfterMs(upstream.headers));
            retry = true;
            continue;
          }
          heartbeat.stop();
          if (slot !== null) {
            if (isSuccess(upstream.status)) slot.accepted();
            if (upstream.status >= 500 && upstream.status < 600) queue.noteUpstreamError(facts.model, upstream.status);
          }
          const activeSlot = slot;
          success = await deliver(
            upstream,
            response,
            () => {
              activeSlot?.started();
            },
            () => {
              if (activeSlot !== null) queue.noteUpstreamError(facts.model, null);
            }
          );
          return;
        } catch (error) {
          if (signal.aborted) return;
          if (error instanceof QueueError) sendError(response, 503, error.message);
          else if (error instanceof RelayError) sendError(response, error.status, error.message, error.code);
          else {
            if (slot !== null) queue.noteUpstreamError(facts.model, null);
            sendError(response, 502, `upstream unreachable: ${describe2(error)}`);
          }
          return;
        } finally {
          signal.removeEventListener("abort", releaseAborted);
          slot?.release(success);
        }
      }
    } finally {
      heartbeat.stop();
    }
  };
  const state = { listening: false, lastError: null };
  const server = createServer((request, response) => {
    void handle(request, response).catch((error) => {
      options.log(`request failed: ${describe2(error)}`);
      sendError(response, 500, describe2(error), "proxy_error");
    });
  });
  server.on("clientError", (_error, socket) => {
    socket.destroy();
  });
  server.on("error", (error) => {
    state.lastError = describe2(error);
    options.log(`server error: ${state.lastError}`);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  server.unref();
  state.listening = true;
  const address = server.address();
  const port = address !== null && typeof address === "object" ? address.port : options.port;
  options.log(`listening on http://${host}:${port}/v1`);
  return {
    port,
    status: () => ({ ...state, port, queueEnabled: queue.queueEnabled, pools: queue.snapshot() }),
    setQueueEnabled: (enabled) => {
      queue.setEnabled(enabled);
    },
    reset: () => {
      server.closeAllConnections();
      queue.reset();
    },
    close: async () => {
      state.listening = false;
      queue.reset();
      await new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
        server.closeAllConnections();
      });
    }
  };
}
function completionFacts(body) {
  try {
    const parsed = JSON.parse(body.toString("utf8"));
    return {
      model: typeof parsed?.model === "string" && parsed.model ? parsed.model : "<unknown>",
      stream: parsed?.stream === true
    };
  } catch {
    return { model: "<unknown>", stream: false };
  }
}
function normalizePath(raw) {
  let path = raw;
  if (/^https?:\/\//iu.test(path)) {
    try {
      const url = new URL(path);
      path = url.pathname + url.search;
    } catch {
      return null;
    }
  }
  if (path === "/" || path === "/v1" || path === "/v1/") return "/v1/models";
  if (path.startsWith("/v1/")) return path;
  for (const suffix of ["/chat/completions", "/completions", "/models", "/embeddings", "/responses"]) {
    if (path === suffix || path.startsWith(`${suffix}?`)) return `/v1${path}`;
  }
  return null;
}
function dispatch(request, auth) {
  const base = auth.mode === "webvpn" ? auth.tunnelPrefix : SITE;
  const url = new URL(base.replace(/\/+$/u, "") + request.path);
  const headers = copyHeaders(request.headers, REQUEST_HEADERS);
  headers.authorization = `Bearer ${auth.token}`;
  headers["content-length"] = String(request.body.length);
  headers["accept-encoding"] = "identity";
  if (auth.mode === "webvpn") headers.cookie = auth.cookie;
  return new Promise((resolve, reject) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const outgoing = send(url, { method: request.method, headers, signal: request.signal }, (stream) => {
      resolve({ status: stream.statusCode ?? 502, headers: stream.headers, stream });
    });
    outgoing.setTimeout(UPSTREAM_IDLE_MS, () => {
      outgoing.destroy(new Error("the upstream connection became idle"));
    });
    outgoing.on("error", reject);
    outgoing.end(request.body);
  });
}
function copyHeaders(source, excluded) {
  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== void 0 && !excluded.has(key.toLowerCase())) result[key] = value;
  }
  return result;
}
function isGate(upstream, path) {
  return upstream.status >= 300 && upstream.status < 400 || path.startsWith("/v1/chat/") && isSuccess(upstream.status) && String(upstream.headers["content-type"] ?? "").includes("text/html");
}
function gateDetail(upstream) {
  return upstream.status >= 300 && upstream.status < 400 ? `the school's gateway redirected the request (HTTP ${upstream.status})` : `the school's gateway answered with its application page (HTTP ${upstream.status})`;
}
function gateError(detail) {
  return new RelayError(502, `${detail} and re-authentication did not establish a usable session. Open \u8BBE\u7F6E \u2192 \u6E05\u534E MadModel and press \u7ACB\u5373\u7EED\u671F, then retry`);
}
function retryAfterMs(headers) {
  const value = headers["retry-after"];
  const text2 = Array.isArray(value) ? value[0] : value;
  if (text2 === void 0) return null;
  const seconds = Number(text2);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1e3;
  const date = Date.parse(text2);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}
function drain(stream) {
  stream.on("error", () => {
  });
  stream.resume();
}
function isSuccess(status) {
  return status >= 200 && status < 300;
}
function queueHeartbeat(response, options) {
  let timer;
  let interval;
  const stop = () => {
    clearTimeout(timer);
    clearInterval(interval);
    timer = void 0;
    interval = void 0;
  };
  response.once("close", stop);
  return {
    start: () => {
      if (timer !== void 0 || response.headersSent || response.destroyed) return;
      timer = setTimeout(() => {
        if (response.destroyed || response.writableEnded) return;
        response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" });
        response.write(": thu-automad: waiting for a free model slot\n\n");
        interval = setInterval(() => {
          response.write(": thu-automad: still waiting\n\n");
        }, options.heartbeatMs);
      }, options.heartbeatAfterMs);
    },
    admitted: () => {
      if (!response.headersSent) stop();
    },
    stop
  };
}
async function deliver(upstream, response, onStart, onFailure) {
  if (response.destroyed || response.writableEnded) {
    upstream.stream.destroy();
    return false;
  }
  const success = isSuccess(upstream.status);
  const sse = String(upstream.headers["content-type"] ?? "").includes("text/event-stream");
  if (response.headersSent && (!success || !sse)) {
    const detail = (await readSmall(upstream.stream)).trim().slice(0, 300);
    sendError(response, upstream.status, `upstream answered HTTP ${upstream.status}${detail ? `: ${detail}` : ""}`);
    return false;
  }
  if (!response.headersSent) {
    response.writeHead(upstream.status, copyHeaders(upstream.headers, RESPONSE_HEADERS));
    if (success && sse) response.flushHeaders();
  }
  const onError = () => {
    if (!response.destroyed && !response.writableEnded) onFailure();
  };
  upstream.stream.once("error", onError);
  upstream.stream.once("data", onStart);
  try {
    await pipeline(upstream.stream, response);
    return success;
  } catch {
    return false;
  } finally {
    upstream.stream.off("error", onError);
    upstream.stream.off("data", onStart);
  }
}
async function readSmall(stream) {
  const limit = 4096;
  let text2 = "";
  stream.setEncoding("utf8");
  try {
    for await (const chunk of stream) {
      text2 += String(chunk).slice(0, limit - text2.length);
      if (text2.length >= limit) break;
    }
  } catch {
  }
  return text2;
}
async function readBody(request, limit) {
  const chunks = [];
  let length = 0;
  for await (const part of request) {
    const chunk = part;
    length += chunk.length;
    if (length > limit) throw new Error(`request body exceeds ${limit} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}
function sendError(response, status, text2, type = "thu_automad_transport") {
  if (response.destroyed || response.writableEnded) return;
  const error = { message: `thu-automad: ${text2}`, type };
  if (response.headersSent) {
    response.end(`event: error
data: ${JSON.stringify({ error: { ...error, status } })}

`);
  } else sendJson(response, status, { error });
}
function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(body);
}
function describe2(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/index.ts
var name = "thu-automad";
var inject = ["credentials"];
var QUESTION_ID = "thu-automad";
var BUDGET_MS = 5 * 60 * 1e3;
function apply(ctx, config) {
  const options = resolveOptions(config);
  const watch = new TokenWatch(ctx, options);
  const renewer = new Renewer(ctx, options);
  const steps = new StepRoutes();
  const ledger = new StatusLedger();
  const providers = new Set(options.providers);
  const runtime = { proxy: void 0 };
  if (options.transport.enabled) {
    const baseURL = `http://127.0.0.1:${String(options.transport.port)}/v1`;
    ctx.on("llm-pi-ai/request-headers", (request, _headers, next) => {
      const headers = next();
      if (request.purpose !== "session-title" || !providers.has(request.provider) || request.baseURL.replace(/\/+$/u, "") !== baseURL) return headers;
      const marked = new Headers(headers);
      marked.set(TITLE_REQUEST_HEADER, "1");
      return marked;
    }, { global: true });
    ctx.effect(() => {
      let running;
      let disposed = false;
      void startTransportProxy({
        port: options.transport.port,
        concurrency: options.transport.concurrency,
        resolveAuth: async () => {
          const resolved = await ctx.credentials.resolve(options.credentialRef);
          const token = resolved?.value.trim() ?? "";
          if (token === "") return null;
          const mode = renewer.transportForRequest();
          return {
            token,
            mode,
            cookie: mode === "webvpn" ? renewer.transportSnapshot().cookie : "",
            tunnelPrefix: mode === "webvpn" ? loadAuth().MADMODEL_VPN_PREFIX : ""
          };
        },
        refresh: async () => {
          renewer.clearBackoff();
          const usable = await renewer.ensureTransport();
          if (!usable) {
            const status = renewer.snapshot();
            ctx.logger.info(
              `thu-automad: re-authentication did not establish a usable session (${status.lastCode ?? "UNKNOWN"}: ${status.lastMessage ?? "no detail"})`
            );
          }
          return usable;
        },
        log: (message) => {
          ctx.logger.info(`thu-automad: ${message}`);
        }
      }).then((proxy) => {
        if (disposed) {
          void proxy.close();
          return;
        }
        running = proxy;
        runtime.proxy = proxy;
        const state = proxy.status();
        renewer.noteProxy({ listening: state.listening, lastError: state.lastError });
        ctx.logger.info(
          `thu-automad: local transport at http://127.0.0.1:${String(options.transport.port)}/v1 (mode ${options.transport.mode})`
        );
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        renewer.noteProxy({ listening: false, lastError: message });
        ctx.logger.info(
          `thu-automad: local transport failed to start on 127.0.0.1:${String(options.transport.port)}: ${message}`
        );
      });
      return () => {
        disposed = true;
        runtime.proxy = void 0;
        void running?.close();
      };
    }, "thu-automad: local transport");
  }
  if (options.transport.enabled) {
    ctx.effect(() => {
      const timer = setInterval(() => {
        void renewer.keepalive();
      }, options.transport.keepaliveMs);
      return () => {
        clearInterval(timer);
      };
    }, "thu-automad: tunnel keepalive");
  }
  ctx.effect(() => {
    void renewer.refreshFacts().catch((error) => {
      ctx.logger.info(`thu-automad: could not restore transport session: ${String(error)}`);
    });
    void renewer.tick();
    const timer = setInterval(() => {
      void renewer.tick();
    }, options.renew.checkIntervalMs);
    return () => {
      clearInterval(timer);
      renewer.stop();
    };
  }, "thu-automad: renewal schedule");
  if (options.probe !== void 0) {
    const { intervalMs } = options.probe;
    ctx.effect(() => {
      void watch.probe();
      const timer = setInterval(() => {
        void watch.probe();
      }, intervalMs);
      return () => {
        clearInterval(timer);
      };
    }, "thu-automad: credential probe");
  }
  ctx.inject(["connection"], (routeCtx) => {
    routeCtx.effect(
      () => registerRoutes(routeCtx, options, watch, renewer, ledger, runtime),
      "thu-automad: routes"
    );
    routeCtx.logger.info(
      `thu-automad: routes at ${STATUS_PATH}, ${SETTINGS_PATH}, ${TWO_FACTOR_PATH}, ${RENEW_PATH}, ${PROBE_PATH}`
    );
  });
  ctx.on("llm/stream", (request, next) => {
    const stream = next();
    return providers.has(request.provider) ? watchStream(watch, request.provider, stream) : stream;
  }, { global: true });
  ctx.on("agent/request-error", async (payload, next) => {
    const rule2 = matchRule(options.rules, payload.provider, payload.failure.code);
    if (rule2 === void 0) return await next();
    const now = Date.now();
    const key = stepKey(payload.turn, payload.step);
    if (rule2.afterRetries > 0 && steps.countFailure(key, now) <= rule2.afterRetries) return await next();
    let decision;
    if (rule2.action === "renew") {
      ledger.noteRenewal();
      decision = await renewFirst(ctx, renewer, payload, rule2);
    } else {
      decision = await decide(ctx, payload, rule2);
    }
    const { resolution } = decision;
    ledger.record(payload.provider, payload.failure.code, resolution, decision.asked, now);
    if (resolution.action === "fail") return void 0;
    if (resolution.action === "retry") {
      const downstream2 = await next();
      if (downstream2 !== void 0) return downstream2;
      if (!steps.claimOwn(key, "retry", now)) return void 0;
      return { kind: "retry" };
    }
    if (resolution.action !== "switch") return void 0;
    steps.set(key, resolution.to, now);
    const downstream = await next();
    if (downstream !== void 0) return downstream;
    if (!steps.claimOwn(key, routeTag(resolution.to), now)) {
      steps.forget(key);
      return void 0;
    }
    return { kind: "retry" };
  });
  ctx.on("agent/request", async (payload, next) => {
    const seed = await next();
    const to = steps.take(stepKey(payload.turn, payload.step));
    if (to === void 0) return seed;
    if (seed.provider === to.provider && seed.model === to.model) return seed;
    return { ...seed, provider: to.provider, model: to.model };
  });
  ctx.effect(() => {
    void watch.refresh();
    return () => {
    };
  }, "thu-automad: initial credential read");
  if (options.renew.autoRenew && options.renew.refreshAheadMs > 0) {
    const { checkIntervalMs } = options.renew;
    ctx.effect(() => {
      void renewer.tick();
      const timer = setInterval(() => {
        void renewer.tick();
      }, checkIntervalMs);
      return () => {
        clearInterval(timer);
        renewer.stop();
      };
    }, "thu-automad: renewal schedule");
  }
  ctx.logger.info(
    `thu-automad: active with ${String(options.rules.length)} rule(s), watching ${[...providers].join(", ") || "(no provider)"}`
  );
}
function routeTag(to) {
  return `switch:${to.provider}/${to.model}`;
}
function registerRoutes(ctx, options, watch, renewer, ledger, runtime) {
  const connection = ctx.connection;
  const disposers = [
    connection.fetch.register({
      path: STATUS_PATH,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: async (request) => {
        await watch.refresh();
        await renewer.refreshFacts();
        const policy = ledger.snapshot(options.rules, true);
        const status = {
          plugin: policy.plugin,
          appliedAt: policy.appliedAt,
          uptimeSeconds: policy.uptimeSeconds,
          token: watch.snapshot(),
          renew: renewer.snapshot(),
          transport: transportStatusOf(renewer, runtime, options),
          policy: { rules: policy.rules, counts: policy.decisions, last: policy.last },
          twoFactor: renewer.twoFactor.snapshot(),
          auth: await authConfigStatus(ctx, options),
          observedAt: Date.now()
        };
        return Response.json(status, { headers: { "cache-control": "no-store" } });
      }
    }),
    connection.fetch.register({
      path: TWO_FACTOR_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (request) => {
        const body = await readJson(request);
        const answer = parseTwoFactorAnswer(body);
        if (answer === null) return json({ ok: false, error: "the body is not a two-factor answer" }, 400);
        const outcome = renewer.twoFactor.answer(answer);
        if (outcome === "none") return json({ ok: false, error: "no two-factor challenge is outstanding" }, 409);
        if (outcome === "stale") return json({ ok: false, error: "the challenge is waiting for a different stage" }, 409);
        if (outcome === "invalid") return json({ ok: false, error: "that answer is not valid for this stage" }, 400);
        return json({ ok: true });
      }
    }),
    connection.fetch.register({
      path: SETTINGS_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (request) => {
        const body = await readJson(request);
        const parsed = parseSettingsRequest(body);
        if (parsed === null) return json({ ok: false, error: "the body is not an auth-settings request" }, 400);
        const errors = await applySettings(ctx, options, parsed);
        const outcome = { ok: errors.length === 0, errors, auth: await authConfigStatus(ctx, options) };
        return json({ ...outcome });
      }
    }),
    connection.fetch.register({
      path: RENEW_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async () => {
        renewer.clearBackoff();
        const outcome = await renewer.ensureFresh("manual");
        return json({ ok: true, renewed: outcome.renewed, code: outcome.code, message: outcome.message });
      }
    }),
    connection.fetch.register({
      path: PROBE_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async () => {
        await renewer.detectTransport(true);
        const outcome = { ok: true, transport: transportStatusOf(renewer, runtime, options) };
        return json({ ...outcome });
      }
    }),
    connection.fetch.register({
      path: TRANSPORT_CONTROL_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (request) => {
        const body = await readJson(request);
        const record = typeof body === "object" && body !== null ? body : {};
        const queue = typeof record.queue === "boolean" ? record.queue : null;
        const reset = record.reset === true;
        if (queue === null && !reset) return json({ ok: false, error: "expected { queue: boolean } or { reset: true }" }, 400);
        const proxy = runtime.proxy;
        if (proxy === void 0) return json({ ok: false, error: "the loopback transport is not running" }, 503);
        if (queue !== null) proxy.setQueueEnabled(queue);
        if (reset) proxy.reset();
        const outcome = { ok: true, transport: transportStatusOf(renewer, runtime, options) };
        return json(outcome);
      }
    })
  ];
  return () => {
    for (const dispose of disposers) void dispose();
  };
}
function transportStatusOf(renewer, runtime, options) {
  const transport = renewer.transportSnapshot();
  const proxy = runtime.proxy?.status();
  return {
    enabled: transport.enabled,
    mode: transport.mode,
    effective: transport.effective,
    port: transport.port,
    listening: transport.listening,
    lastError: transport.lastError,
    tunnelCookieAt: transport.cookieAt,
    lastProbeAt: transport.probeAt,
    lastProbeVerdict: transport.probeVerdict,
    pools: proxy?.pools ?? [],
    queueEnabled: proxy?.queueEnabled,
    queueLimit: options.transport.concurrency.queueLimit
  };
}
async function renewFirst(ctx, renewer, payload, rule2) {
  const signal = AbortSignal.any([payload.signal, AbortSignal.timeout(BUDGET_MS)]);
  const outcome = await renewer.ensureFresh("refusal", signal);
  if (outcome.renewed) return { resolution: { action: "retry" }, asked: false };
  return await fallback(ctx, payload, rule2);
}
async function fallback(ctx, payload, rule2) {
  switch (rule2.onFailure) {
    case "switch":
      return { resolution: { action: "switch", to: rule2.to }, asked: false };
    case "ask":
      return await ask(ctx, payload, rule2.ask);
    case "fail":
      return { resolution: { action: "fail" }, asked: false };
    case "retry":
      return { resolution: { action: "retry" }, asked: false };
    default:
      return { resolution: { action: "fail" }, asked: false };
  }
}
async function decide(ctx, payload, rule2) {
  if (rule2.action !== "ask") {
    return {
      // Validation guarantees a target for this action.
      resolution: rule2.action === "switch" ? { action: "switch", to: rule2.to } : { action: rule2.action },
      asked: false
    };
  }
  return await ask(ctx, payload, rule2.ask);
}
async function ask(ctx, payload, spec) {
  const questions = ctx.get("userQuestions");
  if (questions === void 0) return { resolution: resolutionOf(spec.unavailable), asked: false };
  try {
    const answer = await questions.ask({
      questions: [{
        id: QUESTION_ID,
        question: substitute(spec.question, {
          provider: payload.provider,
          code: payload.failure.code,
          message: payload.failure.message
        }),
        detail: payload.failure.message,
        options: spec.choices.map((choice2) => ({ label: choice2.label }))
      }],
      agent: payload.agent,
      // The turn signal alone would leave a dismissed question pending forever.
      signal: AbortSignal.any([payload.signal, AbortSignal.timeout(spec.timeoutMs)])
    });
    const selected = answer.answers.find((item) => item.id === QUESTION_ID)?.selected[0];
    const chosen = spec.choices.find((choice2) => choice2.label === selected);
    return chosen === void 0 ? { resolution: resolutionOf(spec.unavailable), asked: false } : { resolution: resolutionOf(chosen), asked: true };
  } catch (_unanswerable) {
    return { resolution: resolutionOf(spec.unavailable), asked: false };
  }
}
async function authConfigStatus(ctx, options) {
  const refs = [
    options.credentialRef,
    options.auth.usernameRef,
    options.auth.passwordRef
  ];
  const described = await Promise.all(refs.map(async (ref2) => {
    const info = await ctx.credentials.describe(ref2);
    return { ref: ref2, configured: info.configured, writable: info.writable };
  }));
  const of = (ref2) => described.find((entry) => entry.ref === ref2) ?? { configured: false, writable: true };
  const username = await ctx.credentials.resolve(options.auth.usernameRef);
  return {
    credentialRef: options.credentialRef,
    usernameRef: options.auth.usernameRef,
    passwordRef: options.auth.passwordRef,
    deviceName: DEVICE_NAME,
    tunnel: options.auth.tunnel,
    usernameConfigured: of(options.auth.usernameRef).configured,
    usernameDisplay: username?.value ?? null,
    usernameSource: username?.source ?? null,
    passwordConfigured: of(options.auth.passwordRef).configured,
    tokenConfigured: of(options.credentialRef).configured,
    shadowedRefs: described.filter((entry) => !entry.writable).map((entry) => entry.ref)
  };
}
async function* watchStream(watch, provider, stream) {
  let completed = false;
  try {
    for await (const chunk of stream) yield chunk;
    completed = true;
  } catch (error) {
    watch.observe(provider, error);
    throw error;
  } finally {
    if (completed) watch.settle(provider);
  }
}
async function readJson(request) {
  try {
    return await request.json();
  } catch (_notJson) {
    return void 0;
  }
}
function parseSettingsRequest(body) {
  if (typeof body !== "object" || body === null) return null;
  const record = body;
  const field = (value) => {
    if (value === void 0) return void 0;
    if (value === null) return null;
    return typeof value === "string" ? value : void 0;
  };
  const username = field(record.username);
  const password = field(record.password);
  if (record.username !== void 0 && username === void 0) return null;
  if (record.password !== void 0 && password === void 0) return null;
  return {
    ...username === void 0 ? {} : { username },
    ...password === void 0 ? {} : { password }
  };
}
async function applySettings(ctx, options, request) {
  const refs = { username: options.auth.usernameRef, password: options.auth.passwordRef };
  const errors = [];
  for (const field of ["username", "password"]) {
    const value = request[field];
    if (value === void 0) continue;
    try {
      if (value === null || value.trim() === "") await ctx.credentials.unset(refs[field]);
      else await ctx.credentials.set(refs[field], value.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        field,
        // Return the credential service write error to settings.
        code: message.includes("read-only by the launching environment") ? "shadowed" : "refused",
        message
      });
    }
  }
  return errors;
}
function parseTwoFactorAnswer(body) {
  if (typeof body !== "object" || body === null) return null;
  const record = body;
  if (record.stage === "cancel") return { stage: "cancel" };
  if (record.stage === "method") {
    if (typeof record.method !== "string" || record.method.length === 0) return null;
    return { stage: "method", method: record.method, trustDevice: record.trustDevice !== false };
  }
  if (record.stage === "code") {
    if (typeof record.code !== "string") return null;
    return { stage: "code", code: record.code };
  }
  return null;
}
function json(value, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}
export {
  PROBE_PATH,
  RENEW_PATH,
  SETTINGS_PATH,
  STATUS_PATH,
  TRANSPORT_CONTROL_PATH,
  TWO_FACTOR_PATH,
  apply,
  inject,
  isAuthRefusal,
  isAutomadStatus,
  isTokenStatus,
  matchRule,
  name,
  readTokenTimes,
  resolveOptions,
  resolveRules,
  routeOf,
  stepKey
};
//# sourceMappingURL=index.js.map
