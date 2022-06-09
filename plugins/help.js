module.exports = {
  插件名: "帮助插件",
  指令: "^[/!]?(help|帮助|菜单|插件|说明|指令|命令|小夜怎么用|docs|command)$",
  版本: "2.2",
  作者: "Giftina",
  描述: "会回复系统当前可用插件列表，描述插件版本和对应的使用示例。",
  使用示例: "/help",
  预期返回: "当前插件列表和使用示例：",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const plugins = require.all({
      dir: path.join(process.cwd(), "plugins"),
      match: /\.js$/,
      require: /\.js$/,
      recursive: false,
      encoding: "utf-8",
      resolve: function (plugins) {
        plugins.all.load();
      },
    });

    //针对 docs 指令生成文档
    if (msg === "docs") {
      /**
       * { 插件名: { 使用例, 预期返回, 功能描述, 作者 }, 插件名: { 使用例, 预期返回, 功能描述, 作者 }, ... }
       */
      let docsMap = {};
      for (const i in plugins) {
        docsMap[`${plugins[i].插件名}_v${plugins[i].版本}`] = {
          使用例: plugins[i].使用示例,
          预期返回: plugins[i].预期返回,
          功能描述: plugins[i].描述,
          作者: plugins[i].作者,
        };
      }
      return { type: "text", content: Object2Markdown(docsMap) };
    }
    //针对 command 指令生成轮播placeholder
    else if (msg === "command") {
      /**
       * [使用示例, 使用示例, ...]
       */
      let docsMap = [];
      for (const i in plugins) {
        docsMap.push(plugins[i].使用示例);
      }

      return { type: "text", content: "\"" + docsMap.join("\",\"") + "\"" };
    }

    let pluginList = ["当前插件列表和使用示例："];
    for (const i in plugins) {
      pluginList.push(`${plugins[i].插件名}_v${plugins[i].版本}: ${plugins[i].使用示例}`);
    }

    return { type: "text", content: pluginList.join("\n") };
  },
};

require.all = require("require.all");
const path = require("path");

//将生成的插件对象转换为markdown表格
function Object2Markdown(docsMap) {
  let markdown = "";
  for (const i in docsMap) {
    markdown += "| `" + i + "` | `" + docsMap[i].使用例 + "` | " + docsMap[i].预期返回 + " | " + docsMap[i].功能描述 + " | " + docsMap[i].作者 + " |\n";
  }
  return markdown;
}
