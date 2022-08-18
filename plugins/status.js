module.exports = {
  插件名: "系统配置查询插件",
  指令: "^[/!]?(status|系统状态)$",
  版本: "2.3",
  作者: "Giftina",
  描述: "查询小夜的相关运行信息。",
  使用示例: "系统状态",
  预期返回: "[小夜的相关运行信息]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const status = await CheckoutStatus();
    return { type: "text", content: status };
  },
};

//查询配置
async function CheckoutStatus() {
  const stat =
    `宿主架构: ${versionNumber} ${os.type()} ${os.arch()}
正常运行时间：${Math.round(process.uptime() / 60 / 60)}小时
小夜吃掉了 ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB/${Math.round(os.totalmem() / 1024 / 1024)}MB 内存
如果该小夜出现故障，请联系该小夜领养员 ${QQBOT_ADMIN_LIST[0]}
或开发群 120243247 报错
小夜开源于: https://github.com/Giftia/ChatDACS`;
  return stat;
}

const os = require("os");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml");
let QQBOT_ADMIN_LIST;
const versionNumber = require(path.join(process.cwd(), "version.json")).versionNumber;

Init();

// 读取配置文件
function ReadConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(process.cwd(), "config", "config.yml"), "utf-8", function (err, data) {
      if (!err) {
        resolve(yaml.parse(data));
      } else {
        reject("读取配置文件错误。错误原因：" + err);
      }
    });
  });
}

// 初始化
async function Init() {
  const resolve = await ReadConfig();
  QQBOT_ADMIN_LIST = resolve.qqBot.QQBOT_ADMIN_LIST; // qqBot小夜的管理员列表
}
