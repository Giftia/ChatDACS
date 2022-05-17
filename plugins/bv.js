module.exports = {
  插件名: "哔哩哔哩BV解析插件",
  指令: "BV[a-zA-Z0-9]{10,10}",
  版本: "2.0",
  作者: "Giftina",
  描述: "回复格式适配web端，通过哔哩哔哩官方接口解读BV号背后所隐藏的故事。",
  使用示例: "BV19q4y1c7K4",
  预期返回: "a(https://www.bilibili.com/video/av550874197)[【整活预热】全自动智能虚拟主播就是小夜我啦！，av550874197]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const bvString = msg.split("BV")[1].slice(0, 10);
    return { type: "text", content: await Bv2Av(bvString) };
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
