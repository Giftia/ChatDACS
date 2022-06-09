/**
 * 玩家账户密钥，向服务器请求数据时会携带该参数鉴权，具有修改账户的最高权限，需要自行抓包获取，请勿透露给不信任的他人，否则最糟糕的情况可能会导致游戏账户被恶意注销
 */
const authorization = "";

module.exports = {
  插件名: "内测·舞立方信息查询插件",
  指令: "^[/!]?(绑定|个人信息|成绩|机台状态)(.*)",
  版本: "0.1",
  作者: "Giftina",
  描述: "舞立方信息查询，可以查询玩家信息以及机台状态。内测期间，功能会随时增减，返回结果会随时更改，玩家绑定信息会不时失效。",
  使用示例: "个人信息",
  预期返回: "Giftina ♂ 战队：未加入 战力值：1634 全国排行：11796 个人积分：93321 全连率：7.62% 光标速度：7",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    let reply = "";
    const args = msg.split(" ") ?? [];

    if (bindCommand.test(msg)) {
      const playerId = args[1];
      if (!playerId) {
        return { type: "text", content: "好像没有输入舞立方账号呢，绑定指令类似这样：绑定 823258" };
      }
      reply = await BindUser(userId, playerId);
    }
    else if (getPlayerInfoCommand.test(msg)) {
      let playerId = args[1];

      //如果没有携带 playerId 参数，则查询用户有没有绑定玩家，没有则提示绑定
      if (!playerId) {
        if (!Object.prototype.hasOwnProperty.call(playerData, userId)) {
          return { type: "text", content: errorNoData };
        } else {
          playerId = playerData[userId].playerId;
        }
      }

      reply = await AnalysisPlayerInfo(playerId);
    }
    else if (getRankCommand.test(msg)) {
      let playerId = args[1];

      //如果没有携带 playerId 参数，则查询用户有没有绑定玩家，没有则提示绑定
      if (!playerId) {
        if (!Object.prototype.hasOwnProperty.call(playerData, userId)) {
          return { type: "text", content: errorNoData };
        } else {
          playerId = playerData[userId].playerId;
        }
      }

      const musicIndex = args[2] || defaultMusicIndex;
      reply = await GetPlayerRank(playerId, musicIndex);
    }
    else if (getMachineStateCommand.test(msg)) {
      let province = args[1];
      let city = province?.includes("市") ? "市辖区" : args[2];

      //如果没有携带参数，则从绑定信息中获取，没有则提示绑定
      if (!args[1]) {
        if (!Object.prototype.hasOwnProperty.call(playerData, userId)) {
          return { type: "text", content: errorNoData };
        } else {
          const location = await AnalysisLocation(playerData[userId].location);
          if (!location) {
            return { type: "text", content: "解析你的地区失败了，对不起呀，你还可以手动查询，指令如：机台状态 浙江省 杭州市" };
          } else {
            province = location.province;
            city = location.city;
          }
        }
      }

      if (!province || !city) {
        return { type: "text", content: "没有正确指定省份或城市噢，正确指令如：机台状态 浙江省 杭州市，市辖区示例：机台状态 上海市" };
      }

      reply = await GetMachineListByPlace(province, city);
    }

    return { type: "text", content: reply };
  },
};

const bindCommand = new RegExp(/^[/!]?绑定(.*)/);
const getPlayerInfoCommand = new RegExp(/^[/!]?个人信息(.*)/);
const getRankCommand = new RegExp(/^[/!]?成绩(.*)/);
const getMachineStateCommand = new RegExp(/^[/!]?机台状态(.*)/);

const defaultMusicIndex = 6; // 音乐类型，1 最新，2 国语，3 粤语，4 韩文，5 欧美，6 其他
const errorNoData = "你还没有绑定舞立方账号呢，请使用指令 绑定 玩家ID 来绑定你的舞立方账号";

const axios = require("axios").default;
const headers = {
  "Authorization": authorization,
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Html5Plus/1.0 (Immersed/44) uni-app",
  "Host": "dancedemo.shenghuayule.com",
  "Referer": "https://dancedemo.shenghuayule.com/",
};
const baseURL = "https://dancedemo.shenghuayule.com";
const api = {
  playerInfo: baseURL + "/Dance/api/User/GetInfo",
  playerRank: baseURL + "/Dance/api/User/GetMyRank",
  machineListByPlace: baseURL + "/Dance/OAuth/GetMachineListByPlace",
};

/**
 * 玩家绑定
 * @param {string} userId 用户qq
 * @param {string} playerId 玩家id
 */
async function BindUser(userId, playerId) {
  const playerInfo = await GetPlayerInfo(playerId);
  if (!playerInfo.UserID) {
    return "这个玩家找不到呢，是不是输错id了呢";
  }
  //如果的绑定信息不存在，则创建
  if (!Object.prototype.hasOwnProperty.call(playerData, userId)) {
    playerData[userId] = {
      playerId: playerInfo.UserID,
      playerName: playerInfo.UserName,
      location: playerInfo.CityName,
    };
    return `绑定成功，现在你绑定的账号是 ${playerInfo.UserName}`;
  } else {
    //如果的绑定信息存在，则更新
    playerData[userId].talentsList = playerData.talentsList;
    return `换绑成功，现在你绑定的账号是 ${playerInfo.UserName}`;
  }
}

/**
 * 解析玩家信息
 * @param {string} playerId 玩家id
 */
async function AnalysisPlayerInfo(playerId) {
  const playerInfo = await GetPlayerInfo(playerId);
  if (!playerInfo) {
    return "这个玩家找不到呢，是不是输错了呢";
  } else {
    const sex = playerInfo.Sex ? "♂" : "♀";

    return `${playerInfo.UserName} ${sex}
战队：${playerInfo.TeamName ?? "未加入"}
战力值：${playerInfo.LvRatio}
全国排行：${playerInfo.RankNation}
个人积分：${playerInfo.MusicScore}
全连率：${playerInfo.ComboPercent / 100}%
光标速度：${playerInfo.MusicSpeed}`;
  }
}

/**
 * 查询玩家Json信息
 * @param {string} playerId 玩家id
 */
async function GetPlayerInfo(playerId) {
  const playerInfo = await axios.get(api.playerInfo, {
    headers: headers,
    params: {
      userId: playerId,
    },
  })
    .then(async function (response) {
      return response.data;
    })
    .catch(function (error) {
      console.log(`获取玩家资料失败: ${error}`.error);
      return "获取玩家资料失败: ", error;
    });
  return playerInfo;
}

/**
 * 查询玩家成绩榜
 * @param {string} playerId 玩家id
 * @param {string} musicIndex 音乐类型，1 最新，2 国语，3 粤语，4 韩文，5 欧美，6 其他
 */
async function GetPlayerRank(playerId, musicIndex) {
  const playerRank = await axios.get(api.playerRank, {
    headers: headers,
    params: {
      musicIndex: musicIndex,
      userId: playerId,
    },
  })
    .then(async function (response) {
      return response.data;
    })
    .catch(function (error) {
      console.log(`获取玩家成绩榜失败: ${error}`.error);
      return "获取玩家成绩榜失败: ", error;
    });
  return playerRank;
}

/**
 * 根据省市查询机台状态
 * @param {string} province 省
 * @param {string} city 市
 */
async function GetMachineListByPlace(province, city) {
  const machineList = await axios.get(api.machineListByPlace, {
    headers: headers,
    params: {
      province: province,
      city: city,
    },
  })
    .then(async function (response) {
      const machineList = response.data;
      const reply = machineList.map((machine) => {
        const machineName = machine.PlaceName.replace(/\n/g, "");
        const address = machine.Address.replace(/\n/g, "");
        const status = machine.Online ? "🟢" : "🔴";
        const machineGeneration = machine.Img1.includes("9700") ? "Ⅰ代" : "Ⅱ代"; // 按机台图片名判断其实不是很准确，但是大致看了下八九不离十
        return `${status}${machineName} ${machineGeneration}\n${address}\n`;
      });
      return `${province}${city}机台状态：

${reply.join("\n")}

（机台在线状态和世代仅供参考，以实际状态为准）
`;
    })
    .catch(function (error) {
      console.log(`获取机台状态失败: ${error}`.error);
      return "获取机台状态失败: ", error;
    });
  return machineList;
}

/**
 * 根据 location 解析省市
 * @param {string} location
 */
async function AnalysisLocation(location) {
  // 简陋的省份解析
  let province = location.slice(0, 2);
  let city = location.slice(2, 4);

  if (!province || !city) {
    return;
  }

  province += "省";
  city += "市";
  return { province, city };
}

/**
 * 维护一个 `{ userId: { playerId: "", playerName: "", location: "" }, userId: { playerId: "", playerName: "", location: "" }, ... }` 的对象，用于记录玩家的绑定信息
 */
const playerData = {};