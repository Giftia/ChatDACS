module.exports = {
  插件名: "系统信息查询插件",
  指令: "^[/!]?(status|系统状态)$",
  版本: "3.0",
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
    `ChatDACS ${versionNumber} Based on ${os.type()} ${os.arch()}
小夜存活了${Math.ceil(process.uptime() / 60 / 60)}小时，吃掉了 ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB/${Math.round(os.totalmem() / 1024 / 1024)}MB 内存
这只小夜的领养员 ${QQBOT_ADMIN_LIST[0]}`;
  return stat;
}

const path = require("path");
const os = require("os");
const fs = require("fs");
const versionNumber = `v${require(path.join(process.cwd(), "package.json")).version}`;
const yaml = require(path.join(process.cwd(), "node_modules/yaml"));
let QQBOT_ADMIN_LIST;

Init();

// 读取配置文件
async function ReadConfig() {
  return await yaml.parse(
    fs.readFileSync(path.join(process.cwd(), "config", "config.yml"), "utf-8")
  );
}

// 初始化
async function Init() {
  const resolve = await ReadConfig();
  QQBOT_ADMIN_LIST = resolve.qqBot.QQBOT_ADMIN_LIST; // qqBot小夜的管理员列表
}
