module.exports = {
  插件名: "r18色图插件",
  指令: "^[/!]?r18$|(可以|能)?色色|[色涩瑟]图",
  版本: "2.0",
  作者: "Giftina",
  描述: "在危险的尺度下发送一张非法的 r18 二次元色图，图片来源api.lolicon.app。",
  使用示例: "可以色色",
  预期返回: "[一张r18图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const setu_file = await RandomR18();
    return { type: "picture", content: { file: setu_file } };
  },
};

const request = require("request");
const fs = require("fs");

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
