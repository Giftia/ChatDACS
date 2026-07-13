# NapCatQQ 接入 ChatDACS

ChatDACS 将 NapCatQQ 作为推荐的 QQ OneBot 11 实现。NapCatQQ 需要独立安装和运行；ChatDACS 发布包不会捆绑或修改 NapCatQQ、NTQQ 或 QQ 登录数据。

## 前置条件

- ChatDACS 与 NapCatQQ 运行在同一台可信主机，或两者之间有受控的私有网络。
- NapCatQQ 已登录机器人 QQ 账号。
- `config/config.yml` 中 `CONNECT_ONE_BOT_SWITCH` 为 `true`，`ONE_BOT_PROVIDER` 为 `napcat`。

## 生成 OneBot 配置

在 ChatDACS 根目录运行：

```bash
npm run qq:napcat:config -- --output integrations/napcat/onebot11.json
```

如果 ChatDACS 在容器中运行，将事件回调主机改为 NapCat 能访问的名称：

```bash
npm run qq:napcat:config -- --event-host host.docker.internal --output integrations/napcat/onebot11.json
```

将生成文件的 `network` 配置合并到 NapCat 的 `onebot11.json`，或在 NapCat WebUI 中建立等价配置：

- HTTP Server：`127.0.0.1:5700`，用于 ChatDACS 调用 OneBot API。
- HTTP Client：`http://127.0.0.1/bot`，用于 NapCat 上报事件。
- 消息格式必须选择 `string`，以保留 ChatDACS 现有 CQ 码行为。
- 不启用 WebSocket。

NapCat 不在线或探测失败时，ChatDACS 会记录警告并继续提供 Web 与其他平台服务。NapCat 恢复后需要重启 ChatDACS，QQ Adapter 才会重新执行群列表初始化。

## 安全边界

默认配置不设置 OneBot token，因此 API 只应监听回环地址，不要把 `5700` 端口暴露到公网。跨主机部署需要先增加受控网络或反向代理鉴权；当前 ChatDACS 的旧 QQ 调用尚未统一支持 OneBot token。

## 验收

1. 先启动 NapCatQQ，再启动 ChatDACS。
2. 确认日志出现 `NapCat OneBot 11 已连接`。
3. 在测试群发送 `/ping`，确认机器人回复 `Pong!`。
4. 发送普通消息，确认插件和小夜聊天回复均可用。
5. 停止 NapCatQQ，确认 ChatDACS Web 页面仍可访问；重新启动 NapCatQQ 和 ChatDACS 后再次测试群消息。

`GO_CQHTTP_SWITCH` 仅用于旧部署兼容。启用它会覆盖 `ONE_BOT_PROVIDER` 并继续启动发布包中的旧 go-cqhttp。

## 方案说明

ChatDACS 继续使用 OneBot 11 HTTP，是为了兼容现有 QQ 处理器和插件返回格式。NapCat 官方同时支持 HTTP Server、HTTP Client 和 WebSocket；本阶段只启用与现有架构等价的两条 HTTP 链路。后续在 QQ API 调用全部收敛到 sender 后，再评估鉴权与 WebSocket transport。

- [NapCatQQ 项目](https://github.com/NapNeko/NapCatQQ)
- [NapCat 网络配置文档](https://github.com/NapNeko/NapCatDocs/blob/main/src/onebot/network.md)
- [NapCat 基础配置文档](https://github.com/NapNeko/NapCatDocs/blob/main/src/config/basic.md)
- [QQ provider 选型记录](./SELECTION.md)
