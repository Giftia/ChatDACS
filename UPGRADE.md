# ChatDACS v3.7 升级指南

本文说明从 ChatDACS v3.7 替换到当前模块化运行时的已验证路径。

## 升级前

1. 停止 ChatDACS 和 go-cqhttp。
2. 将现有 `config/config.yml` 和 `config/db.db` 复制到 ChatDACS 安装目录之外的备份目录。
3. 在新版通过 Web 和平台验收前，保留旧版完整目录。

不要覆盖 `db.db` 的唯一副本。新版会在开放 Web 服务和平台 Adapter 之前执行数据库迁移。

## 替换 v3.7

1. 将新版运行包解压到新目录。
2. 把备份的 v3.7 `config/config.yml` 和 `config/db.db` 复制到新版的 `config/` 目录。
3. Windows 运行 `ChatDACS.cmd`，Linux 和 macOS 运行 `./chatdacs`。
4. 等待日志显示数据库迁移和插件加载完成。

运行时会自动兼容以下 v3.7 配置键，不要求升级前手工改写配置：

- `CONNECT_GO_CQHTTP_SWITCH`
- `GO_CQHTTP_SERVICE_ANTI_POST_API`
- `GO_CQHTTP_SERVICE_API_URL`

新旧配置键同时存在时，以当前配置键为准。

## 验收检查

- 打开 Web 控制台，确认首页正常返回。
- 发送 `/ping`，确认回复为 `Pong!`。
- 发送普通聊天消息，确认小夜返回非空回复。
- 如果启用了 OneBot，确认 webhook 返回 HTTP `204`，群消息仍通过配置的 API 地址发送。
- 确认启动日志中没有迁移失败、插件初始化失败或未处理进程异常。

已复现的 Web 入口问题已修复并完成对应复验。Node.js `26.13.0` 曾用于本地受限 QQ 验收入口，普通收发有此前的手机端确认；主动发送的 OneBot 成功回执不等于手机送达。截至 2026-11-04，用户已批准完整 `index` 接管本机 QQ，但 NapCat 与验收进程均未运行，本轮部署和真实收发验收尚未完成。隔离 smoke 或历史受限入口结果都不能作为本轮上线结论；云端仍有待修项，见下表。

## 异常通知配置

旧版硬编码的异常通知群已移除。`System.ERROR_NOTIFY_GROUP_ID` 是可选的纯数字群号字符串，YAML 中需加引号；未配置时规范化为 `undefined`，不发送异常群通知。只有显式配置且启用 OneBot 时才发送，不会因为 `QQBOT_ADMIN_LIST` 已配置而自动选择群。

通知仅包含 `系统处理失败 (固定安全code)`，例如 `PROCESS_UNHANDLED_REJECTION`，不携带异常正文、stack 或用户消息；通知失败也不会阻断错误处理。不要用真实错误内容测试外发，先在 mock 中验证配置和载荷。

## Web Session 与上传行为

`ChatdacsID` cookie 与现有 socket 事件名保持不变。连接在异步读取用户资料前注册一次性断线清理；初始化期间断线后，不再欢迎、新建用户或注册后续事件，在线人数只释放一次。插件已经处理消息时，即使返回空内容，也不会再由普通聊天生成第二条回复；未处理的消息才进入聊天兜底。

浏览器精确读取 `ChatdacsID`，不再将整个 `document.cookie` 当作 CID，其他 cookie 不再阻断初始化或造成自己的消息双显；percent decode 与服务端 `cookie.parse` 一致，非法编码保留原值，缺失、空值和保留机器人 ID `'0'` 视为缺失并重建。CID 只是匿名用户标识，不是鉴权或授权凭据，本轮没有建立新的登录体系；此修复已有 actual callback 测试覆盖。

HTTP 端口占用 `EADDRINUSE` 保留 10 秒重试，但不再调用 `close()` 误触发适配器和进程错误监听清理；重复错误只保留一个定时器。权限错误报告 `HTTP_LISTEN_FORBIDDEN`，其他监听错误报告 `HTTP_LISTEN_FAILED`，均不自动重试。显式最终关闭仍由 index 执行 dispose/stop，并取消待执行的重试。

`/upload/image` 与 `/upload/file` 继续使用 multer，异步重命名后返回 HTTP `201` JSON：`{code: 0, data: {src, name}}`。`name` 统一经过 `static/uploadMedia.js` 的安全显示名处理，将可能参与 LayIM 语法或 HTML 扩展的方括号、括号、引号、尖括号、`&`、`@`、路径分隔符和控制/格式字符等替换为下划线，空名称回退为 `file`；不能直接把原始文件名放进 LayIM 的 `file(url)[name]` 标记。缺文件返回 `400`，非法图片返回 `400`，保存失败返回 `500`；若 multer 配置产生文件超限错误，返回 `413`。本次没有新增文件大小上限，不应把该行为当成资源配额保护。

图片接口只接受允许列表内的光栅图片扩展名和非 SVG/XML/HTML 的 `image/*` MIME，拒绝可执行图片格式；不进行图片内容解码鉴真。普通文件接口仍可上传这些文件，但静态访问会强制附件下载，设置 `application/octet-stream`、`X-Content-Type-Options: nosniff` 和 CSP sandbox。常见图片和音视频保留内联展示，不记录 `req.file` 或聊天正文。

上传接口不再独立广播 `picture` / `file` / `video` / `audio`，只由 LayIM 的 `code: 0` 成功回调自动发送普通 socket `message`，避免 HTTP 上传广播与客户端消息双显。纯上传标记消息仍入库并广播一次，但不执行插件或普通聊天。混合文本、外部地址或不合法标记不走这条纯上传快捷路径。

应用层 parser 包装仅将严格匹配本机 `/uploads/`、32 位十六进制随机文件名、允许扩展名和安全显示名的音视频 `file(url)[name]` 转换为原有 `audio[url](name)` / `video[url](name)` 播放器语法，使发送端和接收端保持媒体播放能力；不修改第三方 LayIM 源码，不对任意外部文件标记进行转换。

上传链路已通过定向测试、真实 LayIM parser 与 Chrome DOM 检查：已测恶意文件名未产生可执行 DOM 节点，音视频播放器正常。该结论针对已测上传样例，不等于所有 Web 输入的 XSS 风险均已消除。

## Web 统一渲染边界

`static/renderSecurity.js` 在 LayIM 标记展开后净化最终 HTML，不能只在展开前过滤输入。DOMPurify 固定为 `3.4.17`，由应用通过同源 `/vendor/purify.min.js` 路由提供本地依赖文件，不从 CDN 加载；该 URL 不表示需要额外手工复制到 `static/vendor/`。依赖缺失、不受支持或净化抛错时，回退为转义后的文字，不直接插入未经净化的 HTML。

消息昵称单独转义；typing 和在线状态使用文本节点；settings 的昵称与 CID 在插入带引号的表单值前转义。这些边界不依赖聊天正文的 HTML 净化。用户显示内容中的 `style`、`id`、`name`、普通事件属性及可执行/表单类标签不再接受，但代码、引用、表格等排版、图片和音视频继续保留；应用自身的静态表单不受此显示内容规则影响。

媒体 URL 的危险分隔符在保存到 `src` / `href` / `poster` / 播放器 `data-src` 前安全序列化，防止 LayIM 的 `playVideo`、图片双击与放大预览再次拼 HTML 时发生二次注入。只有经验证的音视频控制节点保留必要的 `layim-event` 和 `data-src`。已验证的 base64 图片、相对与协议相对音视频地址仍可使用，不应简单禁掉所有媒体或以字符串拼接绕过该边界。

统一渲染边界已有定向测试及独立 DOM 复验，属于离线验证，不是线上服务或全部输入均安全的承诺。main 依赖注入、`WEB_HOST`、正常路径、单平台降级与默认日志策略也已有对应测试覆盖。

## Windows 托盘通知

用户触发的通知不再把正文拼进 shell 命令，而是使用 `execFile('msg.exe', [username, 'ChatDACS: ' + text], options, callback)` 传入 Unicode argv，不经过 shell 或额外管道编码。系统消息正文增加固定 `ChatDACS: ` 前缀，避免用户文本被当作 msg.exe 的 `/server` 等选项；托盘通知仍显示原文。此变化仅描述用户通知链路，不表示所有托盘菜单命令都已改为 execFile。

当前源码及 mock 断言已包含 `windowsHide: true`、`timeout: 5000` 和 `maxBuffer: 65536`；超时或发送失败仅记录固定安全 code，不回退到 shell，也不泄露 stdout/stderr 或原始异常。回复分别报告托盘、系统消息的完整/部分成功或失败，不把单一路径失败说成全部成功。mock 通过不代表实际桌面弹窗、Unicode 显示或线上操作已经验收。

## 真实入口隔离验证与停止范围

主入口已支持 `main({configPath, pluginDependencyOverrides, checkUpdates = true} = {})`，返回 `{http, io, stop}`。省略参数保持原配置、插件依赖和更新检查行为；传入插件依赖覆盖不会跳过真实 main、迁移或插件加载。`checkUpdates: false` 仅关闭更新检查，不能把含真实平台配置的运行自动变成离线测试。

源码完整入口支持在 ChatDACS 根目录运行：

```bash
node index.js --config /private/local.yml
```

Windows 可改用 `C:/private/local.yml`。此参数只选择配置文件，不改变 cwd；`ONE_BOT_CREDENTIALS_FILE` 的相对路径仍从 cwd 解析，不从 YAML 目录解析。使用独立 YAML 不需要覆盖原有 `config/config.yml`、`config/db.db` 或个人人设，也不代表数据库已自动隔离；测试隔离仍须遵守下文的数据库路径设置时序。

单个平台连接或启动失败时报告对应固定安全 code，保留 Web 和其他平台继续运行；不会自动切换 provider，也不会把该平台标记为已就绪。配置读取、数据库迁移或控制器契约错误不属于无条件忽略的降级范围。

默认 logger 只启用 Console 与两个本地文件 transport：cwd 下的 `error.log`、`combined.log`，不再默认通过 HTTP 向 `localhost:80` POST 日志。不需要为默认日志额外启动 HTTP 接收服务，也不能据此推断更新检查、聊天 provider 或平台网络均已禁用。

测试用 `CHATDACS_DB_PATH` 必须在 `require('./index')` 或任何数据库模块之前设置；Sequelize 在模块加载时固定 storage，之后再改环境变量不能隔离已建立的连接。`System.WEB_HOST` 可选，省略时保留原监听绑定，并不默认限制为 loopback。shadow smoke 固定 `127.0.0.1`、临时端口、独立 fixture 配置和数据库，替换托盘依赖并禁用更新检查，不使用真实账号配置。

`await stop()` 为幂等异步清理，纳管 QQ、official QQ、Guild、Bilibili、Telegram 控制器，以及 socket/HTTP、进程异常监听和 SQL 连接。Bilibili/TG 已新增 mock 关闭与停止后迟到任务禁止输出的覆盖；Guild 内嵌 OneBot 回复使用公共鉴权 HTTP client 与 URL 参数编码。真实平台登录、投递、重连和系统资源仍需分开验收。真实托盘以及自动拉起的 go-cqhttp 子进程不在该 stop 的纳管范围内，不能据此声称全进程、全平台都已安全退出。

`npm run smoke:startup` 已接入 `npm run verify:release`、CI production 和 bundle 验证，运行真实 main 的隔离 HTTP/会话、插件/聊天及 graceful stop 检查。该隔离入口不连接真实平台，不能作为正式全功能上线或全部外部资源已纳管的证明；本地受限 QQ 入口的收发确认也不能替代完整入口验收。六平台云端状态见下表，实际运行后再按 Actions 结果更新。

## 从 go-cqhttp 迁移到 NapCatQQ

go-cqhttp 已停止维护，新部署推荐使用外部运行的 NapCatQQ。迁移不会改变 ChatDACS 的插件协议、QQ群玩法或 CQ 码消息格式。

1. 保留旧 go-cqhttp 目录和登录数据作为独立回退，不要直接覆盖。
2. 安装并登录 NapCatQQ，确认其 WebUI 可访问。
3. 在 `config/config.yml` 中设置 `ONE_BOT_PROVIDER: 'napcat'`、`GO_CQHTTP_SWITCH: false`。
4. 保持 `ONE_BOT_API_URL: '127.0.0.1:5700'`，运行 `npm run qq:onebot:config -- --config config/config.yml --provider napcat --output C:/private/napcat.credentials.json`。
5. 按 [NapCatQQ 接入指南](./integrations/napcat/README.md) 将生成的网络配置合并到 NapCat。
6. 先启动 NapCatQQ，再启动 ChatDACS，完成群内 `/ping`、普通聊天和管理玩法验收。

生成前须创建并限制访问 `C:/private/` 目录。统一 CLI 仅独占创建私密文件，不覆盖已有输出；生成内容可能包含 token，不得加入 Git、发布包或公共静态目录。

共享 OneBot HTTP client 保留 scoped Bearer，回调保留原始请求体 HMAC-SHA1 签名并兼容 Bearer；无效签名不能用 Bearer 绕过。NapCat 与 SnowLuma 默认必须配置真实有效的 `accessToken`，包括回环部署。仅 provider 未声明、`external` 或旧 go-cqhttp 路径，在未设置 token 环境变量、未显式声明凭据文件且默认文件不存在时兼容旧无 token 模式；显式空值、不可读文件、非法 JSON 或无效 token 均拒绝回退。API 仍建议监听 loopback，跨机须配置 TLS 或加密隧道及访问控制，详见 [NapCat 安全边界](./integrations/napcat/README.md#安全边界)。`System.ONE_BOT_SELF_ID` 可校验入站回调的 `self_id`，拒绝账号不匹配的事件，不替代收发验收。

宿主 `wallpaper`、`tray`、`chatPush` 的执行与开关仅允许可信 QQ/NapCat（OneBot）事件中的 `QQBOT_ADMIN_LIST` 宿主管理员。普通群插件切换、群服务启停需群 `admin` / `owner` 或宿主管理员；私聊普通插件开关仅影响调用者本人的会话。公开游戏、语料和 LLM 人设查询不因此封禁；群管理员身份不等于宿主管理员身份。

如果需要暂时回退，停止 NapCatQQ，将 `GO_CQHTTP_SWITCH` 改回 `true` 并启动旧协议端。该开关优先于 `ONE_BOT_PROVIDER`。

## 回滚

停止新版运行时，回到旧版 ChatDACS 目录，并同时恢复升级前备份的 `config.yml` 和 `db.db`。不要把已迁移的数据库交给 v3.7 打开并视为回滚；必须恢复升级前的原始数据库副本。

## 运行包结构

当前构建配置将应用源码、生产依赖和 Node.js `26.13.0` 运行时一起打包。这里描述候选构建，不代表六平台新运行包已经发布。请保持目录完整：启动器、`runtime/`、`node_modules/`、`src/`、`plugins/`、`integrations/`、`migrations/`、`static/` 和 `config/` 共同构成一个可部署单元。

考虑到 Canvas 等原生依赖的 Windows ARM64 预编译支持，`win-arm64` 配置使用 Node.js `26.13.0` x64 和对应的 x64 原生依赖，目标是通过 Windows 11 ARM 的 x64 兼容层运行。包内 `release-manifest.json` 明确标记 `runtimeArch: "x64"` 和 `compatibility: "x64-emulation"`；不得将其描述为 ARM64 原生包或 ARM 真机已验收。其他五个平台配置为原生运行时。

## Node 26 与构建验证边界

源码部署按 `.nvmrc` 切换到 Node.js `26.13.0` 后重新运行 `npm ci`，不要复制旧 Node 18/24 的 `node_modules`。先在隔离候选目录验证，不要替换仍在运行的服务依赖或把修改 Node 版本等同于部署完成。
Canvas 已升级到 3.2.3；SQLite 和分词仍使用原模块。`nodejs-jieba@0.3.0` 的 engines
声明尚未包含 Node 26，因此 npm 会产生版本警告，不能用修改依赖声明来隐藏。Windows x64 隔离候选已完成安装、原生加载与功能验证，不能据此推断其他平台兼容。

截至 2026-11-04，按父任务提供的云端快照记录如下，尚非全通过；后续以最终 run 更新，不重复触发构建：

| 候选 / run | 当前结果 | 待修项 |
| --- | --- | --- |
| `3a718` / `41669844909` | 六平台 2/6 成功 | 其余 4 项未通过；不推断具体成功平台 |
| `9c89` / `41753482691` | `linux-arm64`、`win-arm64` 通过 | 其余 4 平台 `PLUGIN_REPLY` 超时，父任务继续修复 |
| CI / `41753482345` | 全部 syntax / Jest 检查已过 | startup 超时，整体不算通过 |

| 目标 | 配置的 runner | 运行时架构 | 验证状态 |
| --- | --- | --- | --- |
| `linux-x64` | `ubuntu-24.04` | x64 原生 | 第二轮 `PLUGIN_REPLY` 超时，待修 |
| `linux-arm64` | `ubuntu-24.04-arm` | arm64 原生 | 第二轮通过；真实 QQ 未验收 |
| `win-x64` | `windows-latest` | x64 原生 | 第二轮 `PLUGIN_REPLY` 超时，待修 |
| `win-arm64` | `windows-11-arm` | x64-emulation | 第二轮通过；ARM 真机未验收 |
| `macos-x64` | `macos-15-intel` | x64 原生 | 第二轮 `PLUGIN_REPLY` 超时，待修 |
| `macos-arm64` | `macos-15` | arm64 原生 | 第二轮 `PLUGIN_REPLY` 超时，待修 |

ARM 限制：`linux-arm64` 打包排除仓内 ELF 机器类型为 62（x86-64）的 go-cqhttp，Node 与适配器仍使用原生 ARM64；QQ 接入应使用独立部署的外部 OneBot/NapCat/SnowLuma 服务，不下载或自动替换协议程序。`win-arm64` 为 x64 仿真包，仍可包含 x64 go-cqhttp。Canvas 在 ARM64 上源码编译涉及外部 Cairo/Pango 依赖；上述 runner 通过不等于任意 ARM 主机免系统依赖运行或真机验收通过。

Windows x64 的证据覆盖 Node `26.13.0` / ABI `147` 下的干净安装、Canvas/SQLite/分词/Sharp 功能探针、离线测试与烟测、生产依赖安装和实际 ZIP 内运行时、manifest 与文件项检查。验证范围限于对应的 Windows x64 候选；本地受限 QQ 验收入口已切换到 Node 26，但不代表完整 `index` 入口已正式全功能上线。Docker 镜像尚未构建验收，其他平台与云端构建仍以各自实际结果为准。

## SnowLuma 代码接入，暂不启动

NapCat 仍是推荐的普通 QQ 接入路径。SnowLuma 使用独立 provider 配置，与 NapCat 不自动切换、不自动启动彼此，也不覆盖对方的登录数据。启用前须独立部署并验收 SnowLuma，不能用现有 NapCat 收发结果替代。

SnowLuma 源码 v2.4.0 的 schema 使用 `networks` / `enabled` / `accessToken` / `messageFormat`，不能直接复制 NapCat 配置。回调签名契约为 `X-Signature: sha1=<hex>`，使用 access token 对原始 payload 做 HMAC-SHA1。共享 JSON parser 已通过 `verify` 保存独立的 `req.rawBody` Buffer；解析后的 `req.body` 不变，JSON 默认限制仍为 `100kb`，原文不记日志或外发。

provider/schema 与原始请求体 HMAC 校验的边界见 [SnowLuma 接入说明](./integrations/snowluma/README.md)。该工具不下载、安装或启动协议端；只读就绪检查也会请求真实服务，必须另行授权。当前没有 SnowLuma 登录、设备或真实私聊/群消息验收结论，离线测试也不能替代这些验收。

ChatDACS 仅通过 HTTP 对接独立部署的 SnowLuma，不打包其源码、程序或原生组件。上游 [v2.4.0 许可](https://github.com/SnowLuma/SnowLuma/blob/v2.4.0/LICENSE) 为源码可见非商业许可，不是 OSI 开源许可，商业使用和再分发需按上游条款另行核对。`ONE_BOT_CREDENTIALS_FILE` 的相对路径始终相对于进程 cwd，不相对于 `--config` 指定的 YAML 目录；CLI 与主程序保持一致。

## 官方 QQ 通道

官方 QQ 通道默认关闭，独立于 NapCat。参考 [官方 QQ 接入说明](./integrations/qq-official/README.md)
扫码并开启 `CONNECT_QQ_OFFICIAL_SWITCH`。它使用官方机器人应用身份，不会继承个人 QQ 账号关系。
新增迁移只创建 `conversationPluginStates` 表，用于隔离官方机器人会话的插件开关，不转换旧 QQ 群数据。
凭据文件和环境变量不应进入 Git、日志、镜像和运行包。
