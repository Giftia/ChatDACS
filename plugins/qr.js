module.exports = {
  插件名: "二维码生成插件",
  指令: "^[/!]?qr (.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "用sumt的api生成二维码。",
  使用示例: "/qr 114514",
  预期返回: "[代表114514含义的二维码]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const content = new RegExp(module.exports.指令).exec(msg)[1];
    return { type: "text", content: `[CQ:image,file=https://api.sumt.cn/api/qr.php?text=${content}]` };
  },
};
