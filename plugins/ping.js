module.exports = {
  插件名: "连通性测试插件", //插件名，仅在插件加载时展示
  指令: "^[/!]ping", //指令触发关键词，可使用正则表达式匹配
  版本: "1.3", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "PingPong，最基础的响应插件，可基于本插件学习插件的开发", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    /**
     * 插件的功能实现
     * 插件加载器将会传入 消息全文 {msg}、qq号 {qNum}、qq群号 {gNum} 以供下文使用，下文处理完成后需要return结果，若无需回复则 return "";
     * return的数据格式为：{type: "text", content: "返回的内容"} 或 {type: "picture", content: "返回的图片链接"}；
     * type目前有4种类型：text, picture, audio，video，file：
     *    - text 为文本回复；
     *    - picture 为图片回复，content 可以使用图片链接或者base64编码的图片数据；
     *    - audio 为音频回复，content 可以使用音频链接或者base64编码的音频数据；
     *    - video 为视频回复，content 可以使用视频链接；
     *    - file 为文件回复，content 可以使用文件链接；
     */

    return { type: "text", content: "Pong!" };
  },
};
