module.exports = {
  插件名: "cp文生成插件", //插件名，仅在插件加载时展示
  指令: "^/cp(.*)", //指令触发关键词，可使用正则表达式匹配
  版本: "1.1", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "cp文生成器，语料来自 https://github.com/mxhcpstories/mxh-cp-stories/blob/master/src/assets/story.json", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const CP = new RegExp(module.exports.指令).exec(msg)[1]?.split(" ");

    const tops = CP[1]?.trim() || userName, //小攻
      bottoms = CP[2]?.trim() || userName; //小受

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
  const storyLenth = story.at(-1).stories.length - 1;
  const storyIndex = Math.round(
    Math.random() * storyLenth,
  );
  //选择一条cp文
  return story.at(-1).stories[storyIndex];
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
  replacedCPStory = originalRandomCPStory?.replace(/<受>/g, bottoms);
  return replacedCPStory;
}
