module.exports = {
  插件名: "今日老婆插件",
  指令: "^[/!]?今日老婆$",
  版本: "1.2",
  作者: "Giftina",
  描述: "将随机一对群友组成一对cp。",
  使用示例: "今日老婆",
  预期返回: "[cp头]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const selfHeadImgBuffer = await loadImage(`https://api.sumt.cn/api/qq.logo.php?qq=${userId}`);
    const randomCp = await getRandomOne(groupId);
    const targetHeadImgBuffer = await loadImage(`https://api.sumt.cn/api/qq.logo.php?qq=${randomCp}`);

    console.log(`将 ${userId} 和 ${randomCp} 组成一对cp`.log);

    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "PINK";
    ctx.fillRect(0, 0, 200, 200);

    // 画用户的头像
    ctx.beginPath();
    ctx.arc(60, 60, 60, 0, 2 * Math.PI);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.drawImage(selfHeadImgBuffer, 0, 0, 120, 120);
    ctx.closePath();
    ctx.restore();

    // 画cp的头像
    ctx.beginPath();
    ctx.arc(140, 140, 60, 0, 2 * Math.PI);
    ctx.fill();
    ctx.clip();
    ctx.drawImage(targetHeadImgBuffer, 80, 80, 120, 120);
    ctx.closePath();

    // 保存图片
    const fileName = `${userId + "x" + randomCp}.jpg`;
    const filePath = path.join(process.cwd(), "static", "xiaoye", "images", fileName);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(filePath, buffer);

    const fileURL = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${fileName}`;

    return { type: "picture", content: { file: fileURL } };
  },
};

const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const fs = require("fs");
const axios = require("axios").default;
const yaml = require("yaml");
let WEB_PORT, GO_CQHTTP_SERVICE_API_URL;

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
  WEB_PORT = resolve.System.WEB_PORT;
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
}


/**
 * 随机选一名幸运群友
 * @param {number} groupId 群号
 * @returns {number} 幸运群友qq
 */
async function getRandomOne(groupId) {
  const groupMemberList = await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_list?group_id=${groupId}`)
    .then(res => {
      return res.data.data;
    })
    .catch(err => {
      console.log(err);
      return [];
    });

  return groupMemberList[Math.floor(Math.random() * groupMemberList.length)].user_id;
}