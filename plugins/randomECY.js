module.exports = {
  插件名: "随机二次元图插件",
  指令: "^[/!]?(随机)二次元(图)$|^[/!]?二次元$",
  版本: "2.0",
  作者: "Giftina",
  描述: "发送一张正常尺度的二次元图。",
  使用示例: "二次元",
  预期返回: "[一张随机二次元图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const setu_file = await RandomECY();
    return { type: "picture", content: { file: setu_file } };
  },
};

const request = require("request");
const fs = require("fs");

//随机二次元图
function RandomECY() {
  return new Promise((resolve, reject) => {
    request("https://iw233.cn/api/Random.php", (err, response, _body) => {
      if (!err) {
        const picUrl = response.request.uri.href;
        request(picUrl).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
            console.log(`保存了好康的二次元图：${picUrl}，然后再给用户`.log);
            resolve(`/images/${picUrl.split("/").pop()}`);  //绕过防盗链，保存为本地图片
          })
        );
      } else {
        reject("随机二次元图错误，是这个神秘接口的锅。错误原因：图片太鸡儿大了");
      }
    });
  });
}