module.exports = {
  插件名: "微信息知频道消息推送插件", //插件名，仅在插件加载时展示
  指令: "@.*", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "将指定格式的消息推送至微信息知指定频道，适合传送消息至微信", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    request(
      `https://xizhi.qqoq.net/${XIZHI_CHANNEL_KEY}.channel?title=${encodeURI("来自 ")}${encodeURI(qNum)}${encodeURI(" 的消息：")}${encodeURI(msg)}`,
      (error, _response, body) => {
        if (error) {
          console.log(`推送微信消息错误: ${error}`.error);
        } else {
          console.log(`推送微信消息成功: ${body}`.log);
        }
      });
    return "";
  },
};

const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let XIZHI_CHANNEL_KEY;

Init();

//读取配置文件
function ReadConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(`${process.cwd()}`, "config", "config.yml"), "utf-8", function (err, data) {
      if (!err) {
        resolve(yaml.parse(data));
      } else {
        reject("读取配置文件错误。错误原因：" + err);
      }
    });
  });
}

//初始化WEB_PORT
async function Init() {
  const resolve = await ReadConfig();
  XIZHI_CHANNEL_KEY = resolve.ApiKey.XIZHI_CHANNEL_KEY;
}