module.exports = {
  插件名: "随机网图插件",
  指令: "^[/!]?随机网图$",
  版本: "3.0",
  作者: "Giftina",
  描述: "从随机网络图源下载图片后发送图片，图源可以自定义，网上很多。",
  使用示例: "随机网图",
  预期返回: "[一张随机网图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const url = await RandomPicture();
    return { type: "picture", content: { file: url } };
  },
};

/**
 * 其他可用随机图源：
 * https://api.btstu.cn/sjbz/zsy.php
 */
const 随机图源 = "https://api.btstu.cn/sjbz/?m_lx=suiji";
const path = require("path");
const fs = require("fs");
const request = require(path.join(process.cwd(), "node_modules/request"));

//随机图
function RandomPicture() {
  return new Promise((resolve, _reject) => {
    const picFilePath = `/images/${Date.now()}.jpg`;
    const picFileStream = fs.createWriteStream(`./static${picFilePath}`);
    request(随机图源).pipe(picFileStream);
    picFileStream.on("finish", (_err) => {
      resolve(picFilePath);
    });
  });
}
