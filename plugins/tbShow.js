module.exports = {
  插件名: "淘宝买家秀色图插件", //插件名，仅在插件加载时展示
  指令: "买家秀|福利姬", //指令触发关键词，可使用正则表达式匹配
  版本: "1.6", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "在危险限度的尺度下发送一张非法的淘宝买家秀色图", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const setu_file = await RandomTbShow() ?? "";
    const setu_file_url = `${setu_file}`;
    return { type: "picture", content: { file: setu_file_url } };
  },
};

const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
let SUMT_API_KEY;

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

//初始化SUMT_API_KEY
async function Init() {
  const resolve = await ReadConfig();
  SUMT_API_KEY = resolve.ApiKey.SUMT_API_KEY;
}

//随机买家秀
function RandomTbShow() {
  return new Promise((resolve, reject) => {
    request(`https://api.sumt.cn/api/rand.tbimg.php?token=${SUMT_API_KEY}&format=json`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err && body.code === 200) {
        const picUrl = body.pic_url;
        request(picUrl).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
            console.log(`保存了珍贵的随机买家秀：${picUrl}，然后再给用户`.log);
          })
        ); //来之不易啊，保存为本地图片
        resolve(body.pic_url); //但是不给本地地址，还是给的源地址，这样节省带宽
      } else {
        reject("随机买家秀错误，是卡特实验室接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}
