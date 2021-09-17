module.exports = {
  name: "工具类",
  //年月日
  Curentyyyymmdd: function () {
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
  CurentTime: function () {
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

  //生成唯一文件名
  sha1(buf) {
    const crypto = require("crypto"); //编码库，用于modules.utils.sha1生成文件名
    return crypto.createHash("sha1").update(buf).digest("hex");
  },
};
