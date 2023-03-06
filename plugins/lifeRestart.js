module.exports = {
  插件名: "人生重开模拟器插件",
  指令: "^[/!]?人生重开$|^[/!]?选择天赋 (.*)|^[/!]?分配属性 (.*)|^[/!]?人生总结$",
  版本: "1.1",
  作者: "Giftina",
  描述: "一个人生重开模拟器，区别于原作，该版本非常真实。原作 https://github.com/VickScarlet/lifeRestart",
  使用示例: "人生重开",
  预期返回: "[人生重开的结果]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    let reply = "";

    if (new RegExp(/^[/!]?人生重开$/).test(msg)) {
      reply = await LifeRestart(userId, userName);
    } else if (new RegExp(/^[/!]?选择天赋 (.*)/).test(msg)) {
      reply = await SelectTalents(msg, userId, userName);
    } else if (new RegExp(/^[/!]?分配属性 (.*)/).test(msg)) {
      reply = SetPoints(msg, userId, userName);
    } else if (new RegExp(/^[/!]?人生总结$/).test(msg)) {
      reply = await LifeSummary(userId, userName);
    }

    return { type: "text", content: reply };
  },
};

/**
 * 人生重开，天赋数据来自 https://github.com/VickScarlet/lifeRestart/blob/master/public/data/zh-cn/talents.json
 * @param {string} userId 
 * @param {string} userName
 * @returns 
 */
async function LifeRestart(userId, userName) {
  // 抽选天赋
  const talents = fs.readFileSync(
    path.join(process.cwd(), "config", "talents.json"),
    "utf-8",
    function (err, data) {
      if (!err) {
        return data;
      }
    },
  );

  const reply = await Talents10x(talents)
    .then((resolve) => {
      console.log(
        `玩家 ${userId} 抽选10个随机天赋: ${resolve.randomTalents}`
      );

      // 如果游戏存档不存在该玩家的游戏记录，则创建一个，写入天赋列表
      if (!Object.prototype.hasOwnProperty.call(userData, userId)) {
        userData[userId] = {
          talentsList: resolve.talentsList,
          points: "",
        };
      } else {
        // 如果游戏存档存在该玩家的游戏记录，则更新天赋列表
        userData[userId].talentsList = resolve.talentsList;
      }

      return `${userName} 天赋10连抽: 
${resolve.randomTalents}

请发送 选择天赋 天赋序号`;
    });
  return reply;
}

/**
 * 选择天赋
 * @param {string} msg 
 * @param {string} userId 
 * @param {string} userName
 * @returns 
 */
async function SelectTalents(msg, userId, userName) {
  const assertTalentsID = msg.match(
    /^[/!]?选择天赋 (.*)/,
  )[1]?.split(" ");

  console.log(`玩家 ${userName} 想要选择天赋: ${assertTalentsID}`);

  // 容错，如果有异常值，替换成对应序号
  for (let i in assertTalentsID) {
    if (
      !/^[0-9]$/.test(assertTalentsID[i]) || !assertTalentsID[i]
    ) {
      assertTalentsID.splice(i, 1, i);
    }
  }

  // 查询玩家抽到的天赋列表
  const talentsList = userData[userId].talentsList;
  console.log(`玩家 ${userName} 拥有天赋: ${talentsList}`);

  let selectedTalentsIDs = [],
    selectedTalents = [];
  for (let i in assertTalentsID) {
    selectedTalentsIDs.push(
      talentsList[assertTalentsID[i]],
    );
  }

  console.log(`玩家 ${userName} 选择天赋: ${selectedTalentsIDs}`);

  // 选择的天赋存入游戏存档
  userData[userId].talentsList = selectedTalentsIDs;

  // 挨个去查对应的效果作为回复
  const data = fs.readFileSync(
    path.join(process.cwd(), "config", "talents.json"),
    "utf-8",
    function (err, data) {
      if (!err) {
        return data;
      }
    },
  );

  const talents = JSON.parse(data);

  for (let i in selectedTalentsIDs) {
    // 把index转换为天赋id，取出天赋数据
    const talent = talents[Object.keys(talents)[selectedTalentsIDs[i]]];
    const grade = gradeIconMaps[talent?.grade || 0];

    console.log(talent);

    selectedTalents.push(
      `\n${grade}${talent.description}`
    );
  }

  return `${userName} 天赋生效: 
${selectedTalents}

请发送 分配属性 属性值，属性值之间以空格隔开`;
}

/**
 * 分配初始属性
 * @param {string} msg 
 * @param {string} userId 
 * @param {string} userName
 * @returns 
 */
function SetPoints(msg, userId, userName) {
  const assertPoints = msg.match(
    /^[/!]?分配属性 (.*)/,
  )[1]?.split(" ");

  for (let i = 0; i < 4; i++) {
    if (!assertPoints[i]) {
      assertPoints[i] = 0;
    }
  }

  // 写入游戏存档
  userData[userId].points = assertPoints;

  return `${userName} 已分配属性点: 

颜值: ${assertPoints[0]}
智力: ${assertPoints[1]}
体质: ${assertPoints[2]}
家境: ${assertPoints[3]}

你的新人生开始了: 

0 岁: 体质过低，胎死腹中。
你死了。

请发送 人生总结
`;
}

/**
 * 人生总结
 * @param {string} userId 
 * @param {string} userName
 * @returns 
 */
async function LifeSummary(userId, userName) {
  // 读取玩家游戏存档作总结
  const points = userData[userId].points;

  return `${userName} 人生总结: 

颜值: ${points[0]} 罕见
智力: ${points[1]} 罕见
体质: ${points[2]} 罕见
家境: ${points[3]} 罕见
快乐: 0 罕见
享年: 0 罕见
总评: ${points[0] + points[1] + points[2] + points[3]} 罕见

感谢您的重开，欢迎您下次光临`;
}

/**
 * 抽10个天赋
 * @param {string[]} data 
 * @returns 
 */
async function Talents10x(data) {
  const talents = JSON.parse(data);
  const talentsLength = Object.keys(talents).length;

  let randomTalents = "",
    talentsList = [];
  for (let i = 0; i < 10; i++) {
    // 随机选天赋index
    const randomTalentIndex = Math.floor(Math.random() * talentsLength);
    // 把index转换为天赋id，取出天赋数据
    const talent = talents[Object.keys(talents)[randomTalentIndex]];
    const talentName = talent.name, talentDescription = talent.description;

    // 按天赋稀有度 grade 增加图标
    const grade = gradeIconMaps[talent?.grade || 0];

    // 把天赋名称和描述拼接成一个字符串
    const talentsDescription = `\n${i} ${grade}${talentName}（${talentDescription}）`;
    randomTalents += talentsDescription;
    talentsList.push(randomTalentIndex);
  }
  return { randomTalents: randomTalents, talentsList: talentsList };
}

const fs = require("fs");
const path = require("path");

/**
 * 维护一个 `{ userId: { talentsList: [] , points: {} }, userId: { talentsList: [] , points: {} }, ... }` 的对象，用于记录玩家的游戏存档
 */
const userData = {};

/**
 * 天赋稀有度对应的图标
 */
const gradeIconMaps = {
  0: "💔",
  1: "🤍",
  2: "💛",
  3: "💖",
};
