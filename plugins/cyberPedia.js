module.exports = {
  插件名: "赛博百科问答插件", //插件名，仅在插件加载时展示
  指令: "^.*赛博朋克(.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.2", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "非常赛博朋克的百科知识问答题", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!TIAN_XING_API_KEY) {
      return { type: "text", content: "TIAN_XING_API_KEY未配置，请在 config/config.yml 中配置TIAN_XING_API_KEY" };
    }
    if (msg.split(" ").length > 1) {
      if (`赛博朋克 ${answer}` == msg) {
        return { type: "text", content: `回答正确！答案是${answer}` };
      } else {
        return { type: "text", content: `回答错误，答案是${answer}` };
      }
    } else {
      const cyberPedia = await CyberPedia() ?? "";
      const question = `${cyberPedia.question} 请按如下格式回答: 赛博朋克 你的答案`;
      SaveAnswer(cyberPedia.result);
      return { type: "text", content: question };
    }

  },
};

function SaveAnswer(cyberPediaAnswer) {
  answer = cyberPediaAnswer;
}


const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let TIAN_XING_API_KEY, answer;

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

//初始化TIAN_XING_API_KEY
async function Init() {
  const resolve = await ReadConfig();
  TIAN_XING_API_KEY = resolve.ApiKey.TIAN_XING_API_KEY;
}

//赛博百科问答
function CyberPedia() {
  return new Promise((resolve, reject) => {
    request(
      `http://api.tianapi.com/txapi/wenda/index?key=${TIAN_XING_API_KEY}`,
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          resolve({
            question: body.newslist[0].quest,
            result: body.newslist[0].result,
          });
        } else {
          reject(
            "获取赛博百科问答错误，是天行接口的锅。错误原因: " +
            JSON.stringify(response.body),
          );
        }
      },
    );
  });
}