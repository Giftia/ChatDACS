module.exports = {
  插件名: "吧啦吧啦敷衍教学插件", //插件名，仅在插件加载时展示
  指令: "^说不出话 (.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "balabala教学，对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复作为敷衍", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const teachMsg = new RegExp(module.exports.指令).exec(msg)[1];
    const teachMsgChecked = teachMsg.replace(/'/g, ""); //防爆
    console.log(
      `${userId}(${userName}) 想要教给小夜balabala: ${teachMsgChecked}，现在开始检测合法性`.log,
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
          `balabala教学: 检测到不允许的词: ${CHAT_BAN_WORDS[i]}，退出教学`.error,
        );
        return { type: "text", content: "你教的内容里有主人不允许小夜学习的词qwq" };
      }
    }
    console.log("balabala教学: 没有检测到问题，可以学习".log);
    db.run(`INSERT INTO balabala VALUES('${teachMsgChecked}')`);
    console.log("balabala教学: 学习成功".log);
    return { type: "text", content: `哇！小夜学会啦！小夜可能在说不出话的时候说 ${teachMsgChecked} 噢` };
  },
};

const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
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