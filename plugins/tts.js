module.exports = {
  插件名: "语音合成插件", //插件名，仅在插件加载时展示
  指令: "^/吠.*", //指令触发关键词，可使用正则表达式匹配
  版本: "1.1", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "通过百度语音库进行语音合成，语速、语调、声线可调，自由度比较好", //插件说明，仅在插件加载时展示

  execute: async function (msg, qNum, gNum) {
    const tts_file = await TTS(msg);
    return { type: "audio", content: tts_file };
  },
};

const AipSpeech = require("baidu-aip-sdk").speech; //百度语音sdk
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
const utils = require("./system/utils.js");
let SpeechClient, BAIDU_APP_ID, BAIDU_APP_KEY, BAIDU_APP_SECRET_KEY;

Init();

function ReadConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(`${process.cwd()}`, "config", "config.yml"), "utf-8", function (err, data) {
      if (!err) {
        resolve(yaml.parse(data));
      } else {
        reject("读取配置文件错误。错误原因：" + err);
      }
    });
  });
}

async function Init() {
  const resolve = await ReadConfig();
  BAIDU_APP_ID = resolve.ApiKey.BAIDU_APP_ID ?? ""; //百度应用id
  BAIDU_APP_KEY = resolve.ApiKey.BAIDU_APP_KEY ?? ""; //百度接口key
  BAIDU_APP_SECRET_KEY = resolve.ApiKey.BAIDU_APP_SECRET_KEY ?? ""; //百度接口密钥
  SpeechClient = new AipSpeech(BAIDU_APP_ID, BAIDU_APP_KEY, BAIDU_APP_SECRET_KEY);
}

//语音合成TTS
function TTS(tex) {
  return new Promise((resolve, reject) => {
    if (!tex) tex = "你好谢谢小笼包再见!";
    SpeechClient.text2audio(tex, {
      spd: 5, //1-9  语速,正常语速为5
      pit: 8, //1-9  语调,正常语调为5
      per: 4, //1-12 声线,1=2:普通男性,3:有情感的播音男性,4:有情感的萝莉声线-度丫丫;5:普通女性,6:抑扬顿挫有情感的讲故事男性(纪录频道),7:有情感的广东话女性,8:语气平淡的念诗男性(葛平),9:速读普通男性,10:略有情感的刚成年男性,11:刺耳而略有情感的讲故事男性(情感强度比6弱),12:温柔的有情感的讲故事女性,1-12以外的数值会被转为12
    }).then(
      function (result) {
        if (result.data) {
          console.log(`${tex} 的语音合成成功`.log);
          fs.writeFileSync(
            `./static/xiaoye/tts/${utils.sha1(result.data)}.mp3`,
            result.data,
          );
          let file = {
            file: `/xiaoye/tts/${utils.sha1(result.data)}.mp3`,
            filename: "小夜语音回复",
          };
          resolve(file);
        } else {
          // 合成服务发生错误
          console.log(`语音合成失败: ${JSON.stringify(result)}`.error);
          reject("语音合成TTS错误: ", JSON.stringify(result));
        }
      },
      function (err) {
        console.log(err.error);
        reject("语音合成TTS错误: ", err);
      },
    );
  });
}
