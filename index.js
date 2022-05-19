"use strict";
/**
 * Author: Giftina: https://github.com/Giftia/
 * 沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)，一个简单的机器人框架，支持接入哔哩哔哩直播，具备完全功能的web网页控制台。
 */

/**
 * 启动时中文路径检查
 */
const ChildProcess = require("child_process");
const _cn_reg = new RegExp("[\u4e00-\u9fa5]");
if (_cn_reg.test(process.cwd())) {
  const warnMessage = `因为Unicode的兼容性问题，程序所在路劲不能有汉字日语韩语表情包之类的奇奇怪怪的字符，请使用常规的ASCII字符!如有疑问，请加QQ群 120243247 咨询。当前路径含有不对劲的字符: ${process.cwd()}`;
  console.log(warnMessage);
  ChildProcess.exec(`msg %username% ${warnMessage}`);
}

/**
 * 声明依赖与配置
 */
const versionNumber = "v3.5.1"; //版本号
const version = `ChatDACS ${versionNumber}`; //系统版本，会显示在web端标题栏
const utils = require("./plugins/system/utils.js"); //载入系统通用模块
const compression = require("compression"); //用于gzip压缩
const express = require("express"); //轻巧的express框架
const app = require("express")();
app.use(compression()); //对express所有路由启用gzip
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
const multer = require("multer"); //用于文件上传
const upload = multer({ dest: "./static/uploads/" }); //用户上传目录
const cookie = require("cookie");
const http = require("http").Server(app);
const io = require("socket.io")(http);
const request = require("request");
const axios = require("axios").default;
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db.db"); //数据库位置，默认与index.js同目录
const colors = require("colors"); //Console日志染色颜色配置
colors.setTheme({
  alert: "inverse",
  on: "brightMagenta",
  off: "gray",
  warn: "brightYellow",
  error: "brightRed",
  log: "brightBlue",
});
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas"); //用于绘制文字图像，迫害p图
require.all = require("require.all"); //插件加载器
const { KeepLiveTCP } = require("bilibili-live-ws");
const yaml = require("yaml"); //使用yaml解析配置文件
const voicePlayer = require("play-sound")({
  player: path.join(process.cwd(), "plugins", "cmdmp3win.exe"),
}); //mp3静默播放工具，用于直播时播放语音
const ipTranslator = require("lib-qqwry")(true); //lib-qqwry是一个高效纯真IP库(qqwry.dat)引擎，传参 true 是将IP库文件读入内存中以提升效率

/**
 * 中文分词器
 */
const jieba = require("nodejieba");
jieba.load({
  dict: path.join(process.cwd(), "config", "jieba.dict.utf8"),
  hmmDict: path.join(process.cwd(), "config", "hmm_model.utf8"),
  userDict: path.join(process.cwd(), "config", "userDict.txt"), //加载自定义分词库
  idfDict: path.join(process.cwd(), "config", "idf.utf8"),
  stopWordDict: path.join(process.cwd(), "config", "stopWordDict.txt"), //加载分词库黑名单
});

/**
 * 配置输入器
 */
const readline = require("readline");
const readLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * 本地日志配置
 */
const winston = require("winston");
const { format, transports } = require("winston");
const { printf } = format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `[${level}] [${timestamp}]: ${message}`;
});

const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  colors: {
    error: "red",
    warn: "orange",
    info: "yellow",
    http: "green",
    verbose: "blue",
    debug: "gray",
    silly: "gray",
  },
};
winston.addColors(logLevels.colors);

const logger = winston.createLogger({
  levels: logLevels.levels,
  format: winston.format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    format.errors({ stack: true }),
    format.json(),
  ),
  transports: [
    new transports.Console({
      format: winston.format.combine(winston.format.colorize(), myFormat),
    }),
    new transports.Http({
      level: "warn",
    }),
    new winston.transports.File({
      filename: "error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "combined.log",
    }),
  ],
});

/**
 * 错误捕获
 */
process.on("uncaughtException", (err) => {
  io.emit("system", `@未捕获的异常: ${err}`);
  logger.error(err);
});

process.on("unhandledRejection", (err) => {
  io.emit("system", `@未捕获的promise异常: ${err}`);
  logger.error(err);
});

/**
 * 系统配置和开关，以及固定变量
 */
const Constants = require("./config/constants.js");
const help =
  "主人你好，我是小夜。欢迎使用沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)。在这里，你可以与经过 2w+用户调教养成的人工智能机器人小夜实时聊天，它有着令人激动的、实用的在线涩图功能，还可以和在线的其他人分享你的图片、视频与文件。现在就试试使用在聊天框下方的便捷功能栏吧，功能栏往右拖动还有更多功能。";
var boomTimer; //60s计时器
var onlineUsers = 0, //预定义
  QQBOT_QQ,
  QQBOT_ADMIN_LIST,
  BILIBILI_LIVE_ROOM_ID,
  CHAT_SWITCH,
  CONNECT_GO_CQHTTP_SWITCH,
  CONNECT_BILIBILI_LIVE_SWITCH,
  WEB_PORT,
  GO_CQHTTP_SERVICE_ANTI_POST_API,
  GO_CQHTTP_SERVICE_API_URL,
  CHAT_JIEBA_LIMIT,
  QQBOT_REPLY_PROBABILITY,
  QQBOT_FUDU_PROBABILITY,
  QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH,
  QQBOT_MAX_MINE_AT_MOST,
  xiaoye_ated,
  QQBOT_PRIVATE_CHAT_SWITCH,
  AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH,
  c1c_count = 0;

/**
 * 声明结束，开始初始化
 */
logger.info("开始加载插件……".log);
const plugins = require.all({
  dir: path.join(process.cwd(), "plugins"),
  match: /.*\.js/,
  require: /\.(js)$/,
  recursive: false,
  encoding: "utf-8",
  resolve: function (plugins) {
    plugins.all.load();
  },
});
console.log(plugins);
logger.info("插件加载完毕√\n".log);

InitConfig();

/**
 * 下面是三大核心功能: web端、qq端、直播间端
 */

/**
 * web端，前端使用layim框架
 */
io.on("connection", (socket) => {
  socket.emit("getCookie");
  const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
  if (CID === undefined) {
    socket.emit("getCookie");
    return 0;
  }

  //获取地理位置
  const ip = socket.handshake.headers["x-forwarded-for"] ? socket.handshake.headers["x-forwarded-for"]?.split("::ffff:")[1] : socket.handshake.address.split("::ffff:")[1];
  const location = ipTranslator.searchIP(ip).Country;

  socket.emit("version", version);
  io.emit("onlineUsers", ++onlineUsers);

  //开始获取用户信息并处理
  utils
    .GetUserData(CID)
    .then(([nickname, loginTimes, lastLoginTime]) => {
      socket.username = `${nickname}[来自${location}]`;

      logger.info(
        `web端用户 ${nickname}(${CID}) 已经连接，登录次数 ${loginTimes}，上次登录时间 ${lastLoginTime}`.log,
      );

      //更新登录次数
      db.run(
        `UPDATE users SET logintimes = logintimes + 1 WHERE CID ='${CID}'`,
      );

      //更新最后登陆时间
      db.run(
        `UPDATE users SET lastlogintime = '${utils.GetTimes().YearMonthDay}${utils.GetTimes().Clock}' WHERE CID ='${CID}'`,
      );

      io.emit(
        "system",
        `@欢迎回来，${socket.username}(${CID}) 。这是你第${loginTimes}次访问。上次访问时间: ${lastLoginTime}`,
      );
    })
    //若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作:
    .catch(async (_reject) => {
      const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
      const randomNickname = await utils.RandomNickname();
      socket.username = `${randomNickname}[来自${location}]`;

      logger.info(
        `web端用户 ${socket.username}(${CID}) 第一次访问，新增该用户`.log,
      );

      db.run(
        `INSERT INTO users VALUES('${randomNickname}', '${CID}', '2', '${utils.GetTimes().YearMonthDay}${utils.GetTimes().Clock}')`,
      );

      io.emit(
        "system",
        `@新用户 ${socket.username}(${CID}) 已连接。小夜帮你取了一个随机昵称: ${socket.username}，请前往 更多-设置 来更改昵称`,
      );
      socket.emit("message", {
        CID: "0",
        msg: help,
      });
    });

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("onlineUsers", onlineUsers);
    logger.info(
      `web端用户 ${socket.username}(${CID}) 已经断开连接`.log,
    );
    io.emit("system", "@用户 " + socket.username + " 已断开连接");
  });

  socket.on("typing", () => {
    io.emit("typing", `${socket.username} 正在输入...`);
  });

  socket.on("typingOver", () => {
    io.emit("typing", "");
  });

  //用户设置
  socket.on("getSettings", () => {
    const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
    socket.emit("settings", { CID: CID, name: socket.username });
  });

  //web端最核心代码，聊天处理
  socket.on("message", async (msgIn) => {
    const CID =
      cookie.parse(socket.request.headers.cookie || "").ChatdacsID ?? 0;
    const msg = msgIn.msg.replace(/['<>]/g, ""); //防爆
    logger.info(
      `web端用户 ${socket.username}(${CID}) 发送了消息: ${msg}`.warn,
    );
    db.run(
      `INSERT INTO messages VALUES('${utils.GetTimes().YearMonthDay}', '${utils.GetTimes().Clock}}', '${CID}', '${msg}')`,
    );
    io.emit("message", { CID: CID, name: socket.username, msg: msg }); //用户广播

    //web端插件应答器
    const pluginsReply = await ProcessExecute(msg, CID, socket.username) ?? "";
    if (pluginsReply) {
      const replyToWeb = utils.PluginAnswerToWebStyle(pluginsReply);
      const answerMessage = {
        CID: "0",
        msg: replyToWeb,
      };
      io.emit("message", answerMessage);
    }

    if (CHAT_SWITCH) {
      //交给聊天函数处理
      const chatReply = await ChatProcess(msg);
      if (chatReply) {
        io.emit("message", { CID: "0", msg: chatReply });
      }
    }
  });
});

/**
 * 小夜核心代码，对接go-cqhttp
 */
function start_qqbot() {
  app.post(GO_CQHTTP_SERVICE_ANTI_POST_API, (req, res) => {
    //响应心跳
    if (req.body.meta_event_type === "heartbeat") {
      res.send();
      return 0;
    }

    //被禁言1小时以上自动退群
    if (req.body.sub_type == "ban" && req.body.user_id == (req.body.message?.self_id ?? QQBOT_QQ)) {
      if (req.body.duration >= 3599) {
        request(
          `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_leave?group_id=${req.body.group_id}`,
          function (error, _response, _body) {
            if (!error) {
              logger.info(
                `小夜在群 ${req.body.group_id} 被禁言超过1小时，自动退群`.error,
              );
              io.emit(
                "system",
                `@小夜在群 ${req.body.group_id} 被禁言超过1小时，自动退群`,
              );
            }
          },
        );
      } else {
        //被禁言改名
        request(
          `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id}&user_id=${req.body.message?.self_id ?? QQBOT_QQ}&card=${encodeURI("你妈的，为什么 禁言我")}`,
          function (error, _response, _body) {
            if (!error) {
              logger.info(
                `小夜在群 ${req.body.group_id} 被禁言，自动改名为 你妈的，为什么 禁言我`.log,
              );
            }
          },
        );
      }
      res.send();
      return 0;
    }

    //添加好友请求
    if (req.body.request_type == "friend") {
      logger.info(
        `小夜收到好友请求，请求人：${req.body.user_id}，请求内容：${req.body.comment}，按配置自动处理`.log,
      );
      res.send({ approve: AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH });
      return 0;
    }

    //加群请求发送给管理员
    if (req.body.request_type == "group" && req.body.sub_type == "invite") {
      const msg = `用户 ${req.body.user_id} 邀请小夜加入群 ${req.body.group_id}，批准请发送
/批准 ${req.body.flag}`;
      logger.info(
        `小夜收到加群请求，请求人：${req.body.user_id}，请求内容：${req.body.comment}，发送小夜管理员审核`.log,
      );
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${QQBOT_ADMIN_LIST[0]}&message=${encodeURI(msg)}`,
      );
      //发送给邀请者批准提醒
      const inviteReplyContent = `你好呀，感谢你的使用，邀请小夜加入你的群后，请联系这只小夜的主人 ${QQBOT_ADMIN_LIST[0]} 来批准入群邀请噢`;
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${req.body.user_id}&message=${encodeURI(inviteReplyContent)}`,
      );
      res.send({});
      return 0;
    }

    //管理员批准群邀请
    if (
      req.body.message_type == "private" &&
      req.body.user_id == QQBOT_ADMIN_LIST[0] &&
      Constants.approve_group_invite_reg.test(req.body.message)
    ) {
      const flag = req.body.message.match(Constants.approve_group_invite_reg)[1];
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_add_request?flag=${encodeURI(
          flag,
        )}&type=invite&approve=1`,
        function (error, _response, _body) {
          if (!error) {
            logger.info(
              `管理员批准了群邀请请求 ${flag}`.log,
            );
            res.send({ reply: "已批准" });
          }
        },
      );
      return 0;
    }

    //————————————————————下面是功能————————————————————
    let notify;
    switch (req.body.sub_type) {
      case "friend":
      case "group":
        notify = `小夜收到好友 ${req.body.user_id} (${req.body.sender.nickname}) 发来的消息: ${req.body.message}`;
        break;
      case "normal":
        notify = `小夜收到群 ${req.body.group_id} 的 ${req.body.user_id} (${req.body.sender.nickname}) 发来的消息: ${req.body.message}`;
        break;
      case "approve":
        notify = `${req.body.user_id} 加入了群 ${req.body.group_id}`.log;
        break;
      case "ban":
        notify =
          `${req.body.user_id} 在群 ${req.body.group_id} 被禁言 ${req.body.duration} 秒`.error;
        break;
      case "poke":
        notify = `${req.body.user_id} 戳了一下 ${req.body.target_id}`.log;
        break;
      default:
        res.send();
        return 0;
    }
    logger.info(notify);
    io.emit("system", `@${notify}`);

    //转发图片到web端，按需启用
    if (QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH) {
      if (Constants.isImage_reg.test(req.body.message)) {
        const url = Constants.img_url_reg.exec(req.body.message);
        utils.SaveQQimg(url)
          .then((resolve) => {
            io.emit("qqImage", resolve);
          })
          .catch((reject) => {
            logger.error(`转发图片失败：${reject}`.error);
          });
        res.send();
      }
    }

    //转发视频到web端
    if (Constants.isVideo_reg.test(req.body.message)) {
      const url = Constants.video_url_reg.exec(req.body.message)[0];
      io.emit("qqVideo", { file: url, filename: "qq视频" });
      res.send();
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
      if (
        Constants.open_ju_reg.test(req.body.message) &&
        Constants.has_qq_reg.test(req.body.message)
      ) {
        const who = Constants.has_qq_reg.exec(req.body.message)[1];
        if (Constants.is_qq_reg.test(who)) {
          //如果是自己要被张菊，那么张菊
          if ((req.body.message?.self_id ?? QQBOT_QQ) == who) {
            request(
              `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${req.body.group_id}&user_id=${req.body.user_id}`,
              function (_error, _response, body) {
                body = JSON.parse(body);
                if (body.data.role === "owner" || body.data.role === "admin") {
                  logger.info(
                    `群 ${req.body.group_id} 启用了小夜服务`.log
                  );
                  db.run(
                    `UPDATE qq_group SET talk_enabled = '1' WHERE group_id ='${req.body.group_id}'`,
                  );
                  res.send({
                    reply:
                      "小夜的菊花被管理员张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊",
                  });
                  return 0;
                  //不是管理，再看看是不是qqBot管理员
                } else {
                  for (let i in QQBOT_ADMIN_LIST) {
                    if (req.body.user_id == QQBOT_ADMIN_LIST[i]) {
                      logger.info(`群 ${req.body.group_id} 启用了小夜服务`.log);
                      db.run(
                        `UPDATE qq_group SET talk_enabled = '1' WHERE group_id ='${req.body.group_id}'`,
                      );
                      res.send({
                        reply:
                          "小夜的菊花被主人张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊",
                      });
                      return 0;
                    }
                  }
                  //看来真不是管理员呢
                  res.send({
                    reply:
                      "你不是群管理呢，小夜不张，张菊需要让管理员来帮忙张噢",
                  });
                  return 0;
                }
              },
            );
            return 0;
            //不是这只小夜被张菊的话，嘲讽那只小夜
          } else {
            res.send({ reply: `[CQ:at,qq=${who}] 说你呢，快张菊!` });
            return 0;
          }
        }
      }
      //在收到群消息的时候搜索群是否存在于qq_group表，判断聊天开关
      else {
        db.all(
          `SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`,
          async (err, sql) => {
            if (!err && sql[0]) {
              //群存在于qq_group表则判断聊天开关 talk_enabled，闭嘴了就无视掉所有消息
              if (sql[0].talk_enabled === 0) {
                logger.info(
                  `群 ${req.body.group_id} 服务已停用，无视群所有消息`.error,
                );
                res.send();
                return 0;
              } else {
                //服务启用了，允许进入后续的指令系统

                /**
                 * 群指令系统
                 */

                //地雷爆炸判断，先判断这条消息是否引爆，再从数据库取来群地雷数组，引爆后删除地雷，原先的地雷是用随机数生成被炸前最大回复作为引信，现在换一种思路，用更简单的随机数引爆
                let boom_flag = Math.floor(Math.random() * 100); //踩中flag
                //如果判定踩中，检查该群是否有雷
                if (boom_flag < 10) {
                  db.all(
                    `SELECT * FROM mine WHERE group_id = '${req.body.group_id}'`,
                    (err, sql) => {
                      if (!err && sql[0]) {
                        //有则判断是否哑雷
                        let unboom = Math.floor(Math.random() * 100); //是否哑雷
                        if (unboom < 30) {
                          //是哑雷，直接删除地雷
                          logger.info(
                            `${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被踩中，但这是一颗哑雷`.log,
                          );
                          db.run(
                            `DELETE FROM mine WHERE mine_id = '${sql[0].mine_id}' `,
                          );
                          res.send({
                            reply: `[CQ:at,qq=${req.body.user_id}]恭喜你躲过一劫，[CQ:at,qq=${sql[0].placed_qq}]埋的地雷掺了沙子，是哑雷，炸了，但没有完全炸`,
                          });
                          //成功引爆并删除地雷
                        } else {
                          let holly_hand_grenade = Math.floor(
                            Math.random() * 1000,
                          ); //丢一个骰子，判断地雷是否变成神圣地雷
                          if (holly_hand_grenade < 10) {
                            //运营方暗调了出率，10‰几率变成神圣地雷
                            request(
                              `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban?group_id=${req.body.group_id}&enable=1`,
                              function (error, _response, _body) {
                                if (!error) {
                                  logger.info(
                                    `${sql[0].placed_qq} 在群 ${sql[0].group_id} 触发了神圣地雷`.error,
                                  );
                                  res.send({
                                    reply: "噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣地雷!我是说，这是一颗毁天灭地的神圣地雷啊!哈利路亚!麻烦管理员解除一下",
                                  });
                                }
                              },
                            );
                            return 0;
                          } else {
                            let boom_time = Math.floor(Math.random() * 60 * 2); //造成伤害时间
                            logger.info(
                              `${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被引爆，伤害时间${boom_time}秒`.log,
                            );
                            db.run(
                              `DELETE FROM mine WHERE mine_id = '${sql[0].mine_id}' `,
                            );
                            res.send({
                              reply: `[CQ:at,qq=${req.body.user_id}]恭喜你，被[CQ:at,qq=${sql[0].placed_qq}]所埋地雷炸伤，休养生息${boom_time}秒!`,
                              ban: 1,
                              ban_duration: boom_time,
                            });
                            return 0;
                          }
                        }
                      }
                    },
                  );
                  return 0;
                }

                //服务停用开关
                //指定小夜的话
                if (
                  Constants.close_ju_reg.test(req.body.message) &&
                  Constants.has_qq_reg.test(req.body.message)
                ) {
                  const who = Constants.has_qq_reg.exec(req.body.message)[1];
                  if (Constants.is_qq_reg.test(who)) {
                    //如果是自己要被闭菊，那么闭菊
                    if ((req.body.message?.self_id ?? QQBOT_QQ) == who) {
                      logger.error(
                        `群 ${req.body.group_id} 停止了小夜服务`.error,
                      );
                      db.run(
                        `UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='${req.body.group_id}'`,
                      );
                      res.send({
                        reply: `小夜的菊花闭上了，这只小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${req.body.message?.self_id ?? QQBOT_QQ}]`,
                      });
                      return 0;
                      //不是这只小夜被闭菊的话，嘲讽那只小夜
                    } else {
                      res.send({ reply: `[CQ:at,qq=${who}] 说你呢，快闭菊!` });
                      return 0;
                    }
                  }
                  //没指定小夜
                } else if (req.body.message === "闭菊") {
                  logger.error(
                    `群 ${req.body.group_id} 停止了小夜服务`.error
                  );
                  db.run(
                    `UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='${req.body.group_id}'`,
                  );
                  res.send({
                    reply: `小夜的菊花闭上了，小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${req.body.message?.self_id ?? QQBOT_QQ}]`,
                  });
                  return 0;
                }

                //qq端插件应答器
                const pluginsReply = await ProcessExecute(
                  req.body.message,
                  req.body.user_id,
                  req.body?.sender?.nickname,
                  req.body.group_id,
                  "", //群名暂时还没加
                  {
                    selfId: req.body.message?.self_id,
                    targetId: req.body.sub_type == "poke" ? req.body.target_id : null,
                  }
                );
                if (pluginsReply != "") {
                  const replyToQQ = utils.PluginAnswerToGoCqhttpStyle(pluginsReply);
                  request(
                    `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(
                      replyToQQ,
                    )}`);
                }

                //戳一戳
                if (
                  req.body.sub_type === "poke" &&
                  req.body.target_id == (req.body?.self_id ?? QQBOT_QQ)
                ) {
                  logger.info("小夜被戳了".log);
                  c1c_count++;

                  if (c1c_count > 2) {
                    c1c_count = 0;
                    const final = "哎呀戳坏了，不理你了 ٩(๑`^`๑)۶";
                    request(
                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                      }&message=${encodeURI(final)}`,
                      function (error, _response, _body) {
                        if (!error) {
                          request(
                            `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=10`,
                            function (error, _response, _body) {
                              if (!error) {
                                logger.info(
                                  `小夜戳坏了，${req.body.user_id} 被禁言10s`.error,
                                );
                              }
                            },
                          );
                        }
                      },
                    );
                  } else {
                    const final = "请不要戳小小夜 >_<";
                    request(
                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                      }&message=${encodeURI(final)}`);
                  }
                  return 0;
                }

                //嘴臭，小夜的回复转化为语音
                if (Constants.come_yap_reg.test(req.body.message)) {
                  let message = req.body.message.replace("/嘴臭 ", "");
                  message = message.replace("/嘴臭", "");
                  console.log(`有人对线说 ${message}，小夜要嘴臭了`.log);
                  io.emit(
                    "system message",
                    `@有人对线说 ${message}，小夜要嘴臭了`,
                  );
                  ChatProcess(message)
                    .then((resolve) => {
                      let reply = resolve;
                      plugins.tts(reply)
                        .then((resolve) => {
                          let tts_file = `[CQ:record,file=http://127.0.0.1:${WEB_PORT}${resolve.file},url=http://127.0.0.1:${WEB_PORT}${resolve.file}]`;
                          res.send({ reply: tts_file });
                        })
                        .catch((reject) => {
                          console.log(`TTS错误: ${reject}`.error);
                        });
                    })
                    .catch((reject) => {
                      //如果没有匹配到回复，那就回复一句默认语音
                      console.log(`${reject}，语音没有回复`.warn);
                      plugins.tts()
                        .then((resolve) => {
                          let tts_file = `[CQ:record,file=http://127.0.0.1:${WEB_PORT}${resolve.file},url=http://127.0.0.1:${WEB_PORT}${resolve.file}]`;
                          res.send({ reply: tts_file });
                        })
                        .catch((reject) => {
                          console.log(`TTS错误: ${reject}`.error);
                        });
                    });
                  return 0;
                }

                //人生重开模拟器，数据来自 https://github.com/VickScarlet/lifeRestart
                if (Constants.life_restart_reg.test(req.body.message)) {
                  console.log(
                    `用户 ${req.body.sender.user_id} 开始人生重开`.log,
                  );
                  //先抽选天赋
                  fs.readFile(
                    path.join(process.cwd(), "config", "talents.json"),
                    "utf-8",
                    function (err, data) {
                      if (!err) {
                        let talents = JSON.parse(data);
                        let who = req.body.sender.user_id;
                        Talents10x(talents).then((resolve) => {
                          console.log(
                            `用户 ${who} 抽选10个随机天赋: ${resolve.roll_talents}`
                              .log,
                          );
                          //天赋列表写入数据库
                          db.run(
                            `INSERT INTO qq_users(qq_id,talents_list) VALUES('${who}', '${resolve.talents_list}') ON CONFLICT(qq_id) DO UPDATE SET talents_list = '${resolve.talents_list}';`,
                          );
                          res.send({
                            reply: `[CQ:at,qq=${who}]天赋10连抽: 
${resolve.roll_talents}

请发送 选择天赋 天赋序号
原作 github.com/VickScarlet/lifeRestart`,
                          });
                        });
                      }
                    },
                  );
                  return 0;
                }

                //选择天赋
                if (Constants.roll_talents_reg.test(req.body.message)) {
                  let talents_id = req.body.message.match(
                    Constants.roll_talents_reg,
                  )[1];
                  talents_id = talents_id.split(" ");

                  //容错，如果有异常值，替换成对应序号
                  for (let i in talents_id) {
                    if (
                      !Constants.only_0to9_reg.test(talents_id[i]) ||
                      !talents_id[i]
                    ) {
                      talents_id.splice(i, 1, i);
                    }
                  }

                  db.all(
                    `SELECT * FROM qq_users WHERE qq_id = '${req.body.sender.user_id}'`,
                    (err, sql) => {
                      if (!err) {
                        let final_talents_id = [],
                          final_talents = [];
                        for (let i in talents_id) {
                          final_talents_id.push(
                            sql[0].talents_list.split(",")[talents_id[i]],
                          );
                        }
                        //选择的天赋存入数据库
                        db.run(
                          `INSERT INTO qq_users(qq_id,talents_list) VALUES('${req.body.sender.user_id}', '${final_talents_id}') ON CONFLICT(qq_id) DO UPDATE SET talents_list = '${final_talents_id}';`,
                        );
                        //挨个去查对应的效果
                        fs.readFile(
                          path.join(
                            process.cwd(),
                            "config",
                            "talents.json",
                          ),
                          "utf-8",
                          function (err, data) {
                            if (!err) {
                              let talents = JSON.parse(data);
                              for (let i in talents_id) {
                                final_talents.push(
                                  talents[final_talents_id[i]].name,
                                );
                              }
                              res.send({
                                reply: `[CQ:at,qq=${req.body.sender.user_id}]已选天赋: 

${final_talents}

请发送 分配属性 属性值，属性值之间以空格隔开`,
                              });
                            }
                          },
                        );
                      }
                    },
                  );
                  return 0;
                }

                //分配初始属性
                if (Constants.set_points_reg.test(req.body.message)) {
                  let points = req.body.message.match(
                    Constants.set_points_reg,
                  )[1];
                  points = points.split(" ");

                  for (let i = 0; i < 4; i++) {
                    if (!points[i]) {
                      points[i] = 0;
                    }
                  }

                  //写入数据库
                  db.run(
                    `INSERT INTO qq_users(qq_id,points) VALUES('${req.body.sender.user_id}', '${points}') ON CONFLICT(qq_id) DO UPDATE SET points = '${points}';`,
                  );

                  res.send({
                    reply: `[CQ:at,qq=${req.body.sender.user_id}]已分配属性点: 

颜值: ${points[0]}
智力: ${points[1]}
体质: ${points[2]}
家境: ${points[3]}

你的新人生开始了: 

0 岁: 体质过低，胎死腹中。
你死了。

请发送 人生总结
`,
                  });
                  return 0;
                }

                //人生总结
                if (req.body.message == "人生总结") {
                  db.all(
                    `SELECT * FROM qq_users WHERE qq_id = '${req.body.sender.user_id}'`,
                    (err, _sql) => {
                      if (!err) {
                        let points = sql[0].points.split(",");
                        res.send({
                          reply: `[CQ:at,qq=${req.body.sender.user_id}]人生总结: 

颜值: ${points[0]} 罕见
智力: ${points[1]} 罕见
体质: ${points[2]} 罕见
家境: ${points[3]} 罕见
快乐: 0 罕见
享年: 0 罕见
总评: ${points[0] + points[1] + points[2] + points[3]} 罕见

感谢您的重开，欢迎您下次光临`,
                        });
                      }
                    },
                  );
                  return 0;
                }

                //伪造转发
                if (Constants.fake_forward_reg.test(req.body.message)) {
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
                    if (Constants.is_qq_reg.test(who)) {
                      console.log(
                        `群 ${req.body.group_id} 的 群员 ${req.body.user_id} 强制迫害 ${who}`
                          .log,
                      );
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
                    `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${req.body.group_id}&user_id=${who}&no_cache=0`,
                    function (error, _response, body) {
                      if (!error) {
                        body = JSON.parse(body);
                        name = body.data.nickname;

                        requestData = {
                          group_id: req.body.group_id,
                          messages: [
                            {
                              type: "node",
                              data: { name: name, uin: who, content: text },
                            },
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
                            url: `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`,
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
                          },
                        );
                      } else {
                        requestData = {
                          group_id: req.body.group_id,
                          messages: [
                            {
                              type: "node",
                              data: { name: name, uin: who, content: text },
                            },
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
                            url: `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_forward_msg`,
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
                          },
                        );
                      }
                    },
                  );
                  return 0;
                }

                //一个手雷
                if (Constants.hand_grenade_reg.test(req.body.message)) {
                  let who;
                  let holly_hand_grenade = Math.floor(Math.random() * 1000); //丢一个骰子，判断手雷是否变成神圣手雷
                  let success_flag = Math.floor(Math.random() * 100); //丢一个骰子，判断手雷是否成功丢出
                  let boom_time = Math.floor(Math.random() * 60 * 2); //造成伤害时间
                  if (holly_hand_grenade < 10) {
                    //运营方暗调了出率，10‰几率变成神圣手雷
                    request(
                      `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban?group_id=${req.body.group_id}&enable=1`,
                      function (error, _response, _body) {
                        if (!error) {
                          console.log(
                            `触发了神圣手雷，群 ${req.body.group_id} 被全体禁言`
                              .error,
                          );
                          res.send({
                            reply: "噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣手雷!我是说，这是一颗毁天灭地的神圣手雷啊!哈利路亚!麻烦管理员解除一下",
                          });
                        }
                      },
                    );
                    return 0;
                  } else {
                    if (req.body.message === "一个手雷") {
                      who = req.body.user_id; //如果没有要求炸谁，那就是炸自己
                      console.log(
                        `群 ${req.body.group_id} 的群员 ${req.body.user_id} 朝自己丢出一颗手雷`
                          .log,
                      );
                    } else {
                      who = req.body.message;
                      who = who.replace("一个手雷 ", "");
                      who = who.replace("一个手雷", "");
                      who = who.replace("[CQ:at,qq=", "");
                      who = who.replace("]", "");
                      who = who.trim();
                      if (Constants.is_qq_reg.test(who)) {
                        console.log(
                          `群 ${req.body.group_id} 的 群员 ${req.body.user_id} 尝试向 ${who} 丢出一颗手雷`
                            .log,
                        );
                      } else {
                        //目标不是qq号
                        res.send({
                          reply: `你想丢给谁手雷啊，目标不可以是${who}，不要乱丢`,
                        });
                        return 0;
                      }
                    }
                    if (success_flag < 50 || who === req.body.user_id) {
                      //50%几率被自己炸伤
                      console.log(
                        `群 ${req.body.group_id} 的 群员 ${req.body.user_id} 的手雷炸到了自己`
                          .log,
                      );
                      res.send({
                        reply: `[CQ:at,qq=${req.body.user_id}] 小手一滑，被自己丢出的手雷炸伤，造成了${boom_time}秒的伤害，苍天有轮回，害人终害己，祝你下次好运`,
                        ban: 1,
                        ban_duration: boom_time,
                      });
                    } else {
                      //成功丢出手雷
                      request(
                        `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${who}&duration=${boom_time}`,
                        function (error, _response, _body) {
                          if (!error) {
                            console.log(
                              `群 ${req.body.group_id} 的 群员 ${req.body.user_id} 的手雷炸到了 ${who}`
                                .log,
                            );
                            res.send({
                              reply: `恭喜[CQ:at,qq=${who}]被[CQ:at,qq=${req.body.user_id}]丢出的手雷炸伤，造成了${boom_time}秒的伤害，祝你下次好运`,
                            });
                          }
                        },
                      );
                    }
                  }
                  return 0;
                }

                //埋地雷
                if (Constants.mine_reg.test(req.body.message)) {
                  //获取该群是否已经达到最大共存地雷数
                  db.all(
                    `SELECT * FROM mine WHERE group_id = '${req.body.group_id}'`,
                    (err, sql) => {
                      if (!err) {
                        let length = 0;
                        try {
                          length = sql.length;
                        } catch (err) {
                          console.log("地雷为空".log);
                        }
                        if (length < QQBOT_MAX_MINE_AT_MOST) {
                          //地雷还没满，先获取自增ID最新值sql.seq，随后mine表增加群地雷
                          db.all(
                            "Select seq From sqlite_sequence Where name = 'mine'",
                            (err, sql) => {
                              if (!err && sql[0]) {
                                db.run(
                                  `INSERT INTO mine VALUES('${sql[0].seq + 1
                                  }', '${req.body.group_id}', '${req.body.user_id
                                  }')`,
                                );
                                console.log(
                                  `${req.body.user_id} 在群 ${req.body.group_id} 埋了一颗地雷`
                                    .log,
                                );
                                res.send({
                                  reply: `大伙注意啦![CQ:at,qq=${req.body.user_id}]埋雷干坏事啦!`,
                                });
                              } else {
                                console.log(
                                  `埋地雷出错了: ${err}，${sql}`.error,
                                );
                              }
                            },
                          );
                        } else {
                          console.log(`群 ${req.body.group_id} 的地雷满了`.log);
                          res.send({
                            reply: `[CQ:at,qq=${req.body.user_id}] 这个群的地雷已经塞满啦，等有幸运群友踩中地雷之后再来埋吧`,
                          });
                          return 0;
                        }
                      } else {
                        console.log(`获取该群地雷出错了: ${err}，${sql}`.error);
                      }
                    },
                  );
                  return 0;
                }

                //踩地雷
                if (Constants.fuck_mine_reg.test(req.body.message)) {
                  //搜索地雷库中现有地雷
                  db.all(
                    `SELECT * FROM mine WHERE group_id = '${req.body.group_id}'`,
                    (err, sql) => {
                      //有雷，直接炸，炸完删地雷
                      if (!err && sql[0]) {
                        let boom_time = Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                        console.log(
                          `${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被排爆，雷已经被删除`
                            .log,
                        );
                        db.run(
                          `DELETE FROM mine WHERE mine_id = '${sql[0].mine_id}' `,
                        );
                        res.send({
                          reply: `[CQ:at,qq=${req.body.user_id}] 踩了一脚地雷，为什么要想不开呢，被[CQ:at,qq=${sql[0].placed_qq}]所埋地雷炸成重伤，休养生息${boom_time}秒!`,
                          ban: 1,
                          ban_duration: boom_time,
                        });
                        return 0;
                      } else {
                        //没有雷
                        res.send({
                          reply: `[CQ:at,qq=${req.body.user_id}] 这个雷区里的雷似乎已经被勇士们排干净了，不如趁现在埋一个吧!`,
                        });
                      }
                    },
                  );
                  return 0;
                }

                //希望的花
                if (Constants.hope_flower_reg.test(req.body.message)) {
                  let who;
                  let boom_time = Math.floor(Math.random() * 30); //造成0-30伤害时间
                  if (req.body.message === "希望的花") {
                    console.log(
                      `群 ${req.body.group_id} 的群员 ${req.body.user_id} 朝自己丢出一朵希望的花`
                        .log,
                    );
                    res.send({
                      reply: "团长，你在做什么啊!团长!希望的花，不要乱丢啊啊啊啊",
                    });
                    return 0;
                  } else {
                    who = req.body.message;
                    who = who.replace("希望的花 ", "");
                    who = who.replace("希望的花", "");
                    who = who.replace("[CQ:at,qq=", "");
                    who = who.replace("]", "");
                    who = who.trim();
                    if (Constants.is_qq_reg.test(who)) {
                      console.log(
                        `群 ${req.body.group_id} 的 群员 ${req.body.user_id} 向 ${who} 丢出一朵希望的花`
                          .log,
                      );
                    } else {
                      //目标不是qq号
                      res.send({
                        reply: `团长，你在做什么啊!团长!希望的花目标不可以是${who}，不要乱丢啊啊啊啊`,
                      });
                      return 0;
                    }
                  }

                  //先救活目标
                  request(
                    `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${who}&duration=0`,
                    function (error, _response, _body) {
                      if (!error) {
                        console.log(
                          `群 ${req.body.group_id} 的 群员 ${req.body.user_id} 救活了 ${who}`
                            .log,
                        );
                        res.send({
                          reply: `团长，团长你在做什么啊团长，团长!为什么要救他啊，哼，呃，啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊!!!团长救下了[CQ:at,qq=${who}]，但自己被炸飞了，休养生息${boom_time}秒!不要停下来啊!`,
                        });
                      }
                    },
                  );

                  //再禁言团长
                  request(
                    `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=${boom_time}`,
                    function (error, _response, _body) {
                      if (!error) {
                        console.log(
                          `${req.body.user_id} 自己被炸伤${boom_time}秒`.log,
                        );
                      }
                    },
                  );
                  return 0;
                }

                //击鼓传雷
                if (Constants.loop_bomb_reg.test(req.body.message)) {
                  //先检查群有没有开始游戏
                  db.all(
                    `SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`,
                    (err, sql) => {
                      if (!err && sql[0]) {
                        //判断游戏开关 loop_bomb_enabled，没有开始的话就开始游戏，如果游戏已经超时结束了的话重新开始
                        if (
                          sql[0].loop_bomb_enabled === 0 ||
                          60 -
                          process.hrtime([
                            sql[0].loop_bomb_start_time,
                            0,
                          ])[0] <
                          0
                        ) {
                          //游戏开始
                          db.run(
                            `UPDATE qq_group SET loop_bomb_enabled = '1' WHERE group_id ='${req.body.group_id}'`,
                          );
                          let text =
                            "击鼓传雷游戏开始啦，这是一个只有死亡才能结束的游戏，做好准备了吗";
                          request(
                            `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                            }&message=${encodeURI(text)}`,
                            function (error, _response, _body) {
                              if (!error) {
                                console.log(
                                  `群 ${req.body.group_id} 开始了击鼓传雷`.log,
                                );
                                io.emit(
                                  "system",
                                  `@群 ${req.body.group_id} 开始了击鼓传雷`,
                                );
                              }
                            },
                          );

                          //给发起人出题，等待ta回答
                          ECYWenDa()
                            .then((resolve) => {
                              let question = `那么[CQ:at,qq=${req.body.user_id}]请听题: ${resolve.quest} 请告诉小夜: 击鼓传雷 你的答案，时间剩余59秒`;
                              let answer = resolve.result; //把答案、目标人、开始时间存入数据库
                              db.run(
                                `UPDATE qq_group SET loop_bomb_answer = '${answer}', loop_bomb_owner = '${req.body.user_id
                                }' , loop_bomb_start_time = '${process.hrtime()[0]
                                }' WHERE group_id ='${req.body.group_id}'`,
                              );

                              //金手指
                              request(
                                `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id
                                }&user_id=${req.body.user_id}&card=${encodeURI(
                                  answer,
                                )}`,
                                function (error, _response, _body) {
                                  if (!error) {
                                    console.log("击鼓传雷金手指已启动".log);
                                  }
                                },
                              );

                              //丢出问题
                              setTimeout(function () {
                                request(
                                  `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                                  }&message=${encodeURI(question)}`);
                              }, 1000);
                            })
                            .catch((reject) => {
                              res.send({
                                reply: `日忒娘，怎么又出错了: ${reject}`,
                              });
                              console.log(
                                `日忒娘，怎么又出错了: ${reject}`.error,
                              );
                            });

                          //开始倒计时，倒计时结束宣布游戏结束
                          boomTimer = setTimeout(function () {
                            console.log(
                              `群 ${req.body.group_id} 的击鼓传雷到达时间，炸了`
                                .log,
                            );
                            let boom_time =
                              Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                            //获取这个雷现在是谁手上，炸ta
                            db.all(
                              `SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`,
                              (err, sql) => {
                                if (!err && sql[0]) {
                                  request(
                                    `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_owner}&duration=${boom_time}`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        console.log(
                                          `${sql[0].loop_bomb_owner} 在群 ${req.body.group_id} 回答超时，被炸伤${boom_time}秒`
                                            .log,
                                        );

                                        //金手指关闭
                                        request(
                                          `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_owner}&card=`,
                                          function (error, _response, _body) {
                                            if (!error) {
                                              console.log(
                                                "击鼓传雷金手指已恢复".log,
                                              );
                                            }
                                          },
                                        );

                                        let end = `时间到了，pia，雷在[CQ:at,qq=${sql[0].loop_bomb_owner}]手上炸了，你被炸成重伤了，休养生息${boom_time}秒!游戏结束!下次加油噢，那么答案公布: ${sql[0].loop_bomb_answer}`;
                                        request(
                                          `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                                          }&message=${encodeURI(end)}`,
                                          function (error, _response, _body) {
                                            if (!error) {
                                              io.emit(
                                                "system",
                                                `@${sql[0].loop_bomb_owner} 在群 ${req.body.group_id} 回答超时，被炸伤${boom_time}秒`,
                                              );
                                            }
                                          },
                                        );
                                        //游戏结束，清空数据
                                        db.run(
                                          `UPDATE qq_group SET loop_bomb_enabled = '0', loop_bomb_answer = '', loop_bomb_owner = '' , loop_bomb_start_time = '' WHERE group_id ='${req.body.group_id}'`,
                                        );
                                        return 0;
                                      }
                                    },
                                  );
                                  io.emit(
                                    "system",
                                    `@群 ${req.body.group_id} 的击鼓传雷到达时间，炸了`,
                                  );
                                }
                              },
                            );
                          }, 1000 * 60);

                          //已经开始游戏了，判断答案对不对
                        } else {
                          let your_answer = req.body.message;
                          your_answer = your_answer.replace("击鼓传雷 ", "");
                          your_answer = your_answer.replace("击鼓传雷", "");
                          your_answer = your_answer.trim();
                          //从数据库里取答案判断
                          db.all(
                            `SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`,
                            (err, sql) => {
                              if (!err && sql[0]) {
                                //判断答案 loop_bomb_answer
                                if (sql[0].loop_bomb_answer == your_answer) {
                                  //答对了
                                  //不是本人回答，是来抢答的
                                  if (
                                    sql[0].loop_bomb_owner != req.body.user_id
                                  ) {
                                    //无论对错都惩罚
                                    let end = `[CQ:at,qq=${req.body.user_id}] 抢答正确!答案确实是 ${sql[0].loop_bomb_answer}!但因为抢答了所以被惩罚了!`;
                                    request(
                                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                                      }&message=${encodeURI(end)}`,
                                      function (error, _response, _body) {
                                        if (!error) {
                                          io.emit(
                                            "system",
                                            `@${req.body.user_id} 在群 ${req.body.group_id} 回答正确`,
                                          );

                                          //金手指关闭
                                          request(
                                            `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_owner}&card=`, //req.body.user_id
                                            function (error, _response, _body) {
                                              if (!error) {
                                                console.log(
                                                  "击鼓传雷金手指已恢复".log,
                                                );
                                              }
                                            },
                                          );

                                          //禁言
                                          request(
                                            `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=60`,
                                            function (error, _response, _body) {
                                              if (!error) {
                                                console.log(
                                                  `抢答了，${req.body.user_id} 被禁言`
                                                    .error,
                                                );
                                              }
                                            },
                                          );
                                        }
                                      },
                                    );
                                  } else {
                                    //回答正确
                                    //金手指关闭
                                    request(
                                      `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id}&user_id=${req.body.user_id}&card=`,
                                      function (error, _response, _body) {
                                        if (!error) {
                                          console.log(
                                            "击鼓传雷金手指已启动".log,
                                          );
                                        }
                                      },
                                    );
                                    let end = `[CQ:at,qq=${req.body.user_id}] 回答正确!答案确实是 ${sql[0].loop_bomb_answer}!`;
                                    request(
                                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                                      }&message=${encodeURI(end)}`,
                                      function (error, _response, _body) {
                                        if (!error) {
                                          io.emit(
                                            "system",
                                            `@${sql[0].loop_bomb_owner} 在群 ${req.body.group_id} 回答正确`,
                                          );
                                        }
                                      },
                                    );
                                  }
                                  //答题成功，然后要把雷传给随机幸运群友，进入下一题
                                  setTimeout(function () {
                                    request(
                                      `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_list?group_id=${req.body.group_id}`,
                                      (err, response, body) => {
                                        body = JSON.parse(body);
                                        if (!err && body.data.length != 0) {
                                          var rand_user_id = Math.floor(
                                            Math.random() * body.data.length,
                                          );
                                          console.log(
                                            `随机选取一个群友: ${body.data[rand_user_id].user_id}`
                                              .log,
                                          );
                                          let rand_user =
                                            body.data[rand_user_id].user_id;

                                          //选完之后开始下一轮游戏，先查询剩余时间，然后给随机幸运群友出题，等待ta回答
                                          db.all(
                                            `SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`,
                                            (err, sql) => {
                                              if (!err && sql[0]) {
                                                ECYWenDa()
                                                  .then((resolve) => {
                                                    let diff =
                                                      60 -
                                                      process.hrtime([
                                                        sql[0]
                                                          .loop_bomb_start_time,
                                                        0,
                                                      ])[0]; //剩余时间
                                                    let question = `抽到了幸运群友[CQ:at,qq=${rand_user}]!请听题: ${resolve.quest} 请告诉小夜:  击鼓传雷 你的答案，时间还剩余${diff}秒`;
                                                    let answer = resolve.result; //把答案、目标人存入数据库
                                                    db.run(
                                                      `UPDATE qq_group SET loop_bomb_answer = '${answer}', loop_bomb_owner = '${rand_user}' WHERE group_id ='${req.body.group_id}'`,
                                                    );

                                                    //金手指
                                                    request(
                                                      `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id
                                                      }&user_id=${rand_user}&card=${encodeURI(
                                                        answer,
                                                      )}`,
                                                      function (
                                                        error,
                                                        _response,
                                                        _body,
                                                      ) {
                                                        if (!error) {
                                                          console.log(
                                                            "击鼓传雷金手指已启动"
                                                              .log,
                                                          );
                                                        }
                                                      },
                                                    );

                                                    request(
                                                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                                                      }&message=${encodeURI(
                                                        question,
                                                      )}`,
                                                      function (
                                                        error,
                                                        _response,
                                                        _body,
                                                      ) {
                                                        if (!error) {
                                                          console.log(
                                                            `群 ${req.body.group_id} 开始了下一轮击鼓传雷`
                                                              .log,
                                                          );
                                                          io.emit(
                                                            "system",
                                                            `@群 ${req.body.group_id} 开始了下一轮击鼓传雷`,
                                                          );
                                                        }
                                                      },
                                                    );
                                                  })
                                                  .catch((reject) => {
                                                    res.send({
                                                      reply: `日忒娘，怎么又出错了: ${reject}`,
                                                    });
                                                    console.log(
                                                      `日忒娘，怎么又出错了: ${reject}`
                                                        .error,
                                                    );
                                                  });
                                              }
                                            },
                                          );
                                        } else {
                                          console.log(
                                            "随机选取一个群友错误。错误原因: " +
                                            JSON.stringify(response.body),
                                          );
                                        }
                                        return 0;
                                      },
                                    );
                                  }, 500);

                                  //答错了
                                } else {
                                  let boom_time =
                                    Math.floor(Math.random() * 60 * 3) + 60; //造成伤害时间
                                  let end = `[CQ:at,qq=${req.body.user_id}] 回答错误，好可惜，你被炸成重伤了，休养生息${boom_time}秒!游戏结束!下次加油噢，那么答案公布: ${sql[0].loop_bomb_answer}`;
                                  console.log(
                                    `${req.body.user_id} 在群 ${req.body.group_id} 回答错误，被炸伤${boom_time}秒`
                                      .log,
                                  );
                                  clearTimeout(boomTimer);

                                  request(
                                    `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                                    }&message=${encodeURI(end)}`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        io.emit(
                                          "system",
                                          `@${sql[0].loop_bomb_owner} 在群 ${req.body.group_id} 回答正确`,
                                        );
                                        //禁言
                                        request(
                                          `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=${boom_time}`,
                                          function (error, _response, _body) {
                                            if (!error) {
                                              console.log(
                                                `抢答了，${req.body.user_id} 被禁言`
                                                  .error,
                                              );
                                            }
                                          },
                                        );
                                      }
                                    },
                                  );

                                  //游戏结束，删掉游戏记录
                                  db.run(
                                    `UPDATE qq_group SET loop_bomb_enabled = '0', loop_bomb_answer = '', loop_bomb_owner = '' , loop_bomb_start_time = '' WHERE group_id ='${req.body.group_id}'`,
                                  );

                                  //金手指关闭
                                  request(
                                    `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id}&user_id=${sql[0].loop_bomb_owner}&card=`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        console.log("击鼓传雷金手指已启动".log);
                                      }
                                    },
                                  );

                                  request(
                                    `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id}&user_id=${req.body.user_id}&card=`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        console.log("击鼓传雷金手指已启动".log);
                                      }
                                    },
                                  );

                                  return 0;
                                }
                              }
                            },
                          );
                        }
                      }
                    },
                  );
                }

                //我有个朋友
                if (Constants.i_have_a_friend_reg.test(req.body.message)) {
                  //指定目标的话
                  if (Constants.has_qq_reg.test(req.body.message)) {
                    var msg_in = req.body.message.split("说")[1];
                    var msg = msg_in.split("[CQ:at,qq=")[0].trim();
                    var who = msg_in.split("[CQ:at,qq=")[1];
                    who = who.replace("]", "").trim();
                    if (Constants.is_qq_reg.test(who)) {
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
                    ctx.fillText(utils.GetTimes().Clock, 280.5, 35.5);

                    ctx.beginPath();
                    ctx.arc(40, 40, 28, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.clip();
                    ctx.drawImage(image, 10, 10, 60, 60);
                    ctx.closePath();

                    let file_local = path.join(
                      process.cwd(),
                      "static",
                      "xiaoye",
                      "images",
                      `${utils.sha1(canvas.toBuffer())}.jpg`,
                    );
                    fs.writeFileSync(file_local, canvas.toBuffer());
                    let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${utils.sha1(
                      canvas.toBuffer(),
                    )}.jpg`;
                    console.log(
                      `我有个朋友合成成功，图片发送: ${file_online}`.log,
                    );
                    res.send({
                      reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                    });
                  });
                  return 0;
                }

                //孤寡
                if (Constants.gugua_reg.test(req.body.message)) {
                  if (req.body.message == "/孤寡") {
                    res.send({
                      reply: "小夜收到了你的孤寡订单，现在就开始孤寡你了噢孤寡~",
                    });
                    Gugua(req.body.user_id);
                    return 0;
                  }
                  let who = req.body.message.replace("/孤寡 ", "");
                  who = who.replace("/孤寡", "");
                  who = who.replace("[CQ:at,qq=", "");
                  who = who.replace("]", "");
                  who = who.trim();
                  if (Constants.is_qq_reg.test(who)) {
                    request(
                      `http://${GO_CQHTTP_SERVICE_API_URL}/get_friend_list`,
                      (err, _response, body) => {
                        body = JSON.parse(body);
                        if (!err && body.data.length != 0) {
                          for (let i in body.data) {
                            if (who == body.data[i].user_id) {
                              res.send({
                                reply: `小夜收到了你的孤寡订单，现在就开始孤寡[CQ:at,qq=${who}]了噢孤寡~`,
                              });
                              request(
                                `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${who}&message=${encodeURI(
                                  `您好，我是孤寡小夜，您的好友 ${req.body.user_id} 给您点了一份孤寡套餐，请查收`,
                                )}`,
                                function (error, _response, _body) {
                                  if (!error) {
                                    console.log(
                                      `群 ${req.body.group_id} 的 群员 ${req.body.user_id} 孤寡了 ${who}`
                                        .log,
                                    );
                                  }
                                },
                              );
                              Gugua(who);
                              return 0;
                            }
                          }
                          res.send({
                            reply: `小夜没有[CQ:at,qq=${who}]的好友，没有办法孤寡ta呢，请先让ta加小夜为好友吧，小夜就在群里给大家孤寡一下吧`,
                          });
                          QunGugua(req.body.group_id);
                        }
                      },
                    );
                  } else {
                    //目标不是qq号
                    res.send({
                      reply: `你想孤寡谁啊，目标不可以是${who}，不要乱孤寡，小心孤寡你一辈子啊`,
                    });
                    return 0;
                  }
                  return 0;
                }

                //测试: 将指定的回复进行操作
                if (Constants.test_reply_reg.test(req.body.message)) {
                  //从 [CQ:reply,id=265936982] [CQ:at,qq=38263547] 复读 消息里获取id

                  let msg_in = req.body.message.split("id=")[1];
                  let id = msg_in.split("] [")[0].trim();
                  id = msg_in.split("][")[0].trim();

                  request(
                    `http://${GO_CQHTTP_SERVICE_API_URL}/get_msg?message_id=${id}`,
                    function (error, _response, body) {
                      body = JSON.parse(body);
                      if (!error) {
                        logger.info(`复读历史消息: ${body.data.message}`.log);
                        res.send({ reply: `${body.data.message}` });
                      }
                    },
                  );
                  return 0;
                }

                //群欢迎
                if (req.body.notice_type === "group_increase") {
                  let final = `[CQ:at,qq=${req.body.user_id}] 你好呀，我是本群RBQ担当小夜!小夜的说明书在这里 https://gitee.com/Giftina/ChatDACS 噢，请问主人是要先吃饭呢，还是先洗澡呢，还是先*我呢~`;
                  request(
                    `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                    }&message=${encodeURI(final)}`,
                    function (error, _response, _body) {
                      if (!error) {
                        logger.info(
                          `${req.body.user_id} 加入了群 ${req.body.group_id}，小夜欢迎了ta`.log,
                        );
                      }
                    },
                  );
                  return 0;
                }

                //管理员功能: 提醒停止服务的群启用小夜
                if (req.body.message === "/admin alert_open") {
                  for (let i in QQBOT_ADMIN_LIST) {
                    if (req.body.user_id == QQBOT_ADMIN_LIST[i]) {
                      logger.info("管理员启动了提醒任务".log);
                      AlertOpen().then((resolve) => {
                        res.send({
                          reply: `管理员启动了提醒任务，开始提醒停止服务的群启用小夜……${resolve}`,
                        });
                      });
                      return 0;
                    }
                  }
                  res.send({
                    reply: "你不是狗管理噢，不能让小夜这样那样的",
                  });
                  return 0;
                }

                //管理员功能: 修改聊天回复率
                if (
                  Constants.change_reply_probability_reg.test(req.body.message)
                ) {
                  for (let i in QQBOT_ADMIN_LIST) {
                    if (req.body.user_id == QQBOT_ADMIN_LIST[i]) {
                      let msg = req.body.message.replace("/回复率 ", "");
                      QQBOT_REPLY_PROBABILITY = msg;
                      res.send({
                        reply: `小夜回复率已修改为${msg}%`,
                      });
                      return 0;
                    }
                  }
                  res.send({
                    reply: "你不是狗管理噢，不能让小夜这样那样的",
                  });
                  return 0;
                }

                //管理员功能: 修改聊天复读率
                if (
                  Constants.change_fudu_probability_reg.test(req.body.message)
                ) {
                  for (let i in QQBOT_ADMIN_LIST) {
                    if (req.body.user_id == QQBOT_ADMIN_LIST[i]) {
                      let msg = req.body.message.replace("/复读率 ", "");
                      QQBOT_FUDU_PROBABILITY = msg;
                      res.send({
                        reply: `小夜复读率已修改为${msg}%`,
                      });
                      return 0;
                    }
                  }
                  res.send({
                    reply: "你不是狗管理噢，不能让小夜这样那样的",
                  });
                  return 0;
                }

                /**
                 *  要新增指令与功能请在这条分割线的上方添加，在下面添加有可能会导致冲突以及不可预料的异常
                 */

                //丢一个骰子，按fudu_probability几率复读
                let fudu_flag = Math.floor(Math.random() * 100);
                if (fudu_flag < QQBOT_FUDU_PROBABILITY) {
                  logger.info(`小夜复读 ${req.body.message}`.log);
                  io.emit(
                    "system",
                    `@小夜复读 ${req.body.message}`,
                  );
                  res.send({ reply: req.body.message });
                  return 0;
                }

                //丢一个骰子，按reply_probability几率回复
                let reply_flag = Math.floor(Math.random() * 100);
                //如果被@了，那么回复几率上升80%
                let at_replaced_msg = req.body.message; //要把[CQ:at,qq=${req.body.message?.self_id ?? QQBOT_QQ}] 去除掉，否则聊天核心会乱成一锅粥
                if (xiaoye_ated.test(req.body.message)) {
                  reply_flag -= 80;
                  at_replaced_msg = req.body.message
                    .replace(`[CQ:at,qq=${req.body.message?.self_id ?? QQBOT_QQ}]`, "")
                    .trim(); //去除@小夜
                }
                //骰子命中，那就让小夜来自动回复
                if (reply_flag < QQBOT_REPLY_PROBABILITY) {
                  ChatProcess(at_replaced_msg)
                    .then((resolve) => {
                      if (
                        resolve.indexOf("[name]") ||
                        resolve.indexOf("&#91;name&#93;")
                      ) {
                        resolve = resolve
                          .toString()
                          .replace("[name]", `[CQ:at,qq=${req.body.user_id}]`); //替换[name]为正确的@
                        resolve = resolve
                          .toString()
                          .replace(
                            "&#91;name&#93;",
                            `[CQ:at,qq=${req.body.user_id}]`,
                          ); //替换[name]为正确的@
                      }
                      logger.info(`小夜回复 ${resolve}`.log);
                      io.emit("system", `@小夜回复: ${resolve}`);
                      res.send({ reply: resolve });
                      return 0;
                    })
                    .catch((reject) => {
                      //无匹配则随机回复balabala废话
                      GetBalabalaList()
                        .then((resolve) => {
                          let random_balabala =
                            resolve[Math.floor(Math.random() * resolve.length)]
                              .balabala;
                          res.send({ reply: random_balabala });
                          io.emit(
                            "system",
                            `@小夜觉得${random_balabala}`,
                          );
                          logger.info(
                            `${reject}，小夜觉得${random_balabala}`.log,
                          );
                          return 0;
                        })
                        .catch((reject) => {
                          logger.info(
                            `小夜试图balabala但出错了: ${reject}`.error,
                          );
                          res.send({
                            reply: `小夜试图balabala但出错了: ${reject}`,
                          });
                          io.emit(
                            "system",
                            `@小夜试图balabala但出错了: ${reject}`,
                          );
                          return 0;
                        });
                    });
                } else {
                  res.send(); //相当于严格模式，如果有多条res.send将会报错
                }
              }
              //群不存在于qq_group表则写入qq_group表
            } else {
              logger.info(
                `${req.body.group_id} 这个群不在qq_group表里，现在写入到qq_group表`.log,
              );
              db.run(
                `INSERT INTO qq_group VALUES('${req.body.group_id}', '1', '0', '', '', '')`,
              );
              res.send();
            }
          },
        );
      }
    } else if (
      req.body.message_type == "private" &&
      QQBOT_PRIVATE_CHAT_SWITCH == true
    ) {
      //私聊回复
      ChatProcess(req.body.message)
        .then((resolve) => {
          logger.info(`小夜回复 ${resolve}`.log);
          io.emit("system", `@小夜回复: ${resolve}`);
          res.send({ reply: resolve });
        })
        .catch((reject) => {
          //无匹配则随机回复balabala废话
          GetBalabalaList()
            .then((resolve) => {
              let random_balabala =
                resolve[Math.floor(Math.random() * resolve.length)].balabala;
              res.send({ reply: random_balabala });
              io.emit("system", `@小夜觉得${random_balabala}`);
              logger.info(`${reject}，小夜觉得${random_balabala}`.log);
            })
            .catch((reject) => {
              logger.info(`小夜试图balabala但出错了: ${reject}`.error);
              res.send({ reply: `小夜试图balabala但出错了: ${reject}` });
              io.emit(
                "system",
                `@小夜试图balabala但出错了: ${reject}`,
              );
            });
        });
      return 0;
    } else {
      res.send();
    }
  });

  //每隔24小时搜索qq_group表，随机延时提醒停用服务的群启用服务
  setInterval(AlertOpen, 1000 * 60 * 60 * 24);
  //提醒张菊
  function AlertOpen() {
    return new Promise((resolve, _reject) => {
      db.all("SELECT * FROM qq_group WHERE talk_enabled = 0", (err, sql) => {
        if (!err && sql[0]) {
          let service_stopped_list = []; //停用服务的群列表
          for (let i in sql) {
            service_stopped_list.push(sql[i].group_id);
          }
          logger.info(
            `以下群未启用小夜服务: ${service_stopped_list} ，现在开始随机延时提醒`.log,
          );
          DelayAlert(service_stopped_list);
          resolve(
            `以下群未启用小夜服务: ${service_stopped_list} ，现在开始随机延时提醒`,
          );
        } else {
          logger.info("目前没有群是关闭服务的，挺好".log);
        }
      });
    });
  }
}

/**
 * 虚拟主播星野夜蝶核心代码，星野夜蝶上线!
 */
function StartLive() {
  const live = new KeepLiveTCP(BILIBILI_LIVE_ROOM_ID);
  live.on("open", () => logger.info("直播间连接成功".log));

  live.on("live", () => {
    live.on("heartbeat", (online) => logger.info(`心跳包成功，直播间在线人数: ${online}`.log));

    live.on("DANMU_MSG", async (data) => {
      const danmu = {
        content: data.info[1],
        userId: data.info[2][0],
        userName: data.info[2][1]
      };

      //哔哩哔哩端插件应答器
      const pluginsReply = await ProcessExecute(danmu.content, danmu.userId, danmu.userName) ?? "";
      let replyToBiliBili = "";
      if (pluginsReply) {
        //插件响应弹幕
        replyToBiliBili = pluginsReply;
      } else {
        //交给聊天函数处理
        const chatReply = await ChatProcess(danmu.content);
        if (chatReply) {
          replyToBiliBili = chatReply;
        } else {
          //如果没有匹配到回复，那就随机回复balabala废话
          const balaBalaList = await GetBalabalaList();
          const randBalaBala = balaBalaList[Math.floor(Math.random() * balaBalaList.length)].balabala;
          replyToBiliBili = randBalaBala;
        }
      }

      fs.writeFileSync(Constants.TTS_FILE_RECV_PATH, `@${danmu.userName} ${replyToBiliBili}`);
      const chatReplyToTTS = await plugins.tts(replyToBiliBili);
      const ttsFile = `${process.cwd()}/static${chatReplyToTTS.file}`;
      voicePlayer.play(ttsFile, function (err) {
        if (err) throw err;
      });
    });

    live.on("SEND_GIFT", (data) => {
      const gift = data.data;
      console.log(`${gift.uname}送了${gift.num}个${gift.giftName}`.log);
      if (gift.num > 1) {
        console.log(`${gift.uname}送了${gift.num}个${gift.giftName}`.log);
        console.log(`${gift.uname}送了${gift.num}个${gift.giftName}`.log);
      }
    });

    live.on("GUARD_BUY", (data) => {
      const guard = data.data;
      console.log(`${guard.username}购买了${guard.num}个${guard.item}`.log);
    });

    live.on("WELCOME", (data) => {
      const welcome = data.data;
      console.log(`${welcome.uname}进入直播间`.log);
    });

    live.on("WELCOME_GUARD", (data) => {
      const welcome = data.data;
      console.log(`${welcome.uname}进入直播间`.log);
    });

    live.on("ROOM_BLOCK_MSG", (data) => {
      const block = data.data;
      console.log(`${block.uname}禁言了${block.time}秒`.log);
    });

    live.on("ROOM_UNBLOCK_MSG", (data) => {
      const block = data.data;
      console.log(`${block.uname}解除禁言`.log);
    });

    live.on("ROOM_BLOCK_ALL", (data) => {
      const block = data.data;
      console.log(`${block.uname}禁言了`.log);
    });

    live.on("ROOM_UNBLOCK_ALL", (data) => {
      const block = data.data;
      console.log(`${block.uname}解除禁言`.log);
    });

    live.on("ROOM_BLOCK_USER", (data) => {
      const block = data.data;
      console.log(`${block.uname}禁言了`.log);
    });

    live.on("ROOM_UNBLOCK_USER", (data) => {
      const block = data.data;
      console.log(`${block.uname}解除禁言`.log);
    });

    live.on("SYS_MSG", (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });

    live.on("SYS_GIFT", (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });

    live.on("SYS_MSG_IN", (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });

    live.on("SYS_GIFT_IN", (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });
  });
}

/**
 * 更改web端个人资料接口
 */
app.get("/profile", (req, res) => {
  db.run(
    `UPDATE users SET nickname = '${req.query.name}' WHERE CID ='${req.query.CID}'`,
  );
  res.sendFile(process.cwd() + Constants.HTML_PATH);
});

/**
 * web端图片上传接口
 */
app.post("/upload/image", upload.single("file"), function (req, _res, _next) {
  logger.info("用户上传图片".log);
  logger.info(req.file);
  const oldname = req.file.path;
  const newname = req.file.path + path.parse(req.file.originalname).ext;
  fs.renameSync(oldname, newname);
  io.emit("picture", {
    type: "picture", content: `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`
  });
});

/**
 * web端文件/视频上传接口
 */
app.post("/upload/file", upload.single("file"), function (req, _res, _next) {
  logger.info("用户上传文件".log);
  logger.info(req.file);
  const oldname = req.file.path;
  const newname = req.file.path + path.parse(req.file.originalname).ext;
  fs.renameSync(oldname, newname);
  const isVideo = new RegExp("^video*");
  const isAudio = new RegExp("^audio*");
  const file = {
    file: `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`,
    filename: req.file.originalname,
  };
  if (isVideo.test(req.file.mimetype)) {
    io.emit("video", { type: "video", content: file });
  } else if (isAudio.test(req.file.mimetype)) {
    io.emit("audio", { type: "audio", content: file });
  } else {
    io.emit("file", { type: "file", content: file });
  }
});

/**
 * 读取配置文件 config.yml
 */
function ReadConfig() {
  return new Promise((resolve, reject) => {
    logger.info("开始加载配置……".log);
    fs.readFile(
      path.join(process.cwd(), "config", "config.yml"),
      "utf-8",
      function (err, data) {
        if (!err) {
          logger.info("配置加载完毕√".log);
          resolve(yaml.parse(data));
        } else {
          reject("读取配置文件错误，尝试以默认配置启动。错误原因: " + err);
        }
      },
    );
  });
}

/**
 * 初始化配置
 */
async function InitConfig() {
  const config = await ReadConfig();
  CHAT_SWITCH = config.System.CHAT_SWITCH ?? true;
  CONNECT_GO_CQHTTP_SWITCH = config.System.CONNECT_GO_CQHTTP_SWITCH ?? false;
  CONNECT_BILIBILI_LIVE_SWITCH = config.System.CONNECT_BILIBILI_LIVE_SWITCH ?? false;
  WEB_PORT = config.System.WEB_PORT ?? 80;
  GO_CQHTTP_SERVICE_ANTI_POST_API = config.System.GO_CQHTTP_SERVICE_ANTI_POST_API ?? "/bot";
  GO_CQHTTP_SERVICE_API_URL = config.System.GO_CQHTTP_SERVICE_API_URL ?? "127.0.0.1:5700";

  QQBOT_QQ = config.qqBot.QQBOT_QQ; //qqBot使用的qq帐号
  QQBOT_ADMIN_LIST = config.qqBot.QQBOT_ADMIN_LIST; //小夜的管理员列表
  AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH = config.qqBot.AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH; //自动批准好友请求开关
  QQBOT_PRIVATE_CHAT_SWITCH = config.qqBot.QQBOT_PRIVATE_CHAT_SWITCH; //私聊开关
  CHAT_JIEBA_LIMIT = config.qqBot.CHAT_JIEBA_LIMIT; //qqBot限制分词数量
  QQBOT_REPLY_PROBABILITY = config.qqBot.QQBOT_REPLY_PROBABILITY; //回复几率
  QQBOT_FUDU_PROBABILITY = config.qqBot.QQBOT_FUDU_PROBABILITY; //复读几率
  QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH = config.qqBot.QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH; //保存接收图片开关
  QQBOT_MAX_MINE_AT_MOST = config.qqBot.QQBOT_MAX_MINE_AT_MOST; //最大共存地雷数

  BILIBILI_LIVE_ROOM_ID = config.Others.BILIBILI_LIVE_ROOM_ID ?? 49148; //哔哩哔哩直播间id

  console.log("_______________________________________\n");
  console.log(`\n|          ${version}           |\n`.alert);

  if (CHAT_SWITCH) {
    logger.info("web端自动聊天开启\n".on);
  } else {
    logger.info("web端自动聊天关闭\n".off);
  }

  /**
   * 启动时请求用户是否开启QQbot
   */
  if (CONNECT_GO_CQHTTP_SWITCH) {
    //先看配置里有没有配置好bot的qq号，没配置就请求输入
    if (!QQBOT_QQ) {
      readLine.question("配置文件中尚未配置小夜的QQ帐号，请在此输入想登录的机器人账号，按回车提交", (answer) => {
        QQBOT_QQ = answer;
        logger.info(`已将小夜的QQ帐号设置为 ${QQBOT_QQ}`.log);
        readLine.close();
      });
    }

    /**
     * 仅在windows系统下自动启动go-cqhttp
     */
    if (process.platform === "win32") {
      ChildProcess.execFile("go-cqhttp.bat", {
        cwd: path.join(process.cwd(), "plugins", "go-cqhttp")
      }, (error, _stdout, _stderr) => {
        if (error) {
          logger.error(`go-cqhttp启动失败，错误原因: ${error}`.error);
          return;
        }
        logger.error("go-cqhttp窗口意外退出，小夜将无法正常使用，请尝试重新启动".error);
        return;
      });
    }

    logger.info(
      `小夜开启，配置: \n  ·使用QQ帐号 ${QQBOT_QQ}\n  ·对接go-cqhttp接口 ${GO_CQHTTP_SERVICE_API_URL}\n  ·监听反向post于 127.0.0.1:${WEB_PORT}${GO_CQHTTP_SERVICE_ANTI_POST_API}\n  ·私聊服务是否开启: ${QQBOT_PRIVATE_CHAT_SWITCH}\n`
        .on,
    );
    xiaoye_ated = new RegExp(`\\[CQ:at,qq=${QQBOT_QQ}\\]`); //匹配小夜被@
    start_qqbot();
  } else {
    logger.info("小夜关闭\n".off);
  }

  if (CONNECT_BILIBILI_LIVE_SWITCH) {
    logger.info(
      `小夜直播对线开启，请确认哔哩哔哩直播间id是否为 ${BILIBILI_LIVE_ROOM_ID}\n`.on,
    );
    StartLive();
  } else {
    logger.info("小夜直播对线关闭\n".off);
  }

  http.listen(WEB_PORT, () => {
    console.log("_______________________________________\n".rainbow);
    logger.info(
      `服务启动完毕，访问 127.0.0.1:${WEB_PORT} 即可查看本地web端\n`,
    );
    logger.info("world.execute(me);".alert);
  });

  /**
   * 检查更新
   */
  axios(
    "https://api.github.com/repos/Giftia/ChatDACS/releases/latest",
  ).then((res) => {
    if (res.data.tag_name !== versionNumber) {
      logger.info(`当前小夜版本 ${versionNumber}，检测到小夜有新版本 ${res.data.tag_name}，请前往 https://github.com/Giftia/ChatDACS/releases 更新小夜吧`.alert);
    } else {
      logger.info(`当前小夜已经是最新版本 ${versionNumber}`.log);
    }
  }).catch((err) => {
    logger.error(`检查更新失败，错误原因: ${err}`.error);
  });
}

//异步结巴 by@ssp97
async function ChatJiebaFuzzy(msg) {
  msg = msg.replace("/", "");
  msg = jieba.extract(msg, CHAT_JIEBA_LIMIT); //按权重分词
  let candidate = [];
  let candidateNextList = [];
  let candidateNextGrand = 0;
  // console.log("分词出关键词: ".log);
  // console.log(msg);
  //收集数据开始
  for (const key in msg) {
    if (Object.hasOwnProperty.call(msg, key)) {
      const element = msg[key];
      // console.log(element);
      const rows = await sqliteAll(
        "SELECT * FROM chat WHERE ask LIKE '%" + element.word + "%'",
      );
      // console.log(rows);
      for (const k in rows) {
        if (Object.hasOwnProperty.call(rows, k)) {
          const answer = rows[k].answer;
          if (candidate[answer] == undefined) {
            candidate[answer] = 1;
          } else {
            candidate[answer] = candidate[answer] + 1;
          }
        }
      }
    }
  }
  // console.log(candidate);
  // 筛选次数最多
  for (const key in candidate) {
    if (Object.hasOwnProperty.call(candidate, key)) {
      const element = candidate[key];
      if (element > candidateNextGrand) {
        candidateNextList = [];
        candidateNextGrand = element;
        candidateNextList.push(key);
      } else if (element == candidateNextGrand) {
        candidateNextList.push(key);
      }
    }
  }
  // console.log(candidateNextList);
  return candidateNextList;
}

//异步sqliteALL by@ssp97
const sqliteAll = function (query) {
  return new Promise(function (resolve, reject) {
    db.all(query, function (err, rows) {
      if (err) {
        reject(err.message);
      } else {
        resolve(rows);
      }
    });
  });
};

//聊天处理，最核心区块，超智能(智障)的聊天算法: 整句搜索，模糊搜索，分词模糊搜索并轮询
async function ChatProcess(msg) {
  const fullContentSearchAnswer = await new Promise((resolve, _reject) => {
    console.log("开始整句搜索".log);
    db.all("SELECT * FROM chat WHERE ask = '" + msg + "'", (e, sql) => {
      if (!e && sql.length > 0) {
        console.log(`对于整句:  ${msg} ，匹配到 ${sql.length} 条回复`.log);
        let ans = Math.floor(Math.random() * sql.length);
        let answer = JSON.stringify(sql[ans].answer);
        answer = answer.replace(/"/g, "");
        console.log(`随机选取第${ans + 1}条回复: ${answer}`.log);
        resolve(answer);
        return 0;
      } else {
        console.log(`聊天数据库中没有匹配到整句 ${msg} 的回复`.log);
        resolve();
      }
    });
  });

  if (fullContentSearchAnswer) {
    //优先回复整句匹配
    console.log(`返回整句匹配：${fullContentSearchAnswer}`.alert);
    return fullContentSearchAnswer;
  }

  const likeContentSearchAnswer = await new Promise((resolve, _reject) => {
    console.log("开始模糊搜索".log);
    db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg + "%'", (e, sql) => {
      if (!e && sql.length > 0) {
        console.log(`模糊搜索: ${msg} ，匹配到 ${sql.length} 条回复`.log);
        let ans = Math.floor(Math.random() * sql.length);
        let answer = JSON.stringify(sql[ans].answer);
        answer = answer.replace(/"/g, "");
        console.log(`随机选取第${ans + 1}条回复: ${answer}`.log);
        resolve(answer);
        return 0;
      } else {
        console.log(`聊天数据库中没有匹配到 ${msg} 的模糊回复`.log);
        resolve();
      }
    });
  });

  if (likeContentSearchAnswer) {
    //其次是模糊匹配
    console.log(`返回模糊匹配：${likeContentSearchAnswer}`.alert);
    return likeContentSearchAnswer;
  }

  //最后是分词模糊搜索
  console.log("开始分词模糊搜索".log);
  const jiebaCandidateList = await ChatJiebaFuzzy(msg);
  if (jiebaCandidateList.length > 0) {
    const candidateListAnswer = jiebaCandidateList[
      Math.floor(Math.random() * jiebaCandidateList.length)
    ];
    console.log(`返回分词模糊匹配：${candidateListAnswer}`.alert);
    return candidateListAnswer;
  }

  //如果什么回复都没有匹配到，那么随机敷衍
  const randomBalaBala = (await sqliteAll("SELECT * FROM balabala ORDER BY RANDOM()"))[0].balabala;
  console.log(`返回随机敷衍：${randomBalaBala}`.alert);
  return randomBalaBala;
}

//随机选取一个群(可以用来启动时加载当前所有群)
function RandomGroupList() {
  return new Promise((resolve, reject) => {
    request(`http://${GO_CQHTTP_SERVICE_API_URL}/get_group_list`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err && body.data.length != 0) {
        const rand_group_num = Math.floor(Math.random() * body.data.length);
        logger.info("随机选取一个群: ", body.data[rand_group_num].group_id);
        resolve(body.data[rand_group_num].group_id);
      } else {
        reject(
          "随机选取一个群错误。错误原因: " + JSON.stringify(response.body),
        );
      }
    });
  });
}

//获取balabala
function GetBalabalaList() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM balabala;", (err, sql) => {
      if (!err && sql[0]) {
        let balabala = sql;
        resolve(balabala);
      } else {
        reject("获取balabala错误。错误原因: " + err + ", sql:" + sql);
      }
    });
  });
}

//随机延时提醒闭菊的群
function DelayAlert(service_stopped_list) {
  let alert_msg = [
    //提醒文本列表
    `呜呜呜，把人家冷落了那么久，能不能让小夜张菊了呢...小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${QQBOT_QQ}] 才可以了噢`,
    `闭菊那么久了，朕的菊花痒了!还不快让小夜张菊!小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${QQBOT_QQ}] 才可以了噢`,
    `小夜也想为大家带来快乐，所以让小夜张菊，好吗？小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${QQBOT_QQ}] 才可以了噢`,
    `欧尼酱，不要再无视我了，小夜那里很舒服的，让小夜张菊试试吧~小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${QQBOT_QQ}] 才可以了噢`,
  ];
  for (let i in service_stopped_list) {
    let delay_time = Math.floor(Math.random() * 60); //随机延时0到60秒
    let random_alert_msg =
      alert_msg[Math.floor(Math.random() * alert_msg.length)];
    logger.info(
      `小夜将会延时 ${delay_time} 秒后提醒群 ${service_stopped_list[i]} 张菊，提醒文本为: ${random_alert_msg}`
        .log,
    );
    setTimeout(function () {
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${service_stopped_list[i]
        }&message=${encodeURI(random_alert_msg)}`,
        function (error, _response, _body) {
          if (!error) {
            logger.info(
              `小夜提醒了群 ${service_stopped_list[i]} 张菊，提醒文本为: ${random_alert_msg}`
                .log,
            );
          }
        },
      );
    }, 1000 * delay_time);
  }
}

//私聊发送孤寡
function Gugua(who) {
  let gugua_pic_list = [
    //图片列表
    "1.jpg",
    "2.jpg",
    "3.jpg",
    "4.png",
    "5.gif",
  ];
  for (let i in gugua_pic_list) {
    let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/ps/${gugua_pic_list[i]}`;
    let pic_now = `[CQ:image,file=${file_online},url=${file_online}]`;
    setTimeout(function () {
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${who}&message=${encodeURI(
          pic_now,
        )}`,
        function (error, _response, _body) {
          if (!error) {
            logger.info(`小夜孤寡了 ${who}，孤寡图为: ${pic_now}`.log);
          }
        },
      );
    }, 1000 * 5 * i);
  }
}

//群发送孤寡
function QunGugua(who) {
  let gugua_pic_list = [
    //图片列表
    "1.jpg",
    "2.jpg",
    "3.jpg",
    "4.png",
    "5.gif",
  ];
  for (let i in gugua_pic_list) {
    let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/ps/${gugua_pic_list[i]}`;
    let pic_now = `[CQ:image,file=${file_online},url=${file_online}]`;
    setTimeout(function () {
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${who}&message=${encodeURI(
          pic_now,
        )}`,
        function (error, _response, _body) {
          if (!error) {
            logger.info(`小夜孤寡了群 ${who}，孤寡图为: ${pic_now}`.log);
          }
        },
      );
    }, 1000 * 5 * i);
  }
}

//浓度极高的ACGN圈台词问答题库
function ECYWenDa() {
  return new Promise((resolve, _reject) => {
    request(
      "https://api.oddfar.com/yl/q.php?c=2001&encode=json",
      (err, _response, body) => {
        body = JSON.parse(body);
        if (!err) {
          const msg = jieba.extract(body.text, CHAT_JIEBA_LIMIT); //按权重分词
          if (msg.length == 0) {
            //如果分词不了，那就直接夜爹牛逼
            resolve({
              quest: "啊噢，出不出题了，你直接回答 夜爹牛逼 吧",
              result: "夜爹牛逼",
            });
            return 0;
          }
          let rand_word_num = Math.floor(Math.random() * msg.length);
          let answer = msg[rand_word_num].word;
          logger.info(
            `原句为: ${body.text}，随机切去第 ${rand_word_num + 1} 个关键词 ${answer} 作为答案`.log,
          );
          let quest = body.text.replace(answer, "________");
          resolve({ quest: quest, result: answer });
        } else {
          resolve({
            quest: "啊噢，出不出题了，你直接回答 夜爹牛逼 吧",
            result: "夜爹牛逼",
          });
        }
      },
    );
  });
}

//抽10个天赋
function Talents10x(talents) {
  return new Promise((resolve, _reject) => {
    const talentsLength = Object.keys(talents).length;
    let roll_talents = "",
      talents_list = [];
    for (let i = 0; i < 10; i++) {
      const talents_index = Math.floor(1001 + Math.random() * talentsLength);
      const talents_content = `\n${i} ${talents[talents_index].name}（${talents[talents_index].description}）`;
      roll_talents += talents_content;
      talents_list.push(talents_index);
    }
    resolve({ roll_talents: roll_talents, talents_list: talents_list });
  });
}

//插件系统核心
async function ProcessExecute(msg, userId, userName, groupId, groupName, options) {
  let pluginReturn = "";
  for (const i in plugins) {
    const reg = new RegExp(plugins[i].指令);
    if (reg.test(msg)) {
      try {
        pluginReturn = await plugins[i].execute(msg, userId, userName, groupId, groupName, options);
      } catch (e) {
        logger.error(
          `插件 ${plugins[i].插件名} ${plugins[i].版本} 爆炸啦: ${e.stack}`.error,
        );
        return `插件 ${plugins[i].插件名} ${plugins[i].版本} 爆炸啦: ${e.stack}`;
      }
      if (pluginReturn) {
        logger.info(
          `插件 ${plugins[i].插件名} ${plugins[i].版本} 响应了消息：`.log,
        );
        logger.info(JSON.stringify(pluginReturn).log);
        return pluginReturn;
      }
    }
  }
  return pluginReturn;
}

/**
 * 我正在听：🎧 雾里 —— 姚六一
 */
