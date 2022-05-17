const devGroupNumber = "120243247"; //小夜开发群

module.exports = {
  插件名: "报错插件",
  指令: "^[/!]?报错 (.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "向小夜开发组报错消息，消息会实时转达到小夜开发成员",
  使用示例: "报错 插件爆炸了",
  预期返回: `谢谢您的报错，小夜已经把您的报错信息 插件爆炸了 发给了小夜开发群${devGroupNumber}啦`,

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const feedback = new RegExp(module.exports.指令).exec(msg)[1];
    const feedbackContext = `用户 ${userId}(${userName}) 报告了错误：${feedback}`;

    if (CONNECT_GO_CQHTTP_SWITCH) {
      axios(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${devGroupNumber}&message=${encodeURI(
          feedbackContext,
        )}`);
    }
    return { type: "text", content: `谢谢您的报错，小夜已经把您的报错信息 ${feedback} 发给了小夜开发群${devGroupNumber}啦` };
  },
};

const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let GO_CQHTTP_SERVICE_API_URL, CONNECT_GO_CQHTTP_SWITCH;

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
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
  CONNECT_GO_CQHTTP_SWITCH = resolve.System.CONNECT_GO_CQHTTP_SWITCH;
}
