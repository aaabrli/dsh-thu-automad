// src/auth/chain.ts
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
var SSO_APP = "d736f067a6705ab942df52f958a0f23b";
var ID_PREFIX = "https://id.tsinghua.edu.cn";
var SITE = "https://madmodel.cs.tsinghua.edu.cn";
var FORM_URL = `${ID_PREFIX}/do/off/ui/auth/login/form/${SSO_APP}/0`;
var CHECK_URL = `${ID_PREFIX}/do/off/ui/auth/login/check`;
var TICKET_CONSUMER = `${SITE}/model-api/auth-login/check?ticket=`;
var DEVICE_NAME = "dsh-madmodel";
var CANDIDATES = [
  "../vendor/madmodel/madmodel-auth.js",
  "../../vendor/madmodel/madmodel-auth.js",
  "./vendor/madmodel/madmodel-auth.js"
];
var loaded;
function loadAuth() {
  if (loaded !== void 0) return loaded;
  const require2 = createRequire(import.meta.url);
  for (const candidate of CANDIDATES) {
    const path = fileURLToPath(new URL(candidate, import.meta.url));
    if (!existsSync(path)) continue;
    loaded = require2(path);
    return loaded;
  }
  throw new Error(
    "thu-automad: the vendored authentication chain is missing; expected vendor/madmodel/madmodel-auth.js inside the installed package"
  );
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
var KNOWN_MODELS = [
  "DeepSeek-V4.1-Flash",
  "qwen3.8-27b",
  "DeepSeek-R1-W8A8"
];
var CONCURRENCY_DEFAULTS = {
  // The gateway's own per-model limit is 3 (madmodel's modelList.max_tokens).
  // Start and cap there so the learned value never exceeds what the account can
  // actually run; a 429 still halves it and it grows back after successes.
  initial: 3,
  max: 3,
  perModel: {},
  min: 1,
  growAfter: 4,
  queueLimit: 32,
  // The user asked for "wait until it can continue", so no plugin-side ceiling:
  // the wait ends when capacity appears or the caller gives up.
  maxWaitMs: 0,
  heartbeatAfterMs: 2e4,
  heartbeatMs: 15e3,
  cooldownMs: 5e3,
  maxCooldownMs: 12e4
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
  const known = new Set(Object.keys(CONCURRENCY_DEFAULTS));
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw new Error(`thu-automad: unknown transport.concurrency key "${key}"`);
  }
  const options = {
    initial: count(value, "initial", CONCURRENCY_DEFAULTS.initial),
    max: count(value, "max", CONCURRENCY_DEFAULTS.max),
    min: count(value, "min", CONCURRENCY_DEFAULTS.min),
    growAfter: count(value, "growAfter", CONCURRENCY_DEFAULTS.growAfter),
    queueLimit: count(value, "queueLimit", CONCURRENCY_DEFAULTS.queueLimit),
    maxWaitMs: count(value, "maxWaitMs", CONCURRENCY_DEFAULTS.maxWaitMs),
    heartbeatAfterMs: count(value, "heartbeatAfterMs", CONCURRENCY_DEFAULTS.heartbeatAfterMs),
    heartbeatMs: count(value, "heartbeatMs", CONCURRENCY_DEFAULTS.heartbeatMs),
    cooldownMs: count(value, "cooldownMs", CONCURRENCY_DEFAULTS.cooldownMs),
    maxCooldownMs: count(value, "maxCooldownMs", CONCURRENCY_DEFAULTS.maxCooldownMs),
    perModel: resolvePerModel(value.perModel)
  };
  if (options.initial < 1) throw new Error("thu-automad: transport.concurrency.initial must be at least 1");
  if (options.min < 1 || options.min > options.initial) {
    throw new Error("thu-automad: transport.concurrency.min must be between 1 and initial");
  }
  if (options.max < options.initial) {
    throw new Error("thu-automad: transport.concurrency.max must be at least initial");
  }
  if (options.growAfter < 1) throw new Error("thu-automad: transport.concurrency.growAfter must be at least 1");
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
  if (options.maxCooldownMs < options.cooldownMs) {
    throw new Error("thu-automad: transport.concurrency.maxCooldownMs must be at least cooldownMs");
  }
  for (const [model, limit] of Object.entries(options.perModel ?? {})) {
    if (limit < options.min) {
      throw new Error(`thu-automad: transport.concurrency.perModel["${model}"] must be at least min`);
    }
  }
  return options;
}
function resolvePerModel(raw) {
  if (raw === void 0) return {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("thu-automad: transport.concurrency.perModel must be a mapping");
  }
  const result = {};
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
  /**
   * Count one more failure of a step, for a rule that retries before it acts.
   *
   * The count is kept per turn and step rather than per rule: a retried step
   * re-enters the failure listener with the same identity, and a step that
   * succeeds never comes back here at all.
   * @param key - turn and step identity.
   * @param now - current epoch milliseconds.
   * @returns how many times this step has failed, including this one.
   */
  countFailure(key, now) {
    this.prune(now);
    const count2 = (this.failures.get(key)?.count ?? 0) + 1;
    this.failures.set(key, { count: count2, at: now });
    return count2;
  }
  /**
   * Claim the single attempt this plugin grants for one recovery of a step.
   *
   * The claim is per recovery kind rather than per step: a plain retry and a
   * switch to a named route are different requests, so a switch decided after
   * the retry slot was spent must still be able to apply itself. Each kind is
   * granted at most once per step, which is what keeps a failing route from
   * looping.
   * @param key - turn and step identity.
   * @param kind - recovery kind; a switch uses its target route's own tag.
   * @param now - current epoch milliseconds.
   * @returns true when this caller claimed it, false when it was already taken.
   */
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
  /**
   * Record that one failure was answered by re-acquiring the credential.
   *
   * Counted beside the action rather than as one: a renewal that worked ends in
   * a retry, and one that needed a human ends in whatever `onFailure` named, so
   * the action counts say what happened to the request while this says how
   * often the credential was re-acquired to get there.
   */
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
    return typeof pool.model === "string" && typeof pool.limit === "number" && Number.isFinite(pool.limit) && (pool.ceiling === void 0 || typeof pool.ceiling === "number" && Number.isFinite(pool.ceiling)) && typeof pool.inFlight === "number" && Number.isFinite(pool.inFlight) && typeof pool.queued === "number" && Number.isFinite(pool.queued) && isOptionalNumber(pool.pausedUntil) && (pool.upstreamError === void 0 || isUpstreamError(pool.upstreamError));
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

// src/auth/verify.ts
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
  try {
    response.body?.cancel();
  } catch (_alreadyClosed) {
  }
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
      signal: AbortSignal.timeout(timeoutMs)
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
var BUSY_RETRIES = 2;
var BUSY_DELAY_MS = 800;
async function probeUpstreamWithRetry(options) {
  let result = await probeUpstream(options);
  for (let attempt = 1; attempt <= BUSY_RETRIES && result.verdict === "rate-limited"; attempt += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, BUSY_DELAY_MS * attempt);
    });
    result = await probeUpstream(options);
  }
  return result;
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
  const outcome = {
    token,
    expiresAt: auth.jwtExpiresAt(token),
    cookie: jar.headerFor(auth.TUNNEL_COOKIE_SCOPE),
    ticketSource: source,
    durationMs: Date.now() - started
  };
  if (request.verify !== void 0) {
    outcome.probe = await probeUpstreamWithRetry({
      token,
      model: request.verify.model,
      cookie: outcome.cookie,
      tunnelMode: request.verify.tunnel,
      tunnelPrefix: auth.MADMODEL_VPN_PREFIX
    });
  }
  return outcome;
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
  const outcome = {
    token: result.token,
    expiresAt: result.expiresAt,
    cookie: result.cookie,
    ticketSource: "webvpn",
    durationMs: Date.now() - started
  };
  if (request.verify !== void 0) {
    outcome.probe = await probeUpstreamWithRetry({
      token: outcome.token,
      model: request.verify.model,
      cookie: outcome.cookie,
      tunnelMode: true,
      tunnelPrefix: auth.MADMODEL_VPN_PREFIX
    });
  }
  return outcome;
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
  /**
   * Read the stored facts.
   *
   * The payload crosses a durable boundary, so it is validated rather than
   * trusted: a hand-edited or older document must degrade to "nothing known"
   * instead of feeding a malformed fingerprint to the login chain.
   * @returns the stored facts, or {@link EMPTY} when nothing is stored.
   */
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
  /**
   * Return the stored device fingerprint, generating and storing one on first use.
   *
   * A fingerprint is reused for the life of the record, never rotated: the
   * school only extends trust to a fingerprint it has seen, and a fresh one
   * would discard a window that is still open.
   * @param generate - produces a new fingerprint when none is stored.
   * @returns the fingerprint now on record.
   */
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
  /**
   * Read when a challenge was last raised or answered, without clearing it.
   *
   * A successful renewal that ran while this value moved was attended by a
   * human; one that ran while it stayed put proves the school still trusts the
   * stored fingerprint.
   * @returns epoch milliseconds, or null when no challenge has ever been raised.
   */
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
  stopped = false;
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
  /** When the tunnel was last kept alive, or null. */
  probeAt = null;
  /** What that keepalive probe concluded, or null. */
  probeVerdict = null;
  /** Whether the loopback transport server is listening. */
  proxyListening = false;
  /** Why the loopback transport server is not listening, when it is not. */
  proxyError = null;
  /** Per-model admission state the loopback server last reported. */
  proxyPools = [];
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
  /**
   * Evaluate the deadline and renew when it is close enough.
   *
   * Called on a fixed tick rather than scheduled at one instant, because the
   * token can change underneath the schedule — a manual paste, another
   * process's renewal — and re-reading one JWT is cheaper than tracking every
   * way it could move.
   * @returns a promise settling once the evaluation finished.
   */
  async tick() {
    if (this.stopped) return;
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
  /**
   * Renew once, reusing an attempt already in flight.
   *
   * Two callers wanting a fresh token at the same moment must produce one
   * login, not two: the school allows one attempt per identity, and a second
   * concurrent login would either duplicate the fingerprint's registration or
   * fail against the first.
   * @param reason - why the renewal was requested.
   * @param signal - caller cancellation; abandons any parked two-factor question.
   * @returns what the attempt concluded.
   */
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
  /**
   * Forget the current retry delay so the next evaluation runs now.
   *
   * Used by the manual trigger: a person who just corrected a password must not
   * wait out a backoff earned by the previous failure.
   */
  clearBackoff() {
    this.retryAt = null;
  }
  isCancelled(signal) {
    return this.stopped || signal?.aborted === true;
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
    this.stopped = true;
    this.pending = void 0;
    this.twoFactor.cancel();
  }
  /**
   * Project the current schedule onto the wire value.
   * @returns the renewal status; the credential value is not part of it.
   */
  snapshot() {
    return {
      enabled: this.enabled && !this.stopped,
      phase: this.stopped ? "off" : this.phase,
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
      lastError: this.proxyError,
      pools: this.proxyPools
    };
  }
  /** Record the loopback server's own state, for the status document. */
  noteProxy(state) {
    this.proxyListening = state.listening;
    this.proxyError = state.lastError;
    if (state.pools !== void 0) this.proxyPools = state.pools;
  }
  /**
   * Decide which upstream requests must use.
   *
   * A pinned mode is returned as configured. `auto` asks the direct host: the
   * school answers a campus request with the application and an off-campus
   * request with a redirect into the unified-auth form, so one unauthenticated
   * GET separates the two. The decision is cached for a few minutes because a
   * per-request probe would double every call's latency, and re-probed on
   * demand after a failure that suggests the network changed.
   * @param force - probe even when the cached decision is still fresh.
   * @returns the transport the caller should use.
   */
  async detectTransport(force = false) {
    if (!this.options.transport.enabled || this.options.transport.mode === "direct") {
      this.mode = "direct";
      return this.mode;
    }
    if (this.options.transport.mode === "webvpn") {
      this.mode = "webvpn";
      return this.mode;
    }
    const now = Date.now();
    if (!force && this.mode !== "unknown" && now - this.modeProbedAt < MODE_PROBE_INTERVAL_MS) {
      return this.mode;
    }
    const reachability = await probeDirectSite();
    if (reachability === "campus") this.mode = "direct";
    else if (reachability === "offcampus") this.mode = "webvpn";
    this.modeProbedAt = now;
    if (this.mode === "unknown") return "direct";
    return this.mode;
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
  /**
   * Make the transport usable for the network this process is on now.
   *
   * This is what the loopback transport asks for after the school's gate has
   * refused a request. Two things are decided here, not guessed:
   *
   * The network decision is forced, because the gate just contradicted the
   * cached one — a Wi-Fi switch is exactly when that cache is wrong. On the
   * campus path the token already in hand is all a request needs, so returning
   * to campus recovers without touching the school at all.
   *
   * Off campus a request is only as good as its tunnel session, and a cookie can
   * outlive the session it belongs to. So the stored session is *verified*
   * rather than assumed: a live one needs no repair, an expired one must be
   * discarded before the login replaces it, and a probe that could not reach the
   * tunnel says nothing either way — the login is the only thing that can
   * improve that state, and a login that fails leaves the old cookie untouched,
   * so unreliable evidence never costs the current session.
   * @returns whether a usable transport now exists.
   */
  async ensureTransport() {
    const mode = await this.detectTransport(true);
    if (mode !== "webvpn") return true;
    const verdict = this.cookie === "" ? "invalid" : await this.probeTunnelSession();
    if (verdict === "ok") return true;
    if (verdict === "invalid") await this.discardTunnelSession();
    await this.ensureFresh("manual");
    return this.cookie !== "";
  }
  /**
   * Keep the WebVPN tunnel alive between token renewals.
   *
   * The tunnel drops an idle session after roughly two hours, which is shorter
   * than the token's own lifetime, so a token still inside its window would
   * otherwise stop working with no renewal due. An invalid verdict discards the
   * cookie and re-runs the chain; a network failure changes nothing.
   * @returns a promise settling once the probe and any repair finished.
   */
  async keepalive() {
    if (this.stopped) return;
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
  /**
   * Forget the stored tunnel session.
   *
   * Discarding before a login matters: the login replaces the cookie only on
   * success, so a session the tunnel has already rejected would otherwise stay
   * in place and keep answering the login page.
   */
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
      if (reusable) {
        outcome = {
          ...pending.outcome,
          probe: await probeUpstreamWithRetry({
            token: pending.outcome.token,
            model: this.options.renew.verifyModel,
            cookie: pending.outcome.cookie,
            tunnelMode: mode === "webvpn" || this.options.auth.tunnel,
            tunnelPrefix: loadAuth().MADMODEL_VPN_PREFIX
          })
        };
      } else {
        outcome = await this.loginWith(mode, username, password, fingerprint);
      }
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
    const probe = outcome.probe;
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
  /**
   * Adopt the WebVPN session a login opened, when it minted no new token.
   *
   * The tunnel cookie belongs to the session, not to the token: it is what makes
   * the tunneled host answer, and it stays valid while the old token does. The
   * two facts are therefore decided separately — only the token has to move for
   * a renewal to count, and only the cookie has to exist for the transport to
   * work off campus.
   * @param outcome - what the login produced.
   */
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
   * Verification follows the same transport: a token minted by the tunnel is
   * checked through the tunnel, and a direct login keeps the configured probe
   * choice. Every other input is transport-independent.
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
      handler: this.twoFactor.handler(),
      ...this.options.renew.verifyAfterRenew ? { verify: { model: this.options.renew.verifyModel, tunnel: mode === "webvpn" || this.options.auth.tunnel } } : {}
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
  /**
   * Re-resolve the reference and rebuild every fact derived from its value.
   *
   * Consumers re-resolve once per operation, so a token pasted into the
   * settings page reaches the next status read without a plugin restart.
   * @returns a promise settling once the stored credential has been read.
   */
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
   * leaves the previous facts standing rather than inventing a failure.
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
  /**
   * Whether the recorded refusal still describes the stored credential.
   *
   * A refusal names the value it was recorded against, so a value that has been
   * replaced since retires it even when this process never saw the change.
   * @returns true when the refusal is evidence about the current value.
   */
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
var OWNED_HEADERS = /* @__PURE__ */ new Set([
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
  "accept-encoding"
]);
var RESPONSE_HOP_HEADERS = /* @__PURE__ */ new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "location"
]);
var SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-store",
  connection: "keep-alive"
};
var DEFAULT_MAX_BODY_BYTES = 64 * 1024 * 1024;
var UPSTREAM_IDLE_MS = 10 * 60 * 1e3;
var RECOVERY_FAILURE_COOLDOWN_MS = 15e3;
var RECOVERY_SUCCESS_INTERVAL_MS = 5e3;
var ERROR_BODY_LIMIT = 4096;
var QueueError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "QueueError";
  }
  code;
};
var Scheduler = class {
  /**
   * @param options - admission policy.
   * @param log - diagnostic sink.
   * @param models - model ids to expose before their first request.
   */
  constructor(options, log, models = []) {
    this.options = options;
    this.log = log;
    for (const model of models) this.poolFor(model);
  }
  options;
  log;
  pools = /* @__PURE__ */ new Map();
  enabled = true;
  /** Whether new requests still wait for capacity. */
  get queueEnabled() {
    return this.enabled;
  }
  /**
   * Turn admission control on or off.
   *
   * Off is the escape hatch for a queue the user cannot clear: waiting requests
   * start immediately and later arrivals bypass the limit, accepting that the
   * gateway may answer 429 instead of the queue answering "wait forever".
   * @param enabled - whether requests should wait for a slot.
   */
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      for (const pool of this.pools.values()) {
        while (pool.queue.length > 0) {
          const waiter = pool.queue.shift();
          if (waiter === void 0) break;
          this.stopHeartbeat(waiter.waiting);
          waiter.resolve(this.grant(pool));
        }
      }
      return;
    }
    for (const pool of this.pools.values()) this.pump(pool);
  }
  /**
   * Forget every in-flight request and drop the queue.
   *
   * The proxy calls this only after closing its own connections, so the slots
   * it forgets belong to responses that no longer have a client.
   */
  reset() {
    for (const pool of this.pools.values()) {
      for (const waiter of pool.queue.splice(0)) {
        this.stopHeartbeat(waiter.waiting);
        waiter.reject(new QueueError("thu-automad: the transport was reset", "queue_timeout"));
      }
      pool.inFlight = 0;
      pool.limit = this.initialFor(pool.model);
      pool.successes = 0;
      pool.cooldownMs = this.options.cooldownMs;
      pool.pausedUntil = 0;
    }
  }
  /** Per-model admission facts for the status document. */
  snapshot() {
    const now = Date.now();
    return [...this.pools.values()].map((pool) => ({
      model: pool.model,
      limit: pool.limit,
      ceiling: pool.ceiling,
      inFlight: pool.inFlight,
      queued: pool.queue.length,
      pausedUntil: pool.pausedUntil > now ? pool.pausedUntil : null,
      upstreamError: pool.upstreamError === null ? null : { ...pool.upstreamError }
    }));
  }
  /**
   * Wait for a model slot.
   * @param model - model id the request names.
   * @param stream - whether the request is a stream; only streams get keepalives.
   * @param response - response the keepalive writes to.
   * @param waiting - keepalive state shared across retries.
   * @returns the granted slot, or null when the client disappeared first.
   */
  async acquire(model, stream, response, waiting) {
    const pool = this.poolFor(model);
    if (waiting.stopped || response.destroyed || response.writableEnded) return null;
    if (!this.enabled) return this.grant(pool);
    if (pool.queue.length === 0 && this.canGrant(pool)) return this.grant(pool);
    if (pool.queue.length >= this.options.queueLimit) {
      throw new QueueError(
        `thu-automad: ${String(pool.queue.length)} requests are already waiting for "${model}"`,
        "queue_full"
      );
    }
    return await new Promise((resolve, reject) => {
      const waiter = {
        waiting,
        response,
        stream,
        queuedAt: Date.now(),
        resolve,
        reject,
        granted: false
      };
      pool.queue.push(waiter);
      this.armHeartbeat(waiter);
      if (this.options.maxWaitMs > 0) {
        const timer = setTimeout(() => {
          const index = pool.queue.indexOf(waiter);
          if (index < 0) return;
          pool.queue.splice(index, 1);
          this.stopHeartbeat(waiting);
          reject(new QueueError(`thu-automad: waited ${String(this.options.maxWaitMs)} ms for "${model}"`, "queue_timeout"));
        }, this.options.maxWaitMs);
        const originalResolve = waiter.resolve;
        const originalReject = waiter.reject;
        waiter.resolve = (slot) => {
          clearTimeout(timer);
          originalResolve(slot);
        };
        waiter.reject = (error) => {
          clearTimeout(timer);
          originalReject(error);
        };
      }
      this.pump(pool);
    });
  }
  /** Remove a still-queued request because its client disconnected. */
  cancel(waiting) {
    waiting.stopped = true;
    this.stopHeartbeat(waiting);
    for (const pool of this.pools.values()) {
      const index = pool.queue.findIndex((waiter2) => waiter2.waiting === waiting);
      if (index < 0) continue;
      const [waiter] = pool.queue.splice(index, 1);
      waiter?.reject(new QueueError("thu-automad: client disconnected while waiting", "client_gone"));
      return;
    }
  }
  /** Pause a model after the gateway refused one of its requests with 429. */
  noteRateLimit(model, retryAfterMs2) {
    const pool = this.poolFor(model);
    const pause = Math.max(pool.cooldownMs, retryAfterMs2 ?? 0);
    pool.pausedUntil = Math.max(pool.pausedUntil, Date.now() + pause);
    pool.cooldownMs = Math.min(this.options.maxCooldownMs, pool.cooldownMs * 2);
    pool.limit = Math.max(this.options.min, Math.ceil(pool.limit / 2));
    pool.successes = 0;
    this.log(
      `"${model}" answered 429: pausing ${String(pause)} ms, limit now ${String(pool.limit)}, ${String(pool.queue.length)} queued`
    );
    this.pump(pool);
  }
  /** Keep service health independent of queue capacity and token lifetime. */
  noteUpstreamError(model, status) {
    this.poolFor(model).upstreamError = { status, at: Date.now() };
  }
  /** Stop a keepalive, if one is running. */
  stopHeartbeat(waiting) {
    if (waiting.heartbeatTimer !== void 0) clearTimeout(waiting.heartbeatTimer);
    if (waiting.heartbeat !== void 0) clearInterval(waiting.heartbeat);
    waiting.heartbeatTimer = void 0;
    waiting.heartbeat = void 0;
  }
  /** Return the pool for one model, creating it on first use. */
  poolFor(model) {
    let pool = this.pools.get(model);
    if (pool === void 0) {
      const limit = this.initialFor(model);
      pool = {
        model,
        limit,
        ceiling: Math.max(limit, this.ceilingFor(model)),
        inFlight: 0,
        successes: 0,
        cooldownMs: this.options.cooldownMs,
        pausedUntil: 0,
        upstreamError: null,
        queue: [],
        pumpTimer: void 0,
        pumping: false
      };
      this.pools.set(model, pool);
    }
    return pool;
  }
  /** Configured per-model limit, falling back to the global initial value. */
  initialFor(model) {
    return this.options.perModel?.[model] ?? this.options.initial;
  }
  /** Gateway ceiling for one model, never below its configured limit. */
  ceilingFor(model) {
    return this.options.perModel?.[model] ?? this.options.max;
  }
  /** Whether a request may start on this model right now. */
  canGrant(pool) {
    return pool.inFlight < pool.limit && Date.now() >= pool.pausedUntil;
  }
  /** Hand one slot out and count it. */
  grant(pool) {
    pool.inFlight += 1;
    let released = false;
    return {
      release: (success) => {
        if (released) return;
        released = true;
        pool.inFlight = Math.max(0, pool.inFlight - 1);
        if (success) {
          pool.upstreamError = null;
          pool.successes += 1;
          pool.cooldownMs = this.options.cooldownMs;
          if (pool.successes >= this.options.growAfter && pool.limit < pool.ceiling) {
            pool.limit += 1;
            pool.successes = 0;
            this.log(`"${pool.model}" completed ${String(this.options.growAfter)} in a row: limit now ${String(pool.limit)}`);
          }
        }
        this.pump(pool);
      }
    };
  }
  /** Start a queued request when a slot exists. */
  pump(pool) {
    if (pool.pumping) return;
    pool.pumping = true;
    try {
      for (; ; ) {
        while (pool.queue.length > 0 && pool.queue[0]?.waiting.stopped === true) pool.queue.shift();
        if (pool.queue.length === 0) return;
        const now = Date.now();
        if (now < pool.pausedUntil) {
          this.schedulePump(pool, pool.pausedUntil - now);
          return;
        }
        if (pool.inFlight >= pool.limit) return;
        const waiter = pool.queue.shift();
        if (waiter === void 0) return;
        if (waiter.waiting.stopped) continue;
        waiter.granted = true;
        this.stopHeartbeat(waiter.waiting);
        waiter.resolve(this.grant(pool));
      }
    } finally {
      pool.pumping = false;
    }
  }
  /** Wake the pump once a pause ends. */
  schedulePump(pool, delayMs) {
    if (pool.pumpTimer !== void 0) return;
    pool.pumpTimer = setTimeout(() => {
      pool.pumpTimer = void 0;
      this.pump(pool);
    }, Math.max(10, delayMs + 5));
  }
  /** Start keeping a queued streaming request's connection alive. */
  armHeartbeat(waiter) {
    const { waiting, response } = waiter;
    if (!waiter.stream || waiting.heartbeatTimer !== void 0 || waiting.heartbeat !== void 0) return;
    if (waiting.stopped || waiting.headersSent) return;
    const delay = Math.max(10, this.options.heartbeatAfterMs - (Date.now() - waiter.queuedAt));
    waiting.heartbeatTimer = setTimeout(() => {
      waiting.heartbeatTimer = void 0;
      if (waiting.stopped || waiter.granted) return;
      try {
        response.writeHead(200, SSE_HEADERS);
        response.write(": thu-automad: waiting for a free model slot\n\n");
        waiting.headersSent = true;
      } catch (_clientGone) {
        waiting.stopped = true;
        return;
      }
      waiting.heartbeat = setInterval(() => {
        if (waiting.stopped) return;
        try {
          response.write(`: thu-automad: still waiting (${String(Date.now() - waiter.queuedAt)} ms)

`);
        } catch (_clientGone) {
          waiting.stopped = true;
        }
      }, Math.max(10, this.options.heartbeatMs));
    }, delay);
  }
};
async function startTransportProxy(options) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const scheduler = new Scheduler(options.concurrency ?? CONCURRENCY_DEFAULTS, options.log, KNOWN_MODELS);
  const state = { listening: false, port: options.port, lastError: null, queueEnabled: true, pools: [] };
  let recovery = null;
  const resolveAuth = async () => {
    try {
      return await options.resolveAuth();
    } catch (error) {
      options.log(`could not read transport facts: ${describe2(error)}`);
      return null;
    }
  };
  const recoverTransport = async () => {
    if (recovery !== null) {
      if (recovery.running !== null) return await recovery.running;
      const wait = recovery.usable ? RECOVERY_SUCCESS_INTERVAL_MS : RECOVERY_FAILURE_COOLDOWN_MS;
      if (Date.now() - recovery.at < wait) return null;
    }
    const entry = { at: Date.now(), usable: false, running: null };
    entry.running = (async () => {
      let usable = false;
      try {
        usable = await options.refresh();
      } catch (error) {
        options.log(`re-authentication failed: ${describe2(error)}`);
      }
      const next = usable ? await resolveAuth() : null;
      entry.usable = next !== null;
      entry.at = Date.now();
      return next;
    })();
    recovery = entry;
    try {
      return await entry.running;
    } finally {
      entry.running = null;
    }
  };
  const handle = async (request, response) => {
    const rawPath = request.url ?? "/";
    const method = request.method ?? "GET";
    const path = normalizeRequestPath(rawPath);
    if (path === null) {
      sendJson(response, 404, {
        error: {
          message: `thu-automad: unsupported request path (${method} ${rawPath})`,
          type: "not_found"
        }
      });
      return;
    }
    if (path !== rawPath) options.log(`normalized ${method} ${rawPath} -> ${path}`);
    if (method === "GET" && path === "/v1/models") {
      sendJson(response, 200, {
        object: "list",
        data: [{ id: "DeepSeek-V4.1-Flash", object: "model", owned_by: "madmodel" }]
      });
      return;
    }
    let body;
    try {
      body = await readBody(request, maxBodyBytes);
    } catch (error) {
      sendJson(response, 413, {
        error: { message: `thu-automad: ${describe2(error)}`, type: "request_too_large" }
      });
      return;
    }
    const auth = await resolveAuth();
    if (auth === null) {
      sendJson(response, 503, {
        error: {
          message: "thu-automad: no campus token is configured yet; fill in \u8BBE\u7F6E \u2192 \u6E05\u534E MadModel and renew once",
          type: "missing_credential"
        }
      });
      return;
    }
    let session = auth;
    if (session.mode === "webvpn" && session.cookie === "") {
      const recovered = await recoverTransport();
      if (recovered === null) {
        sendJson(response, 502, {
          error: {
            message: gateMessage("no WebVPN tunnel session could be established"),
            type: "thu_automad_transport"
          }
        });
        return;
      }
      session = recovered;
    }
    if (method === "GET") {
      let currentAuth = session;
      let recovered = false;
      for (; ; ) {
        let upstream;
        try {
          upstream = await dispatch(method, path, body, request.headers, currentAuth);
        } catch (error) {
          sendJson(response, 502, {
            error: { message: `thu-automad: upstream unreachable: ${describe2(error)}`, type: "transport_error" }
          });
          return;
        }
        if (isGateResponse(upstream, path)) {
          drain(upstream.stream);
          if (!recovered) {
            recovered = true;
            const next = await recoverTransport();
            if (next !== null) {
              currentAuth = next;
              continue;
            }
          }
          sendJson(response, 502, {
            error: { message: gateMessage(gateDetail(upstream)), type: "thu_automad_transport" }
          });
          return;
        }
        handOff(upstream, response, false, () => {
        });
        return;
      }
    }
    const facts = completionFacts(body);
    const waiting = {
      stopped: false,
      headersSent: false,
      heartbeatTimer: void 0,
      heartbeat: void 0
    };
    let activeSlot = null;
    const onClose = () => {
      if (response.writableEnded) return;
      waiting.stopped = true;
      scheduler.cancel(waiting);
      activeSlot?.release(false);
      activeSlot = null;
    };
    response.once("close", onClose);
    try {
      for (; ; ) {
        let slot;
        try {
          slot = await scheduler.acquire(facts.model, facts.stream, response, waiting);
        } catch (error) {
          if (error instanceof QueueError && error.code === "client_gone") return;
          const message = error instanceof Error ? error.message : String(error);
          fail(response, waiting, 503, message);
          return;
        }
        if (slot === null) return;
        activeSlot = slot;
        if (waiting.stopped || response.destroyed) {
          slot.release(false);
          activeSlot = null;
          return;
        }
        try {
          let currentAuth = session;
          let recovered = false;
          for (; ; ) {
            let upstream;
            try {
              upstream = await dispatch(method, path, body, request.headers, currentAuth);
            } catch (error) {
              scheduler.noteUpstreamError(facts.model, null);
              slot.release(false);
              slot = null;
              activeSlot = null;
              fail(response, waiting, 502, `thu-automad: upstream unreachable: ${describe2(error)}`);
              return;
            }
            if (upstream.status === 429) {
              drain(upstream.stream);
              scheduler.noteRateLimit(facts.model, retryAfterMs(upstream.headers));
              slot.release(false);
              slot = null;
              activeSlot = null;
              break;
            }
            if (upstream.status >= 500 && upstream.status <= 599) {
              scheduler.noteUpstreamError(facts.model, upstream.status);
            }
            if (isGateResponse(upstream, path)) {
              drain(upstream.stream);
              if (!recovered) {
                recovered = true;
                const next = await recoverTransport();
                if (next !== null) {
                  currentAuth = next;
                  continue;
                }
              }
              scheduler.stopHeartbeat(waiting);
              slot.release(false);
              slot = null;
              activeSlot = null;
              fail(response, waiting, 502, gateMessage(gateDetail(upstream)));
              return;
            }
            scheduler.stopHeartbeat(waiting);
            if (waiting.stopped || response.destroyed) {
              drain(upstream.stream);
              slot.release(false);
              slot = null;
              activeSlot = null;
              return;
            }
            const owned = slot;
            slot = null;
            activeSlot = null;
            handOff(
              upstream,
              response,
              waiting.headersSent,
              (success) => {
                owned.release(success);
              },
              () => {
                scheduler.noteUpstreamError(facts.model, null);
              }
            );
            return;
          }
        } finally {
          slot?.release(false);
          activeSlot = null;
        }
      }
    } finally {
      response.off("close", onClose);
      scheduler.stopHeartbeat(waiting);
      activeSlot?.release(false);
      activeSlot = null;
    }
  };
  const server = createServer((request, response) => {
    void handle(request, response).catch((error) => {
      options.log(`request failed: ${describe2(error)}`);
      if (response.headersSent) response.destroy();
      else {
        sendJson(response, 500, {
          error: { message: `thu-automad: ${describe2(error)}`, type: "proxy_error" }
        });
      }
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
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port, options.host ?? "127.0.0.1");
  });
  state.listening = true;
  const address = server.address();
  if (address !== null && typeof address === "object") state.port = address.port;
  server.unref();
  options.log(`listening on http://${options.host ?? "127.0.0.1"}:${String(state.port)}/v1`);
  return {
    port: state.port,
    status: () => ({ ...state, queueEnabled: scheduler.queueEnabled, pools: scheduler.snapshot() }),
    setQueueEnabled: (enabled) => {
      scheduler.setEnabled(enabled);
    },
    reset: () => {
      scheduler.reset();
      server.closeAllConnections();
    },
    close: async () => {
      state.listening = false;
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
    const model = typeof parsed.model === "string" && parsed.model !== "" ? parsed.model : "__default__";
    return { model, stream: parsed.stream === true };
  } catch (_notJson) {
    return { model: "__default__", stream: false };
  }
}
function normalizeRequestPath(raw) {
  let path = raw;
  if (/^https?:\/\//iu.test(path)) {
    try {
      const parsed = new URL(path);
      path = parsed.pathname + parsed.search;
    } catch (_notAUrl) {
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
function dispatch(method, path, body, incoming, auth) {
  const base = auth.mode === "webvpn" ? auth.tunnelPrefix : SITE;
  const url = new URL(base.replace(/\/+$/u, "") + path);
  const headers = copyRequestHeaders(incoming);
  headers["authorization"] = `Bearer ${auth.token}`;
  headers["content-length"] = String(body.length);
  headers["accept-encoding"] = "identity";
  if (auth.mode === "webvpn" && auth.cookie !== "") headers["cookie"] = auth.cookie;
  return new Promise((resolve, reject) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = send(url, { method, headers }, (upstream) => {
      resolve({ status: upstream.statusCode ?? 502, headers: upstream.headers, stream: upstream });
    });
    request.setTimeout(UPSTREAM_IDLE_MS, () => {
      request.destroy(new Error(`upstream did not answer within ${String(UPSTREAM_IDLE_MS)} ms`));
    });
    request.on("error", reject);
    request.end(body);
  });
}
function copyRequestHeaders(incoming) {
  const headers = {};
  for (const [name2, value] of Object.entries(incoming)) {
    if (value === void 0) continue;
    if (OWNED_HEADERS.has(name2.toLowerCase())) continue;
    headers[name2] = Array.isArray(value) ? value.join(", ") : value;
  }
  return headers;
}
function isGateResponse(response, path) {
  if (response.status >= 300 && response.status < 400) return true;
  if (!path.startsWith("/v1/chat/")) return false;
  if (response.status < 200 || response.status >= 300) return false;
  const type = String(response.headers["content-type"] ?? "");
  return type.includes("text/html");
}
function gateDetail(response) {
  if (response.status >= 300 && response.status < 400) {
    return `the school's gateway redirected the request (HTTP ${String(response.status)})`;
  }
  return `the school's gateway answered with its application page (HTTP ${String(response.status)})`;
}
function gateMessage(detail) {
  return `thu-automad: ${detail} and re-authentication did not establish a usable session. Off campus this needs the WebVPN tunnel: open \u8BBE\u7F6E \u2192 \u6E05\u534E MadModel and press \u7ACB\u5373\u7EED\u671F, then retry`;
}
function retryAfterMs(headers) {
  const value = headers["retry-after"];
  const text2 = Array.isArray(value) ? value[0] : value;
  if (text2 === void 0) return null;
  const seconds = Number(text2);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1e3, 36e5);
  const date = Date.parse(text2);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}
function drain(stream) {
  stream.on("error", () => {
  });
  stream.resume();
}
function handOff(upstream, response, headersSent, done, upstreamFailed) {
  let finished = false;
  const finish = (success2) => {
    if (finished) return;
    finished = true;
    done(success2);
  };
  const success = upstream.status >= 200 && upstream.status < 300;
  const streamFailed = () => {
    if (!response.destroyed && !response.writableEnded) upstreamFailed?.();
    response.destroy();
    finish(false);
  };
  if (response.destroyed || response.writableEnded) {
    upstream.stream.destroy();
    finish(false);
    return;
  }
  if (headersSent) {
    const type = String(upstream.headers["content-type"] ?? "");
    if (success && type.includes("text/event-stream")) {
      response.on("finish", () => {
        finish(true);
      });
      response.on("close", () => {
        finish(false);
      });
      upstream.stream.on("error", streamFailed);
      upstream.stream.pipe(response);
      return;
    }
    void readSmall(upstream.stream).then((text2) => {
      const detail = text2.trim().slice(0, 300);
      const message = detail === "" ? `thu-automad: upstream answered HTTP ${String(upstream.status)} after the request was queued` : `thu-automad: upstream answered HTTP ${String(upstream.status)} after the request was queued: ${detail}`;
      try {
        response.write(`event: error
data: ${JSON.stringify({ error: { message, type: "thu_automad_transport", status: upstream.status } })}

`);
        response.end();
      } catch (_clientGone) {
        response.destroy();
      }
      finish(false);
    });
    return;
  }
  const headers = {};
  for (const [name2, value] of Object.entries(upstream.headers)) {
    if (value === void 0) continue;
    if (RESPONSE_HOP_HEADERS.has(name2.toLowerCase())) continue;
    headers[name2] = value;
  }
  response.writeHead(upstream.status, headers);
  response.on("finish", () => {
    finish(success);
  });
  response.on("close", () => {
    finish(false);
  });
  upstream.stream.on("error", streamFailed);
  upstream.stream.on("close", () => {
    if (!response.writableEnded) finish(false);
  });
  upstream.stream.pipe(response);
}
async function readSmall(stream) {
  return await new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    stream.on("data", (chunk) => {
      size += chunk.length;
      if (size > ERROR_BODY_LIMIT) {
        stream.destroy();
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    stream.on("error", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}
function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        request.destroy();
        reject(new Error(`request body exceeds ${String(limit)} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    request.on("error", reject);
  });
}
function fail(response, waiting, status, message) {
  if (!waiting.headersSent) {
    sendJson(response, status, { error: { message, type: "thu_automad_transport" } });
    return;
  }
  try {
    response.write(`event: error
data: ${JSON.stringify({ error: { message, type: "thu_automad_transport", status } })}

`);
    response.end();
  } catch (_clientGone) {
    response.destroy();
  }
}
function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(body)),
    "cache-control": "no-store"
  });
  response.end(body);
}
function describe2(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
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
    ctx.effect(() => {
      let running;
      let disposed = false;
      void startTransportProxy({
        port: options.transport.port,
        concurrency: options.transport.concurrency,
        resolveAuth: async () => {
          const mode = await renewer.detectTransport();
          const resolved = await ctx.credentials.resolve(options.credentialRef);
          const token = resolved?.value.trim() ?? "";
          if (token === "") return null;
          const snapshot = renewer.transportSnapshot();
          return {
            token,
            mode: mode === "webvpn" ? "webvpn" : "direct",
            cookie: mode === "webvpn" ? snapshot.cookie : "",
            tunnelPrefix: loadAuth().MADMODEL_VPN_PREFIX
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
        renewer.noteProxy({ listening: state.listening, lastError: state.lastError, pools: state.pools });
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
    pools: runtime.proxy?.status().pools ?? transport.pools,
    queueEnabled: runtime.proxy?.status().queueEnabled,
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
        // The seam's own refusal to write over a launching-environment value is
        // the one failure a user can act on, and it must not be flattened into
        // a generic error.
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
