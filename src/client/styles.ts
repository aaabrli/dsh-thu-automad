/**
 * Class names and the one stylesheet this plugin injects.
 *
 * The bundle carries no CSS pipeline, so the stylesheet is a plain string
 * mounted as its own `<style>` element for the plugin's lifetime, keyed by a
 * data attribute so a hot reload cannot stack duplicates.
 *
 * Plugin surfaces share a palette and spacing scale derived from the shell's
 * `--dsw-*` tokens. DSH primitives own form controls and modal behavior.
 * @module dsh-thu-automad/client/styles
 */

import iconSvg from '../../icon.svg'

/** Owning plugin id, recorded on the injected `<style>` element. */
const PLUGIN_ID = 'dsh-thu-automad'

/** Class names referenced from the components. */
export const css = {
  reading: 'taReading',
  mark: 'taMark',
  markTile: 'taMarkTile',
  pillIcon: 'taPillIcon',

  link: 'taLink',
  linkWrap: 'taLinkWrap',
  statusCard: 'taStatusCard',
  cardHead: 'taCardHead',
  cardTitle: 'taCardTitle',
  cardHeadValue: 'taCardHeadValue',
  cardRule: 'taCardRule',
  cardRows: 'taCardRows',
  cardRow: 'taCardRow',
  cardLabel: 'taCardLabel',
  cardValue: 'taCardValue',
  pool: 'taPool',
  poolName: 'taPoolName',
  poolCount: 'taPoolCount',
  hidden: 'taHidden',

  notice: 'taNotice',
  noticeIcon: 'taNoticeIcon',
  noticeBody: 'taNoticeBody',
  noticeTitle: 'taNoticeTitle',
  noticeText: 'taNoticeText',
  noticeClose: 'taNoticeClose',

  settings: 'taSettings',
  header: 'taHeader',
  headerBrand: 'taHeaderBrand',
  headerFeatures: 'taHeaderFeatures',
  h2: 'taH2',
  sectionTitle: 'taSectionTitle',
  group: 'taGroup',
  row: 'taRow',
  rowMain: 'taRowMain',
  rowLabel: 'taRowLabel',
  rowHint: 'taRowHint',
  rowValue: 'taRowValue',
  empty: 'taEmpty',
  mono: 'taMono',
  accountRow: 'taAccountRow',
  identityValue: 'taIdentityValue',
  identityEditor: 'taIdentityEditor',
  identityFields: 'taIdentityFields',
  identityFooter: 'taIdentityFooter',
  identityHelp: 'taIdentityHelp',
  meter: 'taMeter',
  meterFill: 'taMeterFill',
  meterRow: 'taMeterRow',
  rowNote: 'taRowNote',

  badge: 'taBadge',

  field: 'taField',
  fieldHeader: 'taFieldHeader',
  fieldLabel: 'taFieldLabel',
  fieldState: 'taFieldState',
  fieldInput: 'taFieldInput',
  fieldClear: 'taFieldClear',
  note: 'taNote',
  error: 'taError',

  factor: 'taFactor',
  factorModal: 'taFactorModal',
  factorHead: 'taFactorHead',
  factorChoices: 'taFactorChoices',
  factorOption: 'taFactorOption',
  factorCode: 'taFactorCode',
  factorActions: 'taFactorActions',
} as const

const STYLESHEET = `
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
  --ta-mark-image: url("data:image/svg+xml,${encodeURIComponent(iconSvg)}");
}

:is(.taBadge, .taReading, .taMeter, .taNotice)[data-tone="ok"] { --ta-tone: var(--ta-ok); }
:is(.taBadge, .taReading, .taMeter, .taNotice)[data-tone="warn"] { --ta-tone: var(--ta-warn); }
:is(.taBadge, .taReading, .taMeter, .taNotice)[data-tone="error"] { --ta-tone: var(--ta-error); }

.taGroup, .taNotice, .taFactorModal {
  box-sizing: border-box;
  border: 1px solid var(--ta-line);
  border-radius: var(--ta-radius);
  background: var(--ta-surface);
  color: var(--ta-ink);
}
.taIdentityEditor, .taFactor {
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
  border-radius: var(--dsw-radius-sm, var(--ta-control-radius));
  background: transparent;
  color: var(--ta-subtle);
  font: inherit;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}

.taLink:hover, .taLink[aria-expanded="true"] { background: var(--ta-hover); color: var(--ta-muted); }
.taLink:focus-visible { outline: 2px solid var(--ta-focus); outline-offset: 2px; }

/*
 * The popover is the shell's own stat card, not a plugin skin.
 *
 * The composer dock already holds three cards (activity, token usage, context
 * usage) drawn by the shell's stat-dialog panel: menu surface, large radius,
 * 16px padding, 12/18 type, a ruled title and a four-row definition list. A
 * fourth card with its own surface, border, padding and row rhythm reads as a
 * different product sitting in the same row, which is exactly what a user
 * notices. Every value below therefore mirrors that panel.
 */
.taStatusCard {
  position: fixed;
  inset: auto;
  margin: 0;
  box-sizing: border-box;
  width: max-content;
  min-width: min(300px, calc(100vw - 24px));
  max-width: min(440px, calc(100vw - 24px));
  max-height: min(62dvh, 420px);
  overflow: hidden auto;
  padding: 16px;
  border: 0;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-specific-menu, var(--ta-surface));
  backdrop-filter: var(--dsw-menu-backdrop-filter, none);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1, var(--ta-line));
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, var(--ta-line));
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, var(--ta-muted));
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgb(0 0 0 / 25%));
  color: var(--ta-muted);
  font-size: 12px;
  line-height: 18px;
  z-index: 1200;
}
.taStatusCard:not(:popover-open) { display: none; }

/* Title row: icon + name on the left, the live reading on the right. */
.taCardHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
  color: var(--ta-ink);
  font-weight: 500;
}
.taCardTitle { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.taCardHead .taMark { width: 14px; height: 14px; }
.taCardHeadValue { color: var(--ta-ink); font-variant-numeric: tabular-nums; }
.taCardRule { border-top: .5px solid var(--ta-line); margin-bottom: 10px; }

/* Four label/value rows, laid out exactly like the shell's definition list. */
.taCardRows {
  display: grid;
  grid-template-columns: minmax(76px, auto) minmax(0, 1fr);
  gap: 6px 16px;
  margin: 0;
}
.taCardRow { display: contents; }
.taCardLabel { min-width: 0; margin: 0; color: var(--ta-subtle); }
.taCardValue {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 2px 10px;
  min-width: 0;
  margin: 0;
  color: var(--ta-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
/* A healthy value stays neutral, like the shell's; only trouble gets colour. */
.taCardValue[data-tone="warn"] { color: color-mix(in srgb, var(--ta-warn) 76%, var(--ta-ink)); }
.taCardValue[data-tone="error"] { color: color-mix(in srgb, var(--ta-error) 76%, var(--ta-ink)); }

/* One model's live share of the gateway's per-model ceiling. */
.taPool { display: inline-flex; align-items: baseline; gap: 4px; }
.taPoolName { color: var(--ta-subtle); }
.taPoolCount { font-variant-numeric: tabular-nums; }
.taPool[data-tone="warn"] .taPoolCount { color: color-mix(in srgb, var(--ta-warn) 82%, var(--ta-ink)); }
.taPool[data-tone="error"] .taPoolCount { color: color-mix(in srgb, var(--ta-error) 82%, var(--ta-ink)); }

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

/* ── settings page ─────────────────────────────────────────────────────── */

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

/* ── device verification ───────────────────────────────────────────────── */

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
`

/**
 * Mount the stylesheet for the owning plugin lifetime.
 * @returns a disposer removing the element.
 */
export function installStyles(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.textContent = STYLESHEET
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
