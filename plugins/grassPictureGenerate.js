module.exports = {
  插件名: "黑白生草图生成器插件",
  指令: "^[/!]?黑白图 (.*)",
  版本: "2.1",
  作者: "Giftina",
  描述: "生成一张黑白生草图。",
  使用示例: "黑白图 当你凝望神圣手雷的时候，神圣手雷也在凝望你 あなたが神圣手雷を見つめるとき、神圣手雷もあなたを見つめています[CQ:image,file=913b054d35b2f4ac1bb85f5dc5f9d62b.image,url=https://gchat.qpic.cn/gchatpic_new/296513927/881350377-2430173961-913B054D35B2F4AC1BB85F5DC5F9D62B/0?term=3,subType=1]",
  预期返回: "[一张黑白生草图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    //获取第一行字符串
    const mainContent = msg.split("[")[0].replace("/黑白图 ", "") ?? "当你凝望神圣手雷的时候，神圣手雷也在凝望你";
    const pictureSources = Constants.img_url_reg.exec(msg)[0] ?? "https://gchat.qpic.cn/gchatpic_new/1005056803/2063243247-2847024251-657109635D3492BDB455DEFA8936AD96/0?term=3"; //取图片链接

    const firstContent = mainContent?.split(" ")[0]?.trim() ?? "当你凝望神圣手雷的时候，神圣手雷也在凝望你"; //第一行内容
    const secondContent = mainContent?.split(" ")[1]?.trim() ?? ""; //第二行内容, 替代"あなたが神圣手雷を見つめるとき、神圣手雷もあなたを見つめています";

    const fileURL = await generatePicture(pictureSources, firstContent, secondContent);
    return { type: "picture", content: fileURL };
  },
};

const { createCanvas, loadImage } = require("canvas"); //用于绘制文字图像，迫害p图
const utils = require("./system/utils.js");
const path = require("path");
const fs = require("fs");
const Constants = require("../config/constants.js");

async function generatePicture(pictureSources, firstContent, secondContent) {
  return new Promise((resolve, reject) => {
    //开始黑白
    const fileURL = loadImage(pictureSources).then((image) => {
      let canvas = createCanvas(
        parseInt(image.width),
        parseInt(image.height + 150),
      ); //根据图片尺寸创建画布，并在下方加文字区
      let ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      ctx.filter = "grayscale";
      ctx.fillStyle = "BLACK";
      ctx.fillRect(
        0,
        parseInt(image.height),
        parseInt(image.width),
        150,
      );
      ctx.font = "40px Sans";
      ctx.textAlign = "center";
      ctx.fillStyle = "WHITE";
      ctx.fillText(
        firstContent,
        parseInt(image.width) / 2,
        parseInt(image.height) + 70,
      ); //第一句
      ctx.font = "28px Sans";
      ctx.fillText(
        secondContent,
        parseInt(image.width) / 2,
        parseInt(image.height) + 110,
      ); //第二句

      //把图片挨个像素转为黑白
      let canvasData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      for (var x = 0; x < canvasData.width; x++) {
        for (var y = 0; y < canvasData.height; y++) {
          // Index of the pixel in the array
          var idx = (x + y * canvasData.width) * 4;
          var r = canvasData.data[idx + 0];
          var g = canvasData.data[idx + 1];
          var b = canvasData.data[idx + 2];

          // calculate gray scale value
          var gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // assign gray scale value
          canvasData.data[idx + 0] = gray; // Red channel
          canvasData.data[idx + 1] = gray; // Green channel
          canvasData.data[idx + 2] = gray; // Blue channel
          canvasData.data[idx + 3] = 255; // Alpha channel

          // add black border
          if (
            x < 8 ||
            y < 8 ||
            x > canvasData.width - 8 ||
            y > canvasData.height - 8
          ) {
            canvasData.data[idx + 0] = 0;
            canvasData.data[idx + 1] = 0;
            canvasData.data[idx + 2] = 0;
          }
        }
      }

      ctx.putImageData(canvasData, 0, 0);

      const fileLocalPath = path.join(
        process.cwd(),
        "static",
        "xiaoye",
        "images",
        `${utils.sha1(canvas.toBuffer())}.jpg`,
      );
      fs.writeFileSync(fileLocalPath, canvas.toBuffer());

      const fileURL = `/images/${utils.sha1(
        canvas.toBuffer(),
      )}.jpg`;
      console.log(`黑白成功，图片发送: ${fileURL}`.log);
      return fileURL;
    });
    resolve(fileURL);
  });
}
