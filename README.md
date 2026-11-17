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
  <a href="#开发">开发</a>
</p>

---

## 功能

- 登录清华统一认证，自动续期 MadModel 令牌，支持校园直连和 WebVPN。
- 按模型显示在途数、并发上限和排队数，满额后自动等候。
- 任一可用模型均可完成续期校验，模型故障显示在对应行。
- 流式返回模型内容，取消对话时释放队列和上游连接。

## 安装

在 DSH 的「插件 → 添加插件」中输入本仓库地址，或在命令行安装。

~~~sh
dsh plugin --profile desktop add github:aaabrli/dsh-thu-automad
~~~

Web profile 使用 `--profile web`。安装或更新后完整退出并重新启动 DSH。

## 使用

1. 打开「设置 → 清华 MadModel」，填写学号和统一认证口令，点击「立即续期」。
2. 首次校外登录时完成二次验证，可选择登记为可信设备。
3. 在输入框的模型菜单中选择清华模型。
4. 点击输入框下方的「清华 MadModel」查看令牌、通道和各模型并发。

| 模型 | 默认并发上限 |
| --- | ---: |
| DeepSeek-V4.1-Flash | 3 |
| qwen3.8-27b | 4 |
| DeepSeek-R1-W8A8 | 1 |

空槽直接发送，满额后按到达顺序排队。自动标题使用富余槽位。状态卡中的 `+N` 表示排队数，「等首包」表示请求已发出、正在等待模型数据。

## 配置

默认配置随插件安装。可在 profile 的 `cordis.patch.yml` 中调整传输设置。

~~~yaml
transport:
  enabled: true
  mode: auto
  port: 43110
  keepaliveMs: 1200000
  concurrency:
    max: 3
    perModel:
      qwen3.8-27b: 4
      DeepSeek-R1-W8A8: 1
    queueLimit: 32
    maxWaitMs: 0
~~~

`mode` 可选 `auto`、`direct`、`webvpn`。`maxWaitMs: 0` 表示持续等候，直到获得槽位、取消请求或 DSH 的请求预算结束。修改端口时同步更新 provider 的 `baseURL`。

## 工作方式

DSH 的 `tsinghua` provider 连接 `http://127.0.0.1:43110/v1`，插件使用当前令牌转发到校园网关或 WebVPN。网络探测和自动续期在后台运行，发出的请求读取当前令牌。

令牌默认提前一小时续期。续期先用 `verifyModel` 校验，默认 Flash，首选模型故障或迟迟无响应时会启用其他模型。任一模型返回有效结果即可激活新令牌。各模型都不可达时保留候选，按计划重试校验。

WebVPN 默认每 20 分钟保活。切换网络后，登录跳转会触发通道重新判定和会话恢复。网关返回 429 时保留原队列位置，按 `Retry-After` 等候；有请求完成后使用释放的槽位。

## 数据位置

学号、口令、令牌和 WebVPN 会话由 DSH 凭据服务存储，默认文件为 `$DSH_HOME/.credentials.yaml`。该文件使用明文 YAML。本地转发监听 `127.0.0.1`，同机应用可访问这一端口。

## 开发

~~~sh
npm install --no-save --legacy-peer-deps esbuild tsx
npm run build
npm run check:host
npm run check:policy
npm run check:client
npm run check:transport
~~~

构建产物为 `lib/index.js` 和 `lib/client.js`。行为检查使用模拟认证和本地网关。TypeScript 检查使用 DSH 宿主类型声明，可通过 `npm run typecheck` 执行。

发布包包含 `src/`、`lib/`、认证库 `vendor/`、插件清单和配置。版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## 致谢

- [aaabrli](https://github.com/aaabrli) 提供原始插件。
- [madmodel-proxy](https://github.com/noroadback/madmodel-proxy) 提供认证链和 WebVPN 实现。
- thu-tok-auto 提供直连 SSO 参数。

## 许可

MIT，见 [package.json](package.json)。
