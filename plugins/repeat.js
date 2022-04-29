module.exports = {
  插件名: "复读机插件", //插件名，仅在插件加载时展示
  指令: "", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "复读插件，当某条消息重复特定次数时复读一次", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    //如果没有groupId，则是web端或哔哩哔哩端消息，给个0
    groupId = groupId ?? "0";

    //如果不存在该群组的消息记录，则创建一个
    if (!Object.prototype.hasOwnProperty.call(repeatMap, groupId)) {
      repeatMap[groupId] = {
        latestMessage: msg,
        repeatCount: 1,
      };
    } else {
      //如果该群最新消息和上一条消息相同，则计数器加1
      if (repeatMap[groupId].latestMessage == msg) {
        repeatMap[groupId].repeatCount++;
      } else {
        //否则复读不成立，重置计数器
        repeatMap[groupId].latestMessage = msg;
        repeatMap[groupId].repeatCount = 1;
      }
    }

    //当某条消息重复特定次数时复读一次
    if (repeatMap[groupId].repeatCount == repeatStartTimes) {
      return { type: "text", content: repeatMap[groupId].latestMessage };
    }
    return "";
  },
};

const repeatStartTimes = 2; //复读机开始复读消息的前置重复次数
//维护一个 `{ groupId: { latestMessage, repeatCount }, groupId: { latestMessage, repeatCount }, ... }` 的对象，用于记录每个群组的最新的一条消息与复读次数
let repeatMap = {};
