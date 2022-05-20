module.exports = {
  插件名: "台词名场面搜索插件",
  指令: "^[/!]?名场面 (.*)",
  版本: "1.0",
  作者: "Giftina",
  描述: "根据字幕台词搜索台词出处，原作：https://github.com/windrises/dialogue.moe",
  使用示例: "名场面 不能逃避",
  预期返回: "原作：福音战士新剧场版：序 不能逃避…不能逃避…不能逃避… 不能逃避…不能逃避…不能逃避… 不能逃避",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const text = new RegExp(this.指令).exec(msg)[1];
    console.log("搜索台词：", text);

    const dialogueResult = await axios({
      url: "https://api.dialogue.moe/",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      data: {
        text: text,
        duplicate: true,
      },
    }).then(res => {
      if (res.data.length == 0) {
        return "没有找到结果";
      } else {
        //随机从 res.data.dialogues 数组中取一组对话
        const dialogue = res.data.dialogues[Math.floor(Math.random() * res.data.dialogues.length)];

        const result = `原作：${dialogue.subject_name}
……
${dialogue.text_before}
${dialogue.text_current}
${dialogue.text_after}
……`;

        return result;
      }
    }).catch(err => {
      return "搜索失败", err;
    });

    return { type: "text", content: dialogueResult };
  },
};

const axios = require("axios").default;