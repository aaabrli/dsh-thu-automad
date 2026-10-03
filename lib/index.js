import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
//#region src/auth/chain.ts
/**
* Loader and typed surface for the vendored Tsinghua authentication chain.
*
* The chain is reverse-engineered protocol knowledge — SM2-encrypted password
* login, the school's two-factor handshake, ticket redemption — and this
* package does not reimplement it. `vendor/madmodel/` holds a byte-identical
* CommonJS copy with its SHA-256 recorded in `vendor/madmodel/README.md`, plus
* a `package.json` marker that keeps the directory CommonJS despite the owning
* package declaring `"type": "module"`. This module is the only place that
* reaches it.
*
* It loads through `createRequire` rather than `import` on purpose. The module
* installs a `globalThis.window.crypto` shim *before* it evaluates the vendored
* SM2 library, because that library seeds its entropy pool at evaluation time
* and would otherwise fall back to `Math.random` for the bytes that encrypt the
* password. A static `import` would hoist the SM2 evaluation above the shim and
* weaken the ciphertext silently. `require` is synchronous, so the transient
* global it writes can never be observed by anything else.
* @module dsh-thu-automad/auth/chain
*/
/** School SSO app id for the DEEPSEEK application: `md5('DEEPSEEK')`, fixed by the school. */
const SSO_APP = "d736f067a6705ab942df52f958a0f23b";
/** Identity-provider host every login step starts from. */
const ID_PREFIX = "https://id.tsinghua.edu.cn";
/**
* madmodel site the redeemed token belongs to.
*
* The ticket chain and the upstream probe both build their URLs from this
* constant, so this — not the provider row's `baseURL` — is the host a renewal
* talks to. The two are configured independently and are not cross-checked:
* pointing the route elsewhere changes model requests only.
*/
const SITE = "https://madmodel.cs.tsinghua.edu.cn";
/** Login form the direct path posts the encrypted password to. */
const FORM_URL = `${ID_PREFIX}/do/off/ui/auth/login/form/${SSO_APP}/0`;
/** Endpoint the login form posts to and that answers with the ticket redirect. */
const CHECK_URL = `${ID_PREFIX}/do/off/ui/auth/login/check`;
/** Endpoint that redeems a ticket for the madmodel JWT. */
const TICKET_CONSUMER = `${SITE}/model-api/auth-login/check?ticket=`;
/** Device name the vendored chain registers on the school's trusted-device list. */
const DEVICE_NAME = "dsh-madmodel";
/** Candidate locations of the vendored entry, relative to this module. */
const CANDIDATES = [
	"../vendor/madmodel/madmodel-auth.js",
	"../../vendor/madmodel/madmodel-auth.js",
	"./vendor/madmodel/madmodel-auth.js"
];
let loaded;
/**
* Load the vendored authentication chain, once per process.
* @returns the module's exports.
* @throws Error when no vendored copy is present next to this plugin.
*/
function loadAuth() {
	if (loaded !== void 0) return loaded;
	const require = createRequire(import.meta.url);
	for (const candidate of CANDIDATES) {
		const path = fileURLToPath(new URL(candidate, import.meta.url));
		if (!existsSync(path)) continue;
		loaded = require(path);
		return loaded;
	}
	throw new Error("thu-automad: the vendored authentication chain is missing; expected vendor/madmodel/madmodel-auth.js inside the installed package");
}
/**
* Read one error's stable code, when it carries one.
* @param error - value a login step failed with.
* @returns the code, or undefined when the value is not a coded chain error.
*/
function authErrorCode(error) {
	if (typeof error !== "object" || error === null) return void 0;
	const code = error.code;
	return typeof code === "string" && code.length > 0 ? code : void 0;
}
/**
* Whether a chain error code means the school demanded a two-factor answer.
* @param code - value from {@link authErrorCode}.
* @returns true for every code the two-factor handshake can produce.
*/
function isTwoFactorCode(code) {
	return code !== void 0 && code.startsWith("TWO_FACTOR_");
}
/**
* Whether a chain error code means the stored identity is wrong or unusable.
* @param code - value from {@link authErrorCode}.
* @returns true when only a corrected credential can help.
*/
function isIdentityCode(code) {
	return code === "BAD_CREDENTIALS";
}
//#endregion
//#region src/policy/config.ts
/** Documented defaults, restated in README.md. */
const DEFAULT_TIMEOUT_MS = 12e4;
const CHOICE_ACTIONS = [
	"retry",
	"switch",
	"fail"
];
const RULE_ACTIONS = [
	...CHOICE_ACTIONS,
	"ask",
	"renew"
];
const FALLBACK_ACTIONS = [...CHOICE_ACTIONS, "ask"];
const RULE_KEYS = [
	"when",
	"action",
	"to",
	"ask",
	"cooldownMs",
	"afterRetries",
	"onFailure"
];
/** Message prefix every rule-validation error carries, so the failing field is unambiguous. */
const PREFIX = "thu-automad: rules";
/**
* Validate one raw `rules` value from cordis.yml.
* @param raw - the `rules` list itself.
* @returns the ordered rules the plugin runs on.
* @throws Error naming the offending field, before any capability registers.
*/
function resolveRules(raw) {
	if (raw === void 0) throw new Error(`${PREFIX} is required; an empty list disables the policy half`);
	if (!Array.isArray(raw)) throw new Error(`${PREFIX} must be a list`);
	return raw.map((entry, index) => rule(entry, `rules[${String(index)}]`));
}
/** Validate one rule entry. */
function rule(value, path) {
	const record = asRecord$1(value, path);
	for (const key of Object.keys(record)) if (!RULE_KEYS.includes(key)) throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
	const when = record.when === void 0 ? {} : asRecord$1(record.when, `${path}.when`);
	for (const key of Object.keys(when)) if (key !== "provider" && key !== "code") throw new Error(`${PREFIX}: ${path}.when: unknown key "${key}"`);
	const action = member(record.action, RULE_ACTIONS, `${path}.action`);
	const provider = names$1(when.provider, `${path}.when.provider`);
	const code = names$1(when.code, `${path}.when.code`);
	const cooldownMs = cooldown(record.cooldownMs, `${path}.cooldownMs`);
	const afterRetries = budget(record.afterRetries, `${path}.afterRetries`);
	if (action === "renew") {
		if (record.onFailure === void 0) throw new Error(`${PREFIX}: ${path}.onFailure is required for action "renew"`);
		const onFailure = member(record.onFailure, FALLBACK_ACTIONS, `${path}.onFailure`);
		if (onFailure === "switch") {
			if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
			return {
				provider,
				code,
				action,
				to: route(record.to, `${path}.to`),
				cooldownMs,
				afterRetries,
				onFailure
			};
		}
		if (onFailure === "ask") {
			if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for a "switch" target`);
			return {
				provider,
				code,
				action,
				ask: askSpec(record.ask, `${path}.ask`),
				cooldownMs,
				afterRetries,
				onFailure
			};
		}
		if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for a "switch" target`);
		if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
		return {
			provider,
			code,
			action,
			cooldownMs,
			afterRetries,
			onFailure
		};
	}
	if (record.onFailure !== void 0) throw new Error(`${PREFIX}: ${path}.onFailure is only valid for action "renew"`);
	if (action === "switch") {
		if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
		return {
			provider,
			code,
			action,
			to: route(record.to, `${path}.to`),
			cooldownMs,
			afterRetries,
			onFailure: void 0
		};
	}
	if (action === "ask") {
		if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`);
		return {
			provider,
			code,
			action,
			ask: askSpec(record.ask, `${path}.ask`),
			cooldownMs,
			afterRetries,
			onFailure: void 0
		};
	}
	if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`);
	if (record.ask !== void 0) throw new Error(`${PREFIX}: ${path}.ask is only valid for action "ask"`);
	return {
		provider,
		code,
		action,
		cooldownMs,
		afterRetries,
		onFailure: void 0
	};
}
/** Read one optional non-negative cooldown; absent means every failure asks. */
function cooldown(value, path) {
	if (value === void 0) return 0;
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${PREFIX}: ${path} must be a non-negative integer`);
	return value;
}
/** Read one optional non-negative delegated-failure budget; absent means none. */
function budget(value, path) {
	if (value === void 0) return 0;
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${PREFIX}: ${path} must be a non-negative integer`);
	return value;
}
/** Validate one `ask` block. */
function askSpec(value, path) {
	const record = asRecord$1(value, path);
	for (const key of Object.keys(record)) if (![
		"question",
		"choices",
		"timeoutMs",
		"unavailable"
	].includes(key)) throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
	const question = record.question;
	if (typeof question !== "string" || question.length === 0) throw new Error(`${PREFIX}: ${path}.question must be a non-empty string`);
	const rawChoices = record.choices;
	if (!Array.isArray(rawChoices) || rawChoices.length === 0) throw new Error(`${PREFIX}: ${path}.choices must be a non-empty list`);
	const choices = rawChoices.map((entry, index) => choice(entry, `${path}.choices[${String(index)}]`));
	if (new Set(choices.map((entry) => entry.label)).size !== choices.length) throw new Error(`${PREFIX}: ${path}.choices labels must be unique; an answer is matched by label`);
	const timeout = record.timeoutMs;
	if (timeout !== void 0 && (typeof timeout !== "number" || !Number.isSafeInteger(timeout) || timeout <= 0)) throw new Error(`${PREFIX}: ${path}.timeoutMs must be a positive integer`);
	return {
		question,
		choices,
		timeoutMs: timeout ?? DEFAULT_TIMEOUT_MS,
		unavailable: choice(record.unavailable, `${path}.unavailable`)
	};
}
/** Validate one answer choice. */
function choice(value, path) {
	const record = asRecord$1(value, path);
	for (const key of Object.keys(record)) if (![
		"label",
		"action",
		"to"
	].includes(key)) throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
	const label = record.label;
	if (typeof label !== "string" || label.length === 0) throw new Error(`${PREFIX}: ${path}.label must be a non-empty string`);
	const action = member(record.action, CHOICE_ACTIONS, `${path}.action`);
	if (action === "switch") return {
		label,
		action,
		to: route(record.to, `${path}.to`)
	};
	if (record.to !== void 0) throw new Error(`${PREFIX}: ${path}.to is only valid for action "switch"`);
	return {
		label,
		action
	};
}
/** Validate one `{ provider, model }` route. */
function route(value, path) {
	const record = asRecord$1(value, path);
	for (const key of Object.keys(record)) if (key !== "provider" && key !== "model") throw new Error(`${PREFIX}: ${path}: unknown key "${key}"`);
	const provider = record.provider;
	const model = record.model;
	if (typeof provider !== "string" || provider.length === 0) throw new Error(`${PREFIX}: ${path}.provider must be a non-empty string`);
	if (typeof model !== "string" || model.length === 0) throw new Error(`${PREFIX}: ${path}.model must be a non-empty string`);
	return {
		provider,
		model
	};
}
/** Read one optional list of match names; an omitted list matches everything. */
function names$1(value, path) {
	if (value === void 0) return [];
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) throw new Error(`${PREFIX}: ${path} must be a list of non-empty strings`);
	return value;
}
/** Read one required member of a closed vocabulary. */
function member(value, allowed, path) {
	if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`${PREFIX}: ${path} must be one of ${allowed.join(", ")}`);
	return value;
}
/** Read one value as a mapping. */
function asRecord$1(value, path) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${PREFIX}: ${path} must be a mapping`);
	return value;
}
//#endregion
//#region src/config.ts
/** Documented defaults, restated in README.md and cordis.patch.yml. */
const DEFAULTS = {
	credentialRef: "TSINGHUA_API_KEY",
	label: "Tsinghua API",
	warnBeforeMs: 1800 * 1e3,
	providers: ["tsinghua"],
	probeIntervalMs: 0,
	probeUrl: "",
	usernameRef: "MADMODEL_USERNAME",
	passwordRef: "MADMODEL_PASSWORD",
	tunnel: false,
	autoRenew: true,
	refreshAheadMs: 3600 * 1e3,
	checkIntervalMs: 60 * 1e3,
	twoFactorTimeoutMs: 300 * 1e3,
	verifyAfterRenew: true,
	verifyModel: "DeepSeek-V4.1-Flash"
};
/** Grammar the credentials seam itself accepts for a reference. */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
/** Floor for a configured probe interval; a token does not rot by the second. */
const MIN_PROBE_INTERVAL_MS = 60 * 1e3;
/** Floor for the renewal evaluation tick; below this the schedule is noise. */
const MIN_CHECK_INTERVAL_MS = 10 * 1e3;
/**
* Validate one raw config value from cordis.yml.
* @param config - raw `config` mapping of the loader row, absent when omitted.
* @returns the options the Host half runs on.
* @throws Error naming the offending field, before any capability registers.
*/
function resolveOptions(config) {
	const record = asRecord(config);
	for (const key of Object.keys(record)) if (key !== "rules" && !(key in DEFAULTS)) throw new Error(`thu-automad: unknown config key "${key}"`);
	const credentialRef = ref(record, "credentialRef", DEFAULTS.credentialRef);
	const label = text(record, "label", DEFAULTS.label);
	if (label.length === 0) throw new Error("thu-automad: label must not be empty");
	const warnBeforeMs = count(record, "warnBeforeMs", DEFAULTS.warnBeforeMs);
	const providers = names(record, "providers", DEFAULTS.providers);
	const intervalMs = count(record, "probeIntervalMs", DEFAULTS.probeIntervalMs);
	const probeUrl = text(record, "probeUrl", DEFAULTS.probeUrl);
	let probe;
	if (intervalMs !== 0) {
		if (intervalMs < MIN_PROBE_INTERVAL_MS) throw new Error(`thu-automad: probeIntervalMs must be 0 (disabled) or at least ${String(MIN_PROBE_INTERVAL_MS)}`);
		if (probeUrl.length === 0) throw new Error("thu-automad: probeUrl is required when probeIntervalMs is set");
		const parsed = new URL(probeUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("thu-automad: probeUrl must be an absolute HTTP(S) URL");
		probe = {
			url: parsed.href,
			intervalMs
		};
	}
	const auth = {
		usernameRef: ref(record, "usernameRef", DEFAULTS.usernameRef),
		passwordRef: ref(record, "passwordRef", DEFAULTS.passwordRef),
		tunnel: boolean(record, "tunnel", DEFAULTS.tunnel)
	};
	const refreshAheadMs = count(record, "refreshAheadMs", DEFAULTS.refreshAheadMs);
	const checkIntervalMs = count(record, "checkIntervalMs", DEFAULTS.checkIntervalMs);
	if (checkIntervalMs < MIN_CHECK_INTERVAL_MS) throw new Error(`thu-automad: checkIntervalMs must be at least ${String(MIN_CHECK_INTERVAL_MS)}`);
	if (refreshAheadMs !== 0 && refreshAheadMs < warnBeforeMs) throw new Error("thu-automad: refreshAheadMs must be 0 (disabled) or at least warnBeforeMs");
	const twoFactorTimeoutMs = count(record, "twoFactorTimeoutMs", DEFAULTS.twoFactorTimeoutMs);
	if (twoFactorTimeoutMs === 0) throw new Error("thu-automad: twoFactorTimeoutMs must be positive");
	const verifyModel = text(record, "verifyModel", DEFAULTS.verifyModel);
	if (verifyModel.length === 0) throw new Error("thu-automad: verifyModel must not be empty");
	const rules = resolveRules(record.rules);
	for (const [index, rule] of rules.entries()) if (rule.action === "renew" && (rule.provider.length === 0 || rule.provider.some((name) => !providers.includes(name)))) throw new Error(`thu-automad: rules[${String(index)}].when.provider must name a watched provider (${providers.join(", ") || "none configured"}) for action "renew"`);
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
		rules
	};
}
/** Read the raw config as a mapping, accepting an omitted or empty one. */
function asRecord(config) {
	if (config === void 0 || config === null) return {};
	if (typeof config !== "object" || Array.isArray(config)) throw new Error("thu-automad: config must be a mapping");
	return config;
}
/** Read one optional string field. */
function text(record, key, fallback) {
	const value = record[key];
	if (value === void 0) return fallback;
	if (typeof value !== "string") throw new Error(`thu-automad: ${key} must be a string`);
	return value;
}
/** Read one optional boolean field. */
function boolean(record, key, fallback) {
	const value = record[key];
	if (value === void 0) return fallback;
	if (typeof value !== "boolean") throw new Error(`thu-automad: ${key} must be a boolean`);
	return value;
}
/** Read one optional non-negative integer field. */
function count(record, key, fallback) {
	const value = record[key];
	if (value === void 0) return fallback;
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`thu-automad: ${key} must be a non-negative integer`);
	return value;
}
/** Read one optional array of non-empty provider route names. */
function names(record, key, fallback) {
	const value = record[key];
	if (value === void 0) return fallback;
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) throw new Error(`thu-automad: ${key} must be an array of non-empty provider route names`);
	return value;
}
/** Read one optional credential reference, validated at the seam's own grammar. */
function ref(record, key, fallback) {
	const value = text(record, key, fallback);
	if (!REF_PATTERN.test(value)) throw new Error(`thu-automad: ${key} "${value}" must be an environment-variable name`);
	return value;
}
//#endregion
//#region src/policy/policy.ts
/** How long a route override stays claimable before it is treated as stale. */
const OVERRIDE_TTL_MS = 300 * 1e3;
/**
* Select the first rule that matches one failure.
* @param rules - configured rules in declaration order.
* @param provider - provider route the failed request targeted.
* @param code - normalized failure code.
* @returns the first matching rule, or undefined when none matches.
*/
function matchRule(rules, provider, code) {
	return rules.find((rule) => (rule.provider.length === 0 || rule.provider.includes(provider)) && (rule.code.length === 0 || rule.code.includes(code)));
}
/**
* Convert one answer choice into the resolution it performs.
* @param choice - the picked (or fallback) choice.
* @returns the resolution to execute.
*/
function resolutionOf(choice) {
	if (choice.action === "switch") return {
		action: "switch",
		to: choice.to
	};
	return { action: choice.action };
}
/**
* Fill one configured question's placeholders.
* @param text - configured question text.
* @param values - substitution values; an unknown key is left verbatim.
* @returns the rendered question.
*/
function substitute(text, values) {
	return text.replace(/\{(\w+)\}/gu, (match, name) => values[name] ?? match);
}
/**
* Route overrides and self-granted attempts, keyed by one turn and step.
*
* A switch is decided while a request is failing and consumed when the loop
* re-runs its request waterfall, so the two halves are joined here rather than
* threaded through the event payloads.
*/
var StepRoutes = class {
	overrides = /* @__PURE__ */ new Map();
	owned = /* @__PURE__ */ new Map();
	cooldowns = /* @__PURE__ */ new Map();
	failures = /* @__PURE__ */ new Map();
	/**
	* Remember that one provider was switched away from, so later failures on it
	* keep the same target instead of asking again.
	* @param provider - the provider that failed.
	* @param to - the route the switch went to.
	* @param until - epoch milliseconds the memory expires at.
	*/
	rememberSwitch(provider, to, until) {
		this.cooldowns.set(provider, {
			to,
			until
		});
	}
	/**
	* Read a live switch memory for one provider.
	* @param provider - the provider that is failing.
	* @param now - current epoch milliseconds.
	* @returns the route to reuse, or undefined when there is no live memory.
	*/
	cooldownFor(provider, now) {
		const entry = this.cooldowns.get(provider);
		if (entry === void 0) return void 0;
		if (now >= entry.until) {
			this.cooldowns.delete(provider);
			return;
		}
		return entry.to;
	}
	/**
	* Record the route the next attempt of one step must use.
	* @param key - turn and step identity.
	* @param to - route to apply on re-entry.
	* @param now - current epoch milliseconds.
	*/
	set(key, to, now) {
		this.prune(now);
		this.overrides.set(key, {
			to,
			at: now
		});
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
		const count = (this.failures.get(key)?.count ?? 0) + 1;
		this.failures.set(key, {
			count,
			at: now
		});
		return count;
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
		for (const [key, entry] of this.overrides) if (now - entry.at > OVERRIDE_TTL_MS) this.overrides.delete(key);
		for (const [key, at] of this.owned) if (now - at > OVERRIDE_TTL_MS) this.owned.delete(key);
		for (const [key, entry] of this.failures) if (now - entry.at > OVERRIDE_TTL_MS) this.failures.delete(key);
	}
};
/**
* Key one turn and step as the two halves of a switch agree on.
* @param turn - turn index.
* @param step - step index.
* @returns the stable key.
*/
function stepKey(turn, step) {
	return `${String(turn)}:${String(step)}`;
}
//#endregion
//#region src/policy/status.ts
/** Accumulate what the policy did, for the status route to report. */
var StatusLedger = class {
	appliedAt = Date.now();
	decisions = {
		retry: 0,
		switch: 0,
		fail: 0,
		ask: 0,
		renew: 0
	};
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
			rules: rules.map((rule) => ({
				provider: rule.provider,
				code: rule.code,
				action: rule.action,
				cooldownMs: rule.cooldownMs,
				afterRetries: rule.afterRetries,
				...rule.onFailure === void 0 ? {} : { onFailure: rule.onFailure }
			})),
			decisions: { ...this.decisions },
			last: this.last
		};
	}
};
//#endregion
//#region src/protocol.ts
/** Exact Fetch route serving the merged status document, as registered below `/api`. */
const STATUS_PATH = "/api/thu-automad/status";
/** Exact Fetch route accepting the student identity the renewal logs in with. */
const SETTINGS_PATH = "/api/thu-automad/auth-settings";
/** Exact Fetch route accepting one two-factor answer. */
const TWO_FACTOR_PATH = "/api/thu-automad/two-factor";
/** Exact Fetch route triggering one renewal attempt. */
const RENEW_PATH = "/api/thu-automad/renew";
/**
* Document-relative form of a route. A relative reference keeps the route
* reachable when a deployment mounts the GUI below a subpath.
* @param path - absolute route path beginning with `/api`.
* @returns the same path without its leading slash.
*/
function routeOf(path) {
	return path.slice(1);
}
routeOf(STATUS_PATH);
const TOKEN_STATES = [
	"missing",
	"unknown",
	"ok",
	"expiring",
	"expired",
	"rejected"
];
const RENEW_PHASES = [
	"off",
	"idle",
	"scheduled",
	"running",
	"ok",
	"stalled",
	"needs-human",
	"error"
];
/**
* Whether a decoded response is a status this browser half understands.
* @param value - decoded JSON response body.
* @returns true when every displayed field is present and well typed.
*/
function isAutomadStatus(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.plugin === "string" && typeof record.appliedAt === "number" && typeof record.uptimeSeconds === "number" && typeof record.observedAt === "number" && isTokenStatus(record.token) && isRenewStatus(record.renew) && isPolicyStatus(record.policy) && isAuthConfigStatus(record.auth) && (record.twoFactor === null || isTwoFactorPrompt(record.twoFactor));
}
/**
* Whether a decoded value is a token status this browser half understands.
* @param value - decoded JSON value.
* @returns true when every displayed field is present and well typed.
*/
function isTokenStatus(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.state === "string" && TOKEN_STATES.includes(record.state) && typeof record.label === "string" && typeof record.credentialRef === "string" && typeof record.credentialConfigured === "boolean" && typeof record.warnBeforeMs === "number" && typeof record.observedAt === "number" && isOptionalText(record.source) && isOptionalText(record.rejectedMessage) && isOptionalNumber(record.issuedAt) && isOptionalNumber(record.expiresAt) && isOptionalNumber(record.changedAt) && isOptionalNumber(record.verifiedAt) && isOptionalNumber(record.rejectedAt);
}
/** Whether a decoded value is a renewal status this browser half understands. */
function isRenewStatus(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.enabled === "boolean" && typeof record.phase === "string" && RENEW_PHASES.includes(record.phase) && typeof record.noProgress === "boolean" && typeof record.unattendedRenewals === "number" && isOptionalNumber(record.lastAttemptAt) && isOptionalNumber(record.nextAttemptAt) && isOptionalNumber(record.twoFactorAt) && isOptionalText(record.lastCode) && isOptionalText(record.lastMessage);
}
/** Whether a decoded value is a policy status this browser half understands. */
function isPolicyStatus(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return Array.isArray(record.rules) && typeof record.counts === "object" && record.counts !== null && (record.last === null || typeof record.last === "object");
}
/** Whether a decoded value is an auth-configuration status this browser half understands. */
function isAuthConfigStatus(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.credentialRef === "string" && typeof record.usernameRef === "string" && typeof record.passwordRef === "string" && typeof record.deviceName === "string" && typeof record.tunnel === "boolean" && typeof record.usernameConfigured === "boolean" && typeof record.passwordConfigured === "boolean" && typeof record.tokenConfigured === "boolean" && Array.isArray(record.shadowedRefs);
}
/** Whether a decoded value is a two-factor challenge this browser half understands. */
function isTwoFactorPrompt(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return (record.stage === "method" || record.stage === "code") && Array.isArray(record.methods) && typeof record.askedAt === "number" && typeof record.expiresAt === "number" && isOptionalText(record.phone) && isOptionalText(record.method);
}
/** Whether a wire field is a number or null. */
function isOptionalNumber(value) {
	return value === null || typeof value === "number" && Number.isFinite(value);
}
/** Whether a wire field is a string or null. */
function isOptionalText(value) {
	return value === null || typeof value === "string";
}
//#endregion
//#region src/auth/verify.ts
/**
* Prove that a token the gateway issued is a token the gateway accepts.
*
* Issuance and acceptance are different facts. The school's endpoint hands out
* a JWT on a successful ticket redemption, but the upstream model API is what
* decides whether that JWT is usable, and it reports a refusal with HTTP 200
* and a business code rather than a 401 — so a rotation that only checked for
* "the POST returned something" would store a token that fails the very next
* model request.
*
* The request is a single-token completion, the cheapest shape that exercises
* the real path without producing content.
* @module dsh-thu-automad/auth/verify
*/
/** Longest response body carried into a diagnostic. */
const BODY_CHARS = 200;
/**
* Ask the upstream whether it accepts a token.
*
* Only a decisive answer is reported: a transport failure is its own verdict,
* never a claim that the credential is bad.
* @param options - token, model, transport choice, and timeout.
* @returns the classification.
*/
async function probeUpstream(options) {
	const { token, model, cookie = "", tunnelMode = false, tunnelPrefix = "", timeoutMs = 6e4 } = options;
	const url = `${tunnelMode && tunnelPrefix !== "" ? `${tunnelPrefix}/v1` : `${SITE}/v1`}/chat/completions`;
	const started = Date.now();
	let response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
				...cookie !== "" && tunnelMode ? { Cookie: cookie } : {}
			},
			body: JSON.stringify({
				model,
				messages: [{
					role: "user",
					content: "ping"
				}],
				stream: false,
				max_tokens: 1
			}),
			redirect: "manual",
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (error) {
		const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
		return {
			ok: false,
			verdict: "network",
			ms: Date.now() - started,
			totalMs: Date.now() - started,
			detail,
			url
		};
	}
	const headerMs = Date.now() - started;
	let text = "";
	try {
		text = await response.text();
	} catch (_unreadableBody) {}
	const totalMs = Date.now() - started;
	let json = null;
	try {
		json = JSON.parse(text);
	} catch (_notJson) {}
	const record = typeof json === "object" && json !== null ? json : null;
	if (response.status >= 300 && response.status < 400) return {
		ok: false,
		verdict: "session",
		status: response.status,
		ms: headerMs,
		totalMs,
		detail: `HTTP ${String(response.status)} redirect; the transport lost its session`,
		url
	};
	if (response.status === 401 || response.status === 403) return {
		ok: false,
		verdict: "rejected",
		status: response.status,
		ms: headerMs,
		totalMs,
		detail: `HTTP ${String(response.status)}: the upstream refused this credential`,
		body: text.slice(0, BODY_CHARS),
		url
	};
	if (response.status >= 200 && response.status < 300 && record !== null && Array.isArray(record.choices)) return {
		ok: true,
		verdict: "ok",
		status: response.status,
		ms: headerMs,
		totalMs,
		usage: record.usage ?? null,
		url
	};
	if (record !== null && record.success === false && !Array.isArray(record.choices)) {
		const code = typeof record.status === "number" ? record.status : null;
		const message = typeof record.message === "string" ? record.message : "";
		return {
			ok: false,
			verdict: "rejected",
			status: response.status,
			ms: headerMs,
			totalMs,
			detail: `business code ${String(code)}: ${message}`,
			code,
			url
		};
	}
	return {
		ok: false,
		verdict: "other",
		status: response.status,
		ms: headerMs,
		totalMs,
		detail: "the response is neither a completion nor a known refusal",
		body: text.slice(0, BODY_CHARS),
		url
	};
}
//#endregion
//#region src/auth/login.ts
/**
* The direct ticket path: password to JWT without the WebVPN layer.
*
* This is the chain `auth-probe/direct-login.js` validated against the live
* school: password-login the DEEPSEEK application's SSO form through the
* vendored library, read the ticket out of the success page, and redeem it at
* the madmodel endpoint. The proxy this was reverse-engineered alongside
* instead roams the info portal through a WebVPN session, but both routes
* converge on the same `auth-login/check?ticket=` endpoint, and the direct one
* needs no tunnel.
*
* The ticket is read from the response body first. Redeeming it needs the
* ticket alone, so following the redirect the page advertises is a fallback
* rather than a step — which also sidesteps the malformed redirect hosts the
* school has been observed to emit.
* @module dsh-thu-automad/auth/login
*/
/** Longest hop chain followed while hunting a ticket. */
const MAX_HOPS = 12;
/** Per-request timeout for the hops this module drives itself. */
const HOP_TIMEOUT_MS = 2e4;
/**
* Run one full password login and redeem the resulting ticket for a token.
* @param request - identity, fingerprint, two-factor answerer, and verify choice.
* @returns the token and where it came from.
* @throws Error carrying the vendored chain's stable `code` when a step fails.
*/
async function login(request) {
	const auth = loadAuth();
	const started = Date.now();
	const jar = new auth.CookieJar();
	const identity = await new auth.MadmodelAuthClient(jar).authenticateIdentity(FORM_URL, CHECK_URL, request.username, request.password, request.fingerprint, request.handler);
	const body = String(identity.body ?? "");
	const redirect = String(identity.redirectUrl ?? "");
	const fromBody = /[?&]ticket=([^"&'<>\s]+)/iu.exec(body);
	const fromRedirect = /[?&]ticket=([^"&#]+)/u.exec(redirect);
	let ticket = fromBody !== null ? decodeURIComponent(fromBody[1]) : fromRedirect !== null ? decodeURIComponent(fromRedirect[1]) : null;
	let source = fromBody !== null ? "body" : "redirect";
	if (ticket === null) {
		ticket = await chaseTicket(redirect.replace(/^(https:\/\/[\w.-]+\.tsinghua\.edu\.cn)(?=[^/])/iu, "$1/"), jar);
		source = "chain";
	}
	if (ticket === null) throw new Error("thu-automad: login succeeded but no ticket could be read from the success page");
	const response = await fetch(TICKET_CONSUMER + encodeURIComponent(ticket), { signal: AbortSignal.timeout(HOP_TIMEOUT_MS) });
	const text = await response.text();
	let decoded = null;
	try {
		decoded = JSON.parse(text);
	} catch (_notJson) {}
	const record = typeof decoded === "object" && decoded !== null ? decoded : null;
	const token = typeof record?.data === "string" ? record.data.trim() : "";
	if (token === "") {
		const message = typeof record?.message === "string" ? record.message : text.slice(0, 200);
		throw new Error(`thu-automad: the ticket was refused at the token endpoint (HTTP ${String(response.status)}): ${message}`);
	}
	const outcome = {
		token,
		expiresAt: auth.jwtExpiresAt(token),
		cookie: jar.headerFor(auth.TUNNEL_COOKIE_SCOPE),
		ticketSource: source,
		durationMs: Date.now() - started
	};
	if (request.verify !== void 0) outcome.probe = await probeUpstream({
		token,
		model: request.verify.model,
		cookie: outcome.cookie,
		tunnelMode: request.verify.tunnel,
		tunnelPrefix: auth.MADMODEL_VPN_PREFIX
	});
	return outcome;
}
/**
* Follow redirects until a ticket appears in one of the URLs.
*
* Every hop is checked against the vendored allowlist before it is requested,
* so a compromised success page cannot send this process to a foreign host.
* @param startUrl - repaired redirect the success page advertised.
* @param jar - cookie jar shared with the login.
* @returns the ticket, or null when no hop produced one.
*/
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
		} catch (_noSetCookie) {}
		const location = response.headers.get("location");
		if (location === null || response.status < 300 || response.status >= 400) return null;
		url = new URL(location, url).href;
	}
	return null;
}
//#endregion
//#region src/auth/session.ts
/**
* Record key this plugin owns.
*
* Written as a literal because this package resolves no harness runtime value;
* `scope/id` with both segments matching the seam's own `[a-z][a-z0-9-]*`
* grammar is exactly what `credentialKey('thu-automad', 'session')` produces.
*/
const SESSION_KEY = "thu-automad/session";
/** Shape of the fingerprint the chain generates: 16 random bytes, hex encoded. */
const FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/u;
/** Facts of a session nothing has recorded yet. */
const EMPTY = {
	fingerprint: null,
	lastRenewAt: null,
	lastExpiresAt: null,
	twoFactorAt: null,
	unattendedRenewals: 0
};
/** Read and write this plugin's session record. */
var SessionStore = class {
	ctx;
	/**
	* @param ctx - plugin context owning the credentials service.
	*/
	constructor(ctx) {
		this.ctx = ctx;
	}
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
			next = {
				...readFacts(current),
				...patch
			};
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
			return Promise.resolve(grant({
				...facts,
				fingerprint: chosen
			}));
		});
		return chosen;
	}
};
/** Wrap facts in the grant record shape the seam stores opaque payloads in. */
function grant(facts) {
	return {
		kind: "grant",
		payload: facts
	};
}
/** Read stored facts out of one record value, validating every field. */
function readFacts(record) {
	if (record === void 0 || record.kind !== "grant") return EMPTY;
	const payload = record.payload;
	if (typeof payload !== "object" || payload === null) return EMPTY;
	const raw = payload;
	return {
		fingerprint: typeof raw.fingerprint === "string" && FINGERPRINT_PATTERN.test(raw.fingerprint) ? raw.fingerprint : null,
		lastRenewAt: milliseconds(raw.lastRenewAt),
		lastExpiresAt: milliseconds(raw.lastExpiresAt),
		twoFactorAt: milliseconds(raw.twoFactorAt),
		unattendedRenewals: typeof raw.unattendedRenewals === "number" && Number.isSafeInteger(raw.unattendedRenewals) && raw.unattendedRenewals >= 0 ? raw.unattendedRenewals : 0
	};
}
/** Read one stored timestamp, rejecting anything a clock could not have produced. */
function milliseconds(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
//#endregion
//#region src/jwt.ts
/**
* Decode a compact JWS payload and read its `iat`/`exp` claims.
* @param token - credential value; it may be any string, including a non-JWT key.
* @returns the lifetime claims, or undefined when the value states none.
*/
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
	return {
		issuedAt,
		expiresAt
	};
}
/** Parse a base64url payload segment, or report that it is not a JSON object. */
function decodeClaims(segment) {
	let parsed;
	try {
		parsed = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
	} catch (_notJson) {
		return;
	}
	return typeof parsed === "object" && parsed !== null ? parsed : void 0;
}
/** Convert one JWT numeric-date claim from seconds to epoch milliseconds. */
function claimToMillis(value) {
	return typeof value === "number" && Number.isFinite(value) ? value * 1e3 : null;
}
//#endregion
//#region src/two-factor.ts
/** Six digits, which is the only code shape the school accepts. */
const CODE_PATTERN = /^\d{6}$/u;
/** Park two-factor questions until a browser answers them. */
var TwoFactorQueue = class {
	timeoutMs;
	now;
	pending = null;
	lastChallengeAt = null;
	/**
	* @param timeoutMs - how long a question stays open before it is abandoned.
	* @param now - clock, injectable so a check can drive time directly.
	*/
	constructor(timeoutMs, now = Date.now) {
		this.timeoutMs = timeoutMs;
		this.now = now;
	}
	/**
	* Build the callback the login chain asks.
	* @returns a handler that parks each question on this queue.
	*/
	handler() {
		return async (request) => {
			if (this.pending !== null) throw new Error("thu-automad: a two-factor challenge is already outstanding");
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
			pending.settle({
				method: answer.method,
				trustDevice: answer.trustDevice
			});
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
//#endregion
//#region src/renew.ts
/** How many times the retry delay may double before it stops growing. */
const MAX_BACKOFF_STEPS = 5;
/** How far an expiry must advance for the school to have minted a new token. */
const PROGRESS_MARGIN_MS = 6e4;
/** Longest failure text carried to the UI. */
const MAX_MESSAGE_CHARS = 300;
/** Run and observe the credential renewal. */
var Renewer = class {
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
	facts = {
		fingerprint: null,
		lastRenewAt: null,
		lastExpiresAt: null,
		twoFactorAt: null,
		unattendedRenewals: 0
	};
	/** Questions the login chain parks here for the Web UI. */
	twoFactor;
	session;
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
	/** Whether the schedule may run at all. */
	get enabled() {
		return this.options.renew.autoRenew && this.options.renew.refreshAheadMs > 0;
	}
	/** Re-read the durable session facts the status document reports. */
	async refreshFacts() {
		this.facts = await this.session.read();
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
		if (this.inFlight !== void 0) return await this.inFlight;
		if (reason !== "manual" && this.lastRenewedAt !== null && Date.now() - this.lastRenewedAt < this.options.renew.checkIntervalMs) return {
			renewed: false,
			code: "JUST_RENEWED",
			message: "a renewal already succeeded moments ago; the retry will use that token"
		};
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
	/** Abandon any parked question and stop scheduling. */
	stop() {
		this.stopped = true;
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
	/** Run one renewal attempt and fold its outcome into the reported state. */
	async attempt(reason, signal) {
		const now = Date.now();
		this.lastAttemptAt = now;
		this.phase = "running";
		this.nextAttemptAt = null;
		this.lastCode = null;
		this.lastMessage = null;
		const username = await this.resolveText(this.options.auth.usernameRef);
		const password = await this.resolveText(this.options.auth.passwordRef);
		if (username === null || password === null) return this.recordFailure("NO_CREDENTIALS", `no student id or password is stored under ${this.options.auth.usernameRef} / ${this.options.auth.passwordRef}`, true);
		let fingerprint;
		try {
			fingerprint = await this.session.ensureFingerprint(() => loadAuth().generateFingerprint());
		} catch (error) {
			return this.recordFailure("FINGERPRINT", describe(error), false);
		}
		const previous = readTokenTimes((await this.ctx.credentials.resolve(this.options.credentialRef))?.value ?? "")?.expiresAt ?? null;
		const challengeMark = this.twoFactor.challengeMark();
		let outcome;
		try {
			outcome = await login({
				username,
				password,
				fingerprint,
				handler: this.twoFactor.handler(),
				...this.options.renew.verifyAfterRenew ? { verify: {
					model: this.options.renew.verifyModel,
					tunnel: this.options.auth.tunnel
				} } : {}
			});
		} catch (error) {
			return this.recordFailure(...classify(error));
		} finally {
			if (signal?.aborted === true) this.twoFactor.cancel();
		}
		const probe = outcome.probe;
		if (probe !== void 0 && !probe.ok && probe.verdict !== "network") return this.recordFailure("TOKEN_REJECTED", probe.detail ?? "the upstream refused the new token", false);
		if (previous !== null && outcome.expiresAt <= previous + PROGRESS_MARGIN_MS) {
			this.noProgress = true;
			this.phase = "stalled";
			this.lastCode = "NO_PROGRESS";
			this.lastMessage = "the school returned the same token: its expiry did not advance, so nothing was renewed";
			this.retryAt = null;
			this.nextAttemptAt = outcome.expiresAt;
			return {
				renewed: false,
				code: "NO_PROGRESS",
				message: this.lastMessage
			};
		}
		try {
			await this.ctx.credentials.set(this.options.credentialRef, outcome.token);
		} catch (error) {
			return this.recordFailure("WRITE_REFUSED", describe(error), true);
		}
		const attended = this.twoFactor.challengeMark() !== challengeMark;
		const unattendedRenewals = attended ? 0 : this.facts.unattendedRenewals + 1;
		this.facts = await this.session.write({
			lastRenewAt: Date.now(),
			lastExpiresAt: outcome.expiresAt,
			...attended ? { twoFactorAt: this.twoFactor.challengeMark() } : {},
			unattendedRenewals
		});
		this.failures = 0;
		this.retryAt = null;
		this.noProgress = false;
		this.phase = "ok";
		this.lastRenewedAt = Date.now();
		this.lastCode = null;
		this.lastMessage = `renewed on ${reason}; the new token expires at ${new Date(outcome.expiresAt).toISOString()}`;
		this.nextAttemptAt = outcome.expiresAt - this.options.renew.refreshAheadMs;
		return {
			renewed: true,
			code: null,
			message: this.lastMessage
		};
	}
	/**
	* Record a failed attempt and schedule the next one.
	* @param code - stable code for the UI.
	* @param message - credential-free description.
	* @param needsHuman - whether only a person can change this outcome.
	* @returns the outcome for the caller.
	*/
	recordFailure(code, message, needsHuman) {
		const text = truncate(message);
		this.failures += 1;
		this.phase = needsHuman ? "needs-human" : "error";
		this.lastCode = code;
		this.lastMessage = text;
		const steps = Math.min(this.failures, MAX_BACKOFF_STEPS);
		this.retryAt = Date.now() + this.options.renew.checkIntervalMs * 2 ** steps;
		this.nextAttemptAt = this.retryAt;
		return {
			renewed: false,
			code,
			message: text
		};
	}
	/** Resolve one credential reference to a trimmed non-empty value. */
	async resolveText(ref) {
		const resolved = await this.ctx.credentials.resolve(ref);
		if (resolved === void 0) return null;
		const value = resolved.value.trim();
		return value === "" ? null : value;
	}
};
/** Classify one thrown login failure into a reported code and whether a human is needed. */
function classify(error) {
	const code = authErrorCode(error);
	const message = describe(error);
	if (isTwoFactorCode(code)) return [
		code ?? "TWO_FACTOR_REQUIRED",
		message,
		true
	];
	if (isIdentityCode(code)) return [
		code,
		message,
		true
	];
	return [
		code ?? "LOGIN_FAILED",
		message,
		false
	];
}
/** Read a short description out of any thrown value. */
function describe(error) {
	return truncate(error instanceof Error ? error.message : String(error));
}
/** Keep a diagnostic within the length the status page renders. */
function truncate(text) {
	return text.length <= MAX_MESSAGE_CHARS ? text : `${text.slice(0, MAX_MESSAGE_CHARS)}…`;
}
//#endregion
//#region src/watch.ts
/** Longest provider refusal text carried to the UI. */
const MAX_REFUSAL_CHARS = 200;
/**
* Track the lifecycle of one credential reference over the plugin's lifetime.
*
* The credential value itself is never retained: only a fingerprint of it,
* which is all this plugin needs to notice a rotation and drop a stale refusal.
*/
var TokenWatch = class {
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
	* @param ctx - plugin context owning the credentials service.
	* @param options - validated plugin options.
	*/
	constructor(ctx, options) {
		this.ctx = ctx;
		this.options = options;
	}
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
		this.refusal = {
			at: Date.now(),
			message: refusalText(error),
			fingerprint: this.fingerprint
		};
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
				headers: {
					accept: "application/json",
					authorization: `Bearer ${resolved.value}`
				},
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
			this.refusal = {
				at: Date.now(),
				message: `${probe.url} answered ${String(status)}`,
				fingerprint: this.fingerprint
			};
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
		if (refusal.fingerprint !== null && this.fingerprint !== null && refusal.fingerprint !== this.fingerprint) return false;
		return refusal.at >= (this.changedAt ?? 0);
	}
};
/**
* Whether a thrown value is a provider authentication refusal.
*
* The harness's `LlmError` carries a machine code and, when the provider
* answered, an HTTP status; both are read structurally so this package needs
* no runtime import of the error class.
* @param error - value a model request failed with.
* @returns true when the provider refused the credential.
*/
function isAuthRefusal(error) {
	if (typeof error !== "object" || error === null) return false;
	const record = error;
	const failure = typeof record.failure === "object" && record.failure !== null ? record.failure : void 0;
	if (record.code === "AUTH" || failure?.code === "AUTH") return true;
	const status = record.status ?? failure?.status;
	return status === 401 || status === 403;
}
/** Read a short, credential-free description of one failure. */
function refusalText(error) {
	const message = error instanceof Error ? error.message : String(error);
	return message.length <= MAX_REFUSAL_CHARS ? message : `${message.slice(0, MAX_REFUSAL_CHARS)}…`;
}
//#endregion
//#region src/index.ts
/** Cordis plugin name; the browser half uses the same string. */
const name = "thu-automad";
/** The credentials seam is required; Connection is read only when it is present. */
const inject = ["credentials"];
/** Stable id the asked question is answered by. */
const QUESTION_ID = "thu-automad";
/** Renewal budget the failure waterfall grants one `renew` action, in milliseconds. */
const BUDGET_MS = 300 * 1e3;
/**
* Apply the credential watch, the renewal schedule, and the failure policy.
* @param ctx - plugin context; the connection and question services are read optionally.
* @param config - raw `config` mapping from cordis.yml; validated here.
*/
function apply(ctx, config) {
	const options = resolveOptions(config);
	const watch = new TokenWatch(ctx, options);
	const renewer = new Renewer(ctx, options);
	const steps = new StepRoutes();
	const ledger = new StatusLedger();
	const providers = new Set(options.providers);
	ctx.effect(() => {
		renewer.tick();
		const timer = setInterval(() => {
			renewer.tick();
		}, options.renew.checkIntervalMs);
		return () => {
			clearInterval(timer);
			renewer.stop();
		};
	}, "thu-automad: renewal schedule");
	if (options.probe !== void 0) {
		const { intervalMs } = options.probe;
		ctx.effect(() => {
			watch.probe();
			const timer = setInterval(() => {
				watch.probe();
			}, intervalMs);
			return () => {
				clearInterval(timer);
			};
		}, "thu-automad: credential probe");
	}
	ctx.inject(["connection"], (routeCtx) => {
		routeCtx.effect(() => registerRoutes(routeCtx, options, watch, renewer, ledger), "thu-automad: routes");
		routeCtx.logger.info(`thu-automad: routes at ${STATUS_PATH}, ${SETTINGS_PATH}, ${TWO_FACTOR_PATH}, ${RENEW_PATH}`);
	});
	ctx.on("llm/stream", (request, next) => {
		const stream = next();
		return providers.has(request.provider) ? watchStream(watch, request.provider, stream) : stream;
	}, { global: true });
	ctx.on("agent/request-error", async (payload, next) => {
		const rule = matchRule(options.rules, payload.provider, payload.failure.code);
		if (rule === void 0) return await next();
		const now = Date.now();
		const key = stepKey(payload.turn, payload.step);
		if (rule.afterRetries > 0 && steps.countFailure(key, now) <= rule.afterRetries) return await next();
		const cooling = rule.cooldownMs > 0 ? steps.cooldownFor(payload.provider, now) : void 0;
		let decision;
		if (cooling !== void 0) decision = {
			resolution: {
				action: "switch",
				to: cooling
			},
			asked: false
		};
		else if (rule.action === "renew") {
			ledger.noteRenewal();
			decision = await renewFirst(ctx, renewer, payload, rule);
		} else decision = await decide(ctx, payload, rule);
		const { resolution } = decision;
		ledger.record(payload.provider, payload.failure.code, resolution, decision.asked, now);
		if (resolution.action === "switch" && rule.cooldownMs > 0) steps.rememberSwitch(payload.provider, resolution.to, now + rule.cooldownMs);
		if (resolution.action === "fail") return void 0;
		if (resolution.action === "retry") {
			const downstream = await next();
			if (downstream !== void 0) return downstream;
			if (!steps.claimOwn(key, "retry", now)) return void 0;
			return { kind: "retry" };
		}
		if (resolution.action !== "switch") return void 0;
		steps.set(key, resolution.to, now);
		const downstream = await next();
		if (downstream !== void 0) return downstream;
		if (!steps.claimOwn(key, routeTag(resolution.to), now)) {
			steps.forget(key);
			return;
		}
		return { kind: "retry" };
	});
	ctx.on("agent/request", async (payload, next) => {
		const seed = await next();
		const to = steps.take(stepKey(payload.turn, payload.step));
		if (to === void 0) return seed;
		if (seed.provider === to.provider && seed.model === to.model) return seed;
		return {
			...seed,
			provider: to.provider,
			model: to.model
		};
	});
	ctx.effect(() => {
		watch.refresh();
		return () => {};
	}, "thu-automad: initial credential read");
	if (options.renew.autoRenew && options.renew.refreshAheadMs > 0) {
		const { checkIntervalMs } = options.renew;
		ctx.effect(() => {
			renewer.tick();
			const timer = setInterval(() => {
				renewer.tick();
			}, checkIntervalMs);
			return () => {
				clearInterval(timer);
				renewer.stop();
			};
		}, "thu-automad: renewal schedule");
	}
	ctx.logger.info(`thu-automad: active with ${String(options.rules.length)} rule(s), watching ${[...providers].join(", ") || "(no provider)"}`);
}
/** Recovery-kind tag for a switch, so each target route earns its own attempt. */
function routeTag(to) {
	return `switch:${to.provider}/${to.model}`;
}
/**
* Register the three exact routes the browser half addresses.
* @param ctx - context providing the Host Connection.
* @param options - validated plugin options.
* @param watch - credential observer the status route reads.
* @param renewer - renewal owner the action routes drive.
* @param ledger - policy ledger the status route reports.
* @returns a disposer removing every registration.
*/
function registerRoutes(ctx, options, watch, renewer, ledger) {
	const connection = ctx.connection;
	const disposers = [
		connection.fetch.register({
			path: STATUS_PATH,
			methods: ["GET"],
			requestBody: "buffered",
			fetch: async () => {
				await watch.refresh();
				await renewer.refreshFacts();
				const policy = ledger.snapshot(options.rules, true);
				const status = {
					plugin: policy.plugin,
					appliedAt: policy.appliedAt,
					uptimeSeconds: policy.uptimeSeconds,
					token: watch.snapshot(),
					renew: renewer.snapshot(),
					policy: {
						rules: policy.rules,
						counts: policy.decisions,
						last: policy.last
					},
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
				const answer = parseTwoFactorAnswer(await readJson(request));
				if (answer === null) return json({
					ok: false,
					error: "the body is not a two-factor answer"
				}, 400);
				const outcome = renewer.twoFactor.answer(answer);
				if (outcome === "none") return json({
					ok: false,
					error: "no two-factor challenge is outstanding"
				}, 409);
				if (outcome === "stale") return json({
					ok: false,
					error: "the challenge is waiting for a different stage"
				}, 409);
				if (outcome === "invalid") return json({
					ok: false,
					error: "that answer is not valid for this stage"
				}, 400);
				return json({ ok: true });
			}
		}),
		connection.fetch.register({
			path: SETTINGS_PATH,
			methods: ["POST"],
			requestBody: "buffered",
			fetch: async (request) => {
				const parsed = parseSettingsRequest(await readJson(request));
				if (parsed === null) return json({
					ok: false,
					error: "the body is not an auth-settings request"
				}, 400);
				const errors = await applySettings(ctx, options, parsed);
				return json({
					ok: errors.length === 0,
					errors,
					auth: await authConfigStatus(ctx, options)
				});
			}
		}),
		connection.fetch.register({
			path: RENEW_PATH,
			methods: ["POST"],
			requestBody: "buffered",
			fetch: async () => {
				renewer.clearBackoff();
				const outcome = await renewer.ensureFresh("manual");
				return json({
					ok: true,
					renewed: outcome.renewed,
					code: outcome.code,
					message: outcome.message
				});
			}
		})
	];
	return () => {
		for (const dispose of disposers) dispose();
	};
}
/**
* Answer a failure with a renewal attempt, then execute whatever that implies.
* @param ctx - plugin context, for the optional question service.
* @param renewer - owner of the login attempt.
* @param payload - the failed request the rule matched.
* @param rule - the matched `renew` rule.
* @returns the resolution to execute and whether a human chose it.
*/
async function renewFirst(ctx, renewer, payload, rule) {
	const signal = AbortSignal.any([payload.signal, AbortSignal.timeout(BUDGET_MS)]);
	if ((await renewer.ensureFresh("refusal", signal)).renewed) return {
		resolution: { action: "retry" },
		asked: false
	};
	return await fallback(ctx, payload, rule);
}
/** Resolve a `renew` rule's `onFailure` into the resolution to execute. */
async function fallback(ctx, payload, rule) {
	switch (rule.onFailure) {
		case "switch": return {
			resolution: {
				action: "switch",
				to: rule.to
			},
			asked: false
		};
		case "ask": return await ask(ctx, payload, rule.ask);
		case "fail": return {
			resolution: { action: "fail" },
			asked: false
		};
		case "retry": return {
			resolution: { action: "retry" },
			asked: false
		};
		default: return {
			resolution: { action: "fail" },
			asked: false
		};
	}
}
/**
* Turn one non-renew rule into the resolution to execute.
* @param ctx - plugin context, for the optional question service.
* @param payload - the failed request the rule matched.
* @param rule - the matched rule.
* @returns the resolution to execute and whether a human chose it.
*/
async function decide(ctx, payload, rule) {
	if (rule.action !== "ask") return {
		resolution: rule.action === "switch" ? {
			action: "switch",
			to: rule.to
		} : { action: rule.action },
		asked: false
	};
	return await ask(ctx, payload, rule.ask);
}
/** Put one configured question to the human and map the answer back to an action. */
async function ask(ctx, payload, spec) {
	const questions = ctx.get("userQuestions");
	if (questions === void 0) return {
		resolution: resolutionOf(spec.unavailable),
		asked: false
	};
	try {
		const selected = (await questions.ask({
			questions: [{
				id: QUESTION_ID,
				question: substitute(spec.question, {
					provider: payload.provider,
					code: payload.failure.code,
					message: payload.failure.message
				}),
				detail: payload.failure.message,
				options: spec.choices.map((choice) => ({ label: choice.label }))
			}],
			agent: payload.agent,
			signal: AbortSignal.any([payload.signal, AbortSignal.timeout(spec.timeoutMs)])
		})).answers.find((item) => item.id === QUESTION_ID)?.selected[0];
		const chosen = spec.choices.find((choice) => choice.label === selected);
		return chosen === void 0 ? {
			resolution: resolutionOf(spec.unavailable),
			asked: false
		} : {
			resolution: resolutionOf(chosen),
			asked: true
		};
	} catch (_unanswerable) {
		return {
			resolution: resolutionOf(spec.unavailable),
			asked: false
		};
	}
}
/** Report which renewal credentials exist and whether the launching environment pins them. */
async function authConfigStatus(ctx, options) {
	const refs = [
		options.credentialRef,
		options.auth.usernameRef,
		options.auth.passwordRef
	];
	const described = await Promise.all(refs.map(async (ref) => {
		const info = await ctx.credentials.describe(ref);
		return {
			ref,
			configured: info.configured,
			writable: info.writable
		};
	}));
	const of = (ref) => described.find((entry) => entry.ref === ref) ?? {
		configured: false,
		writable: true
	};
	return {
		credentialRef: options.credentialRef,
		usernameRef: options.auth.usernameRef,
		passwordRef: options.auth.passwordRef,
		deviceName: DEVICE_NAME,
		tunnel: options.auth.tunnel,
		usernameConfigured: of(options.auth.usernameRef).configured,
		passwordConfigured: of(options.auth.passwordRef).configured,
		tokenConfigured: of(options.credentialRef).configured,
		shadowedRefs: described.filter((entry) => !entry.writable).map((entry) => entry.ref)
	};
}
/** Wrap one provider stream so its outcome updates the watch. */
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
/** Read a request body as JSON, reporting a malformed one as absent. */
async function readJson(request) {
	try {
		return await request.json();
	} catch (_notJson) {
		return;
	}
}
/** Validate one posted settings request. */
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
/**
* Write the identity a renewal logs in with.
*
* An empty or cleared field unsets the reference rather than storing an empty
* string, because the seam treats an empty stored value as absent everywhere
* and would otherwise leave a row that looks configured and is not.
* @param ctx - context providing the credentials service.
* @param options - validated plugin options.
* @param request - the validated request.
* @returns one entry per refused field; empty when every write succeeded.
*/
async function applySettings(ctx, options, request) {
	const refs = {
		username: options.auth.usernameRef,
		password: options.auth.passwordRef
	};
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
				code: message.includes("read-only by the launching environment") ? "shadowed" : "refused",
				message
			});
		}
	}
	return errors;
}
/** Validate one posted two-factor answer. */
function parseTwoFactorAnswer(body) {
	if (typeof body !== "object" || body === null) return null;
	const record = body;
	if (record.stage === "cancel") return { stage: "cancel" };
	if (record.stage === "method") {
		if (typeof record.method !== "string" || record.method.length === 0) return null;
		return {
			stage: "method",
			method: record.method,
			trustDevice: record.trustDevice !== false
		};
	}
	if (record.stage === "code") {
		if (typeof record.code !== "string") return null;
		return {
			stage: "code",
			code: record.code
		};
	}
	return null;
}
/** Serialize one route result as JSON. */
function json(value, status = 200) {
	return Response.json(value, {
		status,
		headers: { "cache-control": "no-store" }
	});
}
//#endregion
export { RENEW_PATH, SETTINGS_PATH, STATUS_PATH, TWO_FACTOR_PATH, apply, inject, isAuthRefusal, isAutomadStatus, isTokenStatus, matchRule, name, readTokenTimes, resolveOptions, resolveRules, routeOf, stepKey };

//# sourceMappingURL=index.js.map