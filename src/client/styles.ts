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
const PLUGIN_ID = 'dsh-thu-automad'

/** Class names referenced from the components. */
export const css = {
  reading: 'taReading',
  readingWarn: 'taReadingWarn',
  readingError: 'taReadingError',
  dot: 'taDot',
  dotOk: 'taDotOk',
  dotWarn: 'taDotWarn',
  dotError: 'taDotError',
  dotIdle: 'taDotIdle',

  link: 'taLink',
  linkIcon: 'taLinkIcon',
  hidden: 'taHidden',

  notice: 'taNotice',
  noticeError: 'taNoticeError',
  noticeIcon: 'taNoticeIcon',
  noticeBody: 'taNoticeBody',
  noticeTitle: 'taNoticeTitle',
  noticeText: 'taNoticeText',
  noticeClose: 'taNoticeClose',

  form: 'taForm',
  fieldset: 'taFieldset',
  legend: 'taLegend',
  option: 'taOption',
  note: 'taNote',
  error: 'taError',

  section: 'taSection',
  card: 'taCard',
  h2: 'taH2',
  h3: 'taH3',
  p: 'taP',
  row: 'taRow',
  rowLabel: 'taRowLabel',
  rowValue: 'taRowValue',
  badge: 'taBadge',
  badgeOk: 'taBadgeOk',
  badgeIdle: 'taBadgeIdle',
  badgeWarn: 'taBadgeWarn',
  badgeError: 'taBadgeError',
  field: 'taField',
  fieldLabel: 'taFieldLabel',
  fieldState: 'taFieldState',
  actions: 'taActions',
} as const

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
