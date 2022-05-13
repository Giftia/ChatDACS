module.exports = {
  插件名: "本地随机图插件", //插件名，仅在插件加载时展示
  指令: "[让给]我[看康]{1,3}|^图来$", //指令触发关键词，可使用正则表达式匹配
  版本: "1.2", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "从本地图片文件夹随机发送图片，默认使用其他插件自动下载保存的图库文件夹", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const url = `${图片文件夹}${await RandomLocalPicture()}`;
    return { type: "directPicture", content: { file: url } };
  },
};

const 图片文件夹 = "./static/images/"; //修改为自己的图库文件夹，绝对路径和相对路径都可以，绝对路径类似 D:\\色图\\贫乳\\ ，记得要像这样 \\ 多加一个反斜杠
const path = require("path");
const fs = require("fs");

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