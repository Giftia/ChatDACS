module.exports = {
  插件名: "哔哩哔哩BV解析插件", //插件名，仅在插件加载时展示
  指令: ".*(BV[a-zA-Z0-9]{10,12})$", //指令触发关键词，可使用正则表达式匹配
  版本: "1.4", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "回复格式适配web端，通过哔哩哔哩官方接口解读BV号背后所隐藏的故事（误", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    return { type: "text", content: await Bv2Av(msg) };
  },
};

const request = require("request");

//BV转AV
function Bv2Av(bvString) {
  return new Promise((resolve, reject) => {
    request(
      "https://api.bilibili.com/x/web-interface/view?bvid=" + bvString,
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err && response.statusCode === 200 && body.code === 0) {
          let content = "a(https://www.bilibili.com/video/av";
          const av = body.data;
          const avNumber = av.aid;
          const avTitle = av.title;
          content += avNumber + ")[" + avTitle + "，av" + avNumber + "]";
          resolve(content);
        } else {
          reject(
            "解析错误，是否输入了不正确的BV号？错误原因：" +
            JSON.stringify(response.body),
          );
        }
      },
    );
  });
}
