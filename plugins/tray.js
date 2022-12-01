module.exports = {
  插件名: "状态栏提示插件",
  指令: "^[/!]?弹窗 (.*)",
  版本: "2.4",
  作者: "Giftina",
  描述: "自动在任务栏显示一个常驻托盘，仅在Windows系统下有效。弹窗指令会在小夜宿主电脑上弹出一条消息通知。",
  使用示例: "弹窗 您可能是盗版软件的受害者",
  预期返回: "[在宿主电脑弹出一个消息通知：'您可能是盗版软件的受害者']",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (process.platform === "win32") {
      // 使用trayicon弹出消息通知
      const text = new RegExp(module.exports.指令).exec(msg)[1];
      await tray.notify(`来自${userId}(${userName})的消息`, text);
      exec(`msg %username% ${text}`);
    }
    return { type: "text", content: "已经在宿主桌面弹出了一个消息通知，请查收" };
  },
};

const trayicon = require("trayicon");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const versionNumber = `v${require(path.join(process.cwd(), "package.json")).version}`;
const icon = path.resolve(process.cwd(), "static", "favicon.ico");
const os = require("os");
let tray;

async function runTray() {
  const newTray = await trayicon.create({
    action: () => {
      newTray.notify("小夜的运行报告", `宿主架构: ${os.type()} ${os.arch()}
正常运行时间：${Math.round(process.uptime() / 60 / 60)}小时
小夜吃掉了 ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB 内存`);
    },
    title: "小夜在此，有何贵干",
    icon: fs.readFileSync(icon),
  });

  const versionTag = newTray.item(`ChatDACS ${versionNumber}`, { disabled: true });

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

  const openConfigFile = newTray.item("编辑配置文件", async () => {
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

  const separator = newTray.separator();

  const checkUpdate = newTray.item("检查更新", () => {
    newTray.notify("还没写", "等等吧");
  });

  const about = newTray.item("关于", () => {
    exec("start \"%ProgramFiles%Internet Exploreriexplore.exe\" \"https://docs.giftia.moe/\"");
  });

  const quit = newTray.item("退出", () => {
    newTray.kill();
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });

  newTray.setMenu(versionTag, separator, reloadGoCqhttp, openConfigFile, separator, checkUpdate, about, quit);

  newTray.notify("world.execute(me);", "=> Master，小夜已启动。");

  return newTray;
}

//托盘只能在Windows下启动
if (process.platform === "win32") {
  runTray().then((resolve) => {
    tray = resolve;
  });
}
