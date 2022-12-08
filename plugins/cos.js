module.exports = {
  插件名: "cos图片插件",
  指令: "^[/!]?(cos图|cosplay)$",
  版本: "4.0",
  作者: "Giftina",
  描述: "在普通限度的尺度下发送一张合法的 cos 三次元图, 图片来源哔哩哔哩cos专栏。",
  使用示例: "cos图",
  预期返回: "[一张cos图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === "qq") {
      await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI("你等等，我去问问小冰有没有cos图")}`);

      const fileDirectPath = url.pathToFileURL(path.resolve(`./static${await RandomCos()}`));

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: "node",
            data: {
              name: `${userName}的cos图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      };

      await axios.post(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`, requestData);

      return { type: "text", content: "" };
    }

    const filePath = await RandomCos();
    return { type: "picture", content: { file: filePath } };
  },
};

const path = require("path");
const fs = require("fs");
const url = require("url");
const request = require(path.join(process.cwd(), "node_modules/request"));
const axios = require(path.join(process.cwd(), "node_modules/axios")).default;
let GO_CQHTTP_SERVICE_API_URL;
const yaml = require(path.join(process.cwd(), "node_modules/yaml"));
const cos_total_count = 2000; // 初始化随机cos上限，可以自己调整

/**
 * 其他可用图源
 * https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=sifu&type=new&page_num=0&page_size=10
 * https://api.vc.bilibili.com/link_draw/v2/Photo/index?type=recommend&page_num=0&page_size=1
 */
function RandomCos() {
  return new Promise((resolve, reject) => {
    const rand_page_num = Math.floor(Math.random() * cos_total_count);
    request(
      "https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=new&page_num=" + rand_page_num + "&page_size=10",
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err && response.statusCode === 200 && body.code === 0 && body.data.total_count != 0) {
          // cos_total_count = body.data.total_count; // 现在阿b的cos图片数量不确定，暂时不更新
          try {
            var obj = body.data.items[0].item.pictures; // 经常出现某个item里没有图片的毛病，阿B你在干什么啊
          } catch (err) {
            reject("获取随机cos错误，是B站的锅。这个item里又双草没有图片，阿B你在干什么啊。错误原因：" + JSON.stringify(response.body));
            return 0;
          }
          var count = Object.keys(obj).length;
          var picUrl = obj[Math.floor(Math.random() * count)].img_src;
          console.log(`cos总数：${cos_total_count}页，当前选择：${rand_page_num}页，发送图片：${picUrl}`.log);
          // 绕过防盗链，保存为本地图片
          request(picUrl).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
              resolve(`/images/${picUrl.split("/").pop()}`);
            })
          );
        } else {
          reject("获取随机cos错误，是B站的锅。错误原因：" + JSON.stringify(response.body));
        }
      }
    );
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
