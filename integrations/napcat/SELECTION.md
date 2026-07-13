# QQ OneBot Provider 选型记录

- 状态：已采用
- 日期：2026-07-13
- 决策：新部署推荐外部 NapCatQQ，保留通用 OneBot 11 与旧 go-cqhttp 兼容路径。

## 约束

ChatDACS 的 QQ 处理器已经依赖 OneBot 11 HTTP API、反向 HTTP 事件和 string/CQ 码消息。当前阶段要求小侵入、Node.js `18.20.8` 基线不变、旧插件和群玩法不迁移，并且协议端离线不能阻断 Web。

## 比较

- [NapCatQQ](https://github.com/NapNeko/NapCatQQ)：持续维护，基于 NTQQ，提供 OneBot 11 HTTP Server、HTTP Client 与 WebSocket。HTTP string 模式可直接复用现有 ChatDACS 链路。
- [LLOneBot](https://github.com/LLOneBot/LLOneBot)：仍在维护，但当前开发工具链要求 Node.js 24，并处于向 LLBot/LagrangeV2 演化阶段，不适合作为 ChatDACS Node 18 发布包内依赖。
- [Lagrange.Core](https://github.com/LagrangeDev/Lagrange.Core)：活跃的 .NET QQ 协议核心；其非 .NET 接入方向转向 Milky。采用它需要迁移协议和消息模型，超出本阶段兼容边界。
- [go-cqhttp](https://github.com/Mrs4s/go-cqhttp)：项目已明确停止维护，不再适合作为新部署默认值，但现有用户仍需要可回退路径。

## 后果

- ChatDACS 不捆绑 NapCat 源码、二进制、NTQQ 或账号数据，只提供配置生成、启动探测和 OneBot contract 测试。
- 默认使用本机 HTTP，消息格式固定为 `string`。未统一 token 前，OneBot API 只能绑定可信回环或私有网络。
- go-cqhttp 代码暂不删除，`GO_CQHTTP_SWITCH` 继续覆盖 provider，确保旧部署可以回退。
- WebSocket、Milky 或其他 provider 只有在 QQ API 全部收敛到 sender 后再评估，避免同时迁移 transport 与业务行为。
