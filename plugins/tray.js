module.exports = {
  插件名: "状态栏提示插件",
  指令: "^[/!]?弹窗 (.*)",
  版本: "2.2",
  作者: "Giftina",
  描述: "自动在任务栏显示一个常驻托盘，仅在Windows系统下有效。弹窗指令会在小夜宿主电脑上弹出一条消息通知。",
  使用示例: "弹窗 您可能是盗版软件的受害者",
  预期返回: "[在宿主电脑弹出一个消息通知：'您可能是盗版软件的受害者']",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (process.platform === "win32") {
      // 使用trayicon弹出消息通知
      const text = new RegExp(module.exports.指令).exec(msg)[1];
      await tray.notify(`来自${userId}(${userName})的消息`, text);
    }
    return { type: "text", content: "已经在宿主电脑弹出了一个消息通知，请查收" };
  },
};

const trayicon = require("trayicon");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

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

  const reloadGoCqhttp = newTray.item("重启 go-cqhttp", async () => {
    exec("go-cqhttp.bat", {
      cwd: path.join(process.cwd(), "plugins", "go-cqhttp"),
      windowsHide: true,
    }, (error) => {
      if (error) {
        console.log(`go-cqhttp启动失败，错误原因: ${error}`.error);
        return;
      }
      console.log("go-cqhttp窗口意外退出，小夜将无法正常使用，请尝试重新启动".error);
      return;
    });
  });

  const openConfigFile = newTray.item("打开配置文件", async () => {
    const configFile = path.join(`${process.cwd()}`, "config", "config.yml");
    if (fs.existsSync(configFile)) {
      console.log(`打开配置文件：${configFile}`);
      exec(`notepad ${configFile}`, {
        cwd: path.join(process.cwd(), "config")
      });
    } else {
      newTray.notify("配置文件不存在", "是不是哪里出问题了, 建议重开");
    }
  });

  const checkUpdate = newTray.item("检查更新", async () => {
    newTray.notify("还没写，等等吧");
  });

  const separator = newTray.separator();

  const quit = newTray.item("退出", () => {
    newTray.kill();
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });

  newTray.setMenu(reloadGoCqhttp, openConfigFile, checkUpdate, separator, quit);

  newTray.notify("world.execute(me);", "=> Master，小夜已启动。");

  return newTray;
}

//托盘只能在Windows下启动
if (process.platform === "win32") {
  runTray().then((resolve) => {
    tray = resolve;
  });
}
