module.exports = {
  插件名: "我有个朋友插件",
  指令: "^我有个朋友说(.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "仅在qq端生效。小夜会P一张你朋友说的图。",
  使用示例: "我有个朋友说我好了@朋友",
  预期返回: "[朋友：我好了]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type != "qq") {
      return 0;
    }

    let target = Constants.has_qq_reg.exec(msg);
    target = !target ? userId : target[1];
    const headIcon = `https://api.sumt.cn/api/qq.logo.php?qq=${target}`; // 载入朋友头像
    msg = msg.split("说")[1].split("[CQ:at,qq=")[0].trim();

    const fileURL = await loadImage(headIcon)
      .then(async (image) => {
        const canvas = createCanvas(350, 80);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "WHITE";
        ctx.fillRect(0, 0, 350, 80);
        ctx.font = "20px SimHei";
        ctx.textAlign = "left";
        ctx.fillStyle = "#000000";
        ctx.fillText(
          (await axios.get(
            `http://${GO_CQHTTP_SERVICE_API_URL}/get_stranger_info?group_id=${groupId}&user_id=${target}&no_cache=1`
          )).data.data.nickname,
          90.5, 35.5);
        ctx.font = "16px SimHei";
        ctx.fillStyle = "#716F81";
        ctx.fillText(msg, 90.5, 55.5);
        ctx.font = "13px SimHei";
        ctx.fillText(utils.GetTimes().Clock, 280.5, 35.5);

        ctx.beginPath();
        ctx.arc(40, 40, 28, 0, 2 * Math.PI);
        ctx.fill();
        ctx.clip();
        ctx.drawImage(image, 10, 10, 60, 60);
        ctx.closePath();

        const fileLocalPath = path.join(
          process.cwd(),
          "static",
          "xiaoye",
          "images",
          `${utils.sha1(canvas.toBuffer())}.jpg`,
        );
        fs.writeFileSync(fileLocalPath, canvas.toBuffer());
        const fileURL = `/xiaoye/images/${utils.sha1(canvas.toBuffer())}.jpg`;
        console.log(`我有个朋友合成成功，图片发送: ${fileURL}`.log);
        return fileURL;
      });

    return { type: "picture", content: { file: fileURL } };
  },
};

const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const Constants = require("../config/constants.js");
const utils = require("./system/utils.js");
const fs = require("fs");
const axios = require("axios").default;
const yaml = require("yaml");
let GO_CQHTTP_SERVICE_API_URL;

Init();

async function ReadConfig() {
  return await yaml.parse(
    fs.readFileSync(path.join(process.cwd(), "config", "config.yml"), "utf-8")
  );
}

async function Init() {
  const resolve = await ReadConfig();
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
}
