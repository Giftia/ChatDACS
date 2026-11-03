# 官方 QQ 机器人接入

ChatDACS 使用 `@tencent-connect/qqbot-connector@1.2.0` 扫码绑定，
使用 `@tencent-connect/qqbot-nodejs@1.0.5` 收发消息。两者也是腾讯
[`dsh-qqbot`](https://github.com/tencent-connect/dsh-qqbot) 使用的官方组件。
消息仍由小夜、ChatDACS 插件和聊天核心处理。

## 环境

源码部署以项目根目录 `.nvmrc` 为准，当前固定为 Node.js `26.13.0`；切换版本后在隔离候选目录运行 `npm ci`，不要沿用旧 Node 18/24 的 `node_modules`。平台构建和验收边界见 [升级指南](../../UPGRADE.md)，版本更新不代表官方账号收发已经通过。
SDK 通过动态 import 加载到同一个 ChatDACS 进程，不需要 DSH、独立网关或公网回调端口。
需要网络访问 QQ 官方 API 与 WebSocket Gateway，以及有相应权限的官方机器人应用。

## 绑定

```bash
npm run qq:official:bind
```

用手机 QQ 完成扫码。命令将凭据保存到 `config/qq-official.credentials.json`，不会输出密钥。
二维码过期刷新由官方 Connector 负责；`Ctrl+C` 取消。首期一次只接受一个机器人应用。
Linux / macOS 文件权限为 0600；Windows 应保持凭据目录仅部署用户可读。
凭据文件是本地私密配置，不要上传、分享或复制到公共静态目录。

手动配置可以同时注入 `QQBOT_APPID` 和 `QQBOT_SECRET`；两者优先于文件，缺少其中一个会报错。
自定义文件可使用 `npm run qq:official:bind -- --file /private/bot.credentials.json`，
同时在下方 `credentialsFile` 中设置相同路径。源码与运行包均从项目根目录解析相对路径。

## 启用

在现有 `config/config.yml` 对应位置加入：

```yaml
System:
  CONNECT_QQ_OFFICIAL_SWITCH: true

qqOfficial:
  credentialsFile: 'config/qq-official.credentials.json'
  pluginAllowlist: ['ping', 'help']
  access:
    c2cMode: 'open'
    c2cAllow: []
    groupMode: 'open'
    groupAllow: []
```

运行 `npm run dev`。日志显示“QQ官方机器人已连接”后再进行真实消息验收。
只用官方通道时，可关闭 `CONNECT_ONE_BOT_SWITCH` 和 `GO_CQHTTP_SWITCH`。
`open`、`allowlist`、`disabled` 控制访问；白名单填写原始用户或群 openid，不能填写普通 QQ 号。
错误模式值按 disabled 处理；未绑定或官方连接失败不会阻断 Web 和其他平台。

## 已实现范围与限制

支持私聊文本、群 @ 文本、文本回复和 HTTPS 图片回复；图片是否可发送取决于机器人授权。
默认只开放已核验的 `ping` 和 `help`；`pluginAllowlist` 使用插件文件名，不带 `.js`。
扩展列表前应逐项检查插件是否依赖 OneBot、CQ 码、数字 QQ 号或平台管理接口。
官方通道的 `/help` 只列出被允许的插件；匹配到受限插件返回明确提示，不执行其操作。
群消息必须 @ 机器人；不会把普通群消息当作向小夜提问。

原 QQ 的禁言、戳一戳、地雷、伪造转发、群成员查询和 CQ 消息段不属于本通道能力。
官方 openid 与 OneBot QQ 号严格隔离，私聊、群和不同 AppID 也分别保存插件开关。
支持 `插件开 连通性测试插件` / `插件关 连通性测试插件` 的旧式切换命令；与原行为一致，
开/关字样都会切换当前状态，回复会明确报告开启或关闭；此版本没有新增管理身份授权模型。

暂不支持 Agent 工具执行、主动推送、流式输出、语音转码和任意本地文件发送。
文字每块最多 1500 Unicode 字符，最多两块，超过部分截断并提示；不会为绕过限额改用主动消息。
同一会话串行，最多排队 3 条；全进程最多接纳 64 条在途消息。
每用户每分钟 12 条、每群 30 条、全局 60 条；超量消息会被拦截并记录日志。
SDK 进行进程内去重；重启后的持久化事件去重尚未实现。
插件沿用软超时，普通聊天上限 12 秒；迟到结果不再发送。
发送失败不自动重放插件操作或发送第二条错误消息，避免未知状态造成重复动作。

## 回归与真实验收

如果新鉴权返回 100016，但同一应用的旧 QQ 频道仍正常，请按本页的
[绑定](#绑定)和[启用](#启用)指南核对凭据来源、应用身份与场景权限。不要反复寻找控制台没有的 Token 字段，
也不要将旧频道成功当作 QQ 单聊 / 普通群聊通过。现有 QQ Guild 路径可以独立保留；
新官方 SDK 仍须成功换取 access token。

```bash
npm run verify:release
```

该命令包含真实官方 SDK 中间件的离线 smoke，覆盖私聊插件、聊天兜底、去重和群 @。
测试不读取真实机器人凭据、不连接 QQ，也不改动现有数据库。
扫码后还需在授权的测试私聊和群里验证 `/ping`、`/help`、普通聊天、图片、断线恢复与访问白名单。
离线通过不代表官方账号授权、真实网络和收发已经通过。

停止 ChatDACS 并删除本地凭据只会取消本地连接；上游应用授权撤销需在官方平台处理。
