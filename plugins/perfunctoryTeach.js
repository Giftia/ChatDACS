module.exports = {
  插件名: "敷衍语料教学插件",
  指令: "^[/!]?说不出话 (.*)",
  版本: "2.2",
  作者: "Giftina",
  描述: "敷衍语料教学，教给小夜一些比较通用的回复。对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复作为敷衍，回复了，但完全没有回复的意义。",
  使用示例: "说不出话 ？",
  预期返回: "哇！小夜学会啦！小夜可能在说不出话的时候回复 ？ 噢",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const teachMsg = new RegExp(module.exports.指令).exec(msg)[1];
    const teachMsgChecked = teachMsg.replace(/'/g, ""); // 防爆
    console.log(
      `${userId}(${userName}) 想要教给小夜敷衍语料: ${teachMsgChecked}，现在开始检测合法性`.log,
    );
    for (let i in CHAT_BAN_WORDS) {
      if (
        teachMsgChecked
          .toLowerCase()
          .indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1 ||
        teachMsgChecked
          .toLowerCase()
          .indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1
      ) {
        console.log(
          `敷衍语料教学: 检测到不允许的词: ${CHAT_BAN_WORDS[i]}，退出教学`.error,
        );
        return { type: "text", content: "你教的内容里有主人不允许小夜学习的词qwq" };
      }
    }
    console.log("敷衍语料教学: 没有检测到问题，可以学习".log);

    await PerfunctoryModel.create({ content: teachMsgChecked })
      .then(() => {
        console.log("敷衍语料教学: 学习成功".log);
      });

    return { type: "text", content: `哇！小夜学会啦！小夜可能在说不出话的时候回复 ${teachMsgChecked} 噢` };
  },
};

const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); // 使用yaml解析配置文件
let CHAT_BAN_WORDS;
const PerfunctoryModel = require(path.join(process.cwd(), "plugins", "system", "model", "perfunctoryModel.js"));

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

// 初始化CHAT_BAN_WORDS
async function Init() {
  const resolve = await ReadConfig();
  CHAT_BAN_WORDS = resolve.qqBot.CHAT_BAN_WORDS;
}
