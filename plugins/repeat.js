const repeatStartTimes = 2; // 当消息重复几次时，复读消息

module.exports = {
  插件名: "复读机插件",
  指令: "",
  版本: "2.2",
  作者: "Giftina",
  描述: `特殊插件，没有主动触发指令。当某条消息重复 ${repeatStartTimes} 次时，'小夜牌高保真复读机' 会跟风复读一次。`,
  使用示例: "[某条消息重复了2次]",
  预期返回: "[小夜复读了这条消息]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    // 如果没有msg，说明应该是戳一戳消息
    msg = msg ?? `[CQ:poke,qq=${options.targetId}]`;

    // 如果没有groupId，则是web端或哔哩哔哩端消息，给个0
    groupId = groupId ?? "0";

    // 如果不存在该群组的消息记录，则创建一个
    if (!Object.prototype.hasOwnProperty.call(repeatMap, groupId)) {
      repeatMap[groupId] = {
        latestMessage: msg,
        repeatCount: 1,
      };
    } else {
      // 如果该群最新消息和上一条消息相同，则计数器加1
      if (repeatMap[groupId].latestMessage == msg) {
        repeatMap[groupId].repeatCount++;
      } else {
        // 否则复读不成立，重置计数器
        repeatMap[groupId].latestMessage = msg;
        repeatMap[groupId].repeatCount = 1;
      }
    }

    // 当某条消息重复特定次数时复读一次
    if (repeatMap[groupId].repeatCount == repeatStartTimes) {
      return { type: "text", content: repeatMap[groupId].latestMessage };
    } else if (repeatMap[groupId].repeatCount == repeatStartTimes * 3) {
      return { type: "text", content: "你🐎死了是吧发这么多遍" };
    }
    return "";
  },
};

/**
 * 维护一个 `{ groupId: { latestMessage, repeatCount }, groupId: { latestMessage, repeatCount }, ... }` 的对象，用于记录每个群组的最新的一条消息与复读次数
 */
let repeatMap = {};
