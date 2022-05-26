/**
 * @name 系统工具类
 * @description 各种公用函数和系统底层函数
 * @version 1.13
 */
module.exports = {
  /**
   * 年月日时分秒
   * @returns {object} { YearMonthDay: "yyyy-mm-dd", Clock: "hh:mm:ss" }
   */
  GetTimes() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    let yearMonthDay = year + "-";
    if (month < 10) yearMonthDay += "0";
    yearMonthDay += month + "-";
    if (day < 10) yearMonthDay += "0";
    yearMonthDay += day;

    const hh = now.getHours();
    const mm = now.getMinutes();
    const ss = now.getSeconds();
    let clock = " ";
    if (hh < 10) clock += "0";
    clock += hh + ":";
    if (mm < 10) clock += "0";
    clock += mm + ":";
    if (ss < 10) clock += "0";
    clock += ss + " ";

    return { YearMonthDay: yearMonthDay, Clock: clock };
  },

  /**
   * 通过sha1生成唯一文件名
   * @param {any} buf 
   * @returns {string} "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   */
  sha1(buf) {
    return crypto.createHash("sha1").update(buf).digest("hex");
  },

  /**
   * 获取用户信息
   * @param {string} CID 
   * @returns {string[]} [ "nickname", "logintimes", "lastlogintime" ]
   */
  async GetUserData(CID) {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM users WHERE CID = '" + CID + "'", (err, sql) => {
        if (!err && sql[0]) {
          const nickname = JSON.stringify(sql[0].nickname);
          const logintimes = JSON.stringify(sql[0].logintimes);
          const lastlogintime = JSON.stringify(sql[0].lastlogintime);
          resolve([nickname, logintimes, lastlogintime]);
        } else {
          reject(
            "获取用户信息错误，一般是因为用户第一次登录。错误原因：" +
            err +
            ", sql:" +
            sql[0],
          );
        }
      });
    });
  },

  /**
   * 自动随机昵称，若没有成功随机到昵称则默认昵称为 匿名
   * @returns {string} "昵称" ?? "匿名"
   */
  async RandomNickname() {
    return new Promise((resolve, _reject) => {
      request(
        `http://api.tianapi.com/txapi/cname/index?key=${TIAN_XING_API_KEY}`,
        (err, _response, body) => {
          body = JSON.parse(body);
          if (!err && body.code == 200) {
            resolve(body.newslist[0].naming);
          } else {
            resolve("匿名");
          }
        },
      );
    });
  },

  /**
   * 获取tts语音时长
   * @param {buffer} dataBuffer 
   * @returns {number} "xxx"(单位为毫秒)
   */
  getMP3Duration(dataBuffer) {
    return new Promise((resolve, reject) => {
      mp3Duration(dataBuffer, function (err, duration) {
        if (err) {
          reject(err.message);
        }
        resolve(duration);
      });
    });
  },

  /**
   * 将插件回复转为web前端能解析的格式
   * @param {string} answer 
   * @returns {object} { type: "picture | directPicture | audio | video | file", content: "内容" }
   */
  PluginAnswerToWebStyle(answer) {
    if (!answer.content?.file) {
      return answer.content;
    }
    const styleMap = {
      picture: `img[${answer.content?.file}]`,
      directPicture: `img[${answer.content?.file}]`,
      audio: `audio[${answer.content?.file}](${answer.content?.filename})`,
      video: `video[${answer.content?.file}](${answer.content?.filename})`,
      file: `file(${answer.content?.file})[${answer.content?.filename}]`,
    };
    return styleMap[answer.type];
  },

  /**
   * 将插件回复转为go-cqhttp能解析的格式
   * @param {string} answer 
   * @returns {object} { type: "picture | directPicture | audio | video | file", content: "内容" }
   */
  PluginAnswerToGoCqhttpStyle(answer) {
    if (!answer.content?.file) {
      return answer.content;
    }
    const styleMap = {
      picture: `[CQ:image,file=${answer.content?.file.indexOf("http") === -1 ? `http://127.0.0.1:${WEB_PORT}${answer.content?.file}` : answer.content?.file}]`,
      directPicture: `[CQ:image,file=${url.pathToFileURL(path.resolve(answer.content?.file))}]`,
      audio: `[CQ:record,file=http://127.0.0.1:${WEB_PORT}${answer.content?.file}]`,
      video: `[CQ:video,file=http://127.0.0.1:${WEB_PORT}${answer.content?.file}]`,
    };
    return styleMap[answer.type];
  },

  /**
   * 将插件回复转为QQ频道能解析的格式
   * @param {string} answer 
   * @returns {object} { type: "picture | directPicture | audio | video | file", content: "内容" }
   */
  PluginAnswerToQQGuildStyle(answer) {
    switch (answer.type) {
      case "picture":
        return {
          image: `http://127.0.0.1:${WEB_PORT}${answer.content?.file}`,
        };
      case "directPicture":
        return {
          image: `http://127.0.0.1:${WEB_PORT}${answer.content?.file.replace("./static", "")}`,
        };
      case "audio":
        return {
          text: answer.content.filename,
          audio: `http://127.0.0.1:${WEB_PORT}${answer.content?.file}`,
        };
      default:
        return {
          text: answer.content,
        };
    }

  },

  /**
   * 保存qq侧传来的图
   * @param {string} imgUrl 
   * @returns {string} "/xiaoye/images/xxx.jpg"
   */
  SaveQQimg(imgUrl) {
    return new Promise((resolve, reject) => {
      const filePath = "/xiaoye/images/";
      const fileName = `${imgUrl[0].split("/")[imgUrl[0].split("/").length - 2]}.jpg`;
      request(imgUrl[0]).pipe(
        fs.createWriteStream(
          `./static${filePath}${fileName}`,
        ).on("close", (err) => {
          if (!err) {
            resolve(
              `${filePath}${fileName}`,
            );
          } else {
            reject("保存qq侧传来的图错误。错误原因: " + err);
          }
        }),
      );
    });
  },

  //随机选取一个群(可以用来启动时加载当前所有群)
  RandomGroupList() {
    return new Promise((resolve, reject) => {
      request(`http://${GO_CQHTTP_SERVICE_API_URL}/get_group_list`, (err, response, body) => {
        body = JSON.parse(body);
        if (!err && body.data.length != 0) {
          const rand_group_num = Math.floor(Math.random() * body.data.length);
          console.log("随机选取一个群: ", body.data[rand_group_num].group_id);
          resolve(body.data[rand_group_num].group_id);
        } else {
          reject(
            "随机选取一个群错误。错误原因: " + JSON.stringify(response.body),
          );
        }
      });
    });
  },

  //随机延时提醒闭菊的群
  DelayAlert(serviceStoppedList) {
    const alertMsg = [
      //提醒文本列表
      "呜呜呜，把人家冷落了那么久，能不能让小夜张菊了呢...",
      "闭菊那么久了，朕的菊花痒了!还不快让小夜张菊!",
      "小夜也想为大家带来快乐，所以让小夜张菊，好吗？",
      "欧尼酱，不要再无视我了，小夜那里很舒服的，让小夜张菊试试吧~",
    ];
    for (let i in serviceStoppedList) {
      const delayTime = Math.floor(Math.random() * 60); //随机延时0到60秒
      const randomAlertMsg =
        alertMsg[Math.floor(Math.random() * alertMsg.length)];
      console.log(
        `小夜将会延时 ${delayTime} 秒后提醒群 ${serviceStoppedList[i]} 张菊，提醒文本为: ${randomAlertMsg}`,
      );
      setTimeout(function () {
        request(
          `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${serviceStoppedList[i]
          }&message=${encodeURI(randomAlertMsg)}`,
          function (error, _response, _body) {
            if (!error) {
              console.log(
                `小夜提醒了群 ${serviceStoppedList[i]} 张菊，提醒文本为: ${randomAlertMsg}`,
              );
            }
          },
        );
      }, 1000 * delayTime);
    }
  },

  //异步sqliteALL by@ssp97
  sqliteAll: function (query) {
    return new Promise(function (resolve, reject) {
      db.all(query, function (err, rows) {
        if (err) {
          reject(err.message);
        } else {
          resolve(rows);
        }
      });
    });
  },

  //私聊发送孤寡
  GuGua(who) {
    const guGuaPicList = [
      //图片列表
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.png",
      "5.gif",
    ];
    for (let i in guGuaPicList) {
      const file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/ps/${guGuaPicList[i]}`;
      const pic_now = `[CQ:image,file=${file_online}]`;
      setTimeout(function () {
        request(
          `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${who}&message=${encodeURI(
            pic_now,
          )}`,
          function (error, _response, _body) {
            if (!error) {
              console.log(`小夜孤寡了 ${who}，孤寡图为: ${pic_now}`.log);
            }
          },
        );
      }, 1000 * 5 * i);
    }
  },

  //群发送孤寡
  QunGuGua(who) {
    const guGuaPicList = [
      //图片列表
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.png",
      "5.gif",
    ];
    for (let i in guGuaPicList) {
      const file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/ps/${guGuaPicList[i]}`;
      const pic_now = `[CQ:image,file=${file_online}]`;
      setTimeout(function () {
        request(
          `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${who}&message=${encodeURI(
            pic_now,
          )}`,
          function (error, _response, _body) {
            if (!error) {
              console.log(`小夜孤寡了群 ${who}，孤寡图为: ${pic_now}`.log);
            }
          },
        );
      }, 1000 * 5 * i);
    }
  },

};

const request = require("request");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml"); //使用yaml解析配置文件
const url = require("url");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
const mp3Duration = require("mp3-duration");
let WEB_PORT, GO_CQHTTP_SERVICE_API_URL, TIAN_XING_API_KEY;

Init();

//读取配置文件
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

//初始化WEB_PORT和TIAN_XING_API_KEY
async function Init() {
  const resolve = await ReadConfig();
  WEB_PORT = resolve.System.WEB_PORT;
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;
  TIAN_XING_API_KEY = resolve.ApiKey.TIAN_XING_API_KEY;
}
