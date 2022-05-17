module.exports = {
  插件名: "迫害生草图生成器插件",
  指令: "^[/!]?迫害 (.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "让小夜来制作缺德的迫害表情包吧。现在可以迫害的对象：唐可可, 上原步梦, 猛男狗, 令和, 鸭鸭, 陈睿]",
  使用示例: "/迫害 上原步梦 是我，是我先，明明都是我先来的……接吻也好，拥抱也好，还是喜欢上那家伙也好。",
  预期返回: "[一张迫害生草图]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    msg = msg + " "; //结尾加一个空格防爆

    //迫害名单
    const pohai_list = [
      "唐可可",
      "上原步梦",
      "猛男狗",
      "令和",
      "鸭鸭",
      "陈睿",
    ];

    //迫害图片列表
    const pohai_pic_list = [
      "coco_echo.jpg",
      "ayumu_qaq.jpg",
      "doge.jpg",
      "nianhao.jpg",
      "yaya.gif",
      "bilibili.png",
    ];

    let pohai_pic = "coco_echo.jpg"; //迫害图片，如果被迫害人不在迫害名单里，那么默认迫害唐可可

    //迫害文字位置，left、top、rotate、多少字换行、字体大小
    const tex_config_list = {
      唐可可: ["390", "160", "-0.19", "8", "30"],
      上原步梦: ["227", "440", "0", "26", "30"],
      猛男狗: ["200", "100", "0", "0", "30"],
      令和: ["130", "110", "-0.05", "1", "30"],
      鸭鸭: ["30", "30", "0", "2", "30"],
      陈睿: ["94", "390", "-0.01", "12", "15"],
    };

    let tex_config = tex_config_list.唐可可; //默认迫害文字位置是唐可可的

    msg = msg.substr(3).split(" ");
    const pohai_who = msg[1].trim(); //迫害谁
    let pohai_tex = msg[2].trim(); //迫害文字

    //先搜索被迫害人是否在迫害名单里
    for (let i in pohai_list) {
      if (pohai_who === pohai_list[i]) {
        //被迫害人发现
        pohai_pic = pohai_pic_list[i];
        tex_config = tex_config_list[pohai_who];
        console.log(
          `被迫害人 ${pohai_who} 发现，使用迫害图 ${pohai_pic_list[i]}`,
        );
      }
    }

    //如果没有迫害文字的话，应该是省略了被迫害人，如 /迫害 迫害文字 这样，所以迫害文字是第一个参数
    if (!pohai_tex) {
      pohai_tex = msg[1].trim();
    }

    //如果迫害文字里有@某人，将[CQ:at,qq=QQ号]转为昵称
    if (Constants.has_qq_reg.test(pohai_tex)) {
      console.log("存在@内容，将替换为昵称");
      const at_start = pohai_tex.indexOf("[CQ:at,qq="); //取@开始
      const at_end = pohai_tex.indexOf("]"); //取@结束
      const tex_top = pohai_tex.substr(0, at_start); //取除了@外的字符串头
      const tex_bottom = pohai_tex.substr(at_end + 1); //取除了@外的字符串尾
      //获取qq
      let qq_id = pohai_tex.replace("[CQ:at,qq=", "");
      qq_id = qq_id.replace("]", "");
      qq_id = qq_id.trim();
      //如果是正确的qq号则替换
      if (Constants.is_qq_reg.test(qq_id)) {
        //获取qq号在群内的昵称
        axios(
          `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${groupId}&user_id=${qq_id}&no_cache=0`,
          function (error, _response, body) {
            //这一步实在是太慢了啊实在不想异步了
            if (!error) {
              body = JSON.parse(body);
              pohai_tex = `${tex_top}${body.data.nickname}${tex_bottom}`; //拼接为完整的迫害tex
              //如果需要换行，按 tex_config[3] 来换行
              if (pohai_tex.length > tex_config[3]) {
                const enter = tex_config[3];
                let new_pohai_tex = "";
                for (
                  let i = 0, j = 1;
                  i < pohai_tex.length;
                  i++, j++
                ) {
                  if (j && j % enter == 0) {
                    new_pohai_tex += pohai_tex[i] + "\n";
                  } else {
                    new_pohai_tex += pohai_tex[i];
                  }
                }
                pohai_tex = new_pohai_tex;
              }

              //开始p图
              const sources = `${process.cwd()}\\static\\xiaoye\\ps\\${pohai_pic}`; //载入迫害图
              loadImage(sources).then((image) => {
                const canvas = createCanvas(
                  parseInt(image.width),
                  parseInt(image.height),
                ); //根据迫害图尺寸创建画布
                const ctx = canvas.getContext("2d");
                ctx.drawImage(image, 0, 0);
                ctx.font = `${tex_config[4]}px Sans`;
                ctx.textAlign = "center";
                ctx.rotate(tex_config[2]);
                //ctx.fillStyle = "#00ff00";
                const tex_width = Math.floor(
                  ctx.measureText(pohai_tex).width,
                );
                console.log(`文字宽度: ${tex_width}`);

                ctx.fillText(
                  pohai_tex,
                  tex_config[0],
                  tex_config[1],
                );

                const file_local = path.join(
                  process.cwd(),
                  "static",
                  "xiaoye",
                  "images",
                  `${utils.sha1(canvas.toBuffer())}.jpg`,
                );

                fs.writeFileSync(file_local, canvas.toBuffer());

                const fileURL = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${utils.sha1(
                  canvas.toBuffer(),
                )}.jpg`;

                console.log(
                  `迫害成功，图片发送: ${fileURL}`,
                );
                return { type: "text", content: `[CQ:image,file=${fileURL}]` };
              });
            }
          },
        );
      }
    } else {
      //如果需要换行，按 tex_config[3] 来换行
      if (pohai_tex.length > tex_config[3]) {
        const enter = tex_config[3];
        let new_pohai_tex = "";
        for (let i = 0, j = 1; i < pohai_tex.length; i++, j++) {
          if (j && j % enter == 0) {
            new_pohai_tex += pohai_tex[i] + "\n";
          } else {
            new_pohai_tex += pohai_tex[i];
          }
        }
        pohai_tex = new_pohai_tex;
      }
      //开始p图
      const sources = `${process.cwd()}\\static\\xiaoye\\ps\\${pohai_pic}`; //载入迫害图
      loadImage(sources).then((image) => {
        const canvas = createCanvas(
          parseInt(image.width),
          parseInt(image.height),
        ); //根据迫害图尺寸创建画布
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        ctx.font = `${tex_config[4]}px Sans`;
        ctx.textAlign = "center";
        ctx.rotate(tex_config[2]);
        //ctx.fillStyle = "#00ff00";
        const tex_width = Math.floor(
          ctx.measureText(pohai_tex).width,
        );
        console.log(`文字宽度: ${tex_width}`);

        ctx.fillText(pohai_tex, tex_config[0], tex_config[1]);

        const file_local = path.join(
          process.cwd(),
          "static",
          "xiaoye",
          "images",
          `${utils.sha1(canvas.toBuffer())}.jpg`,
        );

        fs.writeFileSync(file_local, canvas.toBuffer());

        const fileURL = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${utils.sha1(
          canvas.toBuffer(),
        )}.jpg`;

        console.log(`迫害成功，图片发送: ${fileURL}`);
        return { type: "text", content: `[CQ:image,file=${fileURL}]` };
      });
    }
  },
};

const { createCanvas, loadImage } = require("canvas"); //用于绘制文字图像，迫害p图
const utils = require("./system/utils.js");
const path = require("path");
const fs = require("fs");
const Constants = require("../config/constants.js");
const axios = require("axios").default;
const yaml = require("yaml"); //使用yaml解析配置文件
let GO_CQHTTP_SERVICE_API_URL, WEB_PORT;

Init();

//读取配置文件
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

//初始化
async function Init() {
  const resolve = await ReadConfig();
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
  WEB_PORT = resolve.System.WEB_PORT;
}
