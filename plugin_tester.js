/**
 * 插件测试器
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
console.log(`插件测试器 v1.0，用于快速验证插件功能`.alert);
console.log(`开始加载插件……`.log);
let plugins = require.all({
  dir: path.join(`${process.cwd()}`, "plugins"),
  match: /.*\.js/,
  require: /\.(js)$/,
  recursive: false,
  encoding: "utf-8",
  resolve: function (plugins) {
    plugins.all.load();
  },
});
console.log(plugins);
console.log(`插件加载完毕√`.log);
console.log(
  `
现在可以在命令行中输入指令来验证插件功能，按回车提交
`.warn
);

rl.on("line", (input) => {
  run(input);
});

async function run(ask) {
  let qNum, gNum;
  let result = await ProcessExecute(ask, qNum, gNum);
  if (result != "") {
    // res.send({ reply: result });
    console.log(`${result}`.log);
  }
}

//插件遍历器，每条消息遍历一遍插件name
async function ProcessExecute(msg, qq_num, group_num) {
  var return_result = "";
  for (let i in plugins) {
    let reg = new RegExp(plugins[i].指令);
    if (reg.test(msg)) {
      try {
        return_result = await plugins[i].execute(msg, qq_num, group_num);
      } catch (e) {
        console.log(`插件 ${plugins[i].插件名} 爆炸啦：`.error);
        console.log(e.stack);
        return `插件 ${plugins[i].插件名} 爆炸啦：${e.stack}`;
      }
      console.log(`插件 ${plugins[i].插件名} 响应了消息`.log);
      return return_result;
    }
  }
  return return_result;
}
