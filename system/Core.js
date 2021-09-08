"use strict";
/// <reference path="Global.ts" />
/// <reference path="this.tools.ts" />
exports.__esModule = true;
exports.Core = void 0;
//模块依赖和底层配置
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
require.all = require("require.all"); //插件加载器
var voiceplayer = require("play-sound")(({ player: process.cwd() + "/plugins/cmdmp3win.exe" })); //mp3静默播放工具，用于直播时播放语音
var _a = require("canvas"), createCanvas = _a.createCanvas, loadImage = _a.loadImage; //用于绘制文字图像，迫害p图
var os = require("os"); //用于获取系统工作状态
var alphabet = require("alphabetjs");
var cookie = require("cookie");
var Core = /** @class */ (function () {
    function Core(app, http, io) {
        this.app = app;
        this.http = http;
        this.io = io;
    }
    Core.prototype.init = function (global, tools) {
        this.global = global;
        this.tools = tools;
    };
    Core.prototype.start = function () {
        var _this = this;
        // 306
        this.http.listen(this.global.web_port, function () {
            console.log("_______________________________________\n");
            console.log("  " + _this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + " \u542F\u52A8\u5B8C\u6BD5\uFF0C\u8BBF\u95EE 127.0.0.1:" + _this.global.web_port + " \u5373\u53EF\u8FDB\u5165web\u7AEF  \n");
        });
        //web端核心代码，socket事件处理
        this.io.on("connection", function (socket) {
            socket.emit("getcookie");
            var CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
            if (CID === undefined) {
                socket.emit("getcookie");
                return 0;
            }
            socket.emit("version", _this.global.version);
            _this.io.emit("onlineusers", ++_this.global.onlineusers);
            //开始获取用户信息并处理
            _this.tools.GetUserData(CID)
                .then(function (_a) {
                var nickname = _a[0], logintimes = _a[1], lastlogintime = _a[2];
                console.log(_this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + "\u7528\u6237 " + nickname + "(" + CID + ") \u5DF2\u8FDE\u63A5");
                //更新登录次数
                db.run("UPDATE users SET logintimes = logintimes + 1 WHERE CID ='" + CID + "'");
                //更新最后登陆时间
                db.run("UPDATE users SET lastlogintime = '" + _this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + "' WHERE CID ='" + CID + "'");
                socket.username = nickname;
                _this.io.emit("system message", "@\u6B22\u8FCE\u56DE\u6765\uFF0C" + socket.username + "(" + CID + ") \u3002\u8FD9\u662F\u4F60\u7B2C" + logintimes + "\u6B21\u8BBF\u95EE\u3002\u4E0A\u6B21\u8BBF\u95EE\u65F6\u95F4\uFF1A" + lastlogintime);
            })["catch"](function (reject) {
                var CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
                console.log("GetUserData(): rejected, and err:" + reject);
                console.log(_this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + "\u65B0\u7528\u6237 " + CID + " \u5DF2\u8FDE\u63A5");
                _this.tools.RandomNickname()
                    .then(function (resolve) {
                    db.run("INSERT INTO users VALUES('" + resolve + "', '" + CID + "', '2', '" + _this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + "')");
                    socket.username = resolve;
                    _this.io.emit("system message", "@\u65B0\u7528\u6237 " + CID + " \u5DF2\u8FDE\u63A5\u3002\u5C0F\u591C\u5E2E\u4F60\u53D6\u4E86\u4E00\u4E2A\u968F\u673A\u6635\u79F0\uFF1A\u300C" + socket.username + "\u300D\uFF0C\u8BF7\u524D\u5F80 \u66F4\u591A-\u8BBE\u7F6E \u6765\u66F4\u6539\u6635\u79F0");
                    socket.emit("chat message", {
                        CID: "0",
                        msg: _this.global.help
                    });
                })["catch"](function (reject) {
                    console.log("\u968F\u673A\u6635\u79F0\u9519\u8BEF\uFF1A" + reject);
                    db.run("INSERT INTO users VALUES('\u533F\u540D', '" + CID + "', '2', '" + _this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + "')");
                    socket.username = "匿名";
                    _this.io.emit("system message", "@\u65B0\u7528\u6237 " + CID + " \u5DF2\u8FDE\u63A5\u3002\u73B0\u5728\u4F60\u7684\u6635\u79F0\u662F \u533F\u540D \u5662\uFF0C\u8BF7\u524D\u5F80 \u66F4\u591A-\u8BBE\u7F6E \u6765\u66F4\u6539\u6635\u79F0");
                    socket.emit("chat message", {
                        CID: "0",
                        msg: _this.global.help
                    });
                });
            });
            socket.on("disconnect", function () {
                _this.global.onlineusers--;
                _this.io.emit("onlineusers", _this.global.onlineusers);
                console.log("" + _this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + " \u7528\u6237 " + socket.username + " \u5DF2\u65AD\u5F00\u8FDE\u63A5");
                _this.io.emit("system message", "@用户 " + socket.username + " 已断开连接");
            });
            socket.on("typing", function () {
                _this.io.emit("typing", socket.username + " \u6B63\u5728\u8F93\u5165...");
            });
            socket.on("typing_over", function () {
                _this.io.emit("typing", "");
            });
            //用户设置
            socket.on("getsettings", function () {
                var CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
                socket.emit("settings", { CID: CID, name: socket.username });
            });
            //更新日志
            socket.on("getupdatelog", function () {
                socket.emit("updatelog", _this.global.updatelog);
            });
            //致谢列表
            socket.on("thanks", function () {
                socket.emit("thanks", _this.global.thanks);
            });
            //web端最核心代码，聊天处理
            socket.on("chat message", function (msg) {
                var CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
                var msg = msg.msg;
                msg = msg.replace(/'/g, ""); //防爆
                msg = msg.replace(/</g, ""); //防爆
                msg = msg.replace(/>/g, ""); //防爆
                console.log(_this.tools.Curentyyyymmdd() + _this.tools.CurentTime() + "\u6536\u5230\u7528\u6237 " + socket.username + "(" + CID + ") \u7684\u6D88\u606F: " + msg);
                db.run("INSERT INTO messages VALUES('" + _this.tools.Curentyyyymmdd() + "', '" + _this.tools.CurentTime() + "', '" + CID + "', '" + msg + "')");
                _this.io.emit("chat message", { CID: CID, name: socket.username, msg: msg }); //用户广播
                //开始if地狱
                if (_this.global.rename_reg.test(msg)) {
                    db.run("UPDATE users SET nickname = '" + msg.slice(8) + "' WHERE CID ='" + CID + "'");
                    _this.io.emit("chat message", {
                        CID: "0",
                        msg: "@\u6635\u79F0\u91CD\u547D\u540D\u5B8C\u6BD5\uFF0C\u5C0F\u591C\u73B0\u5728\u4F1A\u79F0\u547C\u4F60\u4E3A " + msg.slice(8) + " \u5566"
                    });
                }
                else if (msg === "/log_view") {
                    db.all("SELECT yyyymmdd, COUNT(*) As count FROM messages Group by yyyymmdd", function (e, sql) {
                        var data = [];
                        if (!e) {
                            for (var i = 0; i < sql.length; i++) {
                                data.push([sql[i].yyyymmdd, sql[i].count]);
                            }
                            console.log(data);
                            _this.io.emit("chart message", data);
                        }
                        else {
                            console.log("/log_view\u9519\u8BEF\uFF1A" + e);
                            _this.io.emit("chat message", { CID: "0", msg: "@" + e });
                        }
                    });
                }
                else if (_this.global.bv2av_reg.test(msg)) {
                    msg = msg.replace(" ", "");
                    _this.tools.Bv2Av(msg)
                        .then(function (resolve) {
                        _this.io.emit("chat message", { CID: "0", msg: resolve });
                    })["catch"](function (reject) {
                        console.log("Bv2Av(): rejected, and err:" + reject);
                        _this.io.emit("system message", "@Bv2Av() err:" + reject);
                    });
                }
                else if (msg === "/reload") {
                    _this.io.emit("reload");
                }
                else if (msg === "/帮助") {
                    _this.io.emit("chat message", { CID: "0", msg: "@" + _this.global.help });
                }
                else if (msg === "/随机cos") {
                    _this.tools.RandomCos()
                        .then(function (resolve) {
                        _this.io.emit("pic message", resolve);
                    })["catch"](function (reject) {
                        console.log("RandomCos(): rejected, and err:" + reject);
                        _this.io.emit("system message", "@RandomCos() err:" + reject);
                    });
                }
                else if (msg === "/随机买家秀") {
                    _this.tools.RandomTbshow()
                        .then(function (resolve) {
                        _this.io.emit("pic message", resolve);
                    })["catch"](function (reject) {
                        console.log("RandomTbshow(): rejected, and err:" + reject);
                        _this.io.emit("system message", "@RandomTbshow() err:" + reject);
                    });
                }
                else if (msg === "/随机冷知识") {
                    _this.tools.RandomHomeword()
                        .then(function (resolve) {
                        _this.io.emit("chat message", { CID: "0", msg: "@" + resolve });
                    })["catch"](function (reject) {
                        console.log("RandomHomeword(): rejected, and err:" + reject);
                        _this.io.emit("system message", "@RandomHomeword() err:" + reject);
                    });
                }
                else if (msg === "/随机二次元图") {
                    _this.tools.RandomECY()
                        .then(function (resolve) {
                        _this.io.emit("pic message", resolve);
                    })["catch"](function (reject) {
                        console.log("RandomECY(): rejected, and err:" + reject);
                        _this.io.emit("system message", "@RandomECY() err:" + reject);
                    });
                } //吠
                else if (_this.global.yap_reg.test(msg)) {
                    msg = msg.replace("/吠 ", "");
                    msg = msg.replace("/吠", "");
                    _this.tools.BetterTTS(msg)
                        .then(function (resolve) {
                        _this.io.emit("audio message", resolve);
                    })["catch"](function (reject) {
                        console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        _this.io.emit("system message", "@TTS\u9519\u8BEF\uFF1A" + reject);
                    });
                } //教学系统，抄板于虹原翼版小夜v3
                else if (_this.global.teach_reg.test(msg)) {
                    msg = msg.substr(2).split("答：");
                    if (msg.length !== 2) {
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5206\u5272\u6709\u8BEF\uFF0C\u9000\u51FA\u6559\u5B66");
                        _this.io.emit("system message", "@\u4F60\u6559\u7684\u59FF\u52BF\u4E0D\u5BF9\u5662qwq");
                        return 0;
                    }
                    var ask = msg[0].trim(), ans = msg[1].trim();
                    if (ask == "" || ans == "") {
                        console.log("\u95EE/\u7B54\u4E3A\u7A7A\uFF0C\u9000\u51FA\u6559\u5B66");
                        _this.io.emit("system message", "@\u4F60\u6559\u7684\u59FF\u52BF\u4E0D\u5BF9\u5662qwq");
                        return 0;
                    }
                    if (ask.indexOf(/\r?\n/g) !== -1) {
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5173\u952E\u8BCD\u6362\u884C\u4E86\uFF0C\u9000\u51FA\u6559\u5B66");
                        _this.io.emit("system message", "@\u5173\u952E\u8BCD\u4E0D\u80FD\u6362\u884C\u5566qwq");
                        return 0;
                    }
                    console.log("web\u7AEF " + socket.username + " \u60F3\u8981\u6559\u7ED9\u5C0F\u591C\uFF1A\u95EE\uFF1A" + ask + " \u7B54\uFF1A" + ans + "\uFF0C\u73B0\u5728\u5F00\u59CB\u68C0\u6D4B\u5408\u6CD5\u6027");
                    for (var i in _this.global.black_list_words) {
                        if (ask.toLowerCase().indexOf(_this.global.black_list_words[i].toLowerCase()) !== -1 ||
                            ans.toLowerCase().indexOf(_this.global.black_list_words[i].toLowerCase()) !== -1) {
                            console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u68C0\u6D4B\u5230\u4E0D\u5141\u8BB8\u7684\u8BCD\uFF1A" + _this.global.black_list_words[i] + "\uFF0C\u9000\u51FA\u6559\u5B66");
                            _this.io.emit("system message", "@\u4F60\u6559\u7684\u5185\u5BB9\u91CC\u6709\u4E3B\u4EBA\u4E0D\u5141\u8BB8\u5C0F\u591C\u5B66\u4E60\u7684\u8BCDqwq");
                            return 0;
                        }
                    }
                    if (Buffer.from(ask).length < 4) {
                        //关键词最低长度：4个英文或2个汉字
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5173\u952E\u8BCD\u592A\u77ED\uFF0C\u9000\u51FA\u6559\u5B66");
                        _this.io.emit("system message", "@\u5173\u952E\u8BCD\u592A\u77ED\u4E86\u5566qwq\uFF0C\u81F3\u5C11\u89814\u4E2A\u5B57\u8282\u5566");
                        return 0;
                    }
                    if (ask.length > 350 || ans.length > 350) {
                        //图片长度差不多是350左右
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u6559\u7684\u592A\u957F\u4E86\uFF0C\u9000\u51FA\u6559\u5B66");
                        _this.io.emit("system message", "@\u4F60\u6559\u7684\u5185\u5BB9\u592A\u957F\u4E86\uFF0C\u5C0F\u591C\u8981\u574F\u6389\u4E86qwq\uFF0C\u4E0D\u8981\u5440");
                        return 0;
                    }
                    //到这里都没有出错的话就视为没有问题，可以让小夜学了
                    console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u6CA1\u6709\u68C0\u6D4B\u5230\u95EE\u9898\uFF0C\u53EF\u4EE5\u5B66\u4E60");
                    db.run("INSERT INTO chat VALUES('" + ask + "', '" + ans + "')");
                    console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5B66\u4E60\u6210\u529F");
                    _this.io.emit("system message", "@\u54C7\uFF01\u5C0F\u591C\u5B66\u4F1A\u5566\uFF01\u5BF9\u6211\u8BF4\uFF1A" + ask + " \u8BD5\u8BD5\u5427\uFF0C\u5C0F\u591C\u6709\u53EF\u80FD\u4F1A\u56DE\u590D " + ans + " \u5662");
                    return 0;
                }
                else {
                    if (_this.global.chat_swich) {
                        //交给聊天函数处理
                        _this.tools.ChatProcess(msg)
                            .then(function (resolve) {
                            _this.io.emit("chat message", {
                                CID: "0",
                                msg: resolve
                            });
                        })["catch"](function (reject) {
                            //如果没有匹配到回复，那就让舔狗来回复
                            console.log(reject + "\uFF0C\u4EA4\u7ED9\u8214\u72D7\u56DE\u590D");
                            _this.tools.PrprDoge()
                                .then(function (resolve) {
                                console.log("\u8214\u72D7\u56DE\u590D\uFF1A" + resolve);
                                _this.io.emit("chat message", {
                                    CID: "0",
                                    msg: resolve
                                });
                            })["catch"](function (reject) {
                                console.log("\u968F\u673A\u8214\u72D7\u9519\u8BEF\uFF1A" + reject);
                            });
                        });
                    }
                    else {
                        return 0;
                    }
                }
            });
        });
    };
    //qqBot小夜核心代码，对接go-cqhttp
    Core.prototype.start_qqbot = function () {
        var _this = this;
        this.app.post(this.global.go_cqhttp_service, function (req, res) {
            //禁言1小时以上自动退群
            if (req.body.sub_type == "ban" && req.body.user_id == _this.global.bot_qq && req.body.duration >= 3599) {
                request("http://" + _this.global.go_cqhttp_api + "/set_group_leave?group_id=" + req.body.group_id, function (error, _response, _body) {
                    if (!error) {
                        console.log("\u5C0F\u591C\u5728\u7FA4 " + req.body.group_id + " \u88AB\u7981\u8A00\u8D85\u8FC71\u5C0F\u65F6\uFF0C\u81EA\u52A8\u9000\u7FA4");
                        this.io.emit("system message", "@\u5C0F\u591C\u5728\u7FA4 " + req.body.group_id + " \u88AB\u7981\u8A00\u8D85\u8FC71\u5C0F\u65F6\uFF0C\u81EA\u52A8\u9000\u7FA4");
                    }
                    else {
                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_leave\u9519\u8BEF\uFF1A" + error);
                    }
                });
                res.send();
                return 0;
            }
            //自动同意好友请求
            if (req.body.request_type == "friend") {
                console.log("\u81EA\u52A8\u540C\u610F\u4E86 " + req.body.user_id + " \u597D\u53CB\u8BF7\u6C42");
                res.send({ approve: 1 });
                return 0;
            }
            //加群请求发送给管理员
            if (req.body.request_type == "group" && req.body.sub_type == "invite") {
                var msg = "\u7528\u6237 " + req.body.user_id + " \u9080\u8BF7\u5C0F\u591C\u52A0\u5165\u7FA4 " + req.body.group_id + "\uFF0C\u6279\u51C6\u8BF7\u53D1\u9001\n    /\u6279\u51C6 " + req.body.flag;
                console.log("" + msg);
                request("http://" + _this.global.go_cqhttp_api + "/send_private_msg?user_id=" + _this.global.qq_admin_list[0] + "&message=" + encodeURI(msg), function (error, _response, _body) {
                    if (error) {
                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_private_msg\u9519\u8BEF\uFF1A" + error);
                    }
                });
                res.send();
                return 0;
            }
            //管理员批准群邀请
            if (req.body.message_type == "private" && req.body.user_id == _this.global.qq_admin_list[0] && _this.global.approve_group_invite.test(req.body.message)) {
                var flag_1 = req.body.message.match(_this.global.approve_group_invite)[1];
                request("http://" + _this.global.go_cqhttp_api + "/set_group_add_request?flag=" + encodeURI(flag_1) + "&type=invite&approve=1", function (error, _response, _body) {
                    if (!error) {
                        console.log("\u6279\u51C6\u4E86\u8BF7\u6C42id " + flag_1);
                        res.send({ reply: "\u5DF2\u6279\u51C6" });
                    }
                    else {
                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_add_request\u9519\u8BEF\uFF1A" + error);
                    }
                });
                return 0;
            }
            //————————————————————下面是功能————————————————————
            var notify;
            switch (req.body.sub_type) {
                case "friend":
                case "group":
                    notify = "qqBot\u5C0F\u591C\u6536\u5230\u597D\u53CB " + req.body.user_id + " (" + req.body.sender.nickname + ") \u53D1\u6765\u7684\u6D88\u606F\uFF1A" + req.body.message;
                    break;
                case "normal":
                    notify = "qqBot\u5C0F\u591C\u6536\u5230\u7FA4 " + req.body.group_id + " \u7684 " + req.body.user_id + " (" + req.body.sender.nickname + ") \u53D1\u6765\u7684\u6D88\u606F\uFF1A" + req.body.message;
                    break;
                case "approve":
                    console.log(req.body.user_id + " \u52A0\u5165\u4E86\u7FA4 " + req.body.group_id);
                    break;
                case "ban":
                    console.log("qqBot\u5C0F\u591C\u5728\u7FA4 " + req.body.group_id + " \u88AB\u7981\u8A00 " + req.body.duration + " \u79D2");
                    break;
                case "poke":
                    break;
                default:
                    res.send();
                    return 0;
            }
            console.log(notify);
            _this.io.emit("system message", "@" + notify);
            //转发图片到web端，按需启用
            if (_this.global.qqimg_to_web) {
                if (_this.global.isImage_reg.test(req.body.message)) {
                    var url = _this.global.img_url_reg.exec(req.body.message);
                    _this["this"].tools.SaveQQimg(url)
                        .then(function (resolve) {
                        _this.io.emit("qqpic message", resolve);
                    })["catch"](function (reject) {
                        console.log(reject.error);
                    });
                    res.send();
                }
            }
            //转发视频到web端
            if (_this.global.isVideo_reg.test(req.body.message)) {
                var url = _this.global.video_url_reg.exec(req.body.message)[0];
                _this.io.emit("qqvideo message", { file: url, filename: "qq视频" });
                res.send();
                return 0;
            }
            //测试指令
            if (req.body.message === "/ping") {
                console.log("Pong!");
                var test = Math.random() * 10000;
                var runtime = process.hrtime();
                for (var i = 1.0; i < 114514.0; i++) {
                    test += i + i / 10.0;
                }
                runtime = process.hrtime(runtime)[1] / 1000 / 1000;
                res.send({ reply: "Pong! " + test + " in " + runtime + "ms" });
                return 0;
            }
            //群服务开关判断
            if (req.body.message_type == "group" ||
                req.body.notice_type == "group_increase" ||
                req.body.sub_type == "ban" ||
                req.body.sub_type == "poke" ||
                req.body.sub_type == "friend_add") {
                //服务启用开关
                //指定小夜的话
                if (open_ju.test(req.body.message) && _this.global.has_qq_reg.test(req.body.message)) {
                    var msg_in = req.body.message.split("菊")[1];
                    var who = msg_in.split("[CQ:at,qq=")[1];
                    var who = who.replace("]", "").trim();
                    if (_this.global.is_qq_reg.test(who)) {
                        //如果是自己要被张菊，那么张菊
                        if (_this.global.bot_qq == who) {
                            request("http://" + _this.global.go_cqhttp_api + "/get_group_member_info?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id, function (_error, _response, body) {
                                body = JSON.parse(body);
                                if (body.data.role === "owner" || body.data.role === "admin") {
                                    console.log("\u7FA4 " + req.body.group_id + " \u542F\u7528\u4E86\u5C0F\u591C\u670D\u52A1");
                                    db.run("UPDATE qq_group SET talk_enabled = '1' WHERE group_id ='" + req.body.group_id + "'");
                                    res.send({ reply: "小夜的菊花被管理员张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊" });
                                    return 0;
                                    //不是管理，再看看是不是qqBot管理员
                                }
                                else {
                                    for (var i_1 in this.global.qq_admin_list) {
                                        if (req.body.user_id == this.global.qq_admin_list[i_1]) {
                                            console.log("\u7FA4 " + req.body.group_id + " \u542F\u7528\u4E86\u5C0F\u591C\u670D\u52A1");
                                            db.run("UPDATE qq_group SET talk_enabled = '1' WHERE group_id ='" + req.body.group_id + "'");
                                            res.send({ reply: "小夜的菊花被主人张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊" });
                                            return 0;
                                        }
                                    }
                                    //看来真不是管理员呢
                                    res.send({ reply: "你不是群管理呢，小夜不张，张菊需要让管理员来帮忙张噢" });
                                    return 0;
                                }
                            });
                            return 0;
                            //不是这只小夜被张菊的话，嘲讽那只小夜
                        }
                        else {
                            res.send({ reply: msg_in + "\u8BF4\u4F60\u5462\uFF0C\u5FEB\u5F20\u83CA\uFF01" });
                            return 0;
                        }
                    }
                }
                //在收到群消息的时候搜索群是否存在于qq_group表，判断聊天开关
                else {
                    db.all("SELECT * FROM qq_group WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                        if (!err && sql[0]) {
                            //群存在于qq_group表则判断聊天开关 talk_enabled，闭嘴了就无视掉所有消息
                            if (sql[0].talk_enabled === 0) {
                                console.log("\u7FA4 " + req.body.group_id + " \u670D\u52A1\u5DF2\u505C\u7528\uFF0C\u65E0\u89C6\u7FA4\u6240\u6709\u6D88\u606F");
                                res.send();
                                return 0;
                            }
                            else {
                                //服务启用了，允许进入后续的指令系统
                                /*                                                                    群指令系统                                                                  */
                                //地雷爆炸判断，先判断这条消息是否引爆，再从数据库取来群地雷数组，引爆后删除地雷，原先的地雷是用随机数生成被炸前最大回复作为引信，现在换一种思路，用更简单的随机数引爆
                                var boom_flag = Math.floor(Math.random() * 100); //踩中flag
                                //如果判定踩中，检查该群是否有雷
                                if (boom_flag < 10) {
                                    db.all("SELECT * FROM mine WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                                        if (!err && sql[0]) {
                                            //有则判断是否哑雷
                                            var unboom = Math.floor(Math.random() * 100); //是否哑雷
                                            if (unboom < 30) {
                                                //是哑雷，直接删除地雷
                                                console.log(sql[0].placed_qq + " \u5728\u7FA4 " + sql[0].group_id + " \u57CB\u7684\u5730\u96F7\u88AB\u8E29\u4E2D\uFF0C\u4F46\u8FD9\u662F\u4E00\u9897\u54D1\u96F7");
                                                db.run("DELETE FROM mine WHERE mine_id = '" + sql[0].mine_id + "' ");
                                                res.send({
                                                    reply: "[CQ:at,qq=" + req.body.user_id + "]\u606D\u559C\u4F60\u8EB2\u8FC7\u4E00\u52AB\uFF0C[CQ:at,qq=" + sql[0].placed_qq + "]\u57CB\u7684\u5730\u96F7\u63BA\u4E86\u6C99\u5B50\uFF0C\u662F\u54D1\u96F7\uFF0C\u70B8\u4E86\uFF0C\u4F46\u6CA1\u6709\u5B8C\u5168\u70B8"
                                                });
                                                //成功引爆并删除地雷
                                            }
                                            else {
                                                var holly_hand_grenade = Math.floor(Math.random() * 1000); //丢一个骰子，判断地雷是否变成神圣地雷
                                                if (holly_hand_grenade < 10) {
                                                    //运营方暗调了出率，10‰几率变成神圣地雷
                                                    request("http://" + _this.global.go_cqhttp_api + "/set_group_whole_ban?group_id=" + req.body.group_id + "&enable=1", function (error, _response, _body) {
                                                        if (!error) {
                                                            console.log("\u89E6\u53D1\u4E86\u795E\u5723\u5730\u96F7\uFF0C\u7FA4 " + req.body.group_id + " \u88AB\u5168\u4F53\u7981\u8A00");
                                                            res.send({
                                                                reply: "\u5662\uFF0C\u8BE5\u6B7B\uFF0C\u6211\u7684\u4E0A\u5E1D\u554A\uFF0C\u771F\u662F\u4E0D\u6562\u76F8\u4FE1\uFF0C\u77A7\u77A7\u6211\u53D1\u73B0\u4E86\u4EC0\u4E48\uFF0C\u6211\u53D1\u8A93\u6211\u6CA1\u6709\u770B\u9519\uFF0C\u8FD9\u7ADF\u7136\u662F\u4E00\u9897\u51FA\u73B0\u7387\u4E3A\u5343\u5206\u4E4B\u4E00\u7684\u795E\u5723\u5730\u96F7\uFF01\u6211\u662F\u8BF4\uFF0C\u8FD9\u662F\u4E00\u9897\u6BC1\u5929\u706D\u5730\u7684\u795E\u5723\u5730\u96F7\u554A\uFF01\u54C8\u5229\u8DEF\u4E9A\uFF01\u9EBB\u70E6\u7BA1\u7406\u5458\u89E3\u9664\u4E00\u4E0B"
                                                            });
                                                        }
                                                        else {
                                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_whole_ban\u9519\u8BEF\uFF1A" + error);
                                                            res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                                        }
                                                    });
                                                    return 0;
                                                }
                                                else {
                                                    var boom_time = Math.floor(Math.random() * 60 * 2); //造成伤害时间
                                                    console.log(sql[0].placed_qq + " \u5728\u7FA4 " + sql[0].group_id + " \u57CB\u7684\u5730\u96F7\u88AB\u5F15\u7206\uFF0C\u96F7\u5DF2\u7ECF\u88AB\u5220\u9664");
                                                    db.run("DELETE FROM mine WHERE mine_id = '" + sql[0].mine_id + "' ");
                                                    res.send({
                                                        reply: "[CQ:at,qq=" + req.body.user_id + "]\u606D\u559C\u4F60\uFF0C\u88AB[CQ:at,qq=" + sql[0].placed_qq + "]\u6240\u57CB\u5730\u96F7\u70B8\u4F24\uFF0C\u4F11\u517B\u751F\u606F" + boom_time + "\u79D2\uFF01",
                                                        ban: 1,
                                                        ban_duration: boom_time
                                                    });
                                                    return 0;
                                                }
                                            }
                                        }
                                    });
                                    return 0;
                                }
                                //服务停用开关
                                //指定小夜的话
                                if (_this.global.close_ju.test(req.body.message) && _this.global.has_qq_reg.test(req.body.message)) {
                                    var msg_in = req.body.message.split("菊")[1];
                                    var who = msg_in.split("[CQ:at,qq=")[1];
                                    var who = who.replace("]", "").trim();
                                    if (_this.global.is_qq_reg.test(who)) {
                                        //如果是自己要被闭菊，那么闭菊
                                        if (_this.global.bot_qq == who) {
                                            console.log("\u7FA4 " + req.body.group_id + " \u505C\u6B62\u4E86\u5C0F\u591C\u670D\u52A1");
                                            db.run("UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='" + req.body.group_id + "'");
                                            res.send({ reply: "\u5C0F\u591C\u7684\u83CA\u82B1\u95ED\u4E0A\u4E86\uFF0C\u8FD9\u53EA\u5C0F\u591C\u5728\u672C\u7FA4\u7684\u6240\u6709\u670D\u52A1\u5DF2\u7ECF\u505C\u7528\uFF0C\u53D6\u6D88\u8BF7\u53D1 \u5F20\u83CA[CQ:at,qq=" + _this.global.bot_qq + "]" });
                                            return 0;
                                            //不是这只小夜被闭菊的话，嘲讽那只小夜
                                        }
                                        else {
                                            res.send({ reply: msg_in + "\u8BF4\u4F60\u5462\uFF0C\u5FEB\u95ED\u83CA\uFF01" });
                                            return 0;
                                        }
                                    }
                                    //没指定小夜
                                }
                                else if (req.body.message === "闭菊") {
                                    console.log("\u7FA4 " + req.body.group_id + " \u505C\u6B62\u4E86\u5C0F\u591C\u670D\u52A1");
                                    db.run("UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='" + req.body.group_id + "'");
                                    res.send({ reply: "\u5C0F\u591C\u7684\u83CA\u82B1\u95ED\u4E0A\u4E86\uFF0C\u5C0F\u591C\u5728\u672C\u7FA4\u7684\u6240\u6709\u670D\u52A1\u5DF2\u7ECF\u505C\u7528\uFF0C\u53D6\u6D88\u8BF7\u53D1 \u5F20\u83CA[CQ:at,qq=" + _this.global.bot_qq + "]" });
                                    return 0;
                                }
                                //报错
                                if (_this.global.feed_back.test(req.body.message)) {
                                    console.log("有人想报错");
                                    var msg_1 = "\u7528\u6237 " + req.body.user_id + "(" + req.body.sender.nickname + ") \u62A5\u544A\u4E86\u9519\u8BEF\uFF1A";
                                    msg_1 += req.body.message.replace("/报错 ", "");
                                    msg_1 = msg_1.replace("/报错", "");
                                    request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=120243247&message=" + encodeURI(msg_1), function (error, _response, _body) {
                                        if (!error) {
                                            console.log(req.body.user_id + " \u53CD\u9988\u4E86\u9519\u8BEF " + msg_1);
                                        }
                                        else {
                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                        }
                                    });
                                    request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=474164508&message=" + encodeURI(msg_1), function (error, _response, _body) {
                                        if (error) {
                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                        }
                                    });
                                    res.send({ reply: "\u8C22\u8C22\u60A8\u7684\u53CD\u9988\uFF0C\u5C0F\u591C\u5DF2\u7ECF\u628A\u60A8\u7684\u53CD\u9988\u4FE1\u606F\u53D1\u7ED9\u4E86\u5F00\u53D1\u56E2\u961F\u8FA3" });
                                    return 0;
                                }
                                //戳一戳
                                if (req.body.sub_type === "poke" && req.body.target_id == _this.global.bot_qq) {
                                    _this.global.c1c_count++;
                                    if (_this.global.c1c_count > 2) {
                                        _this.global.c1c_count = 0;
                                        var final = "哎呀戳坏了，不理你了 ٩(๑`^´๑)۶";
                                        request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(final), function (error, _response, _body) {
                                            if (!error) {
                                                console.log(req.body.user_id + " \u6233\u4E86\u4E00\u4E0B " + req.body.target_id);
                                                request("http://" + this.global.go_cqhttp_api + "/set_group_ban?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id + "&duration=10", function (error, _response, _body) {
                                                    if (!error) {
                                                        console.log("\u5C0F\u591C\u751F\u6C14\u4E86\uFF0C" + req.body.user_id + " \u88AB\u7981\u8A00");
                                                    }
                                                    else {
                                                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_ban\u9519\u8BEF\uFF1A" + error);
                                                        res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                                    }
                                                });
                                            }
                                            else {
                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                            }
                                        });
                                    }
                                    else {
                                        var final = "\u8BF7\u4E0D\u8981\u6233\u5C0F\u5C0F\u591C >_<";
                                        request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(final), function (error, _response, _body) {
                                            if (!error) {
                                                console.log(req.body.user_id + " \u6233\u4E86\u4E00\u4E0B " + req.body.target_id);
                                            }
                                            else {
                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                            }
                                        });
                                    }
                                    return 0;
                                }
                                //教学系统，抄板于虹原翼版小夜v3
                                if (_this.global.teach_reg.test(req.body.message)) {
                                    var msg_2 = req.body.message;
                                    msg_2 = msg_2.replace(/'/g, ""); //防爆
                                    msg_2 = msg_2.substr(2).split("答：");
                                    if (msg_2.length !== 2) {
                                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5206\u5272\u6709\u8BEF\uFF0C\u9000\u51FA\u6559\u5B66");
                                        res.send({ reply: "你教的姿势不对噢qwq" });
                                        return 0;
                                    }
                                    var ask = msg_2[0].trim(), ans = msg_2[1].trim();
                                    if (ask == "" || ans == "") {
                                        console.log("\u95EE/\u7B54\u4E3A\u7A7A\uFF0C\u9000\u51FA\u6559\u5B66");
                                        res.send({ reply: "你教的姿势不对噢qwq" });
                                        return 0;
                                    }
                                    if (ask.indexOf(/\r?\n/g) !== -1) {
                                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5173\u952E\u8BCD\u6362\u884C\u4E86\uFF0C\u9000\u51FA\u6559\u5B66");
                                        res.send({ reply: "关键词不能换行啦qwq" });
                                        return 0;
                                    }
                                    console.log(req.body.user_id + "(" + req.body.sender.nickname + ") \u60F3\u8981\u6559\u7ED9\u5C0F\u591C\uFF1A\u95EE\uFF1A" + ask + " \u7B54\uFF1A" + ans + "\uFF0C\u73B0\u5728\u5F00\u59CB\u68C0\u6D4B\u5408\u6CD5\u6027");
                                    for (var i_2 in _this.global.black_list_words) {
                                        if (ask.toLowerCase().indexOf(_this.global.black_list_words[i_2].toLowerCase()) !== -1 ||
                                            ans.toLowerCase().indexOf(_this.global.black_list_words[i_2].toLowerCase()) !== -1) {
                                            console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u68C0\u6D4B\u5230\u4E0D\u5141\u8BB8\u7684\u8BCD\uFF1A" + _this.global.black_list_words[i_2] + "\uFF0C\u9000\u51FA\u6559\u5B66");
                                            res.send({ reply: "\u4F60\u6559\u7684\u5185\u5BB9\u91CC\u6709\u4E3B\u4EBA\u4E0D\u5141\u8BB8\u5C0F\u591C\u5B66\u4E60\u7684\u8BCD\uFF1A" + _this.global.black_list_words[i_2] + " qwq" });
                                            return 0;
                                        }
                                    }
                                    if (Buffer.from(ask).length < 4) {
                                        //关键词最低长度：4个英文或2个汉字
                                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5173\u952E\u8BCD\u592A\u77ED\uFF0C\u9000\u51FA\u6559\u5B66");
                                        res.send({ reply: "关键词太短了啦qwq，至少要4个字节啦" });
                                        return 0;
                                    }
                                    if (ask.length > 350 || ans.length > 350) {
                                        //图片长度差不多是350左右
                                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u6559\u7684\u592A\u957F\u4E86\uFF0C\u9000\u51FA\u6559\u5B66");
                                        res.send({ reply: "你教的内容太长了，小夜要坏掉了qwq，不要呀" });
                                        return 0;
                                    }
                                    //到这里都没有出错的话就视为没有问题，可以让小夜学了
                                    console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u6CA1\u6709\u68C0\u6D4B\u5230\u95EE\u9898\uFF0C\u53EF\u4EE5\u5B66\u4E60");
                                    db.run("INSERT INTO chat VALUES('" + ask + "', '" + ans + "')");
                                    console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5B66\u4E60\u6210\u529F");
                                    res.send({ reply: "\u54C7\uFF01\u5C0F\u591C\u5B66\u4F1A\u5566\uFF01\u5BF9\u6211\u8BF4\uFF1A" + ask + " \u8BD5\u8BD5\u5427\uFF0C\u5C0F\u591C\u6709\u53EF\u80FD\u4F1A\u56DE\u590D " + ans + " \u5662" });
                                    return 0;
                                }
                                //balabala教学，对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复
                                if (_this.global.teach_balabala_reg.test(req.body.message)) {
                                    var msg_3 = req.body.message;
                                    msg_3 = msg_3.replace(/'/g, ""); //防爆
                                    msg_3 = msg_3.replace("/说不出话 ", "");
                                    msg_3 = msg_3.replace("/说不出话", "");
                                    console.log(req.body.user_id + "(" + req.body.sender.nickname + ") \u60F3\u8981\u6559\u7ED9\u5C0F\u591Cbalabala\uFF1A" + msg_3 + "\uFF0C\u73B0\u5728\u5F00\u59CB\u68C0\u6D4B\u5408\u6CD5\u6027");
                                    for (var i_3 in _this.global.black_list_words) {
                                        if (msg_3.toLowerCase().indexOf(_this.global.black_list_words[i_3].toLowerCase()) !== -1 ||
                                            msg_3.toLowerCase().indexOf(_this.global.black_list_words[i_3].toLowerCase()) !== -1) {
                                            console.log("balabala\u6559\u5B66\uFF1A\u68C0\u6D4B\u5230\u4E0D\u5141\u8BB8\u7684\u8BCD\uFF1A" + _this.global.black_list_words[i_3] + "\uFF0C\u9000\u51FA\u6559\u5B66");
                                            res.send({ reply: "你教的内容里有主人不允许小夜学习的词qwq" });
                                            return 0;
                                        }
                                    }
                                    console.log("balabala\u6559\u5B66\uFF1A\u6CA1\u6709\u68C0\u6D4B\u5230\u95EE\u9898\uFF0C\u53EF\u4EE5\u5B66\u4E60");
                                    db.run("INSERT INTO balabala VALUES('" + msg_3 + "')");
                                    console.log("balabala\u6559\u5B66\uFF1A\u5B66\u4E60\u6210\u529F");
                                    res.send({ reply: "\u54C7\uFF01\u5C0F\u591C\u5B66\u4F1A\u5566\uFF01\u5C0F\u591C\u53EF\u80FD\u5728\u8BF4\u4E0D\u51FA\u8BDD\u7684\u65F6\u5019\u8BF4 " + msg_3 + " \u5662" });
                                    return 0;
                                }
                                //色图
                                if (_this.global.setu_reg.test(req.body.message)) {
                                    _this["this"].tools.RandomCos()
                                        .then(function (resolve) {
                                        var setu_file = "http://127.0.0.1:" + _this.global.web_port + "/" + resolve.replace(/\//g, "\\");
                                        res.send({
                                            reply: "[CQ:image,file=" + setu_file + ",url=" + setu_file + "]"
                                        });
                                    })["catch"](function (reject) {
                                        console.log("RandomCos(): rejected, and err:" + reject);
                                        res.send({ reply: "\u4F60\u8981\u7684\u8272\u56FE\u53D1\u9001\u5931\u8D25\u5566\uFF1A" + reject });
                                    });
                                    return 0;
                                }
                                //r18色图
                                if (req.body.message == "r18") {
                                    res.send({ reply: "\u4F60\u7B49\u7B49\uFF0C\u6211\u53BB\u627E\u627E\u4F60\u8981\u7684r18" });
                                    _this["this"].tools.RandomR18()
                                        .then(function (resolve) {
                                        var setu_file = "http://127.0.0.1:" + _this.global.web_port + "/" + resolve.replace(/\//g, "\\");
                                        console.log(setu_file);
                                        request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI("[CQ:image,file=" + setu_file + ",url=" + setu_file + "]"), function (error, _response, _body) {
                                            if (error) {
                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                            }
                                        });
                                    })["catch"](function (reject) {
                                        console.log("RandomR18(): rejected, and err:" + reject);
                                        request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI("\u4F60\u8981\u7684r18\u53D1\u9001\u5931\u8D25\u5566\uFF1A" + reject), function (error, _response, _body) {
                                            if (error) {
                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                            }
                                        });
                                    });
                                    return 0;
                                }
                                //来点xx
                                if (_this.global.come_some.test(req.body.message)) {
                                    var tag_1 = req.body.message.match(_this.global.come_some)[1];
                                    res.send({ reply: "\u4F60\u7B49\u7B49\uFF0C\u6211\u53BB\u627E\u627E\u4F60\u8981\u7684" + tag_1 });
                                    _this["this"].tools.SearchTag(tag_1)
                                        .then(function (resolve) {
                                        var setu_file = "http://127.0.0.1:" + _this.global.web_port + "/" + resolve.replace(/\//g, "\\");
                                        console.log(setu_file);
                                        request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI("[CQ:image,file=" + setu_file + ",url=" + setu_file + "]"), function (error, _response, _body) {
                                            if (error) {
                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                            }
                                        });
                                    })["catch"](function (reject) {
                                        console.log("SearchTag(): rejected, and err:" + reject);
                                        request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI("\u4F60\u8981\u7684" + tag_1 + "\u53D1\u9001\u5931\u8D25\u5566\uFF1A" + reject), function (error, _response, _body) {
                                            if (error) {
                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                            }
                                        });
                                    });
                                    return 0;
                                }
                                //福利姬
                                for (var i_4 in _this.global.req_fuliji_list) {
                                    if (req.body.message === _this.global.req_fuliji_list[i_4]) {
                                        _this["this"].tools.RandomTbshow()
                                            .then(function (resolve) {
                                            res.send({
                                                reply: "[CQ:image,file=" + resolve + ",url=" + resolve + "]"
                                            });
                                        })["catch"](function (reject) {
                                            console.log("RandomCos(): rejected, and err:" + reject);
                                            res.send({ reply: "\u4F60\u8981\u7684\u798F\u5229\u59EC\u8272\u56FE\u53D1\u9001\u5931\u8D25\u5566\uFF1A" + reject });
                                        });
                                        return 0;
                                    }
                                }
                                //来点二次元
                                for (var i_5 in _this.global.req_ECY_list) {
                                    if (req.body.message === _this.global.req_ECY_list[i_5]) {
                                        _this["this"].tools.RandomECY()
                                            .then(function (resolve) {
                                            res.send({
                                                reply: "[CQ:image,file=" + resolve + ",url=" + resolve + "]"
                                            });
                                        })["catch"](function (reject) {
                                            console.log("RandomCos(): rejected, and err:" + reject);
                                            res.send({ reply: "\u4F60\u8981\u7684\u4E8C\u6B21\u5143\u8272\u56FE\u53D1\u9001\u5931\u8D25\u5566\uFF1A" + reject });
                                        });
                                        return 0;
                                    }
                                }
                                //舔我
                                if (req.body.message === "/舔我") {
                                    _this["this"].tools.PrprDoge()
                                        .then(function (resolve) {
                                        console.log("\u8214\u72D7\u8214\u4E86\u4E00\u53E3\uFF1A" + resolve);
                                        res.send({ reply: resolve });
                                    })["catch"](function (reject) {
                                        console.log("\u968F\u673A\u8214\u72D7\u9519\u8BEF\uFF1A" + reject);
                                    });
                                    return 0;
                                }
                                //彩虹屁
                                if (req.body.message === "/彩虹屁") {
                                    _this["this"].tools.RainbowPi()
                                        .then(function (resolve) {
                                        console.log("\u653E\u4E86\u4E00\u4E2A\u5F69\u8679\u5C41\uFF1A" + resolve);
                                        res.send({ reply: resolve });
                                    })["catch"](function (reject) {
                                        console.log("\u5F69\u8679\u5C41\u9519\u8BEF\uFF1A" + reject);
                                    });
                                    return 0;
                                }
                                //吠，直接把文字转化为语音
                                if (_this.global.yap_reg.test(req.body.message)) {
                                    var tex = req.body.message.replace("/吠 ", "");
                                    tex = tex.replace("/吠", "");
                                    _this["this"].tools.BetterTTS(tex)
                                        .then(function (resolve) {
                                        var tts_file = "[CQ:record,file=http://127.0.0.1:" + _this.global.web_port + resolve.file + ",url=http://127.0.0.1:" + _this.global.web_port + resolve.file + "]";
                                        res.send({ reply: tts_file });
                                    })["catch"](function (reject) {
                                        console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                                    });
                                    return 0;
                                }
                                //嘴臭，小夜的回复转化为语音
                                if (_this.global.come_yap_reg.test(req.body.message)) {
                                    var message = req.body.message.replace("/嘴臭 ", "");
                                    message = message.replace("/嘴臭", "");
                                    console.log("\u6709\u4EBA\u5BF9\u7EBF\u8BF4 " + message + "\uFF0C\u5C0F\u591C\u8981\u5634\u81ED\u4E86");
                                    _this.io.emit("sysrem message", "@\u6709\u4EBA\u5BF9\u7EBF\u8BF4 " + message + "\uFF0C\u5C0F\u591C\u8981\u5634\u81ED\u4E86");
                                    _this["this"].tools.ChatProcess(message)
                                        .then(function (resolve) {
                                        var reply = resolve;
                                        _this["this"].tools.BetterTTS(reply)
                                            .then(function (resolve) {
                                            var tts_file = "[CQ:record,file=http://127.0.0.1:" + _this.global.web_port + resolve.file + ",url=http://127.0.0.1:" + _this.global.web_port + resolve.file + "]";
                                            res.send({ reply: tts_file });
                                        })["catch"](function (reject) {
                                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                                        });
                                    })["catch"](function (reject) {
                                        //如果没有匹配到回复，那就回复一句默认语音
                                        console.log(reject + "\uFF0C\u8BED\u97F3\u6CA1\u6709\u56DE\u590D");
                                        _this["this"].tools.BetterTTS()
                                            .then(function (resolve) {
                                            var tts_file = "[CQ:record,file=http://127.0.0.1:" + _this.global.web_port + resolve.file + ",url=http://127.0.0.1:" + _this.global.web_port + resolve.file + "]";
                                            res.send({ reply: tts_file });
                                        })["catch"](function (reject) {
                                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                                        });
                                    });
                                    return 0;
                                }
                                //prpr，来自jjbot的功能
                                if (_this.global.prpr_reg.test(req.body.message)) {
                                    var bodyPart = [
                                        "手掌",
                                        "双脚",
                                        "熊脸",
                                        "脸蛋",
                                        "鼻子",
                                        "小嘴",
                                        "咪咪",
                                        "大雕",
                                        "蛋蛋",
                                        "大× [不忍直视]",
                                        "双眼",
                                        "脖子",
                                        "胸口",
                                        "大腿",
                                        "脚踝",
                                        "那里 >////<",
                                        "腋下",
                                        "耳朵",
                                        "小腿",
                                        "袜子",
                                        "臭脚",
                                    ];
                                    var msg_4 = req.body.message;
                                    var who_1 = req.body.sender.nickname;
                                    if (!who_1)
                                        who_1 = "小夜";
                                    var prpr_who = msg_4.replace("/prpr ", "");
                                    if (!prpr_who || prpr_who === "/prpr") {
                                        prpr_who = prpr_who.replace("/prpr", "");
                                        prpr_who = "自己";
                                    }
                                    var random_bodyPart = bodyPart[Math.floor(Math.random() * bodyPart.length)];
                                    var final = who_1 + " \u8214\u4E86\u8214 " + prpr_who + " \u7684 " + random_bodyPart + "\uFF0C\u6211\u597D\u5174\u594B\u554A\uFF01";
                                    console.log("prpr\u6307\u4EE4\uFF1A" + final + " ");
                                    res.send({ reply: final });
                                    return 0;
                                }
                                //今日不带套
                                for (var i_6 in _this.global.req_no_trap_list) {
                                    if (req.body.message === _this.global.req_no_trap_list[i_6]) {
                                        var now = new Date();
                                        var year = now.getFullYear();
                                        var month = now.getMonth() + 1;
                                        var day = now.getDate();
                                        if (month > 2) {
                                            year++;
                                        }
                                        var star_set_name = "魔羯水瓶双鱼牡羊金牛双子巨蟹狮子处女天秤天蝎射手魔羯";
                                        var star_set_days = [20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22];
                                        var star_set_result = star_set_name.substr(month * 2 - (day < star_set_days[month - 1] ? 2 : 0), 2);
                                        var shenxiao = ["猴", "鸡", "狗", "猪", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊"];
                                        var shenxiao_result = /^\d{4}$/.test(year) ? shenxiao[year % 12] : false;
                                        var final = "\u5C0F\u591C\u6E29\u99A8\u63D0\u793A\u60A8\uFF1A\u4ECA\u65E5\u4E0D\u6234\u5957\uFF0C\u5B69\u5B50" + star_set_result + "\u5EA7\uFF0C\u5C5E" + shenxiao_result + "\uFF0C" + (year + 18) + "\u5E74\u9AD8\u8003\uFF0C\u4E00\u672C\u673A\u7387\u7EA6" + parseInt(Math.random() * (99 - 20 + 1) + 20, 10) + "%";
                                        console.log("\u4ECA\u65E5\u4E0D\u5E26\u5957\u6307\u4EE4\uFF1A" + final + " ");
                                        res.send({ reply: final });
                                        return 0;
                                    }
                                }
                                //avg模板，可以写简单的随机小说
                                if (req.body.message === "/画师算命") {
                                    var paintstyle = ["厚涂", "美式", "韩风", "迪士尼风格", "日系赛璐璐", "日系平涂", "国风"];
                                    var like = [
                                        "机械",
                                        "大腿",
                                        "美少年",
                                        "美少女",
                                        "奶子",
                                        "兄贵",
                                        "屁股",
                                        "脸蛋",
                                        "大屌",
                                        "给佬",
                                        "幼女",
                                        "JK",
                                        "黑丝",
                                        "胖次",
                                        "白丝",
                                        "小手",
                                        "【不可描述】",
                                    ];
                                    var andthen = [
                                        "有了一些同好",
                                        "被人骗稿多次",
                                        "找不到工作",
                                        "只能做外包",
                                        "出了很多本子",
                                        "被人骗炮",
                                        "做了自由职业者",
                                        "当了某大项目主美",
                                        "经常被抄袭",
                                        "在某站成名",
                                        "每天混吃等死",
                                    ];
                                    var buthen = ["被请喝茶", "被人寄刀片", "被举报", "本子卖到爆炸", "被人吐槽", "被人骗炮", "突然爆红", "被人抄袭", "在街角被蜀黍强暴"];
                                    var atlast = [
                                        "因为画得不行转而卖艺，竟然变成了偶像",
                                        "做了一辈子社畜",
                                        "名垂青史但是变成了时代眼泪",
                                        "也没有出人头地，转行做了别的行业",
                                        "赚够了钱去了幻想乡",
                                        "因为断连载被愤怒的读者高呼飞出地球",
                                        "舒舒服服退休回老家结婚",
                                        "一直活跃在最前线，活到老画到老",
                                        "成为了魔法少女",
                                    ];
                                    var who_2 = req.body.sender.nickname;
                                    if (!who_2)
                                        who_2 = "小夜";
                                    var random_paintstyle = paintstyle[Math.floor(Math.random() * paintstyle.length)];
                                    var random_like = like[Math.floor(Math.random() * like.length)];
                                    var random_andthen = andthen[Math.floor(Math.random() * andthen.length)];
                                    var random_buthen = buthen[Math.floor(Math.random() * buthen.length)];
                                    var random_atlast = atlast[Math.floor(Math.random() * atlast.length)];
                                    var final = who_2 + "\u662F\u4E00\u540D" + random_paintstyle + "\u753B\u5E08\uFF0C\u6700\u559C\u6B22\u753B" + random_like + "\uFF0C\u800C\u4E14" + random_andthen + "\uFF0C\u7136\u800C\u56E0\u4E3A\u753B\u5F97\u592A\u8FC7\u548C\u8C10\u800C" + random_buthen + "\uFF0C\u8FD8\u56E0\u4E3A\u8FD9\u4EF6\u4E8B\u5728\u5FAE\u535A\u4E0A\u6709\u4E86" + (Math.random() * (1000000 - 1) +
                                        1).toFixed(0) + "\u4E2A\u7C89\u4E1D\uFF0C\u505A\u4E86" + (Math.random() * (100 - 1).toFixed(0) + 1).toFixed(0) + "\u5E74\u753B\u5E08\uFF0C\u6700\u540E" + random_atlast + "\u3002";
                                    console.log("\u753B\u5E08\u7B97\u547D\u6307\u4EE4\uFF1A" + final + " ");
                                    res.send({ reply: final });
                                    return 0;
                                }
                                //cp文生成器，语料来自 https://github.com/mxh-mini-apps/mxh-cp-stories/blob/master/src/assets/story.json
                                if (_this.global.cp_story.test(req.body.message)) {
                                    var msg_5 = req.body.message + " "; //结尾加一个空格防爆
                                    msg_5 = msg_5.split(" ");
                                    console.log(msg_5);
                                    var tops_1 = msg_5[1].trim(), //小攻
                                    bottoms_1 = msg_5[2].trim(); //小受
                                    fs.readFile(path.join("" + process.cwd(), "config", "1and0story.json"), "utf-8", function (err, data) {
                                        if (!err) {
                                            story = JSON.parse(data);
                                            if (!tops_1)
                                                tops_1 = req.body.sender.nickname;
                                            if (!bottoms_1)
                                                bottoms_1 = req.body.sender.nickname;
                                            // for (let i in story) {
                                            //   if (tops == story[i].roles.gong || bottoms == story[i].roles.shou) {
                                            //     let index = Math.floor(Math.random() * story.length);
                                            //     res.send({ reply: `${tops} ${bottoms} ${index}` });
                                            //     return 0;
                                            //   }
                                            // }
                                            var index = story.length - 1;
                                            var story_index = Math.floor(Math.random() * story[index].stories.length);
                                            var story_select = story[index].stories[story_index];
                                            story_select = story_select.replace(/<攻>/g, tops_1);
                                            story_select = story_select.replace(/<受>/g, bottoms_1);
                                            console.log("\u53D1\u9001cp\u6587\uFF1A" + story_select);
                                            res.send({ reply: "" + story_select });
                                        }
                                    });
                                    return 0;
                                }
                                //伪造转发
                                if (_this.global.fake_forward.test(req.body.message)) {
                                    var who_3, name_1 = req.body.sender.nickname, text_1, xiaoye_say_1, requestData_1;
                                    if (req.body.message == "/强制迫害") {
                                        who_3 = req.body.sender.user_id; //如果没有要求迫害谁，那就是迫害自己
                                    }
                                    else {
                                        var msg_6 = req.body.message + " "; //结尾加一个空格防爆
                                        // for (let i in msg.substr(i).split(" ")) {
                                        //   console.log(msg[i]);
                                        // }
                                        msg_6 = msg_6.substr(4).split(" ");
                                        who_3 = msg_6[1].trim(); //谁
                                        text_1 = msg_6[2].trim(); //说啥
                                        xiaoye_say_1 = msg_6[3].trim(); //小夜说啥
                                        who_3 = who_3.replace("/强制迫害 ", "");
                                        who_3 = who_3.replace("/强制迫害", "");
                                        who_3 = who_3.replace("[CQ:at,qq=", "");
                                        who_3 = who_3.replace("]", "");
                                        who_3 = who_3.trim();
                                        if (_this.global.is_qq_reg.test(who_3)) {
                                            console.log("\u7FA4 " + req.body.group_id + " \u7684 \u7FA4\u5458 " + req.body.user_id + " \u5F3A\u5236\u8FEB\u5BB3 " + who_3);
                                        }
                                        else {
                                            //目标不是qq号
                                            who_3 = req.body.sender.user_id; //如果没有要求迫害谁，那就是迫害自己
                                        }
                                    }
                                    if (!name_1) {
                                        name_1 = req.body.sender.nickname;
                                    }
                                    if (!text_1) {
                                        text_1 = "我是群友专用RBQ";
                                    }
                                    if (!xiaoye_say_1) {
                                        xiaoye_say_1 =
                                            "[CQ:image,file=1ea870ec3656585d4a81e13648d66db5.image,url=https://gchat.qpic.cn/gchatpic_new/1277161008/2063243247-2238741340-1EA870EC3656585D4A81E13648D66DB5/0?term=3]";
                                    }
                                    //发送
                                    //先获取昵称
                                    request("http://" + _this.global.go_cqhttp_api + "/get_group_member_info?group_id=" + req.body.group_id + "&user_id=" + who_3 + "&no_cache=0", function (error, _response, body) {
                                        if (!error) {
                                            body = JSON.parse(body);
                                            name_1 = body.data.nickname;
                                            requestData_1 = {
                                                group_id: req.body.group_id,
                                                messages: [
                                                    { type: "node", data: { name: name_1, uin: who_3, content: text_1 } },
                                                    {
                                                        type: "node",
                                                        data: {
                                                            name: "星野夜蝶Official",
                                                            uin: "1648468212",
                                                            content: xiaoye_say_1
                                                        }
                                                    },
                                                ]
                                            };
                                            request({
                                                url: "http://" + this.global.go_cqhttp_api + "/send_group_forward_msg",
                                                method: "POST",
                                                json: true,
                                                headers: {
                                                    "content-type": "application/json"
                                                },
                                                body: requestData_1
                                            }, function (error, response, body) {
                                                if (!error && response.statusCode == 200) {
                                                    console.log(body);
                                                }
                                            });
                                        }
                                        else {
                                            requestData_1 = {
                                                group_id: req.body.group_id,
                                                messages: [
                                                    { type: "node", data: { name: name_1, uin: who_3, content: text_1 } },
                                                    {
                                                        type: "node",
                                                        data: {
                                                            name: "星野夜蝶Official",
                                                            uin: "1648468212",
                                                            content: xiaoye_say_1
                                                        }
                                                    },
                                                ]
                                            };
                                            request({
                                                url: "http://" + this.global.go_cqhttp_api + "/send_group_forward_msg",
                                                method: "POST",
                                                json: true,
                                                headers: {
                                                    "content-type": "application/json"
                                                },
                                                body: requestData_1
                                            }, function (error, response, body) {
                                                if (!error && response.statusCode == 200) {
                                                    console.log(body);
                                                }
                                            });
                                        }
                                    });
                                    return 0;
                                }
                                //迫害，p图，这里需要重写复用
                                if (_this.global.pohai_reg.test(req.body.message)) {
                                    var pohai_list = ["唐可可", "上原步梦", "猛男狗", "令和", "鸭鸭", "陈睿"]; //迫害名单
                                    var pohai_pic_list = ["coco_echo.jpg", "ayumu_qaq.jpg", "doge.jpg", "nianhao.jpg", "yaya.gif", "bilibili.png"]; //迫害图片列表
                                    var pohai_pic_1 = "coco_echo.jpg"; //迫害图片，如果被迫害人不在迫害名单里，那么默认迫害唐可可
                                    var tex_config_list = {
                                        唐可可: ["390", "160", "-0.19", "8", "30"],
                                        上原步梦: ["227", "440", "0", "26", "30"],
                                        猛男狗: ["200", "100", "0", "0", "30"],
                                        令和: ["130", "110", "-0.05", "1", "30"],
                                        鸭鸭: ["30", "30", "0", "2", "30"],
                                        陈睿: ["94", "390", "-0.01", "12", "15"]
                                    }; //迫害文字位置，left、top、rotate、多少字换行、字体大小
                                    var tex_config_1 = tex_config_list.唐可可; //默认迫害文字位置是唐可可的
                                    var msg_7 = req.body.message + " "; //结尾加一个空格防爆
                                    msg_7 = msg_7.substr(3).split(" ");
                                    var pohai_who = msg_7[1].trim(), //迫害谁
                                    pohai_tex_1 = msg_7[2].trim(); //迫害文字
                                    //先搜索被迫害人是否在迫害名单里
                                    for (var i_7 in pohai_list) {
                                        if (pohai_who === pohai_list[i_7]) {
                                            //被迫害人发现
                                            pohai_pic_1 = pohai_pic_list[i_7];
                                            tex_config_1 = tex_config_list[pohai_who];
                                            console.log("\u88AB\u8FEB\u5BB3\u4EBA " + pohai_who + " \u53D1\u73B0\uFF0C\u4F7F\u7528\u8FEB\u5BB3\u56FE " + pohai_pic_list[i_7]);
                                        }
                                    }
                                    //如果没有迫害文字的话，应该是省略了被迫害人，如 /迫害 迫害文字 这样，所以迫害文字是第一个参数
                                    if (!pohai_tex_1) {
                                        pohai_tex_1 = msg_7[1].trim();
                                    }
                                    //如果迫害文字里有@某人，将[CQ:at,qq=QQ号]转为昵称
                                    if (_this.global.has_qq_reg.test(pohai_tex_1)) {
                                        console.log("\u5B58\u5728@\u5185\u5BB9\uFF0C\u5C06\u66FF\u6362\u4E3A\u6635\u79F0");
                                        var at_start = pohai_tex_1.indexOf("[CQ:at,qq="); //取@开始
                                        var at_end = pohai_tex_1.indexOf("]"); //取@结束
                                        var tex_top_1 = pohai_tex_1.substr(0, at_start); //取除了@外的字符串头
                                        var tex_bottom_1 = pohai_tex_1.substr(at_end + 1); //取除了@外的字符串尾
                                        //获取qq
                                        var qq_id = pohai_tex_1.replace("[CQ:at,qq=", "");
                                        qq_id = qq_id.replace("]", "");
                                        qq_id = qq_id.trim();
                                        //如果是正确的qq号则替换
                                        if (_this.global.is_qq_reg.test(qq_id)) {
                                            //获取qq号在群内的昵称
                                            request("http://" + _this.global.go_cqhttp_api + "/get_group_member_info?group_id=" + req.body.group_id + "&user_id=" + qq_id + "&no_cache=0", function (error, _response, body) {
                                                var _this = this;
                                                //这一步实在是太慢了啊实在不想异步了
                                                if (!error) {
                                                    body = JSON.parse(body);
                                                    pohai_tex_1 = "" + tex_top_1 + body.data.nickname + tex_bottom_1; //拼接为完整的迫害tex
                                                    //如果需要换行，按 tex_config[3] 来换行
                                                    if (pohai_tex_1.length > tex_config_1[3]) {
                                                        var enter = tex_config_1[3];
                                                        var new_pohai_tex = "";
                                                        for (var i_8 = 0, j = 1; i_8 < pohai_tex_1.length; i_8++, j++) {
                                                            if (j && j % enter == 0) {
                                                                new_pohai_tex += pohai_tex_1[i_8] + "\n";
                                                            }
                                                            else {
                                                                new_pohai_tex += pohai_tex_1[i_8];
                                                            }
                                                        }
                                                        pohai_tex_1 = new_pohai_tex;
                                                    }
                                                    //开始p图
                                                    var sources_1 = process.cwd() + "\\static\\xiaoye\\ps\\" + pohai_pic_1; //载入迫害图
                                                    loadImage(sources_1).then(function (image) {
                                                        var canvas = createCanvas(parseInt(image.width), parseInt(image.height)); //根据迫害图尺寸创建画布
                                                        var ctx = canvas.getContext("2d");
                                                        ctx.drawImage(image, 0, 0);
                                                        ctx.font = tex_config_1[4] + "px Sans";
                                                        ctx.textAlign = "center";
                                                        ctx.rotate(tex_config_1[2]);
                                                        //ctx.fillStyle = "#00ff00";
                                                        var tex_width = Math.floor(ctx.measureText(pohai_tex_1).width);
                                                        console.log("\u6587\u5B57\u5BBD\u5EA6\uFF1A" + tex_width);
                                                        ctx.fillText(pohai_tex_1, tex_config_1[0], tex_config_1[1]);
                                                        var file_local = path.join("" + process.cwd(), "static", "xiaoye", "images", sha1(canvas.toBuffer()) + ".jpg");
                                                        fs.writeFileSync(file_local, canvas.toBuffer());
                                                        var file_online = "http://127.0.0.1:" + _this.global.web_port + "/xiaoye/images/" + sha1(canvas.toBuffer()) + ".jpg";
                                                        console.log("\u8FEB\u5BB3\u6210\u529F\uFF0C\u56FE\u7247\u53D1\u9001\uFF1A" + file_online);
                                                        res.send({
                                                            reply: "[CQ:image,file=" + file_online + ",url=" + file_online + "]"
                                                        });
                                                    });
                                                }
                                                else {
                                                    console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "//get_group_member_info\u9519\u8BEF\uFF1A" + error);
                                                    res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                                }
                                            });
                                        }
                                    }
                                    else {
                                        //如果需要换行，按 tex_config[3] 来换行
                                        if (pohai_tex_1.length > tex_config_1[3]) {
                                            var enter = tex_config_1[3];
                                            var new_pohai_tex = "";
                                            for (var i_9 = 0, j = 1; i_9 < pohai_tex_1.length; i_9++, j++) {
                                                if (j && j % enter == 0) {
                                                    new_pohai_tex += pohai_tex_1[i_9] + "\n";
                                                }
                                                else {
                                                    new_pohai_tex += pohai_tex_1[i_9];
                                                }
                                            }
                                            pohai_tex_1 = new_pohai_tex;
                                        }
                                        //开始p图
                                        var sources_2 = process.cwd() + "\\static\\xiaoye\\ps\\" + pohai_pic_1; //载入迫害图
                                        loadImage(sources_2).then(function (image) {
                                            var canvas = createCanvas(parseInt(image.width), parseInt(image.height)); //根据迫害图尺寸创建画布
                                            var ctx = canvas.getContext("2d");
                                            ctx.drawImage(image, 0, 0);
                                            ctx.font = tex_config_1[4] + "px Sans";
                                            ctx.textAlign = "center";
                                            ctx.rotate(tex_config_1[2]);
                                            //ctx.fillStyle = "#00ff00";
                                            var tex_width = Math.floor(ctx.measureText(pohai_tex_1).width);
                                            console.log("\u6587\u5B57\u5BBD\u5EA6\uFF1A" + tex_width);
                                            ctx.fillText(pohai_tex_1, tex_config_1[0], tex_config_1[1]);
                                            var file_local = path.join("" + process.cwd(), "static", "xiaoye", "images", sha1(canvas.toBuffer()) + ".jpg");
                                            fs.writeFileSync(file_local, canvas.toBuffer());
                                            var file_online = "http://127.0.0.1:" + _this.global.web_port + "/xiaoye/images/" + sha1(canvas.toBuffer()) + ".jpg";
                                            console.log("\u8FEB\u5BB3\u6210\u529F\uFF0C\u56FE\u7247\u53D1\u9001\uFF1A" + file_online);
                                            res.send({
                                                reply: "[CQ:image,file=" + file_online + ",url=" + file_online + "]"
                                            });
                                        });
                                    }
                                    return 0;
                                }
                                //一个手雷
                                if (_this.global.hand_grenade_reg.test(req.body.message)) {
                                    var who_4;
                                    var holly_hand_grenade = Math.floor(Math.random() * 1000); //丢一个骰子，判断手雷是否变成神圣手雷
                                    var success_flag = Math.floor(Math.random() * 100); //丢一个骰子，判断手雷是否成功丢出
                                    var boom_time_1 = Math.floor(Math.random() * 60 * 2); //造成伤害时间
                                    if (holly_hand_grenade < 10) {
                                        //运营方暗调了出率，10‰几率变成神圣手雷
                                        request("http://" + _this.global.go_cqhttp_api + "/set_group_whole_ban?group_id=" + req.body.group_id + "&enable=1", function (error, _response, _body) {
                                            if (!error) {
                                                console.log("\u89E6\u53D1\u4E86\u795E\u5723\u624B\u96F7\uFF0C\u7FA4 " + req.body.group_id + " \u88AB\u5168\u4F53\u7981\u8A00");
                                                res.send({
                                                    reply: "\u5662\uFF0C\u8BE5\u6B7B\uFF0C\u6211\u7684\u4E0A\u5E1D\u554A\uFF0C\u771F\u662F\u4E0D\u6562\u76F8\u4FE1\uFF0C\u77A7\u77A7\u6211\u53D1\u73B0\u4E86\u4EC0\u4E48\uFF0C\u6211\u53D1\u8A93\u6211\u6CA1\u6709\u770B\u9519\uFF0C\u8FD9\u7ADF\u7136\u662F\u4E00\u9897\u51FA\u73B0\u7387\u4E3A\u5343\u5206\u4E4B\u4E00\u7684\u795E\u5723\u624B\u96F7\uFF01\u6211\u662F\u8BF4\uFF0C\u8FD9\u662F\u4E00\u9897\u6BC1\u5929\u706D\u5730\u7684\u795E\u5723\u624B\u96F7\u554A\uFF01\u54C8\u5229\u8DEF\u4E9A\uFF01\u9EBB\u70E6\u7BA1\u7406\u5458\u89E3\u9664\u4E00\u4E0B"
                                                });
                                            }
                                            else {
                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_whole_ban\u9519\u8BEF\uFF1A" + error);
                                                res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                            }
                                        });
                                        return 0;
                                    }
                                    else {
                                        if (req.body.message === "一个手雷") {
                                            who_4 = req.body.user_id; //如果没有要求炸谁，那就是炸自己
                                            console.log("\u7FA4 " + req.body.group_id + " \u7684\u7FA4\u5458 " + req.body.user_id + " \u671D\u81EA\u5DF1\u4E22\u51FA\u4E00\u9897\u624B\u96F7");
                                        }
                                        else {
                                            who_4 = req.body.message;
                                            who_4 = who_4.replace("一个手雷 ", "");
                                            who_4 = who_4.replace("一个手雷", "");
                                            who_4 = who_4.replace("[CQ:at,qq=", "");
                                            who_4 = who_4.replace("]", "");
                                            who_4 = who_4.trim();
                                            if (_this.global.is_qq_reg.test(who_4)) {
                                                console.log("\u7FA4 " + req.body.group_id + " \u7684 \u7FA4\u5458 " + req.body.user_id + " \u5C1D\u8BD5\u5411 " + who_4 + " \u4E22\u51FA\u4E00\u9897\u624B\u96F7");
                                            }
                                            else {
                                                //目标不是qq号
                                                res.send({ reply: "\u4F60\u60F3\u4E22\u7ED9\u8C01\u624B\u96F7\u554A\uFF0C\u76EE\u6807\u4E0D\u53EF\u4EE5\u662F" + who_4 + "\uFF0C\u4E0D\u8981\u4E71\u4E22" });
                                                return 0;
                                            }
                                        }
                                        if (success_flag < 50 || who_4 === req.body.user_id) {
                                            //50%几率被自己炸伤
                                            console.log("\u7FA4 " + req.body.group_id + " \u7684 \u7FA4\u5458 " + req.body.user_id + " \u7684\u624B\u96F7\u70B8\u5230\u4E86\u81EA\u5DF1");
                                            res.send({
                                                reply: "[CQ:at,qq=" + req.body.user_id + "] \u5C0F\u624B\u4E00\u6ED1\uFF0C\u88AB\u81EA\u5DF1\u4E22\u51FA\u7684\u624B\u96F7\u70B8\u4F24\uFF0C\u9020\u6210\u4E86" + boom_time_1 + "\u79D2\u7684\u4F24\u5BB3\uFF0C\u82CD\u5929\u6709\u8F6E\u56DE\uFF0C\u5BB3\u4EBA\u7EC8\u5BB3\u5DF1\uFF0C\u795D\u4F60\u4E0B\u6B21\u597D\u8FD0",
                                                ban: 1,
                                                ban_duration: boom_time_1
                                            });
                                        }
                                        else {
                                            //成功丢出手雷
                                            request("http://" + _this.global.go_cqhttp_api + "/set_group_ban?group_id=" + req.body.group_id + "&user_id=" + who_4 + "&duration=" + boom_time_1, function (error, _response, _body) {
                                                if (!error) {
                                                    console.log("\u7FA4 " + req.body.group_id + " \u7684 \u7FA4\u5458 " + req.body.user_id + " \u7684\u624B\u96F7\u70B8\u5230\u4E86 " + who_4);
                                                    res.send({
                                                        reply: "\u606D\u559C[CQ:at,qq=" + who_4 + "]\u88AB[CQ:at,qq=" + req.body.user_id + "]\u4E22\u51FA\u7684\u624B\u96F7\u70B8\u4F24\uFF0C\u9020\u6210\u4E86" + boom_time_1 + "\u79D2\u7684\u4F24\u5BB3\uFF0C\u795D\u4F60\u4E0B\u6B21\u597D\u8FD0"
                                                    });
                                                }
                                                else {
                                                    console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_ban\u9519\u8BEF\uFF1A" + error);
                                                    res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                                }
                                            });
                                        }
                                    }
                                    return 0;
                                }
                                //埋地雷
                                if (_this.global.mine_reg.test(req.body.message)) {
                                    //获取该群是否已经达到最大共存地雷数
                                    db.all("SELECT * FROM mine WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                                        if (!err) {
                                            var length_1 = 0;
                                            try {
                                                length_1 = sql.length;
                                            }
                                            catch (err) {
                                                console.log("\u5730\u96F7\u4E3A\u7A7A");
                                            }
                                            if (length_1 < _this.global.max_mine_count) {
                                                //地雷还没满，先获取自增ID最新值sql.seq，随后mine表增加群地雷
                                                db.all("Select seq From sqlite_sequence Where name = 'mine'", function (err, sql) {
                                                    if (!err && sql[0]) {
                                                        db.run("INSERT INTO mine VALUES('" + (sql[0].seq + 1) + "', '" + req.body.group_id + "', '" + req.body.user_id + "')");
                                                        console.log(req.body.user_id + " \u5728\u7FA4 " + req.body.group_id + " \u57CB\u4E86\u4E00\u9897\u5730\u96F7");
                                                        res.send({
                                                            reply: "\u5927\u4F19\u6CE8\u610F\u5566\uFF01[CQ:at,qq=" + req.body.user_id + "]\u57CB\u96F7\u5E72\u574F\u4E8B\u5566\uFF01"
                                                        });
                                                    }
                                                    else {
                                                        console.log("\u57CB\u5730\u96F7\u51FA\u9519\u4E86\uFF1A" + err + "\uFF0C" + sql);
                                                    }
                                                });
                                            }
                                            else {
                                                console.log("\u7FA4 " + req.body.group_id + " \u7684\u5730\u96F7\u6EE1\u4E86");
                                                res.send({
                                                    reply: "[CQ:at,qq=" + req.body.user_id + "] \u8FD9\u4E2A\u7FA4\u7684\u5730\u96F7\u5DF2\u7ECF\u585E\u6EE1\u5566\uFF0C\u7B49\u6709\u5E78\u8FD0\u7FA4\u53CB\u8E29\u4E2D\u5730\u96F7\u4E4B\u540E\u518D\u6765\u57CB\u5427"
                                                });
                                                return 0;
                                            }
                                        }
                                        else {
                                            console.log("\u83B7\u53D6\u8BE5\u7FA4\u5730\u96F7\u51FA\u9519\u4E86\uFF1A" + err + "\uFF0C" + sql);
                                        }
                                    });
                                    return 0;
                                }
                                //踩地雷
                                if (_this.global.fuck_mine_reg.test(req.body.message)) {
                                    //搜索地雷库中现有地雷
                                    db.all("SELECT * FROM mine WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                                        //有雷，直接炸，炸完删地雷
                                        if (!err && sql[0]) {
                                            var boom_time = Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                                            console.log(sql[0].placed_qq + " \u5728\u7FA4 " + sql[0].group_id + " \u57CB\u7684\u5730\u96F7\u88AB\u6392\u7206\uFF0C\u96F7\u5DF2\u7ECF\u88AB\u5220\u9664");
                                            db.run("DELETE FROM mine WHERE mine_id = '" + sql[0].mine_id + "' ");
                                            res.send({
                                                reply: "[CQ:at,qq=" + req.body.user_id + "] \u8E29\u4E86\u4E00\u811A\u5730\u96F7\uFF0C\u4E3A\u4EC0\u4E48\u8981\u60F3\u4E0D\u5F00\u5462\uFF0C\u88AB[CQ:at,qq=" + sql[0].placed_qq + "]\u6240\u57CB\u5730\u96F7\u70B8\u6210\u91CD\u4F24\uFF0C\u4F11\u517B\u751F\u606F" + boom_time + "\u79D2\uFF01",
                                                ban: 1,
                                                ban_duration: boom_time
                                            });
                                            return 0;
                                        }
                                        else {
                                            //没有雷
                                            res.send({
                                                reply: "[CQ:at,qq=" + req.body.user_id + "] \u8FD9\u4E2A\u96F7\u533A\u91CC\u7684\u96F7\u4F3C\u4E4E\u5DF2\u7ECF\u88AB\u52C7\u58EB\u4EEC\u6392\u5E72\u51C0\u4E86\uFF0C\u4E0D\u5982\u8D81\u73B0\u5728\u57CB\u4E00\u4E2A\u5427\uFF01"
                                            });
                                        }
                                    });
                                    return 0;
                                }
                                //希望的花
                                if (_this.global.hope_flower_reg.test(req.body.message)) {
                                    var who_5;
                                    var boom_time_2 = Math.floor(Math.random() * 30); //造成0-30伤害时间
                                    if (req.body.message === "希望的花") {
                                        console.log("\u7FA4 " + req.body.group_id + " \u7684\u7FA4\u5458 " + req.body.user_id + " \u671D\u81EA\u5DF1\u4E22\u51FA\u4E00\u6735\u5E0C\u671B\u7684\u82B1");
                                        res.send({ reply: "\u56E2\u957F\uFF0C\u4F60\u5728\u505A\u4EC0\u4E48\u554A\uFF01\u56E2\u957F\uFF01\u5E0C\u671B\u7684\u82B1\uFF0C\u4E0D\u8981\u4E71\u4E22\u554A\u554A\u554A\u554A" });
                                        return 0;
                                    }
                                    else {
                                        who_5 = req.body.message;
                                        who_5 = who_5.replace("希望的花 ", "");
                                        who_5 = who_5.replace("希望的花", "");
                                        who_5 = who_5.replace("[CQ:at,qq=", "");
                                        who_5 = who_5.replace("]", "");
                                        who_5 = who_5.trim();
                                        if (_this.global.is_qq_reg.test(who_5)) {
                                            console.log("\u7FA4 " + req.body.group_id + " \u7684 \u7FA4\u5458 " + req.body.user_id + " \u5411 " + who_5 + " \u4E22\u51FA\u4E00\u6735\u5E0C\u671B\u7684\u82B1");
                                        }
                                        else {
                                            //目标不是qq号
                                            res.send({ reply: "\u56E2\u957F\uFF0C\u4F60\u5728\u505A\u4EC0\u4E48\u554A\uFF01\u56E2\u957F\uFF01\u5E0C\u671B\u7684\u82B1\u76EE\u6807\u4E0D\u53EF\u4EE5\u662F" + who_5 + "\uFF0C\u4E0D\u8981\u4E71\u4E22\u554A\u554A\u554A\u554A" });
                                            return 0;
                                        }
                                    }
                                    //先救活目标
                                    request("http://" + _this.global.go_cqhttp_api + "/set_group_ban?group_id=" + req.body.group_id + "&user_id=" + who_5 + "&duration=0", function (error, _response, _body) {
                                        if (!error) {
                                            console.log("\u7FA4 " + req.body.group_id + " \u7684 \u7FA4\u5458 " + req.body.user_id + " \u6551\u6D3B\u4E86 " + who_5);
                                            res.send({
                                                reply: "\u56E2\u957F\uFF0C\u56E2\u957F\u4F60\u5728\u505A\u4EC0\u4E48\u554A\u56E2\u957F\uFF0C\u56E2\u957F\uFF01\u4E3A\u4EC0\u4E48\u8981\u6551\u4ED6\u554A\uFF0C\u54FC\uFF0C\u5443\uFF0C\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\u554A\uFF01\uFF01\uFF01\u56E2\u957F\u6551\u4E0B\u4E86[CQ:at,qq=" + who_5 + "]\uFF0C\u4F46\u81EA\u5DF1\u88AB\u70B8\u98DE\u4E86\uFF0C\u4F11\u517B\u751F\u606F" + boom_time_2 + "\u79D2\uFF01\u4E0D\u8981\u505C\u4E0B\u6765\u554A\uFF01"
                                            });
                                        }
                                        else {
                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_whole_ban\u9519\u8BEF\uFF1A" + error);
                                            res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                        }
                                    });
                                    //再禁言团长
                                    request("http://" + _this.global.go_cqhttp_api + "/set_group_ban?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id + "&duration=" + boom_time_2, function (error, _response, _body) {
                                        if (!error) {
                                            console.log(req.body.user_id + " \u81EA\u5DF1\u88AB\u70B8\u4F24" + boom_time_2 + "\u79D2");
                                        }
                                        else {
                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_whole_ban\u9519\u8BEF\uFF1A" + error);
                                            res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                        }
                                    });
                                    return 0;
                                }
                                //击鼓传雷
                                if (_this.global.loop_bomb_reg.test(req.body.message)) {
                                    //先检查群有没有开始游戏
                                    db.all("SELECT * FROM qq_group WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                                        if (!err && sql[0]) {
                                            //判断游戏开关 loop_bomb_enabled，没有开始的话就开始游戏，如果游戏已经超时结束了的话重新开始
                                            if (sql[0].loop_bomb_enabled === 0 || 60 - process.hrtime([sql[0].loop_bomb_start_time, 0])[0] < 0) {
                                                //游戏开始
                                                db.run("UPDATE qq_group SET loop_bomb_enabled = '1' WHERE group_id ='" + req.body.group_id + "'");
                                                var text = "击鼓传雷游戏开始啦，这是一个只有死亡才能结束的游戏，做好准备了吗";
                                                request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(text), function (error, _response, _body) {
                                                    if (!error) {
                                                        console.log("\u7FA4 " + req.body.group_id + " \u5F00\u59CB\u4E86\u51FB\u9F13\u4F20\u96F7");
                                                        this.io.emit("system message", "@\u7FA4 " + req.body.group_id + " \u5F00\u59CB\u4E86\u51FB\u9F13\u4F20\u96F7");
                                                    }
                                                    else {
                                                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                    }
                                                });
                                                //给发起人出题，等待ta回答
                                                _this["this"].tools.ECYWenDa()
                                                    .then(function (resolve) {
                                                    var question = "\u90A3\u4E48[CQ:at,qq=" + req.body.user_id + "]\u8BF7\u542C\u9898\uFF1A" + resolve.quest + " \u8BF7\u544A\u8BC9\u5C0F\u591C\uFF1A\u51FB\u9F13\u4F20\u96F7 \u4F60\u7684\u7B54\u6848\uFF0C\u65F6\u95F4\u5269\u4F5959\u79D2";
                                                    var answer = resolve.result; //把答案、目标人、开始时间存入数据库
                                                    db.run("UPDATE qq_group SET loop_bomb_answer = '" + answer + "', loop_bomb_onwer = '" + req.body.user_id + "' , loop_bomb_start_time = '" + process.hrtime()[0] + "' WHERE group_id ='" + req.body.group_id + "'");
                                                    //金手指
                                                    request("http://" + _this.global.go_cqhttp_api + "/set_group_card?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id + "&card=" + encodeURI(answer), function (error, _response, _body) {
                                                        if (!error) {
                                                            console.log("\u51FB\u9F13\u4F20\u96F7\u91D1\u624B\u6307\u5DF2\u542F\u52A8");
                                                        }
                                                        else {
                                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_card\u9519\u8BEF\uFF1A" + error);
                                                        }
                                                    });
                                                    //丢出问题
                                                    setTimeout(function () {
                                                        request("http://" + this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(question), function (error, _response, _body) {
                                                            if (!error) {
                                                            }
                                                            else {
                                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                            }
                                                        });
                                                    }, 1000);
                                                })["catch"](function (reject) {
                                                    res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86\uFF1A" + reject });
                                                    console.log("\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86\uFF1A" + reject);
                                                });
                                                //开始倒计时，倒计时结束宣布游戏结束
                                                (_this.global.boom_timer = setTimeout(function () {
                                                    var _this = this;
                                                    console.log("\u7FA4 " + req.body.group_id + " \u7684\u51FB\u9F13\u4F20\u96F7\u5230\u8FBE\u65F6\u95F4\uFF0C\u70B8\u4E86");
                                                    var boom_time = Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                                                    //获取这个雷现在是谁手上，炸ta
                                                    db.all("SELECT * FROM qq_group WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                                                        if (!err && sql[0]) {
                                                            request("http://" + _this.global.go_cqhttp_api + "/set_group_ban?group_id=" + req.body.group_id + "&user_id=" + sql[0].loop_bomb_onwer + "&duration=" + boom_time, function (error, _response, _body) {
                                                                if (!error) {
                                                                    console.log(sql[0].loop_bomb_onwer + " \u5728\u7FA4 " + req.body.group_id + " \u56DE\u7B54\u8D85\u65F6\uFF0C\u88AB\u70B8\u4F24" + boom_time + "\u79D2");
                                                                    //金手指关闭
                                                                    request("http://" + this.global.go_cqhttp_api + "/set_group_card?group_id=" + req.body.group_id + "&user_id=" + sql[0].loop_bomb_onwer + "&card=", function (error, _response, _body) {
                                                                        if (!error) {
                                                                            console.log("\u51FB\u9F13\u4F20\u96F7\u91D1\u624B\u6307\u5DF2\u6062\u590D");
                                                                        }
                                                                        else {
                                                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_card\u9519\u8BEF\uFF1A" + error);
                                                                        }
                                                                    });
                                                                    var end = "\u65F6\u95F4\u5230\u4E86\uFF0Cpia\uFF0C\u96F7\u5728[CQ:at,qq=" + sql[0].loop_bomb_onwer + "]\u624B\u4E0A\u70B8\u4E86\uFF0C\u4F60\u88AB\u70B8\u6210\u91CD\u4F24\u4E86\uFF0C\u4F11\u517B\u751F\u606F" + boom_time + "\u79D2\uFF01\u6E38\u620F\u7ED3\u675F\uFF01\u4E0B\u6B21\u52A0\u6CB9\u5662\uFF0C\u90A3\u4E48\u7B54\u6848\u516C\u5E03\uFF1A" + sql[0].loop_bomb_answer;
                                                                    request("http://" + this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(end), function (error, _response, _body) {
                                                                        if (!error) {
                                                                            this.io.emit("system message", "@" + sql[0].loop_bomb_onwer + " \u5728\u7FA4 " + req.body.group_id + " \u56DE\u7B54\u8D85\u65F6\uFF0C\u88AB\u70B8\u4F24" + boom_time + "\u79D2");
                                                                        }
                                                                        else {
                                                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                                        }
                                                                    });
                                                                    //游戏结束，清空数据
                                                                    db.run("UPDATE qq_group SET loop_bomb_enabled = '0', loop_bomb_answer = '', loop_bomb_onwer = '' , loop_bomb_start_time = '' WHERE group_id ='" + req.body.group_id + "'");
                                                                    return 0;
                                                                }
                                                                else {
                                                                    console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_whole_ban\u9519\u8BEF\uFF1A" + error);
                                                                }
                                                            });
                                                            _this.io.emit("system message", "@\u7FA4 " + req.body.group_id + " \u7684\u51FB\u9F13\u4F20\u96F7\u5230\u8FBE\u65F6\u95F4\uFF0C\u70B8\u4E86");
                                                        }
                                                    });
                                                }, 1000 * 60));
                                                //已经开始游戏了，判断答案对不对
                                            }
                                            else {
                                                var your_answer = req.body.message;
                                                your_answer = your_answer.replace("击鼓传雷 ", "");
                                                your_answer = your_answer.replace("击鼓传雷", "");
                                                your_answer = your_answer.trim();
                                                //从数据库里取答案判断
                                                db.all("SELECT * FROM qq_group WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                                                    if (!err && sql[0]) {
                                                        //判断答案 loop_bomb_answer
                                                        if (sql[0].loop_bomb_answer == your_answer) {
                                                            //答对了
                                                            //不是本人回答，是来抢答的
                                                            if (sql[0].loop_bomb_onwer != req.body.user_id) {
                                                                //无论对错都惩罚
                                                                var end = "[CQ:at,qq=" + req.body.user_id + "] \u62A2\u7B54\u6B63\u786E\uFF01\u7B54\u6848\u786E\u5B9E\u662F " + sql[0].loop_bomb_answer + "\uFF01\u4F46\u56E0\u4E3A\u62A2\u7B54\u4E86\u6240\u4EE5\u88AB\u60E9\u7F5A\u4E86\uFF01";
                                                                request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(end), function (error, _response, _body) {
                                                                    if (!error) {
                                                                        this.io.emit("system message", "@" + req.body.user_id + " \u5728\u7FA4 " + req.body.group_id + " \u56DE\u7B54\u6B63\u786E");
                                                                        //金手指关闭
                                                                        request("http://" + this.global.go_cqhttp_api + "/set_group_card?group_id=" + req.body.group_id + "&user_id=" + sql[0].loop_bomb_onwer + "&card=", //req.body.user_id
                                                                        function (error, _response, _body) {
                                                                            if (!error) {
                                                                                console.log("\u51FB\u9F13\u4F20\u96F7\u91D1\u624B\u6307\u5DF2\u6062\u590D");
                                                                            }
                                                                            else {
                                                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_card\u9519\u8BEF\uFF1A" + error);
                                                                            }
                                                                        });
                                                                        //禁言
                                                                        request("http://" + this.global.go_cqhttp_api + "/set_group_ban?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id + "&duration=60", function (error, _response, _body) {
                                                                            if (!error) {
                                                                                console.log("\u62A2\u7B54\u4E86\uFF0C" + req.body.user_id + " \u88AB\u7981\u8A00");
                                                                            }
                                                                            else {
                                                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_ban\u9519\u8BEF\uFF1A" + error);
                                                                                res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                                                            }
                                                                        });
                                                                    }
                                                                    else {
                                                                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                                    }
                                                                });
                                                            }
                                                            else {
                                                                //回答正确
                                                                //金手指关闭
                                                                request("http://" + _this.global.go_cqhttp_api + "/set_group_card?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id + "&card=", function (error, _response, _body) {
                                                                    if (!error) {
                                                                        console.log("\u51FB\u9F13\u4F20\u96F7\u91D1\u624B\u6307\u5DF2\u542F\u52A8");
                                                                    }
                                                                    else {
                                                                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_card\u9519\u8BEF\uFF1A" + error);
                                                                    }
                                                                });
                                                                var end = "[CQ:at,qq=" + req.body.user_id + "] \u56DE\u7B54\u6B63\u786E\uFF01\u7B54\u6848\u786E\u5B9E\u662F " + sql[0].loop_bomb_answer + "\uFF01";
                                                                request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(end), function (error, _response, _body) {
                                                                    if (!error) {
                                                                        this.io.emit("system message", "@" + sql[0].loop_bomb_onwer + " \u5728\u7FA4 " + req.body.group_id + " \u56DE\u7B54\u6B63\u786E");
                                                                    }
                                                                    else {
                                                                        console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                                    }
                                                                });
                                                            }
                                                            //答题成功，然后要把雷传给随机幸运群友，进入下一题
                                                            setTimeout(function () {
                                                                var _this = this;
                                                                request("http://" + this.global.go_cqhttp_api + "/get_group_member_list?group_id=" + req.body.group_id, function (err, response, body) {
                                                                    body = JSON.parse(body);
                                                                    if (!err && body.data.length != 0) {
                                                                        var rand_user_id = Math.floor(Math.random() * body.data.length);
                                                                        console.log("\u968F\u673A\u9009\u53D6\u4E00\u4E2A\u7FA4\u53CB\uFF1A" + body.data[rand_user_id].user_id);
                                                                        var rand_user_1 = body.data[rand_user_id].user_id;
                                                                        //选完之后开始下一轮游戏，先查询剩余时间，然后给随机幸运群友出题，等待ta回答
                                                                        db.all("SELECT * FROM qq_group WHERE group_id = '" + req.body.group_id + "'", function (err, sql) {
                                                                            if (!err && sql[0]) {
                                                                                _this["this"].tools.ECYWenDa()
                                                                                    .then(function (resolve) {
                                                                                    var diff = 60 - process.hrtime([sql[0].loop_bomb_start_time, 0])[0]; //剩余时间
                                                                                    var question = "\u62BD\u5230\u4E86\u5E78\u8FD0\u7FA4\u53CB[CQ:at,qq=" + rand_user_1 + "]\uFF01\u8BF7\u542C\u9898\uFF1A" + resolve.quest + " \u8BF7\u544A\u8BC9\u5C0F\u591C\uFF1A \u51FB\u9F13\u4F20\u96F7 \u4F60\u7684\u7B54\u6848\uFF0C\u65F6\u95F4\u8FD8\u5269\u4F59" + diff + "\u79D2";
                                                                                    var answer = resolve.result; //把答案、目标人存入数据库
                                                                                    db.run("UPDATE qq_group SET loop_bomb_answer = '" + answer + "', loop_bomb_onwer = '" + rand_user_1 + "' WHERE group_id ='" + req.body.group_id + "'");
                                                                                    //金手指
                                                                                    request("http://" + _this.global.go_cqhttp_api + "/set_group_card?group_id=" + req.body.group_id + "&user_id=" + rand_user_1 + "&card=" + encodeURI(answer), function (error, _response, _body) {
                                                                                        if (!error) {
                                                                                            console.log("\u51FB\u9F13\u4F20\u96F7\u91D1\u624B\u6307\u5DF2\u542F\u52A8");
                                                                                        }
                                                                                        else {
                                                                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_card\u9519\u8BEF\uFF1A" + error);
                                                                                        }
                                                                                    });
                                                                                    request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(question), function (error, _response, _body) {
                                                                                        if (!error) {
                                                                                            console.log("\u7FA4 " + req.body.group_id + " \u5F00\u59CB\u4E86\u4E0B\u4E00\u8F6E\u51FB\u9F13\u4F20\u96F7");
                                                                                            this.io.emit("system message", "@\u7FA4 " + req.body.group_id + " \u5F00\u59CB\u4E86\u4E0B\u4E00\u8F6E\u51FB\u9F13\u4F20\u96F7");
                                                                                        }
                                                                                        else {
                                                                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                                                        }
                                                                                    });
                                                                                })["catch"](function (reject) {
                                                                                    res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86\uFF1A" + reject });
                                                                                    console.log("\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86\uFF1A" + reject);
                                                                                });
                                                                            }
                                                                        });
                                                                    }
                                                                    else {
                                                                        console.log("随机选取一个群友错误。错误原因：" + JSON.stringify(response.body));
                                                                    }
                                                                    return 0;
                                                                });
                                                            }, 500);
                                                            //答错了
                                                        }
                                                        else {
                                                            var boom_time_3 = Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                                                            var end = "[CQ:at,qq=" + req.body.user_id + "] \u56DE\u7B54\u9519\u8BEF\uFF0C\u597D\u53EF\u60DC\uFF0C\u4F60\u88AB\u70B8\u6210\u91CD\u4F24\u4E86\uFF0C\u4F11\u517B\u751F\u606F" + boom_time_3 + "\u79D2\uFF01\u6E38\u620F\u7ED3\u675F\uFF01\u4E0B\u6B21\u52A0\u6CB9\u5662\uFF0C\u90A3\u4E48\u7B54\u6848\u516C\u5E03\uFF1A" + sql[0].loop_bomb_answer;
                                                            console.log(req.body.user_id + " \u5728\u7FA4 " + req.body.group_id + " \u56DE\u7B54\u9519\u8BEF\uFF0C\u88AB\u70B8\u4F24" + boom_time_3 + "\u79D2");
                                                            clearTimeout(_this.global.boom_timer);
                                                            request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(end), function (error, _response, _body) {
                                                                if (!error) {
                                                                    this.io.emit("system message", "@" + sql[0].loop_bomb_onwer + " \u5728\u7FA4 " + req.body.group_id + " \u56DE\u7B54\u6B63\u786E");
                                                                    //禁言
                                                                    request("http://" + this.global.go_cqhttp_api + "/set_group_ban?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id + "&duration=" + boom_time_3, function (error, _response, _body) {
                                                                        if (!error) {
                                                                            console.log("\u62A2\u7B54\u4E86\uFF0C" + req.body.user_id + " \u88AB\u7981\u8A00");
                                                                        }
                                                                        else {
                                                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_ban\u9519\u8BEF\uFF1A" + error);
                                                                            res.send({ reply: "\u65E5\u5FD2\u5A18\uFF0C\u600E\u4E48\u53C8\u51FA\u9519\u4E86" });
                                                                        }
                                                                    });
                                                                }
                                                                else {
                                                                    console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                                }
                                                            });
                                                            //游戏结束，删掉游戏记录
                                                            db.run("UPDATE qq_group SET loop_bomb_enabled = '0', loop_bomb_answer = '', loop_bomb_onwer = '' , loop_bomb_start_time = '' WHERE group_id ='" + req.body.group_id + "'");
                                                            //金手指关闭
                                                            request("http://" + _this.global.go_cqhttp_api + "/set_group_card?group_id=" + req.body.group_id + "&user_id=" + sql[0].loop_bomb_onwer + "&card=", function (error, _response, _body) {
                                                                if (!error) {
                                                                    console.log("\u51FB\u9F13\u4F20\u96F7\u91D1\u624B\u6307\u5DF2\u542F\u52A8");
                                                                }
                                                                else {
                                                                    console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_card\u9519\u8BEF\uFF1A" + error);
                                                                }
                                                            });
                                                            request("http://" + _this.global.go_cqhttp_api + "/set_group_card?group_id=" + req.body.group_id + "&user_id=" + req.body.user_id + "&card=", function (error, _response, _body) {
                                                                if (!error) {
                                                                    console.log("\u51FB\u9F13\u4F20\u96F7\u91D1\u624B\u6307\u5DF2\u542F\u52A8");
                                                                }
                                                                else {
                                                                    console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/set_group_card\u9519\u8BEF\uFF1A" + error);
                                                                }
                                                            });
                                                            return 0;
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                    });
                                }
                                //我有个朋友
                                if (_this.global.i_have_a_friend_reg.test(req.body.message)) {
                                    //指定目标的话
                                    if (_this.global.has_qq_reg.test(req.body.message)) {
                                        var msg_in = req.body.message.split("说")[1];
                                        var msg = msg_in.split("[CQ:at,qq=")[0].trim();
                                        var who = msg_in.split("[CQ:at,qq=")[1];
                                        var who = who.replace("]", "").trim();
                                        if (_this.global.is_qq_reg.test(who)) {
                                            var sources = "https://api.sumt.cn/api/qq.logo.php?qq=" + who; //载入头像
                                        }
                                        //没指定目标
                                    }
                                    else {
                                        var msg = req.body.message.split("说")[1];
                                        var sources = "https://api.sumt.cn/api/qq.logo.php?qq=" + req.body.user_id; //没有指定谁，那这个朋友就是ta自己
                                    }
                                    loadImage(sources).then(function (image) {
                                        var canvas = createCanvas(350, 80);
                                        var ctx = canvas.getContext("2d");
                                        ctx.fillStyle = "WHITE";
                                        ctx.fillRect(0, 0, 350, 80);
                                        ctx.font = "20px SimHei";
                                        ctx.textAlign = "left";
                                        ctx.fillStyle = "#000000";
                                        ctx.fillText("沙雕网友群", 90.5, 35.5);
                                        ctx.font = "16px SimHei";
                                        ctx.fillStyle = "#716F81";
                                        ctx.fillText("\u6C99\u96D5\u7F51\u53CB: " + msg, 90.5, 55.5);
                                        ctx.font = "13px SimHei";
                                        ctx.fillText(_this["this"].tools.CurentTime(), 280.5, 35.5);
                                        ctx.beginPath();
                                        ctx.arc(40, 40, 28, 0, 2 * Math.PI);
                                        ctx.fill();
                                        ctx.clip();
                                        ctx.drawImage(image, 10, 10, 60, 60);
                                        ctx.closePath();
                                        var file_local = path.join("" + process.cwd(), "static", "xiaoye", "images", sha1(canvas.toBuffer()) + ".jpg");
                                        fs.writeFileSync(file_local, canvas.toBuffer());
                                        var file_online = "http://127.0.0.1:" + _this.global.web_port + "/xiaoye/images/" + sha1(canvas.toBuffer()) + ".jpg";
                                        console.log("\u6211\u6709\u4E2A\u670B\u53CB\u5408\u6210\u6210\u529F\uFF0C\u56FE\u7247\u53D1\u9001\uFF1A" + file_online);
                                        res.send({
                                            reply: "[CQ:image,file=" + file_online + ",url=" + file_online + "]"
                                        });
                                    });
                                    return 0;
                                }
                                //查询运行状态
                                if (req.body.message === "/status") {
                                    console.log("\u67E5\u8BE2\u8FD0\u884C\u72B6\u6001");
                                    var self_id = req.body.self_id;
                                    if (self_id != _this.global.bot_qq) {
                                        //若配置qq和实际登录qq不匹配，则自动更新qq号
                                        var stat_1 = "\u914D\u7F6Eqq\uFF1A" + _this.global.bot_qq + " \u548C\u5B9E\u9645\u767B\u5F55qq\uFF1A" + self_id + " \u4E0D\u5339\u914D\uFF0C\u81EA\u52A8\u66F4\u65B0\u4E86qq\u53F7\u4E3A " + self_id;
                                        console.log("" + stat_1);
                                        _this.global.bot_qq = self_id;
                                        res.send({
                                            reply: stat_1
                                        });
                                        return 0;
                                    }
                                    self_id != "1648468212" ? (self_id = self_id) : (self_id = "1648468212(小小夜本家)"); //试着用一下三元运算符，比if稍微绕一些，但是习惯了非常符合直觉，原理是：当?前的条件成立时，执行:前的语句，不成立的话执行:后的语句
                                    var stat = "\u4F01\u5212\uFF1A\u661F\u91CE\u591C\u8776Official_" + _this.global.version + "_" + _this.global.bot_qq + "\n    \u5BBF\u4E3B\u5185\u6838\u67B6\u6784\uFF1A" + os.hostname() + " " + os.type() + " " + os.arch() + "\n    \u6B63\u5E38\u8FD0\u884C\u65F6\u95F4\uFF1A" + Math.round(os.uptime() / 60 / 60) + "\u5C0F\u65F6\n    \u5C0F\u591C\u5403\u6389\u4E86 " + Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB/" + Math.round(os.totalmem() / 1024 / 1024) + "MB \u5185\u5B58\n    \u5982\u679C\u8BE5\u5C0F\u591C\u51FA\u73B0\u4EFB\u4F55\u6545\u969C\uFF0C\u8BF7\u8054\u7CFB\u8BE5\u5C0F\u591C\u9886\u517B\u5458\uFF0C\n    \u4E5F\u53EF\u4EE5\u53D1\u9001 /\u62A5\u9519 \u5C0F\u591C\u7684\u9519\u8BEF \u6765\u63D0\u4EA4bug\u7ED9\u5F00\u53D1\u56E2\u961F\u3002\n    \u70B9\u51FB\u52A0\u5165\u591C\u7239\u5F00\u53D1\u7FA4\uFF1Ahttps://jq.qq.com/?_wv=1027&k=bTZSd2iI\n    ";
                                    res.send({
                                        reply: stat
                                    });
                                    return 0;
                                }
                                //字符画
                                if (_this.global.ascii_draw.test(req.body.message)) {
                                    var str = alphabet(req.body.message.replace("/字符画 ", ""), "stereo");
                                    console.log(str);
                                    res.send({
                                        reply: str
                                    });
                                    return 0;
                                }
                                //孤寡
                                if (_this.global.gugua.test(req.body.message)) {
                                    if (req.body.message == "/孤寡") {
                                        res.send({ reply: "\u5C0F\u591C\u6536\u5230\u4E86\u4F60\u7684\u5B64\u5BE1\u8BA2\u5355\uFF0C\u73B0\u5728\u5C31\u5F00\u59CB\u5B64\u5BE1\u4F60\u4E86\u5662\u5B64\u5BE1~" });
                                        _this["this"].tools.Gugua(req.body.user_id);
                                        return 0;
                                    }
                                    var who_6 = req.body.message.replace("/孤寡 ", "");
                                    who_6 = who_6.replace("/孤寡", "");
                                    who_6 = who_6.replace("[CQ:at,qq=", "");
                                    who_6 = who_6.replace("]", "");
                                    who_6 = who_6.trim();
                                    if (_this.global.is_qq_reg.test(who_6)) {
                                        request("http://" + _this.global.go_cqhttp_api + "/get_friend_list", function (err, response, body) {
                                            body = JSON.parse(body);
                                            if (!err && body.data.length != 0) {
                                                for (var i_10 in body.data) {
                                                    if (who_6 == body.data[i_10].user_id) {
                                                        res.send({ reply: "\u5C0F\u591C\u6536\u5230\u4E86\u4F60\u7684\u5B64\u5BE1\u8BA2\u5355\uFF0C\u73B0\u5728\u5C31\u5F00\u59CB\u5B64\u5BE1[CQ:at,qq=" + who_6 + "]\u4E86\u5662\u5B64\u5BE1~" });
                                                        request("http://" + _this.global.go_cqhttp_api + "/send_private_msg?user_id=" + who_6 + "&message=" + encodeURI("\u60A8\u597D\uFF0C\u6211\u662F\u5B64\u5BE1\u5C0F\u591C\uFF0C\u60A8\u7684\u597D\u53CB " + req.body.user_id + " \u7ED9\u60A8\u70B9\u4E86\u4E00\u4EFD\u5B64\u5BE1\u5957\u9910\uFF0C\u8BF7\u67E5\u6536"), function (error, _response, _body) {
                                                            if (!error) {
                                                                console.log("\u7FA4 " + req.body.group_id + " \u7684 \u7FA4\u5458 " + req.body.user_id + " \u5B64\u5BE1\u4E86 " + who_6);
                                                            }
                                                            else {
                                                                console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_private_msg\u9519\u8BEF\uFF1A" + error);
                                                            }
                                                        });
                                                        _this["this"].tools.Gugua(who_6);
                                                        return 0;
                                                    }
                                                }
                                                res.send({
                                                    reply: "\u5C0F\u591C\u6CA1\u6709[CQ:at,qq=" + who_6 + "]\u7684\u597D\u53CB\uFF0C\u6CA1\u6709\u529E\u6CD5\u5B64\u5BE1ta\u5462\uFF0C\u8BF7\u5148\u8BA9ta\u52A0\u5C0F\u591C\u4E3A\u597D\u53CB\u5427\uFF0C\u5C0F\u591C\u5C31\u5728\u7FA4\u91CC\u7ED9\u5927\u5BB6\u5B64\u5BE1\u4E00\u4E0B\u5427"
                                                });
                                                _this["this"].tools.QunGugua(req.body.group_id);
                                            }
                                            else {
                                                reject("随机选取一个群错误。错误原因：" + JSON.stringify(response.body));
                                            }
                                        });
                                    }
                                    else {
                                        //目标不是qq号
                                        res.send({ reply: "\u4F60\u60F3\u5B64\u5BE1\u8C01\u554A\uFF0C\u76EE\u6807\u4E0D\u53EF\u4EE5\u662F" + who_6 + "\uFF0C\u4E0D\u8981\u4E71\u5B64\u5BE1\uFF0C\u5C0F\u5FC3\u5B64\u5BE1\u4F60\u4E00\u8F88\u5B50\u554A" });
                                        return 0;
                                    }
                                    return 0;
                                }
                                //黑白生草图
                                if (_this.global.bww_reg.test(req.body.message)) {
                                    var msg = req.body.message + " " + " "; //结尾加2个空格防爆
                                    msg = msg.substr(4).split(" ");
                                    console.log(msg);
                                    var pic = msg[1].trim(), //使用图片
                                    tex1_1 = msg[2].trim(), //使用文字1
                                    tex2_1 = msg[3].trim(); //使用文字2
                                    //如果没有使用图片的话，默认图片
                                    if (!pic) {
                                        pic =
                                            "[CQ:image,file=657109635d3492bdb455defa8936ad96.image,url=https://gchat.qpic.cn/gchatpic_new/1005056803/2063243247-2847024251-657109635D3492BDB455DEFA8936AD96/0?term=3]";
                                    }
                                    //如果没有使用文字的话，默认文字
                                    if (!tex1_1) {
                                        tex1_1 = "\u5F53\u4F60\u51DD\u671B\u795E\u5723\u624B\u96F7\u7684\u65F6\u5019\uFF0C\u795E\u5723\u624B\u96F7\u4E5F\u5728\u51DD\u671B\u4F60";
                                    }
                                    if (!tex2_1) {
                                        tex2_1 = "\u3042\u306A\u305F\u304C\u795E\u5723\u624B\u96F7\u3092\u898B\u3064\u3081\u308B\u3068\u304D\u3001\u795E\u5723\u624B\u96F7\u3082\u3042\u306A\u305F\u3092\u898B\u3064\u3081\u3066\u3044\u307E\u3059";
                                    }
                                    //开始黑白
                                    var sources_3 = _this.global.img_url_reg.exec(pic)[0]; //取图片链接
                                    loadImage(sources_3).then(function (image) {
                                        var canvas = createCanvas(parseInt(image.width), parseInt(image.height + 150)); //根据图片尺寸创建画布，并在下方加文字区
                                        var ctx = canvas.getContext("2d");
                                        ctx.drawImage(image, 0, 0);
                                        ctx.filter = "grayscale";
                                        ctx.fillStyle = "BLACK";
                                        ctx.fillRect(0, parseInt(image.height), parseInt(image.width), 150);
                                        ctx.font = "40px Sans";
                                        ctx.textAlign = "center";
                                        ctx.fillStyle = "WHITE";
                                        ctx.fillText(tex1_1, parseInt(image.width) / 2, parseInt(image.height) + 70); //第一句
                                        ctx.font = "28px Sans";
                                        ctx.fillText(tex2_1, parseInt(image.width) / 2, parseInt(image.height) + 110); //第二句
                                        //把图片挨个像素转为黑白
                                        var canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                        for (var x = 0; x < canvasData.width; x++) {
                                            for (var y = 0; y < canvasData.height; y++) {
                                                // Index of the pixel in the array
                                                var idx = (x + y * canvasData.width) * 4;
                                                var r = canvasData.data[idx + 0];
                                                var g = canvasData.data[idx + 1];
                                                var b = canvasData.data[idx + 2];
                                                // calculate gray scale value
                                                var gray = 0.299 * r + 0.587 * g + 0.114 * b;
                                                // assign gray scale value
                                                canvasData.data[idx + 0] = gray; // Red channel
                                                canvasData.data[idx + 1] = gray; // Green channel
                                                canvasData.data[idx + 2] = gray; // Blue channel
                                                canvasData.data[idx + 3] = 255; // Alpha channel
                                                // add black border
                                                if (x < 8 || y < 8 || x > canvasData.width - 8 || y > canvasData.height - 8) {
                                                    canvasData.data[idx + 0] = 0;
                                                    canvasData.data[idx + 1] = 0;
                                                    canvasData.data[idx + 2] = 0;
                                                }
                                            }
                                        }
                                        ctx.putImageData(canvasData, 0, 0);
                                        var file_local = path.join("" + process.cwd(), "static", "xiaoye", "images", sha1(canvas.toBuffer()) + ".jpg");
                                        fs.writeFileSync(file_local, canvas.toBuffer());
                                        var file_online = "http://127.0.0.1:" + _this.global.web_port + "/xiaoye/images/" + sha1(canvas.toBuffer()) + ".jpg";
                                        console.log("\u9ED1\u767D\u6210\u529F\uFF0C\u56FE\u7247\u53D1\u9001\uFF1A" + file_online);
                                        res.send({
                                            reply: "[CQ:image,file=" + file_online + ",url=" + file_online + "]"
                                        });
                                    });
                                    return 0;
                                }
                                //生成二维码
                                if (_this.global.make_qrcode.test(req.body.message)) {
                                    var content = req.body.message.match(_this.global.make_qrcode)[1];
                                    res.send({
                                        reply: "[CQ:image,file=https://api.sumt.cn/api/qr.php?text=" + content + ",url=https://api.sumt.cn/api/qr.php?text=" + content + "]"
                                    });
                                    return 0;
                                }
                                //群欢迎
                                if (req.body.notice_type === "group_increase") {
                                    var final = "[CQ:at,qq=" + req.body.user_id + "] \u4F60\u597D\u5440\uFF0C\u6211\u662F\u672C\u7FA4RBQ\u62C5\u5F53\u5C0F\u591C\uFF01\u5C0F\u591C\u7684\u4F7F\u7528\u8BF4\u660E\u4E66\u5728\u8FD9\u91CC https://blog.giftia.moe/ \u5662\uFF0C\u8BF7\u95EE\u4E3B\u4EBA\u662F\u8981\u5148\u5403\u996D\u5462\uFF0C\u8FD8\u662F\u5148\u6D17\u6FA1\u5462\uFF0C\u8FD8\u662F\u5148*\u6211\u5462~";
                                    request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + req.body.group_id + "&message=" + encodeURI(final), function (error, _response, _body) {
                                        if (!error) {
                                            console.log(req.body.user_id + " \u52A0\u5165\u4E86\u7FA4 " + req.body.group_id + "\uFF0C\u5C0F\u591C\u6B22\u8FCE\u4E86ta");
                                        }
                                        else {
                                            console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                        }
                                    });
                                    return 0;
                                }
                                //管理员功能：提醒停止服务的群启用小夜
                                if (req.body.message === "/admin alert_open") {
                                    for (var i_11 in _this.global.qq_admin_list) {
                                        if (req.body.user_id == _this.global.qq_admin_list[i_11]) {
                                            console.log("\u7BA1\u7406\u5458\u542F\u52A8\u4E86\u63D0\u9192\u4EFB\u52A1");
                                            _this.AlertOpen().then(function (resolve) {
                                                res.send({
                                                    reply: "\u7BA1\u7406\u5458\u542F\u52A8\u4E86\u63D0\u9192\u4EFB\u52A1\uFF0C\u5F00\u59CB\u63D0\u9192\u505C\u6B62\u670D\u52A1\u7684\u7FA4\u542F\u7528\u5C0F\u591C\u2026\u2026" + resolve
                                                });
                                            });
                                            return 0;
                                        }
                                    }
                                    res.send({
                                        reply: "\u4F60\u4E0D\u662F\u72D7\u7BA1\u7406\u5662\uFF0C\u4E0D\u80FD\u8BA9\u5C0F\u591C\u8FD9\u6837\u90A3\u6837\u7684"
                                    });
                                    return 0;
                                }
                                //管理员功能：执行sql
                                if (_this.global.admin_reg.test(req.body.message)) {
                                    for (var i_12 in _this.global.qq_admin_list) {
                                        if (req.body.user_id == _this.global.qq_admin_list[i_12]) {
                                            var admin_code = req.body.message.replace("/admin sql ", "");
                                            console.log("\u7BA1\u7406\u5458sql\u6307\u4EE4");
                                            db.run(admin_code);
                                            res.send({
                                                reply: "\u7BA1\u7406\u5458sql\u6307\u4EE4\u6267\u884C\u5B8C\u6BD5"
                                            });
                                            return 0;
                                        }
                                    }
                                    res.send({
                                        reply: "\u4F60\u4E0D\u662F\u72D7\u7BA1\u7406\u5662\uFF0C\u4E0D\u80FD\u8BA9\u5C0F\u591C\u8FD9\u6837\u90A3\u6837\u7684"
                                    });
                                    return 0;
                                }
                                //管理员功能：修改聊天回复率
                                if (_this.global.change_reply_probability_reg.test(req.body.message)) {
                                    for (var i_13 in _this.global.qq_admin_list) {
                                        if (req.body.user_id == _this.global.qq_admin_list[i_13]) {
                                            var msg_8 = req.body.message.replace("/admin_change_reply_probability ", "");
                                            _this.global.reply_probability = msg_8;
                                            res.send({
                                                reply: "\u5C0F\u591C\u56DE\u590D\u7387\u5DF2\u4FEE\u6539\u4E3A" + msg_8 + "%"
                                            });
                                            return 0;
                                        }
                                    }
                                    res.send({
                                        reply: "\u4F60\u4E0D\u662F\u72D7\u7BA1\u7406\u5662\uFF0C\u4E0D\u80FD\u8BA9\u5C0F\u591C\u8FD9\u6837\u90A3\u6837\u7684"
                                    });
                                    return 0;
                                }
                                /*                    要新增指令与功能请在这条分割线的上方添加，在下面添加有可能会导致冲突以及不可预料的异常                    */
                                //随机抽风，丢一个骰子，按 chaos_probability 几率抽风
                                var chaos_flag = Math.floor(Math.random() * 1000);
                                if (chaos_flag < _this.global.chaos_probability) {
                                    //随机选一个群抽风
                                    var prprmsg_1;
                                    _this["this"].tools.PrprDoge()
                                        .then(function (resolve) {
                                        prprmsg_1 = resolve;
                                        _this["this"].tools.RandomGroupList()
                                            .then(function (resolve) {
                                            request("http://" + _this.global.go_cqhttp_api + "/send_group_msg?group_id=" + resolve + "&message=" + encodeURI(prprmsg_1), function (error, _response, _body) {
                                                if (!error) {
                                                    console.log("qqBot\u5C0F\u591C\u5728\u7FA4 " + resolve + " \u62BD\u98CE\u4E86\uFF0C\u53D1\u9001\u4E86 " + prprmsg_1);
                                                    this.io.emit("system message", "@qqBot\u5C0F\u591C\u5728\u7FA4 " + resolve + " \u62BD\u98CE\u4E86\uFF0C\u53D1\u9001\u4E86 " + prprmsg_1);
                                                }
                                                else {
                                                    console.log("\u8BF7\u6C42" + this.global.go_cqhttp_api + "/send_group_msg\u9519\u8BEF\uFF1A" + error);
                                                }
                                            });
                                        })["catch"](function (reject) {
                                            console.log(reject.error);
                                            res.send();
                                        });
                                    })["catch"](function (reject) {
                                        console.log("\u968F\u673A\u8214\u72D7\u9519\u8BEF\uFF1A" + reject);
                                    });
                                    return 0;
                                }
                                //丢一个骰子，按fudu_probability几率复读
                                var fudu_flag = Math.floor(Math.random() * 100);
                                if (fudu_flag < _this.global.fudu_probability) {
                                    console.log("qqBot\u5C0F\u591C\u590D\u8BFB " + req.body.message);
                                    _this.io.emit("system message", "@qqBot\u5C0F\u591C\u590D\u8BFB " + req.body.message);
                                    res.send({ reply: req.body.message });
                                    return 0;
                                }
                                //丢一个骰子，按reply_probability几率回复
                                var reply_flag = Math.floor(Math.random() * 100);
                                //如果被@了，那么回复几率上升80%
                                var at_replaced_msg = req.body.message; //要把[CQ:at,qq=${bot_qq}] 去除掉，否则聊天核心会乱成一锅粥
                                if (_this.global.xiaoye_ated.test(req.body.message)) {
                                    reply_flag -= 80;
                                    at_replaced_msg = req.body.message.replace("[CQ:at,qq=" + _this.global.bot_qq + "]", "").trim(); //去除@小夜
                                }
                                //骰子命中，那就让小夜来自动回复
                                if (reply_flag < _this.global.reply_probability) {
                                    _this["this"].tools.ChatProcess(at_replaced_msg)
                                        .then(function (resolve) {
                                        if (resolve.indexOf("[name]") || resolve.indexOf("&#91;name&#93;")) {
                                            resolve = resolve.toString().replace("[name]", "[CQ:at,qq=" + req.body.user_id + "]"); //替换[name]为正确的@
                                            resolve = resolve.toString().replace("&#91;name&#93;", "[CQ:at,qq=" + req.body.user_id + "]"); //替换[name]为正确的@
                                        }
                                        console.log("qqBot\u5C0F\u591C\u56DE\u590D " + resolve);
                                        _this.io.emit("system message", "@qqBot\u5C0F\u591C\u56DE\u590D\uFF1A" + resolve);
                                        res.send({ reply: resolve });
                                        return 0;
                                    })["catch"](function (reject) {
                                        //无匹配则随机回复balabala废话
                                        _this["this"].tools.GetBalabalaList()
                                            .then(function (resolve) {
                                            var random_balabala = resolve[Math.floor(Math.random() * resolve.length)].balabala;
                                            res.send({ reply: random_balabala });
                                            _this.io.emit("system message", "@qqBot\u5C0F\u591C\u89C9\u5F97" + random_balabala);
                                            console.log(reject + "\uFF0CqqBot\u5C0F\u591C\u89C9\u5F97" + random_balabala);
                                            return 0;
                                        })["catch"](function (reject) {
                                            console.log("\u5C0F\u591C\u8BD5\u56FEbalabala\u4F46\u51FA\u9519\u4E86\uFF1A" + reject);
                                            res.send({ reply: "\u5C0F\u591C\u8BD5\u56FEbalabala\u4F46\u51FA\u9519\u4E86\uFF1A" + reject });
                                            _this.io.emit("system message", "@qqBot\u5C0F\u591C\u8BD5\u56FEbalabala\u4F46\u51FA\u9519\u4E86\uFF1A" + reject);
                                            return 0;
                                        });
                                    });
                                }
                                else {
                                    res.send(); //相当于严格模式，如果有多条res.send将会报错
                                }
                            }
                            //群不存在于qq_group表则写入qq_group表
                        }
                        else {
                            console.log(req.body.group_id + " \u8FD9\u4E2A\u7FA4\u4E0D\u5728qq_group\u8868\u91CC\uFF0C\u73B0\u5728\u5199\u5165\u5230qq_group\u8868");
                            db.run("INSERT INTO qq_group VALUES('" + req.body.group_id + "', '1', '0', '', '', '')");
                            res.send();
                        }
                    });
                }
            }
            else if (req.body.message_type == "private" && _this.global.private_service_swich == true) {
                //私聊回复
                _this["this"].tools.ChatProcess(req.body.message)
                    .then(function (resolve) {
                    console.log("qqBot\u5C0F\u591C\u56DE\u590D " + resolve);
                    _this.io.emit("system message", "@qqBot\u5C0F\u591C\u56DE\u590D\uFF1A" + resolve);
                    res.send({ reply: resolve });
                })["catch"](function (reject) {
                    //无匹配则随机回复balabala废话
                    _this["this"].tools.GetBalabalaList()
                        .then(function (resolve) {
                        var random_balabala = resolve[Math.floor(Math.random() * resolve.length)].balabala;
                        res.send({ reply: random_balabala });
                        _this.io.emit("system message", "@qqBot\u5C0F\u591C\u89C9\u5F97" + random_balabala);
                        console.log(reject + "\uFF0CqqBot\u5C0F\u591C\u89C9\u5F97" + random_balabala);
                    })["catch"](function (reject) {
                        console.log("\u5C0F\u591C\u8BD5\u56FEbalabala\u4F46\u51FA\u9519\u4E86\uFF1A" + reject);
                        res.send({ reply: "\u5C0F\u591C\u8BD5\u56FEbalabala\u4F46\u51FA\u9519\u4E86\uFF1A" + reject });
                        _this.io.emit("system message", "@qqBot\u5C0F\u591C\u8BD5\u56FEbalabala\u4F46\u51FA\u9519\u4E86\uFF1A" + reject);
                    });
                });
                return 0;
            }
            else {
                res.send();
            }
        });
        //每隔4小时搜索qq_group表，随机延时提醒停用服务的群启用服务
        setInterval(this.AlertOpen, 1000 * 60 * 60 * 4);
    };
    //提醒张菊
    Core.prototype.AlertOpen = function () {
        var _this = this;
        return new Promise(function (resolve, _reject) {
            db.all("SELECT * FROM qq_group WHERE talk_enabled = 0", function (err, sql) {
                if (!err && sql[0]) {
                    var service_stoped_list = []; //停用服务的群列表
                    for (var i in sql) {
                        service_stoped_list.push(sql[i].group_id);
                    }
                    console.log("\u4EE5\u4E0B\u7FA4\u672A\u542F\u7528\u5C0F\u591C\u670D\u52A1\uFF1A" + service_stoped_list + " \uFF0C\u73B0\u5728\u5F00\u59CB\u968F\u673A\u5EF6\u65F6\u63D0\u9192");
                    _this["this"].tools.DelayAlert(service_stoped_list);
                    resolve("\u4EE5\u4E0B\u7FA4\u672A\u542F\u7528\u5C0F\u591C\u670D\u52A1\uFF1A" + service_stoped_list + " \uFF0C\u73B0\u5728\u5F00\u59CB\u968F\u673A\u5EF6\u65F6\u63D0\u9192");
                }
                else {
                    console.log("\u76EE\u524D\u6CA1\u6709\u7FA4\u662F\u5173\u95ED\u670D\u52A1\u7684\uFF0C\u633A\u597D");
                }
            });
        });
    };
    //直播间开关，星野夜蝶上线！
    Core.prototype.start_live = function () {
        setInterval(this.LoopDanmu, 5000);
    };
    //虚拟主播星野夜蝶核心代码，间隔5秒接收最新弹幕，如果弹幕更新了就开始处理，然后随机开嘴臭地图炮
    Core.prototype.LoopDanmu = function () {
        var _this = this;
        this["this"].tools.GetLaststDanmu()
            .then(function (resolve) {
            if (_this.global.last_danmu_timeline === resolve.timeline) {
                //弹幕没有更新
                console.log("\u5F39\u5E55\u6682\u672A\u66F4\u65B0");
                //丢一个骰子，如果命中了就开地图炮，1%的几率
                var ditupao_flag = Math.floor(Math.random() * 100);
                if (ditupao_flag < 1) {
                    _this["this"].tools.ChatProcess("").then(function (resolve) {
                        var reply = resolve;
                        console.log("\u5C0F\u591C\u5F00\u5730\u56FE\u70AE\u4E86\uFF1A" + reply);
                        //将直播小夜的回复写入txt，以便在直播姬显示
                        fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", reply);
                        //然后让小夜读出来
                        _this["this"].tools.BetterTTS(reply)
                            .then(function (resolve) {
                            var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\"); //这里似乎有问题，ntfs短文件名无法转换
                            voiceplayer.play(tts_file, function (err) {
                                if (err)
                                    throw err;
                            });
                        })["catch"](function (reject) {
                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        });
                    });
                }
            }
            else {
                console.log("\u83B7\u53D6\u5230\u6700\u65B0\u5F39\u5E55\uFF1A" + resolve.text);
                _this.global.last_danmu_timeline = resolve.timeline;
                _this.io.emit("sysrem message", "@\u5F39\u5E55\u4F20\u6765\uFF1A " + resolve.text);
                //卧槽这么多传参怎么复用啊
                //教学系统，抄板于虹原翼版小夜v3
                if (_this.global.teach_reg.test(resolve.text)) {
                    var msg = resolve.text;
                    msg = msg.replace(/'/g, ""); //防爆
                    msg = msg.substr(2).split("答：");
                    if (msg.length !== 2) {
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5206\u5272\u6709\u8BEF\uFF0C\u9000\u51FA\u6559\u5B66");
                        fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "\u4F60\u6559\u7684\u59FF\u52BF\u4E0D\u5BF9\u5662qwq");
                        _this["this"].tools.BetterTTS("你教的姿势不对噢qwq")
                            .then(function (resolve) {
                            var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                            voiceplayer.play(tts_file, function (err) {
                                if (err)
                                    throw err;
                            });
                        })["catch"](function (reject) {
                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        });
                        return 0;
                    }
                    var ask = msg[0].trim(), ans = msg[1].trim();
                    if (ask == "" || ans == "") {
                        console.log("\u95EE/\u7B54\u4E3A\u7A7A\uFF0C\u9000\u51FA\u6559\u5B66");
                        fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "\u4F60\u6559\u7684\u59FF\u52BF\u4E0D\u5BF9\u5662qwq");
                        _this["this"].tools.BetterTTS("你教的姿势不对噢qwq")
                            .then(function (resolve) {
                            var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                            voiceplayer.play(tts_file, function (err) {
                                if (err)
                                    throw err;
                            });
                        })["catch"](function (reject) {
                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        });
                        return 0;
                    }
                    if (ask.indexOf(/\r?\n/g) !== -1) {
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5173\u952E\u8BCD\u6362\u884C\u4E86\uFF0C\u9000\u51FA\u6559\u5B66");
                        fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "\u5173\u952E\u8BCD\u4E0D\u80FD\u6362\u884C\u5566qwq");
                        _this["this"].tools.BetterTTS("关键词不能换行啦qwq")
                            .then(function (resolve) {
                            var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                            voiceplayer.play(tts_file, function (err) {
                                if (err)
                                    throw err;
                            });
                        })["catch"](function (reject) {
                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        });
                        return 0;
                    }
                    console.log("\u5F39\u5E55\u60F3\u8981\u6559\u7ED9\u5C0F\u591C\uFF1A\u95EE\uFF1A" + ask + " \u7B54\uFF1A" + ans + "\uFF0C\u73B0\u5728\u5F00\u59CB\u68C0\u6D4B\u5408\u6CD5\u6027");
                    for (var i in _this.global.black_list_words) {
                        if (ask.toLowerCase().indexOf(_this.global.black_list_words[i].toLowerCase()) !== -1 ||
                            ans.toLowerCase().indexOf(_this.global.black_list_words[i].toLowerCase()) !== -1) {
                            console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u68C0\u6D4B\u5230\u4E0D\u5141\u8BB8\u7684\u8BCD\uFF1A" + _this.global.black_list_words[i] + "\uFF0C\u9000\u51FA\u6559\u5B66");
                            fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "\u4F60\u6559\u7684\u5185\u5BB9\u91CC\u6709\u4E3B\u4EBA\u4E0D\u5141\u8BB8\u5C0F\u591C\u5B66\u4E60\u7684\u8BCD\uFF1A" + _this.global.black_list_words[i] + " qwq");
                            _this["this"].tools.BetterTTS("\u4F60\u6559\u7684\u5185\u5BB9\u91CC\u6709\u4E3B\u4EBA\u4E0D\u5141\u8BB8\u5C0F\u591C\u5B66\u4E60\u7684\u8BCD\uFF1A" + _this.global.black_list_words[i] + " qwq")
                                .then(function (resolve) {
                                var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                                voiceplayer.play(tts_file, function (err) {
                                    if (err)
                                        throw err;
                                });
                            })["catch"](function (reject) {
                                console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                            });
                            return 0;
                        }
                    }
                    if (Buffer.from(ask).length < 4) {
                        //关键词最低长度：4个英文或2个汉字
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5173\u952E\u8BCD\u592A\u77ED\uFF0C\u9000\u51FA\u6559\u5B66");
                        fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "\u5173\u952E\u8BCD\u592A\u77ED\u4E86\u5566qwq\uFF0C\u81F3\u5C11\u89814\u4E2A\u5B57\u8282\u5566");
                        _this["this"].tools.BetterTTS("关键词太短了啦qwq，至少要4个字节啦")
                            .then(function (resolve) {
                            var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                            voiceplayer.play(tts_file, function (err) {
                                if (err)
                                    throw err;
                            });
                        })["catch"](function (reject) {
                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        });
                        return 0;
                    }
                    if (ask.length > 100 || ans.length > 100) {
                        console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u6559\u7684\u592A\u957F\u4E86\uFF0C\u9000\u51FA\u6559\u5B66");
                        fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "\u4F60\u6559\u7684\u5185\u5BB9\u592A\u957F\u4E86\uFF0C\u5C0F\u591C\u8981\u574F\u6389\u4E86qwq\uFF0C\u4E0D\u8981\u5440");
                        _this["this"].tools.BetterTTS("你教的内容太长了，小夜要坏掉了qwq，不要呀")
                            .then(function (resolve) {
                            var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                            voiceplayer.play(tts_file, function (err) {
                                if (err)
                                    throw err;
                            });
                        })["catch"](function (reject) {
                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        });
                        return 0;
                    }
                    //到这里都没有出错的话就视为没有问题，可以让小夜学了
                    console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u6CA1\u6709\u68C0\u6D4B\u5230\u95EE\u9898\uFF0C\u53EF\u4EE5\u5B66\u4E60");
                    db.run("INSERT INTO chat VALUES('" + ask + "', '" + ans + "')");
                    console.log("\u6559\u5B66\u6307\u4EE4\uFF1A\u5B66\u4E60\u6210\u529F");
                    fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "\u54C7\uFF01\u5C0F\u591C\u5B66\u4F1A\u5566\uFF01\u5BF9\u6211\u8BF4\uFF1A" + ask + " \u8BD5\u8BD5\u5427\uFF0C\u5C0F\u591C\u6709\u53EF\u80FD\u4F1A\u56DE\u590D " + ans + " \u5662");
                    _this["this"].tools.BetterTTS("\u54C7\uFF01\u5C0F\u591C\u5B66\u4F1A\u5566\uFF01\u5BF9\u6211\u8BF4\uFF1A" + ask + " \u8BD5\u8BD5\u5427\uFF0C\u5C0F\u591C\u6709\u53EF\u80FD\u4F1A\u56DE\u590D " + ans + " \u5662")
                        .then(function (resolve) {
                        var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                        voiceplayer.play(tts_file, function (err) {
                            if (err)
                                throw err;
                        });
                    })["catch"](function (reject) {
                        console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                    });
                    return 0;
                }
                else {
                    _this["this"].tools.ChatProcess(resolve.text)
                        .then(function (resolve) {
                        var reply = resolve;
                        console.log("\u5C0F\u591C\u8BF4\uFF1A" + reply);
                        fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", "" + reply);
                        _this["this"].tools.BetterTTS(reply)
                            .then(function (resolve) {
                            var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                            voiceplayer.play(tts_file, function (err) {
                                if (err)
                                    throw err;
                            });
                        })["catch"](function (reject) {
                            console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                        });
                    })["catch"](function (reject) {
                        //如果没有匹配到回复，那就随机回复balabala废话
                        console.log(reject + "\uFF0C\u5F39\u5E55\u6CA1\u6709\u5339\u914D");
                        _this["this"].tools.GetBalabalaList()
                            .then(function (resolve) {
                            var random_balabala = resolve[Math.floor(Math.random() * resolve.length)].balabala;
                            fs.writeFileSync("./static/xiaoye/live_lastst_reply.txt", random_balabala);
                            _this["this"].tools.BetterTTS(random_balabala)
                                .then(function (resolve) {
                                var tts_file = process.cwd() + "\\static" + resolve.file.replace("/", "\\");
                                voiceplayer.play(tts_file, function (err) {
                                    if (err)
                                        throw err;
                                });
                            })["catch"](function (reject) {
                                console.log("TTS\u9519\u8BEF\uFF1A" + reject);
                            });
                            console.log(reject + "\uFF0CqqBot\u5C0F\u591C\u89C9\u5F97" + random_balabala);
                        })["catch"](function (reject) {
                            console.log("\u5C0F\u591C\u8BD5\u56FEbalabala\u4F46\u51FA\u9519\u4E86\uFF1A" + reject);
                        });
                    });
                }
            }
        })["catch"](function (reject) {
            console.log(reject.error);
        });
    };
    return Core;
}());
exports.Core = Core;
