module.exports = {
  插件名: "迫害生草图生成器插件",
  指令: "^[/!]?迫害 (.*)",
  版本: "2.1",
  作者: "Giftina",
  描述: "让小夜来制作缺德的迫害表情包吧。现在可以迫害的对象：唐可可, 上原步梦, 猛男狗, 令和, 鸭鸭, 陈睿",
  使用示例: "/迫害 上原步梦 是我，是我先，明明都是我先来的……接吻也好，拥抱也好，还是喜欢上那家伙也好。",
  预期返回: "[一张迫害生草图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    msg = msg + " "; // 结尾加一个空格防爆

    // 迫害名单，迫害图片列表，迫害文字位置，left、top、rotate、多少字换行、字体大小
    const pohaiList = {
      唐可可: { pictureName: "coco_echo.jpg", textPosition: { textAlign: "center", left: "390", top: "160", rotate: "-0.19", wordPerLine: "8", fontsize: "30" } },
      上原步梦: { pictureName: "ayumu_qaq.jpg", textPosition: { textAlign: "left", left: "50", top: "440", rotate: "0", wordPerLine: "30", fontsize: "30" } },
      猛男狗: { pictureName: "doge.jpg", textPosition: { textAlign: "center", left: "300", top: "100", rotate: "0", wordPerLine: "0", fontsize: "30" } },
      令和: { pictureName: "nianhao.jpg", textPosition: { textAlign: "center", left: "130", top: "110", rotate: "-0.05", wordPerLine: "1", fontsize: "60" } },
      鸭鸭: { pictureName: "yaya.gif", textPosition: { textAlign: "center", left: "30", top: "30", rotate: "0", wordPerLine: "2", fontsize: "30" } },
      陈睿: { pictureName: "bilibili.png", textPosition: { textAlign: "center", left: "92", top: "385", rotate: "-0.01", wordPerLine: "12", fontsize: "14" } },
    };

    const defaultPohaiTarget = pohaiList.唐可可;

    let pohaiPicture = defaultPohaiTarget.pictureName; // 迫害图片，如果被迫害人不在迫害名单里，那么默认迫害唐可可

    let textPosition = defaultPohaiTarget.textPosition; // 默认迫害文字位置是唐可可的

    msg = msg.replace(/^[/!]?迫害/, "").split(" "); // 把指令拆成数组，第一个是被迫害人，第二个是迫害文字
    const pohaiTarget = msg[1].trim(); // 被迫害人
    let pohaiText = msg[2].trim() ?? pohaiTarget; // 迫害文字，如果没有迫害文字的话，应该是省略了被迫害人，如 /迫害 迫害文字 这样，所以迫害文字是第一个参数

    // 先搜索被迫害人是否在迫害名单里
    const pohaiTargetList = Object.keys(pohaiList);
    for (let i in pohaiTargetList) {
      if (pohaiTarget === pohaiTargetList[i]) {
        // 被迫害人发现
        console.log(
          `被迫害人 ${pohaiTarget} 发现，使用迫害图 ${pohaiPicture}`,
        );
        pohaiPicture = pohaiList[pohaiTargetList[i]].pictureName;
        textPosition = pohaiList[pohaiTargetList[i]].textPosition;
      }
    }

    // 如果迫害文字里有@某人，将[CQ:at,qq=QQ号]转为昵称
    if (Constants.has_qq_reg.test(pohaiText)) {
      console.log("存在@内容，将替换为昵称");
      const at_start = pohaiText.indexOf("[CQ:at,qq="); // 取@开始
      const at_end = pohaiText.indexOf("]"); // 取@结束
      const tex_top = pohaiText.substr(0, at_start); // 取除了@外的字符串头
      const tex_bottom = pohaiText.substr(at_end + 1); // 取除了@外的字符串尾
      // 获取qq
      const who = Constants.has_qq_reg.exec(msg)[1];
      // 如果是正确的qq号则替换
      if (Constants.is_qq_reg.test(who)) {
        // 获取qq号在群内的昵称
        const userNickname = await axios(
          `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${groupId}&user_id=${who}&no_cache=0`,
        ).then((res) => {
          return res.data.nickname;
        });

        pohaiText = `${tex_top}${userNickname}${tex_bottom}`; // 拼接为完整的迫害tex
      }
    }

    // 如果需要换行，按 textPosition.wordPerLine 来换行
    if (pohaiText.length > textPosition.wordPerLine) {
      const enter = textPosition.wordPerLine;
      let new_pohaiText = "";
      for (
        let i = 0, j = 1;
        i < pohaiText.length;
        i++, j++
      ) {
        if (j && j % enter == 0) {
          new_pohaiText += pohaiText[i] + "\n";
        } else {
          new_pohaiText += pohaiText[i];
        }
      }
      pohaiText = new_pohaiText;
    }

    // 开始p图
    const pohaiPicturePath = path.join(process.cwd(), "static", "xiaoye", "ps", pohaiPicture);
    console.log(pohaiPicturePath);
    const fileURL = await loadImage(pohaiPicturePath)
      .then((image) => {
        // 根据迫害图尺寸创建画布
        const canvas = createCanvas(
          parseInt(image.width),
          parseInt(image.height),
        );

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        ctx.font = `${textPosition.fontsize}px Sans`;
        ctx.textAlign = textPosition.textAlign;
        ctx.rotate(textPosition.rotate);
        // ctx.fillStyle = "#00ff00";
        const tex_width = Math.floor(
          ctx.measureText(pohaiText).width,
        );
        console.log(`文字宽度: ${tex_width}`);

        ctx.fillText(
          pohaiText,
          textPosition.left,
          textPosition.top,
        );

        const file_local = path.join(
          process.cwd(),
          "static",
          "xiaoye",
          "images",
          `${utils.sha1(canvas.toBuffer())}.jpg`,
        );

        fs.writeFileSync(file_local, canvas.toBuffer());

        const fileURL = `/xiaoye/images/${utils.sha1(
          canvas.toBuffer(),
        )}.jpg`;

        console.log(
          `迫害成功，图片发送: ${fileURL}`,
        );

        return fileURL;
      });

    return {
      type: "picture", content: { file: fileURL }
    };

  },
};

const { createCanvas, loadImage } = require("canvas"); // 用于绘制文字图像，迫害p图
const utils = require("./system/utils.js");
const path = require("path");
const fs = require("fs");
const Constants = require("../config/constants.js");
const axios = require("axios").default;
const yaml = require("yaml"); // 使用yaml解析配置文件
let GO_CQHTTP_SERVICE_API_URL;

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
