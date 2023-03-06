module.exports = {
  插件名: "淘宝买家秀色图插件",
  指令: "买家秀|福利姬",
  版本: "3.2",
  作者: "Giftina",
  描述: "在危险的尺度下发送一张非法的淘宝买家秀福利图。",
  使用示例: "买家秀",
  预期返回: "[一张买家秀图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!SUMT_API_KEY) {
      return { type: "text", content: `${this.插件名} 的接口密钥未配置，请通知小夜主人及时配置接口密钥。方法：在状态栏右键小夜头像，点击 打开配置文件，按接口密钥配置说明进行操作` };
    }

    if (options.type === "qq") {
      await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI("你不对劲，我去问问小冰有没有买家秀")}`);

      const fileDirectPath = `./static${await RandomTbShow()}`;
      const fileModifiedPath = url.pathToFileURL(path.resolve(await utils.ModifyPic(fileDirectPath)));

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: "node",
            data: {
              name: `${userName}的福利姬图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileModifiedPath}]`,
            },
          },
        ],
      };

      await axios.post(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`, requestData);

      return { type: "text", content: "" };
    }

    const fileURL = await RandomTbShow();
    return { type: "picture", content: { file: fileURL } };
  },
};

const request = require("request");
const fs = require("fs");
const axios = require("axios").default;
const path = require("path");
const yaml = require("yaml");
const url = require("url");
const utils = require("./system/utils.js");
let SUMT_API_KEY, GO_CQHTTP_SERVICE_API_URL;

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
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
}

// 随机买家秀
function RandomTbShow() {
  return new Promise((resolve, reject) => {
    request(`https://api.sumt.cn/api/rand.tbimg.php?token=${SUMT_API_KEY}&format=json`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err && body.code === 200) {
        const picUrl = body.pic_url;
        console.log(`准备保存图片：${picUrl}`.log);
        request(picUrl, (err) => {
          if (err) {
            reject("获取买家秀错误，错误原因：" + err);
          }
        }).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (err) => {
            if (!err) {
              resolve(`/images/${picUrl.split("/").pop()}`);
            } else {
              reject("获取买家秀失败，错误原因：" + err);
            }
          })
        );
      } else {
        reject("随机买家秀错误，是卡特实验室接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}
