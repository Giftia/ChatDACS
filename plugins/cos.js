module.exports = {
  插件名: "cos图片插件",
  指令: "^[/!]?(cos图|cosplay)$",
  版本: "2.0",
  作者: "Giftina",
  描述: "在普通限度的尺度下发送一张合法的 cos 三次元图, 图片来源哔哩哔哩cos专栏。",
  使用示例: "cos图",
  预期返回: "[一张cos图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const cosFile = await RandomCos();
    return { type: "picture", content: { file: cosFile } };
  },
};

const request = require("request");
const fs = require("fs");
const cos_total_count = 2000; //初始化随机cos上限，可以自己调整

//随机cos
function RandomCos() {
  return new Promise((resolve, reject) => {
    const rand_page_num = Math.floor(Math.random() * cos_total_count);
    request(
      "https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=new&page_num=" + rand_page_num + "&page_size=10",
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err && response.statusCode === 200 && body.code === 0 && body.data.total_count != 0) {
          // cos_total_count = body.data.total_count; //现在阿b的cos图片数量不确定，暂时不更新
          try {
            var obj = body.data.items[0].item.pictures; //经常出现某个item里没有图片的毛病，阿B你在干什么啊
          } catch (err) {
            reject("获取随机cos错误，是B站的锅。这个item里又双草没有图片，阿B你在干什么啊。错误原因：" + JSON.stringify(response.body));
            return 0;
          }
          var count = Object.keys(obj).length;
          var picUrl = obj[Math.floor(Math.random() * count)].img_src;
          console.log(`cos总数：${cos_total_count}页，当前选择：${rand_page_num}页，发送图片：${picUrl}`.log);
          request(picUrl).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
              resolve(`/images/${picUrl.split("/").pop()}`);
            })
          ); //绕过防盗链，保存为本地图片
        } else {
          reject("获取随机cos错误，是B站的锅。错误原因：" + JSON.stringify(response.body));
        }
      }
    );
  });
}

/**
 * 其他可用图源
 * https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=sifu&type=new&page_num=0&page_size=10
 * https://api.vc.bilibili.com/link_draw/v2/Photo/index?type=recommend&page_num=0&page_size=1
 */