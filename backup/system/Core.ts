//模块依赖和底层配置
const compression = require("compression"); //用于gzip压缩
const express = require("express"); //轻巧的express框架
const app = require("express")();
app.use(compression()); //对express所有路由启用gzip
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
// const multer = require("multer"); //用于文件上传
// const cookie = require("cookie");
const http = require("http").Server(app);
const io = require("socket.io")(http);
const request = require("request");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
const fs = require("fs");
const path = require("path");
const jieba = require("nodejieba"); //中文分词器
jieba.load({
dict: path.join(`${process.cwd()}`, "config", "jieba.dict.utf8"),
hmmDict: path.join(`${process.cwd()}`, "config", "hmm_model.utf8"),
userDict: path.join(`${process.cwd()}`, "config", "userDict.txt"), //加载自定义分词库
idfDict: path.join(`${process.cwd()}`, "config", "idf.utf8"),
stopWordDict: path.join(`${process.cwd()}`, "config", "stopWordDict.txt"), //加载分词库黑名单
});
const voiceplayer = require("play-sound")(({ player: `${process.cwd()}/plugins/cmdmp3win.exe` })); //mp3静默播放工具，用于直播时播放语音
const { createCanvas, loadImage } = require("canvas"); //用于绘制文字图像，迫害p图
const { resolve } = require("path");
const os = require("os"); //用于获取系统工作状态
const { exit } = require("process");
require.all = require("require.all"); //插件加载器
const alphabet = require("alphabetjs");
const cookie = require("cookie");

import {Tools} from './Tools';
import {Global} from './Global';

class Core {
    tools: Tools = null;
    global: Global = null;

    constructor(global: Global, tools: Tools) {
        this.global = global;
        this.tools = tools;
    }

    init() {
        //web端核心代码，socket事件处理
        io.on("connection", (socket) => {
            console.log('connection...');
            socket.emit("getcookie");
            let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
            if (CID === undefined) {
                socket.emit("getcookie");
                return 0;
            }
            socket.emit("version", g.version);
            io.emit("onlineusers", ++g.onlineusers);

            //开始获取用户信息并处理
            this.tools.GetUserData(CID)
                .then(([nickname, logintimes, lastlogintime]) => {
                    console.log(`${this.tools.Curentyyyymmdd() + this.tools.CurentTime()}用户 ${nickname}(${CID}) 已连接`);

                    //更新登录次数
                    db.run(`UPDATE users SET logintimes = logintimes + 1 WHERE CID ='${CID}'`);

                    //更新最后登陆时间
                    db.run(`UPDATE users SET lastlogintime = '${this.tools.Curentyyyymmdd()}${this.tools.CurentTime()}' WHERE CID ='${CID}'`);

                    socket.username = nickname;

                    io.emit("system message", `@欢迎回来，${socket.username}(${CID}) 。这是你第${logintimes}次访问。上次访问时间：${lastlogintime}`);
                })
                //若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作：
                .catch((reject) => {
                    let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
                    console.log(`GetUserData(): rejected, and err:${reject}`);
                    console.log(`${this.tools.Curentyyyymmdd() + this.tools.CurentTime()}新用户 ${CID} 已连接`);
                    this.tools.RandomNickname()
                        .then((resolve) => {
                            db.run(`INSERT INTO users VALUES('${resolve}', '${CID}', '2', '${this.tools.Curentyyyymmdd()}${this.tools.CurentTime()}')`);
                            socket.username = resolve;
                            io.emit("system message", `@新用户 ${CID} 已连接。小夜帮你取了一个随机昵称：「${socket.username}」，请前往 更多-设置 来更改昵称`);
                            socket.emit("chat message", {
                                CID: "0",
                                msg: g.help,
                            });
                        })
                        .catch((reject) => {
                            console.log(`随机昵称错误：${reject}`);
                            db.run(`INSERT INTO users VALUES('匿名', '${CID}', '2', '${this.tools.Curentyyyymmdd()}${this.tools.CurentTime()}')`);
                            socket.username = "匿名";
                            io.emit("system message", `@新用户 ${CID} 已连接。现在你的昵称是 匿名 噢，请前往 更多-设置 来更改昵称`);
                            socket.emit("chat message", {
                                CID: "0",
                                msg: g.help,
                            });
                        });
                });

            socket.on("disconnect", () => {
                g.onlineusers--;
                io.emit("g.onlineusers", g.onlineusers);
                console.log(`${this.tools.Curentyyyymmdd()}${this.tools.CurentTime()} 用户 ${socket.username} 已断开连接`);
                io.emit("system message", "@用户 " + socket.username + " 已断开连接");
            });

            socket.on("typing", () => {
                io.emit("typing", `${socket.username} 正在输入...`);
            });

            socket.on("typing_over", () => {
                io.emit("typing", "");
            });

            //用户设置
            socket.on("getsettings", () => {
                let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
                socket.emit("settings", { CID: CID, name: socket.username });
            });

            //更新日志
            socket.on("getupdatelog", () => {
                socket.emit("updatelog", g.updatelog);
            });

            //致谢列表
            socket.on("thanks", () => {
                socket.emit("thanks", g.thanks);
            });

            //web端最核心代码，聊天处理
            socket.on("chat message", (msg) => {
                let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
                var msg = msg.msg;
                msg = msg.replace(/'/g, ""); //防爆
                msg = msg.replace(/</g, ""); //防爆
                msg = msg.replace(/>/g, ""); //防爆
                console.log(`${this.tools.Curentyyyymmdd() + this.tools.CurentTime()}收到用户 ${socket.username}(${CID}) 的消息: ${msg}`);
                db.run(`INSERT INTO messages VALUES('${this.tools.Curentyyyymmdd()}', '${this.tools.CurentTime()}', '${CID}', '${msg}')`);

                io.emit("chat message", { CID: CID, name: socket.username, msg: msg }); //用户广播

                //开始if地狱
                if (g.rename_reg.test(msg)) {
                    db.run(`UPDATE users SET nickname = '${msg.slice(8)}' WHERE CID ='${CID}'`);
                    io.emit("chat message", {
                        CID: "0",
                        msg: `@昵称重命名完毕，小夜现在会称呼你为 ${msg.slice(8)} 啦`,
                    });
                } else if (msg === "/log_view") {
                    db.all("SELECT yyyymmdd, COUNT(*) As count FROM messages Group by yyyymmdd", (e, sql) => {
                        var data = [];
                        if (!e) {
                            for (let i = 0; i < sql.length; i++) {
                                data.push([sql[i].yyyymmdd, sql[i].count]);
                            }
                            console.log(data);
                            io.emit("chart message", data);
                        } else {
                            console.log(`/log_view错误：${e}`);
                            io.emit("chat message", { CID: "0", msg: `@${e}` });
                        }
                    });
                } else if (g.bv2av_reg.test(msg)) {
                    msg = msg.replace(" ", "");
                    this.tools.Bv2Av(msg)
                        .then((resolve) => {
                            io.emit("chat message", { CID: "0", msg: resolve });
                        })
                        .catch((reject) => {
                            console.log(`Bv2Av(): rejected, and err:${reject}`);
                            io.emit("system message", `@Bv2Av() err:${reject}`);
                        });
                } else if (msg === "/reload") {
                    io.emit("reload");
                } else if (msg === "/帮助") {
                    io.emit("chat message", { CID: "0", msg: `@${g.help}` });
                } else if (msg === "/随机cos") {
                    this.tools.RandomCos()
                        .then((resolve) => {
                            io.emit("pic message", resolve);
                        })
                        .catch((reject) => {
                            console.log(`RandomCos(): rejected, and err:${reject}`);
                            io.emit("system message", `@RandomCos() err:${reject}`);
                        });
                } else if (msg === "/随机买家秀") {
                    this.tools.RandomTbshow()
                        .then((resolve) => {
                            io.emit("pic message", resolve);
                        })
                        .catch((reject) => {
                            console.log(`RandomTbshow(): rejected, and err:${reject}`);
                            io.emit("system message", `@RandomTbshow() err:${reject}`);
                        });
                } else if (msg === "/随机冷知识") {
                    this.tools.RandomHomeword()
                        .then((resolve) => {
                            io.emit("chat message", { CID: "0", msg: `@${resolve}` });
                        })
                        .catch((reject) => {
                            console.log(`RandomHomeword(): rejected, and err:${reject}`);
                            io.emit("system message", `@RandomHomeword() err:${reject}`);
                        });
                } else if (msg === "/随机二次元图") {
                    this.tools.RandomECY()
                        .then((resolve) => {
                            io.emit("pic message", resolve);
                        })
                        .catch((reject) => {
                            console.log(`RandomECY(): rejected, and err:${reject}`);
                            io.emit("system message", `@RandomECY() err:${reject}`);
                        });
                } //吠
                else if (g.yap_reg.test(msg)) {
                    msg = msg.replace("/吠 ", "");
                    msg = msg.replace("/吠", "");
                    this.tools.BetterTTS(msg)
                        .then((resolve) => {
                            io.emit("audio message", resolve);
                        })
                        .catch((reject) => {
                            console.log(`TTS错误：${reject}`);
                            io.emit("system message", `@TTS错误：${reject}`);
                        });
                } //教学系统，抄板于虹原翼版小夜v3
                else if (g.teach_reg.test(msg)) {
                    msg = msg.substr(2).split("答：");
                    if (msg.length !== 2) {
                        console.log(`教学指令：分割有误，退出教学`);
                        io.emit("system message", `@你教的姿势不对噢qwq`);
                        return 0;
                    }
                    let ask = msg[0].trim(),
                        ans = msg[1].trim();
                    if (ask == "" || ans == "") {
                        console.log(`问/答为空，退出教学`);
                        io.emit("system message", `@你教的姿势不对噢qwq`);
                        return 0;
                    }
                    if (ask.indexOf(/\r?\n/g) !== -1) {
                        console.log(`教学指令：关键词换行了，退出教学`);
                        io.emit("system message", `@关键词不能换行啦qwq`);
                        return 0;
                    }
                    console.log(`web端 ${socket.username} 想要教给小夜：问：${ask} 答：${ans}，现在开始检测合法性`);
                    for (let i in g.black_list_words) {
                        if (
                            ask.toLowerCase().indexOf(g.black_list_words[i].toLowerCase()) !== -1 ||
                            ans.toLowerCase().indexOf(g.black_list_words[i].toLowerCase()) !== -1
                        ) {
                            console.log(`教学指令：检测到不允许的词：${g.black_list_words[i]}，退出教学`);
                            io.emit("system message", `@你教的内容里有主人不允许小夜学习的词qwq`);
                            return 0;
                        }
                    }
                    if (Buffer.from(ask).length < 4) {
                        //关键词最低长度：4个英文或2个汉字
                        console.log(`教学指令：关键词太短，退出教学`);
                        io.emit("system message", `@关键词太短了啦qwq，至少要4个字节啦`);
                        return 0;
                    }
                    if (ask.length > 350 || ans.length > 350) {
                        //图片长度差不多是350左右
                        console.log(`教学指令：教的太长了，退出教学`);
                        io.emit("system message", `@你教的内容太长了，小夜要坏掉了qwq，不要呀`);
                        return 0;
                    }
                    //到这里都没有出错的话就视为没有问题，可以让小夜学了
                    console.log(`教学指令：没有检测到问题，可以学习`);
                    db.run(`INSERT INTO chat VALUES('${ask}', '${ans}')`);
                    console.log(`教学指令：学习成功`);
                    io.emit("system message", `@哇！小夜学会啦！对我说：${ask} 试试吧，小夜有可能会回复 ${ans} 噢`);
                    return 0;
                } else {
                    if (g.chat_swich) {
                        //交给聊天函数处理
                        this.tools.ChatProcess(msg)
                            .then((resolve) => {
                                io.emit("chat message", {
                                    CID: "0",
                                    msg: resolve,
                                });
                            })
                            .catch((reject) => {
                                //如果没有匹配到回复，那就让舔狗来回复
                                console.log(`${reject}，交给舔狗回复`);
                                this.tools.PrprDoge()
                                    .then((resolve) => {
                                        console.log(`舔狗回复：${resolve}`);
                                        io.emit("chat message", {
                                            CID: "0",
                                            msg: resolve,
                                        });
                                    })
                                    .catch((reject) => {
                                        console.log(`随机舔狗错误：${reject}`);
                                    });
                            });
                    } else {
                        return 0;
                    }
                }
            });
        });
    }

    //qqBot小夜核心代码，对接go-cqhttp
    start_qqbot() {
      app.post(this.global.go_cqhttp_service, (req, res) => {
        //禁言1小时以上自动退群
        if (req.body.sub_type == "ban" && req.body.user_id == this.global.bot_qq && req.body.duration >= 3599) {
          request(`http://${this.global.go_cqhttp_api}/set_group_leave?group_id=${req.body.group_id}`, function (error, _response, _body) {
            if (!error) {
              console.log(`小夜在群 ${req.body.group_id} 被禁言超过1小时，自动退群`);
              io.emit("system message", `@小夜在群 ${req.body.group_id} 被禁言超过1小时，自动退群`);
            } else {
              console.log(`请求${this.global.go_cqhttp_api}/set_group_leave错误：${error}`);
            }
          });
          res.send();
          return 0;
        }
        //自动同意好友请求
        if (req.body.request_type == "friend") {
          console.log(`自动同意了 ${req.body.user_id} 好友请求`);
          res.send({ approve: 1 });
          return 0;
        }
        //加群请求发送给管理员
        if (req.body.request_type == "group" && req.body.sub_type == "invite") {
          let msg = `用户 ${req.body.user_id} 邀请小夜加入群 ${req.body.group_id}，批准请发送
    /批准 ${req.body.flag}`;
          console.log(`${msg}`);
          request(`http://${this.global.go_cqhttp_api}/send_private_msg?user_id=${this.global.qq_admin_list[0]}&message=${encodeURI(msg)}`, function (error, _response, _body) {
            if (error) {
              console.log(`请求${this.global.go_cqhttp_api}/send_private_msg错误：${error}`);
            }
          });
          res.send();
          return 0;
        }
        //管理员批准群邀请
        if (req.body.message_type == "private" && req.body.user_id == this.global.qq_admin_list[0] && this.global.approve_group_invite.test(req.body.message)) {
          let flag = req.body.message.match(this.global.approve_group_invite)[1];
          request(`http://${this.global.go_cqhttp_api}/set_group_add_request?flag=${encodeURI(flag)}&type=invite&approve=1`, function (error, _response, _body) {
            if (!error) {
              console.log(`批准了请求id ${flag}`);
              res.send({ reply: `已批准` });
            } else {
              console.log(`请求${this.global.go_cqhttp_api}/set_group_add_request错误：${error}`);
            }
          });
          return 0;
        }
    
        //————————————————————下面是功能————————————————————
        let notify;
        switch (req.body.sub_type) {
          case "friend":
          case "group":
            notify = `qqBot小夜收到好友 ${req.body.user_id} (${req.body.sender.nickname}) 发来的消息：${req.body.message}`;
            break;
          case "normal":
            notify = `qqBot小夜收到群 ${req.body.group_id} 的 ${req.body.user_id} (${req.body.sender.nickname}) 发来的消息：${req.body.message}`;
            break;
          case "approve":
            console.log(`${req.body.user_id} 加入了群 ${req.body.group_id}`);
            break;
          case "ban":
            console.log(`qqBot小夜在群 ${req.body.group_id} 被禁言 ${req.body.duration} 秒`);
            break;
          case "poke":
            break;
          default:
            res.send();
            return 0;
        }
        console.log(notify);
        io.emit("system message", `@${notify}`);
    
        //转发图片到web端，按需启用
        if (this.global.qqimg_to_web) {
          if (this.global.isImage_reg.test(req.body.message)) {
            let url = this.global.img_url_reg.exec(req.body.message);
            this.this.tools.SaveQQimg(url)
              .then((resolve) => {
                io.emit("qqpic message", resolve);
              })
              .catch((reject) => {
                console.log(reject.error);
              });
            res.send();
          }
        }
    
        //转发视频到web端
        if (this.global.isVideo_reg.test(req.body.message)) {
          let url = this.global.video_url_reg.exec(req.body.message)[0];
          io.emit("qqvideo message", { file: url, filename: "qq视频" });
          res.send();
          return 0;
        }
    
        //测试指令
        if (req.body.message === "/ping") {
          console.log("Pong!");
          let test = Math.random() * 10000;
          let runtime = process.hrtime();
    
          for (var i = 1.0; i < 114514.0; i++) {
            test += i + i / 10.0;
          }
    
          runtime = process.hrtime(runtime)[1] / 1000 / 1000;
    
          res.send({ reply: `Pong! ${test} in ${runtime}ms` });
          return 0;
        }
    
        //群服务开关判断
        if (
          req.body.message_type == "group" ||
          req.body.notice_type == "group_increase" ||
          req.body.sub_type == "ban" ||
          req.body.sub_type == "poke" ||
          req.body.sub_type == "friend_add"
        ) {
          //服务启用开关
          //指定小夜的话
          if (open_ju.test(req.body.message) && this.global.has_qq_reg.test(req.body.message)) {
            var msg_in = req.body.message.split("菊")[1];
            var who = msg_in.split("[CQ:at,qq=")[1];
            var who = who.replace("]", "").trim();
            if (this.global.is_qq_reg.test(who)) {
              //如果是自己要被张菊，那么张菊
              if (this.global.bot_qq == who) {
                request(
                  `http://${this.global.go_cqhttp_api}/get_group_member_info?group_id=${req.body.group_id}&user_id=${req.body.user_id}`,
                  function (_error, _response, body) {
                    body = JSON.parse(body);
                    if (body.data.role === "owner" || body.data.role === "admin") {
                      console.log(`群 ${req.body.group_id} 启用了小夜服务`);
                      db.run(`UPDATE qq_group SET talk_enabled = '1' WHERE group_id ='${req.body.group_id}'`);
                      res.send({ reply: "小夜的菊花被管理员张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊" });
                      return 0;
                      //不是管理，再看看是不是qqBot管理员
                    } else {
                      for (let i in this.global.qq_admin_list) {
                        if (req.body.user_id == this.global.qq_admin_list[i]) {
                          console.log(`群 ${req.body.group_id} 启用了小夜服务`);
                          db.run(`UPDATE qq_group SET talk_enabled = '1' WHERE group_id ='${req.body.group_id}'`);
                          res.send({ reply: "小夜的菊花被主人张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊" });
                          return 0;
                        }
                      }
                      //看来真不是管理员呢
                      res.send({ reply: "你不是群管理呢，小夜不张，张菊需要让管理员来帮忙张噢" });
                      return 0;
                    }
                  }
                );
                return 0;
                //不是这只小夜被张菊的话，嘲讽那只小夜
              } else {
                res.send({ reply: `${msg_in}说你呢，快张菊！` });
                return 0;
              }
            }
          }
          //在收到群消息的时候搜索群是否存在于qq_group表，判断聊天开关
          else {
            db.all(`SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
              if (!err && sql[0]) {
                //群存在于qq_group表则判断聊天开关 talk_enabled，闭嘴了就无视掉所有消息
                if (sql[0].talk_enabled === 0) {
                  console.log(`群 ${req.body.group_id} 服务已停用，无视群所有消息`);
                  res.send();
                  return 0;
                } else {
                  //服务启用了，允许进入后续的指令系统
    
                  /*                                                                    群指令系统                                                                  */
    
                  //地雷爆炸判断，先判断这条消息是否引爆，再从数据库取来群地雷数组，引爆后删除地雷，原先的地雷是用随机数生成被炸前最大回复作为引信，现在换一种思路，用更简单的随机数引爆
                  let boom_flag = Math.floor(Math.random() * 100); //踩中flag
                  //如果判定踩中，检查该群是否有雷
                  if (boom_flag < 10) {
                    db.all(`SELECT * FROM mine WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
                      if (!err && sql[0]) {
                        //有则判断是否哑雷
                        let unboom = Math.floor(Math.random() * 100); //是否哑雷
                        if (unboom < 30) {
                          //是哑雷，直接删除地雷
                          console.log(`${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被踩中，但这是一颗哑雷`);
                          db.run(`DELETE FROM mine WHERE mine_id = '${sql[0].mine_id}' `);
                          res.send({
                            reply: `[CQ:at,qq=${req.body.user_id}]恭喜你躲过一劫，[CQ:at,qq=${sql[0].placed_qq}]埋的地雷掺了沙子，是哑雷，炸了，但没有完全炸`,
                          });
                          //成功引爆并删除地雷
                        } else {
                          let holly_hand_grenade = Math.floor(Math.random() * 1000); //丢一个骰子，判断地雷是否变成神圣地雷
                          if (holly_hand_grenade < 10) {
                            //运营方暗调了出率，10‰几率变成神圣地雷
                            request(
                              `http://${this.global.go_cqhttp_api}/set_group_whole_ban?group_id=${req.body.group_id}&enable=1`,
                              function (error, _response, _body) {
                                if (!error) {
                                  console.log(`触发了神圣地雷，群 ${req.body.group_id} 被全体禁言`);
                                  res.send({
                                    reply: `噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣地雷！我是说，这是一颗毁天灭地的神圣地雷啊！哈利路亚！麻烦管理员解除一下`,
                                  });
                                } else {
                                  console.log(`请求${this.global.go_cqhttp_api}/set_group_whole_ban错误：${error}`);
                                  res.send({ reply: `日忒娘，怎么又出错了` });
                                }
                              }
                            );
                            return 0;
                          } else {
                            let boom_time = Math.floor(Math.random() * 60 * 2); //造成伤害时间
                            console.log(`${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被引爆，雷已经被删除`);
                            db.run(`DELETE FROM mine WHERE mine_id = '${sql[0].mine_id}' `);
                            res.send({
                              reply: `[CQ:at,qq=${req.body.user_id}]恭喜你，被[CQ:at,qq=${sql[0].placed_qq}]所埋地雷炸伤，休养生息${boom_time}秒！`,
                              ban: 1,
                              ban_duration: boom_time,
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
                  if (this.global.close_ju.test(req.body.message) && this.global.has_qq_reg.test(req.body.message)) {
                    var msg_in = req.body.message.split("菊")[1];
                    var who = msg_in.split("[CQ:at,qq=")[1];
                    var who = who.replace("]", "").trim();
                    if (this.global.is_qq_reg.test(who)) {
                      //如果是自己要被闭菊，那么闭菊
                      if (this.global.bot_qq == who) {
                        console.log(`群 ${req.body.group_id} 停止了小夜服务`);
                        db.run(`UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='${req.body.group_id}'`);
                        res.send({ reply: `小夜的菊花闭上了，这只小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${this.global.bot_qq}]` });
                        return 0;
                        //不是这只小夜被闭菊的话，嘲讽那只小夜
                      } else {
                        res.send({ reply: `${msg_in}说你呢，快闭菊！` });
                        return 0;
                      }
                    }
                    //没指定小夜
                  } else if (req.body.message === "闭菊") {
                    console.log(`群 ${req.body.group_id} 停止了小夜服务`);
                    db.run(`UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='${req.body.group_id}'`);
                    res.send({ reply: `小夜的菊花闭上了，小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${this.global.bot_qq}]` });
                    return 0;
                  }
    
                  //报错
                  if (this.global.feed_back.test(req.body.message)) {
                    console.log("有人想报错");
                    let msg = `用户 ${req.body.user_id}(${req.body.sender.nickname}) 报告了错误：`;
                    msg += req.body.message.replace("/报错 ", "");
                    msg = msg.replace("/报错", "");
                    request(`http://${this.global.go_cqhttp_api}/send_group_msg?group_id=120243247&message=${encodeURI(msg)}`, function (error, _response, _body) {
                      if (!error) {
                        console.log(`${req.body.user_id} 反馈了错误 ${msg}`);
                      } else {
                        console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                      }
                    });
    
                    request(`http://${this.global.go_cqhttp_api}/send_group_msg?group_id=474164508&message=${encodeURI(msg)}`, function (error, _response, _body) {
                      if (error) {
                        console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                      }
                    });
    
                    res.send({ reply: `谢谢您的反馈，小夜已经把您的反馈信息发给了开发团队辣` });
                    return 0;
                  }
    
                  //戳一戳
                  if (req.body.sub_type === "poke" && req.body.target_id == this.global.bot_qq) {
                    this.global.c1c_count++;
                    if (this.global.c1c_count > 2) {
                        this.global.c1c_count = 0;
                        let final = "哎呀戳坏了，不理你了 ٩(๑`^´๑)۶";
                        request(
                            `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(final)}`,
                            function (error, _response, _body) {
                            if (!error) {
                                console.log(`${req.body.user_id} 戳了一下 ${req.body.target_id}`);
                                request(
                                `http://${this.global.go_cqhttp_api}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=10`,
                                function (error, _response, _body) {
                                    if (!error) {
                                    console.log(`小夜生气了，${req.body.user_id} 被禁言`);
                                    } else {
                                    console.log(`请求${this.global.go_cqhttp_api}/set_group_ban错误：${error}`);
                                    res.send({ reply: `日忒娘，怎么又出错了` });
                                    }
                                }
                                );
                            } else {
                                console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                            }
                            }
                        );
                    } else {
                      let final = `请不要戳小小夜 >_<`;
                      request(
                        `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(final)}`,
                        function (error, _response, _body) {
                          if (!error) {
                            console.log(`${req.body.user_id} 戳了一下 ${req.body.target_id}`);
                          } else {
                            console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                          }
                        }
                      );
                    }
                    return 0;
                  }
    
                  //教学系统，抄板于虹原翼版小夜v3
                  if (this.global.teach_reg.test(req.body.message)) {
                    let msg = req.body.message;
                    msg = msg.replace(/'/g, ""); //防爆
                    msg = msg.substr(2).split("答：");
                    if (msg.length !== 2) {
                      console.log(`教学指令：分割有误，退出教学`);
                      res.send({ reply: "你教的姿势不对噢qwq" });
                      return 0;
                    }
                    let ask = msg[0].trim(),
                      ans = msg[1].trim();
                    if (ask == "" || ans == "") {
                      console.log(`问/答为空，退出教学`);
                      res.send({ reply: "你教的姿势不对噢qwq" });
                      return 0;
                    }
                    if (ask.indexOf(/\r?\n/g) !== -1) {
                      console.log(`教学指令：关键词换行了，退出教学`);
                      res.send({ reply: "关键词不能换行啦qwq" });
                      return 0;
                    }
                    console.log(`${req.body.user_id}(${req.body.sender.nickname}) 想要教给小夜：问：${ask} 答：${ans}，现在开始检测合法性`);
                    for (let i in this.global.black_list_words) {
                      if (
                        ask.toLowerCase().indexOf(this.global.black_list_words[i].toLowerCase()) !== -1 ||
                        ans.toLowerCase().indexOf(this.global.black_list_words[i].toLowerCase()) !== -1
                      ) {
                        console.log(`教学指令：检测到不允许的词：${this.global.black_list_words[i]}，退出教学`);
                        res.send({ reply: `你教的内容里有主人不允许小夜学习的词：${this.global.black_list_words[i]} qwq` });
                        return 0;
                      }
                    }
                    if (Buffer.from(ask).length < 4) {
                      //关键词最低长度：4个英文或2个汉字
                      console.log(`教学指令：关键词太短，退出教学`);
                      res.send({ reply: "关键词太短了啦qwq，至少要4个字节啦" });
                      return 0;
                    }
                    if (ask.length > 350 || ans.length > 350) {
                      //图片长度差不多是350左右
                      console.log(`教学指令：教的太长了，退出教学`);
                      res.send({ reply: "你教的内容太长了，小夜要坏掉了qwq，不要呀" });
                      return 0;
                    }
                    //到这里都没有出错的话就视为没有问题，可以让小夜学了
                    console.log(`教学指令：没有检测到问题，可以学习`);
                    db.run(`INSERT INTO chat VALUES('${ask}', '${ans}')`);
                    console.log(`教学指令：学习成功`);
                    res.send({ reply: `哇！小夜学会啦！对我说：${ask} 试试吧，小夜有可能会回复 ${ans} 噢` });
                    return 0;
                  }
    
                  //balabala教学，对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复
                  if (this.global.teach_balabala_reg.test(req.body.message)) {
                    let msg = req.body.message;
                    msg = msg.replace(/'/g, ""); //防爆
                    msg = msg.replace("/说不出话 ", "");
                    msg = msg.replace("/说不出话", "");
                    console.log(`${req.body.user_id}(${req.body.sender.nickname}) 想要教给小夜balabala：${msg}，现在开始检测合法性`);
                    for (let i in this.global.black_list_words) {
                      if (
                        msg.toLowerCase().indexOf(this.global.black_list_words[i].toLowerCase()) !== -1 ||
                        msg.toLowerCase().indexOf(this.global.black_list_words[i].toLowerCase()) !== -1
                      ) {
                        console.log(`balabala教学：检测到不允许的词：${this.global.black_list_words[i]}，退出教学`);
                        res.send({ reply: "你教的内容里有主人不允许小夜学习的词qwq" });
                        return 0;
                      }
                    }
                    console.log(`balabala教学：没有检测到问题，可以学习`);
                    db.run(`INSERT INTO balabala VALUES('${msg}')`);
                    console.log(`balabala教学：学习成功`);
                    res.send({ reply: `哇！小夜学会啦！小夜可能在说不出话的时候说 ${msg} 噢` });
                    return 0;
                  }
    
                  //色图
                  if (this.global.setu_reg.test(req.body.message)) {
                    this.this.tools.RandomCos()
                      .then((resolve) => {
                        let setu_file = `http://127.0.0.1:${this.global.web_port}/${resolve.replace(/\//g, "\\")}`;
                        res.send({
                          reply: `[CQ:image,file=${setu_file},url=${setu_file}]`,
                        });
                      })
                      .catch((reject) => {
                        console.log(`RandomCos(): rejected, and err:${reject}`);
                        res.send({ reply: `你要的色图发送失败啦：${reject}` });
                      });
                    return 0;
                  }
    
                  //r18色图
                  if (req.body.message == "r18") {
                    res.send({ reply: `你等等，我去找找你要的r18` });
                    this.this.tools.RandomR18()
                      .then((resolve) => {
                        let setu_file = `http://127.0.0.1:${this.global.web_port}/${resolve.replace(/\//g, "\\")}`;
                        console.log(setu_file);
                        request(
                          `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(
                            `[CQ:image,file=${setu_file},url=${setu_file}]`
                          )}`,
                          function (error, _response, _body) {
                            if (error) {
                              console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                            }
                          }
                        );
                      })
                      .catch((reject) => {
                        console.log(`RandomR18(): rejected, and err:${reject}`);
                        request(
                          `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(`你要的r18发送失败啦：${reject}`)}`,
                          function (error, _response, _body) {
                            if (error) {
                              console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                            }
                          }
                        );
                      });
                    return 0;
                  }
    
                  //来点xx
                  if (this.global.come_some.test(req.body.message)) {
                    let tag = req.body.message.match(this.global.come_some)[1];
                    res.send({ reply: `你等等，我去找找你要的${tag}` });
                    this.this.tools.SearchTag(tag)
                      .then((resolve) => {
                        let setu_file = `http://127.0.0.1:${this.global.web_port}/${resolve.replace(/\//g, "\\")}`;
                        console.log(setu_file);
                        request(
                          `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(
                            `[CQ:image,file=${setu_file},url=${setu_file}]`
                          )}`,
                          function (error, _response, _body) {
                            if (error) {
                              console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                            }
                          }
                        );
                      })
                      .catch((reject) => {
                        console.log(`SearchTag(): rejected, and err:${reject}`);
                        request(
                          `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(
                            `你要的${tag}发送失败啦：${reject}`
                          )}`,
                          function (error, _response, _body) {
                            if (error) {
                              console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                            }
                          }
                        );
                      });
                    return 0;
                  }
    
                  //福利姬
                  for (let i in this.global.req_fuliji_list) {
                    if (req.body.message === this.global.req_fuliji_list[i]) {
                        this.this.tools.RandomTbshow()
                        .then((resolve) => {
                          res.send({
                            reply: `[CQ:image,file=${resolve},url=${resolve}]`,
                          });
                        })
                        .catch((reject) => {
                          console.log(`RandomCos(): rejected, and err:${reject}`);
                          res.send({ reply: `你要的福利姬色图发送失败啦：${reject}` });
                        });
                      return 0;
                    }
                  }
    
                  //来点二次元
                  for (let i in this.global.req_ECY_list) {
                    if (req.body.message === this.global.req_ECY_list[i]) {
                        this.this.tools.RandomECY()
                        .then((resolve) => {
                          res.send({
                            reply: `[CQ:image,file=${resolve},url=${resolve}]`,
                          });
                        })
                        .catch((reject) => {
                          console.log(`RandomCos(): rejected, and err:${reject}`);
                          res.send({ reply: `你要的二次元色图发送失败啦：${reject}` });
                        });
                      return 0;
                    }
                  }
    
                  //舔我
                  if (req.body.message === "/舔我") {
                    this.this.tools.PrprDoge()
                      .then((resolve) => {
                        console.log(`舔狗舔了一口：${resolve}`);
                        res.send({ reply: resolve });
                      })
                      .catch((reject) => {
                        console.log(`随机舔狗错误：${reject}`);
                      });
                    return 0;
                  }
    
                  //彩虹屁
                  if (req.body.message === "/彩虹屁") {
                    this.this.tools.RainbowPi()
                      .then((resolve) => {
                        console.log(`放了一个彩虹屁：${resolve}`);
                        res.send({ reply: resolve });
                      })
                      .catch((reject) => {
                        console.log(`彩虹屁错误：${reject}`);
                      });
                    return 0;
                  }
    
                  //吠，直接把文字转化为语音
                  if (this.global.yap_reg.test(req.body.message)) {
                    let tex = req.body.message.replace("/吠 ", "");
                    tex = tex.replace("/吠", "");
                    this.this.tools.BetterTTS(tex)
                      .then((resolve) => {
                        let tts_file = `[CQ:record,file=http://127.0.0.1:${this.global.web_port}${resolve.file},url=http://127.0.0.1:${this.global.web_port}${resolve.file}]`;
                        res.send({ reply: tts_file });
                      })
                      .catch((reject) => {
                        console.log(`TTS错误：${reject}`);
                      });
                    return 0;
                  }
    
                  //嘴臭，小夜的回复转化为语音
                  if (this.global.come_yap_reg.test(req.body.message)) {
                    let message = req.body.message.replace("/嘴臭 ", "");
                    message = message.replace("/嘴臭", "");
                    console.log(`有人对线说 ${message}，小夜要嘴臭了`);
                    io.emit("sysrem message", `@有人对线说 ${message}，小夜要嘴臭了`);
                    this.this.tools.ChatProcess(message)
                      .then((resolve) => {
                        let reply = resolve;
                        this.this.tools.BetterTTS(reply)
                          .then((resolve) => {
                            let tts_file = `[CQ:record,file=http://127.0.0.1:${this.global.web_port}${resolve.file},url=http://127.0.0.1:${this.global.web_port}${resolve.file}]`;
                            res.send({ reply: tts_file });
                          })
                          .catch((reject) => {
                            console.log(`TTS错误：${reject}`);
                          });
                      })
                      .catch((reject) => {
                        //如果没有匹配到回复，那就回复一句默认语音
                        console.log(`${reject}，语音没有回复`);
                        this.this.tools.BetterTTS()
                          .then((resolve) => {
                            let tts_file = `[CQ:record,file=http://127.0.0.1:${this.global.web_port}${resolve.file},url=http://127.0.0.1:${this.global.web_port}${resolve.file}]`;
                            res.send({ reply: tts_file });
                          })
                          .catch((reject) => {
                            console.log(`TTS错误：${reject}`);
                          });
                      });
                    return 0;
                  }
    
                  //prpr，来自jjbot的功能
                  if (this.global.prpr_reg.test(req.body.message)) {
                    let bodyPart = [
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
                    let msg = req.body.message;
                    let who = req.body.sender.nickname;
                    if (!who) who = "小夜";
                    var prpr_who = msg.replace("/prpr ", "");
                    if (!prpr_who || prpr_who === "/prpr") {
                      prpr_who = prpr_who.replace("/prpr", "");
                      prpr_who = "自己";
                    }
                    let random_bodyPart = bodyPart[Math.floor(Math.random() * bodyPart.length)];
                    let final = `${who} 舔了舔 ${prpr_who} 的 ${random_bodyPart}，我好兴奋啊！`;
                    console.log(`prpr指令：${final} `);
                    res.send({ reply: final });
                    return 0;
                  }
    
                  //今日不带套
                  for (let i in this.global.req_no_trap_list) {
                    if (req.body.message === this.global.req_no_trap_list[i]) {
                      let now = new Date();
                      let year = now.getFullYear();
                      let month = now.getMonth() + 1;
                      let day = now.getDate();
                      if (month > 2) {
                        year++;
                      }
                      let star_set_name = "魔羯水瓶双鱼牡羊金牛双子巨蟹狮子处女天秤天蝎射手魔羯";
                      let star_set_days = [20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22];
                      let star_set_result = star_set_name.substr(month * 2 - (day < star_set_days[month - 1] ? 2 : 0), 2);
                      let shenxiao = ["猴", "鸡", "狗", "猪", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊"];
                      let shenxiao_result = /^\d{4}$/.test(year) ? shenxiao[year % 12] : false;
                      let final = `小夜温馨提示您：今日不戴套，孩子${star_set_result}座，属${shenxiao_result}，${year + 18}年高考，一本机率约${parseInt(
                        Math.random() * (99 - 20 + 1) + 20,
                        10
                      )}%`;
                      console.log(`今日不带套指令：${final} `);
                      res.send({ reply: final });
                      return 0;
                    }
                  }
    
                  //avg模板，可以写简单的随机小说
                  if (req.body.message === "/画师算命") {
                    let paintstyle = ["厚涂", "美式", "韩风", "迪士尼风格", "日系赛璐璐", "日系平涂", "国风"];
                    let like = [
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
                    let andthen = [
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
                    let buthen = ["被请喝茶", "被人寄刀片", "被举报", "本子卖到爆炸", "被人吐槽", "被人骗炮", "突然爆红", "被人抄袭", "在街角被蜀黍强暴"];
                    let atlast = [
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
                    let who = req.body.sender.nickname;
                    if (!who) who = "小夜";
                    let random_paintstyle = paintstyle[Math.floor(Math.random() * paintstyle.length)];
                    let random_like = like[Math.floor(Math.random() * like.length)];
                    let random_andthen = andthen[Math.floor(Math.random() * andthen.length)];
                    let random_buthen = buthen[Math.floor(Math.random() * buthen.length)];
                    let random_atlast = atlast[Math.floor(Math.random() * atlast.length)];
                    let final = `${who}是一名${random_paintstyle}画师，最喜欢画${random_like}，而且${random_andthen}，然而因为画得太过和谐而${random_buthen}，还因为这件事在微博上有了${(
                      Math.random() * (1000000 - 1) +
                      1
                    ).toFixed(0)}个粉丝，做了${(Math.random() * (100 - 1).toFixed(0) + 1).toFixed(0)}年画师，最后${random_atlast}。`;
                    console.log(`画师算命指令：${final} `);
                    res.send({ reply: final });
                    return 0;
                  }
    
                  //cp文生成器，语料来自 https://github.com/mxh-mini-apps/mxh-cp-stories/blob/master/src/assets/story.json
                  if (this.global.cp_story.test(req.body.message)) {
                    let msg = req.body.message + " "; //结尾加一个空格防爆
                    msg = msg.split(" ");
                    console.log(msg);
                    let tops = msg[1].trim(), //小攻
                      bottoms = msg[2].trim(); //小受
    
                    fs.readFile(path.join(`${process.cwd()}`, "config", "1and0story.json"), "utf-8", function (err, data) {
                      if (!err) {
                        story = JSON.parse(data);
                        if (!tops) tops = req.body.sender.nickname;
                        if (!bottoms) bottoms = req.body.sender.nickname;
                        // for (let i in story) {
                        //   if (tops == story[i].roles.gong || bottoms == story[i].roles.shou) {
                        //     let index = Math.floor(Math.random() * story.length);
                        //     res.send({ reply: `${tops} ${bottoms} ${index}` });
                        //     return 0;
                        //   }
                        // }
                        let index = story.length - 1;
                        let story_index = Math.floor(Math.random() * story[index].stories.length);
                        let story_select = story[index].stories[story_index];
                        story_select = story_select.replace(/<攻>/g, tops);
                        story_select = story_select.replace(/<受>/g, bottoms);
                        console.log(`发送cp文：${story_select}`);
                        res.send({ reply: `${story_select}` });
                      }
                    });
                    return 0;
                  }
    
                  //伪造转发
                  if (this.global.fake_forward.test(req.body.message)) {
                    let who,
                      name = req.body.sender.nickname,
                      text,
                      xiaoye_say,
                      requestData;
                    if (req.body.message == "/强制迫害") {
                      who = req.body.sender.user_id; //如果没有要求迫害谁，那就是迫害自己
                    } else {
                      let msg = req.body.message + " "; //结尾加一个空格防爆
    
                      // for (let i in msg.substr(i).split(" ")) {
                      //   console.log(msg[i]);
                      // }
    
                      msg = msg.substr(4).split(" ");
                      who = msg[1].trim(); //谁
                      text = msg[2].trim(); //说啥
                      xiaoye_say = msg[3].trim(); //小夜说啥
                      who = who.replace("/强制迫害 ", "");
                      who = who.replace("/强制迫害", "");
                      who = who.replace("[CQ:at,qq=", "");
                      who = who.replace("]", "");
                      who = who.trim();
                      if (this.global.is_qq_reg.test(who)) {
                        console.log(`群 ${req.body.group_id} 的 群员 ${req.body.user_id} 强制迫害 ${who}`);
                      } else {
                        //目标不是qq号
                        who = req.body.sender.user_id; //如果没有要求迫害谁，那就是迫害自己
                      }
                    }
    
                    if (!name) {
                      name = req.body.sender.nickname;
                    }
    
                    if (!text) {
                      text = "我是群友专用RBQ";
                    }
    
                    if (!xiaoye_say) {
                      xiaoye_say =
                        "[CQ:image,file=1ea870ec3656585d4a81e13648d66db5.image,url=https://gchat.qpic.cn/gchatpic_new/1277161008/2063243247-2238741340-1EA870EC3656585D4A81E13648D66DB5/0?term=3]";
                    }
    
                    //发送
                    //先获取昵称
                    request(
                      `http://${this.global.go_cqhttp_api}/get_group_member_info?group_id=${req.body.group_id}&user_id=${who}&no_cache=0`,
                      function (error, _response, body) {
                        if (!error) {
                          body = JSON.parse(body);
                          name = body.data.nickname;
    
                          requestData = {
                            group_id: req.body.group_id,
                            messages: [
                              { type: "node", data: { name: name, uin: who, content: text } },
                              {
                                type: "node",
                                data: {
                                  name: "星野夜蝶Official",
                                  uin: "1648468212",
                                  content: xiaoye_say,
                                },
                              },
                            ],
                          };
    
                          request(
                            {
                              url: `http://${this.global.go_cqhttp_api}/send_group_forward_msg`,
                              method: "POST",
                              json: true,
                              headers: {
                                "content-type": "application/json",
                              },
                              body: requestData,
                            },
                            function (error, response, body) {
                              if (!error && response.statusCode == 200) {
                                console.log(body);
                              }
                            }
                          );
                        } else {
                          requestData = {
                            group_id: req.body.group_id,
                            messages: [
                              { type: "node", data: { name: name, uin: who, content: text } },
                              {
                                type: "node",
                                data: {
                                  name: "星野夜蝶Official",
                                  uin: "1648468212",
                                  content: xiaoye_say,
                                },
                              },
                            ],
                          };
    
                          request(
                            {
                              url: `http://${this.global.go_cqhttp_api}/send_group_forward_msg`,
                              method: "POST",
                              json: true,
                              headers: {
                                "content-type": "application/json",
                              },
                              body: requestData,
                            },
                            function (error, response, body) {
                              if (!error && response.statusCode == 200) {
                                console.log(body);
                              }
                            }
                          );
                        }
                      }
                    );
                    return 0;
                  }
    
                  //迫害，p图，这里需要重写复用
                  if (this.global.pohai_reg.test(req.body.message)) {
                    let pohai_list = ["唐可可", "上原步梦", "猛男狗", "令和", "鸭鸭", "陈睿"]; //迫害名单
                    let pohai_pic_list = ["coco_echo.jpg", "ayumu_qaq.jpg", "doge.jpg", "nianhao.jpg", "yaya.gif", "bilibili.png"]; //迫害图片列表
                    let pohai_pic = "coco_echo.jpg"; //迫害图片，如果被迫害人不在迫害名单里，那么默认迫害唐可可
                    let tex_config_list = {
                      唐可可: ["390", "160", "-0.19", "8", "30"],
                      上原步梦: ["227", "440", "0", "26", "30"],
                      猛男狗: ["200", "100", "0", "0", "30"],
                      令和: ["130", "110", "-0.05", "1", "30"],
                      鸭鸭: ["30", "30", "0", "2", "30"],
                      陈睿: ["94", "390", "-0.01", "12", "15"],
                    }; //迫害文字位置，left、top、rotate、多少字换行、字体大小
                    let tex_config = tex_config_list.唐可可; //默认迫害文字位置是唐可可的
                    let msg = req.body.message + " "; //结尾加一个空格防爆
    
                    msg = msg.substr(3).split(" ");
                    let pohai_who = msg[1].trim(), //迫害谁
                      pohai_tex = msg[2].trim(); //迫害文字
    
                    //先搜索被迫害人是否在迫害名单里
                    for (let i in pohai_list) {
                      if (pohai_who === pohai_list[i]) {
                        //被迫害人发现
                        pohai_pic = pohai_pic_list[i];
                        tex_config = tex_config_list[pohai_who];
                        console.log(`被迫害人 ${pohai_who} 发现，使用迫害图 ${pohai_pic_list[i]}`);
                      }
                    }
    
                    //如果没有迫害文字的话，应该是省略了被迫害人，如 /迫害 迫害文字 这样，所以迫害文字是第一个参数
                    if (!pohai_tex) {
                      pohai_tex = msg[1].trim();
                    }
    
                    //如果迫害文字里有@某人，将[CQ:at,qq=QQ号]转为昵称
                    if (this.global.has_qq_reg.test(pohai_tex)) {
                      console.log(`存在@内容，将替换为昵称`);
                      let at_start = pohai_tex.indexOf("[CQ:at,qq="); //取@开始
                      let at_end = pohai_tex.indexOf("]"); //取@结束
                      let tex_top = pohai_tex.substr(0, at_start); //取除了@外的字符串头
                      let tex_bottom = pohai_tex.substr(at_end + 1); //取除了@外的字符串尾
                      //获取qq
                      let qq_id = pohai_tex.replace("[CQ:at,qq=", "");
                      qq_id = qq_id.replace("]", "");
                      qq_id = qq_id.trim();
                      //如果是正确的qq号则替换
                      if (this.global.is_qq_reg.test(qq_id)) {
                        //获取qq号在群内的昵称
                        request(
                          `http://${this.global.go_cqhttp_api}/get_group_member_info?group_id=${req.body.group_id}&user_id=${qq_id}&no_cache=0`,
                          function (error, _response, body) {
                            //这一步实在是太慢了啊实在不想异步了
                            if (!error) {
                              body = JSON.parse(body);
                              pohai_tex = `${tex_top}${body.data.nickname}${tex_bottom}`; //拼接为完整的迫害tex
                              //如果需要换行，按 tex_config[3] 来换行
                              if (pohai_tex.length > tex_config[3]) {
                                let enter = tex_config[3];
                                let new_pohai_tex = "";
                                for (let i = 0, j = 1; i < pohai_tex.length; i++, j++) {
                                  if (j && j % enter == 0) {
                                    new_pohai_tex += pohai_tex[i] + "\n";
                                  } else {
                                    new_pohai_tex += pohai_tex[i];
                                  }
                                }
                                pohai_tex = new_pohai_tex;
                              }
                              //开始p图
                              let sources = `${process.cwd()}\\static\\xiaoye\\ps\\${pohai_pic}`; //载入迫害图
                              loadImage(sources).then((image) => {
                                let canvas = createCanvas(parseInt(image.width), parseInt(image.height)); //根据迫害图尺寸创建画布
                                let ctx = canvas.getContext("2d");
                                ctx.drawImage(image, 0, 0);
                                ctx.font = `${tex_config[4]}px Sans`;
                                ctx.textAlign = "center";
                                ctx.rotate(tex_config[2]);
                                //ctx.fillStyle = "#00ff00";
                                let tex_width = Math.floor(ctx.measureText(pohai_tex).width);
                                console.log(`文字宽度：${tex_width}`);
                                ctx.fillText(pohai_tex, tex_config[0], tex_config[1]);
                                let file_local = path.join(`${process.cwd()}`, `static`, `xiaoye`, `images`, `${sha1(canvas.toBuffer())}.jpg`);
                                fs.writeFileSync(file_local, canvas.toBuffer());
                                let file_online = `http://127.0.0.1:${this.global.web_port}/xiaoye/images/${sha1(canvas.toBuffer())}.jpg`;
                                console.log(`迫害成功，图片发送：${file_online}`);
                                res.send({
                                  reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                                });
                              });
                            } else {
                              console.log(`请求${this.global.go_cqhttp_api}//get_group_member_info错误：${error}`);
                              res.send({ reply: `日忒娘，怎么又出错了` });
                            }
                          }
                        );
                      }
                    } else {
                      //如果需要换行，按 tex_config[3] 来换行
                      if (pohai_tex.length > tex_config[3]) {
                        let enter = tex_config[3];
                        let new_pohai_tex = "";
                        for (let i = 0, j = 1; i < pohai_tex.length; i++, j++) {
                          if (j && j % enter == 0) {
                            new_pohai_tex += pohai_tex[i] + "\n";
                          } else {
                            new_pohai_tex += pohai_tex[i];
                          }
                        }
                        pohai_tex = new_pohai_tex;
                      }
                      //开始p图
                      let sources = `${process.cwd()}\\static\\xiaoye\\ps\\${pohai_pic}`; //载入迫害图
                      loadImage(sources).then((image) => {
                        let canvas = createCanvas(parseInt(image.width), parseInt(image.height)); //根据迫害图尺寸创建画布
                        let ctx = canvas.getContext("2d");
                        ctx.drawImage(image, 0, 0);
                        ctx.font = `${tex_config[4]}px Sans`;
                        ctx.textAlign = "center";
                        ctx.rotate(tex_config[2]);
                        //ctx.fillStyle = "#00ff00";
                        let tex_width = Math.floor(ctx.measureText(pohai_tex).width);
                        console.log(`文字宽度：${tex_width}`);
                        ctx.fillText(pohai_tex, tex_config[0], tex_config[1]);
    
                        let file_local = path.join(`${process.cwd()}`, `static`, `xiaoye`, `images`, `${sha1(canvas.toBuffer())}.jpg`);
                        fs.writeFileSync(file_local, canvas.toBuffer());
                        let file_online = `http://127.0.0.1:${this.global.web_port}/xiaoye/images/${sha1(canvas.toBuffer())}.jpg`;
                        console.log(`迫害成功，图片发送：${file_online}`);
                        res.send({
                          reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                        });
                      });
                    }
                    return 0;
                  }
    
                  //一个手雷
                  if (this.global.hand_grenade_reg.test(req.body.message)) {
                    let who;
                    let holly_hand_grenade = Math.floor(Math.random() * 1000); //丢一个骰子，判断手雷是否变成神圣手雷
                    let success_flag = Math.floor(Math.random() * 100); //丢一个骰子，判断手雷是否成功丢出
                    let boom_time = Math.floor(Math.random() * 60 * 2); //造成伤害时间
                    if (holly_hand_grenade < 10) {
                      //运营方暗调了出率，10‰几率变成神圣手雷
                      request(`http://${this.global.go_cqhttp_api}/set_group_whole_ban?group_id=${req.body.group_id}&enable=1`, function (error, _response, _body) {
                        if (!error) {
                          console.log(`触发了神圣手雷，群 ${req.body.group_id} 被全体禁言`);
                          res.send({
                            reply: `噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣手雷！我是说，这是一颗毁天灭地的神圣手雷啊！哈利路亚！麻烦管理员解除一下`,
                          });
                        } else {
                          console.log(`请求${this.global.go_cqhttp_api}/set_group_whole_ban错误：${error}`);
                          res.send({ reply: `日忒娘，怎么又出错了` });
                        }
                      });
                      return 0;
                    } else {
                      if (req.body.message === "一个手雷") {
                        who = req.body.user_id; //如果没有要求炸谁，那就是炸自己
                        console.log(`群 ${req.body.group_id} 的群员 ${req.body.user_id} 朝自己丢出一颗手雷`);
                      } else {
                        who = req.body.message;
                        who = who.replace("一个手雷 ", "");
                        who = who.replace("一个手雷", "");
                        who = who.replace("[CQ:at,qq=", "");
                        who = who.replace("]", "");
                        who = who.trim();
                        if (this.global.is_qq_reg.test(who)) {
                          console.log(`群 ${req.body.group_id} 的 群员 ${req.body.user_id} 尝试向 ${who} 丢出一颗手雷`);
                        } else {
                          //目标不是qq号
                          res.send({ reply: `你想丢给谁手雷啊，目标不可以是${who}，不要乱丢` });
                          return 0;
                        }
                      }
                      if (success_flag < 50 || who === req.body.user_id) {
                        //50%几率被自己炸伤
                        console.log(`群 ${req.body.group_id} 的 群员 ${req.body.user_id} 的手雷炸到了自己`);
                        res.send({
                          reply: `[CQ:at,qq=${req.body.user_id}] 小手一滑，被自己丢出的手雷炸伤，造成了${boom_time}秒的伤害，苍天有轮回，害人终害己，祝你下次好运`,
                          ban: 1,
                          ban_duration: boom_time,
                        });
                      } else {
                        //成功丢出手雷
                        request(
                          `http://${this.global.go_cqhttp_api}/set_group_ban?group_id=${req.body.group_id}&user_id=${who}&duration=${boom_time}`,
                          function (error, _response, _body) {
                            if (!error) {
                              console.log(`群 ${req.body.group_id} 的 群员 ${req.body.user_id} 的手雷炸到了 ${who}`);
                              res.send({
                                reply: `恭喜[CQ:at,qq=${who}]被[CQ:at,qq=${req.body.user_id}]丢出的手雷炸伤，造成了${boom_time}秒的伤害，祝你下次好运`,
                              });
                            } else {
                              console.log(`请求${this.global.go_cqhttp_api}/set_group_ban错误：${error}`);
                              res.send({ reply: `日忒娘，怎么又出错了` });
                            }
                          }
                        );
                      }
                    }
                    return 0;
                  }
    
                  //埋地雷
                  if (this.global.mine_reg.test(req.body.message)) {
                    //获取该群是否已经达到最大共存地雷数
                    db.all(`SELECT * FROM mine WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
                      if (!err) {
                        let length = 0;
                        try {
                          length = sql.length;
                        } catch (err) {
                          console.log(`地雷为空`);
                        }
                        if (length < this.global.max_mine_count) {
                          //地雷还没满，先获取自增ID最新值sql.seq，随后mine表增加群地雷
                          db.all(`Select seq From sqlite_sequence Where name = 'mine'`, (err, sql) => {
                            if (!err && sql[0]) {
                              db.run(`INSERT INTO mine VALUES('${sql[0].seq + 1}', '${req.body.group_id}', '${req.body.user_id}')`);
                              console.log(`${req.body.user_id} 在群 ${req.body.group_id} 埋了一颗地雷`);
                              res.send({
                                reply: `大伙注意啦！[CQ:at,qq=${req.body.user_id}]埋雷干坏事啦！`,
                              });
                            } else {
                              console.log(`埋地雷出错了：${err}，${sql}`);
                            }
                          });
                        } else {
                          console.log(`群 ${req.body.group_id} 的地雷满了`);
                          res.send({
                            reply: `[CQ:at,qq=${req.body.user_id}] 这个群的地雷已经塞满啦，等有幸运群友踩中地雷之后再来埋吧`,
                          });
                          return 0;
                        }
                      } else {
                        console.log(`获取该群地雷出错了：${err}，${sql}`);
                      }
                    });
                    return 0;
                  }
    
                  //踩地雷
                  if (this.global.fuck_mine_reg.test(req.body.message)) {
                    //搜索地雷库中现有地雷
                    db.all(`SELECT * FROM mine WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
                      //有雷，直接炸，炸完删地雷
                      if (!err && sql[0]) {
                        let boom_time = Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                        console.log(`${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被排爆，雷已经被删除`);
                        db.run(`DELETE FROM mine WHERE mine_id = '${sql[0].mine_id}' `);
                        res.send({
                          reply: `[CQ:at,qq=${req.body.user_id}] 踩了一脚地雷，为什么要想不开呢，被[CQ:at,qq=${sql[0].placed_qq}]所埋地雷炸成重伤，休养生息${boom_time}秒！`,
                          ban: 1,
                          ban_duration: boom_time,
                        });
                        return 0;
                      } else {
                        //没有雷
                        res.send({
                          reply: `[CQ:at,qq=${req.body.user_id}] 这个雷区里的雷似乎已经被勇士们排干净了，不如趁现在埋一个吧！`,
                        });
                      }
                    });
                    return 0;
                  }
    
                  //希望的花
                  if (this.global.hope_flower_reg.test(req.body.message)) {
                    let who;
                    let boom_time = Math.floor(Math.random() * 30); //造成0-30伤害时间
                    if (req.body.message === "希望的花") {
                      console.log(`群 ${req.body.group_id} 的群员 ${req.body.user_id} 朝自己丢出一朵希望的花`);
                      res.send({ reply: `团长，你在做什么啊！团长！希望的花，不要乱丢啊啊啊啊` });
                      return 0;
                    } else {
                      who = req.body.message;
                      who = who.replace("希望的花 ", "");
                      who = who.replace("希望的花", "");
                      who = who.replace("[CQ:at,qq=", "");
                      who = who.replace("]", "");
                      who = who.trim();
                      if (this.global.is_qq_reg.test(who)) {
                        console.log(`群 ${req.body.group_id} 的 群员 ${req.body.user_id} 向 ${who} 丢出一朵希望的花`);
                      } else {
                        //目标不是qq号
                        res.send({ reply: `团长，你在做什么啊！团长！希望的花目标不可以是${who}，不要乱丢啊啊啊啊` });
                        return 0;
                      }
                    }
    
                    //先救活目标
                    request(
                      `http://${this.global.go_cqhttp_api}/set_group_ban?group_id=${req.body.group_id}&user_id=${who}&duration=0`,
                      function (error, _response, _body) {
                        if (!error) {
                          console.log(`群 ${req.body.group_id} 的 群员 ${req.body.user_id} 救活了 ${who}`);
                          res.send({
                            reply: `团长，团长你在做什么啊团长，团长！为什么要救他啊，哼，呃，啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊！！！团长救下了[CQ:at,qq=${who}]，但自己被炸飞了，休养生息${boom_time}秒！不要停下来啊！`,
                          });
                        } else {
                          console.log(`请求${this.global.go_cqhttp_api}/set_group_whole_ban错误：${error}`);
                          res.send({ reply: `日忒娘，怎么又出错了` });
                        }
                      }
                    );
    
                    //再禁言团长
                    request(
                      `http://${this.global.go_cqhttp_api}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=${boom_time}`,
                      function (error, _response, _body) {
                        if (!error) {
                          console.log(`${req.body.user_id} 自己被炸伤${boom_time}秒`);
                        } else {
                          console.log(`请求${this.global.go_cqhttp_api}/set_group_whole_ban错误：${error}`);
                          res.send({ reply: `日忒娘，怎么又出错了` });
                        }
                      }
                    );
                    return 0;
                  }
    
                  //击鼓传雷
                  if (this.global.loop_bomb_reg.test(req.body.message)) {
                    //先检查群有没有开始游戏
                    db.all(`SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
                      if (!err && sql[0]) {
                        //判断游戏开关 loop_bomb_enabled，没有开始的话就开始游戏，如果游戏已经超时结束了的话重新开始
                        if (sql[0].loop_bomb_enabled === 0 || 60 - process.hrtime([sql[0].loop_bomb_start_time, 0])[0] < 0) {
                          //游戏开始
                          db.run(`UPDATE qq_group SET loop_bomb_enabled = '1' WHERE group_id ='${req.body.group_id}'`);
                          let text = "击鼓传雷游戏开始啦，这是一个只有死亡才能结束的游戏，做好准备了吗";
                          request(
                            `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(text)}`,
                            function (error, _response, _body) {
                              if (!error) {
                                console.log(`群 ${req.body.group_id} 开始了击鼓传雷`);
                                io.emit("system message", `@群 ${req.body.group_id} 开始了击鼓传雷`);
                              } else {
                                console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                              }
                            }
                          );
    
                          //给发起人出题，等待ta回答
                          this.this.tools.ECYWenDa()
                            .then((resolve) => {
                              let question = `那么[CQ:at,qq=${req.body.user_id}]请听题：${resolve.quest} 请告诉小夜：击鼓传雷 你的答案，时间剩余59秒`;
                              let answer = resolve.result; //把答案、目标人、开始时间存入数据库
                              db.run(
                                `UPDATE qq_group SET loop_bomb_answer = '${answer}', loop_bomb_onwer = '${req.body.user_id}' , loop_bomb_start_time = '${
                                  process.hrtime()[0]
                                }' WHERE group_id ='${req.body.group_id}'`
                              );
    
                              //金手指
                              request(
                                `http://${this.global.go_cqhttp_api}/set_group_card?group_id=${req.body.group_id}&user_id=${req.body.user_id}&card=${encodeURI(
                                  answer
                                )}`,
                                function (error, _response, _body) {
                                  if (!error) {
                                    console.log(`击鼓传雷金手指已启动`);
                                  } else {
                                    console.log(`请求${this.global.go_cqhttp_api}/set_group_card错误：${error}`);
                                  }
                                }
                              );
    
                              //丢出问题
                              setTimeout(function () {
                                request(
                                  `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(question)}`,
                                  function (error, _response, _body) {
                                    if (!error) {
                                    } else {
                                      console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                                    }
                                  }
                                );
                              }, 1000);
                            })
                            .catch((reject) => {
                              res.send({ reply: `日忒娘，怎么又出错了：${reject}` });
                              console.log(`日忒娘，怎么又出错了：${reject}`);
                            });
    
                          //开始倒计时，倒计时结束宣布游戏结束
                          (this.global.boom_timer = setTimeout(function () {
                            console.log(`群 ${req.body.group_id} 的击鼓传雷到达时间，炸了`);
                            let boom_time = Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                            //获取这个雷现在是谁手上，炸ta
                            db.all(`SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
                              if (!err && sql[0]) {
                                request(
                                  `http://${this.global.go_cqhttp_api}/set_group_ban?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_onwer}&duration=${boom_time}`,
                                  function (error, _response, _body) {
                                    if (!error) {
                                      console.log(`${sql[0].loop_bomb_onwer} 在群 ${req.body.group_id} 回答超时，被炸伤${boom_time}秒`);
    
                                      //金手指关闭
                                      request(
                                        `http://${this.global.go_cqhttp_api}/set_group_card?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_onwer}&card=`,
                                        function (error, _response, _body) {
                                          if (!error) {
                                            console.log(`击鼓传雷金手指已恢复`);
                                          } else {
                                            console.log(`请求${this.global.go_cqhttp_api}/set_group_card错误：${error}`);
                                          }
                                        }
                                      );
    
                                      let end = `时间到了，pia，雷在[CQ:at,qq=${sql[0].loop_bomb_onwer}]手上炸了，你被炸成重伤了，休养生息${boom_time}秒！游戏结束！下次加油噢，那么答案公布：${sql[0].loop_bomb_answer}`;
                                      request(
                                        `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(end)}`,
                                        function (error, _response, _body) {
                                          if (!error) {
                                            io.emit(
                                              "system message",
                                              `@${sql[0].loop_bomb_onwer} 在群 ${req.body.group_id} 回答超时，被炸伤${boom_time}秒`
                                            );
                                          } else {
                                            console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                                          }
                                        }
                                      );
                                      //游戏结束，清空数据
                                      db.run(
                                        `UPDATE qq_group SET loop_bomb_enabled = '0', loop_bomb_answer = '', loop_bomb_onwer = '' , loop_bomb_start_time = '' WHERE group_id ='${req.body.group_id}'`
                                      );
                                      return 0;
                                    } else {
                                      console.log(`请求${this.global.go_cqhttp_api}/set_group_whole_ban错误：${error}`);
                                    }
                                  }
                                );
                                io.emit("system message", `@群 ${req.body.group_id} 的击鼓传雷到达时间，炸了`);
                              }
                            });
                          }, 1000 * 60));
    
                          //已经开始游戏了，判断答案对不对
                        } else {
                          var your_answer = req.body.message;
                          your_answer = your_answer.replace("击鼓传雷 ", "");
                          your_answer = your_answer.replace("击鼓传雷", "");
                          your_answer = your_answer.trim();
                          //从数据库里取答案判断
                          db.all(`SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
                            if (!err && sql[0]) {
                              //判断答案 loop_bomb_answer
                              if (sql[0].loop_bomb_answer == your_answer) {
                                //答对了
                                //不是本人回答，是来抢答的
                                if (sql[0].loop_bomb_onwer != req.body.user_id) {
                                  //无论对错都惩罚
                                  let end = `[CQ:at,qq=${req.body.user_id}] 抢答正确！答案确实是 ${sql[0].loop_bomb_answer}！但因为抢答了所以被惩罚了！`;
                                  request(
                                    `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(end)}`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        io.emit("system message", `@${req.body.user_id} 在群 ${req.body.group_id} 回答正确`);
    
                                        //金手指关闭
                                        request(
                                          `http://${this.global.go_cqhttp_api}/set_group_card?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_onwer}&card=`, //req.body.user_id
                                          function (error, _response, _body) {
                                            if (!error) {
                                              console.log(`击鼓传雷金手指已恢复`);
                                            } else {
                                              console.log(`请求${this.global.go_cqhttp_api}/set_group_card错误：${error}`);
                                            }
                                          }
                                        );
    
                                        //禁言
                                        request(
                                          `http://${this.global.go_cqhttp_api}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=60`,
                                          function (error, _response, _body) {
                                            if (!error) {
                                              console.log(`抢答了，${req.body.user_id} 被禁言`);
                                            } else {
                                              console.log(`请求${this.global.go_cqhttp_api}/set_group_ban错误：${error}`);
                                              res.send({ reply: `日忒娘，怎么又出错了` });
                                            }
                                          }
                                        );
                                      } else {
                                        console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                                      }
                                    }
                                  );
                                } else {
                                  //回答正确
                                  //金手指关闭
                                  request(
                                    `http://${this.global.go_cqhttp_api}/set_group_card?group_id=${req.body.group_id}&user_id=${req.body.user_id}&card=`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        console.log(`击鼓传雷金手指已启动`);
                                      } else {
                                        console.log(`请求${this.global.go_cqhttp_api}/set_group_card错误：${error}`);
                                      }
                                    }
                                  );
                                  let end = `[CQ:at,qq=${req.body.user_id}] 回答正确！答案确实是 ${sql[0].loop_bomb_answer}！`;
                                  request(
                                    `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(end)}`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        io.emit("system message", `@${sql[0].loop_bomb_onwer} 在群 ${req.body.group_id} 回答正确`);
                                      } else {
                                        console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                                      }
                                    }
                                  );
                                }
                                //答题成功，然后要把雷传给随机幸运群友，进入下一题
                                setTimeout(function () {
                                  request(`http://${this.global.go_cqhttp_api}/get_group_member_list?group_id=${req.body.group_id}`, (err, response, body) => {
                                    body = JSON.parse(body);
                                    if (!err && body.data.length != 0) {
                                      var rand_user_id = Math.floor(Math.random() * body.data.length);
                                      console.log(`随机选取一个群友：${body.data[rand_user_id].user_id}`);
                                      let rand_user = body.data[rand_user_id].user_id;
    
                                      //选完之后开始下一轮游戏，先查询剩余时间，然后给随机幸运群友出题，等待ta回答
                                      db.all(`SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`, (err, sql) => {
                                        if (!err && sql[0]) {
                                            this.this.tools.ECYWenDa()
                                            .then((resolve) => {
                                              let diff = 60 - process.hrtime([sql[0].loop_bomb_start_time, 0])[0]; //剩余时间
                                              let question = `抽到了幸运群友[CQ:at,qq=${rand_user}]！请听题：${resolve.quest} 请告诉小夜： 击鼓传雷 你的答案，时间还剩余${diff}秒`;
                                              let answer = resolve.result; //把答案、目标人存入数据库
                                              db.run(
                                                `UPDATE qq_group SET loop_bomb_answer = '${answer}', loop_bomb_onwer = '${rand_user}' WHERE group_id ='${req.body.group_id}'`
                                              );
    
                                              //金手指
                                              request(
                                                `http://${this.global.go_cqhttp_api}/set_group_card?group_id=${
                                                  req.body.group_id
                                                }&user_id=${rand_user}&card=${encodeURI(answer)}`,
                                                function (error, _response, _body) {
                                                  if (!error) {
                                                    console.log(`击鼓传雷金手指已启动`);
                                                  } else {
                                                    console.log(`请求${this.global.go_cqhttp_api}/set_group_card错误：${error}`);
                                                  }
                                                }
                                              );
    
                                              request(
                                                `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(question)}`,
                                                function (error, _response, _body) {
                                                  if (!error) {
                                                    console.log(`群 ${req.body.group_id} 开始了下一轮击鼓传雷`);
                                                    io.emit("system message", `@群 ${req.body.group_id} 开始了下一轮击鼓传雷`);
                                                  } else {
                                                    console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                                                  }
                                                }
                                              );
                                            })
                                            .catch((reject) => {
                                              res.send({ reply: `日忒娘，怎么又出错了：${reject}` });
                                              console.log(`日忒娘，怎么又出错了：${reject}`);
                                            });
                                        }
                                      });
                                    } else {
                                      console.log("随机选取一个群友错误。错误原因：" + JSON.stringify(response.body));
                                    }
                                    return 0;
                                  });
                                }, 500);
    
                                //答错了
                              } else {
                                let boom_time = Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                                let end = `[CQ:at,qq=${req.body.user_id}] 回答错误，好可惜，你被炸成重伤了，休养生息${boom_time}秒！游戏结束！下次加油噢，那么答案公布：${sql[0].loop_bomb_answer}`;
                                console.log(`${req.body.user_id} 在群 ${req.body.group_id} 回答错误，被炸伤${boom_time}秒`);
                                clearTimeout(this.global.boom_timer);
    
                                request(
                                  `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(end)}`,
                                  function (error, _response, _body) {
                                    if (!error) {
                                      io.emit("system message", `@${sql[0].loop_bomb_onwer} 在群 ${req.body.group_id} 回答正确`);
                                      //禁言
                                      request(
                                        `http://${this.global.go_cqhttp_api}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=${boom_time}`,
                                        function (error, _response, _body) {
                                          if (!error) {
                                            console.log(`抢答了，${req.body.user_id} 被禁言`);
                                          } else {
                                            console.log(`请求${this.global.go_cqhttp_api}/set_group_ban错误：${error}`);
                                            res.send({ reply: `日忒娘，怎么又出错了` });
                                          }
                                        }
                                      );
                                    } else {
                                      console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                                    }
                                  }
                                );
    
                                //游戏结束，删掉游戏记录
                                db.run(
                                  `UPDATE qq_group SET loop_bomb_enabled = '0', loop_bomb_answer = '', loop_bomb_onwer = '' , loop_bomb_start_time = '' WHERE group_id ='${req.body.group_id}'`
                                );
    
                                //金手指关闭
                                request(
                                  `http://${this.global.go_cqhttp_api}/set_group_card?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_onwer}&card=`,
                                  function (error, _response, _body) {
                                    if (!error) {
                                      console.log(`击鼓传雷金手指已启动`);
                                    } else {
                                      console.log(`请求${this.global.go_cqhttp_api}/set_group_card错误：${error}`);
                                    }
                                  }
                                );
    
                                request(
                                  `http://${this.global.go_cqhttp_api}/set_group_card?group_id=${req.body.group_id}&user_id=${req.body.user_id}&card=`,
                                  function (error, _response, _body) {
                                    if (!error) {
                                      console.log(`击鼓传雷金手指已启动`);
                                    } else {
                                      console.log(`请求${this.global.go_cqhttp_api}/set_group_card错误：${error}`);
                                    }
                                  }
                                );
    
                                return 0;
                              }
                            }
                          });
                        }
                      }
                    });
                  }
    
                  //我有个朋友
                  if (this.global.i_have_a_friend_reg.test(req.body.message)) {
                    //指定目标的话
                    if (this.global.has_qq_reg.test(req.body.message)) {
                      var msg_in = req.body.message.split("说")[1];
                      var msg = msg_in.split("[CQ:at,qq=")[0].trim();
                      var who = msg_in.split("[CQ:at,qq=")[1];
                      var who = who.replace("]", "").trim();
                      if (this.global.is_qq_reg.test(who)) {
                        var sources = `https://api.sumt.cn/api/qq.logo.php?qq=${who}`; //载入头像
                      }
                      //没指定目标
                    } else {
                      var msg = req.body.message.split("说")[1];
                      var sources = `https://api.sumt.cn/api/qq.logo.php?qq=${req.body.user_id}`; //没有指定谁，那这个朋友就是ta自己
                    }
    
                    loadImage(sources).then((image) => {
                      let canvas = createCanvas(350, 80);
                      let ctx = canvas.getContext("2d");
                      ctx.fillStyle = "WHITE";
                      ctx.fillRect(0, 0, 350, 80);
                      ctx.font = "20px SimHei";
                      ctx.textAlign = "left";
                      ctx.fillStyle = "#000000";
                      ctx.fillText("沙雕网友群", 90.5, 35.5);
                      ctx.font = "16px SimHei";
                      ctx.fillStyle = "#716F81";
                      ctx.fillText(`沙雕网友: ${msg}`, 90.5, 55.5);
                      ctx.font = "13px SimHei";
                      ctx.fillText(this.this.tools.CurentTime(), 280.5, 35.5);
    
                      ctx.beginPath();
                      ctx.arc(40, 40, 28, 0, 2 * Math.PI);
                      ctx.fill();
                      ctx.clip();
                      ctx.drawImage(image, 10, 10, 60, 60);
                      ctx.closePath();
    
                      let file_local = path.join(`${process.cwd()}`, `static`, `xiaoye`, `images`, `${sha1(canvas.toBuffer())}.jpg`);
                      fs.writeFileSync(file_local, canvas.toBuffer());
                      let file_online = `http://127.0.0.1:${this.global.web_port}/xiaoye/images/${sha1(canvas.toBuffer())}.jpg`;
                      console.log(`我有个朋友合成成功，图片发送：${file_online}`);
                      res.send({
                        reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                      });
                    });
                    return 0;
                  }
    
                  //查询运行状态
                  if (req.body.message === "/status") {
                    console.log(`查询运行状态`);
                    let self_id = req.body.self_id;
                    if (self_id != this.global.bot_qq) {
                      //若配置qq和实际登录qq不匹配，则自动更新qq号
                      let stat = `配置qq：${this.global.bot_qq} 和实际登录qq：${self_id} 不匹配，自动更新了qq号为 ${self_id}`;
                      console.log(`${stat}`);
                      this.global.bot_qq = self_id;
                      res.send({
                        reply: stat,
                      });
                      return 0;
                    }
                    self_id != "1648468212" ? (self_id = self_id) : (self_id = "1648468212(小小夜本家)"); //试着用一下三元运算符，比if稍微绕一些，但是习惯了非常符合直觉，原理是：当?前的条件成立时，执行:前的语句，不成立的话执行:后的语句
                    let stat = `企划：星野夜蝶Official_${this.global.version}_${this.global.bot_qq}
    宿主内核架构：${os.hostname()} ${os.type()} ${os.arch()}
    正常运行时间：${Math.round(os.uptime() / 60 / 60)}小时
    小夜吃掉了 ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB/${Math.round(os.totalmem() / 1024 / 1024)}MB 内存
    如果该小夜出现任何故障，请联系该小夜领养员，
    也可以发送 /报错 小夜的错误 来提交bug给开发团队。
    点击加入夜爹开发群：https://jq.qq.com/?_wv=1027&k=bTZSd2iI
    `;
                    res.send({
                      reply: stat,
                    });
                    return 0;
                  }
    
                  //字符画
                  if (this.global.ascii_draw.test(req.body.message)) {
                    let str = alphabet(req.body.message.replace("/字符画 ", ""), "stereo");
                    console.log(str);
                    res.send({
                      reply: str,
                    });
                    return 0;
                  }
    
                  //孤寡
                  if (this.global.gugua.test(req.body.message)) {
                    if (req.body.message == "/孤寡") {
                      res.send({ reply: `小夜收到了你的孤寡订单，现在就开始孤寡你了噢孤寡~` });
                      this.this.tools.Gugua(req.body.user_id);
                      return 0;
                    }
                    let who = req.body.message.replace("/孤寡 ", "");
                    who = who.replace("/孤寡", "");
                    who = who.replace("[CQ:at,qq=", "");
                    who = who.replace("]", "");
                    who = who.trim();
                    if (this.global.is_qq_reg.test(who)) {
                      request(`http://${this.global.go_cqhttp_api}/get_friend_list`, (err, response, body) => {
                        body = JSON.parse(body);
                        if (!err && body.data.length != 0) {
                          for (let i in body.data) {
                            if (who == body.data[i].user_id) {
                              res.send({ reply: `小夜收到了你的孤寡订单，现在就开始孤寡[CQ:at,qq=${who}]了噢孤寡~` });
                              request(
                                `http://${this.global.go_cqhttp_api}/send_private_msg?user_id=${who}&message=${encodeURI(
                                  `您好，我是孤寡小夜，您的好友 ${req.body.user_id} 给您点了一份孤寡套餐，请查收`
                                )}`,
                                function (error, _response, _body) {
                                  if (!error) {
                                    console.log(`群 ${req.body.group_id} 的 群员 ${req.body.user_id} 孤寡了 ${who}`);
                                  } else {
                                    console.log(`请求${this.global.go_cqhttp_api}/send_private_msg错误：${error}`);
                                  }
                                }
                              );
                              this.this.tools.Gugua(who);
                              return 0;
                            }
                          }
                          res.send({
                            reply: `小夜没有[CQ:at,qq=${who}]的好友，没有办法孤寡ta呢，请先让ta加小夜为好友吧，小夜就在群里给大家孤寡一下吧`,
                          });
                          this.this.tools.QunGugua(req.body.group_id);
                        } else {
                          reject("随机选取一个群错误。错误原因：" + JSON.stringify(response.body));
                        }
                      });
                    } else {
                      //目标不是qq号
                      res.send({ reply: `你想孤寡谁啊，目标不可以是${who}，不要乱孤寡，小心孤寡你一辈子啊` });
                      return 0;
                    }
                    return 0;
                  }
    
                  //黑白生草图
                  if (this.global.bww_reg.test(req.body.message)) {
                    var msg: any = req.body.message + " " + " "; //结尾加2个空格防爆
                    msg = msg.substr(4).split(" ");
                    console.log(msg);
                    let pic = msg[1].trim(), //使用图片
                      tex1 = msg[2].trim(), //使用文字1
                      tex2 = msg[3].trim(); //使用文字2
    
                    //如果没有使用图片的话，默认图片
                    if (!pic) {
                      pic =
                        "[CQ:image,file=657109635d3492bdb455defa8936ad96.image,url=https://gchat.qpic.cn/gchatpic_new/1005056803/2063243247-2847024251-657109635D3492BDB455DEFA8936AD96/0?term=3]";
                    }
    
                    //如果没有使用文字的话，默认文字
                    if (!tex1) {
                      tex1 = `当你凝望神圣手雷的时候，神圣手雷也在凝望你`;
                    }
    
                    if (!tex2) {
                      tex2 = `あなたが神圣手雷を見つめるとき、神圣手雷もあなたを見つめています`;
                    }
    
                    //开始黑白
                    let sources = this.global.img_url_reg.exec(pic)[0]; //取图片链接
                    loadImage(sources).then((image) => {
                      let canvas = createCanvas(parseInt(image.width), parseInt(image.height + 150)); //根据图片尺寸创建画布，并在下方加文字区
                      let ctx = canvas.getContext("2d");
                      ctx.drawImage(image, 0, 0);
                      ctx.filter = "grayscale";
                      ctx.fillStyle = "BLACK";
                      ctx.fillRect(0, parseInt(image.height), parseInt(image.width), 150);
                      ctx.font = `40px Sans`;
                      ctx.textAlign = "center";
                      ctx.fillStyle = "WHITE";
                      ctx.fillText(tex1, parseInt(image.width) / 2, parseInt(image.height) + 70); //第一句
                      ctx.font = `28px Sans`;
                      ctx.fillText(tex2, parseInt(image.width) / 2, parseInt(image.height) + 110); //第二句
    
                      //把图片挨个像素转为黑白
                      let canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
    
                      let file_local = path.join(`${process.cwd()}`, `static`, `xiaoye`, `images`, `${sha1(canvas.toBuffer())}.jpg`);
                      fs.writeFileSync(file_local, canvas.toBuffer());
                      let file_online = `http://127.0.0.1:${this.global.web_port}/xiaoye/images/${sha1(canvas.toBuffer())}.jpg`;
                      console.log(`黑白成功，图片发送：${file_online}`);
                      res.send({
                        reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                      });
                    });
    
                    return 0;
                  }
    
                  //生成二维码
                  if (this.global.make_qrcode.test(req.body.message)) {
                    let content = req.body.message.match(this.global.make_qrcode)[1];
                    res.send({
                      reply: `[CQ:image,file=https://api.sumt.cn/api/qr.php?text=${content},url=https://api.sumt.cn/api/qr.php?text=${content}]`,
                    });
                    return 0;
                  }
    
                  //群欢迎
                  if (req.body.notice_type === "group_increase") {
                    let final = `[CQ:at,qq=${req.body.user_id}] 你好呀，我是本群RBQ担当小夜！小夜的使用说明书在这里 https://blog.giftia.moe/ 噢，请问主人是要先吃饭呢，还是先洗澡呢，还是先*我呢~`;
                    request(
                      `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(final)}`,
                      function (error, _response, _body) {
                        if (!error) {
                          console.log(`${req.body.user_id} 加入了群 ${req.body.group_id}，小夜欢迎了ta`);
                        } else {
                          console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                        }
                      }
                    );
                    return 0;
                  }
    
                  //管理员功能：提醒停止服务的群启用小夜
                  if (req.body.message === "/admin alert_open") {
                    for (let i in this.global.qq_admin_list) {
                      if (req.body.user_id == this.global.qq_admin_list[i]) {
                        console.log(`管理员启动了提醒任务`);
                        this.AlertOpen().then((resolve) => {
                          res.send({
                            reply: `管理员启动了提醒任务，开始提醒停止服务的群启用小夜……${resolve}`,
                          });
                        });
                        return 0;
                      }
                    }
                    res.send({
                      reply: `你不是狗管理噢，不能让小夜这样那样的`,
                    });
                    return 0;
                  }
    
                  //管理员功能：执行sql
                  if (this.global.admin_reg.test(req.body.message)) {
                    for (let i in this.global.qq_admin_list) {
                      if (req.body.user_id == this.global.qq_admin_list[i]) {
                        let admin_code = req.body.message.replace("/admin sql ", "");
                        console.log(`管理员sql指令`);
                        db.run(admin_code);
                        res.send({
                          reply: `管理员sql指令执行完毕`,
                        });
                        return 0;
                      }
                    }
                    res.send({
                      reply: `你不是狗管理噢，不能让小夜这样那样的`,
                    });
                    return 0;
                  }
    
                  //管理员功能：修改聊天回复率
                  if (this.global.change_reply_probability_reg.test(req.body.message)) {
                    for (let i in this.global.qq_admin_list) {
                      if (req.body.user_id == this.global.qq_admin_list[i]) {
                        let msg = req.body.message.replace("/admin_change_reply_probability ", "");
                        this.global.reply_probability = msg;
                        res.send({
                          reply: `小夜回复率已修改为${msg}%`,
                        });
                        return 0;
                      }
                    }
                    res.send({
                      reply: `你不是狗管理噢，不能让小夜这样那样的`,
                    });
                    return 0;
                  }
    
                  /*                    要新增指令与功能请在这条分割线的上方添加，在下面添加有可能会导致冲突以及不可预料的异常                    */
    
                  //随机抽风，丢一个骰子，按 chaos_probability 几率抽风
                  let chaos_flag = Math.floor(Math.random() * 1000);
                  if (chaos_flag < this.global.chaos_probability) {
                    //随机选一个群抽风
                    let prprmsg;
                    this.this.tools.PrprDoge()
                      .then((resolve) => {
                        prprmsg = resolve;
                        this.this.tools.RandomGroupList()
                          .then((resolve) => {
                            request(
                              `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${resolve}&message=${encodeURI(prprmsg)}`,
                              function (error, _response, _body) {
                                if (!error) {
                                  console.log(`qqBot小夜在群 ${resolve} 抽风了，发送了 ${prprmsg}`);
                                  io.emit("system message", `@qqBot小夜在群 ${resolve} 抽风了，发送了 ${prprmsg}`);
                                } else {
                                  console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
                                }
                              }
                            );
                          })
                          .catch((reject) => {
                            console.log(reject.error);
                            res.send();
                          });
                      })
                      .catch((reject) => {
                        console.log(`随机舔狗错误：${reject}`);
                      });
                    return 0;
                  }
    
                  //丢一个骰子，按fudu_probability几率复读
                  let fudu_flag = Math.floor(Math.random() * 100);
                  if (fudu_flag < this.global.fudu_probability) {
                    console.log(`qqBot小夜复读 ${req.body.message}`);
                    io.emit("system message", `@qqBot小夜复读 ${req.body.message}`);
                    res.send({ reply: req.body.message });
                    return 0;
                  }
    
                  //丢一个骰子，按reply_probability几率回复
                  let reply_flag = Math.floor(Math.random() * 100);
                  //如果被@了，那么回复几率上升80%
                  let at_replaced_msg = req.body.message; //要把[CQ:at,qq=${bot_qq}] 去除掉，否则聊天核心会乱成一锅粥
                  if (this.global.xiaoye_ated.test(req.body.message)) {
                    reply_flag -= 80;
                    at_replaced_msg = req.body.message.replace(`[CQ:at,qq=${this.global.bot_qq}]`, "").trim(); //去除@小夜
                  }
                  //骰子命中，那就让小夜来自动回复
                  if (reply_flag < this.global.reply_probability) {
                    this.this.tools.ChatProcess(at_replaced_msg)
                      .then((resolve) => {
                        if (resolve.indexOf("[name]") || resolve.indexOf("&#91;name&#93;")) {
                          resolve = resolve.toString().replace("[name]", `[CQ:at,qq=${req.body.user_id}]`); //替换[name]为正确的@
                          resolve = resolve.toString().replace("&#91;name&#93;", `[CQ:at,qq=${req.body.user_id}]`); //替换[name]为正确的@
                        }
                        console.log(`qqBot小夜回复 ${resolve}`);
                        io.emit("system message", `@qqBot小夜回复：${resolve}`);
                        res.send({ reply: resolve });
                        return 0;
                      })
                      .catch((reject) => {
                        //无匹配则随机回复balabala废话
                        this.this.tools.GetBalabalaList()
                          .then((resolve) => {
                            let random_balabala = resolve[Math.floor(Math.random() * resolve.length)].balabala;
                            res.send({ reply: random_balabala });
                            io.emit("system message", `@qqBot小夜觉得${random_balabala}`);
                            console.log(`${reject}，qqBot小夜觉得${random_balabala}`);
                            return 0;
                          })
                          .catch((reject) => {
                            console.log(`小夜试图balabala但出错了：${reject}`);
                            res.send({ reply: `小夜试图balabala但出错了：${reject}` });
                            io.emit("system message", `@qqBot小夜试图balabala但出错了：${reject}`);
                            return 0;
                          });
                      });
                  } else {
                    res.send(); //相当于严格模式，如果有多条res.send将会报错
                  }
                }
                //群不存在于qq_group表则写入qq_group表
              } else {
                console.log(`${req.body.group_id} 这个群不在qq_group表里，现在写入到qq_group表`);
                db.run(`INSERT INTO qq_group VALUES('${req.body.group_id}', '1', '0', '', '', '')`);
                res.send();
              }
            });
          }
        } else if (req.body.message_type == "private" && this.global.private_service_swich == true) {
          //私聊回复
          this.this.tools.ChatProcess(req.body.message)
            .then((resolve) => {
              console.log(`qqBot小夜回复 ${resolve}`);
              io.emit("system message", `@qqBot小夜回复：${resolve}`);
              res.send({ reply: resolve });
            })
            .catch((reject) => {
              //无匹配则随机回复balabala废话
              this.this.tools.GetBalabalaList()
                .then((resolve) => {
                  let random_balabala = resolve[Math.floor(Math.random() * resolve.length)].balabala;
                  res.send({ reply: random_balabala });
                  io.emit("system message", `@qqBot小夜觉得${random_balabala}`);
                  console.log(`${reject}，qqBot小夜觉得${random_balabala}`);
                })
                .catch((reject) => {
                  console.log(`小夜试图balabala但出错了：${reject}`);
                  res.send({ reply: `小夜试图balabala但出错了：${reject}` });
                  io.emit("system message", `@qqBot小夜试图balabala但出错了：${reject}`);
                });
            });
          return 0;
        } else {
          res.send();
        }
      });
    
      //每隔4小时搜索qq_group表，随机延时提醒停用服务的群启用服务
      setInterval(this.AlertOpen, 1000 * 60 * 60 * 4);
    }

    //提醒张菊
    AlertOpen() {
      return new Promise((resolve, _reject) => {
        db.all(`SELECT * FROM qq_group WHERE talk_enabled = 0`, (err, sql) => {
          if (!err && sql[0]) {
            let service_stoped_list = []; //停用服务的群列表
            for (let i in sql) {
              service_stoped_list.push(sql[i].group_id);
            }
            console.log(`以下群未启用小夜服务：${service_stoped_list} ，现在开始随机延时提醒`);
            this.this.tools.DelayAlert(service_stoped_list);
            resolve(`以下群未启用小夜服务：${service_stoped_list} ，现在开始随机延时提醒`);
          } else {
            console.log(`目前没有群是关闭服务的，挺好`);
          }
        });
      });
    }
    
    //直播间开关，星野夜蝶上线！
    start_live() {
      setInterval(this.LoopDanmu, 5000);
    }
    //虚拟主播星野夜蝶核心代码，间隔5秒接收最新弹幕，如果弹幕更新了就开始处理，然后随机开嘴臭地图炮
    LoopDanmu() {
      this.this.tools.GetLaststDanmu()
        .then((resolve) => {
          if (this.global.last_danmu_timeline === resolve.timeline) {
            //弹幕没有更新
            console.log(`弹幕暂未更新`);
            //丢一个骰子，如果命中了就开地图炮，1%的几率
            let ditupao_flag = Math.floor(Math.random() * 100);
            if (ditupao_flag < 1) {
                this.this.tools.ChatProcess("").then((resolve) => {
                let reply = resolve;
                console.log(`小夜开地图炮了：${reply}`);
                //将直播小夜的回复写入txt，以便在直播姬显示
                fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, reply);
                //然后让小夜读出来
                this.this.tools.BetterTTS(reply)
                  .then((resolve) => {
                    let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`; //这里似乎有问题，ntfs短文件名无法转换
                    voiceplayer.play(tts_file, function (err) {
                      if (err) throw err;
                    });
                  })
                  .catch((reject) => {
                    console.log(`TTS错误：${reject}`);
                  });
              });
            }
          } else {
            console.log(`获取到最新弹幕：${resolve.text}`);
            this.global.last_danmu_timeline = resolve.timeline;
            io.emit("sysrem message", `@弹幕传来： ${resolve.text}`);
    
            //卧槽这么多传参怎么复用啊
            //教学系统，抄板于虹原翼版小夜v3
            if (this.global.teach_reg.test(resolve.text)) {
              let msg = resolve.text;
              msg = msg.replace(/'/g, ""); //防爆
              msg = msg.substr(2).split("答：");
              if (msg.length !== 2) {
                console.log(`教学指令：分割有误，退出教学`);
                fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `你教的姿势不对噢qwq`);
                this.this.tools.BetterTTS("你教的姿势不对噢qwq")
                  .then((resolve) => {
                    let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                    voiceplayer.play(tts_file, function (err) {
                      if (err) throw err;
                    });
                  })
                  .catch((reject) => {
                    console.log(`TTS错误：${reject}`);
                  });
                return 0;
              }
              let ask = msg[0].trim(),
                ans = msg[1].trim();
              if (ask == "" || ans == "") {
                console.log(`问/答为空，退出教学`);
                fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `你教的姿势不对噢qwq`);
                this.this.tools.BetterTTS("你教的姿势不对噢qwq")
                  .then((resolve) => {
                    let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                    voiceplayer.play(tts_file, function (err) {
                      if (err) throw err;
                    });
                  })
                  .catch((reject) => {
                    console.log(`TTS错误：${reject}`);
                  });
                return 0;
              }
              if (ask.indexOf(/\r?\n/g) !== -1) {
                console.log(`教学指令：关键词换行了，退出教学`);
                fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `关键词不能换行啦qwq`);
                this.this.tools.BetterTTS("关键词不能换行啦qwq")
                  .then((resolve) => {
                    let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                    voiceplayer.play(tts_file, function (err) {
                      if (err) throw err;
                    });
                  })
                  .catch((reject) => {
                    console.log(`TTS错误：${reject}`);
                  });
                return 0;
              }
              console.log(`弹幕想要教给小夜：问：${ask} 答：${ans}，现在开始检测合法性`);
              for (let i in this.global.black_list_words) {
                if (
                  ask.toLowerCase().indexOf(this.global.black_list_words[i].toLowerCase()) !== -1 ||
                  ans.toLowerCase().indexOf(this.global.black_list_words[i].toLowerCase()) !== -1
                ) {
                  console.log(`教学指令：检测到不允许的词：${this.global.black_list_words[i]}，退出教学`);
                  fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `你教的内容里有主人不允许小夜学习的词：${this.global.black_list_words[i]} qwq`);
                  this.this.tools.BetterTTS(`你教的内容里有主人不允许小夜学习的词：${this.global.black_list_words[i]} qwq`)
                    .then((resolve) => {
                      let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                      voiceplayer.play(tts_file, function (err) {
                        if (err) throw err;
                      });
                    })
                    .catch((reject) => {
                      console.log(`TTS错误：${reject}`);
                    });
                  return 0;
                }
              }
              if (Buffer.from(ask).length < 4) {
                //关键词最低长度：4个英文或2个汉字
                console.log(`教学指令：关键词太短，退出教学`);
                fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `关键词太短了啦qwq，至少要4个字节啦`);
                this.this.tools.BetterTTS("关键词太短了啦qwq，至少要4个字节啦")
                  .then((resolve) => {
                    let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                    voiceplayer.play(tts_file, function (err) {
                      if (err) throw err;
                    });
                  })
                  .catch((reject) => {
                    console.log(`TTS错误：${reject}`);
                  });
                return 0;
              }
              if (ask.length > 100 || ans.length > 100) {
                console.log(`教学指令：教的太长了，退出教学`);
                fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `你教的内容太长了，小夜要坏掉了qwq，不要呀`);
                this.this.tools.BetterTTS("你教的内容太长了，小夜要坏掉了qwq，不要呀")
                  .then((resolve) => {
                    let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                    voiceplayer.play(tts_file, function (err) {
                      if (err) throw err;
                    });
                  })
                  .catch((reject) => {
                    console.log(`TTS错误：${reject}`);
                  });
                return 0;
              }
              //到这里都没有出错的话就视为没有问题，可以让小夜学了
              console.log(`教学指令：没有检测到问题，可以学习`);
              db.run(`INSERT INTO chat VALUES('${ask}', '${ans}')`);
              console.log(`教学指令：学习成功`);
              fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `哇！小夜学会啦！对我说：${ask} 试试吧，小夜有可能会回复 ${ans} 噢`);
              this.this.tools.BetterTTS(`哇！小夜学会啦！对我说：${ask} 试试吧，小夜有可能会回复 ${ans} 噢`)
                .then((resolve) => {
                  let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                  voiceplayer.play(tts_file, function (err) {
                    if (err) throw err;
                  });
                })
                .catch((reject) => {
                  console.log(`TTS错误：${reject}`);
                });
              return 0;
            } else {
                this.this.tools.ChatProcess(resolve.text)
                .then((resolve) => {
                  let reply = resolve;
                  console.log(`小夜说：${reply}`);
                  fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, `${reply}`);
                  this.this.tools.BetterTTS(reply)
                    .then((resolve) => {
                      let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                      voiceplayer.play(tts_file, function (err) {
                        if (err) throw err;
                      });
                    })
                    .catch((reject) => {
                      console.log(`TTS错误：${reject}`);
                    });
                })
                .catch((reject) => {
                  //如果没有匹配到回复，那就随机回复balabala废话
                  console.log(`${reject}，弹幕没有匹配`);
                  this.this.tools.GetBalabalaList()
                    .then((resolve) => {
                      let random_balabala = resolve[Math.floor(Math.random() * resolve.length)].balabala;
                      fs.writeFileSync(`./static/xiaoye/live_lastst_reply.txt`, random_balabala);
                      this.this.tools.BetterTTS(random_balabala)
                        .then((resolve) => {
                          let tts_file = `${process.cwd()}\\static${resolve.file.replace("/", "\\")}`;
                          voiceplayer.play(tts_file, function (err) {
                            if (err) throw err;
                          });
                        })
                        .catch((reject) => {
                          console.log(`TTS错误：${reject}`);
                        });
                      console.log(`${reject}，qqBot小夜觉得${random_balabala}`);
                    })
                    .catch((reject) => {
                      console.log(`小夜试图balabala但出错了：${reject}`);
                    });
                });
            }
          }
        })
        .catch((reject) => {
          console.log(reject.error);
        });
    }
}

export {Core};
