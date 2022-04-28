module.exports = {
  插件名: "prpr插件", //插件名，仅在插件加载时展示
  指令: "^/prpr(.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "prpr，来自jjbot的功能", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const bodyPart = [
      "手掌",
      "双脚",
      "熊脸",
      "脸蛋",
      "鼻子",
      "小嘴",
      "咪咪",
      "大雕",
      "蛋蛋",
      "大x [不忍直视]",
      "双眼",
      "脖子",
      "胸口",
      "大腿",
      "脚踝",
      "那里 >////<",
      "腋下",
      "耳朵",
      "小腿",
      "袜子",
      "臭脚",
    ];

    if (!userName) {
      userName = "自己";
    }
    let prprTarget = new RegExp(module.exports.指令).exec(msg)[1].trim();
    //如果没有prpr对象，那么prpr自己
    if (!prprTarget) {
      prprTarget = "自己";
    }

    const random_bodyPart = bodyPart[Math.floor(Math.random() * bodyPart.length)];
    const final = `${userName} 舔了舔 ${prprTarget} 的 ${random_bodyPart}，我好兴奋啊!`;

    return { type: "text", content: final };
  },
};
