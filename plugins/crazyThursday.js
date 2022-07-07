module.exports = {
  插件名: "疯狂星期四插件",
  指令: "疯狂星期四",
  版本: "1.1",
  作者: "Giftina",
  描述: "全自动学习关于 `疯狂星期四` 的语料。只要聊天对话中包含了 `疯狂星期四` ，就会自动学习之，并且回复一段其他的语料。",
  使用示例: "世上77亿人，有253亿只鸡，是人数量三倍。如果鸡与人类开战，你必须要对抗3只鸡，就算它死了，又会有同类补上，就算你一个朋友都没有，你还有三只鸡做敌。今天是肯德基疯狂星期四，V我50，我帮你杀敌",
  预期返回: "我本是显赫世家的大少，却被诡计多端的奸人所害！家人弃我！师门逐我！甚至断我灵脉!重生一世，今天肯德基疯狂星期四!谁请我吃？家人们，别他*垂头丧气了 知道今天是什么日子吗？ 今天是肯德基fucking crazy Thursday！大鸡腿29.9两块 ，家人们v我299，我他*要吃20个。",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const teachMsgChecked = msg.replace(/'/g, ""); //防爆

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

    //随机回复一段疯狂星期四
    return { type: "text", content: await utils.FullContentSearchAnswer("疯狂星期四") };
  },
};

const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
const utils = require("./system/utils.js");
const ChatModel = require(path.join(process.cwd(), "plugins", "system", "model", "chatModel.js"));
let CHAT_BAN_WORDS;

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

//初始化CHAT_BAN_WORDS
async function Init() {
  const resolve = await ReadConfig();
  CHAT_BAN_WORDS = resolve.qqBot.CHAT_BAN_WORDS;
}