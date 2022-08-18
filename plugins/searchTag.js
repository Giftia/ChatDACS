module.exports = {
  插件名: "搜图插件",
  指令: "来点(好.*的.*|坏的.*)|来点.*",
  版本: "3.2",
  作者: "Giftina",
  描述: "搜索一张指定tag的二次元图。`好的` 代表正常尺度，`坏的` 代表🔞。图片来源api.lolicon.app。",
  使用示例: "来点好的白丝",
  预期返回: "[一张健全的白丝图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const tag = new RegExp(module.exports.指令).exec(msg)[1] ?? msg.split("来点")[1] ?? "";
    const searchTag = tag.split("的")[1] ?? tag;
    const searchType = !!tag.match("坏的");

    console.log(`搜索 ${searchType ? "r18" : "正常"} tag：${searchTag}`.log);

    try {
      if (options.type === "qq") {
        await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(`你等等，我去问问小冰有没有${tag}`)}`);

        const fileDirectPath = `./static${await SearchTag(searchTag, searchType)}`;
        const fileModifiedPath = url.pathToFileURL(path.resolve(await utils.ModifyPic(fileDirectPath)));

        const requestData = {
          group_id: groupId,
          messages: [
            {
              type: "node",
              data: {
                name: `${userName}的${tag}`,
                uin: 2854196306, // 对不起，QQ小冰
                content: `[CQ:image,file=${fileModifiedPath}]`,
              },
            },
          ],
        };

        await axios.post(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`, requestData);

        return { type: "text", content: "" };
      }

      const filePath = await SearchTag(searchTag, searchType);
      return { type: "picture", content: { file: filePath } };
    }
    catch (error) {
      return { type: "text", content: `你要的${tag}发送失败啦：${error}` };
    }
  },
};

const request = require("request");
const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); // 使用yaml解析配置文件
const url = require("url");
const utils = require("./system/utils.js");
let GO_CQHTTP_SERVICE_API_URL;

//搜索tag
function SearchTag(tag, type) {
  return new Promise((resolve, reject) => {
    request(`https://api.lolicon.app/setu/v2?r18=${type}&size=original&tag=${encodeURI(tag)}`, (err, _response, body) => {
      body = JSON.parse(body);
      if (!err && body.data[0] != null) {
        const picUrl = body.data[0].urls.original.replace("pixiv.cat", "pixiv.re");
        console.log(`准备保存 ${tag} 图片：${picUrl}`.log);
        // 绕过防盗链，保存为本地图片
        request(picUrl, (err) => {
          if (err) {
            reject(err);
          }
        }).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (err) => {
            if (!err) {
              console.log(`${tag} 图片保存成功`.log);
              resolve(`/images/${picUrl.split("/").pop()}`);
            } else {
              console.log(`${tag} 图片保存失败`.log);
              reject(err);
            }
          })
        );
      } else {
        reject(`找不到${tag}`);
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
