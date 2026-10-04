/**
 * The Chinese page a browser gets when it opens the status route.
 *
 * One URL serves two readers. This plugin's own poller asks for
 * `application/json` and keeps receiving the wire document; a human following
 * the composer pill sends `text/html` and gets the table below. Rendering it
 * here, on the Host, keeps the page free of a client bundle, of JavaScript, and
 * of a second route to keep in sync.
 *
 * The page reports the decision ledger, which is the one half of the status
 * document that has no other surface: the token and the renewal schedule are
 * already drawn in the composer pill and the settings page.
 * @module dsh-thu-automad/status-page
 */

import type { DecisionCounts } from './policy/status.ts'
import type { AutomadStatus, RenewPhase, TokenState } from './protocol.ts'

/** One row of the decision table: one ledger counter and what it counts. */
interface DecisionRow {
  /** Counter this row reports. */
  readonly key: keyof DecisionCounts
  /** Row label. */
  readonly label: string
  /** What the counter counts, in the reader's language. */
  readonly detail: string
}

/**
 * The table's rows, in the order a failure walks them.
 *
 * `ask` is not an alternative to the other actions: the ledger counts it beside
 * the resolution the human chose, so one answered question also increments
 * `retry`, `switch`, or `fail`. `renew` is counted apart for the same reason —
 * a renewal ends in one of those actions. Both overlaps are stated in the rows
 * rather than hidden in the numbers.
 */
const DECISION_ROWS: readonly DecisionRow[] = [
  {
    key: 'retry',
    label: '重试',
    detail: '把这次失败交回重试逻辑，沿用请求自己的重试预算；预算用尽之后才轮到规则里配置的动作。',
  },
  {
    key: 'switch',
    label: '切换',
    detail: '把这次请求改投到另一条路由（换一个 provider / model），然后重新发一次。',
  },
  {
    key: 'fail',
    label: '失败',
    detail: '判定这次失败就是最终结果，不再重试，也不再交给后面的恢复逻辑。',
  },
  {
    key: 'ask',
    label: '询问次数',
    detail: '停下来把问题交给用户，并且用户真的作出了选择。它与上面几行分开计数：一次询问最终会同时计入所选择的那一行，所以这一行与上面的数字有重叠。',
  },
  {
    key: 'renew',
    label: '续期',
    detail: '先重新登录换取新凭据，成功后再重试这次请求。它单独计数：一次续期最终会以上面的某个动作收尾。',
  },
]

/** Chinese wording for each token lifecycle state. */
const TOKEN_STATE_TEXT: Record<TokenState, string> = {
  ok: '有效',
  expiring: '快过期了',
  expired: '已过期',
  rejected: '被网关拒绝',
  missing: '未配置',
  unknown: '有值，但读不出有效期',
}

/** Visual weight of one reported state. */
const TOKEN_STATE_TONE: Record<TokenState, 'ok' | 'warn' | 'bad' | 'muted'> = {
  ok: 'ok',
  expiring: 'warn',
  expired: 'bad',
  rejected: 'bad',
  missing: 'muted',
  unknown: 'muted',
}

/** Chinese wording for each renewal-schedule position. */
const RENEW_PHASE_TEXT: Record<RenewPhase, string> = {
  off: '已关闭',
  idle: '待命',
  scheduled: '已排期',
  running: '正在登录',
  ok: '上次成功',
  stalled: '上次拿到的是同一张 token',
  'needs-human': '需要你操作',
  error: '上次续期失败',
}

/**
 * Whether one request wants the rendered page rather than the wire document.
 *
 * The browser half polls with an explicit `application/json`, so only a
 * navigation has to be recognized: a browser opening this URL sends
 * `text/html`, while a script, `curl`, or the poller keeps getting JSON.
 * @param request - the request the status route received.
 * @returns true when the response should be the page.
 */
export function prefersHtml(request: Request): boolean {
  const accept = request.headers.get('accept')
  return accept !== null && accept.includes('text/html')
}

/**
 * Render the status document as a self-contained Chinese page.
 * @param status - the same document the JSON branch serves.
 * @returns a complete HTML document.
 */
export function renderStatusPage(status: AutomadStatus): string {
  const { token, renew, policy } = status
  const tone = TOKEN_STATE_TONE[token.state]
  const next = renew.nextAttemptAt === null ? '' : `（下次 ${formatTime(renew.nextAttemptAt)}）`
  const rows = DECISION_ROWS.map(row => [
    '      <tr>',
    `        <th scope="row">${escapeHtml(row.label)}</th>`,
    `        <td class="count">${String(policy.counts[row.key])}</td>`,
    `        <td>${escapeHtml(row.detail)}</td>`,
    '      </tr>',
  ].join('\n')).join('\n')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>清华 MadModel 运行状态</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #1f2328;
  --muted: #6b7280;
  --line: #e5e7eb;
  --head: #f6f7f9;
  --ok: #1a7f37;
  --warn: #9a6700;
  --bad: #cf222e;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117;
    --fg: #e6edf3;
    --muted: #9198a1;
    --line: #30363d;
    --head: #161b22;
    --ok: #3fb950;
    --warn: #d29922;
    --bad: #f85149;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 40px 24px 64px;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  font-size: 14px;
  line-height: 1.65;
}
main { max-width: 960px; margin: 0 auto; }
h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
.sub { margin: 0 0 18px; color: var(--muted); font-size: 13px; }
.meta { margin: 0 0 22px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--head); font-size: 13px; }
.meta span + span::before { content: "·"; margin: 0 8px; color: var(--muted); }
.meta b { font-weight: 600; }
.meta b.ok { color: var(--ok); }
.meta b.warn { color: var(--warn); }
.meta b.bad { color: var(--bad); }
.meta b.muted { color: var(--muted); }
table { border-collapse: collapse; width: 100%; }
caption { margin-bottom: 8px; color: var(--muted); font-size: 13px; text-align: left; }
th, td { border: 1px solid var(--line); padding: 10px 12px; text-align: left; vertical-align: top; }
thead th { background: var(--head); font-weight: 600; white-space: nowrap; }
tbody th { font-weight: 600; white-space: nowrap; }
td.count { text-align: right; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
</head>
<body>
<main>
  <h1>清华 MadModel 运行状态</h1>
  <p class="sub">凭据 ${escapeHtml(token.label)}（${escapeHtml(token.credentialRef)}）</p>
  <p class="meta">
    <span>令牌 <b class="${tone}">${escapeHtml(TOKEN_STATE_TEXT[token.state])}</b></span>
    <span>自动续期 <b>${escapeHtml(RENEW_PHASE_TEXT[renew.phase])}</b>${escapeHtml(next)}</span>
    <span>已运行 ${escapeHtml(formatUptime(status.uptimeSeconds))}</span>
    <span>更新于 ${escapeHtml(formatTime(status.observedAt))}</span>
  </p>
  <table>
    <caption>失败策略统计（自插件加载以来）</caption>
    <thead>
      <tr>
        <th scope="col">动作</th>
        <th scope="col">次数</th>
        <th scope="col">策略介绍</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</main>
</body>
</html>
`
}

/** Escape one interpolated value for HTML text content. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Format one epoch-millisecond instant as local `YYYY-MM-DD HH:mm:ss`. */
function formatTime(ms: number): string {
  const at = new Date(ms)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} `
    + `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
}

/** Describe a duration in whole seconds as a short Chinese span. */
function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  if (days > 0) return hours > 0 ? `${String(days)} 天 ${String(hours)} 小时` : `${String(days)} 天`
  if (hours > 0) return minutes > 0 ? `${String(hours)} 小时 ${String(minutes)} 分钟` : `${String(hours)} 小时`
  if (minutes > 0) return `${String(minutes)} 分钟`
  return `${String(total)} 秒`
}
