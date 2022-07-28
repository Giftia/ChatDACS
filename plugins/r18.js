module.exports = {
  插件名: "r18色图插件",
  指令: "^[/!]?r18$|(可以|能)?色色|[色涩瑟]图",
  版本: "3.1",
  作者: "Giftina",
  描述: "在危险的尺度下发送一张非法的 r18 二次元色图，图片来源api.lolicon.app。",
  使用示例: "可以色色",
  预期返回: "[一张r18图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const filePath = await RandomR18();

    if (options.type === "qq") {
      const fileDirectPath = url.pathToFileURL(path.resolve(`./static${filePath}`));

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: "node",
            data: {
              name: userName,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      };

      await axios.post(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`, requestData);

      return { type: "text", data: "你不对劲，我去问问小冰有没有r18图" };
    }

    return { type: "picture", content: { file: filePath } };
  },
};

const request = require("request");
const fs = require("fs");
const axios = require("axios").default;
const url = require("url");
let GO_CQHTTP_SERVICE_API_URL;
const yaml = require("yaml");
const path = require("path");

//随机r18
function RandomR18() {
  return new Promise((resolve, reject) => {
    request("https://api.lolicon.app/setu/v2?r18=0&size=original", (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        const picUrl = body.data[0].urls.original.replace("i.pixiv.cat", "i.pixiv.re");
        console.log(`发送r18图片：${picUrl}`.log);
        request(picUrl, (err) => {
          if (err) {
            reject("获取tag错误，错误原因：" + err);
          }
        }).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
            if (!err) {
              resolve(`/images/${picUrl.split("/").pop()}`);
            } else {
              reject("这张色图太大了，下不下来");
            }
          })
        ); // 绕过防盗链，保存为本地图片
      } else {
        reject("获取随机r18错误，错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

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
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
}
