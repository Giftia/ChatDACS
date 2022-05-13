module.exports = {
  插件名: "帮助插件", //插件名，仅在插件加载时展示
  指令: "[/!]help|帮助|菜单|插件列表|说明", //指令触发关键词，可使用正则表达式匹配
  版本: "1.5", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "会回复系统当前可用插件列表，描述插件版本和对应的触发指令正则表达式", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const plugins = require.all({
      dir: path.join(process.cwd(), "plugins"),
      match: /.*\.js/,
      require: /\.(js)$/,
      recursive: false,
      encoding: "utf-8",
      resolve: function (plugins) {
        plugins.all.load();
      },
    });

    let pluginList = ["当前插件列表和正则指令：\r\n"];
    for (const i in plugins) {
      pluginList.push(`${plugins[i].插件名}_v${plugins[i].版本}: ${plugins[i].指令}\r\n`);
    }

    return { type: "text", content: pluginList.toString()?.replace(/,/g, "") };
  },
};

require.all = require("require.all");
const path = require("path");