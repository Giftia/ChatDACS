module.exports = {
  插件名: "帮助插件",
  指令: "^[/!]?(help|帮助|菜单|插件|说明|指令|命令|小夜怎么用)$",
  版本: "2.0",
  作者: "Giftina",
  描述: "会回复系统当前可用插件列表，描述插件版本和对应的使用示例。",
  使用示例: "/help",
  预期返回: "当前插件列表和使用示例：",

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

    let pluginList = ["当前插件列表和使用示例：\r\n"];
    for (const i in plugins) {
      pluginList.push(`${plugins[i].插件名}_v${plugins[i].版本}: ${plugins[i].使用示例}\r\n`);
    }

    return { type: "text", content: pluginList.toString()?.replace(/,/g, "") };
  },
};

require.all = require("require.all");
const path = require("path");