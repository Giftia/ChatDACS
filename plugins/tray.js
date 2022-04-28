module.exports = {
  插件名: "状态栏提示插件", //插件名，仅在插件加载时展示
  指令: "^/notify (.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "自动在任务栏显示一个托盘，可用于消息通知", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (process.platform === "win32") {
      //使用trayicon弹出消息通知
      const text = new RegExp(module.exports.指令).exec(msg)[1];
      await tray.notify(`来自${userId}(${userName})的消息`, text);
    }
    return "";
  },
};

const trayicon = require("trayicon");
const path = require("path");
const fs = require("fs");

const icon = path.resolve(__dirname, "..", "static", "favicon.ico");
let tray;

async function runTray() {
  const newTray = await trayicon.create({
    action: function () {
      newTray.notify("？点我干什么", "你没事吧");
    },
    title: "ChatDACS",
    icon: fs.readFileSync(icon),
  });

  const openConfigFile = newTray.item("打开配置文件", async () => {
    const configFile = path.join(`${process.cwd()}`, "config", "config.ylm");
    if (fs.existsSync(configFile)) {
      console.log(`打开配置文件：${configFile}`);
    } else {
      newTray.notify("配置文件不存在", "是不是哪里出问题了, 建议重开");
    }
  });
  const separator = newTray.separator();
  const quit = newTray.item("退出", { bold: true }, () => {
    newTray.kill();
    process.exit(0);
  });

  newTray.setMenu(openConfigFile, separator, quit);

  newTray.notify("ChatDACS", "🐱‍💻小夜已启动");

  return newTray;
}

//托盘只能在Windows下启动
if (process.platform === "win32") {
  runTray().then((resolve) => {
    tray = resolve;
  });
}