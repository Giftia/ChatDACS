/// <reference path="./system/Global.ts" />
/// <reference path="./system/Core.ts" />
/// <reference path="./system/Tools.ts" />

// 加载全局配置
const Global = require('./system/Global');
var _global = new Global.Global();

//模块依赖和底层配置
const compression = require("compression"); //用于gzip压缩
const express = require("express"); //轻巧的express框架
const app = require("express")();
app.use(compression()); //对express所有路由启用gzip
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
const multer = require("multer"); //用于文件上传
const upload = multer({ dest: "static/uploads/" }); //用户上传目录
const http = require("http").Server(app);
const io = require("socket.io")(http);
const request = require("request");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
const fs = require("fs");
const jieba = require("nodejieba"); //中文分词器
jieba.load({
  dict: Global.jieba_load("jieba.dict.utf8"),
  hmmDict: Global.jieba_load("hmm_model.utf8"),
  userDict: Global.jieba_load("userDict.txt"), //加载自定义分词库
  idfDict: Global.jieba_load("idf.utf8"),
  stopWordDict: Global.jieba_load("stopWordDict.txt"), //加载分词库黑名单
});
const yaml = require("yaml"); //使用yaml解析配置文件
const AipSpeech = require("baidu-aip-sdk").speech; //百度语音sdk
require.all = require("require.all"); //插件加载器
const voiceplayer = require("play-sound")(({ player: `${process.cwd()}/plugins/cmdmp3win.exe` })); //mp3静默播放工具，用于直播时播放语音
const { createCanvas, loadImage } = require("canvas"); //用于绘制文字图像，迫害p图
const { resolve } = require("path");
const os = require("os"); //用于获取系统工作状态
const { exit } = require("process");
const alphabet = require("alphabetjs");
const cookie = require("cookie");

//中文路径检查
const _cn_reg = new RegExp("[\u4e00-\u9fa5]");
if (_cn_reg.test(`${process.cwd()}`)) {
    console.log(
        `因为Unicode的兼容性问题，程序所在路劲不能有汉字日语韩语表情包之类的奇奇怪怪的字符噢，最好使用常规的ASCII字符，请检查！如有疑问，请在QQ群 120243247 内咨询。当前路径：${process.cwd()}`
    );
    while (1);
}

console.log(`当前工作目录：${process.cwd()}`);

// 错误捕获
process.on("uncaughtException", (err) => {
    io.emit("system message", `@未捕获的异常：${err}`);
    console.log(`未捕获的异常，错误：${err}`);
});

//promise错误捕获
process.on("unhandledRejection", (err) => {
    io.emit("system message", `@未捕获的promise异常：${err}`);
    console.log(`未捕获的promise异常：${err}`);
});

const Core = require('./system/Core');
const Tools = require('./system/Tools');

// 初始化类库
var tools = new Tools.Tools();
var core = new Core.Core(app, http, io);

// 初始化配置
tools.init(core, _global);
var g = tools.getGlobal();
core.init(g, tools);
tools.InitConfig();

// 接入接口
tools.app_interface();

// 启动服务
core.start();
