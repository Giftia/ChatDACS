module.exports = {
  插件名: "微信息知频道消息推送插件",
  指令: "^推送",
  版本: "3.0",
  作者: "Giftina",
  描述: "将指定格式的消息推送至微信息知指定频道，适合传送消息至微信。",
  使用示例: "推送我晚上要手冲",
  预期返回: "好的，已经推送到微信，你晚上要手冲",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!XIZHI_CHANNEL_KEY) {
      return { type: "text", content: `${this.插件名} 的接口密钥未配置，请通知小夜主人及时配置接口密钥。方法：在状态栏右键小夜头像，点击 打开配置文件，按接口密钥配置说明进行操作` };
    }
    axios(
      `https://xizhi.qqoq.net/${XIZHI_CHANNEL_KEY}.channel?title=${encodeURI("来自 " + userName + " 的消息：" + msg)}`,
    ).then(function (response) {
      console.log(response.data);
    });
    return { type: "text", content: `好的，已经推送到微信，${msg.replace(/我/g, "你").replace("推送", "")}` };
  },
};

const path = require("path");
const fs = require("fs");
const axios = require(path.join(process.cwd(), "node_modules/axios")).default;
const yaml = require(path.join(process.cwd(), "node_modules/yaml"));
let XIZHI_CHANNEL_KEY;

Init();

// 读取配置文件
async function ReadConfig() {
  return await yaml.parse(
    fs.readFileSync(path.join(process.cwd(), "config", "config.yml"), "utf-8")
  );
}

// 初始化WEB_PORT
async function Init() {
  const resolve = await ReadConfig();
  XIZHI_CHANNEL_KEY = resolve.ApiKey.XIZHI_CHANNEL_KEY;
}
