const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
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
  插件名: "r18色图插件", //插件名，仅在插件加载时展示
  指令: "r18", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "在危险限度的尺度下让小夜发一张非法的 r18 色图，图片来源pixivcat", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    res.send({ reply: `你等等，我去找找你要的r18` });
    system.setu
      .RandomR18()
      .then((resolve) => {
        let setu_file = `http://127.0.0.1:${web_port}/${resolve.replace(/\//g, "\\")}`;
        console.log(setu_file);
        request(
          `http://${go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(
            `[CQ:image,file=${setu_file},url=${setu_file}]`
          )}`,
          function (error, _response, _body) {
            if (error) {
              console.log(`请求${go_cqhttp_api}/send_group_msg错误：${error}`);
            }
          }
        );
      })
      .catch((reject) => {
        console.log(`system.setu.RandomR18(): rejected, and err:${reject}`.error);
        request(
          `http://${go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(`你要的r18发送失败啦：${reject}`)}`,
          function (error, _response, _body) {
            if (error) {
              console.log(`请求${go_cqhttp_api}/send_group_msg错误：${error}`);
            }
          }
        );
      });

    RandomCos()
      .then((resolve) => {
        let setu_file = `http://127.0.0.1:${web_port}/${resolve.replace(/\//g, "\\")}`;
        return `[CQ:image,file=${setu_file},url=${setu_file}]`;
      })
      .catch((reject) => {
        console.log(`system.setu.RandomCos(): rejected, and err:${reject}`.error);
        return `你要的色图发送失败啦：${reject}`;
      });
  },
};

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
