# DSH-thu-automad

清华 MadModel 的 DSH 插件：自动续期校园 token，校内直连、校外走 WebVPN 隧道，模型请求经本地回环地址转发。

## 功能

- **自动续期** —— 提前 1 小时用学号 + 统一认证口令重新登录，新 token 写回 `TSINGHUA_API_KEY`；剩余 30 分钟时输入框下方的状态药丸转琥珀色。
- **校内 / 校外** —— 校内直连换票；校外走 统一认证 → WebVPN 会话 → 隧道内换票，模型请求随隧道 cookie 转发。
- **本地传输层** —— provider 指向 `127.0.0.1:43110/v1`，插件按当前网络自动选择直连或隧道；SSE 边收边转。
- **并发排队** —— 网关按模型限流，超出的请求在本地排队，429 冷却后重发同一个请求，不换模型、不打断对话。
- **失败策略** —— 有序规则表决定一次失败之后做什么：`renew` / `retry` / `switch` / `ask` / `fail`。
- **设置页与状态卡** —— 概览、模型与并发、连接三个区块；状态药丸点开是令牌、通道与队列摘要。

## 安装

```sh
dsh plugin --profile web add github:aaabrli/dsh-thu-automad
```

也可以在 DSH 的插件面板里添加本仓库地址。装完重启 DSH 桌面端。

bundle 自带 provider 行（`清华 DeepSeek` → `tsinghua`，`baseURL: http://127.0.0.1:43110/v1`），无需手写；只有改端口时需要同时改 `transport.port` 和该 `baseURL`。

## 配置

`cordis.patch.yml` 中本插件的 `config`，省略即用默认值：

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

## 使用

1. 设置 → 清华 MadModel，填学号与统一认证口令，点「立即续期」。
2. 首次校外登录按提示完成二次验证；勾选「登记为可信设备」后，学校对这台设备的豁免约半年。
3. 输入框下方药丸显示当前通道：`校园直连` / `WebVPN 隧道`。

## 工作方式

```
provider 行 ──> http://127.0.0.1:43110/v1 ──┬─ 校内：https://madmodel.cs.tsinghua.edu.cn/v1
   （DSH）        （本插件，仅回环）          └─ 校外：https://webvpn.tsinghua.edu.cn/https/<hash>/v1
```

- **网络判定**：`mode: auto` 时用未认证 GET 探测直连域名，返回应用页面即校内、返回 3xx 即校外；结论缓存 5 分钟。
- **隧道保活**：WebVPN 会话空闲约 2 小时失效，默认每 20 分钟探活一次；失效则重跑登录链。
- **失会话重试**：转发遇到 3xx 时触发一次重登（20 秒冷却），并用同一个已缓冲的请求体重试一次。

## 并发与排队

网关按模型限制同一账号的在途 completion 数（实测 Flash 3、Qwen 3.8 4、R1 1），插件不超发：

- 每个模型维护自己的在途上限；超出的请求留在本地队列，不发给上游。
- 429 不抛给对话：该请求放回队列，该模型进入冷却（5s 起、翻倍、上限 120s，有 `Retry-After` 就按它等），结束后重发同一个请求。
- 流式请求等待超过 20 秒后先回 SSE 注释行保活，槽位一到继续写同一条流。
- 队列上限 32 条；对话取消或客户端断开时立刻释放该请求的并发槽。

## 常见问题

**排队会等到什么时候？** 默认不设插件侧上限（`maxWaitMs: 0`），等到有槽位或你取消为止。真正的超时上限是 provider 行的 `timeoutMs` 与 `streamIdleTimeoutMs`（bundle 里都是 1 小时），想更早放弃就调小它们。

**切换 Wi-Fi 或代理后第一次请求失败？** WebVPN 会话与来源网络绑定，插件会自动重登一次；仍失败则按失败规则进入 `needs-human` 或 `error`。

**状态卡显示「本地端口未监听」？** 端口被占用，传输层没起来；换端口时同步改 provider 的 `baseURL`。

## 隐私与安全

口令、token 与隧道 cookie 存在 `$DSH_HOME/.credentials.yaml`，明文 YAML，靠文件权限（`0600`）与跨进程文件锁保护。本地传输层不做鉴权，只监听 `127.0.0.1`——同主机上能访问该端口的程序都可以借用你的 token。不能接受这个取舍，就不要在该 profile 里配置口令。

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

本地调试时用 profile 的 `link:` 依赖指向本目录，改完重启 DSH。

## 致谢

- **[aaabrli](https://github.com/aaabrli)** —— 原始 `dsh-thu-automad`（v0.1.0）的作者；认证链、失败策略与设置页的基础来自这里。
- **[madmodel-proxy](https://github.com/noroadback/madmodel-proxy)** —— 认证链、WebVPN 隧道前缀与 cookie 处理的知识来源（`vendor/` 为其字节副本）。
- **thu-tok-auto** —— 直连 SSO 路径的实测参数与 NO_PROGRESS 判定。

## 许可

MIT，见 [package.json](./package.json)。