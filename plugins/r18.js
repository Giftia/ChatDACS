module.exports = {
  插件名: "r18色图插件",
  指令: "^[/!]?r18$|(可以|能)?色色|[色涩瑟]图",
  版本: "3.2",
  作者: "Giftina",
  描述: "在危险的尺度下发送一张非法的 r18 二次元色图，图片来源api.lolicon.app。",
  使用示例: "可以色色",
  预期返回: "[一张r18图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === "qq") {
      await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI("你不对劲，我去问问小冰有没有r18图")}`);

      const fileDirectPath = `./static${await RandomR18()}`;
      const fileModifiedPath = url.pathToFileURL(path.resolve(await utils.ModifyPic(fileDirectPath)));

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: "node",
            data: {
              name: `${userName}的r18图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileModifiedPath}]`,
            },
          },
        ],
      };

      await axios.post(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`, requestData);

      return { type: "text", content: "" };
    }

    const filePath = await RandomR18();
    return { type: "picture", content: { file: filePath } };
  },
};

const path = require("path");
const fs = require("fs");
const url = require("url");
const utils = require("./system/utils.js");
const request = require(path.join(process.cwd(), "node_modules/request"));
const axios = require(path.join(process.cwd(), "node_modules/axios")).default;
const yaml = require(path.join(process.cwd(), "node_modules/yaml"));
let GO_CQHTTP_SERVICE_API_URL;

//随机r18
function RandomR18() {
  return new Promise((resolve, reject) => {
    request("https://api.lolicon.app/setu/v2?r18=0&size=original", (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        const picUrl = body.data[0].urls.original.replace("i.pixiv.cat", "i.pixiv.re");
        console.log(`准备保存r18图片：${picUrl}`.log);
        request(picUrl, (err) => {
          if (err) {
            reject("获取r18错误，错误原因：" + err);
          }
        }).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (err) => {
            if (!err) {
              console.log("r18图片保存成功".log);
              resolve(`/images/${picUrl.split("/").pop()}`);
            } else {
              console.log("r18图片保存失败".log);
              reject("获取r18失败，错误原因：" + err);
            }
          })
        );
      } else {
        reject("获取随机r18错误，错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

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
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
}
