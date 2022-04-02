module.exports = {
  插件名: "反馈插件", //插件名，仅在插件加载时展示
  指令: ".*报错(.*)|.*反馈(.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.2", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "向小夜开发组反馈消息，消息会实时转达到小夜开发成员", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const feedbackContext = `用户 ${userId}(${userName}) 报告了错误:${new RegExp(module.exports.指令).exec(msg)[1]}`;

    if (CONNECT_GO_CQHTTP_SWITCH) {
      axios(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=120243247&message=${encodeURI(
          feedbackContext,
        )}`);
    }
    return { type: "text", content: "谢谢您的反馈，小夜已经把您的反馈信息发给了开发团队辣" };
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
    fs.readFile(path.join(`${process.cwd()}`, "config", "config.yml"), "utf-8", function (err, data) {
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
