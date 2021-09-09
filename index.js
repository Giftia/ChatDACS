/// <reference path="./system/Global.ts" />
/// <reference path="./system/Core.ts" />
/// <reference path="./system/Tools.ts" />
// 加载全局配置
var Global = require('./system/Global');
var _global = new Global.Global();
//模块依赖和底层配置
var compression = require("compression"); //用于gzip压缩
var express = require("express"); //轻巧的express框架
var app = require("express")();
app.use(compression()); //对express所有路由启用gzip
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
var multer = require("multer"); //用于文件上传
var upload = multer({ dest: "static/uploads/" }); //用户上传目录
var http = require("http").Server(app);
var io = require("socket.io")(http);
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
var fs = require("fs");
var jieba = require("nodejieba"); //中文分词器
jieba.load({
    dict: Global.jieba_load("jieba.dict.utf8"),
    hmmDict: Global.jieba_load("hmm_model.utf8"),
    userDict: Global.jieba_load("userDict.txt"),
    idfDict: Global.jieba_load("idf.utf8"),
    stopWordDict: Global.jieba_load("stopWordDict.txt")
});
var yaml = require("yaml"); //使用yaml解析配置文件
var AipSpeech = require("baidu-aip-sdk").speech; //百度语音sdk
require.all = require("require.all"); //插件加载器
var voiceplayer = require("play-sound")(({ player: process.cwd() + "/plugins/cmdmp3win.exe" })); //mp3静默播放工具，用于直播时播放语音
var _a = require("canvas"), createCanvas = _a.createCanvas, loadImage = _a.loadImage; //用于绘制文字图像，迫害p图
var resolve = require("path").resolve;
var os = require("os"); //用于获取系统工作状态
var exit = require("process").exit;
var alphabet = require("alphabetjs");
var cookie = require("cookie");
//中文路径检查
var _cn_reg = new RegExp("[\u4e00-\u9fa5]");
if (_cn_reg.test("" + process.cwd())) {
    console.log("\u56E0\u4E3AUnicode\u7684\u517C\u5BB9\u6027\u95EE\u9898\uFF0C\u7A0B\u5E8F\u6240\u5728\u8DEF\u52B2\u4E0D\u80FD\u6709\u6C49\u5B57\u65E5\u8BED\u97E9\u8BED\u8868\u60C5\u5305\u4E4B\u7C7B\u7684\u5947\u5947\u602A\u602A\u7684\u5B57\u7B26\u5662\uFF0C\u6700\u597D\u4F7F\u7528\u5E38\u89C4\u7684ASCII\u5B57\u7B26\uFF0C\u8BF7\u68C0\u67E5\uFF01\u5982\u6709\u7591\u95EE\uFF0C\u8BF7\u5728QQ\u7FA4 120243247 \u5185\u54A8\u8BE2\u3002\u5F53\u524D\u8DEF\u5F84\uFF1A" + process.cwd());
    while (1)
        ;
}
console.log("\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\uFF1A" + process.cwd());
// 错误捕获
process.on("uncaughtException", function (err) {
    io.emit("system message", "@\u672A\u6355\u83B7\u7684\u5F02\u5E38\uFF1A" + err);
    console.log("\u672A\u6355\u83B7\u7684\u5F02\u5E38\uFF0C\u9519\u8BEF\uFF1A" + err);
});
//promise错误捕获
process.on("unhandledRejection", function (err) {
    io.emit("system message", "@\u672A\u6355\u83B7\u7684promise\u5F02\u5E38\uFF1A" + err);
    console.log("\u672A\u6355\u83B7\u7684promise\u5F02\u5E38\uFF1A" + err);
});
var Core = require('./system/Core');
var Tools = require('./system/Tools');
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
