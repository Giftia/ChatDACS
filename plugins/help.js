module.exports = {
  插件名: "帮助插件", //插件名，仅在插件加载时展示
  指令: "^[/!]help | 帮助 | 菜单", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "会回复系统当前可用指令", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    //还没写好

    return { type: "text", content: `还没写好` };
  },
};
