module.exports = {
  插件名: "随机二次元图插件", //插件名，仅在插件加载时展示
  指令: ".*(随机)二次元(图)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "发送一张正常尺度的二次元图", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    const setu_file = await RandomECY();
    const setu_file_url = `${setu_file}`;
    return { type: 'picture', content: setu_file_url };
  },
};

const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let WEB_PORT;

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

//初始化WEB_PORT
async function Init() {
  const resolve = await ReadConfig();
  WEB_PORT = resolve.System.WEB_PORT;
}

//随机二次元图
function RandomECY() {
  return new Promise((resolve, reject) => {
    request(`https://iw233.cn/api/Random.php`, (err, response, _body) => {
      if (!err) {
        let picUrl = response.request.uri.href;
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