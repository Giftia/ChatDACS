/**
 * - 选择坦克 轻坦
 *   - [列出轻坦，等级 tier 按照玩家实力等级决定]
 * - 加入战斗
 *   - [创建房间，按±2级限制房间等级，2个人即可开始战斗]
 * - 一炮@某人
 *   - [向某人开炮，伤害计算]
 */
module.exports = {
  插件名: "坦克世界RPG游戏插件",
  指令: "^[/!]?开始战斗$|^[/!]?更新数据$",
  版本: "0.1",
  作者: "Giftina",
  描述: "坦克世界模拟器，文字RPG游戏，玩法是依据玩家车辆进行计算伤害，回合制对战。",
  使用示例: "加入战斗",
  预期返回: "",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    let reply = "";

    if (battleCommand.test(msg)) {
      reply = { type: "text", content: "欢迎来到坦克世界小游戏，玩法是依据玩家车辆进行计算伤害，回合制对战。" };
    }
    // 更新游戏数据，只有管理员可以执行此指令
    else if (updateDataCommand.test(msg)) {
      for (let i in QQBOT_ADMIN_LIST) {
        if (userId == QQBOT_ADMIN_LIST[i]) {
          if (options.type === "qq") {
            axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI("开始更新坦克世界基础数据...")}`);
          }
          reply = { type: "text", content: await updateGameData() };
        } else {
          reply = { type: "text", content: "你不是狗管理噢，不能让小夜这样那样的" };
        }
      }
    }

    return reply;
  },
};

const path = require("path");
const fs = require("fs");
const axios = require("axios").default;
const gameData = require(path.join(process.cwd(), "config", "wot.json"));
const yaml = require("yaml");
let GO_CQHTTP_SERVICE_API_URL, QQBOT_ADMIN_LIST;
const baseURL = "https://api.worldoftanks.eu/wot/encyclopedia/vehicles/?application_id=0a833f3e275be2c9b458c61d6cedf644";
const battleCommand = new RegExp(/[/!]?加入战斗$/);
const updateDataCommand = new RegExp(/[/!]?更新数据$/);
const tankType = { 轻坦: "lightTank", 中坦: "mediumTank", 重坦: "heavyTank", 反坦: "AT-SPG", 火炮: "SPG" };

Init();

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

async function Init() {
  const resolve = await ReadConfig();
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
  QQBOT_ADMIN_LIST = resolve.qqBot.QQBOT_ADMIN_LIST;
}


/**
 * 更新游戏数据
 */
async function updateGameData() {
  console.log("开始获取坦克世界在线基础数据...".log);
  // 获取最新的 gameData.json
  const newGameData = await axios.get(baseURL).then(res => res.data);

  console.log("坦克世界在线基础数据获取成功".log);

  if (newGameData.status != "ok") {
    console.log("坦克世界在线基础数据获取失败".error);
    return "坦克世界在线基础数据获取失败";
  }
  // 比对新旧数据，如果有变化，则更新 gameData.json
  else if (newGameData.meta.count == gameData.meta.count) {
    console.log("坦克世界基础数据无变化".log);
    return "坦克世界基础数据已经是最新的";
  }
  console.log("坦克世界基础数据有变化，开始更新".log);

  // 遍历 newGameData.data ，删除每个 provisions 和 description ，没啥用
  for (let key in newGameData.data) {
    if (Object.hasOwnProperty.call(newGameData.data, key)) {
      delete newGameData.data[key].provisions;
      delete newGameData.data[key].description;
    }
  }
  // 写入 gameData.json
  fs.writeFileSync(path.join(process.cwd(), "config", "wot.json"), JSON.stringify(newGameData, null, 4));
  return `坦克世界基础数据更新成功，现有 ${newGameData.meta.count} 辆坦克数据`;
}

/**
 * 坦克数据字段
 */
const fields = ["name", "short_name", "tier", "type", "nation", "prices_xp", "price_credit",
  "price_gold", "is_gift", "is_premium", "is_premium_igr", "is_wheeled"],
  extraFields = ["hp", "hull_hp", "hull_weight", "weight", "speed_forward", "speed_backward",
    "ammo.avg_penetration", "ammo.avg_damage", "dpm", "gun.name", "gun.fire_rate",
    "gun.aim_time", "engine.power"];