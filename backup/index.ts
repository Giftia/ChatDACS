//模块依赖和底层配置
const compression = require("compression"); //用于gzip压缩
const express = require("express"); //轻巧的express框架
const app = require("express")();
app.use(compression()); //对express所有路由启用gzip
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
const http = require("http").Server(app);
const io = require("socket.io")(http);

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

// 初始化类库
import { Global } from './system/Global';
import { Tools } from './system/Tools';
import { Core } from './system/Core';

var global = new Global();
var tools = new Tools(global);
var g = tools.getGlobal();
var core = new Core(g, tools);

tools.init(core);
core.init();
tools.app_start();
