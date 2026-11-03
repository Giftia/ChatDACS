# NapCatQQ 接入 ChatDACS

ChatDACS 将 NapCatQQ 作为推荐的 QQ OneBot 11 实现。NapCatQQ 需要独立安装和运行；ChatDACS 发布包不会捆绑或修改 NapCatQQ、NTQQ 或 QQ 登录数据。

## 前置条件

- ChatDACS 与 NapCatQQ 运行在同一台可信主机，或两者之间有受控的私有网络。
- NapCatQQ 已登录机器人 QQ 账号。
- `config/config.yml` 中 `CONNECT_ONE_BOT_SWITCH` 为 `true`，`ONE_BOT_PROVIDER` 为 `napcat`。

## Windows 独立账号

NapCat 使用普通 QQ 账号，不使用官方机器人的 AppID / AppSecret。建议使用独立账号，
注意非官方接入的账号风控风险，不要在验收时替换日常 QQ 的登录数据。
本机已验证官方发布的 `NapCat.Shell.Windows.Node.zip` v4.18.42：包含独立 Node 和 QQ 内核，
无需修补或升级当前桌面 QQ。下载后应核对官方 release asset 的 SHA-256。

启动前设置仅该进程生效的 `NAPCAT_QQ_DATA_DIR` 和 `NAPCAT_WORKDIR` 到独立目录，
保留其中的账号数据与配置；WebUI 的 `host` 设置为 `127.0.0.1`，使用非默认密码。
首次扫码登录后，再按下文启用 OneBot HTTP 服务。不要运行终止所有 QQ 进程的辅助脚本。
安装包以 [NapCat 官方发布页](https://github.com/NapNeko/NapCatQQ/releases) 为准。

## 生成 OneBot 配置

预先创建并限制访问 `C:/private/` 目录，再在 ChatDACS 根目录运行统一 CLI：

```bash
npm run qq:onebot:config -- --config config/config.yml --provider napcat --output C:/private/napcat.credentials.json
```

如果 ChatDACS 在容器中运行，将事件回调主机改为 NapCat 能访问的名称：

```bash
npm run qq:onebot:config -- --config config/config.yml --provider napcat --event-host host.docker.internal --output C:/private/napcat.credentials.json
```

统一 CLI 仅独占创建私密输出，拒绝覆盖已有文件；输出目录必须已存在。配置 token 时，生成文件也包含 token，不要加入 Git、发布包或公共静态目录，也不要强制绕过 `.credentials.json` 的忽略与打包过滤。

将生成文件的 `network` 配置合并到 NapCat 的 `onebot11.json`，或在 NapCat WebUI 中建立等价配置：

- HTTP Server：`127.0.0.1:5700`，用于 ChatDACS 调用 OneBot API。
- HTTP Client：`http://127.0.0.1/bot`，用于 NapCat 上报事件。
- 消息格式必须选择 `string`，以保留 ChatDACS 现有 CQ 码行为。
- 不启用 WebSocket。

NapCat 不在线或探测失败时，ChatDACS 会记录警告并继续提供 Web 与其他平台服务。NapCat 恢复后需要重启 ChatDACS，QQ Adapter 才会重新执行群列表初始化。

## 安全边界

公共 OneBot sender 对每个查询参数分别编码，回复中的 `&`、`#`、`+` 和 CQ 码不应改变收件人或截断文本。
该行为有离线回归覆盖；不能直接用 `encodeURI` 编码整段参数值。

共享 HTTP client 已支持 scoped Bearer：仅向配置的 OneBot API origin 和基路径注入 token，不向其他服务注入，并禁止跟随重定向。token 可由 `CHATDACS_ONEBOT_ACCESS_TOKEN` 或 `System.ONE_BOT_CREDENTIALS_FILE` 指定的私密 JSON 文件提供；文件使用 `accessToken` 字段，默认路径为 `config/onebot.credentials.json`。环境变量优先，显式空值或非法凭据不会静默回退。

回调支持以同一 token 对原始请求体计算 HMAC-SHA1 的 `X-Signature: sha1=...`，也兼容仅使用 `Authorization: Bearer ...` 的回调。若提供了签名，签名必须有效，不能用 Bearer 绕过无效签名。未配置 token 的旧 NapCat 部署仍兼容，但应限于可信回环环境。

即使启用鉴权，API 仍建议只监听 loopback，不要把 `5700` 端口直接暴露到公网。跨机部署需配置 TLS 或加密隧道及访问控制；Bearer 和 HMAC 不替代传输加密。

## 验收

先验证私聊和测试群的 `/ping`、普通聊天，并对照入站、插件或聊天核心、
OneBot `status=ok / retcode=0` 及手机实际收到四层证据。接口成功不等于手机送达。
基础文本通过后，再逐项开启管理插件、媒体和群玩法，不能把基础聊天通过视为全功能等价替换。
正常 QQ 处理器包含好友审批、入群通知和群管理行为；仅关闭随机聊天概率不能阻止这些动作。

1. 先启动 NapCatQQ，再启动 ChatDACS。
2. 运行 `npm run qq:napcat:check`，确认 `compatible`、`loggedIn` 为 `true`，且 `groupCount` 符合测试账号实际加入的群数。
3. 确认 ChatDACS 日志出现 `NapCat OneBot 11 已连接`。
4. 在测试群发送 `/ping`，确认机器人回复 `Pong!`。
5. 发送普通消息，确认插件和小夜聊天回复均可用。
6. 停止 NapCatQQ，确认 ChatDACS Web 页面仍可访问；重新启动 NapCatQQ 和 ChatDACS 后再次测试群消息。

`GO_CQHTTP_SWITCH` 仅用于旧部署兼容。启用它会覆盖 `ONE_BOT_PROVIDER` 并继续启动发布包中的旧 go-cqhttp。

## 方案说明

ChatDACS 继续使用 OneBot 11 HTTP，是为了兼容现有 QQ 处理器和插件返回格式。NapCat 官方同时支持 HTTP Server、HTTP Client 和 WebSocket；本阶段启用带上述鉴权边界的 HTTP API 与事件回调链路，不启用 WebSocket transport。

- [NapCatQQ 项目](https://github.com/NapNeko/NapCatQQ)
- [NapCat 网络配置文档](https://github.com/NapNeko/NapCatDocs/blob/main/src/onebot/network.md)
- [NapCat 基础配置文档](https://github.com/NapNeko/NapCatDocs/blob/main/src/config/basic.md)
- [QQ provider 选型记录](./SELECTION.md)
