const request = require("request");

module.exports = {
  name: "工具类",
  version: "1.0",
  details: "各种公用函数和系统底层函数",

  //年月日
  Curentyyyymmdd() {
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let yyyymmdd = year + "-";
    if (month < 10) yyyymmdd += "0";
    yyyymmdd += month + "-";
    if (day < 10) yyyymmdd += "0";
    yyyymmdd += day;
    return yyyymmdd;
  },

  //时分秒
  CurentTime() {
    let now = new Date();
    let hh = now.getHours();
    let mm = now.getMinutes();
    let ss = now.getSeconds();
    let clock = " ";
    if (hh < 10) clock += "0";
    clock += hh + ":";
    if (mm < 10) clock += "0";
    clock += mm + ":";
    if (ss < 10) clock += "0";
    clock += ss + " ";
    return clock;
  },

  //BV转AV
  async Bv2Av(msg) {
    return new Promise((resolve, reject) => {
      request(
        "https://api.bilibili.com/x/web-interface/view?bvid=" + msg,
        (err, response, body) => {
          body = JSON.parse(body);
          if (!err && response.statusCode === 200 && body.code === 0) {
            var content = "a(https://www.bilibili.com/video/av";
            var av = body.data;
            var av_number = av.aid;
            var av_title = av.title;
            content += av_number + ")[" + av_title + "，av" + av_number + "]";
            resolve(content);
          } else {
            reject(
              "解析错误，是否输入了不正确的BV号？错误原因：" +
              JSON.stringify(response.body),
            );
          }
        },
      );
    });
  },

  //生成唯一文件名
  sha1(buf) {
    const crypto = require("crypto"); //编码库，用于modules.utils.sha1生成文件名
    return crypto.createHash("sha1").update(buf).digest("hex");
  },

  //获取用户信息
  async GetUserData(CID) {
    const sqlite3 = require("sqlite3").verbose();
    const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM users WHERE CID = '" + CID + "'", (err, sql) => {
        if (!err && sql[0]) {
          let nickname = JSON.stringify(sql[0].nickname);
          let logintimes = JSON.stringify(sql[0].logintimes);
          let lastlogintime = JSON.stringify(sql[0].lastlogintime);
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

  //随机冷知识
  async RandomHomeword() {
    return new Promise((resolve, reject) => {
      request(
        "https://passport.csdn.net/v1/api/get/homeword",
        (err, response, body) => {
          body = JSON.parse(body);
          if (!err) {
            var title = "<h2>" + body.data.title + "</h2>";
            var content = body.data.content;
            var count = body.data.count;
            resolve(title + content + "\r\n—— 有" + count + "人陪你一起已读");
          } else {
            reject(
              "获取随机冷知识错误，这个问题雨女无瓜，是CSDN接口的锅。错误原因：" +
              JSON.stringify(response.body),
            );
          }
        },
      );
    });
  },

  //自动随机昵称
  async RandomNickname() {
    return new Promise((resolve, reject) => {
      request(
        `http://api.tianapi.com/txapi/cname/index?key=${Tiankey}`,
        (err, response, body) => {
          body = JSON.parse(body);
          if (!err) {
            try {
              body.newslist[0].naming;
            } catch (err) {
              reject(
                "获取随机昵称错误，是天行接口的锅，可能是您还没有配置密钥，这条错误可以无视，不影响正常使用。错误原因：" +
                JSON.stringify(response.body),
              );
            }
            resolve(body.newslist[0].naming);
          } else {
            reject(
              "获取随机昵称错误，是天行接口的锅。错误原因：" +
              JSON.stringify(response.body),
            );
          }
        },
      );
    });
  },

  //获取tts语音时长
  getMP3Duration(dataBuffer) {
    const mp3Duration = require("mp3-duration");
    return new Promise((resolve, reject) => {
      mp3Duration(dataBuffer, function (err, duration) {
        if (err) {
          reject(err.message);
        }
        resolve(duration);
      });
    });
  },
};
