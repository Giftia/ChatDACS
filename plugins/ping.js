module.exports = {
  插件名: "连通性测试插件", //插件名，会在插件说明中展示
  指令: "^[/!]?ping$", //插件触发的指令，可使用正则表达式匹配关键词，仅在插件加载时展示
  版本: "2.0", //插件版本，会在插件说明中展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "PingPong，最基础的响应插件，可基于本插件学习插件的开发。", //插件说明，仅在插件加载时展示
  使用示例: "/ping", //插件的触发示例，会在插件说明中展示
  预期返回: "Pong!", //简单描述一下插件的预期返回，会在插件说明中展示

  /**
   * ### 插件加载器将会给插件传入如下参数以供下文使用:
   * @param {String} msg 消息全文
   * @param {String} userId 用户id
   * @param {String} userName 用户名
   * @param {String} groupId 群id
   * @param {String} groupName 群名
   * @param {Any} options 其他可选参数
   * @returns {Object} { type: "返回类型", content: "返回内容" }
   * ### 插件处理完成后需要返回处理结果，若无需回复则返回空： `return ""`
   * ### 返回值是一个对象，包含以下属性: `{ type: "返回类型", content: "返回内容" }`
   * ### 返回值的 返回类型 目前有 5 种类型： "text", "picture", "audio", "video", "file":
   * - text 为文本回复；
   * - picture 为图片回复，content 可以使用图片链接或者base64编码的图片数据；
   * - audio 为音频回复，content 可以使用音频链接或者base64编码的音频数据；
   * - video 为视频回复，content 可以使用视频链接；
   * - file 为文件回复，content 可以使用文件链接；
   */
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    /**
     * 返回 Pong!
     */
    const replyText = "Pong!";
    return { type: "text", content: replyText };
  },
};
