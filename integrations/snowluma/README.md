# SnowLuma OneBot 11

本接入层通过 HTTP 协议对接独立部署的 SnowLuma，不打包其源码、程序或原生组件。部署前请核对 [SnowLuma v2.4.0 许可](https://github.com/SnowLuma/SnowLuma/blob/v2.4.0/LICENSE)：它采用源码可见非商业许可，不是 OSI 开源许可；商业用途和再分发应按上游条款另行评估。

适配依据为本地核对的 SnowLuma v2.4.0 官方源码：`packages/onebot/src/config.ts`、`types.ts` 和 `network/http-post-adapter.ts`。本工具不下载、不安装、不启动 SnowLuma。

配置使用 `mode: snapshot` 和 `networks.httpServers/httpClients/wsServers/wsClients`；网络项使用 `enabled`、`accessToken`、`messageFormat: string`，不是 NapCat 的 `network/enable/token`。

## 生成配置

在单独准备的 ChatDACS YAML 中指定 `System.ONE_BOT_PROVIDER: snowluma`、`ONE_BOT_API_URL`、`ONE_BOT_ANTI_POST_API` 和 `WEB_PORT`。SnowLuma 未指定 API 地址时使用 `127.0.0.1:3000`。可用 `System.ONE_BOT_CREDENTIALS_FILE` 指定凭据文件，内容为带 `accessToken` 字段的 JSON；相对路径始终相对于进程 cwd，与主程序一致，默认 `config/onebot.credentials.json`，不相对于 YAML 所在目录。也可使用环境变量 `CHATDACS_ONEBOT_ACCESS_TOKEN`。环境变量优先，空值或非法值不会回退。必须事先填入真实 token，工具不生成 token，也不以占位符代替认证。

```powershell
node scripts/generate-onebot-config.js --config C:\private\chatdacs.yml --provider snowluma --output C:\private\snowluma.credentials.json
```

输出目录必须预先存在且由本人控制。输出必须以 `.credentials.json` 结尾，独占创建，拒绝覆盖已有文件。POSIX 权限为 `0600`；Windows 在写入 token 前移除继承权限并仅授权当前用户。设置权限失败即终止，不写入 token。该后缀受仓库 `.gitignore` 和发布包文件过滤器保护；不要强制加入 Git 或手工放入发布包。CLI 仅输出固定状态码，不输出 token、生成内容或输出路径。

生成文件需由操作者按 SnowLuma 的每账号配置流程放置为 `config/onebot_<uin>.json`；`snapshot` 避免继承全局默认监听项。此步骤属于独立部署，不由本工具执行。HTTP API 监听只支持 `http`，默认应使用 loopback；跨机部署需另行安排网络访问控制及加密隧道。

## 只读检查

```powershell
node scripts/check-onebot.js --config C:\private\chatdacs.yml --provider snowluma
```

该命令会实际请求配置中的服务，只能在明确授权后执行。它检查版本身份、OneBot 11、`get_login_info` 的账号和 `get_status` 的在线及链路健康状态，通过后才读取群数量。配置 `System.ONE_BOT_SELF_ID` 可要求登录账号与回调账号一致；不输出账号或群详情。退出码 `0` 表示这些检查通过，`1` 表示参数、配置、鉴权或就绪检查失败；不代表收发消息验收通过。模块被 `require()` 时不会读取配置或请求服务。

启动 SnowLuma 适配器时也会校验账号和在线状态。检查失败时 QQ 群服务与主动聊天不会启动，Web 与其他平台继续运行。请先恢复 SnowLuma，再重启 ChatDACS 重新初始化 QQ 适配器。

SnowLuma HTTP 回推使用 `X-Signature: sha1=...`，签名覆盖原始请求体，由 ChatDACS webhook 的 raw-body HMAC 路径验证；此处不另设 Bearer 回推认证。旧 NapCat helper 的入口和探测参数保持兼容，全部委托 generic provider，统一使用鉴权、超时、禁止重定向及安全错误码。

受限的 `tmp/napcat-standalone/chatdacs-acceptance.js` 不是完整运行入口；生成配置、mock/loopback 测试或就绪检查均不能替代全功能部署与真实聊天验收。
