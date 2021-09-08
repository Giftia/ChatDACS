"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.Tools = void 0;
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
var path = require("path");
var jieba = require("nodejieba"); //中文分词器
jieba.load({
    dict: path.join("" + process.cwd(), "config", "jieba.dict.utf8"),
    hmmDict: path.join("" + process.cwd(), "config", "hmm_model.utf8"),
    userDict: path.join("" + process.cwd(), "config", "userDict.txt"),
    idfDict: path.join("" + process.cwd(), "config", "idf.utf8"),
    stopWordDict: path.join("" + process.cwd(), "config", "stopWordDict.txt")
});
var yaml = require("yaml"); //使用yaml解析配置文件
var AipSpeech = require("baidu-aip-sdk").speech; //百度语音sdk
var crypto = require("crypto"); //编码库，用于sha1生成文件名
require.all = require("require.all"); //插件加载器
/**
 * Curentyyyymmdd 年月日
 * CurentTime 时分秒
 * sha1 生成唯一文件名
 * Getnews 新闻
 * GetUserData 获取用户信息
 * Bv2Av BV转AV
 * RandomCos 随机cos
 * RandomR18 随机r18
 * SearchTag 搜索tag
 * RandomTbshow 随机买家秀
 * RandomECY 随机二次元图
 * RandomHomeword 随机冷知识
 * RandomNickname 自动随机昵称
 * PrprDoge 舔狗回复
 * ReadConfig 读取配置文件 config.yml
 * InitConfig 初始化配置
 * sqliteAll(query) 异步sqliteALL by@ssp97
 * ChatJiebaFuzzy(msg) 异步结巴 by@ssp97
 * ChatProcess(msg) 聊天处理，最核心区块，超智能(智障)的聊天算法：整句搜索，模糊搜索，分词模糊搜索并轮询
 * SaveQQimg(imgUrl) 保存qq侧传来的图
 * RandomGroupList 随机选取一个群
 * GetBalabalaList 获取balabala
 * TTS(tex) 语音合成TTS
 * BetterTTS(tex) 扒的百度臻品音库-度米朵
 * GetLaststDanmu 获取最新直播间弹幕
 * DelayAlert(service_stoped_list) 随机延时提醒闭菊的群
 * Gugua(who) 私聊发送孤寡
 * QunGugua(who) 群发送孤寡
 * WenDa 百科问答题库
 * ECYWenDa 浓度极高的ACGN圈台词问答题库
 * RainbowPi 彩虹屁回复
 * app_start 接口功能和实现
 */
var Tools = /** @class */ (function () {
    function Tools(global) {
        this.core = null;
        this.global = null;
        this.global = global;
        this.InitConfig();
    }
    Tools.prototype.init = function (core) {
        this.core = core;
    };
    Tools.prototype.getGlobal = function () {
        return this.global;
    };
    //年月日
    Tools.prototype.Curentyyyymmdd = function () {
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth() + 1;
        var day = now.getDate();
        var yyyymmdd = year + "-";
        if (month < 10)
            yyyymmdd += "0";
        yyyymmdd += month + "-";
        if (day < 10)
            yyyymmdd += "0";
        yyyymmdd += day;
        return yyyymmdd;
    };
    //时分秒
    Tools.prototype.CurentTime = function () {
        var now = new Date();
        var hh = now.getHours();
        var mm = now.getMinutes();
        var ss = now.getSeconds();
        var clock = " ";
        if (hh < 10)
            clock += "0";
        clock += hh + ":";
        if (mm < 10)
            clock += "0";
        clock += mm + ":";
        if (ss < 10)
            clock += "0";
        clock += ss + " ";
        return clock;
    };
    //生成唯一文件名
    Tools.prototype.sha1 = function (buf) {
        return crypto.createHash("sha1").update(buf).digest("hex");
    };
    //新闻
    Tools.prototype.Getnews = function () {
        return new Promise(function (resolve, reject) {
            request("https://3g.163.com/touch/reconstruct/article/list/BBM54PGAwangning/0-10.html", function (err, response, body) {
                if (!err && response.statusCode === 200) {
                    body = body.substring(9, body.length - 1);
                    var content_news = "今日要闻：";
                    var main = JSON.parse(body);
                    var news = main.BBM54PGAwangning;
                    for (var id = 0; id < 10; id++) {
                        var print_id = id + 1;
                        content_news += "\r\n" + print_id + "." + news[id].title + "a(" + news[id].url + ")[查看原文]";
                    }
                    resolve(content_news);
                }
                else {
                    reject("获取新闻错误，这个问题雨女无瓜，是新闻接口的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //获取用户信息
    Tools.prototype.GetUserData = function (msg) {
        return new Promise(function (resolve, reject) {
            db.all("SELECT * FROM users WHERE CID = '" + msg + "'", function (err, sql) {
                if (!err && sql[0]) {
                    var nickname = JSON.stringify(sql[0].nickname);
                    var logintimes = JSON.stringify(sql[0].logintimes);
                    var lastlogintime = JSON.stringify(sql[0].lastlogintime);
                    resolve([nickname, logintimes, lastlogintime]);
                }
                else {
                    reject("获取用户信息错误，一般是因为用户第一次登录。错误原因：" + err + ", sql:" + sql[0]);
                }
            });
        });
    };
    //BV转AV
    Tools.prototype.Bv2Av = function (msg) {
        return new Promise(function (resolve, reject) {
            request("https://api.bilibili.com/x/web-interface/view?bvid=" + msg, function (err, response, body) {
                body = JSON.parse(body);
                if (!err && response.statusCode === 200 && body.code === 0) {
                    var content = "a(https://www.bilibili.com/video/av";
                    var av = body.data;
                    var av_number = av.aid;
                    var av_title = av.title;
                    content += av_number + ")[" + av_title + "，av" + av_number + "]";
                    resolve(content);
                }
                else {
                    reject("解析错误，是否输入了不正确的BV号？错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //随机cos
    Tools.prototype.RandomCos = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var rand_page_num = Math.floor(Math.random() * _this.global.cos_total_count);
            request("https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=hot&page_num=" + rand_page_num + "&page_size=1", function (err, response, body) {
                body = JSON.parse(body);
                if (!err && response.statusCode === 200 && body.code === 0 && body.data.total_count != 0) {
                    _this.global.cos_total_count = body.data.total_count;
                    try {
                        var obj = body.data.items[0].item.pictures; //经常出现某个item里没有图片的毛病，阿B你在干什么啊
                    }
                    catch (err) {
                        reject("获取随机cos错误，是B站的锅。这个item里又双草没有图片，阿B你在干什么啊。错误原因：" + JSON.stringify(response.body));
                        return 0;
                    }
                    var count = Object.keys(obj).length;
                    var picUrl = obj[Math.floor(Math.random() * count)].img_src;
                    console.log("cos\u603B\u6570\uFF1A" + _this.global.cos_total_count + "\u9875\uFF0C\u5F53\u524D\u9009\u62E9\uFF1A" + rand_page_num + "\u9875\uFF0C\u53D1\u9001\u56FE\u7247\uFF1A" + picUrl);
                    request(picUrl).pipe(fs.createWriteStream("./static/images/" + picUrl.split("/").pop()).on("close", function (_err) {
                        resolve("/images/" + picUrl.split("/").pop());
                    })); //绕过防盗链，保存为本地图片
                }
                else {
                    reject("获取随机cos错误，是B站的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //随机r18
    Tools.prototype.RandomR18 = function () {
        return new Promise(function (resolve, reject) {
            request("https://api.lolicon.app/setu/v2?r18=1&size=regular", function (err, response, body) {
                body = JSON.parse(body);
                if (!err) {
                    var picUrl = body.data[0].urls.regular;
                    console.log("\u53D1\u9001r18\u56FE\u7247\uFF1A" + picUrl);
                    request(picUrl, function (err) {
                        if (err) {
                            reject("获取tag错误，错误原因：" + err);
                        }
                    }).pipe(fs.createWriteStream("./static/images/" + picUrl.split("/").pop()).on("close", function (_err) {
                        if (!err) {
                            resolve("/images/" + picUrl.split("/").pop());
                        }
                        else {
                            reject("这张色图太大了，下不下来");
                        }
                    })); //绕过防盗链，保存为本地图片
                }
                else {
                    reject("获取随机r18错误，错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //搜索tag
    Tools.prototype.SearchTag = function (tag) {
        return new Promise(function (resolve, reject) {
            request("https://api.lolicon.app/setu/v2?r18=1&size=regular&tag=" + encodeURI(tag), function (err, response, body) {
                body = JSON.parse(body);
                if (!err && body.data[0] != null) {
                    var picUrl = body.data[0].urls.regular;
                    console.log("\u53D1\u9001tag\u56FE\u7247\uFF1A" + picUrl);
                    request(picUrl, function (err) {
                        if (err) {
                            reject(tag + "\u7684\u8272\u56FE\u592A\u5927\u4E86\uFF0C\u4E0B\u4E0D\u4E0B\u6765");
                        }
                    }).pipe(fs.createWriteStream("./static/images/" + picUrl.split("/").pop()).on("close", function (err) {
                        if (!err) {
                            resolve("/images/" + picUrl.split("/").pop());
                        }
                        else {
                            reject(tag + "\u7684\u8272\u56FE\u592A\u5927\u4E86\uFF0C\u4E0B\u4E0D\u4E0B\u6765");
                        }
                    })); //绕过防盗链，保存为本地图片
                }
                else {
                    reject("\u627E\u4E0D\u5230" + tag + "\u7684\u8272\u56FE");
                }
            });
        });
    };
    //随机买家秀
    Tools.prototype.RandomTbshow = function () {
        return new Promise(function (resolve, reject) {
            request("https://api.sumt.cn/api/rand.tbimg.php?token=" + sumtkey + "&format=json", function (err, response, body) {
                body = JSON.parse(body);
                if (!err && body.code === 200) {
                    var picUrl_1 = body.pic_url;
                    request(picUrl_1).pipe(fs.createWriteStream("./static/images/" + picUrl_1.split("/").pop()).on("close", function (_err) {
                        console.log("\u4FDD\u5B58\u4E86\u73CD\u8D35\u7684\u968F\u673A\u4E70\u5BB6\u79C0\uFF1A" + picUrl_1 + "\uFF0C\u7136\u540E\u518D\u7ED9\u7528\u6237");
                    })); //来之不易啊，保存为本地图片
                    resolve(body.pic_url); //但是不给本地地址，还是给的源地址，这样节省带宽
                }
                else {
                    reject("随机买家秀错误，是卡特实验室接口的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //随机二次元图
    Tools.prototype.RandomECY = function () {
        return new Promise(function (resolve, reject) {
            request("https://iw233.cn/api/Random.php", function (err, response, _body) {
                if (!err) {
                    var picUrl_2 = response.request.uri.href;
                    request(picUrl_2).pipe(fs.createWriteStream("./static/images/" + picUrl_2.split("/").pop()).on("close", function (_err) {
                        console.log("\u4FDD\u5B58\u4E86\u597D\u5EB7\u7684\u4E8C\u6B21\u5143\u56FE\uFF1A" + picUrl_2 + "\uFF0C\u7136\u540E\u518D\u7ED9\u7528\u6237");
                    })); //来之不易啊，保存为本地图片
                    resolve(picUrl_2); //但是不给本地地址，还是给的源地址，这样节省带宽
                }
                else {
                    reject("随机二次元图错误，是这个神秘接口的锅。错误原因：图片太鸡儿大了");
                }
            });
        });
    };
    //随机冷知识
    Tools.prototype.RandomHomeword = function () {
        return new Promise(function (resolve, reject) {
            request("https://passport.csdn.net/v1/api/get/homeword", function (err, response, body) {
                body = JSON.parse(body);
                if (!err) {
                    var title = "<h2>" + body.data.title + "</h2>";
                    var content = body.data.content;
                    var count = body.data.count;
                    resolve(title + content + "\r\n—— 有" + count + "人陪你一起已读");
                }
                else {
                    reject("获取随机冷知识错误，这个问题雨女无瓜，是CSDN接口的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //自动随机昵称
    Tools.prototype.RandomNickname = function () {
        return new Promise(function (resolve, reject) {
            request("http://api.tianapi.com/txapi/cname/index?key=" + Tiankey, function (err, response, body) {
                body = JSON.parse(body);
                if (!err) {
                    try {
                        body.newslist[0].naming;
                    }
                    catch (err) {
                        reject("获取随机昵称错误，是天行接口的锅，可能是您还没有配置密钥，这条错误可以无视，不影响正常使用。错误原因：" + JSON.stringify(response.body));
                    }
                    resolve(body.newslist[0].naming);
                }
                else {
                    reject("获取随机昵称错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //舔狗回复
    Tools.prototype.PrprDoge = function () {
        return new Promise(function (resolve, reject) {
            request("http://api.tianapi.com/txapi/tiangou/index?key=" + Tiankey, function (err, response, body) {
                body = JSON.parse(body);
                if (!err) {
                    resolve(body.newslist[0].content);
                }
                else {
                    reject("舔狗错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //读取配置文件 config.yml
    Tools.prototype.ReadConfig = function () {
        return new Promise(function (resolve, reject) {
            console.log("\u5F00\u59CB\u52A0\u8F7D\u2026\u2026");
            fs.readFile(path.join("" + process.cwd(), "config", "config.yml"), "utf-8", function (err, data) {
                if (!err) {
                    resolve(yaml.parse(data));
                }
                else {
                    reject("读取配置文件错误。错误原因：" + err);
                }
            });
        });
    };
    //初始化配置
    Tools.prototype.InitConfig = function () {
        return __awaiter(this, void 0, void 0, function () {
            var resolve;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.ReadConfig()];
                    case 1:
                        resolve = _a.sent();
                        this.global.chat_swich = resolve.System.chat_swich;
                        this.global.conn_go_cqhttp = resolve.System.conn_go_cqhttp;
                        this.global.Now_On_Live = resolve.System.Now_On_Live;
                        this.global.web_port = resolve.System.web_port;
                        this.global.go_cqhttp_service = resolve.System.go_cqhttp_service;
                        this.global.go_cqhttp_api = resolve.System.go_cqhttp_api;
                        this.global.Tiankey = resolve.ApiKey.Tiankey; //天行接口key
                        this.global.sumtkey = resolve.ApiKey.sumtkey; //卡特实验室接口key
                        this.global.baidu_app_id = resolve.ApiKey.baidu_app_id; //百度应用id
                        this.global.baidu_api_key = resolve.ApiKey.baidu_api_key; //百度接口key
                        this.global.baidu_secret_key = resolve.ApiKey.baidu_secret_key; //百度接口密钥
                        this.global.bot_qq = resolve.qqBot.bot_qq; //qqBot使用的qq帐号
                        this.global.qq_admin_list = resolve.qqBot.qq_admin_list; //qqBot小夜的管理员列表
                        this.global.private_service_swich = resolve.qqBot.private_service_swich; //私聊开关
                        this.global.topN = resolve.qqBot.topN; //qqBot限制分词数量
                        this.global.reply_probability = resolve.qqBot.reply_probability; //回复几率
                        this.global.fudu_probability = resolve.qqBot.fudu_probability; //复读几率
                        this.global.chaos_probability = resolve.qqBot.chaos_probability; //抽风几率
                        this.global.req_fuliji_list = resolve.qqBot.req_fuliji_list; //福利姬
                        this.global.req_ECY_list = resolve.qqBot.req_ECY_list; //二次元图
                        this.global.req_no_trap_list = resolve.qqBot.req_no_trap_list; //今日不带套
                        this.global.qqimg_to_web = resolve.qqBot.qqimg_to_web; //保存接收图片开关
                        this.global.max_mine_count = resolve.qqBot.max_mine_count; //最大共存地雷数
                        this.global.black_list_words = resolve.qqBot.black_list_words; //教学系统的黑名单
                        this.global.blive_room_id = resolve.Others.blive_room_id; //哔哩哔哩直播间id
                        this.global.cos_total_count = resolve.Others.cos_total_count; //哔哩哔哩直播间ID
                        this.global.SpeechClient = new AipSpeech(this.global.baidu_app_id, this.global.baidu_api_key, this.global.baidu_secret_key); //建立TTS调用接口
                        console.log("_______________________________________\n");
                        console.log("\n         " + this.global.version + "          \n");
                        if (this.global.chat_swich) {
                            console.log("web端自动聊天开启\n");
                        }
                        else {
                            console.log("web端自动聊天关闭\n");
                        }
                        if (this.global.conn_go_cqhttp) {
                            console.log("qqBot\u5C0F\u591C\u5F00\u542F\uFF0C\u914D\u7F6E\uFF1A\n  \u00B7\u4F7F\u7528QQ\u5E10\u53F7 " + this.global.bot_qq + "\n  \u00B7\u5BF9\u63A5go-cqhttp\u63A5\u53E3 " + this.global.go_cqhttp_api + "\n  \u00B7\u76D1\u542C\u53CD\u5411post\u4E8E 127.0.0.1:" + this.global.web_port + this.global.go_cqhttp_service + "\n  \u00B7\u79C1\u804A\u670D\u52A1\u662F\u5426\u5F00\u542F\uFF1A" + this.global.private_service_swich + "\n");
                            this.global.xiaoye_ated = new RegExp("\\[CQ:at,qq=" + this.global.bot_qq + "\\]"); //匹配小夜被@
                            this.core.start_qqbot();
                        }
                        else {
                            console.log("qqBot小夜关闭\n");
                        }
                        if (this.global.Now_On_Live) {
                            console.log("\u5C0F\u591C\u76F4\u64AD\u5BF9\u7EBF\u5F00\u542F\uFF0C\u8BF7\u786E\u8BA4\u54D4\u54E9\u54D4\u54E9\u76F4\u64AD\u95F4id\u662F\u5426\u4E3A " + this.global.blive_room_id + "\n");
                            this.core.start_live();
                        }
                        else {
                            console.log("小夜直播对线关闭\n");
                        }
                        http.listen(this.global.web_port, function () {
                            console.log("_______________________________________\n");
                            console.log("  " + _this.Curentyyyymmdd() + _this.CurentTime() + " \u542F\u52A8\u5B8C\u6BD5\uFF0C\u8BBF\u95EE 127.0.0.1:" + _this.global.web_port + " \u5373\u53EF\u8FDB\u5165web\u7AEF  \n");
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    //异步sqliteALL by@ssp97
    Tools.prototype.sqliteAll = function (query) {
        return new Promise(function (resolve, reject) {
            db.all(query, function (err, rows) {
                if (err)
                    reject(err.message);
                else {
                    resolve(rows);
                }
            });
        });
    };
    ;
    //异步结巴 by@ssp97
    Tools.prototype.ChatJiebaFuzzy = function (msg) {
        return __awaiter(this, void 0, void 0, function () {
            var candidate, candidateNextList, candidateNextGrand, _a, _b, _i, key, element, rows, k, answer, key, element;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        msg = msg.replace("/", "");
                        msg = jieba.extract(msg, this.global.topN); //按权重分词
                        candidate = [];
                        candidateNextList = [];
                        candidateNextGrand = 0;
                        console.log("\u5206\u8BCD\u51FA\u5173\u952E\u8BCD\uFF1A");
                        console.log(msg);
                        _a = [];
                        for (_b in msg)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        key = _a[_i];
                        if (!Object.hasOwnProperty.call(msg, key)) return [3 /*break*/, 3];
                        element = msg[key];
                        console.log(element);
                        return [4 /*yield*/, this.sqliteAll("SELECT * FROM chat WHERE ask LIKE '%" + element.word + "%'")];
                    case 2:
                        rows = _c.sent();
                        console.log(rows);
                        for (k in rows) {
                            if (Object.hasOwnProperty.call(rows, k)) {
                                answer = rows[k].answer;
                                if (candidate[answer] == undefined) {
                                    candidate[answer] = 1;
                                }
                                else {
                                    candidate[answer] = candidate[answer] + 1;
                                }
                            }
                        }
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        console.log(candidate);
                        // 筛选次数最多
                        for (key in candidate) {
                            if (Object.hasOwnProperty.call(candidate, key)) {
                                element = candidate[key];
                                if (element > candidateNextGrand) {
                                    candidateNextList = [];
                                    candidateNextGrand = element;
                                    candidateNextList.push(key);
                                }
                                else if (element == candidateNextGrand) {
                                    candidateNextList.push(key);
                                }
                            }
                        }
                        console.log(candidateNextList);
                        return [2 /*return*/, candidateNextList];
                }
            });
        });
    };
    //聊天处理，最核心区块，超智能(智障)的聊天算法：整句搜索，模糊搜索，分词模糊搜索并轮询
    Tools.prototype.ChatProcess = function (msg) {
        return __awaiter(this, void 0, void 0, function () {
            var full_search, like_serach, candidateList, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve, _reject) {
                            console.log("开始整句搜索");
                            db.all("SELECT * FROM chat WHERE ask = '" + msg + "'", function (e, sql) {
                                if (!e && sql.length > 0) {
                                    console.log("\u5BF9\u4E8E\u6574\u53E5:  " + msg + " \uFF0C\u5339\u914D\u5230 " + sql.length + " \u6761\u56DE\u590D");
                                    var ans = Math.floor(Math.random() * sql.length);
                                    var answer = JSON.stringify(sql[ans].answer);
                                    answer = answer.replace(/"/g, "");
                                    console.log("\u968F\u673A\u9009\u53D6\u7B2C" + (ans + 1) + "\u6761\u56DE\u590D\uFF1A" + answer);
                                    resolve(answer);
                                    return 0;
                                }
                                else {
                                    console.log("\u804A\u5929\u6570\u636E\u5E93\u4E2D\u6CA1\u6709\u5339\u914D\u5230\u6574\u53E5 " + msg + " \u7684\u56DE\u590D");
                                    resolve();
                                }
                            });
                        })];
                    case 1:
                        full_search = _a.sent();
                        if (full_search) {
                            //优先回复整句匹配
                            console.log("\u8FD4\u56DE\u6574\u53E5\u5339\u914D");
                            return [2 /*return*/, full_search];
                        }
                        return [4 /*yield*/, new Promise(function (resolve, _reject) {
                                console.log("开始模糊搜索");
                                db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg + "%'", function (e, sql) {
                                    if (!e && sql.length > 0) {
                                        console.log("\u6A21\u7CCA\u641C\u7D22: " + msg + " \uFF0C\u5339\u914D\u5230 " + sql.length + " \u6761\u56DE\u590D");
                                        var ans = Math.floor(Math.random() * sql.length);
                                        var answer = JSON.stringify(sql[ans].answer);
                                        answer = answer.replace(/"/g, "");
                                        console.log("\u968F\u673A\u9009\u53D6\u7B2C" + (ans + 1) + "\u6761\u56DE\u590D\uFF1A" + answer);
                                        resolve(answer);
                                        return 0;
                                    }
                                    else {
                                        console.log("\u804A\u5929\u6570\u636E\u5E93\u4E2D\u6CA1\u6709\u5339\u914D\u5230 " + msg + " \u7684\u6A21\u7CCA\u56DE\u590D");
                                        resolve();
                                    }
                                });
                            })];
                    case 2:
                        like_serach = _a.sent();
                        if (like_serach) {
                            //其次是模糊匹配
                            console.log("\u8FD4\u56DE\u6A21\u7CCA\u5339\u914D");
                            return [2 /*return*/, like_serach];
                        }
                        return [4 /*yield*/, this.ChatJiebaFuzzy(msg)];
                    case 3:
                        candidateList = _a.sent();
                        if (candidateList.length > 0) {
                            return [2 /*return*/, candidateList[Math.floor(Math.random() * candidateList.length)]];
                        }
                        return [4 /*yield*/, this.sqliteAll("SELECT * FROM balabala ORDER BY RANDOM()")];
                    case 4:
                        result = _a.sent();
                        //console.log(result)
                        return [2 /*return*/, result[0].balabala];
                }
            });
        });
    };
    //保存qq侧传来的图
    Tools.prototype.SaveQQimg = function (imgUrl) {
        return new Promise(function (resolve, reject) {
            request(imgUrl[0]).pipe(fs.createWriteStream("./static/xiaoye/images/" + imgUrl[0].split("/")[imgUrl[0].split("/").length - 2] + ".jpg").on("close", function (err) {
                if (!err) {
                    resolve("/xiaoye/images/" + imgUrl[0].split("/")[imgUrl[0].split("/").length - 2] + ".jpg");
                }
                else {
                    reject("保存qq侧传来的图错误。错误原因：" + err);
                }
            }));
        });
    };
    //随机选取一个群
    Tools.prototype.RandomGroupList = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            request("http://" + _this.global.go_cqhttp_api + "/get_group_list", function (err, response, body) {
                body = JSON.parse(body);
                if (!err && body.data.length != 0) {
                    var rand_group_num = Math.floor(Math.random() * body.data.length);
                    console.log("随机选取一个群：", body.data[rand_group_num].group_id);
                    resolve(body.data[rand_group_num].group_id);
                }
                else {
                    reject("随机选取一个群错误。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //获取balabala
    Tools.prototype.GetBalabalaList = function () {
        return new Promise(function (resolve, reject) {
            db.all("SELECT * FROM balabala;", function (err, sql) {
                if (!err && sql[0]) {
                    var balabala = sql;
                    resolve(balabala);
                }
                else {
                    reject("获取balabala错误。错误原因：" + err + ", sql:" + sql);
                }
            });
        });
    };
    //语音合成TTS
    Tools.prototype.TTS = function (tex) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!tex)
                tex = "你好谢谢小笼包再见!";
            _this.global.SpeechClient.text2audio(tex, {
                spd: 5,
                pit: 8,
                per: 4
            }).then(function (result) {
                if (result.data) {
                    console.log(tex + " \u7684\u8BED\u97F3\u5408\u6210\u6210\u529F");
                    fs.writeFileSync("./static/xiaoye/tts/" + this.sha1(result.data) + ".mp3", result.data);
                    var file = { file: "/xiaoye/tts/" + this.sha1(result.data) + ".mp3", filename: "小夜语音回复" };
                    resolve(file);
                }
                else {
                    // 合成服务发生错误
                    console.log("\u8BED\u97F3\u5408\u6210\u5931\u8D25\uFF1A" + JSON.stringify(result));
                    reject("语音合成TTS错误：", JSON.stringify(result));
                }
            }, function (err) {
                console.log(err.error);
                reject("语音合成TTS错误：", err);
            });
        });
    };
    //扒的百度臻品音库-度米朵
    Tools.prototype.BetterTTS = function (tex) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!tex)
                tex = "你好谢谢小笼包再见!";
            request("https://ai.baidu.com/aidemo?type=tns&per=4103&spd=6&pit=10&vol=10&aue=6&tex=" + encodeURI(tex), function (err, _response, body) {
                body = JSON.parse(body);
                if (!err && body.data) {
                    console.log(tex + " \u7684\u5E7C\u5973\u7248\u8BED\u97F3\u5408\u6210\u6210\u529F");
                    var base64Data = body.data.replace(/^data:audio\/x-mpeg;base64,/, "");
                    var dataBuffer = Buffer.from(base64Data, "base64");
                    fs.writeFileSync("./static/xiaoye/tts/" + _this.sha1(dataBuffer) + ".mp3", dataBuffer);
                    var file = { file: "/xiaoye/tts/" + _this.sha1(dataBuffer) + ".mp3", filename: "小夜幼女版语音回复" };
                    resolve(file);
                }
                else {
                    //估计被发现扒接口了
                    console.log("\u8BED\u97F3\u5408\u6210\u5E7C\u5973\u7248\u5931\u8D25\uFF1A" + JSON.stringify(body));
                    reject("语音合成幼女版TTS错误：", JSON.stringify(body));
                }
            });
        });
    };
    //获取最新直播间弹幕
    Tools.prototype.GetLaststDanmu = function () {
        return new Promise(function (resolve, reject) {
            request("https://api.live.bilibili.com/xlive/web-room/v1/dM/gethistory?roomid=" + blive_room_id, function (err, response, body) {
                if (!err) {
                    body = JSON.parse(body); //居然返回的是字符串而不是json
                    try {
                        body.data.room[0].text;
                    }
                    catch (err) {
                        reject("直播间刚开，还没有弹幕，请再等等吧", err, response);
                        return 0;
                    }
                    resolve({ text: body.data.room[body.data.room.length - 1].text, timeline: body.data.room[body.data.room.length - 1].timeline });
                }
                else {
                    reject(err, response);
                }
            });
        });
    };
    //随机延时提醒闭菊的群
    Tools.prototype.DelayAlert = function (service_stoped_list) {
        var alert_msg = [
            //提醒文本列表
            "\u545C\u545C\u545C\uFF0C\u628A\u4EBA\u5BB6\u51B7\u843D\u4E86\u90A3\u4E48\u4E45\uFF0C\u80FD\u4E0D\u80FD\u8BA9\u5C0F\u591C\u5F20\u83CA\u4E86\u5462...\u5C0F\u591C\u7684\u5F20\u83CA\u6307\u4EE4\u66F4\u65B0\u4E86\uFF0C\u73B0\u5728\u9700\u8981\u53D1 \u5F20\u83CA[CQ:at,qq=" + this.global.bot_qq + "] \u624D\u53EF\u4EE5\u4E86\u5662",
            "\u95ED\u83CA\u90A3\u4E48\u4E45\u4E86\uFF0C\u6715\u7684\u83CA\u82B1\u75D2\u4E86\uFF01\u8FD8\u4E0D\u5FEB\u8BA9\u5C0F\u591C\u5F20\u83CA\uFF01\u5C0F\u591C\u7684\u5F20\u83CA\u6307\u4EE4\u66F4\u65B0\u4E86\uFF0C\u73B0\u5728\u9700\u8981\u53D1 \u5F20\u83CA[CQ:at,qq=" + this.global.bot_qq + "] \u624D\u53EF\u4EE5\u4E86\u5662",
            "\u5C0F\u591C\u4E5F\u60F3\u4E3A\u5927\u5BB6\u5E26\u6765\u5FEB\u4E50\uFF0C\u6240\u4EE5\u8BA9\u5C0F\u591C\u5F20\u83CA\uFF0C\u597D\u5417\uFF1F\u5C0F\u591C\u7684\u5F20\u83CA\u6307\u4EE4\u66F4\u65B0\u4E86\uFF0C\u73B0\u5728\u9700\u8981\u53D1 \u5F20\u83CA[CQ:at,qq=" + this.global.bot_qq + "] \u624D\u53EF\u4EE5\u4E86\u5662",
            "\u6B27\u5C3C\u9171\uFF0C\u4E0D\u8981\u518D\u65E0\u89C6\u6211\u4E86\uFF0C\u5C0F\u591C\u90A3\u91CC\u5F88\u8212\u670D\u7684\uFF0C\u8BA9\u5C0F\u591C\u5F20\u83CA\u8BD5\u8BD5\u5427~\u5C0F\u591C\u7684\u5F20\u83CA\u6307\u4EE4\u66F4\u65B0\u4E86\uFF0C\u73B0\u5728\u9700\u8981\u53D1 \u5F20\u83CA[CQ:at,qq=" + this.global.bot_qq + "] \u624D\u53EF\u4EE5\u4E86\u5662",
        ];
        var _loop_1 = function (i) {
            var delay_time = Math.floor(Math.random() * 60); //随机延时0到60秒
            var random_alert_msg = alert_msg[Math.floor(Math.random() * alert_msg.length)];
            console.log("qqBot\u5C0F\u591C\u5C06\u4F1A\u5EF6\u65F6 " + delay_time + " \u79D2\u540E\u63D0\u9192\u7FA4 " + service_stoped_list[i] + " \u5F20\u83CA\uFF0C\u63D0\u9192\u6587\u672C\u4E3A\uFF1A" + random_alert_msg);
            setTimeout(function () {
                request("http://" + this.global.go_cqhttp_api + "/send_group_msg?group_id=" + service_stoped_list[i] + "&message=" + encodeURI(random_alert_msg), function (error, _response, _body) {
                    if (!error) {
                        console.log("qqBot\u5C0F\u591C\u63D0\u9192\u4E86\u7FA4 " + service_stoped_list[i] + " \u5F20\u83CA\uFF0C\u63D0\u9192\u6587\u672C\u4E3A\uFF1A" + random_alert_msg);
                    }
                    else {
                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                    }
                });
            }, 1000 * delay_time);
        };
        for (var i in service_stoped_list) {
            _loop_1(i);
        }
    };
    //私聊发送孤寡
    Tools.prototype.Gugua = function (who) {
        var gugua_pic_list = [
            //图片列表
            "1.jpg",
            "2.jpg",
            "3.jpg",
            "4.png",
            "5.gif",
        ];
        var _loop_2 = function (i) {
            var file_online = "http://127.0.0.1:" + this_1.global.web_port + "/xiaoye/ps/" + gugua_pic_list[i];
            var pic_now = "[CQ:image,file=" + file_online + ",url=" + file_online + "]";
            setTimeout(function () {
                request("http://" + this.global.go_cqhttp_api + "/send_private_msg?user_id=" + who + "&message=" + encodeURI(pic_now), function (error, _response, _body) {
                    if (!error) {
                        console.log("qqBot\u5C0F\u591C\u5B64\u5BE1\u4E86 " + who + "\uFF0C\u5B64\u5BE1\u56FE\u4E3A\uFF1A" + pic_now);
                    }
                    else {
                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_private_msg\u9519\u8BEF\uFF1A" + error);
                    }
                });
            }, 1000 * 5 * i);
        };
        var this_1 = this;
        for (var i in gugua_pic_list) {
            _loop_2(i);
        }
    };
    //群发送孤寡
    Tools.prototype.QunGugua = function (who) {
        var gugua_pic_list = [
            //图片列表
            "1.jpg",
            "2.jpg",
            "3.jpg",
            "4.png",
            "5.gif",
        ];
        var _loop_3 = function (i) {
            var file_online = "http://127.0.0.1:" + this_2.global.web_port + "/xiaoye/ps/" + gugua_pic_list[i];
            var pic_now = "[CQ:image,file=" + file_online + ",url=" + file_online + "]";
            setTimeout(function () {
                request("http://" + this.global.go_cqhttp_api + "/send_group_msg?group_id=" + who + "&message=" + encodeURI(pic_now), function (error, _response, _body) {
                    if (!error) {
                        console.log("qqBot\u5C0F\u591C\u5B64\u5BE1\u4E86\u7FA4 " + who + "\uFF0C\u5B64\u5BE1\u56FE\u4E3A\uFF1A" + pic_now);
                    }
                    else {
                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                    }
                });
            }, 1000 * 5 * i);
        };
        var this_2 = this;
        for (var i in gugua_pic_list) {
            _loop_3(i);
        }
    };
    //百科问答题库
    Tools.prototype.WenDa = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            request("http://api.tianapi.com/txapi/wenda/index?key=" + _this.global.Tiankey, function (err, response, body) {
                body = JSON.parse(body);
                if (!err) {
                    resolve({ quest: body.newslist[0].quest, result: body.newslist[0].result });
                }
                else {
                    reject("问答错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //浓度极高的ACGN圈台词问答题库
    Tools.prototype.ECYWenDa = function () {
        var _this = this;
        return new Promise(function (resolve, _reject) {
            request("https://api.oddfar.com/yl/q.php?c=2001&encode=json", function (err, _response, body) {
                body = JSON.parse(body);
                if (!err) {
                    var msg = jieba.extract(body.text, _this.global.topN); //按权重分词
                    if (msg.length == 0) {
                        //如果分词不了，那就直接夜爹牛逼
                        resolve({ quest: "\u554A\u5662\uFF0C\u51FA\u4E0D\u51FA\u9898\u4E86\uFF0C\u4F60\u76F4\u63A5\u56DE\u7B54 \u591C\u7239\u725B\u903C \u5427", result: "\u591C\u7239\u725B\u903C" });
                        return 0;
                    }
                    var rand_word_num = Math.floor(Math.random() * msg.length);
                    var answer = msg[rand_word_num].word;
                    console.log("\u539F\u53E5\u4E3A\uFF1A" + body.text + "\uFF0C\u968F\u673A\u5207\u53BB\u7B2C " + (rand_word_num + 1) + " \u4E2A\u5173\u952E\u8BCD " + answer + " \u4F5C\u4E3A\u7B54\u6848");
                    var quest = body.text.replace(answer, "________");
                    resolve({ quest: quest, result: answer });
                }
                else {
                    resolve({ quest: "\u554A\u5662\uFF0C\u51FA\u4E0D\u51FA\u9898\u4E86\uFF0C\u4F60\u76F4\u63A5\u56DE\u7B54 \u591C\u7239\u725B\u903C \u5427", result: "\u591C\u7239\u725B\u903C" });
                }
            });
        });
    };
    //彩虹屁回复
    Tools.prototype.RainbowPi = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            request("http://api.tianapi.com/txapi/caihongpi/index?key=" + _this.global.Tiankey, function (err, response, body) {
                body = JSON.parse(body);
                if (!err) {
                    resolve(body.newslist[0].content);
                }
                else {
                    reject("彩虹屁错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
                }
            });
        });
    };
    //接口功能和实现
    Tools.prototype.app_start = function () {
        var _this = this;
        //更改个人资料接口
        app.get("/profile", function (req, res) {
            db.run("UPDATE users SET nickname = '" + req.query.name + "' WHERE CID ='" + req.query.CID + "'");
            res.sendFile(process.cwd() + _this.global.html);
        });
        //图片上传接口
        app.post("/upload/image", upload.single("file"), function (req, _res, _next) {
            console.log("\u7528\u6237\u4E0A\u4F20\u56FE\u7247\uFF1A" + req.file);
            var oldname = req.file.path;
            var newname = req.file.path + path.parse(req.file.originalname).ext;
            fs.renameSync(oldname, newname);
            io.emit("pic message", "/uploads/" + req.file.filename + path.parse(req.file.originalname).ext);
        });
        //文件/视频上传接口
        app.post("/upload/file", upload.single("file"), function (req, _res, _next) {
            console.log("\u7528\u6237\u4E0A\u4F20\u6587\u4EF6\uFF1A" + req.file);
            var oldname = req.file.path;
            var newname = req.file.path + path.parse(req.file.originalname).ext;
            fs.renameSync(oldname, newname);
            var isVideo = new RegExp("^video*");
            var isAudio = new RegExp("^audio*");
            var file = { file: "/uploads/" + req.file.filename + path.parse(req.file.originalname).ext, filename: req.file.originalname };
            if (isVideo.test(req.file.mimetype)) {
                io.emit("video message", file);
            }
            else if (isAudio.test(req.file.mimetype)) {
                io.emit("audio message", file);
            }
            else {
                io.emit("file message", file);
            }
        });
    };
    return Tools;
}());
exports.Tools = Tools;
