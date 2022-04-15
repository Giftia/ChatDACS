module.exports = {
  插件名: "搜图插件", //插件名，仅在插件加载时展示
  指令: "来点(好.*的.*|坏的.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.4", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "搜索指定的tag图片，图片来源api.lolicon.app", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const tag = new RegExp(module.exports.指令).exec(msg)[1];

    if (CONNECT_GO_CQHTTP_SWITCH) {
      axios(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
          `你等等，我去找找你要的${tag}`,
        )}`);
    }

    const searchTag = tag.match("的") ? tag.match("的")[1] : tag;
    const searchType = !!tag.match("坏的");

    console.log(`搜索 r18 ${searchType} tag：${tag}`.log);

    const tagPictureFile = await SearchTag(searchTag, searchType);
    if (!tagPictureFile) {
      return { type: "text", content: `你要的${tag}发送失败啦` };
    }
    return { type: "picture", content: { file: tagPictureFile } };
  },
};

const request = require("request");
const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let GO_CQHTTP_SERVICE_API_URL, CONNECT_GO_CQHTTP_SWITCH;

//搜索tag
function SearchTag(tag, type) {
  return new Promise((resolve, reject) => {
    request(`https://api.lolicon.app/setu/v2?r18=${type}&size=regular&tag=${encodeURI(tag)}`, (err, _response, body) => {
      body = JSON.parse(body);
      if (!err && body.data[0] != null) {
        const picUrl = body.data[0].urls.regular.replace("pixiv.cat", "pixiv.re");
        console.log(`发送tag图片：${picUrl}`.log);
        request(picUrl, (err) => {
          if (err) {
            reject(`${tag}太大了，下不下来`);
          }
        }).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (err) => {
            if (!err) {
              resolve(`/images/${picUrl.split("/").pop()}`);
            } else {
              reject(`${tag}太大了，下不下来`);
            }
          })
        ); //绕过防盗链，保存为本地图片
      } else {
        reject(`找不到${tag}`);
      }
    });
  });
}

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
