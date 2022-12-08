module.exports = {
  插件名: "疯狂星期四插件",
  指令: "疯狂星期四",
  版本: "2.0",
  作者: "Giftina",
  描述: "全自动学习关于 `疯狂星期四` 的语料。只要聊天对话中包含了 `疯狂星期四` ，就会自动学习之，并且回复一段其他的语料。",
  使用示例: "今天是肯德基疯狂星期四，V我50。",
  预期返回: "今天是肯德基fucking crazy Thursday！大鸡腿29.9两块 ，家人们v我299，我他*要吃20个。",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const teachMsgChecked = msg.replace(/'/g, ""); //防爆

    // 获取现有疯狂星期四语料量
    if (teachMsgChecked === "疯狂星期四 -length") {
      const corpus = await ChatModel.findAndCountAll({
        where: {
          ask: "疯狂星期四",
        }
      });
      return { type: "text", content: `小夜现有${corpus.count}条疯狂星期四的语料` };
    }

    // 对于 "疯狂星期四" 视为仅触发语料回复，不学习
    if (teachMsgChecked !== "疯狂星期四") {
      for (let i in CHAT_BAN_WORDS) {
        if (
          teachMsgChecked.toLowerCase().indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1
        ) {
          console.log(
            `疯狂星期四插件: 检测到不允许的词: ${CHAT_BAN_WORDS[i]}，退出教学`.error,
          );
          return { type: "text", content: "你教的疯狂星期四里有主人不允许小夜学习的词qwq" };
        }
      }
      if (teachMsgChecked.length > 350) {
        //图片长度差不多是350左右
        console.log("疯狂星期四插件: 教的太长了，退出教学".error);
        return { type: "text", content: "你教的疯狂星期四太长了，小夜要坏掉了qwq，不要呀" };
      }
      //到这里都没有出错的话就视为没有问题，可以让小夜学了
      console.log("疯狂星期四插件: 没有检测到问题，可以学习".log);

      await ChatModel.create({ ask: "疯狂星期四", answer: teachMsgChecked })
        .then(() => {
          console.log("疯狂星期四插件: 学习成功".log);
        });
    }

    // 随机回复一段疯狂星期四
    return { type: "text", content: await utils.FullContentSearchAnswer("疯狂星期四") };
  },
};

const path = require("path");
const fs = require("fs");
const utils = require("./system/utils.js");
const yaml = require(path.join(process.cwd(), "node_modules/yaml"));
const ChatModel = require(path.join(process.cwd(), "plugins", "system", "model", "chatModel.js"));
let CHAT_BAN_WORDS;

Init();

// 读取配置文件
async function ReadConfig() {
  return await yaml.parse(
    fs.readFileSync(path.join(process.cwd(), "config", "config.yml"), "utf-8")
  );
}

// 初始化CHAT_BAN_WORDS
async function Init() {
  const resolve = await ReadConfig();
  CHAT_BAN_WORDS = resolve.qqBot.CHAT_BAN_WORDS;
}
