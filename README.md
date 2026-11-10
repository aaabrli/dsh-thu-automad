<p align="center">
  <img src="assets/logo.svg" width="112" alt="DSH-thu-automad">
</p>

<h1 align="center">DSH-thu-automad</h1>

<p align="center">
  <strong>清华 MadModel 的 DSH 插件</strong><br>
  自动续期校园 token：校内直连、校外 WebVPN，模型请求经本地回环转发。
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/github/package-json/v/aaabrli/dsh-thu-automad?style=flat-square&label=version">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-2EA043?style=flat-square">
  <img alt="platform" src="https://img.shields.io/badge/DSH-Web%20%7C%20Desktop-8A2BE2?style=flat-square">
  <img alt="Tsinghua MadModel" src="https://img.shields.io/badge/%E6%B8%85%E5%8D%8E-MadModel-660874?style=flat-square">
  <a href="https://github.com/aaabrli/dsh-thu-automad/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/aaabrli/dsh-thu-automad?style=flat-square"></a>
</p>

<p align="center">
  <a href="#安装">安装</a> ·
  <a href="#配置">配置</a> ·
  <a href="#使用">使用</a> ·
  <a href="#工作方式">工作方式</a> ·
  <a href="#并发与排队">并发与排队</a> ·
  <a href="#常见问题">常见问题</a> ·
  <a href="#开发">开发</a>
</p>

---

## 功能

| 能力 | 说明 |
| :--- | :--- |
| **自动续期** | 提前 1 小时用学号 + 统一认证口令重新登录，新 token 写回 `TSINGHUA_API_KEY`；剩余 30 分钟时状态药丸转琥珀色。 |
| **延后校验** | 续期校验遇到 5xx 或连接失败时保留当前 token，候选令牌留在宿主内存中；退避后重试同一候选的校验，复用已经完成的登录。 |
| **校内 / 校外** | 校内直连换票；校外走 统一认证 → WebVPN 会话 → 隧道内换票，请求随隧道 cookie 转发。 |
| **本地传输层** | provider 指向 `127.0.0.1:43110/v1`，按当前网络自动选择直连或隧道；SSE 边收边转。 |
| **并发排队** | 网关按模型限流，超出的请求在本地排队，429 冷却后重发同一个请求，不换模型、不打断对话。 |
| **失败策略** | 有序规则表：`renew` / `retry` / `switch` / `ask` / `fail`。 |
| **设置页与状态卡** | 概览、模型与并发、连接三个区块；状态药丸点开可看剩余寿命、通道与续期，以及逐模型的并发槽位。排队数固定显示在槽位左侧，槽位与计数间隔 4px；队列数量变化时布局稳定。模型行记录最近的上游故障，成功请求后清除；空闲、运行和服务异常分别显示。 |

## 安装

```sh
dsh plugin --profile web add github:aaabrli/dsh-thu-automad
```

也可以在 DSH 的「插件 → 添加插件」里填本仓库地址。

> [!IMPORTANT]
> 插件在 Host 侧运行，装完**必须重启 DSH** 才生效；更新时重跑同一条命令即可。

bundle 自带 provider 行（`清华 DeepSeek` → `tsinghua`，`baseURL: http://127.0.0.1:43110/v1`），无需手写；只有改端口时要同时改 `transport.port` 和这个 `baseURL`。

## 配置

默认即可用。需要调整时编辑 `cordis.patch.yml` 里的 `config`：

```yaml
transport:
  enabled: true
  mode: auto          # auto | direct | webvpn
  port: 43110
  keepaliveMs: 1200000
  concurrency:
    initial: 3
    max: 3
    perModel:          # 网关按模型分别限流
      qwen3.8-27b: 4
      DeepSeek-R1-W8A8: 1
    min: 1
    growAfter: 4
    queueLimit: 32
    maxWaitMs: 0       # 0 = 不设排队上限
```

<details>
<summary>其余配置项</summary>

`credentialRef`、`warnBeforeMs`、`refreshAheadMs`、`autoRenew`、`verifyAfterRenew`、`rules` 等一般保持默认；各键含义写在 `cordis.patch.yml` 的注释里。

</details>

## 使用

1. 设置 → **清华 MadModel**，填学号与统一认证口令，点「立即续期」。
2. 首次校外登录按提示完成二次验证；勾选「登记为可信设备」后，学校对这台设备的豁免约半年。
3. 输入框下方药丸显示当前通道：`校园直连` / `WebVPN 隧道`。

```
设置 → 清华 MadModel
├─ 概览          通道 / 令牌 / 续期 / 设备验证
├─ 模型与并发    在跑数 / 上限 / 排队 / 429 冷却
└─ 连接          本地端点 / 隧道会话 / 登录账号
```

## 工作方式

```
provider 行 ──> http://127.0.0.1:43110/v1 ──┬─ 校内：https://madmodel.cs.tsinghua.edu.cn/v1
   （DSH）        （本插件，仅回环）          └─ 校外：https://webvpn.tsinghua.edu.cn/https/<hash>/v1
```

- **网络判定**：`mode: auto` 时用未认证 GET 探测直连域名，返回应用页面即校内、返回 3xx 即校外；结论缓存 1 分钟。
- **隧道保活**：WebVPN 会话空闲约 2 小时失效，默认每 20 分钟探活一次；失效则重跑登录链。
- **校外先登录**：判定为隧道而本地没有会话 cookie 时，请求先等一次完整登录再发上游——没有会话的请求只会换回学校登录页，先发一次等于白跑一趟。
- **失会话重试**：上游回登录跳转时重登一次并重发同一个已缓冲的请求。登录拿不出可用会话时，这一轮报成带修复提示的本地错误，**不会**把跳转透传给 DSH：相对 `Location` 会被客户端按自己的回环 baseURL 解析，变成对 `127.0.0.1:43110/login` 的 404。
- **登录去重**：并发与连续重试共用一次登录；失败后 15 秒内不再重登，成功后 5 秒内不重复登录，避免把一次网络抖动变成一串登录尝试。

## 并发与排队

网关按模型限制同一账号的在途 completion 数（实测值）：

| 模型 | 并发上限 |
| :--- | ---: |
| DeepSeek-V4.1-Flash | 3 |
| qwen3.8-27b | 4 |
| DeepSeek-R1-W8A8 | 1 |

插件不超发，超出的请求按下面的规则处理：

- 每个模型维护自己的在途上限；超出的请求留在本地队列，不发给上游。
- 429 不抛给对话：该请求放回队列，该模型进入冷却（5s 起、翻倍、上限 120s，有 `Retry-After` 就按它等），结束后重发同一个请求。
- 流式请求等待超过 20 秒后先回 SSE 注释行保活，槽位一到继续写同一条流。
- 队列上限 32 条；对话取消或客户端断开时立刻释放该请求的并发槽。

## 常见问题

**排队会等到什么时候？** 默认不设插件侧上限（`maxWaitMs: 0`），等到有槽位或你取消为止。真正的超时上限是 provider 行的 `timeoutMs` 与 `streamIdleTimeoutMs`（bundle 里都是 1 小时），想更早放弃就调小它们。

**切到热点 / 换代理后第一轮就失败？** 隧道会话与来源网络绑定，插件会重新判定网络、重登一次并重发。若登录链没走通，这一轮会明确报「school's gateway redirected the request … 请到 设置 → 清华 MadModel 点 立即续期」，而不是一个看不懂的 404 或「模型不可用」。到设置页看一眼登录结果（状态卡与续期结果会列出失败码），点「立即续期」后再发消息即可。

**模型并发被占满时续期会失败吗？** 不会。续期后的校验探针遇到 429 会先重试两次；仍然忙就保留这次续期结果，只在结果里标注「未先行校验」，把排队交给真实请求自己走。429 是网关的排队信号，不是对这张 token 的判断。

**续期显示「等待校验」？** 学校已经返回候选令牌，但模型接口在校验时返回 5xx，或连接没有得到响应。当前令牌与隧道会话继续保留；自动续期启用时，插件会按退避计划重试候选令牌的校验，点「立即续期」也会优先重试校验。候选过期、账号/令牌变更或网络通道变化后，会重新评估登录。候选只存在当前宿主内存中，退出程序后清除；401/403 鉴权拒绝仍按失败处理。

**模型行显示上游服务异常？** 这是最近一次真实请求观察到的 5xx 或连接失败，队列空闲时也会保留，直到该模型有成功请求。检查状态本身不会发送新的模型请求。模型请求的自动重试由 DSH 统一管理，bundle 默认最多重试 5 次，退避从 2 秒增长到最多 30 秒；插件不会另外叠加一轮 5xx 请求重试。学校后端持续不可达时，需要等待服务恢复或选择其他已配置的服务。

上游在响应开始后断流也会记录为连接失败，主动取消请求不会触发这条故障记录。令牌过期、被拒绝或尚未配置时，底部药丸优先提示需要处理的凭据状态。

**状态卡显示「本地端口未监听」？** 端口被占用，传输层没起来；换端口时同步改 provider 的 `baseURL`。

## 隐私与安全

> [!WARNING]
> 口令、token 与隧道 cookie 存在 `$DSH_HOME/.credentials.yaml`，**明文 YAML**；本地传输层**不做鉴权**，只监听 `127.0.0.1`。

同主机上能访问 `43110` 端口的程序都可以借用你的 token。不能接受这个取舍，就不要在该 profile 里配置口令。

## 已知限制

- 二次验证需要人工完成一次，之后依赖学校对可信设备的豁免。
- 隧道空闲约 2 小时失效，`keepaliveMs` 不要设得比它长。
- 模型能力、工具调用兼容性与上游协议细节沿用 madmodel-proxy，不在本插件范围内。

## 开发

```sh
npm install --no-save --legacy-peer-deps esbuild tsx
node build.mjs          # 生成 lib/index.js（Host）与 lib/client.js（Web）
node node_modules/tsx/dist/cli.mjs checks/host-smoke.ts
node node_modules/tsx/dist/cli.mjs checks/policy-smoke.ts
node node_modules/tsx/dist/cli.mjs checks/client-smoke.ts
node node_modules/tsx/dist/cli.mjs checks/transport-smoke.ts
```

这些检查使用模拟认证响应与本机假网关，不需要真实账号。近期修复的本地检查与布局证据见 [LOG.md](LOG.md)，用户可见变更见 [CHANGELOG.md](CHANGELOG.md)。

本地调试时用 profile 的 `link:` 依赖指向本目录，改完重启 DSH。

## 反馈

遇到问题请开 [Issue](https://github.com/aaabrli/dsh-thu-automad/issues)。贴日志前请删掉 token、cookie 与学号。

## 致谢

- **[aaabrli](https://github.com/aaabrli)** —— 原始 `dsh-thu-automad`（v0.1.0）的作者；认证链、失败策略与设置页的基础来自这里。
- **[madmodel-proxy](https://github.com/noroadback/madmodel-proxy)** —— 认证链、WebVPN 隧道前缀与 cookie 处理的知识来源（`vendor/` 为其字节副本）。
- **thu-tok-auto** —— 直连 SSO 路径的实测参数与 NO_PROGRESS 判定。

## 许可

MIT，见 [package.json](./package.json)。
