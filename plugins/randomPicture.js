module.exports = {
  插件名: "随机图插件", //插件名，仅在插件加载时展示
  指令: "随机图", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "从随机图源下载图片后发送图片", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const url = await RandomPicture();
    return { type: "picture", content: { file: url } };
  },
};

/**
 * 其他可用随机图源：
 * https://api.nmb.show/xiaojiejie1.php
 * https://api.btstu.cn/sjbz/?m_lx=suiji
 * https://api.btstu.cn/sjbz/zsy.php
 */
const 随机图源 = "http://api.nmb.show/xiaojiejie2.php";
const request = require("request");
const fs = require("fs");

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
