const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let cos_total_count = 50; //初始化随机cos上限，50个应该比较保守，使用随机cos功能后会自动更新为最新值
let web_port;

Init();

//读取web_port
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

//初始化web_port
async function Init() {
  let resolve = await ReadConfig();
  web_port = resolve.System.web_port;
}

module.exports = {
  插件名: "cos图片插件", //插件名，仅在插件加载时展示
  指令: ".*图.*来.*|.*来.*图.*|.*[色涩瑟].*图.*", //指令触发关键词，可使用正则表达式匹配
  版本: "1.1", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "在普通限度的尺度下发送一张合法的 cos 图, 图片来源哔哩哔哩cos专栏. 已修复图片无法发送的问题.", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    const setu_file = await RandomCos();
    let setu_file_url = `http://127.0.0.1:${web_port}${setu_file}`;
    return { type: 'picture', content: setu_file_url };
  },
};

//随机cos
function RandomCos() {
  return new Promise((resolve, reject) => {
    var rand_page_num = Math.floor(Math.random() * cos_total_count);
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
 * 其他可用备份
 * https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=sifu&type=new&page_num=0&page_size=10
 * https://api.vc.bilibili.com/link_draw/v2/Photo/index?type=recommend&page_num=0&page_size=1
 */