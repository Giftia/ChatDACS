module.exports = {
  插件名: "roll插件",
  指令: "^[/!]?roll(.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "随机 roll 出 0 到 1000000 的随机数，可以自行跟随参数。",
  使用示例: "/roll",
  预期返回: "你roll出了114514",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    let number = new RegExp(module.exports.指令).exec(msg)[1];
    if (!number) {
      number = Math.floor(Math.random() * 1000000);
    }

    return { type: "text", content: `你roll出了${number}` };
  },
};
