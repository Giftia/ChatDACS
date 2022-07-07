module.exports = {
  插件名: "日程计划提醒插件",
  指令: "^[/!]?提醒(.*)",
  版本: "1.0",
  作者: "Giftina",
  描述: "计划提醒功能，会在指定时刻提醒你。",
  使用示例: "提醒我晚上要手冲",
  预期返回: "好的，我会提醒你晚上要手冲",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const text = new RegExp(module.exports.指令).exec(msg)[1].replace(/我/g, "你");

    // 获取预约天数
    const daySchedule = DayToTime(text);

    // 获取预约时间
    const timeSchedule = TimeToSchedule(text, daySchedule);

    if (!timeSchedule) {
      // 如果没有匹配到预约时间，则返回错误信息
      return { type: "text", content: "小夜不知道该什么时候提醒你呢…要指定提醒时间噢" };
    }

    console.log("创建提醒", timeSchedule);

    schedule.scheduleJob(timeSchedule, function () {
      console.log("触发提醒：" + text);
      if (CONNECT_GO_CQHTTP_SWITCH) {
        axios(
          `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
            `小夜提醒${userName}：${text}`,
          )}`);
      }
    });

    return { type: "text", content: `好的，我会提醒${text}` };
  },
};

const schedule = require("node-schedule");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Shanghai");

const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); // 使用yaml解析配置文件
let GO_CQHTTP_SERVICE_API_URL, CONNECT_GO_CQHTTP_SWITCH;

Init();

// 读取配置文件
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

// 初始化
async function Init() {
  const resolve = await ReadConfig();
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
  CONNECT_GO_CQHTTP_SWITCH = resolve.System.CONNECT_GO_CQHTTP_SWITCH;
}

//天数转换
function DayToTime(text) {
  const dayMap = {
    今天: 0,
    明天: 1,
    后天: 2,
  };

  // 统计字符串中，"后天" 前有几个 "大"，1个 "大" 代表1天
  if (text.includes("大后天")) {
    const x后天 = text.match(/后天/g)[0];
    const howManyNextDay = x后天.match(/大/g).length;
    return howManyNextDay;
  }

  // 获取常规天数
  for (const key in dayMap) {
    if (text.includes(key)) {
      return dayjs().add(dayMap[key], "days");
    }
  }

  // 默认返回当天
  return dayjs();
}

//时间转换
function TimeToSchedule(text, daySchedule) {
  const timeMap = {
    早上: 8,
    中午: 12,
    下午: 15,
    傍晚: 17,
    晚上: 21,
  };

  const delayMap = {
    待会: 10 * 60,
    马上: 10,
  };

  // 将 text 遍历 timeMap
  let hourSchedule = daySchedule;
  for (const key in timeMap) {
    if (text.includes(key)) {
      hourSchedule = dayjs(daySchedule).set("hour", timeMap[key]);
      break;
    }
  }

  // 将 text 遍历 delayMap
  let delaySchedule = daySchedule;
  for (const key in delayMap) {
    if (text.includes(key)) {
      delaySchedule = dayjs(hourSchedule).add(delayMap[key], "seconds");
      break;
    }
  }

  // 最后.toDate();
  return delaySchedule.toDate();
}