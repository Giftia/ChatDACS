module.exports = {
  插件名: "连通性测试插件", //插件名，仅在插件加载时展示
  指令: "^[/!]ping", //指令触发关键词，可使用正则表达式匹配
  版本: "1.2", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "PingPong，最基础的响应插件，可基于本插件学习插件的开发", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    /**
     * 插件的功能实现
     * 插件加载器将会传入 消息全文 {msg}、qq号 {qNum}、qq群号 {gNum} 以供下文使用，下文处理完成后需要return结果，若无需回复则 return "";
     * return的数据格式为：{type: "text", content: "返回的内容"} 或 {type: "picture", content: "返回的图片链接"}；
     * type目前有两种类型：text 和 picture。text为文本回复；picture为图片回复，可以使用图片链接或者base64编码的图片数据；
     */

    return { type: "text", content: `Pong!` };
  },
};
