module.exports = {
  插件名: "本地随机图插件",
  指令: "[让给]我[看康]{1,3}|^[/!]?图来$",
  版本: "3.2",
  作者: "Giftina",
  描述: "从本地图片文件夹随机发送一张图片，默认使用其他插件自动下载保存的图库文件夹。",
  使用示例: "让我康康",
  预期返回: "[一张本地的随机图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === "qq") {
      await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI("杰哥不要！")}`);

      const fileDirectPath = url.pathToFileURL(path.resolve(`${图片文件夹}${await RandomLocalPicture()}`));

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: "node",
            data: {
              name: `${userName}的本地随机图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      };

      await axios.post(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`, requestData);

      return { type: "text", content: "" };
    }

    const filePath = `${图片文件夹}${await RandomLocalPicture()}`;
    return { type: "directPicture", content: { file: filePath } };
  },
};

const 图片文件夹 = "./static/images/"; // 修改为自己的图库文件夹，绝对路径和相对路径都可以，绝对路径类似 D:\\色图\\贫乳\\ ，记得要像这样 \\ 多加一个反斜杠
const path = require("path");
const fs = require("fs");
const axios = require("axios").default;
const url = require("url");
let GO_CQHTTP_SERVICE_API_URL;
const yaml = require("yaml");

//随机图
function RandomLocalPicture() {
  return new Promise((resolve, reject) => {
    selectRandomFile(图片文件夹, (err, file) => {
      if (err) {
        reject(err);
      }
      resolve(file);
    });
  });
}

//select-random-file: https://github.com/jfix/npm-random-file
function selectRandomFile(dir, callback) {
  fs.readdir(dir, (err, files) => {
    if (err) return callback(err);

    function checkRandom() {
      if (!files.length) {
        // callback with an empty string to indicate there are no files
        return callback(null, undefined);
      }
      const randomIndex = Math.floor(Math.random() * files.length);
      const file = files[randomIndex];
      fs.stat(path.join(dir, file), (err, stats) => {
        if (err) return callback(err);
        if (stats.isFile()) {
          return callback(null, file);
        }
        // remove this file from the array because for some reason it's not a file
        files.splice(randomIndex, 1);

        // try another random one
        checkRandom();
      });
    }
    checkRandom();
  });
}

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

// 初始化
async function Init() {
  const resolve = await ReadConfig();
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
}
