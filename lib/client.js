window.__ModuleLoader__.load({
	id: "dsh-thu-automad",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react_jsx_runtime = require("react/jsx-runtime");
//#region src/client/styles.ts
/**
* Class names and the one stylesheet this plugin injects.
*
* The bundle carries no CSS pipeline, so the stylesheet is a plain string
* mounted as its own `<style>` element for the plugin's lifetime, keyed by a
* data attribute so a hot reload cannot stack duplicates.
*
* It contains layout and this plugin's own surfaces only. Every interactive
* control — button, text input, checkbox, dialog — comes from
* `@deepseek-ai/dsh-client-ui-primitives`, because a feature package cannot
* import another feature's component and the primitives are the one place a
* control is shared. Hand-rolling them here is what made an earlier revision's
* primary button render as a solid block: it named a `--dsw-alias-button-*`
* token that does not exist.
*
* Colors come from the shared `--dsw-*` tokens, which is what keeps every
* surface correct in both themes.
* @module dsh-thu-automad/client/styles
*/
/** Owning plugin id, recorded on the injected `<style>` element. */
const PLUGIN_ID = "dsh-thu-automad";
/** Class names referenced from the components. */
const css = {
	reading: "taReading",
	readingWarn: "taReadingWarn",
	readingError: "taReadingError",
	dot: "taDot",
	dotOk: "taDotOk",
	dotWarn: "taDotWarn",
	dotError: "taDotError",
	dotIdle: "taDotIdle",
	link: "taLink",
	linkIcon: "taLinkIcon",
	hidden: "taHidden",
	notice: "taNotice",
	noticeError: "taNoticeError",
	noticeIcon: "taNoticeIcon",
	noticeBody: "taNoticeBody",
	noticeTitle: "taNoticeTitle",
	noticeText: "taNoticeText",
	noticeClose: "taNoticeClose",
	form: "taForm",
	fieldset: "taFieldset",
	legend: "taLegend",
	option: "taOption",
	note: "taNote",
	error: "taError",
	section: "taSection",
	card: "taCard",
	h2: "taH2",
	h3: "taH3",
	p: "taP",
	row: "taRow",
	rowLabel: "taRowLabel",
	rowValue: "taRowValue",
	badge: "taBadge",
	badgeOk: "taBadgeOk",
	badgeIdle: "taBadgeIdle",
	badgeWarn: "taBadgeWarn",
	badgeError: "taBadgeError",
	field: "taField",
	fieldLabel: "taFieldLabel",
	fieldState: "taFieldState",
	actions: "taActions"
};
const STYLESHEET = `
.taReading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.taReadingWarn { color: var(--dsw-alias-state-warn-label); }
.taReadingError { color: var(--dsw-alias-label-error); }

.taDot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
.taDotOk { background: var(--dsw-alias-state-success-primary); }
.taDotWarn { background: var(--dsw-alias-state-warn-primary); }
.taDotError { background: var(--dsw-alias-state-error-primary); }
.taDotIdle { background: var(--dsw-alias-state-idle-primary); }

.taLink {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  max-width: 100%;
  padding: 1px 8px;
  border-radius: 24px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
  text-decoration: none;
  white-space: nowrap;
}

.taLink:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.taLink:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.taLinkIcon { flex: none; }

.taHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.taNotice {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: min(560px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  font-size: 13px;
  line-height: 18px;
}

.taNoticeIcon { flex: none; margin-top: 1px; color: var(--dsw-alias-state-warn-primary); }
.taNoticeError .taNoticeIcon { color: var(--dsw-alias-state-error-primary); }
.taNoticeBody { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.taNoticeTitle { font-weight: 600; }
.taNoticeText { color: var(--dsw-alias-label-secondary); }

.taNoticeClose {
  flex: none;
  padding: 0 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  cursor: pointer;
}

.taNoticeClose:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }

.taForm { display: flex; flex-direction: column; gap: 12px; margin: 0; }
.taFieldset { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; border: none; }
.taLegend { padding: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }
.taOption { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-primary); }
.taNote { margin: 0; color: var(--dsw-alias-label-tertiary); }
.taError { margin: 0; color: var(--dsw-alias-label-error); }

.taSection { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 24px; }
.taCard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 19px;
}
.taH2 { margin: 0; font-size: 16px; font-weight: 600; }
.taH3 { margin: 0; font-size: 13px; font-weight: 600; }
.taP { margin: 0; color: var(--dsw-alias-label-secondary); }
.taRow { display: flex; gap: 10px; align-items: baseline; }
.taRowLabel { flex: none; min-width: 160px; color: var(--dsw-alias-label-secondary); }
.taRowValue { min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.taBadge {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 20px;
}
.taBadgeOk { color: var(--dsw-alias-state-success-label); }
.taBadgeIdle { color: var(--dsw-alias-label-tertiary); }
.taBadgeWarn { color: var(--dsw-alias-state-warn-label); }
.taBadgeError { color: var(--dsw-alias-label-error); }

.taField { display: flex; flex-direction: column; gap: 4px; }
.taFieldLabel { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.taFieldState { font-weight: 400; color: var(--dsw-alias-label-tertiary); }
.taActions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
`;
/**
* Mount the stylesheet for the owning plugin lifetime.
* @returns a disposer removing the element.
*/
function installStyles() {
	const tag = document.createElement("style");
	tag.dataset.plugin = PLUGIN_ID;
	tag.textContent = STYLESHEET;
	document.head.appendChild(tag);
	return () => {
		tag.remove();
	};
}
//#endregion
//#region src/client/format.ts
/**
* Render a remaining lifetime as compact, monotonic-width text.
*
* The countdown is computed in the browser from the absolute deadline the Host
* sent, so a slow poll never shifts the displayed figure and the Host never
* has to publish a value per second.
* @module dsh-thu-automad/client/format
*/
/** Milliseconds in one minute. */
const MINUTE_MS = 6e4;
/** Milliseconds in one hour. */
const HOUR_MS = 60 * MINUTE_MS;
/**
* Format the distance from `now` to an absolute deadline.
* @param expiresAt - deadline in epoch milliseconds; null states no deadline.
* @param now - current epoch milliseconds.
* @returns compact text such as `2h14m`, `24m`, `45s`, or null without a deadline.
*/
function formatRemaining(expiresAt, now) {
	if (expiresAt === null) return null;
	const remaining = expiresAt - now;
	if (remaining <= 0) return "0s";
	if (remaining >= HOUR_MS) {
		const hours = Math.floor(remaining / HOUR_MS);
		const minutes = Math.floor(remaining % HOUR_MS / MINUTE_MS);
		return minutes === 0 ? `${String(hours)}h` : `${String(hours)}h${String(minutes)}m`;
	}
	if (remaining >= MINUTE_MS) return `${String(Math.floor(remaining / MINUTE_MS))}m`;
	return `${String(Math.floor(remaining / 1e3))}s`;
}
//#endregion
//#region src/client/use-countdown.ts
/**
* Turn an absolute deadline into live text on the reader's own clock.
*
* The Host publishes a deadline, never a countdown, so a slow poll cannot
* shift the displayed figure. Recomputing here keeps that cost per second to
* one string comparison: React bails out of the re-render whenever the
* formatted text is unchanged.
* @module dsh-thu-automad/client/use-countdown
*/
/** Clock tick; the formatted text only changes when its own resolution does. */
const TICK_MS = 1e3;
/**
* Read a formatted remaining lifetime that stays current.
* @param expiresAt - absolute deadline in epoch milliseconds, or null.
* @returns the formatted remaining lifetime, or null without a deadline.
*/
function useCountdown(expiresAt) {
	const [text, setText] = (0, react.useState)(() => formatRemaining(expiresAt, Date.now()));
	(0, react.useEffect)(() => {
		setText(formatRemaining(expiresAt, Date.now()));
		if (expiresAt === null) return;
		const timer = window.setInterval(() => {
			setText(formatRemaining(expiresAt, Date.now()));
		}, TICK_MS);
		return () => {
			window.clearInterval(timer);
		};
	}, [expiresAt]);
	return text;
}
//#endregion
//#region src/client/Notice.tsx
/**
* Frame-wide notice for a credential the user still has to act on.
*
* It rides the shell's additive overlay seat, which floats above every column
* and stays click-through except for this element. A notice appears only once
* the state needs action, is dismissible, and re-arms itself when the state
* changes — so acting on it, or a further decay, brings it back rather than
* leaving a stale acknowledgement in place.
*
* A renewal that is in flight deliberately produces no notice: the plugin is
* already doing the thing, and telling the user to do it would be wrong.
* @module dsh-thu-automad/client/Notice
*/
/**
* Overlay notice telling the user what to do about the watched credential.
* @param props - framework hooks, injected status source, and locale seat.
* @returns the notice, or null while nothing needs action or it is dismissed.
*/
const Notice = (0, react.memo)(function Notice({ useAutomadStatus, t }) {
	const { status } = useAutomadStatus((value) => value);
	const remaining = useCountdown(status?.token.expiresAt ?? null);
	const copy = status === null ? null : noticeCopy(status, remaining, t);
	const key = copy?.key ?? null;
	const [dismissed, setDismissed] = (0, react.useState)(null);
	(0, react.useEffect)(() => {
		setDismissed(null);
	}, [key]);
	if (copy === null || key === null || dismissed === key) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: `${css.notice} ${copy.tone === "error" ? css.noticeError : ""}`.trim(),
		role: "status",
		"data-thu-automad-notice": true,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: css.noticeIcon,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 16 })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.noticeBody,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: css.noticeTitle,
					children: copy.title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: css.noticeText,
					children: copy.body
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: css.noticeClose,
				onClick: () => {
					setDismissed(key);
				},
				children: t("notice.dismiss")
			})
		]
	});
});
/**
* Copy for a state that needs the user to act, or null when none does.
* @param status - latest Host status.
* @param remaining - formatted remaining lifetime, or null.
* @param t - bound locale seat.
* @returns the notice copy, or null.
*/
function noticeCopy(status, remaining, t) {
	const label = status.token.label;
	const credentialRef = status.token.credentialRef;
	switch (status.token.state) {
		case "expired": return {
			tone: "error",
			key: "expired",
			title: t("notice.expired.title", { label }),
			body: t("notice.expired.body", { credentialRef })
		};
		case "rejected": return {
			tone: "error",
			key: `rejected:${status.token.rejectedAt ?? 0}`,
			title: t("notice.rejected.title", { label }),
			body: t("notice.rejected.body", {
				credentialRef,
				reason: status.token.rejectedMessage ?? ""
			})
		};
		case "missing": return {
			tone: "warn",
			key: "missing",
			title: t("notice.missing.title", { label }),
			body: t("notice.missing.body", { credentialRef })
		};
		case "ok":
		case "unknown": return null;
		case "expiring": return expiringCopy(status, label, remaining, t);
	}
}
/** Copy for the states a still-valid token can be in while a renewal runs. */
function expiringCopy(status, label, remaining, t) {
	switch (status.renew.phase) {
		case "running": return null;
		case "needs-human": return {
			tone: "error",
			key: "needs-human",
			title: t("notice.needsHuman.title", { label }),
			body: t("notice.needsHuman.body")
		};
		case "stalled": return {
			tone: "warn",
			key: "stalled",
			title: t("notice.stalled.title", { label }),
			body: t("notice.stalled.body")
		};
		case "error": return {
			tone: "error",
			key: `error:${status.renew.lastAttemptAt ?? 0}`,
			title: t("notice.needsHuman.title", { label }),
			body: t("notice.needsHuman.body")
		};
		case "off":
		case "idle":
		case "scheduled":
		case "ok": return {
			tone: "warn",
			key: `expiring:${status.renew.phase}`,
			title: t("notice.expiring.title", {
				label,
				remaining: remaining ?? ""
			}),
			body: t("notice.expiring.body")
		};
	}
}
//#endregion
//#region src/client/Reading.tsx
/**
* Reading this plugin's status link renders inside itself.
*
* It rides that link's `conversation.composer.statusPillReading` seat, so the
* token deadline stays visible exactly where the user works. The reading
* renders nothing until the first status read settles; the link around it stays
* visible either way.
*
* A renewal that is in flight is what the amber reading means when the token is
* still comfortably valid, so the reading says "renewing" rather than showing a
* bare countdown — otherwise the one moment the plugin is doing something looks
* identical to the moment it is not.
* @module dsh-thu-automad/client/Reading
*/
/**
* Reading reporting the watched credential's remaining lifetime.
* @param props - framework hooks, injected status source, and locale seat.
* @returns the reading, or null before the first status read settles.
*/
const Reading = (0, react.memo)(function Reading({ useAutomadStatus, t }) {
	const { status, unreachable } = useAutomadStatus((value) => value);
	const remaining = useCountdown(status?.token.expiresAt ?? null);
	if (status === null && !unreachable) return null;
	const shown = status === null ? {
		text: t("pill.unavailable"),
		tone: "idle"
	} : presentationOf(status, remaining, t);
	const tone = unreachable ? "idle" : shown.tone;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: `${css.reading} ${toneClass(tone)}`.trim(),
		"data-thu-automad-reading": true,
		title: t("pill.title", { credentialRef: status?.token.credentialRef ?? "" }),
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: `${css.dot} ${dotClass(tone)}`.trim(),
			"aria-hidden": "true"
		}), shown.text]
	});
});
/** Map one status onto the text and weight the reading renders. */
function presentationOf(status, remaining, t) {
	const { token, renew } = status;
	const label = token.label;
	const withRemaining = {
		label,
		remaining: remaining ?? ""
	};
	if (renew.phase === "running" && (token.state === "ok" || token.state === "expiring")) return {
		text: t("pill.renewing", { label }),
		tone: "warn"
	};
	switch (token.state) {
		case "ok": return {
			text: t("pill.remaining", withRemaining),
			tone: "ok"
		};
		case "expiring": return {
			text: t("pill.remaining", withRemaining),
			tone: "warn"
		};
		case "expired": return {
			text: t("pill.expired", { label }),
			tone: "error"
		};
		case "rejected": return {
			text: t("pill.rejected", { label }),
			tone: "error"
		};
		case "missing": return {
			text: t("pill.missing", { label }),
			tone: "idle"
		};
		case "unknown": return {
			text: t("pill.unknown", { label }),
			tone: "idle"
		};
	}
}
/** Text-color class for one tone. */
function toneClass(tone) {
	switch (tone) {
		case "warn": return css.readingWarn;
		case "error": return css.readingError;
		case "ok":
		case "idle": return "";
	}
}
/** Indicator-dot class for one tone. */
function dotClass(tone) {
	switch (tone) {
		case "ok": return css.dotOk;
		case "warn": return css.dotWarn;
		case "error": return css.dotError;
		case "idle": return css.dotIdle;
	}
}
//#endregion
//#region src/client/SettingsSection.tsx
/**
* Settings page for the credentials an unattended renewal signs in with.
*
* This is the auth-probe environment configuration, moved out of the shell:
* the two values `MADMODEL_USERNAME` and `MADMODEL_PASSWORD` used to have to be
* exported before starting dsh or written into a hand-made `.env.local`. Here
* they are ordinary fields that write through the Host's credentials service,
* under the same references the Host reads.
*
* The page never receives a stored secret. It can see whether a reference is
* configured, where its value came from, and whether a write would be refused —
* and it can replace or clear one — but no read path returns a value, which is
* why the inputs always start empty and say so in their placeholder.
*
* Every control is a `ui-primitives` component: a feature package cannot import
* another feature's component, so the primitives are the only place a button or
* an input is shared, and they are what keeps this page's controls identical to
* the settings pages shipped beside it.
* @module dsh-thu-automad/client/SettingsSection
*/
/**
* Settings page for the Tsinghua MadModel credential.
* @param props - framework hooks, injected status source and actions, and locale seat.
* @returns the page, or null before the first status read settles.
*/
const SettingsSection = (0, react.memo)(function SettingsSection({ useAutomadStatus, actions, refresh, t }) {
	const { status } = useAutomadStatus((value) => value);
	const [drafts, setDrafts] = (0, react.useState)({
		username: "",
		password: ""
	});
	const [fieldErrors, setFieldErrors] = (0, react.useState)([]);
	const [busy, setBusy] = (0, react.useState)(null);
	const [saved, setSaved] = (0, react.useState)(null);
	const [unreachable, setUnreachable] = (0, react.useState)(false);
	const [renewing, setRenewing] = (0, react.useState)(false);
	const [renewResult, setRenewResult] = (0, react.useState)(null);
	if (status === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: css.section,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
			className: css.h2,
			children: t("settings.title")
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: css.p,
			children: t("settings.intro")
		})]
	});
	const auth = status.auth;
	const write = async (field, value) => {
		setBusy(field);
		setSaved(null);
		setFieldErrors([]);
		setUnreachable(false);
		try {
			const payload = field === "username" ? { username: value } : { password: value };
			const outcome = await actions.saveIdentity(payload);
			if (outcome === null) setUnreachable(true);
			else {
				setFieldErrors(outcome.errors);
				if (outcome.ok) {
					setDrafts((current) => ({
						...current,
						[field]: ""
					}));
					setSaved(field);
				}
			}
			refresh();
		} finally {
			setBusy(null);
		}
	};
	const renewNow = async () => {
		setRenewing(true);
		setRenewResult(null);
		try {
			setRenewResult(await actions.renewNow());
			refresh();
		} finally {
			setRenewing(false);
		}
	};
	const renewText = renewTextOf(status.renew.phase, status.renew.lastAttemptAt, status.renew.nextAttemptAt, t);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: css.section,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: css.h2,
				children: t("settings.title")
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: css.p,
				children: t("settings.intro")
			})] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.card,
				"aria-labelledby": "thu-automad-status-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: css.h3,
						id: "thu-automad-status-title",
						children: t("settings.status.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.rowLabel,
							children: t("settings.token.label", { ref: auth.credentialRef })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: css.rowValue,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: tokenTone(status.token.state),
								text: tokenText(status.token.state, t)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.note,
								children: status.token.credentialConfigured ? t("settings.token.configured", { source: status.token.source ?? "" }) : t("settings.token.missing")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.rowLabel,
							children: t("settings.renew.label")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: css.rowValue,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: renewTone(status.renew.phase),
								text: renewText
							}), status.renew.unattendedRenewals > 0 && status.renew.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.note,
								children: t("settings.renew.unattended", { count: String(status.renew.unattendedRenewals) })
							}) : null]
						})]
					}),
					status.renew.lastAttemptAt === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.note,
						children: lastResultText(status, t)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.note,
						children: t("settings.device", { name: auth.deviceName })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.note,
						children: t("settings.tunnel", { mode: auth.tunnel ? t("settings.tunnel.webvpn") : t("settings.tunnel.direct") })
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.card,
				"aria-labelledby": "thu-automad-identity-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: css.h3,
						id: "thu-automad-identity-title",
						children: t("settings.identity.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.p,
						children: t("settings.identity.intro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IdentityField, {
						field: "username",
						label: t("settings.username.label"),
						placeholder: t("settings.username.placeholder", { ref: auth.usernameRef }),
						configured: auth.usernameConfigured,
						type: "text",
						value: drafts.username,
						busy: busy === "username",
						saved: saved === "username",
						error: errorFor(fieldErrors, "username"),
						onChange: (value) => {
							setDrafts((current) => ({
								...current,
								username: value
							}));
						},
						onSave: () => {
							write("username", drafts.username);
						},
						onClear: () => {
							write("username", null);
						},
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IdentityField, {
						field: "password",
						label: t("settings.password.label"),
						placeholder: t("settings.password.placeholder", { ref: auth.passwordRef }),
						configured: auth.passwordConfigured,
						type: "password",
						value: drafts.password,
						busy: busy === "password",
						saved: saved === "password",
						error: errorFor(fieldErrors, "password"),
						onChange: (value) => {
							setDrafts((current) => ({
								...current,
								password: value
							}));
						},
						onSave: () => {
							write("password", drafts.password);
						},
						onClear: () => {
							write("password", null);
						},
						t
					}),
					auth.shadowedRefs.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.error,
						children: t("settings.error.shadowed", { field: auth.shadowedRefs.join(", ") })
					}),
					unreachable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.error,
						children: t("settings.error.unreachable")
					}) : null
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.actions,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					onClick: () => {
						renewNow();
					},
					disabled: renewing,
					children: renewing ? t("settings.renew.now.busy") : t("settings.renew.now")
				}), renewResult === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: renewResult.renewed ? css.note : css.error,
					children: renewResultCopy(renewResult, t)
				})]
			})
		]
	});
});
/** One labelled credential input with its own save and clear actions. */
function IdentityField({ field, label, placeholder, configured, type, value, busy, saved, error, onChange, onSave, onClear, t }) {
	const inputId = `thu-automad-${field}`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: css.field,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: css.fieldLabel,
				htmlFor: inputId,
				children: [label, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: css.fieldState,
					children: configured ? t("settings.field.configured") : t("settings.field.unconfigured")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
				id: inputId,
				type,
				autoComplete: type === "password" ? "current-password" : "username",
				placeholder,
				value,
				onChange: (event) => {
					onChange(event.target.value);
				}
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.actions,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						onClick: onSave,
						disabled: busy || value.length === 0,
						children: busy ? t("settings.saving") : t("settings.save")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						onClick: onClear,
						disabled: busy || !configured,
						children: t("settings.clear")
					}),
					saved ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.note,
						children: t("settings.saved")
					}) : null
				]
			}),
			error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: css.error,
				children: error.code === "shadowed" ? t("settings.error.shadowed", { field: label }) : t("settings.error.refused", {
					field: label,
					message: error.message
				})
			})
		]
	});
}
/** Small state pill. */
function Badge({ tone, text }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: `${css.badge} ${badgeClass(tone)}`.trim(),
		children: text
	});
}
/** Badge class for one tone. */
function badgeClass(tone) {
	switch (tone) {
		case "ok": return css.badgeOk;
		case "warn": return css.badgeWarn;
		case "error": return css.badgeError;
		case "idle": return css.badgeIdle;
	}
}
/** Reading of one token state. */
function tokenText(state, t) {
	switch (state) {
		case "ok": return t("settings.token.state.ok");
		case "expiring": return t("settings.token.state.expiring");
		case "expired": return t("settings.token.state.expired");
		case "rejected": return t("settings.token.state.rejected");
		case "missing": return t("settings.token.state.missing");
		case "unknown": return t("settings.token.state.unknown");
	}
}
/** Weight of one token state. */
function tokenTone(state) {
	switch (state) {
		case "ok": return "ok";
		case "expiring": return "warn";
		case "expired":
		case "rejected": return "error";
		case "missing":
		case "unknown": return "idle";
	}
}
/** Reading of one renewal phase. */
function renewTextOf(phase, lastAttemptAt, nextAttemptAt, t) {
	switch (phase) {
		case "off": return t("settings.renew.off");
		case "idle": return t("settings.renew.idle");
		case "scheduled": return t("settings.renew.scheduled", { time: formatTime(nextAttemptAt) });
		case "running": return t("settings.renew.running");
		case "ok": return t("settings.renew.ok", { time: formatTime(lastAttemptAt) });
		case "stalled": return t("settings.renew.stalled");
		case "needs-human": return t("settings.renew.needsHuman");
		case "error": return t("settings.renew.error");
	}
}
/** Weight of one renewal phase. */
function renewTone(phase) {
	switch (phase) {
		case "ok": return "ok";
		case "running":
		case "scheduled": return "warn";
		case "stalled":
		case "error":
		case "needs-human": return "error";
		case "off":
		case "idle": return "idle";
	}
}
/** Format one instant with the reader's own locale and clock. */
function formatTime(at) {
	if (at === null) return "—";
	return new Intl.DateTimeFormat(void 0, {
		hour: "2-digit",
		minute: "2-digit"
	}).format(new Date(at));
}
/**
* One sentence about the last renewal attempt.
*
* The Host reports a stable code, so the sentence is written here rather than
* echoing its diagnostic: a Chinese page that ends in an English error string is
* a page the reader has to translate. The Host's own text is appended only when
* no code covers it, which is the one case where it carries information the
* reader cannot get otherwise.
* @param status - latest Host status.
* @param t - bound locale seat.
* @returns the localized sentence.
*/
function lastResultText(status, t) {
	const { renew } = status;
	if (renew.lastCode === null) return t("settings.renew.lastOk", { time: formatTime(renew.lastAttemptAt) });
	const reason = renewFailureText(renew.lastCode, t);
	if (reason !== null) return t("settings.renew.lastFailure", { reason });
	return renew.lastMessage === null ? t("settings.renew.lastFailure", { reason: renew.lastCode }) : t("settings.renew.detail", { message: renew.lastMessage });
}
/**
* Localized reason for one failure code, or null when no code covers it.
* @param code - stable code the Host reported.
* @param t - bound locale seat.
* @returns the localized reason, or null to fall back to the Host's message.
*/
function renewFailureText(code, t) {
	switch (code) {
		case "NO_CREDENTIALS": return t("settings.renew.result.noCredentials");
		case "NO_PROGRESS": return t("settings.renew.result.noProgress");
		case "WRITE_REFUSED": return t("settings.renew.result.writeRefused");
		case "TOKEN_REJECTED": return t("settings.renew.result.rejected");
		case "JUST_RENEWED": return t("settings.renew.result.renewed");
		default: return code.startsWith("TWO_FACTOR_") || code === "BAD_CREDENTIALS" ? t("settings.renew.result.needsHuman") : null;
	}
}
/** The refusal recorded for one field, if any. */
function errorFor(errors, field) {
	return errors.find((entry) => entry.field === field);
}
/** Localized sentence for one manual renewal outcome. */
function renewResultCopy(outcome, t) {
	if (outcome.renewed) return t("settings.renew.result.renewed");
	switch (outcome.code) {
		case "NO_CREDENTIALS": return t("settings.renew.result.noCredentials");
		case "NO_PROGRESS": return t("settings.renew.result.noProgress");
		case "WRITE_REFUSED": return t("settings.renew.result.writeRefused");
		case "TOKEN_REJECTED": return t("settings.renew.result.rejected");
		default: return outcome.code !== null && outcome.code.startsWith("TWO_FACTOR_") ? t("settings.renew.result.needsHuman") : t("settings.renew.result.failed", { message: outcome.message ?? "" });
	}
}
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
/** Document-relative form of {@link STATUS_PATH}, for anchors and fetches. */
const STATUS_ROUTE = routeOf(STATUS_PATH);
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
//#region src/client/slots.ts
/** Reading seat inside the status link, rendered before the open icon. */
const STATUS_PILL_READING = "conversation.composer.statusPillReading";
//#endregion
//#region src/client/StatusLink.tsx
/**
* Composer dock pill: one link to this plugin's status route.
*
* The whole pill is the anchor — its chrome, the reading contributed into
* {@link STATUS_PILL_READING}, and the open icon — so the click target is
* everything the user sees and one element carries both the reading and the
* destination. The reading stays a separate registration; the anchor owns only
* the navigation: the browser keeps the new tab, its focus behavior, and the
* page's own authentication.
* @module dsh-thu-automad/client/StatusLink
*/
/**
* Composer dock link opening the plugin's status route in a new tab.
* @param props - framework hooks, the reading seat, and the locale seat.
* @returns the dock link.
*/
const StatusLink = (0, react.memo)(function StatusLink({ renderSlot, t }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
		className: css.link,
		href: STATUS_ROUTE,
		target: "_blank",
		rel: "noopener noreferrer",
		title: t("link.title"),
		children: [
			renderSlot(STATUS_PILL_READING, {}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: css.hidden,
				children: t("link.label")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, {
				className: css.linkIcon,
				size: 12
			})
		]
	});
});
//#endregion
//#region src/client/TwoFactorDialog.tsx
/**
* The two-factor dialog a renewal raises when the school does not trust this
* device yet.
*
* This is the one place the plugin asks a human for input, and it exists
* because a background login has nobody to answer the chain's callback. The
* Host parks the question and publishes it; this component renders it and posts
* the answer back. The two stages are separate round trips on purpose: the
* school decides which methods are available only after the password step, and
* the code is requested from the chosen method, so the second stage cannot be
* predicted from the first.
*
* It is a `ui-primitives` `Modal`, so Escape, the mask click, focus return, and
* the top-layer coordination with menus are the shell's shared behavior rather
* than a second implementation. Dismissing it is a cancellation, not a silent
* close: leaving the question unanswered would hold the renewal open until its
* timeout.
* @module dsh-thu-automad/client/TwoFactorDialog
*/
/** Id the footer's submit button addresses, so it submits the body's form. */
const FORM_ID = "thu-automad-two-factor-form";
/** Localized label for one verification method. */
function methodLabel(method, phone, t) {
	switch (method) {
		case "wechat": return t("twoFactor.method.wechat");
		case "mobile": return t("twoFactor.method.mobile", { phone: phone ?? "" });
		case "totp": return t("twoFactor.method.totp");
		default: return method;
	}
}
/**
* Modal asking for one two-factor answer.
* @param props - framework hooks, injected status source and actions, and locale seat.
* @returns the modal, or null while no challenge is outstanding.
*/
const TwoFactorDialog = (0, react.memo)(function TwoFactorDialog({ useAutomadStatus, actions, refresh, t }) {
	const { status } = useAutomadStatus((value) => value);
	const prompt = status?.twoFactor ?? null;
	const remaining = useCountdown(prompt?.expiresAt ?? null);
	const [method, setMethod] = (0, react.useState)("");
	const [trustDevice, setTrustDevice] = (0, react.useState)(true);
	const [code, setCode] = (0, react.useState)("");
	const [busy, setBusy] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)(null);
	const stage = prompt?.stage ?? null;
	const offered = prompt?.methods.join(",") ?? "";
	(0, react.useEffect)(() => {
		setError(null);
		setCode("");
		setMethod(offered === "" ? "" : offered.split(",")[0]);
	}, [stage, offered]);
	if (prompt === null) return null;
	const submit = async (event) => {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			const outcome = prompt.stage === "method" ? await actions.answerTwoFactor({
				stage: "method",
				method,
				trustDevice
			}) : await actions.answerTwoFactor({
				stage: "code",
				code
			});
			if (outcome === null) setError(t("twoFactor.error.unreachable"));
			else if (!outcome.ok) setError(stageError(outcome.error, prompt, t));
			else refresh();
		} finally {
			setBusy(false);
		}
	};
	const cancel = () => {
		if (busy) return;
		(async () => {
			setBusy(true);
			try {
				await actions.answerTwoFactor({ stage: "cancel" });
				refresh();
			} finally {
				setBusy(false);
			}
		})();
	};
	const canSubmit = !busy && (prompt.stage === "method" ? method !== "" : code.length === 6);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
		open: true,
		onClose: cancel,
		title: t("twoFactor.title"),
		closeLabel: t("twoFactor.cancel"),
		description: t("twoFactor.intro"),
		footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			onClick: cancel,
			disabled: busy,
			children: t("twoFactor.cancel")
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
			variant: "primary",
			type: "submit",
			form: FORM_ID,
			disabled: !canSubmit,
			children: prompt.stage === "method" ? t("twoFactor.continue") : t("twoFactor.code.submit")
		})] }),
		children: [
			remaining === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: css.note,
				children: t("twoFactor.expires", { remaining })
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("form", {
				className: css.form,
				id: FORM_ID,
				onSubmit: (event) => {
					submit(event);
				},
				children: prompt.stage === "method" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
					className: css.fieldset,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
						className: css.legend,
						children: t("twoFactor.method.legend")
					}), prompt.methods.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: css.option,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "radio",
							name: "thu-automad-two-factor-method",
							value: candidate,
							checked: method === candidate,
							onChange: () => {
								setMethod(candidate);
							}
						}), methodLabel(candidate, prompt.phone, t)]
					}, candidate))]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
					checked: trustDevice,
					onChange: setTrustDevice,
					label: t("twoFactor.trust")
				})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: css.fieldset,
					htmlFor: "thu-automad-two-factor-code",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.legend,
						children: t("twoFactor.code.legend")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						id: "thu-automad-two-factor-code",
						"data-modal-autofocus": true,
						inputMode: "numeric",
						autoComplete: "one-time-code",
						maxLength: 6,
						placeholder: t("twoFactor.code.placeholder"),
						value: code,
						onChange: (event) => {
							setCode(event.target.value.replace(/\D/gu, ""));
						}
					})]
				})
			}),
			error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: css.error,
				role: "alert",
				children: error
			})
		]
	});
});
/** Turn one refusal from the answer route into copy the user can act on. */
function stageError(error, prompt, t) {
	if (prompt.stage === "code" && error !== void 0 && error.includes("valid")) return t("twoFactor.error.invalidCode");
	return t("twoFactor.error.rejected");
}
//#endregion
//#region src/client/actions.ts
/**
* Write side of the browser half: the three POSTs the settings page and the
* two-factor dialog make, plus the read that refreshes after them.
*
* Every call returns a value rather than throwing, because each has a defined
* failure the caller renders. A network failure is `null`; a refusal keeps the
* Host's stable code so the component picks localized copy instead of echoing a
* diagnostic string.
* @module dsh-thu-automad/client/actions
*/
/**
* Build the action set over the Host routes.
* @returns the callbacks the components use.
*/
function createActions() {
	return {
		saveIdentity: async (request) => await post(SETTINGS_PATH, request),
		answerTwoFactor: async (answer) => await post(TWO_FACTOR_PATH, answer),
		renewNow: async () => await post(RENEW_PATH, {})
	};
}
/** POST one JSON body and decode the reply, reporting an unreachable route as null. */
async function post(path, body) {
	try {
		const response = await fetch(routeOf(path), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json"
			},
			body: JSON.stringify(body),
			cache: "no-store"
		});
		if (!response.ok) {
			const decoded = await response.json().catch(() => null);
			return typeof decoded === "object" && decoded !== null ? decoded : null;
		}
		return await response.json();
	} catch (_routeUnreachable) {
		return null;
	}
}
//#endregion
//#region src/client/locale.ts
/** Namespace both dictionaries register under. */
const NS = "thu-automad";
/** English dictionary; also the key set both dictionaries must cover. */
const en = {
	"pill.remaining": "{label} · {remaining} left",
	"pill.renewing": "{label} · renewing",
	"pill.expired": "{label} · expired",
	"pill.rejected": "{label} · refused",
	"pill.missing": "{label} · not configured",
	"pill.unknown": "{label} · valid",
	"pill.unavailable": "Token status unavailable",
	"pill.title": "Token lifetime for {credentialRef}",
	"notice.expiring.title": "The {label} token expires in {remaining}",
	"notice.expiring.body": "It is renewed automatically an hour before that. If the renewal needs you, a dialog appears; the sign-in identity lives under Settings → Tsinghua MadModel.",
	"notice.expired.title": "The {label} token has expired",
	"notice.expired.body": "Model requests fail until it is replaced. Automatic renewal needs the student id and password under Settings → Tsinghua MadModel.",
	"notice.rejected.title": "The provider refused the {label} token",
	"notice.rejected.body": "The gateway answered an authentication failure ({reason}).",
	"notice.missing.title": "No {label} token is configured",
	"notice.missing.body": "Set {credentialRef} under Settings → Models, or let automatic renewal acquire one.",
	"notice.needsHuman.title": "Renewing the {label} token needs you",
	"notice.needsHuman.body": "Open Settings → Tsinghua MadModel and complete the sign-in.",
	"notice.stalled.title": "The school returned the {label} token unchanged",
	"notice.stalled.body": "Renewal ran but the expiry did not advance, so nothing was replaced. A fresh sign-in is needed once the current token expires.",
	"notice.dismiss": "Dismiss",
	"settings.nav": "Tsinghua MadModel",
	"settings.title": "Tsinghua MadModel credentials",
	"settings.intro": "The campus gateway issues a JWT that lives about six hours. This plugin watches its expiry and signs in again before it lapses, so model requests keep working without pasting a token.",
	"settings.status.title": "Status",
	"settings.token.label": "Access token ({ref})",
	"settings.token.configured": "configured, from {source}",
	"settings.token.missing": "not configured",
	"settings.token.state.ok": "valid",
	"settings.token.state.expiring": "expiring soon",
	"settings.token.state.expired": "expired",
	"settings.token.state.rejected": "refused by the gateway",
	"settings.token.state.missing": "not configured",
	"settings.token.state.unknown": "present, but it states no expiry",
	"settings.renew.label": "Automatic renewal",
	"settings.renew.off": "disabled",
	"settings.renew.idle": "idle",
	"settings.renew.scheduled": "scheduled for {time}",
	"settings.renew.running": "signing in…",
	"settings.renew.ok": "last succeeded at {time}",
	"settings.renew.stalled": "the last attempt returned the same token",
	"settings.renew.needsHuman": "needs you",
	"settings.renew.error": "the last attempt failed",
	"settings.renew.unattended": "{count} unattended renewals since the last verification",
	"settings.renew.lastOk": "Last renewed at {time}.",
	"settings.renew.lastFailure": "The last renewal did not succeed: {reason}",
	"settings.renew.detail": "Reported: {message}",
	"settings.identity.title": "Sign-in identity",
	"settings.identity.intro": "Used only to acquire a new token from the school. The password is stored in the dsh credentials file, which is plain YAML protected by file permissions alone.",
	"settings.username.label": "Student id",
	"settings.username.placeholder": "Stored as {ref}",
	"settings.password.label": "Unified-auth password",
	"settings.password.placeholder": "Stored as {ref}",
	"settings.field.configured": "Configured",
	"settings.field.unconfigured": "Not set",
	"settings.save": "Save",
	"settings.clear": "Clear",
	"settings.saving": "Saving…",
	"settings.saved": "Saved",
	"settings.error.shadowed": "{field} is pinned read-only by the environment dsh was started from. Unset it there and restart dsh, then save here.",
	"settings.error.refused": "{field} could not be stored: {message}",
	"settings.error.unreachable": "The dsh host did not answer, so nothing was stored.",
	"settings.renew.now": "Renew now",
	"settings.renew.now.busy": "Renewing…",
	"settings.renew.result.renewed": "A new token was acquired and stored.",
	"settings.renew.result.failed": "Renewal did not produce a new token: {message}",
	"settings.renew.result.noCredentials": "No student id or password is stored yet, so there was nothing to sign in with.",
	"settings.renew.result.noProgress": "The school returned the same token, so the expiry did not advance.",
	"settings.renew.result.needsHuman": "The school is asking for a second factor, or rejected the password.",
	"settings.renew.result.writeRefused": "The token was acquired but could not be stored; see the message below.",
	"settings.renew.result.rejected": "The gateway refused the freshly issued token.",
	"settings.device": "Device name on the school’s trusted-device list: {name}",
	"settings.tunnel": "Verification transport: {mode}",
	"settings.tunnel.direct": "direct",
	"settings.tunnel.webvpn": "WebVPN tunnel",
	"twoFactor.title": "The school requires a second factor",
	"twoFactor.intro": "This device is not trusted yet — normally only the first sign-in, and again once the trust window lapses. Answer here to continue renewing automatically.",
	"twoFactor.method.legend": "Verification method",
	"twoFactor.method.wechat": "WeChat",
	"twoFactor.method.mobile": "SMS to {phone}",
	"twoFactor.method.totp": "Authenticator code",
	"twoFactor.trust": "Register this device as trusted (about half a year without a second factor)",
	"twoFactor.continue": "Send the code",
	"twoFactor.code.legend": "Six-digit code",
	"twoFactor.code.placeholder": "123456",
	"twoFactor.code.submit": "Submit",
	"twoFactor.back": "Choose another method",
	"twoFactor.cancel": "Cancel the renewal",
	"twoFactor.expires": "Expires in {remaining}",
	"twoFactor.error.invalidCode": "The code must be six digits.",
	"twoFactor.error.rejected": "The school did not accept that answer. Try again.",
	"twoFactor.error.unreachable": "The dsh host did not answer.",
	"link.label": "Tsinghua MadModel status",
	"link.title": "Open the Tsinghua MadModel status route in a new tab"
};
/** Simplified Chinese dictionary. */
const zh = {
	"pill.remaining": "{label} · 剩 {remaining}",
	"pill.renewing": "{label} · 续期中",
	"pill.expired": "{label} · 已过期",
	"pill.rejected": "{label} · 被拒绝",
	"pill.missing": "{label} · 未配置",
	"pill.unknown": "{label} · 有效",
	"pill.unavailable": "Token 状态不可用",
	"pill.title": "{credentialRef} 的有效期",
	"notice.expiring.title": "{label} token 还有 {remaining} 就过期了",
	"notice.expiring.body": "到期前一小时会自动续期。续期需要你的时候会弹窗；登录身份在 设置 → 清华 MadModel 里。",
	"notice.expired.title": "{label} token 已经过期",
	"notice.expired.body": "在换上新的之前，模型请求都会失败。自动续期需要在 设置 → 清华 MadModel 里填学号与密码。",
	"notice.rejected.title": "{label} 拒绝了当前 token",
	"notice.rejected.body": "网关返回了鉴权失败（{reason}）。",
	"notice.missing.title": "还没配置 {label} token",
	"notice.missing.body": "到 设置 → 模型 里填上 {credentialRef}，或者让自动续期去取一个。",
	"notice.needsHuman.title": "{label} token 续期需要你操作",
	"notice.needsHuman.body": "打开 设置 → 清华 MadModel 完成这次登录。",
	"notice.stalled.title": "学校返回的还是同一张 {label} token",
	"notice.stalled.body": "续期跑了，但有效期没有前进，所以没有换上新 token。等当前 token 过期后需要手动登录一次。",
	"notice.dismiss": "知道了",
	"settings.nav": "清华 MadModel",
	"settings.title": "清华 MadModel 凭据",
	"settings.intro": "校园网关发的 JWT 寿命约 6 小时。本插件盯着它的有效期，在到期前自动重新登录换取新 token，不用你手动粘贴。",
	"settings.status.title": "状态",
	"settings.token.label": "访问 token（{ref}）",
	"settings.token.configured": "已配置，来自 {source}",
	"settings.token.missing": "未配置",
	"settings.token.state.ok": "有效",
	"settings.token.state.expiring": "快过期了",
	"settings.token.state.expired": "已过期",
	"settings.token.state.rejected": "被网关拒绝",
	"settings.token.state.missing": "未配置",
	"settings.token.state.unknown": "有值，但读不出有效期",
	"settings.renew.label": "自动续期",
	"settings.renew.off": "已关闭",
	"settings.renew.idle": "待命",
	"settings.renew.scheduled": "已排期：{time}",
	"settings.renew.running": "正在登录…",
	"settings.renew.ok": "上次成功：{time}",
	"settings.renew.stalled": "上次拿到的是同一张 token",
	"settings.renew.needsHuman": "需要你操作",
	"settings.renew.error": "上次续期失败",
	"settings.renew.unattended": "上次验证以来已有 {count} 次无人值守续期",
	"settings.renew.lastOk": "上次续期成功：{time}。",
	"settings.renew.lastFailure": "上次续期没有成功：{reason}",
	"settings.renew.detail": "原始信息：{message}",
	"settings.identity.title": "登录身份",
	"settings.identity.intro": "只用于向学校换取新 token。密码存在 dsh 的凭据文件里，那是明文 YAML，只靠文件权限保护。",
	"settings.username.label": "学号",
	"settings.username.placeholder": "存为 {ref}",
	"settings.password.label": "统一认证密码",
	"settings.password.placeholder": "存为 {ref}",
	"settings.field.configured": "已配置",
	"settings.field.unconfigured": "未配置",
	"settings.save": "保存",
	"settings.clear": "清除",
	"settings.saving": "保存中…",
	"settings.saved": "已保存",
	"settings.error.shadowed": "{field} 被启动 dsh 的环境变量固定为只读。请在启动环境里 unset 它并重启 dsh，再回到这里保存。",
	"settings.error.refused": "{field} 写入失败：{message}",
	"settings.error.unreachable": "dsh 宿主没有响应，什么都没有写入。",
	"settings.renew.now": "立即续期",
	"settings.renew.now.busy": "续期中…",
	"settings.renew.result.renewed": "已取得并写入新的 token。",
	"settings.renew.result.failed": "这次续期没有产生新 token：{message}",
	"settings.renew.result.noCredentials": "还没存学号或密码，没有可以用来登录的凭据。",
	"settings.renew.result.noProgress": "学校返回的是同一张 token，有效期没有前进。",
	"settings.renew.result.needsHuman": "学校要求二次验证，或者密码不对。",
	"settings.renew.result.writeRefused": "token 拿到了，但写不进凭据文件；见下面的信息。",
	"settings.renew.result.rejected": "网关拒绝了刚签发的这张 token。",
	"settings.device": "学校“可信设备”列表里的名字：{name}",
	"settings.tunnel": "验证走哪条路：{mode}",
	"settings.tunnel.direct": "直连",
	"settings.tunnel.webvpn": "WebVPN 隧道",
	"twoFactor.title": "学校要求二次验证",
	"twoFactor.intro": "这台设备还没被信任——通常只出现在第一次登录，以及信任窗口过期之后。在这里回答即可继续自动续期。",
	"twoFactor.method.legend": "验证方式",
	"twoFactor.method.wechat": "微信",
	"twoFactor.method.mobile": "短信（{phone}）",
	"twoFactor.method.totp": "TOTP 口令",
	"twoFactor.trust": "把这台设备登记为可信设备（约半年内免二次验证）",
	"twoFactor.continue": "发送验证码",
	"twoFactor.code.legend": "六位验证码",
	"twoFactor.code.placeholder": "123456",
	"twoFactor.code.submit": "提交",
	"twoFactor.back": "换一种方式",
	"twoFactor.cancel": "取消这次续期",
	"twoFactor.expires": "还有 {remaining} 失效",
	"twoFactor.error.invalidCode": "验证码应为六位数字。",
	"twoFactor.error.rejected": "学校没有接受这个答案，请重试。",
	"twoFactor.error.unreachable": "dsh 宿主没有响应。",
	"link.label": "清华 MadModel 状态",
	"link.title": "在新标签页打开清华 MadModel 状态接口"
};
//#endregion
//#region src/client/status.ts
/** Poll cadence: short enough that a parked two-factor question appears promptly. */
const POLL_INTERVAL_MS = 5e3;
/** Poll the Host status route and publish what it reports. */
var AutomadStatusController = class {
	snapshot = {
		status: null,
		unreachable: false
	};
	listeners = /* @__PURE__ */ new Set();
	timer;
	inFlight = false;
	/** @returns the current snapshot. */
	getSnapshot = () => this.snapshot;
	/**
	* @param listener - called after each published change.
	* @returns a disposer removing the listener.
	*/
	subscribe = (listener) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	/**
	* Begin polling, and read once immediately.
	* @returns a disposer stopping the schedule and the focus listener.
	*/
	start() {
		this.poll();
		this.timer = setInterval(() => {
			this.poll();
		}, POLL_INTERVAL_MS);
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") this.poll();
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			if (this.timer !== void 0) clearInterval(this.timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}
	/**
	* Read the status route once and publish the outcome.
	*
	* Public so an action that just changed something can refresh immediately
	* instead of waiting out the interval.
	* @returns a promise settling once the read published.
	*/
	async poll() {
		if (this.inFlight) return;
		this.inFlight = true;
		try {
			const response = await fetch(routeOf(STATUS_PATH), {
				headers: { accept: "application/json" },
				cache: "no-store"
			});
			if (!response.ok) {
				this.publishUnreachable();
				return;
			}
			const decoded = await response.json();
			if (!isAutomadStatus(decoded)) {
				this.publishUnreachable();
				return;
			}
			this.publish({
				status: decoded,
				unreachable: false
			});
		} catch (_statusRouteUnreachable) {
			this.publishUnreachable();
		} finally {
			this.inFlight = false;
		}
	}
	/** Keep the last known status while marking the route unreachable. */
	publishUnreachable() {
		this.publish({
			status: this.snapshot.status,
			unreachable: true
		});
	}
	/** Replace the snapshot when a displayed fact moved, then notify listeners. */
	publish(next) {
		if (sameSnapshot(this.snapshot, next)) return;
		this.snapshot = next;
		for (const listener of this.listeners) listener();
	}
};
/**
* Whether two snapshots render identically.
*
* Compared as encoded text with the fields that move on every read removed:
* the Host's own clock and its uptime are not things any component draws, and
* including them would republish — and re-render — on every poll.
* @param left - previous snapshot.
* @param right - candidate snapshot.
* @returns true when nothing a component draws changed.
*/
function sameSnapshot(left, right) {
	if (left.unreachable !== right.unreachable) return false;
	if (left.status === null || right.status === null) return left.status === right.status;
	return displayable(left.status) === displayable(right.status);
}
/** Encode one status with its read-stamped fields removed. */
function displayable(status) {
	const { observedAt: _observedAt, uptimeSeconds: _uptimeSeconds, ...rest } = status;
	const { observedAt: _tokenObservedAt, ...token } = rest.token;
	return JSON.stringify({
		...rest,
		token
	});
}
//#endregion
//#region src/client/index.ts
/** Cordis plugin name; the Host half uses the same string. */
const name = "thu-automad";
/** Slot composition and the locale registry, both of which the Web shell owns. */
const inject = ["slots", "locale"];
/**
* Register the dictionaries, the stylesheet, the polling controller, and every
* UI seat.
* @param ctx - browser plugin context.
*/
function apply(ctx) {
	const controller = new AutomadStatusController();
	const actions = createActions();
	const refresh = () => {
		controller.poll();
	};
	const injected = () => ({
		hooks: { automadStatus: controller },
		actions,
		refresh
	});
	ctx.effect(() => ctx.locale.register(NS, {
		en,
		zh
	}), "thu-automad: dictionaries");
	ctx.effect(() => installStyles(), "thu-automad: stylesheet");
	ctx.effect(() => controller.start(), "thu-automad: status polling");
	const t = ctx.locale.bind(NS);
	ctx.slots.inject(STATUS_PILL_READING, () => ctx.slots.register({
		name: STATUS_PILL_READING,
		locale: NS,
		inject: () => ({ hooks: { automadStatus: controller } })
	}, Reading));
	ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
		name: "conversation.composer.dock",
		id: "thu-automad-status",
		order: 11,
		locale: NS,
		children: { [STATUS_PILL_READING]: {
			kind: "single",
			scope: "session"
		} }
	}, StatusLink));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "thu-automad-two-factor",
		order: 9,
		locale: NS,
		inject: injected
	}, TwoFactorDialog));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "thu-automad-notice",
		order: 10,
		locale: NS,
		inject: injected
	}, Notice));
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "thu-automad",
		order: 20,
		label: () => t("settings.nav"),
		locale: NS,
		inject: injected
	}, SettingsSection));
}
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;

		return module.exports;
	}
});

//# sourceMappingURL=client.js.map