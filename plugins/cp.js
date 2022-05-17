module.exports = {
  插件名: "cp文生成插件",
  指令: "^[/!]?cp(.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "cp文生成器，语料来自 https://github.com/mxhcpstories/mxh-cp-stories/blob/master/src/assets/story.json",
  使用示例: "cp 小夜 小雫",
  预期返回: "小夜，小雫，你们的爱情是什么样子？",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const CP = new RegExp(module.exports.指令).exec(msg)[1]?.split(" ");

    const tops = CP[1]?.trim() ?? userName ?? "小夜", //小攻
      bottoms = CP[2]?.trim() ?? userName ?? "小雫"; //小受

    const CPStory = await getReplacedCPStory(tops, bottoms);
    return { type: "text", content: CPStory };
  },
};

const fs = require("fs");
const path = require("path");

async function getOriginalRandomCPStory(story, tops, bottoms) {
  //首先查询是否有完全匹配的cp文
  for (let i in story) {
    if (tops == story[i].roles.gong || bottoms == story[i].roles.shou) {
      //从待选cp文中选择一条
      const storyLenth = story[i].stories.length - 1;
      const storyIndex = Math.round(
        Math.random() * storyLenth,
      );
      //选择一条cp文
      return story[i].stories[storyIndex];
    }
  }
  //如果没有完全匹配的cp文，则发送位于cp文数组最后的随机cp文
  const lastIndex = story.length - 1;
  const storyLenth = story[lastIndex].stories.length - 1;
  const storyIndex = Math.round(
    Math.random() * storyLenth,
  );
  //选择一条cp文
  return story[lastIndex].stories[storyIndex];
}

async function getReplacedCPStory(tops, bottoms) {
  const story = fs.readFileSync(
    path.join(process.cwd(), "config", "1and0story.json"), "utf-8",
    function (err, data) {
      if (!err) {
        return data;
      }
    });

  const originalRandomCPStory = await getOriginalRandomCPStory(JSON.parse(story), tops, bottoms);
  //替换角色
  let replacedCPStory = originalRandomCPStory?.replace(/<攻>/g, tops);
  replacedCPStory = replacedCPStory?.replace(/<受>/g, bottoms);
  return replacedCPStory;
}
