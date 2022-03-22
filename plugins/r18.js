module.exports = {
  插件名: "r18色图插件", //插件名，仅在插件加载时展示
  指令: "r18", //指令触发关键词，可使用正则表达式匹配
  版本: "1.1", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "在危险限度的尺度下发送一张非法的 r18 色图，图片来源pixivcat", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    const setu_file = await RandomR18();
    const setu_file_url = `http://127.0.0.1:${WEB_PORT}${setu_file}`;
    return { type: 'picture', content: setu_file_url };
  },
};

const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let WEB_PORT;

Init();

//读取配置文件
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

//随机r18
function RandomR18() {
  return new Promise((resolve, reject) => {
    request("https://api.lolicon.app/setu/v2?r18=0&size=regular", (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        var picUrl = body.data[0].urls.regular;
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
        ); //绕过防盗链，保存为本地图片
      } else {
        reject("获取随机r18错误，错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}
