window.__ModuleLoader__.load({
	id: "dsh-thu-automad",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);

// src/client/Notice.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// icon.svg
var icon_default = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="\u6E05\u534E MadModel">\n  <defs>\n    <mask id="r1-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">\n      <rect width="24" height="24" fill="#ffffff"/>\n      <g fill="#000000" stroke="#000000" stroke-width="1.3">\n        <path d="M9.6 14.6h4.0v1.6H11.8v6.0h-1.6v-6.0H9.6z"/>\n        <path d="M14.4 14.6h1.6v2.0h0.8v-2.0h1.6v7.6h-1.6v-2.6h-0.8v2.6h-1.6z"/>\n        <path d="M19.2 14.6v5.6a2 2 0 0 0 4 0V14.6h-1.6v5.2a0.4 0.4 0 0 1-0.8 0V14.6z"/>\n      </g>\n    </mask>\n  </defs>\n  <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" transform="translate(1.9 1.9) scale(0.84)" mask="url(#r1-gap)" fill="#ffffff"/>\n  <g fill="#ffffff">\n    <path d="M9.6 14.6h4.0v1.6H11.8v6.0h-1.6v-6.0H9.6z"/>\n    <path d="M14.4 14.6h1.6v2.0h0.8v-2.0h1.6v7.6h-1.6v-2.6h-0.8v2.6h-1.6z"/>\n    <path d="M19.2 14.6v5.6a2 2 0 0 0 4 0V14.6h-1.6v5.2a0.4 0.4 0 0 1-0.8 0V14.6z"/>\n  </g>\n</svg>';

// src/client/styles.ts
var PLUGIN_ID = "dsh-thu-automad";
var css = {
  reading: "taReading",
  mark: "taMark",
  markTile: "taMarkTile",
  pillIcon: "taPillIcon",
  link: "taLink",
  linkWrap: "taLinkWrap",
  statusCard: "taStatusCard",
  cardHead: "taCardHead",
  cardTitle: "taCardTitle",
  cardToken: "taCardToken",
  cardRows: "taCardRows",
  cardRow: "taCardRow",
  cardLabel: "taCardLabel",
  cardValue: "taCardValue",
  hidden: "taHidden",
  notice: "taNotice",
  noticeIcon: "taNoticeIcon",
  noticeBody: "taNoticeBody",
  noticeTitle: "taNoticeTitle",
  noticeText: "taNoticeText",
  noticeClose: "taNoticeClose",
  settings: "taSettings",
  header: "taHeader",
  headerBrand: "taHeaderBrand",
  headerFeatures: "taHeaderFeatures",
  h2: "taH2",
  sectionTitle: "taSectionTitle",
  group: "taGroup",
  row: "taRow",
  rowMain: "taRowMain",
  rowLabel: "taRowLabel",
  rowHint: "taRowHint",
  rowValue: "taRowValue",
  empty: "taEmpty",
  mono: "taMono",
  accountRow: "taAccountRow",
  identityValue: "taIdentityValue",
  identityEditor: "taIdentityEditor",
  identityFields: "taIdentityFields",
  identityFooter: "taIdentityFooter",
  identityHelp: "taIdentityHelp",
  meter: "taMeter",
  meterFill: "taMeterFill",
  meterRow: "taMeterRow",
  rowNote: "taRowNote",
  badge: "taBadge",
  field: "taField",
  fieldHeader: "taFieldHeader",
  fieldLabel: "taFieldLabel",
  fieldState: "taFieldState",
  fieldInput: "taFieldInput",
  fieldClear: "taFieldClear",
  note: "taNote",
  error: "taError",
  factor: "taFactor",
  factorModal: "taFactorModal",
  factorHead: "taFactorHead",
  factorChoices: "taFactorChoices",
  factorOption: "taFactorOption",
  factorCode: "taFactorCode",
  factorActions: "taFactorActions"
};
var STYLESHEET = `
.taSettings, .taLinkWrap, .taReading, .taStatusCard, .taNotice, .taFactorModal {
  --ta-ink: var(--dsw-alias-label-primary, CanvasText);
  --ta-muted: var(--dsw-alias-label-secondary, var(--ta-ink));
  --ta-subtle: var(--dsw-alias-label-tertiary, var(--ta-muted));
  --ta-surface: var(--dsw-alias-bg-layer-1, Canvas);
  --ta-field: var(--dsw-alias-bg-module-platform, var(--ta-surface));
  --ta-panel: color-mix(in srgb, var(--ta-field) 52%, var(--ta-surface));
  --ta-line: color-mix(in srgb, var(--ta-ink) 11%, transparent);
  --ta-hover: var(--dsw-alias-interactive-bg-hover, var(--ta-panel));
  --ta-focus: var(--dsw-alias-brand-primary, var(--ta-ink));
  --ta-ok: var(--dsw-alias-state-success-label, var(--dsw-alias-state-success-primary, #16814a));
  --ta-warn: var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warn-primary, #a5630a));
  --ta-error: var(--dsw-alias-label-error, #b72c39);
  --ta-radius: 16px;
  --ta-panel-radius: 12px;
  --ta-control-radius: 8px;
  --ta-mark-image: url("data:image/svg+xml,${encodeURIComponent(icon_default)}");
}

:is(.taBadge, .taReading, .taMeter, .taNotice)[data-tone="ok"] { --ta-tone: var(--ta-ok); }
:is(.taBadge, .taReading, .taMeter, .taNotice)[data-tone="warn"] { --ta-tone: var(--ta-warn); }
:is(.taBadge, .taReading, .taMeter, .taNotice)[data-tone="error"] { --ta-tone: var(--ta-error); }

.taGroup, .taStatusCard, .taNotice, .taFactorModal {
  box-sizing: border-box;
  border: 1px solid var(--ta-line);
  border-radius: var(--ta-radius);
  background: var(--ta-surface);
  color: var(--ta-ink);
}
.taCardToken, .taIdentityEditor, .taFactor {
  box-sizing: border-box;
  border: 1px solid var(--ta-line);
  border-radius: var(--ta-panel-radius);
  background: var(--ta-panel);
}
:is(.taSettings, .taNotice, .taFactorActions) button { border-radius: var(--ta-control-radius); }

.taReading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.taReading[data-tone="warn"], .taReading[data-tone="error"] {
  color: color-mix(in srgb, var(--ta-tone) 76%, var(--ta-ink));
}

.taMark {
  width: 17px;
  height: 17px;
  flex: none;
  display: block;
  background: currentColor;
  mask: var(--ta-mark-image) center / contain no-repeat;
}
.taPillIcon { width: 13px; height: 13px; }
.taMarkTile {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: var(--ta-control-radius);
  background: var(--ta-field);
  color: var(--ta-ink);
}

.taLinkWrap { position: relative; display: inline-flex; align-items: center; max-width: 100%; }

.taLink {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  max-width: 100%;
  padding: 1px 8px;
  border: 0;
  border-radius: var(--ta-control-radius);
  background: transparent;
  color: var(--ta-subtle);
  font: inherit;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}

.taLink:hover, .taLink[aria-expanded="true"] { background: var(--ta-hover); color: var(--ta-ink); }
.taLink:focus-visible { outline: 2px solid var(--ta-focus); outline-offset: 2px; }

.taStatusCard {
  position: fixed;
  inset: auto;
  margin: 0;
  width: min(324px, calc(100vw - 16px));
  max-height: min(62dvh, 380px);
  overflow: auto;
  padding: 12px;
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgb(0 0 0 / 25%));
  font-size: 12px;
  line-height: 18px;
  z-index: 1200;
}
.taStatusCard:not(:popover-open) { display: none; }
.taCardHead {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.taCardTitle { min-width: 0; font-size: 14px; font-weight: 600; }
.taCardToken { display: grid; gap: 8px; padding: 9px 10px; }
.taCardToken .taCardRow { padding: 0; }
.taCardRows { margin-top: 6px; }
.taCardRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 10px;
  padding: 6px 0;
}
.taCardRows .taCardRow + .taCardRow { border-top: 1px solid var(--ta-line); }
.taCardRows .taCardRow:last-child { padding-bottom: 0; }
.taCardLabel { flex: 1 1 70px; color: var(--ta-muted); }
.taCardValue { display: flex; align-items: center; justify-content: flex-end; gap: 4px 6px; flex-wrap: wrap; margin-inline-start: auto; min-width: 0; max-width: 100%; }

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
  pointer-events: auto;
  top: calc(var(--dsh-frame-top-clearance, 0px) + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: flex-start;
  gap: 8px 10px;
  width: max-content;
  max-width: min(536px, calc(100vw - 24px));
  padding: 10px 12px;
  box-shadow: var(--dsw-elevation-prominent, 0 8px 24px rgb(0 0 0 / 18%));
  font-size: 13px;
  line-height: 18px;
}

.taNoticeIcon {
  flex: none;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: var(--ta-control-radius);
  background: color-mix(in srgb, var(--ta-tone, var(--ta-warn)) 12%, var(--ta-surface));
  color: color-mix(in srgb, var(--ta-tone, var(--ta-warn)) 76%, var(--ta-ink));
}
.taNoticeBody { min-width: 0; flex: 1 1 auto; display: grid; gap: 2px; overflow-wrap: anywhere; }
.taNoticeTitle { font-weight: 600; }
.taNoticeText { color: var(--ta-muted); font-size: 12px; }
.taNoticeClose { flex: none; }

/* \u2500\u2500 settings page \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.taSettings {
  box-sizing: border-box;
  max-width: 680px;
  padding: 8px 0 24px;
  color: var(--ta-ink);
  font-size: 14px;
  line-height: 1.6;
}

.taSettings * { box-sizing: border-box; }
.taHeader { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 20px; }
.taHeaderBrand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.taHeader .taMarkTile { width: 36px; height: 36px; border-radius: 10px; }
.taHeader .taMark { width: 21px; height: 21px; }
.taH2 { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.4; }
.taHeaderFeatures { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; margin: 0; padding: 0; list-style: none; }
.taHeaderFeatures li {
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid var(--ta-line);
  border-radius: var(--ta-control-radius);
  background: var(--ta-panel);
  color: var(--ta-muted);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.taSectionTitle { margin: 22px 0 10px; font-size: 14px; font-weight: 600; color: var(--ta-ink); }

.taGroup {
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}

.taRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ta-line);
}
.taRow:last-child { border-bottom: 0; }
.taRowMain { display: flex; flex-direction: column; min-width: 0; flex: 1 1 108px; overflow-wrap: anywhere; }
.taRowLabel { font-size: 14px; font-weight: 500; color: var(--ta-ink); }
.taRowHint { margin-top: 3px; color: var(--ta-subtle); font-size: 12px; line-height: 1.55; }
.taRowValue {
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px 8px;
  min-width: 0;
  max-width: 100%;
  margin-inline-start: auto;
  font-size: 14px;
  text-align: right;
}

.taBadge {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 7px;
  border-radius: var(--ta-control-radius);
  background: color-mix(in srgb, var(--ta-tone, var(--ta-ink)) 11%, var(--ta-surface));
  color: color-mix(in srgb, var(--ta-tone, var(--ta-muted)) 72%, var(--ta-ink));
  font-size: 12px;
  line-height: 17px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.taMeter { height: 4px; width: 100%; border-radius: 2px; background: color-mix(in srgb, var(--ta-ink) 11%, var(--ta-surface)); overflow: hidden; }
.taMeterFill { height: 100%; border-radius: inherit; background: var(--ta-tone, var(--ta-muted)); transition: width .3s ease; }
.taMeterRow:has(.taMeter) { padding: 0 0 12px; }
.taRowNote { margin-top: 3px; color: var(--ta-muted); font-size: 12px; line-height: 1.55; }

@media (prefers-reduced-motion: reduce) {
  .taMeterFill { transition: none; }
}

.taEmpty { padding: 18px 0; color: var(--ta-subtle); }
.taMono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.taAccountRow { border-bottom: 0; }
.taIdentityValue { margin-top: 2px; color: var(--ta-muted); font-size: 13px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.taNote { margin: 0; color: var(--ta-subtle); font-size: 12px; }
.taError { margin: 4px 0 0; color: var(--ta-error); font-size: 12px; overflow-wrap: anywhere; }

.taIdentityEditor {
  display: grid;
  gap: 12px;
  margin: 0 0 14px;
  padding: 12px 14px;
}
.taIdentityFields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 10px 14px;
}
.taField { display: grid; align-content: start; gap: 4px; min-width: 0; }
.taFieldHeader { display: flex; align-items: center; justify-content: space-between; gap: 4px 8px; flex-wrap: wrap; min-height: 28px; }
.taFieldLabel { font-size: 13px; font-weight: 500; }
.taFieldState { color: var(--ta-subtle); font-size: 12px; font-weight: 400; }
.taFieldClear { color: var(--ta-muted); }
.taFieldInput { box-sizing: border-box; width: 100%; min-width: 0; border-radius: var(--ta-control-radius); }
.taFieldInput input { min-width: 0; }
.taFieldInput input::placeholder { color: var(--ta-subtle); opacity: 1; }
.taIdentityFooter { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.taIdentityHelp { flex: 1 1 160px; min-width: 0; overflow-wrap: anywhere; }
.taIdentityHelp p + p { margin-top: 4px; }
.taIdentityFooter > button { margin-inline-start: auto; }

/* \u2500\u2500 device verification \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.taFactor { display: grid; gap: 12px; padding: 12px; color: var(--ta-ink); }
.taFactorHead { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 10px; }
.taFactorChoices { display: grid; min-width: 0; gap: 6px; padding: 0; margin: 0; border: 0; }
.taFactorOption {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid var(--ta-line);
  border-radius: var(--ta-control-radius);
  background: var(--ta-surface);
  font-size: 13px;
  cursor: pointer;
}
.taFactorOption input { flex: none; margin: 0; accent-color: var(--ta-focus); }
.taFactorOption:has(input:checked) { border-color: color-mix(in srgb, var(--ta-ink) 34%, transparent); }
.taFactorOption:has(input:focus-visible) { outline: 2px solid var(--ta-focus); outline-offset: 2px; }
.taFactorOption:has(input:disabled) { opacity: .65; cursor: default; }
.taFactorCode input { font-variant-numeric: tabular-nums; letter-spacing: .14em; }
.taFactorActions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
`;
function installStyles() {
  const tag = document.createElement("style");
  tag.dataset.plugin = PLUGIN_ID;
  tag.textContent = STYLESHEET;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}

// src/client/use-countdown.ts
var import_react = require("react");

// src/client/format.ts
var MINUTE_MS = 6e4;
var HOUR_MS = 60 * MINUTE_MS;
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
function formatTime(at) {
  return at === null ? "\u2014" : new Intl.DateTimeFormat(void 0, { hour: "2-digit", minute: "2-digit" }).format(at);
}
function formatDateTime(at) {
  return new Intl.DateTimeFormat(void 0, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(at);
}

// src/client/use-countdown.ts
var TICK_MS = 1e3;
function useCountdown(expiresAt) {
  const [text, setText] = (0, import_react.useState)(() => formatRemaining(expiresAt, Date.now()));
  (0, import_react.useEffect)(() => {
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

// src/client/visuals.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function Badge({ text, tone }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.badge, "data-tone": tone, children: text });
}
function BrandMark({ small = false }) {
  if (small) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${css.mark} ${css.pillIcon}`, "aria-hidden": "true" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.markTile, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.mark }) });
}
var TOKEN_TONES = {
  ok: "ok",
  expiring: "warn",
  expired: "error",
  rejected: "error",
  missing: "idle",
  unknown: "idle"
};
function tokenReading(state, t) {
  return { text: t(`settings.token.state.${state}`), tone: TOKEN_TONES[state] };
}
function LifetimeMeter({ token }) {
  const { expiresAt, issuedAt } = token;
  if (expiresAt === null || issuedAt === null || expiresAt <= issuedAt) return null;
  const ratio = (expiresAt - Date.now()) / (expiresAt - issuedAt);
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.meter, "data-tone": TOKEN_TONES[token.state], "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.meterFill, style: { width: `${String(percent)}%` } }) });
}
function networkReading(transport, t) {
  if (transport?.enabled === false) return { text: t("settings.network.disabled"), tone: "idle" };
  switch (transport?.effective) {
    case "direct":
      return { text: t("settings.network.campus"), tone: "ok" };
    case "webvpn":
      return { text: t("settings.network.webvpn"), tone: "ok" };
    default:
      return { text: t("settings.network.unknown"), tone: "idle" };
  }
}
function renewalReading(renew, t) {
  switch (renew.phase) {
    case "scheduled":
      return { text: t("settings.renew.scheduled", { time: formatTime(renew.nextAttemptAt) }), tone: "idle" };
    case "running":
      return { text: t("settings.renew.running"), tone: "warn" };
    case "ok":
      return { text: t("settings.renew.ok", { time: formatTime(renew.lastAttemptAt) }), tone: "ok" };
    case "stalled":
      return { text: t("settings.renew.stalled"), tone: "warn" };
    case "needs-human":
      return { text: t("settings.renew.needsHuman"), tone: "error" };
    case "error":
      return { text: t("settings.renew.error"), tone: "error" };
    case "off":
      return { text: t("settings.renew.off"), tone: "idle" };
    case "idle":
      return { text: t("settings.renew.idle"), tone: "idle" };
  }
}

// src/client/Notice.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var Notice = (0, import_react2.memo)(function Notice2({ useAutomadStatus, t }) {
  const { status } = useAutomadStatus((value) => value);
  const remaining = useCountdown(status?.token.expiresAt ?? null);
  const copy = status === null ? null : noticeCopy(status, remaining, t);
  const key = copy?.key ?? null;
  const [dismissed, setDismissed] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    setDismissed(null);
  }, [key]);
  if (copy === null || key === null || dismissed === key) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      className: css.notice,
      "data-tone": copy.tone,
      role: "status",
      "data-thu-automad-notice": true,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: css.noticeIcon, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BrandMark, { small: true }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.noticeBody, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: css.noticeTitle, children: copy.title }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: css.noticeText, children: copy.body })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", className: css.noticeClose, onClick: () => {
          setDismissed(key);
        }, children: t("notice.dismiss") })
      ]
    }
  );
});
function noticeCopy(status, remaining, t) {
  const label = status.token.label;
  const credentialRef = status.token.credentialRef;
  switch (status.token.state) {
    case "expired":
      return {
        tone: "error",
        key: "expired",
        title: t("notice.expired.title", { label }),
        body: t("notice.expired.body", { credentialRef })
      };
    case "rejected":
      return {
        tone: "error",
        key: `rejected:${status.token.rejectedAt ?? 0}`,
        title: t("notice.rejected.title", { label }),
        body: t("notice.rejected.body", { credentialRef, reason: status.token.rejectedMessage ?? "" })
      };
    case "missing":
      return {
        tone: "warn",
        key: "missing",
        title: t("notice.missing.title", { label }),
        body: t("notice.missing.body", { credentialRef })
      };
    case "ok":
    case "unknown":
      return null;
    case "expiring":
      return expiringCopy(status, label, remaining, t);
  }
}
function expiringCopy(status, label, remaining, t) {
  switch (status.renew.phase) {
    case "running":
      return null;
    case "needs-human":
      return {
        tone: "error",
        key: "needs-human",
        title: t("notice.needsHuman.title", { label }),
        body: t("notice.needsHuman.body")
      };
    case "stalled":
      return {
        tone: "warn",
        key: "stalled",
        title: t("notice.stalled.title", { label }),
        body: t("notice.stalled.body")
      };
    case "error":
      return {
        tone: "error",
        key: `error:${status.renew.lastAttemptAt ?? 0}`,
        title: t("notice.renewFailed.title", { label }),
        body: t("notice.renewFailed.body")
      };
    case "off":
    case "idle":
    case "scheduled":
    case "ok":
      return {
        tone: "warn",
        key: `expiring:${status.renew.phase}`,
        title: t("notice.expiring.title", { label, remaining: remaining ?? "" }),
        body: t("notice.expiring.body")
      };
  }
}

// src/client/Reading.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var Reading = (0, import_react3.memo)(function Reading2({ useAutomadStatus, t }) {
  const { status, unreachable } = useAutomadStatus((value) => value);
  const remaining = useCountdown(status?.token.expiresAt ?? null);
  const cooldownUntil = nearestCooldown(status);
  const cooldown = useCountdown(cooldownUntil);
  if (status === null && !unreachable) return null;
  const shown = status === null ? { text: t("pill.unavailable"), tone: "idle" } : presentationOf(status, remaining, cooldown, t);
  const tone = unreachable ? "idle" : shown.tone;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "span",
    {
      className: css.reading,
      "data-tone": tone,
      "data-thu-automad-reading": true,
      title: t("pill.title", { label: status?.token.label ?? "", credentialRef: status?.token.credentialRef ?? "" }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BrandMark, { small: true }),
        shown.text
      ]
    }
  );
});
function nearestCooldown(status) {
  const pools = status?.transport?.pools ?? [];
  let latest = null;
  for (const pool of pools) {
    if (pool.pausedUntil === null) continue;
    if (pool.pausedUntil <= Date.now()) continue;
    latest = latest === null || pool.pausedUntil > latest ? pool.pausedUntil : latest;
  }
  return latest;
}
function presentationOf(status, remaining, cooldown, t) {
  const { token, renew, transport } = status;
  const label = token.label;
  const pools = transport?.pools ?? [];
  const paused = pools.some((pool) => pool.pausedUntil !== null && pool.pausedUntil > Date.now());
  if (paused) {
    return {
      text: t("pill.cooldown", { label, remaining: cooldown ?? "" }),
      tone: "warn"
    };
  }
  const queued = pools.reduce((sum, pool) => sum + pool.queued, 0);
  if (queued > 0) {
    return { text: t("pill.queued", { label, count: String(queued) }), tone: "warn" };
  }
  const withRemaining = { label, remaining: remaining ?? "" };
  if (renew.phase === "running" && (token.state === "ok" || token.state === "expiring")) {
    return { text: t("pill.renewing", { label }), tone: "warn" };
  }
  switch (token.state) {
    case "ok":
      return { text: t("pill.remaining", withRemaining), tone: "ok" };
    case "expiring":
      return { text: t("pill.remaining", withRemaining), tone: "warn" };
    case "expired":
      return { text: t("pill.expired", { label }), tone: "error" };
    case "rejected":
      return { text: t("pill.rejected", { label }), tone: "error" };
    case "missing":
      return { text: t("pill.missing", { label }), tone: "idle" };
    case "unknown":
      return { text: t("pill.unknown", { label }), tone: "idle" };
  }
}

// src/client/SettingsSection.tsx
var import_react4 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime4 = require("react/jsx-runtime");
var EMPTY_IDENTITY = { username: "", password: "" };
var SettingsSection = (0, import_react4.memo)(function SettingsSection2({
  useAutomadStatus,
  actions,
  refresh,
  t
}) {
  const { status } = useAutomadStatus((value) => value);
  const [drafts, setDrafts] = (0, import_react4.useState)(EMPTY_IDENTITY);
  const [fieldErrors, setFieldErrors] = (0, import_react4.useState)([]);
  const [saving, setSaving] = (0, import_react4.useState)(false);
  const [writeState, setWriteState] = (0, import_react4.useState)(null);
  const [renewing, setRenewing] = (0, import_react4.useState)(false);
  const [renewResult, setRenewResult] = (0, import_react4.useState)(null);
  const [identityEditing, setIdentityEditing] = (0, import_react4.useState)(null);
  const [queueBusy, setQueueBusy] = (0, import_react4.useState)(false);
  const [resetBusy, setResetBusy] = (0, import_react4.useState)(false);
  const remaining = useCountdown(status?.token.expiresAt ?? null);
  if (status === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.settings, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SettingsHeader, { t }) });
  }
  const { auth, renew, transport } = status;
  const pools = transport?.pools ?? [];
  const usernameDisplay = auth.usernameDisplay ?? null;
  const identityConfigured = auth.usernameConfigured && auth.passwordConfigured;
  const identityOpen = identityEditing ?? !identityConfigured;
  const fields = [
    {
      field: "username",
      label: t("settings.username.label"),
      placeholder: t("settings.username.placeholder"),
      configured: auth.usernameConfigured,
      readOnly: auth.shadowedRefs.includes(auth.usernameRef)
    },
    {
      field: "password",
      label: t("settings.password.label"),
      placeholder: t("settings.password.placeholder"),
      configured: auth.passwordConfigured,
      readOnly: auth.shadowedRefs.includes(auth.passwordRef)
    }
  ];
  const changes = {};
  for (const { field, configured, readOnly } of fields) {
    const draft = drafts[field];
    if (!readOnly && (draft === null ? configured : draft.trim() !== "")) changes[field] = draft;
  }
  const hasChanges = changes.username !== void 0 || changes.password !== void 0;
  const changeField = (field, value) => {
    setDrafts((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => current.filter((error) => error.field !== field));
    setWriteState(null);
  };
  const toggleIdentity = () => {
    setIdentityEditing(!identityOpen);
    if (identityOpen) {
      setDrafts(EMPTY_IDENTITY);
      setFieldErrors([]);
      setWriteState(null);
    }
  };
  const saveIdentity = async () => {
    if (saving || !hasChanges) return;
    setIdentityEditing(true);
    setSaving(true);
    setWriteState(null);
    setFieldErrors([]);
    try {
      const outcome = await actions.saveIdentity(changes);
      if (outcome === null || !Array.isArray(outcome.errors)) {
        setWriteState("unreachable");
        return;
      }
      setFieldErrors(outcome.errors);
      setDrafts((current) => {
        const next = { ...current };
        for (const { field } of fields) {
          if (changes[field] !== void 0 && errorFor(outcome.errors, field) === void 0) next[field] = "";
        }
        return next;
      });
      if (outcome.ok) setWriteState("saved");
    } finally {
      setSaving(false);
      refresh();
    }
  };
  const renewNow = async () => {
    setRenewing(true);
    setRenewResult(null);
    try {
      const outcome = await actions.renewNow();
      if (outcome !== null) setRenewResult({ outcome, previousAttempt: renew.lastAttemptAt });
      refresh();
    } finally {
      setRenewing(false);
    }
  };
  let renewalDetail = null;
  if (!renewing && renew.phase !== "running") {
    if (renewResult?.previousAttempt === renew.lastAttemptAt) renewalDetail = renewResultCopy(renewResult.outcome, t);
    else if (renew.lastAttemptAt !== null) renewalDetail = lastResultText(status, t);
  }
  const queueEnabled = transport?.queueEnabled ?? true;
  const controlQueue = async (queue) => {
    setQueueBusy(true);
    try {
      await actions.controlTransport({ queue });
      refresh();
    } finally {
      setQueueBusy(false);
    }
  };
  const resetTransport = async () => {
    setResetBusy(true);
    try {
      await actions.controlTransport({ reset: true });
      refresh();
    } finally {
      setResetBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.settings, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SettingsHeader, { t }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: css.sectionTitle, children: t("settings.section.overview") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.group, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Row,
        {
          label: t("settings.overview.network"),
          value: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { ...networkReading(transport, t) })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Row,
        {
          label: t("settings.overview.token"),
          hint: tokenHint(status, t),
          value: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { ...tokenReading(status.token.state, t) }),
            remaining === null ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.note, children: t("settings.overview.remaining", { remaining }) })
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.meterRow, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LifetimeMeter, { token: status.token }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowMain, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowLabel, children: t("settings.overview.renew") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowHint, children: renewHint(status, t) ?? t("settings.renew.actionHint") }),
          renewalDetail === null ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowNote, role: "status", children: renewalDetail })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowValue, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { ...renewalReading(renew, t) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "primary", onClick: () => {
            void renewNow();
          }, disabled: renewing || renew.phase === "running", children: renewing ? t("settings.renew.now.busy") : t("settings.renew.now") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Row,
        {
          label: t("settings.overview.verify"),
          hint: t("settings.overview.trusted", { name: auth.deviceName }),
          value: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.note, children: renew.twoFactorAt === null ? t("settings.overview.unverified") : t("settings.overview.verified", { time: formatTime(renew.twoFactorAt) }) })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: css.sectionTitle, children: t("settings.section.queue") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.group, children: [
      pools.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.empty, children: t("settings.queue.empty") }) : pools.map((pool) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PoolRow, { pool, t }, pool.model)),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowMain, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowLabel, children: t("settings.queue.control") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowHint, children: t("settings.queue.actionsHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowValue, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            import_dsh_client_ui_primitives2.Button,
            {
              size: "sm",
              variant: "outline",
              onClick: () => {
                void controlQueue(!queueEnabled);
              },
              disabled: queueBusy || transport === void 0 || !transport.enabled,
              children: queueBusy ? t("settings.queue.pauseBusy") : queueEnabled ? t("settings.queue.pause") : t("settings.queue.resume")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", onClick: () => {
            void resetTransport();
          }, disabled: resetBusy || transport === void 0, children: resetBusy ? t("settings.queue.resetBusy") : t("settings.queue.resetAction") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: css.sectionTitle, children: t("settings.section.transport") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.group, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Row,
        {
          label: t("settings.transport.endpoint"),
          value: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.mono, children: transport === void 0 ? "\u2014" : t("settings.transport.value", { port: String(transport.port) }) })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Row,
        {
          label: t("settings.transport.tunnel"),
          value: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.note, children: tunnelText(transport, t) })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `${css.row} ${css.accountRow}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowMain, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowLabel, id: "thu-automad-account", children: t("settings.identity.account") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: usernameDisplay === null ? css.rowHint : css.identityValue, children: usernameDisplay ?? t("settings.identity.accountHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowValue, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            Badge,
            {
              tone: identityConfigured ? "ok" : "idle",
              text: t(identityConfigured ? "settings.field.configured" : "settings.field.unconfigured")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            import_dsh_client_ui_primitives2.Button,
            {
              size: "sm",
              variant: identityOpen ? "ghost" : "outline",
              onClick: toggleIdentity,
              disabled: saving,
              "aria-controls": "thu-automad-identity",
              "aria-expanded": identityOpen,
              children: identityOpen ? t(hasChanges ? "settings.identity.cancel" : "settings.identity.collapse") : t(identityConfigured ? "settings.identity.edit" : "settings.identity.configure")
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { id: "thu-automad-identity", hidden: !identityOpen, children: identityOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "form",
        {
          className: css.identityEditor,
          "aria-labelledby": "thu-automad-account",
          onSubmit: (event) => {
            event.preventDefault();
            void saveIdentity();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.identityFields, children: fields.map((props) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              IdentityField,
              {
                ...props,
                value: drafts[props.field],
                saving,
                error: errorFor(fieldErrors, props.field),
                onChange: (value) => {
                  changeField(props.field, value);
                },
                t
              },
              props.field
            )) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.identityFooter, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.identityHelp, children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: css.note, children: t("settings.identity.intro") }),
                writeState === "saved" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: css.note, role: "status", children: t("settings.saved") }) : null,
                writeState === "unreachable" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: css.error, role: "alert", children: t("settings.error.unreachable") }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "primary", type: "submit", disabled: saving || !hasChanges, children: saving ? t("settings.saving") : t("settings.save") })
            ] })
          ]
        }
      ) : null })
    ] }),
    transport?.lastError === null || transport?.lastError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: css.error, children: t("settings.transport.error", { message: transport.lastError }) }),
    auth.shadowedRefs.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: css.error, children: t("settings.error.shadowed", { field: auth.shadowedRefs.join(", ") }) })
  ] });
});
function SettingsHeader({ t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: css.header, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.headerBrand, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BrandMark, {}),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { className: css.h2, children: t("settings.title") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("ul", { className: css.headerFeatures, role: "list", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { children: t("settings.header.network") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { children: t("settings.header.renewal") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { children: t("settings.header.queue") })
    ] })
  ] });
}
function Row({
  label,
  hint,
  value
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowMain, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowLabel, children: label }),
      hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowHint, children: hint })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.rowValue, children: value })
  ] });
}
function PoolRow({ pool, t }) {
  const cooldown = useCountdown(pool.pausedUntil);
  const paused = pool.pausedUntil !== null && pool.pausedUntil > Date.now();
  const tone = paused || pool.queued > 0 ? "warn" : "ok";
  const ceiling = pool.ceiling ?? pool.limit;
  const shrunk = pool.limit < ceiling ? ` \xB7 ${t("settings.queue.shrunk", { limit: String(pool.limit) })}` : "";
  const statusText = paused && cooldown !== null ? t("settings.queue.cooldown", { remaining: cooldown }) : pool.queued > 0 ? t("settings.queue.waiting") : t("settings.queue.normal");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.rowMain, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `${css.rowLabel} ${css.mono}`.trim(), children: pool.model }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.rowHint, children: t("settings.queue.running", {
        inFlight: String(pool.inFlight),
        limit: String(ceiling),
        queued: String(pool.queued)
      }) + shrunk })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.rowValue, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone, text: statusText }) })
  ] });
}
function IdentityField({
  field,
  label,
  placeholder,
  configured,
  readOnly,
  value,
  saving,
  error,
  onChange,
  t
}) {
  const inputId = `thu-automad-${field}`;
  const removing = value === null;
  const clearAction = t(removing ? "settings.field.undoClear" : "settings.clear");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.fieldHeader, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { className: css.fieldLabel, htmlFor: inputId, children: label }),
      readOnly ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.fieldState, children: t("settings.field.readOnly") }) : configured ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        import_dsh_client_ui_primitives2.Button,
        {
          size: "sm",
          className: css.fieldClear,
          disabled: saving,
          onClick: () => {
            onChange(removing ? "" : null);
          },
          "aria-label": `${clearAction} \xB7 ${label}`,
          children: clearAction
        }
      ) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      import_dsh_client_ui_primitives2.Input,
      {
        className: css.fieldInput,
        id: inputId,
        type: field === "password" ? "password" : "text",
        autoComplete: field === "password" ? "current-password" : "username",
        placeholder: removing ? t("settings.field.clearPending") : placeholder,
        value: value ?? "",
        disabled: saving || readOnly || removing,
        "aria-invalid": error !== void 0,
        "aria-describedby": error === void 0 ? void 0 : `${inputId}-error`,
        onChange: (event) => {
          onChange(event.target.value);
        }
      }
    ),
    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: css.error, id: `${inputId}-error`, role: "alert", children: error.code === "shadowed" ? t("settings.error.shadowed", { field: label }) : t("settings.error.refused", { field: label, message: error.message }) })
  ] });
}
function tunnelText(transport, t) {
  if (transport?.effective === "direct") return t("settings.transport.tunnelNone");
  if (transport?.effective !== "webvpn") return "\u2014";
  return transport.tunnelCookieAt === null ? t("settings.transport.tunnelPending") : t("settings.transport.tunnelAt", { time: formatTime(transport.tunnelCookieAt) });
}
function renewHint(status, t) {
  const { renew } = status;
  if (!renew.enabled) return void 0;
  const parts = [];
  if (renew.phase !== "scheduled" && renew.nextAttemptAt !== null) {
    parts.push(t("settings.overview.next", { time: formatTime(renew.nextAttemptAt) }));
  }
  if (renew.unattendedRenewals > 0) {
    parts.push(t("settings.overview.unattended", { count: String(renew.unattendedRenewals) }));
  }
  return parts.length === 0 ? void 0 : parts.join(" \xB7 ");
}
function tokenHint(status, t) {
  const parts = [];
  if (status.token.source !== null) parts.push(t("settings.overview.source", { source: status.token.source }));
  if (status.token.expiresAt !== null) {
    parts.push(t("settings.overview.expiresAt", { time: formatDateTime(status.token.expiresAt) }));
  }
  return parts.length === 0 ? void 0 : parts.join(" \xB7 ");
}
function lastResultText(status, t) {
  const { renew } = status;
  if (renew.lastCode === null) return t("settings.renew.lastOk", { time: formatTime(renew.lastAttemptAt) });
  const reason = renewFailureText(renew.lastCode, renew.lastMessage, t);
  if (reason !== null) return t("settings.renew.lastFailure", { reason });
  return renew.lastMessage === null ? t("settings.renew.lastFailure", { reason: renew.lastCode }) : t("settings.renew.detail", { message: renew.lastMessage });
}
function renewFailureText(code, diagnostic, t) {
  let reason;
  switch (code) {
    case "NO_CREDENTIALS":
      return t("settings.renew.result.noCredentials");
    case "NO_PROGRESS":
      return t("settings.renew.result.noProgress");
    case "WRITE_REFUSED":
      return t("settings.renew.result.writeRefused");
    case "TOKEN_REJECTED":
      reason = t("settings.renew.result.rejected");
      break;
    case "PROBE_RATE_LIMITED":
      reason = t("settings.renew.result.rateLimited");
      break;
    case "PROBE_SESSION_LOST":
      reason = t("settings.renew.result.sessionLost");
      break;
    case "PROBE_UNREACHABLE":
      reason = t("settings.renew.result.probeUnreachable");
      break;
    case "PROBE_UNAVAILABLE":
      reason = t("settings.renew.result.probeUnavailable");
      break;
    case "PROBE_UNEXPECTED":
      reason = t("settings.renew.result.probeUnexpected");
      break;
    case "JUST_RENEWED":
      return t("settings.renew.result.renewed");
    default:
      return code.startsWith("TWO_FACTOR_") || code === "BAD_CREDENTIALS" ? t("settings.renew.result.needsHuman") : null;
  }
  return diagnostic?.startsWith("HTTP ") === true && diagnostic.includes(" \xB7 ") ? t("settings.renew.result.probeDetail", { reason, detail: diagnostic }) : reason;
}
function errorFor(errors, field) {
  return errors.find((entry) => entry.field === field);
}
function renewResultCopy(outcome, t) {
  if (outcome.renewed) return t("settings.renew.result.renewed");
  return (outcome.code === null ? null : renewFailureText(outcome.code, outcome.message, t)) ?? t("settings.renew.result.failed", { message: outcome.message ?? "" });
}

// src/client/StatusLink.tsx
var import_react5 = require("react");

// src/client/slots.ts
var STATUS_PILL_READING = "conversation.composer.statusPillReading";

// src/client/StatusLink.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var StatusLink = (0, import_react5.memo)(function StatusLink2({
  renderSlot,
  t,
  useAutomadStatus
}) {
  const { status, unreachable } = useAutomadStatus((value) => value);
  const remaining = useCountdown(status?.token.expiresAt ?? null);
  const buttonRef = (0, import_react5.useRef)(null);
  const cardRef = (0, import_react5.useRef)(null);
  const [open, setOpen] = (0, import_react5.useState)(false);
  (0, import_react5.useEffect)(() => {
    const card = cardRef.current;
    const button = buttonRef.current;
    if (card === null || button === null) return;
    const sync = () => {
      setOpen(card.matches(":popover-open"));
    };
    const reposition = () => {
      if (card.matches(":popover-open")) positionCard(card, button);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reposition);
    observer?.observe(card);
    card.addEventListener("toggle", sync);
    window.addEventListener("resize", reposition);
    return () => {
      card.removeEventListener("toggle", sync);
      window.removeEventListener("resize", reposition);
      observer?.disconnect();
    };
  }, []);
  const toggle = () => {
    const card = cardRef.current;
    const button = buttonRef.current;
    if (card === null || button === null) return;
    if (typeof card.showPopover !== "function") return;
    if (card.matches(":popover-open")) {
      card.hidePopover?.();
      return;
    }
    card.showPopover();
    positionCard(card, button);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: css.linkWrap, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        ref: buttonRef,
        type: "button",
        className: css.link,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-controls": "thu-automad-status-card",
        title: t("link.title"),
        onClick: toggle,
        children: [
          renderSlot(STATUS_PILL_READING, {}),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: css.hidden, children: t("link.label") })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        ref: cardRef,
        id: "thu-automad-status-card",
        popover: "auto",
        className: css.statusCard,
        role: "dialog",
        "aria-label": t("settings.title"),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.cardHead, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BrandMark, {}),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: css.cardTitle, children: t("settings.title") })
          ] }),
          status === null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: css.note, children: t(unreachable ? "pill.unavailable" : "link.loading") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.cardToken, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(CardRow, { label: t("settings.overview.token"), children: [
                remaining === null ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: css.note, children: t("settings.overview.remaining", { remaining }) }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Badge, { ...tokenReading(status.token.state, t) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LifetimeMeter, { token: status.token })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.cardRows, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardRow, { label: t("settings.overview.network"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Badge, { ...networkReading(status.transport, t) }) }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardRow, { label: t("settings.overview.renew"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Badge, { ...renewalReading(status.renew, t) }) }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardRow, { label: t("settings.section.queue"), children: queueSummary(status, t) })
            ] })
          ] })
        ]
      }
    )
  ] });
});
function positionCard(card, button) {
  const margin = 8;
  const anchor = button.getBoundingClientRect();
  const { width, height } = card.getBoundingClientRect();
  const above = anchor.top - height - margin;
  const top = above >= margin ? above : anchor.bottom + margin;
  card.style.top = `${String(Math.max(margin, Math.min(top, window.innerHeight - height - margin)))}px`;
  card.style.left = `${String(Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin)))}px`;
}
function CardRow({ label, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.cardRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: css.cardLabel, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.cardValue, children })
  ] });
}
function queueSummary(status, t) {
  const pools = status.transport?.pools ?? [];
  if (pools.length === 0) return "\u2014";
  const running = pools.reduce((sum, pool) => sum + pool.inFlight, 0);
  const queued = pools.reduce((sum, pool) => sum + pool.queued, 0);
  const paused = pools.some((pool) => pool.pausedUntil !== null && pool.pausedUntil > Date.now());
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    Badge,
    {
      tone: queued > 0 || paused ? "warn" : "idle",
      text: t("link.cardQueue", { running: String(running), queued: String(queued) })
    }
  );
}

// src/client/TwoFactorDialog.tsx
var import_react6 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime6 = require("react/jsx-runtime");
var FORM_ID = "thu-automad-two-factor-form";
var METHOD_LABEL_ID = "thu-automad-two-factor-method-label";
var CODE_ID = "thu-automad-two-factor-code";
var ERROR_ID = "thu-automad-two-factor-error";
function methodLabel(method, phone, t) {
  switch (method) {
    case "wechat":
      return t("twoFactor.method.wechat");
    case "mobile":
      return t("twoFactor.method.mobile", { phone: phone ?? "" });
    case "totp":
      return t("twoFactor.method.totp");
    default:
      return method;
  }
}
var TwoFactorDialog = (0, import_react6.memo)(function TwoFactorDialog2({
  useAutomadStatus,
  actions,
  refresh,
  t
}) {
  const { status } = useAutomadStatus((value) => value);
  const prompt = status?.twoFactor ?? null;
  const remaining = useCountdown(prompt?.expiresAt ?? null);
  const [method, setMethod] = (0, import_react6.useState)("");
  const [trustDevice, setTrustDevice] = (0, import_react6.useState)(true);
  const [code, setCode] = (0, import_react6.useState)("");
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)(null);
  const codeInput = (0, import_react6.useRef)(null);
  const stage = prompt?.stage ?? null;
  const offered = prompt?.methods.join(",") ?? "";
  (0, import_react6.useEffect)(() => {
    setError(null);
    setCode("");
    setMethod(offered === "" ? "" : offered.split(",")[0]);
  }, [stage, offered]);
  (0, import_react6.useEffect)(() => {
    if (stage === "code" && !busy) codeInput.current?.focus();
  }, [stage, busy]);
  if (prompt === null) return null;
  const choosingMethod = prompt.stage === "method";
  const canSubmit = !busy && (choosingMethod ? prompt.methods.includes(method) : code.length === 6);
  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = choosingMethod ? await actions.answerTwoFactor({ stage: "method", method, trustDevice }) : await actions.answerTwoFactor({ stage: "code", code });
      if (outcome === null) setError(t("twoFactor.error.unreachable"));
      else if (!outcome.ok) setError(stageError(outcome.error, prompt, t));
      else refresh();
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    if (busy) return;
    void (async () => {
      setBusy(true);
      try {
        await actions.answerTwoFactor({ stage: "cancel" });
        refresh();
      } finally {
        setBusy(false);
      }
    })();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    import_dsh_client_ui_primitives3.Modal,
    {
      open: true,
      className: css.factorModal,
      onClose: cancel,
      title: t("twoFactor.title"),
      closeLabel: t("twoFactor.cancel"),
      description: t("twoFactor.intro"),
      footer: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.factorActions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", onClick: cancel, disabled: busy, children: t("twoFactor.cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "primary", type: "submit", form: FORM_ID, disabled: !canSubmit, children: choosingMethod ? t("twoFactor.continue") : t("twoFactor.code.submit") })
      ] }),
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("form", { className: css.factor, id: FORM_ID, onSubmit: (event) => {
        void submit(event);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.factorHead, children: [
          choosingMethod ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: css.fieldLabel, id: METHOD_LABEL_ID, children: t("twoFactor.method.legend") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: css.fieldLabel, htmlFor: CODE_ID, children: t("twoFactor.code.legend") }),
          remaining === null ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { tone: "warn", text: t("settings.overview.remaining", { remaining }) })
        ] }),
        choosingMethod ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("fieldset", { className: css.factorChoices, "aria-labelledby": METHOD_LABEL_ID, disabled: busy, children: prompt.methods.map((candidate, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: css.factorOption, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "input",
              {
                type: "radio",
                name: "thu-automad-two-factor-method",
                value: candidate,
                "data-modal-autofocus": index === 0 ? true : void 0,
                checked: method === candidate,
                onChange: () => {
                  setMethod(candidate);
                }
              }
            ),
            methodLabel(candidate, prompt.phone, t)
          ] }, candidate)) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            import_dsh_client_ui_primitives3.Checkbox,
            {
              checked: trustDevice,
              disabled: busy,
              onChange: setTrustDevice,
              label: t("twoFactor.trust")
            }
          )
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          import_dsh_client_ui_primitives3.Input,
          {
            className: `${css.fieldInput} ${css.factorCode}`,
            id: CODE_ID,
            ref: codeInput,
            "data-modal-autofocus": true,
            inputMode: "numeric",
            autoComplete: "one-time-code",
            maxLength: 6,
            placeholder: t("twoFactor.code.placeholder"),
            value: code,
            disabled: busy,
            "aria-invalid": error !== null,
            "aria-describedby": error === null ? void 0 : ERROR_ID,
            onChange: (event) => {
              setCode(event.target.value.replace(/\D/gu, ""));
            }
          }
        ),
        error === null ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: css.error, id: ERROR_ID, role: "alert", children: error })
      ] })
    }
  );
});
function stageError(error, prompt, t) {
  if (prompt.stage === "code" && error !== void 0 && error.includes("valid")) return t("twoFactor.error.invalidCode");
  return t("twoFactor.error.rejected");
}

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
    return typeof pool.model === "string" && typeof pool.limit === "number" && Number.isFinite(pool.limit) && (pool.ceiling === void 0 || typeof pool.ceiling === "number" && Number.isFinite(pool.ceiling)) && typeof pool.inFlight === "number" && Number.isFinite(pool.inFlight) && typeof pool.queued === "number" && Number.isFinite(pool.queued) && isOptionalNumber(pool.pausedUntil);
  });
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

// src/client/actions.ts
function createActions() {
  return {
    saveIdentity: async (request) => await post(SETTINGS_PATH, request),
    answerTwoFactor: async (answer) => await post(TWO_FACTOR_PATH, answer),
    renewNow: async () => await post(RENEW_PATH, {}),
    probeTransport: async () => await post(PROBE_PATH, {}),
    controlTransport: async (request) => await post(TRANSPORT_CONTROL_PATH, request)
  };
}
async function post(path, body) {
  try {
    const response = await fetch(routeOf(path), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
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

// src/client/locale.ts
var NS = "thu-automad";
var en = {
  "pill.remaining": "{remaining} left",
  "pill.renewing": "renewing",
  "pill.expired": "expired",
  "pill.rejected": "refused",
  "pill.missing": "not configured",
  "pill.unknown": "expiry unknown",
  "pill.unavailable": "status unavailable",
  "pill.title": "{label} token lifetime ({credentialRef})",
  "pill.queued": "{count} queued",
  "pill.cooldown": "429 cooldown",
  "notice.expiring.title": "The {label} token expires in {remaining}",
  "notice.expiring.body": "Check the renewal schedule under Settings \u2192 Tsinghua MadModel. A device verification prompt appears if needed.",
  "notice.expired.title": "The {label} token has expired",
  "notice.expired.body": "Model requests fail until it is replaced. Automatic renewal needs the student id and password under Settings \u2192 Tsinghua MadModel.",
  "notice.rejected.title": "The provider refused the {label} token",
  "notice.rejected.body": "The gateway answered an authentication failure ({reason}).",
  "notice.missing.title": "No {label} token is configured",
  "notice.missing.body": "Set {credentialRef} under Settings \u2192 Models, or let automatic renewal acquire one.",
  "notice.needsHuman.title": "Renewing the {label} token needs you",
  "notice.needsHuman.body": "Open Settings \u2192 Tsinghua MadModel and complete the sign-in.",
  "notice.renewFailed.title": "The {label} token renewal failed",
  "notice.renewFailed.body": "Open Settings \u2192 Tsinghua MadModel to see the renewal result.",
  "notice.stalled.title": "The school returned the {label} token unchanged",
  "notice.stalled.body": "The current token kept its original expiry. See the renewal result in Tsinghua MadModel settings.",
  "notice.dismiss": "Dismiss",
  "settings.nav": "Tsinghua MadModel",
  "settings.title": "Tsinghua MadModel",
  "settings.header.network": "Campus direct \xB7 WebVPN off campus",
  "settings.header.renewal": "Auto renewal",
  "settings.header.queue": "Local queue",
  "settings.section.overview": "Overview",
  "settings.section.queue": "Models and concurrency",
  "settings.section.transport": "Connection",
  "settings.identity.edit": "Edit",
  "settings.identity.configure": "Set up",
  "settings.identity.collapse": "Close",
  "settings.identity.cancel": "Cancel",
  "settings.overview.network": "Network path",
  "settings.overview.token": "Access token",
  "settings.overview.renew": "Renewal",
  "settings.renew.actionHint": "Renew the token now.",
  "settings.overview.verify": "Device verification",
  "settings.overview.remaining": "{remaining} left",
  "settings.overview.source": "from {source}",
  "settings.overview.expiresAt": "valid until {time}",
  "settings.overview.next": "next {time}",
  "settings.overview.last": "last {time}",
  "settings.overview.unattended": "{count} unattended renewals",
  "settings.overview.trusted": "Trusted device: {name}",
  "settings.overview.verified": "Last verified {time}",
  "settings.overview.unverified": "No second factor recorded yet",
  "settings.network.campus": "Campus direct",
  "settings.network.webvpn": "WebVPN tunnel",
  "settings.network.unknown": "Detecting\u2026",
  "settings.network.disabled": "Transport disabled",
  "settings.network.listening": "local port {port} listening",
  "settings.network.notListening": "local port {port} not listening",
  "settings.mode.auto": "automatic",
  "settings.mode.direct": "direct only",
  "settings.mode.webvpn": "tunnel only",
  "settings.token.state.ok": "valid",
  "settings.token.state.expiring": "expiring soon",
  "settings.token.state.expired": "expired",
  "settings.token.state.rejected": "refused by the gateway",
  "settings.token.state.missing": "not configured",
  "settings.token.state.unknown": "expiry unknown",
  "settings.renew.off": "disabled",
  "settings.renew.idle": "idle",
  "settings.renew.scheduled": "next at {time}",
  "settings.renew.running": "renewing\u2026",
  "settings.renew.ok": "renewed at {time}",
  "settings.renew.stalled": "expiry unchanged",
  "settings.renew.needsHuman": "needs you",
  "settings.renew.error": "the last attempt failed",
  "settings.renew.lastOk": "Last renewed at {time}.",
  "settings.renew.lastFailure": "The last renewal did not succeed: {reason}",
  "settings.renew.detail": "Reported: {message}",
  "settings.queue.empty": "No model request is in flight right now",
  "settings.queue.running": "{inFlight} of {limit} running \xB7 {queued} queued",
  "settings.queue.shrunk": "current cap {limit}",
  "settings.queue.normal": "normal",
  "settings.queue.waiting": "queued",
  "settings.queue.cooldown": "429 cooldown {remaining}",
  "settings.queue.limit": "Up to {limit} requests may wait; the plugin sets no maximum wait time.",
  "settings.queue.control": "Queue waiting",
  "settings.queue.actionsHint": "Pause admission or reset the transport if the queue looks stuck.",
  "settings.queue.pause": "Pause queue",
  "settings.queue.resume": "Resume queue",
  "settings.queue.pauseBusy": "Switching\u2026",
  "settings.queue.reset": "Stuck transport",
  "settings.queue.resetHint": "Drops queued requests and closes live connections; sign-in is kept.",
  "settings.queue.resetAction": "Reset transport",
  "settings.queue.resetBusy": "Resetting\u2026",
  "settings.identity.account": "Sign-in account",
  "settings.identity.accountHint": "Used for automatic renewal",
  "settings.transport.mode": "Mode",
  "settings.transport.current": "Current path",
  "settings.transport.endpoint": "Local endpoint",
  "settings.transport.value": "127.0.0.1:{port}",
  "settings.transport.tunnel": "Tunnel session",
  "settings.transport.tunnelAt": "established {time}",
  "settings.transport.tunnelNone": "Connected directly",
  "settings.transport.tunnelPending": "Awaiting a tunnel session",
  "settings.transport.probe": "Last probe",
  "settings.transport.probeValue": "{verdict} \xB7 {time}",
  "settings.transport.verdict.ok": "ok",
  "settings.transport.verdict.invalid": "session invalid",
  "settings.transport.verdict.network": "network failure",
  "settings.transport.verdict.none": "not probed yet",
  "settings.transport.probeNow": "Detect network again",
  "settings.transport.probing": "Detecting\u2026",
  "settings.transport.hint": "Off campus the plugin switches to the WebVPN tunnel for renewal and request forwarding; no manual switching is needed.",
  "settings.transport.error": "Local transport error: {message}",
  "settings.identity.intro": "Blank fields keep their current values. The local credentials file stores the password as plain text.",
  "settings.username.label": "Student id",
  "settings.username.placeholder": "Enter your student ID",
  "settings.password.label": "Unified-auth password",
  "settings.password.placeholder": "Enter your password",
  "settings.field.configured": "Configured",
  "settings.field.unconfigured": "Not set",
  "settings.field.readOnly": "Read-only",
  "settings.field.clearPending": "Clears when saved",
  "settings.field.undoClear": "Undo",
  "settings.save": "Save",
  "settings.clear": "Clear",
  "settings.saving": "Saving\u2026",
  "settings.saved": "Saved",
  "settings.error.shadowed": "{field} is pinned read-only by the environment dsh was started from. Unset it there and restart dsh, then save here.",
  "settings.error.refused": "{field} could not be stored: {message}",
  "settings.error.unreachable": "No save result came back. Check the account status before retrying.",
  "settings.renew.now": "Renew now",
  "settings.renew.now.busy": "Renewing\u2026",
  "settings.renew.result.renewed": "A new token was acquired and stored.",
  "settings.renew.result.failed": "Renewal did not produce a new token: {message}",
  "settings.renew.result.noCredentials": "No student id or password is stored yet, so there was nothing to sign in with.",
  "settings.renew.result.noProgress": "The school returned the same token, so the expiry did not advance.",
  "settings.renew.result.needsHuman": "The school is asking for a second factor, or rejected the password.",
  "settings.renew.result.writeRefused": "The token was acquired but could not be stored; see the message below.",
  "settings.renew.result.rejected": "The gateway denied the new token verification",
  "settings.renew.result.rateLimited": "The gateway limited the verification request",
  "settings.renew.result.sessionLost": "The verification request was redirected to sign in",
  "settings.renew.result.probeUnreachable": "The connection to the gateway failed during verification",
  "settings.renew.result.probeUnavailable": "The gateway reported a service error during verification",
  "settings.renew.result.probeUnexpected": "The gateway returned an unrecognized verification response",
  "settings.renew.result.probeDetail": "{reason} ({detail})",
  "settings.device": "Trusted-device name: {name}",
  "twoFactor.title": "Device verification",
  "twoFactor.intro": "Complete Tsinghua verification to continue renewing your token.",
  "twoFactor.method.legend": "Choose a verification method",
  "twoFactor.method.wechat": "WeChat",
  "twoFactor.method.mobile": "SMS to {phone}",
  "twoFactor.method.totp": "Authenticator code",
  "twoFactor.trust": "Trust this device",
  "twoFactor.continue": "Continue",
  "twoFactor.code.legend": "Six-digit code",
  "twoFactor.code.placeholder": "123456",
  "twoFactor.code.submit": "Verify",
  "twoFactor.back": "Choose another method",
  "twoFactor.cancel": "Cancel the renewal",
  "twoFactor.error.invalidCode": "The code must be six digits.",
  "twoFactor.error.rejected": "The school did not accept that answer. Try again.",
  "twoFactor.error.unreachable": "The dsh host did not answer.",
  "link.label": "Tsinghua MadModel status",
  "link.title": "Open the Tsinghua MadModel status card",
  "link.loading": "Reading status\u2026",
  "link.cardQueue": "{running} running \xB7 {queued} queued"
};
var zh = {
  "pill.remaining": "\u5269 {remaining}",
  "pill.renewing": "\u7EED\u671F\u4E2D",
  "pill.expired": "\u5DF2\u8FC7\u671F",
  "pill.rejected": "\u88AB\u62D2\u7EDD",
  "pill.missing": "\u672A\u914D\u7F6E",
  "pill.unknown": "\u6709\u6548\u671F\u672A\u77E5",
  "pill.unavailable": "\u72B6\u6001\u4E0D\u53EF\u7528",
  "pill.title": "{label} \u4EE4\u724C\u6709\u6548\u671F\uFF08{credentialRef}\uFF09",
  "pill.queued": "\u6392\u961F {count}",
  "pill.cooldown": "429 \u51B7\u5374\u4E2D",
  "notice.expiring.title": "{label} \u4EE4\u724C\u5C06\u5728 {remaining} \u540E\u5230\u671F",
  "notice.expiring.body": "\u53EF\u5728\u300C\u6E05\u534E MadModel\u300D\u67E5\u770B\u7EED\u671F\u5B89\u6392\u3002\u9700\u8981\u9A8C\u8BC1\u65F6\u4F1A\u5F39\u51FA\u8BBE\u5907\u9A8C\u8BC1\u3002",
  "notice.expired.title": "{label} \u4EE4\u724C\u5DF2\u8FC7\u671F",
  "notice.expired.body": "\u5728\u300C\u6E05\u534E MadModel\u300D\u70B9\u51FB\u300C\u7ACB\u5373\u7EED\u671F\u300D\u83B7\u53D6\u65B0\u4EE4\u724C\u3002",
  "notice.rejected.title": "{label} \u4EE4\u724C\u672A\u901A\u8FC7\u9274\u6743",
  "notice.rejected.body": "\u7F51\u5173\u8FD4\u56DE\u4E86\u9274\u6743\u5931\u8D25\uFF08{reason}\uFF09\u3002",
  "notice.missing.title": "{label} \u4EE4\u724C\u672A\u914D\u7F6E",
  "notice.missing.body": "\u5230 \u8BBE\u7F6E \u2192 \u6A21\u578B \u91CC\u586B\u4E0A {credentialRef}\uFF0C\u6216\u8005\u8BA9\u81EA\u52A8\u7EED\u671F\u53BB\u53D6\u4E00\u4E2A\u3002",
  "notice.needsHuman.title": "{label} \u7EED\u671F\u9700\u8981\u4F60\u64CD\u4F5C",
  "notice.needsHuman.body": "\u5728\u300C\u6E05\u534E MadModel\u300D\u67E5\u770B\u7EED\u671F\u8BE6\u60C5\uFF0C\u6309\u63D0\u793A\u9A8C\u8BC1\u8BBE\u5907\u6216\u66F4\u65B0\u767B\u5F55\u8D26\u53F7\u3002",
  "notice.renewFailed.title": "{label} \u7EED\u671F\u5931\u8D25",
  "notice.renewFailed.body": "\u5728\u300C\u6E05\u534E MadModel\u300D\u67E5\u770B\u672C\u6B21\u7EED\u671F\u8BE6\u60C5\u3002",
  "notice.stalled.title": "{label} \u4EE4\u724C\u6709\u6548\u671F\u672A\u5EF6\u540E",
  "notice.stalled.body": "\u5F53\u524D\u4EE4\u724C\u7684\u5230\u671F\u65F6\u95F4\u4FDD\u6301\u539F\u6837\uFF0C\u53EF\u5728\u300C\u6E05\u534E MadModel\u300D\u67E5\u770B\u7EED\u671F\u7ED3\u679C\u3002",
  "notice.dismiss": "\u77E5\u9053\u4E86",
  "settings.nav": "\u6E05\u534E MadModel",
  "settings.title": "\u6E05\u534E MadModel",
  "settings.header.network": "\u6821\u5185\u76F4\u8FDE \xB7 \u6821\u5916 WebVPN",
  "settings.header.renewal": "\u81EA\u52A8\u7EED\u671F",
  "settings.header.queue": "\u672C\u5730\u6392\u961F",
  "settings.section.overview": "\u6982\u89C8",
  "settings.section.queue": "\u6A21\u578B\u4E0E\u5E76\u53D1",
  "settings.section.transport": "\u8FDE\u63A5",
  "settings.identity.edit": "\u7F16\u8F91",
  "settings.identity.configure": "\u914D\u7F6E",
  "settings.identity.collapse": "\u6536\u8D77",
  "settings.identity.cancel": "\u53D6\u6D88",
  "settings.overview.network": "\u7F51\u7EDC\u901A\u9053",
  "settings.overview.token": "\u8BBF\u95EE\u4EE4\u724C",
  "settings.overview.renew": "\u7EED\u671F",
  "settings.renew.actionHint": "\u7ACB\u5373\u5411\u5B66\u6821\u6362\u53D6\u65B0 token\u3002",
  "settings.overview.verify": "\u8BBE\u5907\u9A8C\u8BC1",
  "settings.overview.remaining": "\u5269\u4F59 {remaining}",
  "settings.overview.source": "\u6765\u81EA {source}",
  "settings.overview.expiresAt": "\u6709\u6548\u81F3 {time}",
  "settings.overview.next": "\u4E0B\u6B21 {time}",
  "settings.overview.last": "\u4E0A\u6B21 {time}",
  "settings.overview.unattended": "{count} \u6B21\u65E0\u4EBA\u503C\u5B88\u7EED\u671F",
  "settings.overview.trusted": "\u53EF\u4FE1\u8BBE\u5907\uFF1A{name}",
  "settings.overview.verified": "\u4E0A\u6B21\u9A8C\u8BC1 {time}",
  "settings.overview.unverified": "\u8FD8\u6CA1\u6709\u4E8C\u6B21\u9A8C\u8BC1\u8BB0\u5F55",
  "settings.network.campus": "\u6821\u56ED\u76F4\u8FDE",
  "settings.network.webvpn": "WebVPN \u96A7\u9053",
  "settings.network.unknown": "\u68C0\u6D4B\u4E2D\u2026",
  "settings.network.disabled": "\u4F20\u8F93\u5C42\u672A\u542F\u7528",
  "settings.network.listening": "\u672C\u5730\u7AEF\u53E3 {port} \u76D1\u542C\u4E2D",
  "settings.network.notListening": "\u672C\u5730\u7AEF\u53E3 {port} \u672A\u76D1\u542C",
  "settings.mode.auto": "\u81EA\u52A8",
  "settings.mode.direct": "\u56FA\u5B9A\u76F4\u8FDE",
  "settings.mode.webvpn": "\u56FA\u5B9A\u96A7\u9053",
  "settings.token.state.ok": "\u6709\u6548",
  "settings.token.state.expiring": "\u5373\u5C06\u5230\u671F",
  "settings.token.state.expired": "\u5DF2\u8FC7\u671F",
  "settings.token.state.rejected": "\u88AB\u7F51\u5173\u62D2\u7EDD",
  "settings.token.state.missing": "\u672A\u914D\u7F6E",
  "settings.token.state.unknown": "\u6709\u6548\u671F\u672A\u77E5",
  "settings.renew.off": "\u5DF2\u5173\u95ED",
  "settings.renew.idle": "\u5F85\u547D",
  "settings.renew.scheduled": "\u4E0B\u6B21 {time}",
  "settings.renew.running": "\u7EED\u671F\u4E2D\u2026",
  "settings.renew.ok": "{time} \u5DF2\u7EED\u671F",
  "settings.renew.stalled": "\u6709\u6548\u671F\u672A\u5EF6\u540E",
  "settings.renew.needsHuman": "\u9700\u8981\u4F60\u64CD\u4F5C",
  "settings.renew.error": "\u4E0A\u6B21\u7EED\u671F\u5931\u8D25",
  "settings.renew.lastOk": "\u4E0A\u6B21\u7EED\u671F\u6210\u529F\uFF1A{time}\u3002",
  "settings.renew.lastFailure": "\u4E0A\u6B21\u7EED\u671F\u6CA1\u6709\u6210\u529F\uFF1A{reason}",
  "settings.renew.detail": "\u539F\u59CB\u4FE1\u606F\uFF1A{message}",
  "settings.queue.empty": "\u5F53\u524D\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u6A21\u578B\u8BF7\u6C42",
  "settings.queue.running": "\u5728\u8DD1 {inFlight}/{limit} \xB7 \u6392\u961F {queued}",
  "settings.queue.shrunk": "\u5F53\u524D\u9650\u989D {limit}",
  "settings.queue.normal": "\u6B63\u5E38",
  "settings.queue.waiting": "\u6392\u961F\u4E2D",
  "settings.queue.cooldown": "429 \u51B7\u5374 {remaining}",
  "settings.queue.limit": "\u6700\u591A {limit} \u6761\u8BF7\u6C42\u53EF\u4EE5\u7B49\u5F85\uFF1B\u63D2\u4EF6\u672C\u8EAB\u4E0D\u8BBE\u6700\u957F\u7B49\u5F85\u65F6\u95F4\u3002",
  "settings.queue.control": "\u6392\u961F\u7B49\u5F85",
  "settings.queue.actionsHint": "\u961F\u5217\u770B\u8D77\u6765\u5361\u4F4F\u65F6\uFF0C\u53EF\u4EE5\u6682\u505C\u51C6\u5165\u6216\u91CD\u7F6E\u4F20\u8F93\u5C42\u3002",
  "settings.queue.pause": "\u6682\u505C\u6392\u961F",
  "settings.queue.resume": "\u6062\u590D\u6392\u961F",
  "settings.queue.pauseBusy": "\u5207\u6362\u4E2D\u2026",
  "settings.queue.reset": "\u4F20\u8F93\u5C42\u5361\u4F4F",
  "settings.queue.resetHint": "\u6E05\u7A7A\u6392\u961F\u5E76\u65AD\u5F00\u5F53\u524D\u8FDE\u63A5\uFF0C\u4E0D\u4F1A\u9000\u51FA\u767B\u5F55\u3002",
  "settings.queue.resetAction": "\u91CD\u7F6E\u4F20\u8F93\u5C42",
  "settings.queue.resetBusy": "\u91CD\u7F6E\u4E2D\u2026",
  "settings.identity.account": "\u767B\u5F55\u8D26\u53F7",
  "settings.identity.accountHint": "\u7528\u4E8E\u81EA\u52A8\u7EED\u671F",
  "settings.transport.mode": "\u4F20\u8F93\u6A21\u5F0F",
  "settings.transport.current": "\u5F53\u524D\u901A\u9053",
  "settings.transport.endpoint": "\u672C\u5730\u7AEF\u70B9",
  "settings.transport.value": "127.0.0.1:{port}",
  "settings.transport.tunnel": "\u96A7\u9053\u4F1A\u8BDD",
  "settings.transport.tunnelAt": "\u5EFA\u7ACB\u4E8E {time}",
  "settings.transport.tunnelNone": "\u5F53\u524D\u76F4\u8FDE",
  "settings.transport.tunnelPending": "\u7B49\u5F85\u5EFA\u7ACB\u96A7\u9053",
  "settings.transport.probe": "\u6700\u8FD1\u63A2\u6D4B",
  "settings.transport.probeValue": "{verdict} \xB7 {time}",
  "settings.transport.verdict.ok": "\u6B63\u5E38",
  "settings.transport.verdict.invalid": "\u4F1A\u8BDD\u5931\u6548",
  "settings.transport.verdict.network": "\u7F51\u7EDC\u5931\u8D25",
  "settings.transport.verdict.none": "\u8FD8\u6CA1\u63A2\u6D4B",
  "settings.transport.probeNow": "\u91CD\u65B0\u68C0\u6D4B\u7F51\u7EDC",
  "settings.transport.probing": "\u68C0\u6D4B\u4E2D\u2026",
  "settings.transport.hint": "\u6821\u5916\u4F1A\u81EA\u52A8\u5207\u6362\u5230 WebVPN \u96A7\u9053\u6362\u7968\u5E76\u8F6C\u53D1\u8BF7\u6C42\uFF0C\u4E0D\u9700\u8981\u624B\u52A8\u5207\u6362\u3002",
  "settings.transport.error": "\u672C\u5730\u4F20\u8F93\u5C42\u9519\u8BEF\uFF1A{message}",
  "settings.identity.intro": "\u7559\u7A7A\u4FDD\u7559\u539F\u503C\u3002\u5BC6\u7801\u4EE5\u660E\u6587\u4FDD\u5B58\u5728\u672C\u673A\u51ED\u636E\u6587\u4EF6\u3002",
  "settings.username.label": "\u5B66\u53F7",
  "settings.username.placeholder": "\u8F93\u5165\u5B66\u53F7",
  "settings.password.label": "\u7EDF\u4E00\u8BA4\u8BC1\u5BC6\u7801",
  "settings.password.placeholder": "\u8F93\u5165\u7EDF\u4E00\u8BA4\u8BC1\u5BC6\u7801",
  "settings.field.configured": "\u5DF2\u914D\u7F6E",
  "settings.field.unconfigured": "\u5F85\u914D\u7F6E",
  "settings.field.readOnly": "\u53EA\u8BFB",
  "settings.field.clearPending": "\u4FDD\u5B58\u540E\u6E05\u9664",
  "settings.field.undoClear": "\u64A4\u9500",
  "settings.save": "\u4FDD\u5B58",
  "settings.clear": "\u6E05\u9664",
  "settings.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "settings.saved": "\u5DF2\u4FDD\u5B58",
  "settings.error.shadowed": "{field} \u88AB\u542F\u52A8 dsh \u7684\u73AF\u5883\u53D8\u91CF\u56FA\u5B9A\u4E3A\u53EA\u8BFB\u3002\u8BF7\u5728\u542F\u52A8\u73AF\u5883\u91CC unset \u5B83\u5E76\u91CD\u542F dsh\uFF0C\u518D\u56DE\u5230\u8FD9\u91CC\u4FDD\u5B58\u3002",
  "settings.error.refused": "{field} \u5199\u5165\u5931\u8D25\uFF1A{message}",
  "settings.error.unreachable": "\u672A\u6536\u5230\u4FDD\u5B58\u7ED3\u679C\uFF0C\u8BF7\u68C0\u67E5\u8D26\u53F7\u72B6\u6001\u540E\u518D\u8BD5\u3002",
  "settings.renew.now": "\u7ACB\u5373\u7EED\u671F",
  "settings.renew.now.busy": "\u7EED\u671F\u4E2D\u2026",
  "settings.renew.result.renewed": "\u5DF2\u53D6\u5F97\u5E76\u5199\u5165\u65B0\u7684 token\u3002",
  "settings.renew.result.failed": "\u8FD9\u6B21\u7EED\u671F\u6CA1\u6709\u4EA7\u751F\u65B0 token\uFF1A{message}",
  "settings.renew.result.noCredentials": "\u8FD8\u6CA1\u5B58\u5B66\u53F7\u6216\u5BC6\u7801\uFF0C\u6CA1\u6709\u53EF\u4EE5\u7528\u6765\u767B\u5F55\u7684\u51ED\u636E\u3002",
  "settings.renew.result.noProgress": "\u5B66\u6821\u8FD4\u56DE\u7684\u662F\u540C\u4E00\u5F20 token\uFF0C\u6709\u6548\u671F\u6CA1\u6709\u524D\u8FDB\u3002",
  "settings.renew.result.needsHuman": "\u5B66\u6821\u8981\u6C42\u4E8C\u6B21\u9A8C\u8BC1\uFF0C\u6216\u8005\u5BC6\u7801\u4E0D\u5BF9\u3002",
  "settings.renew.result.writeRefused": "token \u62FF\u5230\u4E86\uFF0C\u4F46\u5199\u4E0D\u8FDB\u51ED\u636E\u6587\u4EF6\uFF1B\u89C1\u4E0B\u9762\u7684\u4FE1\u606F\u3002",
  "settings.renew.result.rejected": "\u65B0\u4EE4\u724C\u672A\u901A\u8FC7\u7F51\u5173\u9274\u6743",
  "settings.renew.result.rateLimited": "\u4EE4\u724C\u6821\u9A8C\u89E6\u53D1\u7F51\u5173\u9650\u6D41",
  "settings.renew.result.sessionLost": "\u4EE4\u724C\u6821\u9A8C\u88AB\u91CD\u5B9A\u5411\u5230\u767B\u5F55\u6D41\u7A0B",
  "settings.renew.result.probeUnreachable": "\u4EE4\u724C\u6821\u9A8C\u65F6\u8FDE\u63A5\u7F51\u5173\u5931\u8D25",
  "settings.renew.result.probeUnavailable": "\u7F51\u5173\u6821\u9A8C\u670D\u52A1\u6682\u65F6\u5F02\u5E38",
  "settings.renew.result.probeUnexpected": "\u7F51\u5173\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u6821\u9A8C\u54CD\u5E94",
  "settings.renew.result.probeDetail": "{reason}\uFF08{detail}\uFF09",
  "settings.device": "\u53EF\u4FE1\u8BBE\u5907\u540D\uFF1A{name}",
  "twoFactor.title": "\u8BBE\u5907\u9A8C\u8BC1",
  "twoFactor.intro": "\u5B8C\u6210\u6E05\u534E\u7EDF\u4E00\u8BA4\u8BC1\u540E\uFF0C\u63D2\u4EF6\u4F1A\u7EE7\u7EED\u7EED\u671F\u3002",
  "twoFactor.method.legend": "\u9009\u62E9\u9A8C\u8BC1\u65B9\u5F0F",
  "twoFactor.method.wechat": "\u5FAE\u4FE1",
  "twoFactor.method.mobile": "\u77ED\u4FE1\uFF08{phone}\uFF09",
  "twoFactor.method.totp": "TOTP \u53E3\u4EE4",
  "twoFactor.trust": "\u5C06\u6B64\u8BBE\u5907\u8BBE\u4E3A\u53EF\u4FE1\u8BBE\u5907",
  "twoFactor.continue": "\u7EE7\u7EED",
  "twoFactor.code.legend": "\u516D\u4F4D\u9A8C\u8BC1\u7801",
  "twoFactor.code.placeholder": "123456",
  "twoFactor.code.submit": "\u9A8C\u8BC1",
  "twoFactor.back": "\u6362\u4E00\u79CD\u65B9\u5F0F",
  "twoFactor.cancel": "\u53D6\u6D88\u7EED\u671F",
  "twoFactor.error.invalidCode": "\u9A8C\u8BC1\u7801\u5E94\u4E3A\u516D\u4F4D\u6570\u5B57\u3002",
  "twoFactor.error.rejected": "\u5B66\u6821\u6CA1\u6709\u63A5\u53D7\u8FD9\u4E2A\u7B54\u6848\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "twoFactor.error.unreachable": "dsh \u5BBF\u4E3B\u6CA1\u6709\u54CD\u5E94\u3002",
  "link.label": "\u6E05\u534E MadModel \u72B6\u6001",
  "link.title": "\u6253\u5F00\u6E05\u534E MadModel \u72B6\u6001\u5361\u7247",
  "link.loading": "\u6B63\u5728\u8BFB\u53D6\u72B6\u6001\u2026",
  "link.cardQueue": "{running} \u5728\u8DD1 \xB7 {queued} \u6392\u961F"
};

// src/client/settings-icon.ts
var MARK = "thu-automad";
function installSettingsIcon(labels, glyph) {
  const style = document.createElement("style");
  const selector = `button[data-dsh-plugin-icon="${MARK}"] svg`;
  style.textContent = `${selector}{width:16px;height:16px;flex-shrink:0;display:block;background:currentColor;mask:url("data:image/svg+xml,${encodeURIComponent(glyph)}") center/contain no-repeat}${selector}>*{visibility:hidden}`;
  document.head.appendChild(style);
  const update = () => {
    const wanted = new Set(labels);
    for (const button of document.querySelectorAll('[role="dialog"][data-shortcut-modal="settings"] nav button')) {
      if (wanted.has(button.textContent?.trim() ?? "")) button.setAttribute("data-dsh-plugin-icon", MARK);
    }
  };
  const observer = new MutationObserver(update);
  observer.observe(document.body, { childList: true, subtree: true });
  update();
  return () => {
    observer.disconnect();
    style.remove();
    for (const item of document.querySelectorAll(`[data-dsh-plugin-icon="${MARK}"]`)) {
      item.removeAttribute("data-dsh-plugin-icon");
    }
  };
}

// src/client/status.ts
var POLL_INTERVAL_MS = 5e3;
var AutomadStatusController = class {
  snapshot = { status: null, unreachable: false };
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
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void this.poll();
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
      this.publish({ status: decoded, unreachable: false });
    } catch (_statusRouteUnreachable) {
      this.publishUnreachable();
    } finally {
      this.inFlight = false;
    }
  }
  /** Keep the last known status while marking the route unreachable. */
  publishUnreachable() {
    this.publish({ status: this.snapshot.status, unreachable: true });
  }
  /** Replace the snapshot when a displayed fact moved, then notify listeners. */
  publish(next) {
    if (sameSnapshot(this.snapshot, next)) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
};
function sameSnapshot(left, right) {
  if (left.unreachable !== right.unreachable) return false;
  if (left.status === null || right.status === null) return left.status === right.status;
  return displayable(left.status) === displayable(right.status);
}
function displayable(status) {
  const { observedAt: _observedAt, uptimeSeconds: _uptimeSeconds, ...rest } = status;
  const { observedAt: _tokenObservedAt, ...token } = rest.token;
  return JSON.stringify({ ...rest, token });
}

// src/client/index.ts
var name = "thu-automad";
var inject = ["slots", "locale"];
function apply(ctx) {
  const controller = new AutomadStatusController();
  const actions = createActions();
  const refresh = () => {
    void controller.poll();
  };
  const injected = () => ({ hooks: { automadStatus: controller }, actions, refresh });
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "thu-automad: dictionaries");
  ctx.effect(() => installStyles(), "thu-automad: stylesheet");
  if (typeof MutationObserver !== "undefined") {
    ctx.effect(
      () => installSettingsIcon([zh["settings.nav"], en["settings.nav"]], icon_default),
      "thu-automad: settings glyph"
    );
  }
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
    children: { [STATUS_PILL_READING]: { kind: "single", scope: "session" } },
    inject: () => ({ hooks: { automadStatus: controller } })
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
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
