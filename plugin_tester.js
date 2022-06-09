"use strict";
/**
 * Author: Giftina: https://github.com/Giftia/
 * 适合 沙雕Ai聊天系统 ChatDACS 的插件测试器
 */

const path = require("path");
require.all = require("require.all");
const colors = require("colors");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

//日志染色颜色配置
colors.setTheme({
  alert: "inverse",
  on: "brightMagenta",
  off: "brightGreen",
  warn: "brightYellow",
  error: "brightRed",
  log: "brightBlue",
});

//载入插件
console.log("插件测试器 v1.6，用于快速验证插件功能".alert);
console.log("开始加载插件……".log);
let plugins = require.all({
  dir: path.join(process.cwd(), "plugins"),
  match: /\.js$/,
  require: /\.js$/,
  recursive: false,
  encoding: "utf-8",
  resolve: function (plugins) {
    plugins.all.load();
  },
});
console.log(plugins);
console.log("插件加载完毕√".log);
console.log("现在可以在命令行中输入指令来验证插件功能，按回车提交\n".warn);

rl.on("line", (input) => {
  run(input);
});

async function run(msg) {
  const defaultUserId = 0, defaultUserName = "", defaultGroupId = 0, defaultGroupName = "", defaultOptions = {};
  const result = await ProcessExecute(msg, defaultUserId, defaultUserName, defaultGroupId, defaultGroupName, defaultOptions);
  if (result != "") {
    console.log(result);
  }
}

//插件遍历器，每条消息遍历一遍插件
async function ProcessExecute(msg, userId, userName, groupId, groupName, options) {
  let pluginReturn = "";
  for (const i in plugins) {
    const reg = new RegExp(plugins[i].指令);
    if (reg.test(msg)) {
      try {
        pluginReturn = await plugins[i].execute(msg, userId, userName, groupId, groupName, options);
      } catch (e) {
        console.log(`插件 ${plugins[i].插件名} ${plugins[i].版本} 爆炸啦：`.error);
        console.log(e.stack);
        return `插件 ${plugins[i].插件名} ${plugins[i].版本} 爆炸啦：${e.stack}`;
      }
      if (pluginReturn) {
        console.log(`插件 ${plugins[i].插件名} ${plugins[i].版本} 响应了消息`.log);
        return pluginReturn;
      }
    }
  }
  return pluginReturn;
}
