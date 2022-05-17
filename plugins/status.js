module.exports = {
  插件名: "系统配置查询插件",
  指令: "^[/!]?(status|系统状态)$",
  版本: "2.0",
  作者: "Giftina",
  描述: "查询小夜的相关信息与系统当前的主要配置项",
  使用示例: "系统状态",
  预期返回: "[小夜的相关信息与系统当前的主要配置项]",

  execute: async function (msg, userId, userName, groupId, groupName, option) {
    const status = await CheckoutStatus(option);
    return { type: "text", content: status };
  },
};

//查询配置
async function CheckoutStatus(option) {
  const selfQQId = !option ? QQBOT_QQ : option == "1648468212" ? "1648468212(小小夜本家)" : option;
  const stat =
    `宿主架构: ${os.hostname()} ${os.type()} ${os.arch()}
当前配置:
- WEB端聊天开关 ${CHAT_SWITCH}
- QQBot ${selfQQId} 开关 ${CONNECT_GO_CQHTTP_SWITCH}
  - QQBot私聊开关 ${QQBOT_PRIVATE_CHAT_SWITCH}
  - QQBot回复率 ${QQBOT_REPLY_PROBABILITY}%
  - QQBot复读率 ${QQBOT_FUDU_PROBABILITY}%
- 连接哔哩哔哩直播间 ${BILIBILI_LIVE_ROOM_ID} 开关 ${CONNECT_BILIBILI_LIVE_SWITCH}
如果该小夜出现故障，请联系该小夜领养员 ${QQBOT_ADMIN_LIST[0]}
或开发群 120243247 报错
小夜开源于: https://gitee.com/Giftina/ChatDACS`;
  return stat;
}

const os = require("os"); //用于获取系统工作状态
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let CHAT_SWITCH, CONNECT_GO_CQHTTP_SWITCH, CONNECT_BILIBILI_LIVE_SWITCH, QQBOT_QQ, QQBOT_ADMIN_LIST, QQBOT_PRIVATE_CHAT_SWITCH, QQBOT_REPLY_PROBABILITY, QQBOT_FUDU_PROBABILITY, BILIBILI_LIVE_ROOM_ID;

Init();

//读取配置文件
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

//初始化
async function Init() {
  const resolve = await ReadConfig();
  CHAT_SWITCH = resolve.System.CHAT_SWITCH ?? true;
  CONNECT_GO_CQHTTP_SWITCH = resolve.System.CONNECT_GO_CQHTTP_SWITCH ?? false;
  CONNECT_BILIBILI_LIVE_SWITCH = resolve.System.CONNECT_BILIBILI_LIVE_SWITCH ?? false;

  QQBOT_QQ = resolve.qqBot.QQBOT_QQ; //qqBot使用的qq帐号
  QQBOT_ADMIN_LIST = resolve.qqBot.QQBOT_ADMIN_LIST; //qqBot小夜的管理员列表
  QQBOT_PRIVATE_CHAT_SWITCH = resolve.qqBot.QQBOT_PRIVATE_CHAT_SWITCH; //私聊开关
  QQBOT_REPLY_PROBABILITY = resolve.qqBot.QQBOT_REPLY_PROBABILITY; //回复几率
  QQBOT_FUDU_PROBABILITY = resolve.qqBot.QQBOT_FUDU_PROBABILITY; //复读几率

  BILIBILI_LIVE_ROOM_ID = resolve.Others.BILIBILI_LIVE_ROOM_ID ?? 49148; //哔哩哔哩直播间id
}
