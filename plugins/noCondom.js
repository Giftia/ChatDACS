module.exports = {
  插件名: "今日不带套插件", //插件名，仅在插件加载时展示
  指令: "^今[日天]不[带戴]套$", //指令触发关键词，可使用正则表达式匹配
  版本: "1.0", //插件版本，仅在插件加载时展示
  作者: "Giftina", //插件作者，仅在插件加载时展示
  描述: "2018年七夕节彩蛋功能，让小夜帮你计算今天不带套的结果，仅供娱乐", //插件说明，仅在插件加载时展示

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!userName) userName = "小夜";
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    if (month > 2) {
      year++;
    }
    const starSetName =
      "魔羯水瓶双鱼牡羊金牛双子巨蟹狮子处女天秤天蝎射手魔羯";
    const starSetDays = [
      20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22,
    ];
    const starSetResult = starSetName.substr(
      month * 2 - (day < starSetDays[month - 1] ? 2 : 0),
      2,
    );
    const theTwelveChineseZodiacSigns = [
      "猴",
      "鸡",
      "狗",
      "猪",
      "鼠",
      "牛",
      "虎",
      "兔",
      "龙",
      "蛇",
      "马",
      "羊",
    ];
    const theTwelveChineseZodiacSignsResult = /^\d{4}$/.test(year)
      ? theTwelveChineseZodiacSigns[year % 12]
      : false;
    const admittedToKeyUniversitiesProbability = parseInt(Math.random() * (99 - 20 + 1) + 20, 10);

    const final = `小夜温馨提示您: 今日不戴套，小${userName}酱 ${starSetResult}座，属${theTwelveChineseZodiacSignsResult}，${year + 18}年高考，一本机率约${admittedToKeyUniversitiesProbability}%`;

    return { type: "text", content: final };
  },
};
