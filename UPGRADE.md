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

## 回滚

停止新版运行时，回到旧版 ChatDACS 目录，并同时恢复升级前备份的 `config.yml` 和 `db.db`。不要把已迁移的数据库交给 v3.7 打开并视为回滚；必须恢复升级前的原始数据库副本。

## 运行包结构

官方运行包包含应用源码、生产依赖和目标平台对应的 Node.js `18.20.8` 运行时。请保持目录完整：启动器、`runtime/`、`node_modules/`、`src/`、`plugins/`、`migrations/`、`static/` 和 `config/` 共同构成一个可部署单元。

Node.js 18 没有官方 Windows ARM64 运行时，因此 `win-arm64` 运行包使用 Node.js 18 x64 和对应的 x64 原生依赖，通过 Windows 11 ARM 的 x64 兼容层运行。包内 `release-manifest.json` 会明确标记 `runtimeArch: "x64"` 和 `compatibility: "x64-emulation"`；其他五个平台均为原生运行时。
