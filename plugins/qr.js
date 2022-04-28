module.exports = {
  插件名: "二维码生成插件", //插件名，仅在插件加载时展示
  指令: "^qr (.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "用sumt的api生成二维码", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const content = new RegExp(module.exports.指令).exec(msg)[1];
    return { type: "text", content: `[CQ:image,file=https://api.sumt.cn/api/qr.php?text=${content}]` };
  },
};
