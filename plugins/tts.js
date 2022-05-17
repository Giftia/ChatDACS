module.exports = {
  插件名: "语音合成插件",
  指令: "^[/!]?吠(.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "让小夜开口说话吧。小夜使用基于大数据的情感幼女语音合成技术，能吠出更自然的发音、更丰富的情感和更强大的表现力。可以插入一些棒读音以提高生草效果。语速、语调、声线可调，自由度比较好。",
  使用示例: "/吠 太好听了吧啊，你唱歌真的好嗷好听啊，简直就是天岸籁，我刚才听到你唱歌了，我们以后一起唱好不好，一起唱昂，一起做学园偶像昂",
  预期返回: "[唐可可中文语音]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const ttsFile = await TTS(msg);
    return { type: "audio", content: ttsFile };
  },
};

const axios = require("axios").default;
const fs = require("fs");
const utils = require("./system/utils.js");

//扒的百度臻品音库-度米朵
async function TTS(msg) {
  const ttsContextFromIncomingMessage = new RegExp(module.exports.指令).exec(msg)[1];
  const ttsContent = ttsContextFromIncomingMessage ? msg.split("/吠")[1] : "你好谢谢小笼包再见!";
  const ttsResult = await axios({
    url: "https://ai.baidu.com/aidemo",
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "Referer": "https://ai.baidu.com/tech/speech/tts_online"
    },
    params: {
      type: "tns",
      lan: "zh",
      per: "4103",
      /**
       * 声线选择, 基础音库：0为度小美，1为度小宇，3为度逍遥，4为度丫丫，
       * 精品音库：5为度小娇，103为度米朵，106为度博文，110为度小童，111为度小萌，默认为度小美
       * 1=2:普通男性,3:有情感的播音男性,4:有情感的萝莉声线-度丫丫;5:普通女性,6:抑扬顿挫有情感的讲故事男性(纪录频道),7:有情感的广东话女性,8:语气平淡的念诗男性(葛平),9:速读普通男性,10:略有情感的刚成年男性,11:刺耳而略有情感的讲故事男性(情感强度比6弱),12:温柔的有情感的讲故事女性
       */
      spd: "7",  //语速，取值0-15，默认为5中语速
      pit: "10", //音调，取值0-15，默认为5中语调
      vol: "9", //音量，取值0-9，默认为5中音量
      aue: "3",  //格式, 3：mp3(default) 4： pcm-16k 5： pcm-8k 6. wav
      tex: encodeURI(ttsContent)
    },
  })
    .then(async function (response) {
      const data = response.data.data;
      if (data) {
        console.log(`${ttsContent} 的小夜语音合成成功`.log);
        const base64Data = data.replace("data:audio/x-mpeg;base64,", "");
        const dataBuffer = Buffer.from(base64Data, "base64");
        const MP3Duration = await utils.getMP3Duration(dataBuffer);
        const ttsFile = `/xiaoye/tts/${utils.sha1(dataBuffer)}.mp3`;
        fs.writeFileSync(`./static${ttsFile}`, dataBuffer);
        const file = {
          file: ttsFile,
          filename: "小夜语音回复",
          duration: MP3Duration,
        };
        return file;
      }
    })
    .catch(function (error) {
      //看来加请求头也不能白嫖了
      console.log(`语音合成小夜TTS失败: ${error}`.error);
      return "语音合成小夜TTS错误: ", error;
    });
  return ttsResult;
}
