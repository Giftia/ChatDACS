module.exports = {
  插件名: "壁纸插件",
  指令: "^[/!]?设置壁纸(.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "2022年圣诞节彩蛋，可以给小夜的宿主设置一张指定的壁纸。",
  使用示例: "设置壁纸 [图片]",
  预期返回: "[给宿主设置一张指定壁纸]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const picURI = constants.img_url_reg.exec(msg)[0];
    const picPath = await axios.get(picURI, { responseType: "arraybuffer" }).then(res => {
      const picPath = path.join(__dirname, "../", "static", "images", `wallpaper-${picURI.split("/").reverse()[1]}.jpg`);
      fs.writeFileSync(picPath, res.data);
      return picPath;
    });
    if (picPath) {
      await wallpaper.set(picPath);
      return { type: "text", content: "小夜宿主壁纸设置成功！我要给你打易佰昏！" };
    }
    return { type: "text", content: "小夜宿主壁纸设置失败！是不是还不够色？" };
  },
};

const path = require("path");
const fs = require("fs");
const constants = require("../config/constants.js");
const axios = require(path.join(process.cwd(), "node_modules/axios")).default;
const wallpaper = require(path.join(process.cwd(), "node_modules/wallpaper"));
