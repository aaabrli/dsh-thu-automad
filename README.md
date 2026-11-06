# DSH-thu-automad

清华 madmodel 网关的**凭据自动化 + 校外传输**插件：盯 token 有效期、到期自动重新登录、失败时按规则决定下一步；不在清华校园网时，通过 WebVPN 隧道继续对话。

## 主要功能

- **盯有效期** —— 解码 JWT 的 `exp`，输入框下方的药丸显示剩余时间；被网关拒绝立刻标红。剩余 30 分钟变琥珀色，提前 1 小时自动续期。
- **自动续期** —— 用存的学号 + 统一认证口令重新登录，把新 token 写回同一个凭据引用（`TSINGHUA_API_KEY`），provider 的下一次请求自动用上。
- **校内直连 / 校外 WebVPN** —— 同一个账号两条认证链：校内走直连 SSO 换票；校外走统一认证 → WebVPN 会话 → info 门户漫游 → 隧道内换票。首次校外登录会在弹窗里完成二次验证，勾选“登记为可信设备”后学校对这台设备的豁免约半年。
- **本地传输层** —— provider 行指向 `127.0.0.1:43110/v1`，由插件按当前网络选择直连或隧道转发；SSE 边收边转，不在本地聚合。
- **并发排队** —— 网关按模型限流，超出的请求在本地排队、按模型冷却后重发同一个请求，不换模型，也不把 429 抛给对话。
- **失败策略** —— 有序规则表决定一次失败之后做什么：`retry` / `switch` / `ask` / `fail`，以及本插件新增的 `renew`——**先续期，成功就用新 token 重连这次请求**，失败才走 `onFailure`。
- **设置页** —— 概览、模型与并发、连接三个区块；学号与口令就地填写，写入 `$DSH_HOME/.credentials.yaml`。
- **状态卡** —— 点击输入框下方的状态药丸，查看令牌状态、网络通道、续期安排和队列摘要。学校要求二次验证时会弹出「设备验证」。

## 为什么需要校外链路

madmodel 的直连域名 `madmodel.cs.tsinghua.edu.cn` 自 2026-09-10 起被校园网负载均衡的 oauth 门禁接管：

- **校内 IP**：直连放行，直连 SSO → 直连换票的链路可以工作；
- **校外 IP**：换票端点和 `/v1/*` 都会被 302 到统一认证（“您即将登录 WEBVPN”），续期和模型请求都到不了应用。

`vendor/` 里带了 **madmodel-proxy** 的完整 WebVPN 链（`getMadModelToken()`：统一认证 → WebVPN 会话 → info 门户漫游 → 隧道内换票）。v0.1.0 只把它当作续期后的备用校验路径，`tunnel` 配置只影响“续期后的校验请求”，模型请求仍然直连，所以 v0.1.0 实际上是“校园网专用”。

v0.2.0 把这条 WebVPN 链接进来，用于**校外续期**与**模型请求转发**，并补齐校外使用需要的另外两件事：隧道 cookie 的生命周期和请求体转发。

## 工作方式

```
provider 行 ──> http://127.0.0.1:43110/v1 ──┬─ 校园网：直连 https://madmodel.cs.tsinghua.edu.cn/v1
   （DSH）        （本插件，仅回环）          └─ 校外：https://webvpn.tsinghua.edu.cn/https/<hash>/v1
                                                         + Cookie: 隧道会话
```

- **网络判定**：`transport.mode: auto` 时，插件用一个未认证 GET 探测直连域名——返回应用页面即为校园网，返回 3xx 即为校外；结论缓存 5 分钟，失败时按需重探。
- **续期**：直连网络走原链（`authenticateIdentity` + 直连换票）；校外走 `getMadModelToken()`（WebVPN 全链）。两条链都把新 token 写回同一个凭据引用 `TSINGHUA_API_KEY`。
- **隧道 cookie**：校外登录后与 token 一起保存（`$DSH_HOME/.credentials.yaml` 的 session 记录），转发时随请求带上。
- **保活**：WebVPN 会话空闲约 2 小时失效，默认每 20 分钟探活一次；失效则丢弃 cookie 并重跑登录链。
- **失会话重试**：转发遇到 3xx（或 completions 返回 HTML 登录页）时，触发一次重登（20 秒冷却）并用同一个已缓冲的请求体重试一次；请求体上限 64 MiB。
- **SSE 透传**：响应边收边转，不在本地聚合。

## 并发排队（429）

网关**按模型**限制同一账号的在途 completion 数，超出时返回 429（“同时进行中的请求过多”）。上限来自上游实测（madmodel-proxy `docs/CONCURRENCY.md`，2026-10-29，同账号校园网直连）：

| 模型 | 实测并发上限 |
|---|---:|
| DeepSeek-V4.1-Flash | 3 |
| qwen3.8-27b | 4 |
| DeepSeek-R1-W8A8 | 1 |

混合 3 路 Flash + 4 路 Qwen + 1 路 R1 可同时完成，说明限额**按模型分别计算**。该实测无法区分限额绑定的是账号、token 还是 IP；所以“多登录一次是否叠加”仍属未验证。

这是学校账号侧的容量，插件不能把它变大，但可以做到“不失败、不换模型、等到有槽位再继续”：

- **按模型准入**：每个模型维护自己的在途上限（3 / 4 / 1）；超出的请求留在本地队列，不发给上游。
- **自适应上限**：起点就是实测上限；遇到 429 会减半，成功后逐步回到该模型的上限。
- **429 不抛给对话**：该请求放回队列，该模型进入全局冷却（5s 起、翻倍、上限 120s；有 `Retry-After` 就按它等），冷却结束自动重发**同一个请求**。临时限额按 3 → 2 → 1 递减，连续成功 4 次后回升。
- **排队保活**：流式请求等待超过 20 秒后，本地先回 SSE 注释行（`: waiting`）保活，槽位一到就接着把上游内容写进同一条流。这样“等很久”不会先被 HTTP 空闲超时掐断。
- **队列上限**：等待队列默认最多 32 条；满了才返回 503，而不是无限堆积内存。
- **槽位随连接归还**：对话中止、页面关闭或客户端断开时，代理会立刻释放该请求占用的并发槽，不会留下“没有对话却显示满”的幽灵请求。

### 为什么没有“最长排队时间”

插件侧的 `maxWaitMs` 默认是 **0 = 不设上限**：请求会一直等到有槽位、或者你取消这一轮为止。之前提到的“最长排队时间”只是为了防止客户端先超时，现在改用保活 + 调大宿主超时来解决：

```yaml
# provider 行
timeoutMs: 3600000            # 单请求总预算（默认 10 分钟）
streamIdleTimeoutMs: 3600000  # 多久没有新 chunk 算卡死（默认 5 分钟）
```

这两个值是“等多久”的真正上限（默认 1 小时，可自行改大或改小）。如果哪天真要等更久，把这两个数继续加大即可，插件队列本身不会再拦你。

## 设置页

`设置 → 清华 MadModel` 有三个区块。

- **概览**显示网络通道、令牌状态与剩余时间、续期安排与结果、设备验证记录。
- **模型与并发**显示各模型的在跑数、上限、排队数和 429 冷却，也可以暂停排队或重置传输层。
- **连接**显示本地端点、隧道会话和登录账号。展开账号编辑后，可一起保存学号与密码的改动。

点击输入框下方的状态药丸可打开状态卡，查看与设置页一致的令牌状态、网络通道、续期安排和队列摘要。学校要求二次验证时会弹出「设备验证」。

## 安装

```sh
dsh plugin --profile web add github:aaabrli/dsh-thu-automad
```

或者点击左侧插件按钮，选择添加插件，输入本项目地址安装。

安装后，provider 行需要指向本地传输层（`cordis.patch.yml` 下半部分已带这一行）：

```yaml
baseURL: http://127.0.0.1:43110/v1
```

改端口时**两处一起改**。插件是 Host 侧的，改完必须重启 DSH 桌面端。

## 配置

`cordis.patch.yml` 中本插件的 `config`：

```yaml
transport:
  enabled: true        # 是否提供本地 /v1 传输层
  mode: auto           # auto | direct | webvpn
  port: 43110          # provider 行 baseURL 必须指向同一个端口
  keepaliveMs: 1200000 # 隧道保活间隔，最低 300000
  concurrency:         # 并发准入；省略时用默认值
    initial: 3
    max: 3
    perModel:          # 网关按模型分别限流（实测值）
      qwen3.8-27b: 4
      DeepSeek-R1-W8A8: 1
    min: 1
    growAfter: 4
    queueLimit: 32
    maxWaitMs: 0       # 0 = 不设排队上限
    heartbeatAfterMs: 20000
    heartbeatMs: 15000
    cooldownMs: 5000
    maxCooldownMs: 120000
```

其余键（`credentialRef`、`warnBeforeMs`、`refreshAheadMs`、`autoRenew`、`verifyAfterRenew`、`rules` 等）保持默认即可，含义与 v0.1.0 相同。

## 使用

1. 设置 → 清华 MadModel，填学号与统一认证口令，点“立即续期”。
2. 首次校外登录会弹二次验证（短信/企业微信/TOTP）；勾选“登记为可信设备”后，学校对这台设备的豁免约半年。
3. 状态卡片（点击输入框下方药丸）会显示当前传输：`校园直连` / `WebVPN 隧道`。

## 开发

公开安装走 `dsh plugin add github:...`；本地 checkout 用 profile 的 `link:` 依赖：

```json
"dsh-thu-automad": "link:D:/path/to/DSH-thu-automad"
```

然后在该 profile 目录执行 `pnpm install`，重启 DSH 桌面端。**插件是 Host 侧的，改完必须重启才生效。**

构建产物在 `lib/`（`lib/index.js` 供 Host，`lib/client.js` 供 Web）。重新构建：

```sh
npm install --no-save --legacy-peer-deps esbuild tsx
node build.mjs
```

## 验证

```sh
node node_modules/tsx/dist/cli.mjs checks/host-smoke.ts
node node_modules/tsx/dist/cli.mjs checks/policy-smoke.ts
node node_modules/tsx/dist/cli.mjs checks/client-smoke.ts
node node_modules/tsx/dist/cli.mjs checks/transport-smoke.ts
```

- `transport-smoke` 用假上游验证：过期 cookie 只买一次重登、Bearer/Cookie 注入、SSE 分段透传、未配置 token 时 503，以及并发排队（单槽不并行、429 自动重试同一请求、排队保活、队列满 503）。
- 校内实测：状态卡片显示“校园直连”，模型请求正常。
- 校外实测：状态卡片显示“WebVPN 隧道”，续期相位 `ok`，模型请求能出字。

## 隐私与安全

口令、token、WebVPN 隧道 cookie 都存在 `$DSH_HOME/.credentials.yaml`，**明文 YAML**，保护手段只有文件权限（`0600`，同目录 `0700`）与跨进程文件锁。本地传输层**没有鉴权**（与 madmodel-proxy 默认一致），仅监听 `127.0.0.1`，同主机上能访问该端口的程序都能借用你的 token。这个取舍不可接受，就不要在这个 profile 里配置口令。

## 已知限制

- WebVPN 会话与来源网络绑定：切换 Wi-Fi/代理后首个请求可能触发一次重登，重登失败会按规则进入 `needs-human` 或 `error`。
- 隧道空闲约 2 小时失效，`keepaliveMs` 不要设得比它长。
- 端口被占用时传输层起不来，状态卡片会显示“本地端口未监听”；换端口需同步改 provider `baseURL`。
- 二次认证仍然需要人工过一次；之后依赖学校的可信设备豁免。
- 模型能力、工具调用兼容性、上游协议细节沿用 madmodel-proxy，不在本插件范围内。

## 版本

- **v0.2.0** —— 校外传输层（WebVPN）、同模型并发排队、设置页与状态卡重做、插件图标。
- **v0.1.0** —— 凭据自动化：盯有效期、自动续期、失败策略、设置页。

## 致谢

- **[aaabrli](https://github.com/aaabrli)** —— 原始 `dsh-thu-automad`（v0.1.0）的作者；本仓库的认证链、失败策略与设置页基础来自他。
- **[madmodel-proxy](https://github.com/noroadback/madmodel-proxy)** —— 认证链、WebVPN 隧道前缀与 cookie 处理的知识来源（`vendor/` 为其字节副本）。
- **thu-tok-auto** —— 直连 SSO 路径的实测参数与 NO_PROGRESS 判定。