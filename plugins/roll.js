module.exports = {
  插件名: "roll插件", //插件名，仅在插件加载时展示
  指令: "^/roll(.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "随机roll一个数", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    let number = new RegExp(module.exports.指令).exec(msg)[1];
    if (!number) {
      number = Math.floor(Math.random() * 1000000);
    }

    return { type: "text", content: `你roll出了${number}` };
  },
};
