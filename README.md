# dsh-thu-automad

清华 madmodel 网关的**凭据自动化**插件：盯 token 有效期、到期自动重新登录、失败时按规则决定下一步。

## 致谢

这个插件站在两个项目上面：

- **[madmodel-proxy](https://github.com/noroadback/madmodel-proxy)**（v1.10.3）—— 本插件的认证链是它的 `madmodel-auth.js` 与 `sm2.js` 的**字节相同副本**（`vendor/madmodel/`，附 sha256）：SM2 加密提交口令、`doubleAuth` 二次验证握手、ticket 换 token、WebVPN 隧道前缀推导，全部来自它。
- **thu-tok-auto**（v0.3.6）—— 直连取票路径的钥匙来自它：`SSO_APP`（`md5('DEEPSEEK')`）与 SSO 表单地址、token 寿命 6 小时的实测值，以及"拿到同一张令牌不算续期成功"这条判定（本插件的 `NO_PROGRESS`）。

## 主要功能

- **盯有效期** —— 解码 JWT 的 `exp`，输入框下方的药丸显示剩余时间；被网关拒绝立刻标红。可选定时探活。
- **自动续期** —— 提前一小时用存的学号 + 统一认证口令重新登录，把新 token 写回同一个凭据引用（`TSINGHUA_API_KEY`），provider 的下一次请求自动用上。
- **无人值守窗口** —— 首次登录的二次验证在弹窗里完成；勾选"登记为可信设备"后，学校对这台设备的豁免约半年，token 每 6 小时自动换一次。
- **失败策略** —— 有序规则表决定一次失败的请求接下来做什么：`retry` / `switch` / `ask` / `fail`，以及本插件新增的 `renew`——**先续期，成功就用新 token 重连这次请求**，失败才走 `onFailure`。
- **设置页** —— 学号与口令就地填写，写入 `$DSH_HOME/.credentials.yaml`；token 状态、续期相位、立即续期按钮在同一页。

## 安装


```sh
dsh plugin --profile web add github:OWNER/dsh-thu-automad   # 把 OWNER 换成你的 GitHub 用户名
```

bundle 层会连 `tsinghua` provider 路由一起写进 composition，装完 **设置 → 模型** 里就有「清华 DeepSeek」，不需要手写配置。然后打开 **设置 → 清华 MadModel**，填学号、填统一认证口令，各保存一次；本机第一次登录时，下一次续期会弹二次验证对话框。

> 首次让浏览器半边生效需要重启一次 `dsh web`——客户端扫描会把"这个包有没有 `dsh.client`"的结论缓存到进程结束。

从 checkout 开发时，宿主半边走源码：

```sh
pnpm dsh web --patch ./thu-automad/dev.overlay.yml
cd thu-automad && ../node_modules/.bin/tsdown --watch   # 改了 src/client/ 要重新构建
```

全部配置字段与规则语义，见包内 `cordis.patch.yml` 的注释和 `src/config.ts` 的默认值。

## 隐私

口令与 token 存在 `$DSH_HOME/.credentials.yaml`，**明文 YAML**，保护手段只有文件权限（`0600`，同目录 `0700`）与跨进程文件锁——**没有 Keychain、没有加密**。状态接口只回传状态与时间戳，不含 token、学号、口令或设备指纹。这个取舍不可接受，就不要在这个 profile 里配置口令。

## 验证

```sh
cd thu-automad && pnpm run check     # 类型检查 + 构建 + 三个离线 smoke
```
