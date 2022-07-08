module.exports = {
  插件名: "淘宝买家秀色图插件",
  指令: "买家秀|福利姬",
  版本: "2.0",
  作者: "Giftina",
  描述: "在危险的尺度下发送一张非法的淘宝买家秀福利图。",
  使用示例: "买家秀",
  预期返回: "[一张买家秀图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!SUMT_API_KEY) {
      return { type: "text", content: `${this.插件名} 的接口密钥未配置，请通知小夜主人及时配置接口密钥。方法：在状态栏右键小夜头像，点击 打开配置文件，按接口密钥配置说明进行操作` };
    }
    const setu_file = await RandomTbShow() ?? "";
    const setu_file_url = `${setu_file}`;
    return { type: "picture", content: { file: setu_file_url } };
  },
};

const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); // 使用yaml解析配置文件
let SUMT_API_KEY;

Init();

// 读取配置文件
function ReadConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(process.cwd(), "config", "config.yml"), "utf-8", function (err, data) {
      if (!err) {
        resolve(yaml.parse(data));
      } else {
        reject("读取配置文件错误。错误原因：" + err);
      }
    });
  });
}

// 初始化SUMT_API_KEY
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
        ); // 来之不易啊，保存为本地图片
        resolve(body.pic_url); // 但是不给本地地址，还是给的源地址，这样节省带宽
      } else {
        reject("随机买家秀错误，是卡特实验室接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}
