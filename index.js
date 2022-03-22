"use strict";
/**
 * Giftina: https://giftia.moe/
 *
 * 沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)，一个简单的机器人框架，支持接入哔哩哔哩直播，具备完全功能的web网页控制台。
 */

//启动时中文路径检查
const _cn_reg = new RegExp("[\u4e00-\u9fa5]");
if (_cn_reg.test(`${process.cwd()}`)) {
  console.log(
    `启动遇到严重错误: 因为Unicode的兼容性问题，程序所在路劲不能有汉字日语韩语表情包之类的奇奇怪怪的字符，请使用常规的ASCII字符!如有疑问，请加QQ群 120243247 咨询。当前路径含有不对劲的字符: ${process.cwd()} 按回车退出`,
  );
  //挂起进程，用等待输入替代while(1)，避免100%cpu占用
  readLine.on("line", () => {
    process.exit(0);
  });
}

const compression = require("compression"); //用于gzip压缩
const express = require("express"); //轻巧的express框架
const app = require("express")();
app.use(compression()); //对express所有路由启用gzip
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
const multer = require("multer"); //用于文件上传
const upload = multer({ dest: "static/uploads/" }); //用户上传目录
const cookie = require("cookie");
const http = require("http").Server(app);
const io = require("socket.io")(http);
const request = require("request");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
const colors = require("colors");
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
const yaml = require("yaml"); //使用yaml解析配置文件
const voicePlayer = require("play-sound")({
  player: path.join(process.cwd(), "plugins", "cmdmp3win.exe"),
}); //mp3静默播放工具，用于直播时播放语音

const { createCanvas, loadImage } = require("canvas"); //用于绘制文字图像，迫害p图
const os = require("os"); //用于获取系统工作状态
require.all = require("require.all"); //插件加载器
const readline = require("readline"); //nodejs中的stdio
const readLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const { KeepLiveTCP } = require('bilibili-live-ws');

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

//错误捕获
process.on("uncaughtException", (err) => {
  io.emit("system", `@未捕获的异常: ${err}`);
  logger.error(err, "uncaughtException");
});

//promise错误捕获
process.on("unhandledRejection", (err) => {
  io.emit("system", `@未捕获的promise异常: ${err}`);
  logger.error(err, "unhandledRejection");
});

//常量
const Constants = require(path.join(
  `${process.cwd()}`,
  "config",
  "constants.js",
));

//系统配置和开关，以及固定变量
const version = "ChatDACS v3.2.4"; //版本号，会显示在浏览器tab与标题栏
var boomTimer; //60s计时器
var onlineUsers = 0, //预定义
  TIAN_XING_API_KEY,
  QQBOT_QQ,
  CHAT_BAN_WORDS,
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
  QQBOT_CHAOS_PROBABILITY,
  req_fuliji_list,
  req_ECY_list,
  QQBOT_ORDER_LIST_NO_TRAP,
  QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH,
  QQBOT_MAX_MINE_AT_MOST,
  xiaoye_ated,
  QQBOT_PRIVATE_CHAT_SWITCH,
  c1c_count = 0;

//web端配置
const help =
  "主人你好，我是小夜。欢迎使用沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)。在这里，你可以与经过 2w+用户调教养成的人工智能机器人小夜实时聊天，它有着令人激动的、实用的在线涩图功能，还可以和在线的其他人分享你的图片、视频与文件。现在就试试使用在聊天框下方的便捷功能栏吧，功能栏往右拖动还有更多功能。";
const thanks =
  "致谢（排名不分先后）: https://niconi.co.ni/、https://www.layui.com/、https://lceda.cn/、https://www.dnspod.cn/、Daisy_Liu、http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html、https://ihateregex.io/、https://www.maoken.com/、https://www.ngrok.cc/、https://uptimerobot.com/、https://shields.io/、https://ctf.bugku.com/、https://blog.squix.org/、https://hostker.com/、https://www.tianapi.com/、https://api.sumt.cn/、https://github.com/Mrs4s/go-cqhttp、https://colorhunt.co/、https://github.com/、https://gitee.com/、https://github.com/windrises/dialogue.moe、https://api.lolicon.app/、https://bww.lolicon.app/、https://iw233.cn/main.html、https://blog.csdn.net/jia20003/article/details/7228464、还有我的朋友们，以及倾心分享知识的各位";
const updateContent = `update: 
- 一些变量与格式优化；
- 修复无法正常获取随机昵称的问题；
- 目前发现：由于插件系统和pkg不兼容，暂时不能通过github action进行自动构建，烦请用户自行按readme的快速部署章节进行启动；`;
const updateLog = `<h1>${version}</h1><br/>${updateContent}`;

//日志染色颜色配置
colors.setTheme({
  alert: "inverse",
  on: "brightMagenta",
  off: "brightGreen",
  warn: "brightYellow",
  error: "brightRed",
  log: "brightBlue",
});

logger.info(`启动路径: ${process.cwd()}`);

//载入配置
InitConfig();

//载入系统通用模块
logger.info("开始加载系统模块……");
let system = require.all({
  dir: path.join(`${process.cwd()}`, "plugins/system"),
  match: /.*\.js/,
  require: /\.(js)$/,
  recursive: false,
  encoding: "utf-8",
  resolve: function (system) {
    system.all.load();
  },
});
logger.info(`系统模块加载完毕√`.log);

//载入插件
console.log(`开始加载插件……`.log);
let plugins = require.all({
  dir: path.join(`${process.cwd()}`, "plugins"),
  match: /.*\.js/,
  require: /\.(js)$/,
  recursive: false,
  encoding: "utf-8",
  resolve: function (plugins) {
    plugins.all.load();
  },
});
console.log(plugins);
console.log(`插件加载完毕√`.log);

/*下面是三大核心功能: web端、qq端、直播间端*/

//web端核心代码，socket事件处理
io.on("connection", (socket) => {
  socket.emit("getCookie");
  const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
  if (CID === undefined) {
    socket.emit("getCookie");
    return 0;
  }
  socket.emit("version", version);
  io.emit("onlineUsers", ++onlineUsers);

  //开始获取用户信息并处理
  system.utils
    .GetUserData(CID)
    .then(([nickname, logintimes, lastlogintime]) => {
      console.log(
        `${system.utils.Curentyyyymmdd() + system.utils.CurentTime()
          }用户 ${nickname}(${CID}) 已连接`.log,
      );

      //更新登录次数
      db.run(
        `UPDATE users SET logintimes = logintimes + 1 WHERE CID ='${CID}'`,
      );

      //更新最后登陆时间
      db.run(
        `UPDATE users SET lastlogintime = '${system.utils.Curentyyyymmdd()}${system.utils.CurentTime()}' WHERE CID ='${CID}'`,
      );

      socket.username = nickname;

      io.emit(
        "system",
        `@欢迎回来，${socket.username}(${CID}) 。这是你第${logintimes}次访问。上次访问时间: ${lastlogintime}`,
      );
    })
    //若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作:
    .catch((reject) => {
      const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
      console.log(
        `system.utils.GetUserData(): rejected, and err:${reject}`.error,
      );
      console.log(
        `${system.utils.Curentyyyymmdd() + system.utils.CurentTime()
          }新用户 ${CID} 已连接`.log,
      );
      system.utils
        .RandomNickname()
        .then((resolve) => {
          db.run(
            `INSERT INTO users VALUES('${resolve}', '${CID}', '2', '${system.utils.Curentyyyymmdd()}${system.utils.CurentTime()}')`,
          );
          socket.username = resolve;
          io.emit(
            "system",
            `@新用户 ${CID} 已连接。小夜帮你取了一个随机昵称: 「${socket.username}」，请前往 更多-设置 来更改昵称`,
          );
          socket.emit("text", {
            CID: "0",
            msg: help,
          });
        })
        .catch((reject) => {
          console.log(`随机昵称错误: ${reject}`.error);
          db.run(
            `INSERT INTO users VALUES('匿名', '${CID}', '2', '${system.utils.Curentyyyymmdd()}${system.utils.CurentTime()}')`,
          );
          socket.username = "匿名";
          io.emit(
            "system",
            `@新用户 ${CID} 已连接。现在你的昵称是 匿名 噢，请前往 更多-设置 来更改昵称`,
          );
          socket.emit("text", {
            CID: "0",
            msg: help,
          });
        });
    });

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("onlineUsers", onlineUsers);
    console.log(
      `${system.utils.Curentyyyymmdd()}${system.utils.CurentTime()} 用户 ${socket.username
        } 已断开连接`.log,
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
    let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
    socket.emit("settings", { CID: CID, name: socket.username });
  });

  //更新日志
  socket.on("getUpdateLog", () => {
    socket.emit("updateLog", updateLog);
  });

  //致谢列表
  socket.on("thanks", () => {
    socket.emit("thanks", thanks);
  });

  //web端最核心代码，聊天处理
  socket.on("text", async (msgIn) => {
    const CID =
      cookie.parse(socket.request.headers.cookie || "").ChatdacsID ?? 0;
    const msg = msgIn.msg.replace(/['<>]/g, ""); //防爆
    console.log(
      `${system.utils.Curentyyyymmdd() + system.utils.CurentTime()}收到用户 ${socket.username
        }(${CID}) 的消息: ${msg}`.warn,
    );
    db.run(
      `INSERT INTO messages VALUES('${system.utils.Curentyyyymmdd()}', '${system.utils.CurentTime()}', '${CID}', '${msg}')`,
    );

    io.emit("text", { CID: CID, name: socket.username, msg: msg }); //用户广播

    //web端插件应答器
    const answer = await ProcessExecute(msg, 0, 0) ?? "";
    const answerMessage = {
      CID: "0",
      msg: answer.content,
    };
    io.emit(answer.type, answerMessage);

    if (CHAT_SWITCH) {
      //交给聊天函数处理
      const chatReply = await ChatProcess(msg);
      if (chatReply) {
        io.emit("text", { CID: "0", msg: chatReply, });
      }
    }

    /*
        //开始if地狱
        if (Constants.rename_reg.test(msg)) {
          db.run(
            `UPDATE users SET nickname = '${msg.slice(8)}' WHERE CID ='${CID}'`,
          );
          io.emit("text", {
            CID: "0",
            msg: `@昵称重命名完毕，小夜现在会称呼你为 ${msg.slice(8)} 啦`,
          });
        } else if (Constants.bv2av_reg.test(msg)) {
          msg = msg.replace(" ", "");
          system.utils
            .Bv2Av(msg)
            .then((resolve) => {
              io.emit("text", { CID: "0", msg: resolve });
            })
            .catch((reject) => {
              console.log(
                `system.utils.Bv2Av(): rejected, and err:${reject}`.error,
              );
              io.emit("system", `@system.utils.Bv2Av() err:${reject}`);
            });
        } else if (msg === "/reload") {
          io.emit("reload");
        } else if (msg === "/随机冷知识") {
          RandomHomeword()
            .then((resolve) => {
              io.emit("text", { CID: "0", msg: `@${resolve}` });
            })
            .catch((reject) => {
              console.log(`RandomHomeword(): rejected, and err:${reject}`.error);
              io.emit("system", `@RandomHomeword() err:${reject}`);
            });
        } else if (Constants.teach_reg.test(msg)) { //教学系统，抄板于虹原翼版小夜v3
          const teachMsg = msg.substr(2).split("答：");
          if (teachMsg.length !== 2) {
            console.log(`教学指令: 分割有误，退出教学`.error);
            io.emit("system", `@你教的姿势不对噢qwq`);
            return 0;
          }
          const ask = teachMsg[0].trim(),
            ans = teachMsg[1].trim();
          if (ask == "" || ans == "") {
            console.log(`问/答为空，退出教学`.error);
            io.emit("system", `@你教的姿势不对噢qwq`);
            return 0;
          }
          if (ask.indexOf(/\r?\n/g) !== -1) {
            console.log(`教学指令: 关键词换行了，退出教学`.error);
            io.emit("system", `@关键词不能换行啦qwq`);
            return 0;
          }
          console.log(
            `web端 ${socket.username} 想要教给小夜: 问: ${ask} 答: ${ans}，现在开始检测合法性`
              .log,
          );
          for (let i in CHAT_BAN_WORDS) {
            if (
              ask.toLowerCase().indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1 ||
              ans.toLowerCase().indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1
            ) {
              console.log(
                `教学指令: 检测到不允许的词: ${CHAT_BAN_WORDS[i]}，退出教学`
                  .error,
              );
              io.emit("system", `@你教的内容里有主人不允许小夜学习的词qwq`);
              return 0;
            }
          }
          if (Buffer.from(ask).length < 4) {
            //关键词最低长度: 4个英文或2个汉字
            console.log(`教学指令: 关键词太短，退出教学`.error);
            io.emit("system", `@关键词太短了啦qwq，至少要4个字节啦`);
            return 0;
          }
          if (ask.length > 350 || ans.length > 350) {
            //图片长度差不多是350左右
            console.log(`教学指令: 教的太长了，退出教学`.error);
            io.emit("system", `@你教的内容太长了，小夜要坏掉了qwq，不要呀`);
            return 0;
          }
          //到这里都没有出错的话就视为没有问题，可以让小夜学了
          console.log(`教学指令: 没有检测到问题，可以学习`.log);
          db.run(`INSERT INTO chat VALUES('${ask}', '${ans}')`);
          console.log(`教学指令: 学习成功`.log);
          io.emit(
            "system",
            `@哇!小夜学会啦!对我说: ${ask} 试试吧，小夜有可能会回复 ${ans} 噢`,
          );
          return 0;
        } else {
            return 0;
          }
        }
        **/
  });
});

//qqBot小夜核心代码，对接go-cqhttp
function start_qqbot() {
  app.post(GO_CQHTTP_SERVICE_ANTI_POST_API, (req, res) => {
    //禁言1小时以上自动退群
    if (req.body.sub_type == "ban" && req.body.user_id == QQBOT_QQ) {
      if (req.body.duration >= 3599) {
        request(
          `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_leave?group_id=${req.body.group_id}`,
          function (error, _response, _body) {
            if (!error) {
              console.log(
                `小夜在群 ${req.body.group_id} 被禁言超过1小时，自动退群`.error,
              );
              io.emit(
                "system",
                `@小夜在群 ${req.body.group_id} 被禁言超过1小时，自动退群`,
              );
            } else {
              console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/set_group_leave错误: ${error}`);
            }
          },
        );
      } else {
        //被禁言改名
        request(
          `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id
          }&user_id=${QQBOT_QQ}&card=${encodeURI("你妈的，为什么 禁言我")}`,
          function (error, _response, _body) {
            if (!error) {
              console.log(`被禁言了，你妈的，为什么`.log);
            } else {
              console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`);
            }
          },
        );
      }
      res.send();
      return 0;
    }

    //自动同意好友请求
    if (req.body.request_type == "friend") {
      console.log(`自动同意了 ${req.body.user_id} 好友请求`.log);
      res.send({ approve: 1 });
      return 0;
    }

    //加群请求发送给管理员
    if (req.body.request_type == "group" && req.body.sub_type == "invite") {
      let msg = `用户 ${req.body.user_id} 邀请小夜加入群 ${req.body.group_id}，批准请发送
/批准 ${req.body.flag}`;
      console.log(`${msg}`.log);
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${QQBOT_ADMIN_LIST[0]
        }&message=${encodeURI(msg)}`,
        function (error, _response, _body) {
          if (error) {
            console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/send_private_msg错误: ${error}`);
          }
        },
      );
      //邀群提醒
      let invite_reply = `你好呀，感谢你的使用，邀请小夜加入你的群后，请联系这只小夜的主人 ${QQBOT_ADMIN_LIST[0]} 来批准入群邀请噢`;
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${req.body.user_id
        }&message=${encodeURI(invite_reply)}`,
        function (error, _response, _body) {
          if (error) {
            console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/send_private_msg错误: ${error}`);
          }
        },
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
      let flag = req.body.message.match(Constants.approve_group_invite_reg)[1];
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_add_request?flag=${encodeURI(
          flag,
        )}&type=invite&approve=1`,
        function (error, _response, _body) {
          if (!error) {
            console.log(`批准了请求id ${flag}`.log);
            res.send({ reply: `已批准` });
          } else {
            console.log(
              `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_add_request错误: ${error}`,
            );
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
          `${req.body.user_id} 在群 ${req.body.group_id} 被禁言 ${req.body.duration} 秒`
            .error;
        break;
      case "poke":
        notify = `戳了一戳`.log;
        break;
      default:
        res.send();
        return 0;
    }
    console.log(notify);
    io.emit("system", `@${notify}`);

    //转发图片到web端，按需启用
    if (QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH) {
      if (Constants.isImage_reg.test(req.body.message)) {
        let url = Constants.img_url_reg.exec(req.body.message);
        SaveQQimg(url)
          .then((resolve) => {
            io.emit("qqImage", resolve);
          })
          .catch((reject) => {
            console.log(reject.error);
          });
        res.send();
      }
    }

    //转发视频到web端
    if (Constants.isVideo_reg.test(req.body.message)) {
      let url = Constants.video_url_reg.exec(req.body.message)[0];
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
        let msg_in = req.body.message.split("菊")[1];
        let who = msg_in.split("[CQ:at,qq=")[1];
        who = who.replace("]", "").trim();
        if (Constants.is_qq_reg.test(who)) {
          //如果是自己要被张菊，那么张菊
          if (QQBOT_QQ == who) {
            request(
              `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${req.body.group_id}&user_id=${req.body.user_id}`,
              function (_error, _response, body) {
                body = JSON.parse(body);
                if (body.data.role === "owner" || body.data.role === "admin") {
                  console.log(`群 ${req.body.group_id} 启用了小夜服务`.log);
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
                      console.log(`群 ${req.body.group_id} 启用了小夜服务`.log);
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
            res.send({ reply: `${msg_in}说你呢，快张菊!` });
            return 0;
          }
        }
      }
      //在收到群消息的时候搜索群是否存在于qq_group表，判断聊天开关
      else {
        db.all(
          `SELECT * FROM qq_group WHERE group_id = '${req.body.group_id}'`,
          (err, sql) => {
            if (!err && sql[0]) {
              //群存在于qq_group表则判断聊天开关 talk_enabled，闭嘴了就无视掉所有消息
              if (sql[0].talk_enabled === 0) {
                console.log(
                  `群 ${req.body.group_id} 服务已停用，无视群所有消息`.error,
                );
                res.send();
                return 0;
              } else {
                //服务启用了，允许进入后续的指令系统

                /*                                                                    群指令系统                                                                  */

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
                          console.log(
                            `${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被踩中，但这是一颗哑雷`
                              .log,
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
                                  console.log(
                                    `触发了神圣地雷，群 ${req.body.group_id} 被全体禁言`
                                      .error,
                                  );
                                  res.send({
                                    reply: `噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣地雷!我是说，这是一颗毁天灭地的神圣地雷啊!哈利路亚!麻烦管理员解除一下`,
                                  });
                                } else {
                                  console.log(
                                    `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban错误: ${error}`,
                                  );
                                  res.send({ reply: `日忒娘，怎么又出错了` });
                                }
                              },
                            );
                            return 0;
                          } else {
                            let boom_time = Math.floor(Math.random() * 60 * 2); //造成伤害时间
                            console.log(
                              `${sql[0].placed_qq} 在群 ${sql[0].group_id} 埋的地雷被引爆，雷已经被删除`
                                .log,
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
                  let msg_in = req.body.message.split("菊")[1];
                  let who = msg_in.split("[CQ:at,qq=")[1];
                  who = who.replace("]", "").trim();
                  if (Constants.is_qq_reg.test(who)) {
                    //如果是自己要被闭菊，那么闭菊
                    if (QQBOT_QQ == who) {
                      console.log(
                        `群 ${req.body.group_id} 停止了小夜服务`.error,
                      );
                      db.run(
                        `UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='${req.body.group_id}'`,
                      );
                      res.send({
                        reply: `小夜的菊花闭上了，这只小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${QQBOT_QQ}]`,
                      });
                      return 0;
                      //不是这只小夜被闭菊的话，嘲讽那只小夜
                    } else {
                      res.send({ reply: `${msg_in}说你呢，快闭菊!` });
                      return 0;
                    }
                  }
                  //没指定小夜
                } else if (req.body.message === "闭菊") {
                  console.log(`群 ${req.body.group_id} 停止了小夜服务`.error);
                  db.run(
                    `UPDATE qq_group SET talk_enabled = '0' WHERE group_id ='${req.body.group_id}'`,
                  );
                  res.send({
                    reply: `小夜的菊花闭上了，小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${QQBOT_QQ}]`,
                  });
                  return 0;
                }

                //强大的插件系统（划掉
                QQPluginExecute(
                  req.body.message,
                  req.body.user_id,
                  req.body.group_id,
                );

                //报错
                if (Constants.feed_back_reg.test(req.body.message)) {
                  console.log("有人想报错".log);
                  let msg = `用户 ${req.body.user_id}(${req.body.sender.nickname}) 报告了错误: `;
                  msg += req.body.message.replace("/报错 ", "");
                  msg = msg.replace("/报错", "");
                  request(
                    `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=120243247&message=${encodeURI(
                      msg,
                    )}`,
                    function (error, _response, _body) {
                      if (!error) {
                        console.log(
                          `${req.body.user_id} 反馈了错误 ${msg}`.log,
                        );
                      } else {
                        console.log(
                          `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                        );
                      }
                    },
                  );

                  request(
                    `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=474164508&message=${encodeURI(
                      msg,
                    )}`,
                    function (error, _response, _body) {
                      if (error) {
                        console.log(
                          `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                        );
                      }
                    },
                  );

                  res.send({
                    reply: `谢谢您的反馈，小夜已经把您的反馈信息发给了开发团队辣`,
                  });
                  return 0;
                }

                //戳一戳
                if (
                  req.body.sub_type === "poke" &&
                  req.body.target_id == QQBOT_QQ
                ) {
                  c1c_count++;
                  if (c1c_count > 2) {
                    c1c_count = 0;
                    let final = "哎呀戳坏了，不理你了 ٩(๑`^`๑)۶";
                    request(
                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                      }&message=${encodeURI(final)}`,
                      function (error, _response, _body) {
                        if (!error) {
                          console.log(
                            `${req.body.user_id} 戳了一下 ${req.body.target_id}`
                              .log,
                          );
                          request(
                            `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${req.body.group_id}&user_id=${req.body.user_id}&duration=10`,
                            function (error, _response, _body) {
                              if (!error) {
                                console.log(
                                  `小夜生气了，${req.body.user_id} 被禁言`
                                    .error,
                                );
                              } else {
                                console.log(
                                  `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_ban错误: ${error}`,
                                );
                                res.send({ reply: `日忒娘，怎么又出错了` });
                              }
                            },
                          );
                        } else {
                          console.log(
                            `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                          );
                        }
                      },
                    );
                  } else {
                    let final = `请不要戳小小夜 >_<`;
                    request(
                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                      }&message=${encodeURI(final)}`,
                      function (error, _response, _body) {
                        if (!error) {
                          console.log(
                            `${req.body.user_id} 戳了一下 ${req.body.target_id}`
                              .log,
                          );
                        } else {
                          console.log(
                            `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                          );
                        }
                      },
                    );
                  }
                  return 0;
                }

                //教学系统，抄板于虹原翼版小夜v3
                if (Constants.teach_reg.test(req.body.message)) {
                  let msg = req.body.message;
                  msg = msg.replace(/'/g, ""); //防爆
                  msg = msg.substr(2).split("答：");
                  if (msg.length !== 2) {
                    console.log(`教学指令: 分割有误，退出教学`.error);
                    res.send({ reply: "你教的姿势不对噢qwq" });
                    return 0;
                  }
                  let ask = msg[0].trim(),
                    ans = msg[1].trim();
                  if (ask == "" || ans == "") {
                    console.log(`问/答为空，退出教学`.error);
                    res.send({ reply: "你教的姿势不对噢qwq" });
                    return 0;
                  }
                  if (ask.indexOf(/\r?\n/g) !== -1) {
                    console.log(`教学指令: 关键词换行了，退出教学`.error);
                    res.send({ reply: "关键词不能换行啦qwq" });
                    return 0;
                  }
                  console.log(
                    `${req.body.user_id}(${req.body.sender.nickname}) 想要教给小夜: 问: ${ask} 答: ${ans}，现在开始检测合法性`
                      .log,
                  );
                  for (let i in CHAT_BAN_WORDS) {
                    if (
                      ask
                        .toLowerCase()
                        .indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1 ||
                      ans
                        .toLowerCase()
                        .indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1
                    ) {
                      console.log(
                        `教学指令: 检测到不允许的词: ${CHAT_BAN_WORDS[i]}，退出教学`
                          .error,
                      );
                      res.send({
                        reply: `你教的内容里有主人不允许小夜学习的词: ${CHAT_BAN_WORDS[i]} qwq`,
                      });
                      return 0;
                    }
                  }
                  if (Buffer.from(ask).length < 4) {
                    //关键词最低长度: 4个英文或2个汉字
                    console.log(`教学指令: 关键词太短，退出教学`.error);
                    res.send({ reply: "关键词太短了啦qwq，至少要4个字节啦" });
                    return 0;
                  }
                  if (ask.length > 350 || ans.length > 350) {
                    //图片长度差不多是350左右
                    console.log(`教学指令: 教的太长了，退出教学`.error);
                    res.send({
                      reply: "你教的内容太长了，小夜要坏掉了qwq，不要呀",
                    });
                    return 0;
                  }
                  //到这里都没有出错的话就视为没有问题，可以让小夜学了
                  console.log(`教学指令: 没有检测到问题，可以学习`.log);
                  db.run(`INSERT INTO chat VALUES('${ask}', '${ans}')`);
                  console.log(`教学指令: 学习成功`.log);
                  res.send({
                    reply: `哇!小夜学会啦!对我说: ${ask} 试试吧，小夜有可能会回复 ${ans} 噢`,
                  });
                  return 0;
                }

                //balabala教学，对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复
                if (Constants.teach_balabala_reg.test(req.body.message)) {
                  let msg = req.body.message;
                  msg = msg.replace(/'/g, ""); //防爆
                  msg = msg.replace("/说不出话 ", "");
                  msg = msg.replace("/说不出话", "");
                  console.log(
                    `${req.body.user_id}(${req.body.sender.nickname}) 想要教给小夜balabala: ${msg}，现在开始检测合法性`
                      .log,
                  );
                  for (let i in CHAT_BAN_WORDS) {
                    if (
                      msg
                        .toLowerCase()
                        .indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1 ||
                      msg
                        .toLowerCase()
                        .indexOf(CHAT_BAN_WORDS[i].toLowerCase()) !== -1
                    ) {
                      console.log(
                        `balabala教学: 检测到不允许的词: ${CHAT_BAN_WORDS[i]}，退出教学`
                          .error,
                      );
                      res.send({
                        reply: "你教的内容里有主人不允许小夜学习的词qwq",
                      });
                      return 0;
                    }
                  }
                  console.log(`balabala教学: 没有检测到问题，可以学习`.log);
                  db.run(`INSERT INTO balabala VALUES('${msg}')`);
                  console.log(`balabala教学: 学习成功`.log);
                  res.send({
                    reply: `哇!小夜学会啦!小夜可能在说不出话的时候说 ${msg} 噢`,
                  });
                  return 0;
                }

                //r18色图
                if (req.body.message == "r18") {
                  res.send({ reply: `你等等，我去找找你要的r18` });
                  system.setu
                    .RandomR18()
                    .then((resolve) => {
                      let setu_file = `http://127.0.0.1:${WEB_PORT}/${resolve.replace(
                        /\//g,
                        "\\",
                      )}`;
                      console.log(setu_file);
                      request(
                        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                        }&message=${encodeURI(
                          `[CQ:image,file=${setu_file},url=${setu_file}]`,
                        )}`,
                        function (error, _response, _body) {
                          if (error) {
                            console.log(
                              `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                            );
                          }
                        },
                      );
                    })
                    .catch((reject) => {
                      console.log(
                        `system.setu.RandomR18(): rejected, and err:${reject}`
                          .error,
                      );
                      request(
                        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                        }&message=${encodeURI(
                          `你要的r18发送失败啦: ${reject}`,
                        )}`,
                        function (error, _response, _body) {
                          if (error) {
                            console.log(
                              `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                            );
                          }
                        },
                      );
                    });
                  return 0;
                }

                //来点xx
                if (Constants.come_some_reg.test(req.body.message)) {
                  let tag = req.body.message.match(Constants.come_some_reg)[1];
                  res.send({ reply: `你等等，我去找找你要的${tag}` });
                  system.setu
                    .SearchTag(tag)
                    .then((resolve) => {
                      let setu_file = `http://127.0.0.1:${WEB_PORT}/${resolve.replace(
                        /\//g,
                        "\\",
                      )}`;
                      console.log(setu_file);
                      request(
                        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                        }&message=${encodeURI(
                          `[CQ:image,file=${setu_file},url=${setu_file}]`,
                        )}`,
                        function (error, _response, _body) {
                          if (error) {
                            console.log(
                              `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                            );
                          }
                        },
                      );
                    })
                    .catch((reject) => {
                      //画色图
                      console.log(
                        `system.setu.SearchTag(): rejected, and err:${reject}`
                          .error,
                      );

                      let canvas = createCanvas(500, 500);
                      let ctx = canvas.getContext("2d");
                      ctx.fillStyle = "#ffd400";
                      ctx.fillRect(0, 0, 500, 500);
                      ctx.font = `40px Sans`;
                      ctx.textAlign = "center";
                      ctx.fillStyle = "black";
                      ctx.fillText(reject, 250, 250);

                      let file_local = path.join(
                        `${process.cwd()}`,
                        `static`,
                        `xiaoye`,
                        `images`,
                        `${system.utils.sha1(canvas.toBuffer())}.jpg`,
                      );
                      fs.writeFileSync(file_local, canvas.toBuffer());
                      let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${system.utils.sha1(
                        canvas.toBuffer(),
                      )}.jpg`;

                      request(
                        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                        }&message=${encodeURI(
                          `[CQ:image,file=${file_online},url=${file_online}]`,
                        )}`,
                        function (error, _response, _body) {
                          if (error) {
                            console.log(
                              `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                            );
                          }
                        },
                      );

                      // console.log(`system.setu.SearchTag(): rejected, and err:${reject}`.error);
                      // request(
                      //   `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id}&message=${encodeURI(
                      //     `你要的${tag}发送失败啦: ${reject}`
                      //   )}`,
                      //   function (error, _response, _body) {
                      //     if (error) {
                      //       console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`);
                      //     }
                      //   }
                      // );
                    });
                  return 0;
                }

                //福利姬
                for (let i in req_fuliji_list) {
                  if (req.body.message === req_fuliji_list[i]) {
                    plugins.setu
                      .RandomTbshow()
                      .then((resolve) => {
                        res.send({
                          reply: `[CQ:image,file=${resolve},url=${resolve}]`,
                        });
                      })
                      .catch((reject) => {
                        console.log(
                          `plugins.setu.RandomCos(): rejected, and err:${reject}`
                            .error,
                        );
                        res.send({
                          reply: `你要的福利姬色图发送失败啦: ${reject}`,
                        });
                      });
                    return 0;
                  }
                }

                //来点二次元
                for (let i in req_ECY_list) {
                  if (req.body.message === req_ECY_list[i]) {
                    plugins.setu
                      .RandomECY()
                      .then((resolve) => {
                        res.send({
                          reply: `[CQ:image,file=${resolve},url=${resolve}]`,
                        });
                      })
                      .catch((reject) => {
                        console.log(
                          `plugins.setu.RandomCos(): rejected, and err:${reject}`
                            .error,
                        );
                        res.send({
                          reply: `你要的二次元色图发送失败啦: ${reject}`,
                        });
                      });
                    return 0;
                  }
                }

                //舔我
                if (req.body.message === "/舔我") {
                  PrprDoge()
                    .then((resolve) => {
                      console.log(`舔狗舔了一口: ${resolve}`.log);
                      res.send({ reply: resolve });
                    })
                    .catch((reject) => {
                      console.log(`随机舔狗错误: ${reject}`.error);
                    });
                  return 0;
                }

                //彩虹屁
                if (req.body.message === "/彩虹屁") {
                  RainbowPi()
                    .then((resolve) => {
                      console.log(`放了一个彩虹屁: ${resolve}`.log);
                      res.send({ reply: resolve });
                    })
                    .catch((reject) => {
                      console.log(`彩虹屁错误: ${reject}`.error);
                    });
                  return 0;
                }

                //吠，直接把文字转化为语音
                if (Constants.yap_reg.test(req.body.message)) {
                  let tex = req.body.message.replace("/吠 ", "");
                  tex = tex.replace("/吠", "");
                  BetterTTS(tex)
                    .then((resolve) => {
                      let tts_file = `[CQ:record,file=http://127.0.0.1:${WEB_PORT}${resolve.file},url=http://127.0.0.1:${WEB_PORT}${resolve.file}]`;
                      res.send({ reply: tts_file });
                    })
                    .catch((reject) => {
                      console.log(`TTS错误: ${reject}`.error);
                    });
                  return 0;
                }

                //嘴臭，小夜的回复转化为语音
                if (Constants.come_yap_reg.test(req.body.message)) {
                  let message = req.body.message.replace("/嘴臭 ", "");
                  message = message.replace("/嘴臭", "");
                  console.log(`有人对线说 ${message}，小夜要嘴臭了`.log);
                  io.emit(
                    "sysrem message",
                    `@有人对线说 ${message}，小夜要嘴臭了`,
                  );
                  ChatProcess(message)
                    .then((resolve) => {
                      let reply = resolve;
                      BetterTTS(reply)
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
                      BetterTTS()
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

                //prpr，来自jjbot的功能
                if (Constants.prpr_reg.test(req.body.message)) {
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
                    "大x [不忍直视]",
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
                  prpr_who = msg.replace("/prpr ", "");
                  if (!prpr_who || prpr_who === "/prpr") {
                    prpr_who = prpr_who.replace("/prpr", "");
                    prpr_who = "自己";
                  }
                  let random_bodyPart =
                    bodyPart[Math.floor(Math.random() * bodyPart.length)];
                  let final = `${who} 舔了舔 ${prpr_who} 的 ${random_bodyPart}，我好兴奋啊!`;
                  console.log(`prpr指令: ${final} `.log);
                  res.send({ reply: final });
                  return 0;
                }

                //今日不带套
                for (let i in QQBOT_ORDER_LIST_NO_TRAP) {
                  if (req.body.message === QQBOT_ORDER_LIST_NO_TRAP[i]) {
                    let now = new Date();
                    let year = now.getFullYear();
                    let month = now.getMonth() + 1;
                    let day = now.getDate();
                    if (month > 2) {
                      year++;
                    }
                    let star_set_name =
                      "魔羯水瓶双鱼牡羊金牛双子巨蟹狮子处女天秤天蝎射手魔羯";
                    let star_set_days = [
                      20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22,
                    ];
                    let star_set_result = star_set_name.substr(
                      month * 2 - (day < star_set_days[month - 1] ? 2 : 0),
                      2,
                    );
                    let shenxiao = [
                      "猴",
                      "鸡",
                      "狗",
                      "猪",
                      "鼠",
                      "牛",
                      "虎",
                      "兔",
                      "龙",
                      "蛇",
                      "马",
                      "羊",
                    ];
                    let shenxiao_result = /^\d{4}$/.test(year)
                      ? shenxiao[year % 12]
                      : false;
                    let final = `小夜温馨提示您: 今日不戴套，孩子${star_set_result}座，属${shenxiao_result}，${year + 18
                      }年高考，一本机率约${parseInt(
                        Math.random() * (99 - 20 + 1) + 20,
                        10,
                      )}%`;
                    console.log(`今日不带套指令: ${final} `.log);
                    res.send({ reply: final });
                    return 0;
                  }
                }

                //avg模板，可以写简单的随机小说
                if (req.body.message === "/画师算命") {
                  let paintstyle = [
                    "厚涂",
                    "美式",
                    "韩风",
                    "迪士尼风格",
                    "日系赛璐璐",
                    "日系平涂",
                    "国风",
                  ];
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
                  let buthen = [
                    "被请喝茶",
                    "被人寄刀片",
                    "被举报",
                    "本子卖到爆炸",
                    "被人吐槽",
                    "被人骗炮",
                    "突然爆红",
                    "被人抄袭",
                    "在街角被蜀黍强暴",
                  ];
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
                  let random_paintstyle =
                    paintstyle[Math.floor(Math.random() * paintstyle.length)];
                  let random_like =
                    like[Math.floor(Math.random() * like.length)];
                  let random_andthen =
                    andthen[Math.floor(Math.random() * andthen.length)];
                  let random_buthen =
                    buthen[Math.floor(Math.random() * buthen.length)];
                  let random_atlast =
                    atlast[Math.floor(Math.random() * atlast.length)];
                  let final = `${who}是一名${random_paintstyle}画师，最喜欢画${random_like}，而且${random_andthen}，然而因为画得太过和谐而${random_buthen}，还因为这件事在微博上有了${(
                    Math.random() * (1000000 - 1) +
                    1
                  ).toFixed(0)}个粉丝，做了${(
                    Math.random() * (100 - 1).toFixed(0) +
                    1
                  ).toFixed(0)}年画师，最后${random_atlast}。`;
                  console.log(`画师算命指令: ${final} `.log);
                  res.send({ reply: final });
                  return 0;
                }

                //cp文生成器，语料来自 https://github.com/mxh-mini-apps/mxh-cp-stories/blob/master/src/assets/story.json
                if (Constants.cp_story_reg.test(req.body.message)) {
                  let msg = req.body.message + " "; //结尾加一个空格防爆
                  msg = msg.split(" ");
                  console.log(msg);
                  let tops = msg[1].trim(), //小攻
                    bottoms = msg[2].trim(); //小受

                  fs.readFile(
                    path.join(`${process.cwd()}`, "config", "1and0story.json"),
                    "utf-8",
                    function (err, data) {
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
                        let story_index = Math.floor(
                          Math.random() * story[index].stories.length,
                        );
                        let story_select = story[index].stories[story_index];
                        story_select = story_select.replace(/<攻>/g, tops);
                        story_select = story_select.replace(/<受>/g, bottoms);
                        console.log(`发送cp文: ${story_select}`.log);
                        res.send({ reply: `${story_select}` });
                      }
                    },
                  );
                  return 0;
                }

                //人生重开模拟器，数据来自 https://github.com/VickScarlet/lifeRestart
                if (Constants.life_restart_reg.test(req.body.message)) {
                  console.log(
                    `用户 ${req.body.sender.user_id} 开始人生重开`.log,
                  );
                  //先抽选天赋
                  fs.readFile(
                    path.join(`${process.cwd()}`, "config", "talents.json"),
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
                            `${process.cwd()}`,
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
                          reply: `[CQ:at,qq=${req.body.sender.user_id
                            }]人生总结: 
                  
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

                //迫害，p图，这里需要重写复用
                if (Constants.pohai_reg.test(req.body.message)) {
                  let pohai_list = [
                    "唐可可",
                    "上原步梦",
                    "猛男狗",
                    "令和",
                    "鸭鸭",
                    "陈睿",
                  ]; //迫害名单
                  let pohai_pic_list = [
                    "coco_echo.jpg",
                    "ayumu_qaq.jpg",
                    "doge.jpg",
                    "nianhao.jpg",
                    "yaya.gif",
                    "bilibili.png",
                  ]; //迫害图片列表
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
                      console.log(
                        `被迫害人 ${pohai_who} 发现，使用迫害图 ${pohai_pic_list[i]}`
                          .log,
                      );
                    }
                  }

                  //如果没有迫害文字的话，应该是省略了被迫害人，如 /迫害 迫害文字 这样，所以迫害文字是第一个参数
                  if (!pohai_tex) {
                    pohai_tex = msg[1].trim();
                  }

                  //如果迫害文字里有@某人，将[CQ:at,qq=QQ号]转为昵称
                  if (Constants.has_qq_reg.test(pohai_tex)) {
                    console.log(`存在@内容，将替换为昵称`.log);
                    let at_start = pohai_tex.indexOf("[CQ:at,qq="); //取@开始
                    let at_end = pohai_tex.indexOf("]"); //取@结束
                    let tex_top = pohai_tex.substr(0, at_start); //取除了@外的字符串头
                    let tex_bottom = pohai_tex.substr(at_end + 1); //取除了@外的字符串尾
                    //获取qq
                    let qq_id = pohai_tex.replace("[CQ:at,qq=", "");
                    qq_id = qq_id.replace("]", "");
                    qq_id = qq_id.trim();
                    //如果是正确的qq号则替换
                    if (Constants.is_qq_reg.test(qq_id)) {
                      //获取qq号在群内的昵称
                      request(
                        `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${req.body.group_id}&user_id=${qq_id}&no_cache=0`,
                        function (error, _response, body) {
                          //这一步实在是太慢了啊实在不想异步了
                          if (!error) {
                            body = JSON.parse(body);
                            pohai_tex = `${tex_top}${body.data.nickname}${tex_bottom}`; //拼接为完整的迫害tex
                            //如果需要换行，按 tex_config[3] 来换行
                            if (pohai_tex.length > tex_config[3]) {
                              let enter = tex_config[3];
                              let new_pohai_tex = "";
                              for (
                                let i = 0, j = 1;
                                i < pohai_tex.length;
                                i++, j++
                              ) {
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
                              let canvas = createCanvas(
                                parseInt(image.width),
                                parseInt(image.height),
                              ); //根据迫害图尺寸创建画布
                              let ctx = canvas.getContext("2d");
                              ctx.drawImage(image, 0, 0);
                              ctx.font = `${tex_config[4]}px Sans`;
                              ctx.textAlign = "center";
                              ctx.rotate(tex_config[2]);
                              //ctx.fillStyle = "#00ff00";
                              let tex_width = Math.floor(
                                ctx.measureText(pohai_tex).width,
                              );
                              console.log(`文字宽度: ${tex_width}`.log);
                              ctx.fillText(
                                pohai_tex,
                                tex_config[0],
                                tex_config[1],
                              );
                              let file_local = path.join(
                                `${process.cwd()}`,
                                `static`,
                                `xiaoye`,
                                `images`,
                                `${system.utils.sha1(canvas.toBuffer())}.jpg`,
                              );
                              fs.writeFileSync(file_local, canvas.toBuffer());
                              let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${system.utils.sha1(
                                canvas.toBuffer(),
                              )}.jpg`;
                              console.log(
                                `迫害成功，图片发送: ${file_online}`.log,
                              );
                              res.send({
                                reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                              });
                            });
                          } else {
                            console.log(
                              `请求${GO_CQHTTP_SERVICE_API_URL}//get_group_member_info错误: ${error}`,
                            );
                            res.send({ reply: `日忒娘，怎么又出错了` });
                          }
                        },
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
                      let canvas = createCanvas(
                        parseInt(image.width),
                        parseInt(image.height),
                      ); //根据迫害图尺寸创建画布
                      let ctx = canvas.getContext("2d");
                      ctx.drawImage(image, 0, 0);
                      ctx.font = `${tex_config[4]}px Sans`;
                      ctx.textAlign = "center";
                      ctx.rotate(tex_config[2]);
                      //ctx.fillStyle = "#00ff00";
                      let tex_width = Math.floor(
                        ctx.measureText(pohai_tex).width,
                      );
                      console.log(`文字宽度: ${tex_width}`.log);
                      ctx.fillText(pohai_tex, tex_config[0], tex_config[1]);

                      let file_local = path.join(
                        `${process.cwd()}`,
                        `static`,
                        `xiaoye`,
                        `images`,
                        `${system.utils.sha1(canvas.toBuffer())}.jpg`,
                      );
                      fs.writeFileSync(file_local, canvas.toBuffer());
                      let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${system.utils.sha1(
                        canvas.toBuffer(),
                      )}.jpg`;
                      console.log(`迫害成功，图片发送: ${file_online}`.log);
                      res.send({
                        reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                      });
                    });
                  }
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
                            reply: `噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣手雷!我是说，这是一颗毁天灭地的神圣手雷啊!哈利路亚!麻烦管理员解除一下`,
                          });
                        } else {
                          console.log(
                            `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban错误: ${error}`,
                          );
                          res.send({ reply: `日忒娘，怎么又出错了` });
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
                          } else {
                            console.log(
                              `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_ban错误: ${error}`,
                            );
                            res.send({ reply: `日忒娘，怎么又出错了` });
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
                          console.log(`地雷为空`.log);
                        }
                        if (length < QQBOT_MAX_MINE_AT_MOST) {
                          //地雷还没满，先获取自增ID最新值sql.seq，随后mine表增加群地雷
                          db.all(
                            `Select seq From sqlite_sequence Where name = 'mine'`,
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
                      reply: `团长，你在做什么啊!团长!希望的花，不要乱丢啊啊啊啊`,
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
                      } else {
                        console.log(
                          `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban错误: ${error}`,
                        );
                        res.send({ reply: `日忒娘，怎么又出错了` });
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
                      } else {
                        console.log(
                          `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban错误: ${error}`,
                        );
                        res.send({ reply: `日忒娘，怎么又出错了` });
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
                              } else {
                                console.log(
                                  `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
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
                                    console.log(`击鼓传雷金手指已启动`.log);
                                  } else {
                                    console.log(
                                      `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`,
                                    );
                                  }
                                },
                              );

                              //丢出问题
                              setTimeout(function () {
                                request(
                                  `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${req.body.group_id
                                  }&message=${encodeURI(question)}`,
                                  function (error, _response, _body) {
                                    if (!error) {
                                    } else {
                                      console.log(
                                        `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                                      );
                                    }
                                  },
                                );
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
                                                `击鼓传雷金手指已恢复`.log,
                                              );
                                            } else {
                                              console.log(
                                                `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`,
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
                                            } else {
                                              console.log(
                                                `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                                              );
                                            }
                                          },
                                        );
                                        //游戏结束，清空数据
                                        db.run(
                                          `UPDATE qq_group SET loop_bomb_enabled = '0', loop_bomb_answer = '', loop_bomb_owner = '' , loop_bomb_start_time = '' WHERE group_id ='${req.body.group_id}'`,
                                        );
                                        return 0;
                                      } else {
                                        console.log(
                                          `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban错误: ${error}`,
                                        );
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
                          your_answer = req.body.message;
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
                                                  `击鼓传雷金手指已恢复`.log,
                                                );
                                              } else {
                                                console.log(
                                                  `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`,
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
                                              } else {
                                                console.log(
                                                  `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_ban错误: ${error}`,
                                                );
                                                res.send({
                                                  reply: `日忒娘，怎么又出错了`,
                                                });
                                              }
                                            },
                                          );
                                        } else {
                                          console.log(
                                            `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
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
                                            `击鼓传雷金手指已启动`.log,
                                          );
                                        } else {
                                          console.log(
                                            `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`,
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
                                        } else {
                                          console.log(
                                            `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
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
                                                            `击鼓传雷金手指已启动`
                                                              .log,
                                                          );
                                                        } else {
                                                          console.log(
                                                            `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`,
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
                                                        } else {
                                                          console.log(
                                                            `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
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
                                            } else {
                                              console.log(
                                                `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_ban错误: ${error}`,
                                              );
                                              res.send({
                                                reply: `日忒娘，怎么又出错了`,
                                              });
                                            }
                                          },
                                        );
                                      } else {
                                        console.log(
                                          `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
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
                                        console.log(`击鼓传雷金手指已启动`.log);
                                      } else {
                                        console.log(
                                          `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`,
                                        );
                                      }
                                    },
                                  );

                                  request(
                                    `http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${req.body.group_id}&user_id=${req.body.user_id}&card=`,
                                    function (error, _response, _body) {
                                      if (!error) {
                                        console.log(`击鼓传雷金手指已启动`.log);
                                      } else {
                                        console.log(
                                          `请求${GO_CQHTTP_SERVICE_API_URL}/set_group_card错误: ${error}`,
                                        );
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
                    var who = who.replace("]", "").trim();
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
                    ctx.fillText(system.utils.CurentTime(), 280.5, 35.5);

                    ctx.beginPath();
                    ctx.arc(40, 40, 28, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.clip();
                    ctx.drawImage(image, 10, 10, 60, 60);
                    ctx.closePath();

                    let file_local = path.join(
                      `${process.cwd()}`,
                      `static`,
                      `xiaoye`,
                      `images`,
                      `${system.utils.sha1(canvas.toBuffer())}.jpg`,
                    );
                    fs.writeFileSync(file_local, canvas.toBuffer());
                    let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${system.utils.sha1(
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

                //查询运行状态
                if (req.body.message === "/status") {
                  console.log(`查询运行状态`.log);
                  let self_id = req.body.self_id;
                  if (self_id != QQBOT_QQ) {
                    //若配置qq和实际登录qq不匹配，则自动更新qq号
                    let stat = `配置qq: ${QQBOT_QQ} 和实际登录qq: ${self_id} 不匹配，小夜帮小夜自动更新了配置qq为 ${self_id}`;
                    console.log(`${stat}`.error);
                    QQBOT_QQ = self_id;
                    res.send({
                      reply: stat,
                    });
                    return 0;
                  }
                  self_id != "1648468212"
                    ? (self_id = self_id)
                    : (self_id = "1648468212(小小夜本家)"); //试着用一下三元运算符，比if稍微绕一些，但是习惯了非常符合直觉，原理是: 当?前的条件成立时，执行:前的语句，不成立的话执行:后的语句
                  let stat = `企划: ${version}_${self_id}
宿主架构: ${os.hostname()} ${os.type()} ${os.arch()}
当前配置: 回复率 ${QQBOT_REPLY_PROBABILITY}%，复读率 ${QQBOT_FUDU_PROBABILITY}%，抽风率 ${QQBOT_CHAOS_PROBABILITY}‰
如果该小夜出现故障，请联系该小夜领养员 ${QQBOT_ADMIN_LIST[0]}
或开发群 120243247 报错
小夜开源于: https://gitee.com/Giftina/ChatDACS`;
                  res.send({
                    reply: stat,
                  });
                  return 0;
                }

                //孤寡
                if (Constants.gugua_reg.test(req.body.message)) {
                  if (req.body.message == "/孤寡") {
                    res.send({
                      reply: `小夜收到了你的孤寡订单，现在就开始孤寡你了噢孤寡~`,
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
                      (err, response, body) => {
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
                                  } else {
                                    console.log(
                                      `请求${GO_CQHTTP_SERVICE_API_URL}/send_private_msg错误: ${error}`,
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
                        } else {
                          reject(
                            "随机选取一个群错误。错误原因: " +
                            JSON.stringify(response.body),
                          );
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

                //黑白生草图
                if (Constants.bww_reg.test(req.body.message)) {
                  let msg = req.body.message + " " + " "; //结尾加2个空格防爆
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
                  let sources = Constants.img_url_reg.exec(pic)[0]; //取图片链接
                  loadImage(sources).then((image) => {
                    let canvas = createCanvas(
                      parseInt(image.width),
                      parseInt(image.height + 150),
                    ); //根据图片尺寸创建画布，并在下方加文字区
                    let ctx = canvas.getContext("2d");
                    ctx.drawImage(image, 0, 0);
                    ctx.filter = "grayscale";
                    ctx.fillStyle = "BLACK";
                    ctx.fillRect(
                      0,
                      parseInt(image.height),
                      parseInt(image.width),
                      150,
                    );
                    ctx.font = `40px Sans`;
                    ctx.textAlign = "center";
                    ctx.fillStyle = "WHITE";
                    ctx.fillText(
                      tex1,
                      parseInt(image.width) / 2,
                      parseInt(image.height) + 70,
                    ); //第一句
                    ctx.font = `28px Sans`;
                    ctx.fillText(
                      tex2,
                      parseInt(image.width) / 2,
                      parseInt(image.height) + 110,
                    ); //第二句

                    //把图片挨个像素转为黑白
                    let canvasData = ctx.getImageData(
                      0,
                      0,
                      canvas.width,
                      canvas.height,
                    );
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
                        if (
                          x < 8 ||
                          y < 8 ||
                          x > canvasData.width - 8 ||
                          y > canvasData.height - 8
                        ) {
                          canvasData.data[idx + 0] = 0;
                          canvasData.data[idx + 1] = 0;
                          canvasData.data[idx + 2] = 0;
                        }
                      }
                    }

                    ctx.putImageData(canvasData, 0, 0);

                    let file_local = path.join(
                      `${process.cwd()}`,
                      `static`,
                      `xiaoye`,
                      `images`,
                      `${system.utils.sha1(canvas.toBuffer())}.jpg`,
                    );
                    fs.writeFileSync(file_local, canvas.toBuffer());
                    let file_online = `http://127.0.0.1:${WEB_PORT}/xiaoye/images/${system.utils.sha1(
                      canvas.toBuffer(),
                    )}.jpg`;
                    console.log(`黑白成功，图片发送: ${file_online}`.log);
                    res.send({
                      reply: `[CQ:image,file=${file_online},url=${file_online}]`,
                    });
                  });

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
                        console.log(`复读历史消息: ${body.data.message}`.log);
                        res.send({ reply: `${body.data.message}` });
                      } else {
                        console.log(
                          `请求${GO_CQHTTP_SERVICE_API_URL}/get_msg错误: `,
                          error,
                        );
                      }
                    },
                  );
                  return 0;
                }

                //生成二维码
                if (Constants.make_QRCode_reg.test(req.body.message)) {
                  let content = req.body.message.match(
                    Constants.make_QRCode_reg,
                  )[1];
                  res.send({
                    reply: `[CQ:image,file=https://api.sumt.cn/api/qr.php?text=${content},url=https://api.sumt.cn/api/qr.php?text=${content}]`,
                  });
                  return 0;
                }

                //roll
                if (Constants.roll_reg.test(req.body.message)) {
                  let number = req.body.message.match(Constants.roll_reg)[1];
                  if (!number) {
                    number = Math.floor(Math.random() * 1000000);
                  }
                  res.send({
                    reply: `你roll出了${number}`,
                  });
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
                        console.log(
                          `${req.body.user_id} 加入了群 ${req.body.group_id}，小夜欢迎了ta`
                            .log,
                        );
                      } else {
                        console.log(
                          `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
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
                      console.log(`管理员启动了提醒任务`.log);
                      AlertOpen().then((resolve) => {
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

                //管理员功能: 执行sql
                if (Constants.admin_reg.test(req.body.message)) {
                  for (let i in QQBOT_ADMIN_LIST) {
                    if (req.body.user_id == QQBOT_ADMIN_LIST[i]) {
                      let admin_code = req.body.message.replace(
                        "/admin sql ",
                        "",
                      );
                      console.log(`管理员sql指令`.log);
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
                    reply: `你不是狗管理噢，不能让小夜这样那样的`,
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
                    reply: `你不是狗管理噢，不能让小夜这样那样的`,
                  });
                  return 0;
                }

                //管理员功能: 修改聊天抽风率
                if (
                  Constants.change_chaos_probability_reg.test(req.body.message)
                ) {
                  for (let i in QQBOT_ADMIN_LIST) {
                    if (req.body.user_id == QQBOT_ADMIN_LIST[i]) {
                      let msg = req.body.message.replace("/抽风率 ", "");
                      QQBOT_CHAOS_PROBABILITY = msg;
                      res.send({
                        reply: `小夜抽风率已修改为${msg}%`,
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

                //随机抽风，丢一个骰子，按 QQBOT_CHAOS_PROBABILITY 几率抽风
                let chaos_flag = Math.floor(Math.random() * 1000);
                if (chaos_flag < QQBOT_CHAOS_PROBABILITY) {
                  //随机选一个群抽风
                  let prprmsg;
                  PrprDoge()
                    .then((resolve) => {
                      prprmsg = resolve;
                      RandomGroupList()
                        .then((resolve) => {
                          request(
                            `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${resolve}&message=${encodeURI(
                              prprmsg,
                            )}`,
                            function (error, _response, _body) {
                              if (!error) {
                                console.log(
                                  `qqBot小夜在群 ${resolve} 抽风了，发送了 ${prprmsg}`
                                    .log,
                                );
                                io.emit(
                                  "system",
                                  `@qqBot小夜在群 ${resolve} 抽风了，发送了 ${prprmsg}`,
                                );
                              } else {
                                console.log(
                                  `请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`,
                                );
                              }
                            },
                          );
                        })
                        .catch((reject) => {
                          console.log(reject.error);
                          res.send();
                        });
                    })
                    .catch((reject) => {
                      console.log(`随机舔狗错误: ${reject}`.error);
                    });
                  return 0;
                }

                //丢一个骰子，按fudu_probability几率复读
                let fudu_flag = Math.floor(Math.random() * 100);
                if (fudu_flag < QQBOT_FUDU_PROBABILITY) {
                  console.log(`qqBot小夜复读 ${req.body.message}`.log);
                  io.emit(
                    "system",
                    `@qqBot小夜复读 ${req.body.message}`,
                  );
                  res.send({ reply: req.body.message });
                  return 0;
                }

                //丢一个骰子，按reply_probability几率回复
                let reply_flag = Math.floor(Math.random() * 100);
                //如果被@了，那么回复几率上升80%
                let at_replaced_msg = req.body.message; //要把[CQ:at,qq=${QQBOT_QQ}] 去除掉，否则聊天核心会乱成一锅粥
                if (xiaoye_ated.test(req.body.message)) {
                  reply_flag -= 80;
                  at_replaced_msg = req.body.message
                    .replace(`[CQ:at,qq=${QQBOT_QQ}]`, "")
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
                      console.log(`qqBot小夜回复 ${resolve}`.log);
                      io.emit("system", `@qqBot小夜回复: ${resolve}`);
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
                            `@qqBot小夜觉得${random_balabala}`,
                          );
                          console.log(
                            `${reject}，qqBot小夜觉得${random_balabala}`.log,
                          );
                          return 0;
                        })
                        .catch((reject) => {
                          console.log(
                            `小夜试图balabala但出错了: ${reject}`.error,
                          );
                          res.send({
                            reply: `小夜试图balabala但出错了: ${reject}`,
                          });
                          io.emit(
                            "system",
                            `@qqBot小夜试图balabala但出错了: ${reject}`,
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
              console.log(
                `${req.body.group_id} 这个群不在qq_group表里，现在写入到qq_group表`
                  .log,
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
          console.log(`qqBot小夜回复 ${resolve}`.log);
          io.emit("system", `@qqBot小夜回复: ${resolve}`);
          res.send({ reply: resolve });
        })
        .catch((reject) => {
          //无匹配则随机回复balabala废话
          GetBalabalaList()
            .then((resolve) => {
              let random_balabala =
                resolve[Math.floor(Math.random() * resolve.length)].balabala;
              res.send({ reply: random_balabala });
              io.emit("system", `@qqBot小夜觉得${random_balabala}`);
              console.log(`${reject}，qqBot小夜觉得${random_balabala}`.log);
            })
            .catch((reject) => {
              console.log(`小夜试图balabala但出错了: ${reject}`.error);
              res.send({ reply: `小夜试图balabala但出错了: ${reject}` });
              io.emit(
                "system",
                `@qqBot小夜试图balabala但出错了: ${reject}`,
              );
            });
        });
      return 0;
    } else {
      res.send();
    }
  });

  //qq端插件应答器
  async function QQPluginExecute(ask, qNum, gNum) {
    const result = await ProcessExecute(ask, qNum, gNum);
    if (result != "") {
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${gNum}&message=${encodeURI(
          result,
        )}`,
        function (error, _response, _body) {
          if (error) {
            console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`);
          }
        },
      );
      console.log(`${result}`.log);
    }
  }

  //每隔24小时搜索qq_group表，随机延时提醒停用服务的群启用服务
  setInterval(AlertOpen, 1000 * 60 * 60 * 24);
  //提醒张菊
  function AlertOpen() {
    return new Promise((resolve, _reject) => {
      db.all(`SELECT * FROM qq_group WHERE talk_enabled = 0`, (err, sql) => {
        if (!err && sql[0]) {
          let service_stopped_list = []; //停用服务的群列表
          for (let i in sql) {
            service_stopped_list.push(sql[i].group_id);
          }
          console.log(
            `以下群未启用小夜服务: ${service_stopped_list} ，现在开始随机延时提醒`
              .log,
          );
          DelayAlert(service_stopped_list);
          resolve(
            `以下群未启用小夜服务: ${service_stopped_list} ，现在开始随机延时提醒`,
          );
        } else {
          console.log(`目前没有群是关闭服务的，挺好`.log);
        }
      });
    });
  }
}

//虚拟主播星野夜蝶核心代码，星野夜蝶上线!
function start_live() {
  const live = new KeepLiveTCP(BILIBILI_LIVE_ROOM_ID);
  live.on('open', () => logger.info('直播间连接成功'.log));
  live.on('live', () => {
    live.on('heartbeat', (online) => logger.info(`直播间在线人数: ${online}`.log));
    live.on('msg', (data) => logger.info(`直播间消息: ${data}`.log));

    live.on('DANMU_MSG', (data) => {
      const danmu = data.info;
      ChatProcess(danmu)
        .then((resolve) => {
          const reply = resolve;
          console.log(`小夜说: ${reply}`.log);
          fs.writeFileSync(
            Constants.TTS_FILE_RECV_PATH,
            `${danmu}？ ${reply}`,
          );

          BetterTTS(reply)
            .then((resolve) => {
              let tts_file = `${process.cwd()}\\static${resolve.file.replace(
                "/",
                "\\",
              )}`;
              voicePlayer.play(tts_file, function (err) {
                if (err) throw err;
              });
            })
            .catch((reject) => {
              console.log(`TTS错误: ${reject}`.error);
            });
        })
        .catch((reject) => {
          //如果没有匹配到回复，那就随机回复balabala废话
          console.log(`${reject}，弹幕没有匹配`.warn);
          GetBalabalaList()
            .then((resolve) => {
              let random_balabala =
                resolve[Math.floor(Math.random() * resolve.length)]
                  .balabala;
              fs.writeFileSync(
                Constants.TTS_FILE_RECV_PATH,
                random_balabala,
              );
              BetterTTS(random_balabala)
                .then((resolve) => {
                  let tts_file = `${process.cwd()}\\static${resolve.file.replace(
                    "/",
                    "\\",
                  )}`;
                  voicePlayer.play(tts_file, function (err) {
                    if (err) throw err;
                  });
                })
                .catch((reject) => {
                  console.log(`TTS错误: ${reject}`.error);
                });
              console.log(
                `${reject}，qqBot小夜觉得${random_balabala}`.log,
              );
            })
            .catch((reject) => {
              console.log(`小夜试图balabala但出错了: ${reject}`.error);
            });
        });
    });

    live.on('SEND_GIFT', (data) => {
      const gift = data.data;
      console.log(`${gift.uname}送了${gift.num}个${gift.giftName}`.log);
      if (gift.num > 1) {
        console.log(`${gift.uname}送了${gift.num}个${gift.giftName}`.log);
        console.log(`${gift.uname}送了${gift.num}个${gift.giftName}`.log);
      }
    });

    live.on('GUARD_BUY', (data) => {
      const guard = data.data;
      console.log(`${guard.username}购买了${guard.num}个${guard.item}`.log);
    });

    live.on('WELCOME', (data) => {
      const welcome = data.data;
      console.log(`${welcome.uname}进入直播间`.log);
    });

    live.on('WELCOME_GUARD', (data) => {
      const welcome = data.data;
      console.log(`${welcome.uname}进入直播间`.log);
    });

    live.on('ROOM_BLOCK_MSG', (data) => {
      const block = data.data;
      console.log(`${block.uname}禁言了${block.time}秒`.log);
    });

    live.on('ROOM_UNBLOCK_MSG', (data) => {
      const block = data.data;
      console.log(`${block.uname}解除禁言`.log);
    });

    live.on('ROOM_BLOCK_ALL', (data) => {
      const block = data.data;
      console.log(`${block.uname}禁言了`.log);
    });

    live.on('ROOM_UNBLOCK_ALL', (data) => {
      const block = data.data;
      console.log(`${block.uname}解除禁言`.log);
    });

    live.on('ROOM_BLOCK_USER', (data) => {
      const block = data.data;
      console.log(`${block.uname}禁言了`.log);
    });

    live.on('ROOM_UNBLOCK_USER', (data) => {
      const block = data.data;
      console.log(`${block.uname}解除禁言`.log);
    });

    live.on('SYS_MSG', (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });

    live.on('SYS_GIFT', (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });

    live.on('SYS_MSG_IN', (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });

    live.on('SYS_GIFT_IN', (data) => {
      const msg = data.data;
      console.log(`${msg.msg}`.log);
    });
  });
}

/*
 *
 *下面是接口功能和实现
 *
 */

//更改个人资料接口
app.get("/profile", (req, res) => {
  db.run(
    `UPDATE users SET nickname = '${req.query.name}' WHERE CID ='${req.query.CID}'`,
  );
  res.sendFile(process.cwd() + Constants.HTML_PATH);
});

//图片上传接口
app.post("/upload/image", upload.single("file"), function (req, _res, _next) {
  console.log(`用户上传图片: ${req.file}`.log);
  let oldname = req.file.path;
  let newname = req.file.path + path.parse(req.file.originalname).ext;
  fs.renameSync(oldname, newname);
  io.emit(
    "picture",
    `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`,
  );
});

//文件/视频上传接口
app.post("/upload/file", upload.single("file"), function (req, _res, _next) {
  console.log(`用户上传文件: ${req.file}`.log);
  let oldname = req.file.path;
  let newname = req.file.path + path.parse(req.file.originalname).ext;
  fs.renameSync(oldname, newname);
  let isVideo = new RegExp("^video*");
  let isAudio = new RegExp("^audio*");
  let file = {
    file: `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext
      }`,
    filename: req.file.originalname,
  };
  if (isVideo.test(req.file.mimetype)) {
    io.emit("video message", file);
  } else if (isAudio.test(req.file.mimetype)) {
    io.emit("audio", file);
  } else {
    io.emit("file", file);
  }
});

/*
 *
 *下面是工具类函数的实现
 *
 */

//舔狗回复
function PrprDoge() {
  return new Promise((resolve, reject) => {
    request(
      `http://api.tianapi.com/txapi/tiangou/index?key=${TIAN_XING_API_KEY}`,
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          resolve(body.newslist[0].content);
        } else {
          reject(
            "舔狗错误，是天行接口的锅。错误原因: " +
            JSON.stringify(response.body),
          );
        }
      },
    );
  });
}

//读取配置文件 config.yml
function ReadConfig() {
  return new Promise((resolve, reject) => {
    console.log(`开始加载配置……`.log);
    fs.readFile(
      path.join(`${process.cwd()}`, "config", "config.yml"),
      "utf-8",
      function (err, data) {
        if (!err) {
          console.log(`配置加载完毕√`.log);
          resolve(yaml.parse(data));
        } else {
          reject("读取配置文件错误。错误原因: " + err);
        }
      },
    );
  });
}

//初始化配置
async function InitConfig() {
  let resolve = await ReadConfig();
  CHAT_SWITCH = resolve.System.CHAT_SWITCH;
  CONNECT_GO_CQHTTP_SWITCH = resolve.System.CONNECT_GO_CQHTTP_SWITCH;
  CONNECT_BILIBILI_LIVE_SWITCH = resolve.System.CONNECT_BILIBILI_LIVE_SWITCH;
  WEB_PORT = resolve.System.WEB_PORT;
  GO_CQHTTP_SERVICE_ANTI_POST_API = resolve.System.GO_CQHTTP_SERVICE_ANTI_POST_API;
  GO_CQHTTP_SERVICE_API_URL = resolve.System.GO_CQHTTP_SERVICE_API_URL;

  TIAN_XING_API_KEY = resolve.ApiKey.TIAN_XING_API_KEY ?? ""; //天行接口key

  QQBOT_QQ = resolve.qqBot.QQBOT_QQ; //qqBot使用的qq帐号
  QQBOT_ADMIN_LIST = resolve.qqBot.QQBOT_ADMIN_LIST; //qqBot小夜的管理员列表
  QQBOT_PRIVATE_CHAT_SWITCH = resolve.qqBot.QQBOT_PRIVATE_CHAT_SWITCH; //私聊开关
  CHAT_JIEBA_LIMIT = resolve.qqBot.CHAT_JIEBA_LIMIT; //qqBot限制分词数量
  QQBOT_REPLY_PROBABILITY = resolve.qqBot.QQBOT_REPLY_PROBABILITY; //回复几率
  QQBOT_FUDU_PROBABILITY = resolve.qqBot.QQBOT_FUDU_PROBABILITY; //复读几率
  QQBOT_CHAOS_PROBABILITY = resolve.qqBot.QQBOT_CHAOS_PROBABILITY; //抽风几率
  req_fuliji_list = resolve.qqBot.req_fuliji_list; //福利姬
  req_ECY_list = resolve.qqBot.req_ECY_list; //二次元图
  QQBOT_ORDER_LIST_NO_TRAP = resolve.qqBot.QQBOT_ORDER_LIST_NO_TRAP; //今日不带套
  QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH = resolve.qqBot.QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH; //保存接收图片开关
  QQBOT_MAX_MINE_AT_MOST = resolve.qqBot.QQBOT_MAX_MINE_AT_MOST; //最大共存地雷数
  CHAT_BAN_WORDS = resolve.qqBot.CHAT_BAN_WORDS; //教学系统的黑名单

  BILIBILI_LIVE_ROOM_ID = resolve.Others.BILIBILI_LIVE_ROOM_ID; //哔哩哔哩直播间id

  console.log(`_______________________________________\n`);
  console.log(`\n         ${version}          \n`.alert);

  if (CHAT_SWITCH) {
    console.log("web端自动聊天开启\n".on);
  } else {
    console.log("web端自动聊天关闭\n".off);
  }

  if (CONNECT_GO_CQHTTP_SWITCH) {
    console.log(
      `qqBot小夜开启，配置: \n  ·使用QQ帐号 ${QQBOT_QQ}\n  ·对接go-cqhttp接口 ${GO_CQHTTP_SERVICE_API_URL}\n  ·监听反向post于 127.0.0.1:${WEB_PORT}${GO_CQHTTP_SERVICE_ANTI_POST_API}\n  ·私聊服务是否开启: ${QQBOT_PRIVATE_CHAT_SWITCH}\n`
        .on,
    );
    xiaoye_ated = new RegExp(`\\[CQ:at,qq=${QQBOT_QQ}\\]`); //匹配小夜被@
    start_qqbot();
  } else {
    console.log("qqBot小夜关闭\n".off);
  }

  if (CONNECT_BILIBILI_LIVE_SWITCH) {
    console.log(
      `小夜直播对线开启，请确认哔哩哔哩直播间id是否为 ${BILIBILI_LIVE_ROOM_ID}\n`.on,
    );
    start_live();
  } else {
    console.log("小夜直播对线关闭\n".off);
  }

  http.listen(WEB_PORT, () => {
    console.log(`_______________________________________\n`);
    console.log(
      `  ${system.utils.Curentyyyymmdd()}${system.utils.CurentTime()} 启动完毕，访问 127.0.0.1:${WEB_PORT} 即可进入web端  \n`
        .alert,
    );
  });
}

//异步结巴 by@ssp97
async function ChatJiebaFuzzy(msg) {
  msg = msg.replace("/", "");
  msg = jieba.extract(msg, CHAT_JIEBA_LIMIT); //按权重分词
  let candidate = [];
  let candidateNextList = [];
  let candidateNextGrand = 0;
  console.log(`分词出关键词: `.log);
  console.log(msg);
  //收集数据开始
  for (const key in msg) {
    if (Object.hasOwnProperty.call(msg, key)) {
      const element = msg[key];
      console.log(element);
      rows = await sqliteAll(
        "SELECT * FROM chat WHERE ask LIKE '%" + element.word + "%'",
      );
      console.log(rows);
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
  console.log(candidate);
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
  console.log(candidateNextList);
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
  const full_search = await new Promise((resolve, _reject) => {
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

  if (full_search) {
    //优先回复整句匹配
    console.log(`返回整句匹配`.alert);
    return full_search;
  }

  const like_serach = await new Promise((resolve, _reject) => {
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

  if (like_serach) {
    //其次是模糊匹配
    console.log(`返回模糊匹配`.alert);
    return like_serach;
  }

  // 分词模糊搜索
  let candidateList = await ChatJiebaFuzzy(msg);
  if (candidateList.length > 0) {
    return candidateList[Math.floor(Math.random() * candidateList.length)];
  }
  // 随机敷衍
  let result = await sqliteAll("SELECT * FROM balabala ORDER BY RANDOM()"); //有待优化
  //console.log(result)
  return result[0].balabala;
}

//保存qq侧传来的图
function SaveQQimg(imgUrl) {
  return new Promise((resolve, reject) => {
    request(imgUrl[0]).pipe(
      fs
        .createWriteStream(
          `./static/xiaoye/images/${imgUrl[0].split("/")[imgUrl[0].split("/").length - 2]
          }.jpg`,
        )
        .on("close", (err) => {
          if (!err) {
            resolve(
              `/xiaoye/images/${imgUrl[0].split("/")[imgUrl[0].split("/").length - 2]
              }.jpg`,
            );
          } else {
            reject("保存qq侧传来的图错误。错误原因: " + err);
          }
        }),
    );
  });
}

//随机选取一个群
function RandomGroupList() {
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

//扒的百度臻品音库-度米朵
function BetterTTS(tex) {
  return new Promise((resolve, reject) => {
    if (!tex) tex = "你好谢谢小笼包再见!";
    request(
      "https://ai.baidu.com/aidemo?type=tns&per=4103&spd=7&pit=10&vol=10&aue=6&tex=" +
      encodeURI(tex),
      async (err, _response, body) => {
        body = JSON.parse(body);
        if (!err && body.data) {
          console.log(`${tex} 的幼女版语音合成成功`.log);
          const base64Data = body.data.replace(
            /^data:audio\/x-mpeg;base64,/,
            "",
          );
          const dataBuffer = Buffer.from(base64Data, "base64");

          const MP3Duration = await system.utils.getMP3Duration(dataBuffer);
          duration = MP3Duration;

          const ttsFile = `/xiaoye/tts/${system.utils.sha1(dataBuffer)}.mp3`;
          fs.writeFileSync(`./static${ttsFile}`, dataBuffer);
          const file = {
            file: ttsFile,
            filename: "小夜幼女版语音回复",
            duration: MP3Duration,
          };
          resolve(file);
        } else {
          //估计被发现扒接口了
          console.log(`语音合成幼女版失败: ${JSON.stringify(body)}`.error);
          reject("语音合成幼女版TTS错误: ", JSON.stringify(body));
        }
      },
    );
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
    console.log(
      `qqBot小夜将会延时 ${delay_time} 秒后提醒群 ${service_stopped_list[i]} 张菊，提醒文本为: ${random_alert_msg}`
        .log,
    );
    setTimeout(function () {
      request(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${service_stopped_list[i]
        }&message=${encodeURI(random_alert_msg)}`,
        function (error, _response, _body) {
          if (!error) {
            console.log(
              `qqBot小夜提醒了群 ${service_stopped_list[i]} 张菊，提醒文本为: ${random_alert_msg}`
                .log,
            );
          } else {
            console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`);
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
            console.log(`qqBot小夜孤寡了 ${who}，孤寡图为: ${pic_now}`.log);
          } else {
            console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/send_private_msg错误: ${error}`);
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
            console.log(`qqBot小夜孤寡了群 ${who}，孤寡图为: ${pic_now}`.log);
          } else {
            console.log(`请求${GO_CQHTTP_SERVICE_API_URL}/send_group_msg错误: ${error}`);
          }
        },
      );
    }, 1000 * 5 * i);
  }
}

//百科问答题库
function WenDa() {
  return new Promise((resolve, reject) => {
    request(
      `http://api.tianapi.com/txapi/wenda/index?key=${TIAN_XING_API_KEY}`,
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          resolve({
            quest: body.newslist[0].quest,
            result: body.newslist[0].result,
          });
        } else {
          reject(
            "问答错误，是天行接口的锅。错误原因: " +
            JSON.stringify(response.body),
          );
        }
      },
    );
  });
}

//浓度极高的ACGN圈台词问答题库
function ECYWenDa() {
  return new Promise((resolve, _reject) => {
    request(
      `https://api.oddfar.com/yl/q.php?c=2001&encode=json`,
      (err, _response, body) => {
        body = JSON.parse(body);
        if (!err) {
          msg = jieba.extract(body.text, CHAT_JIEBA_LIMIT); //按权重分词
          if (msg.length == 0) {
            //如果分词不了，那就直接夜爹牛逼
            resolve({
              quest: `啊噢，出不出题了，你直接回答 夜爹牛逼 吧`,
              result: `夜爹牛逼`,
            });
            return 0;
          }
          let rand_word_num = Math.floor(Math.random() * msg.length);
          let answer = msg[rand_word_num].word;
          console.log(
            `原句为: ${body.text}，随机切去第 ${rand_word_num + 1
              } 个关键词 ${answer} 作为答案`.log,
          );
          let quest = body.text.replace(answer, "________");
          resolve({ quest: quest, result: answer });
        } else {
          resolve({
            quest: `啊噢，出不出题了，你直接回答 夜爹牛逼 吧`,
            result: `夜爹牛逼`,
          });
        }
      },
    );
  });
}

//彩虹屁回复
function RainbowPi() {
  return new Promise((resolve, reject) => {
    request(
      `http://api.tianapi.com/txapi/caihongpi/index?key=${TIAN_XING_API_KEY}`,
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          resolve(body.newslist[0].content);
        } else {
          reject(
            "彩虹屁错误，是天行接口的锅。错误原因: " +
            JSON.stringify(response.body),
          );
        }
      },
    );
  });
}

//获取json串长度
function getJsonLength(jsonData) {
  const jsonLength = 0;
  for (let _item in jsonData) {
    jsonLength++;
  }
  return jsonLength;
}

//抽10个天赋
function Talents10x(talents) {
  return new Promise((resolve, _reject) => {
    let index = getJsonLength(talents);
    let roll_talents = "",
      talents_list = [];
    for (let i = 0; i < 10; i++) {
      const talents_index = Math.floor(1001 + Math.random() * index);
      const talents_content = `\n${i} ${talents[talents_index].name}（${talents[talents_index].description}）`;
      roll_talents += talents_content;
      talents_list.push(talents_index);
    }
    resolve({ roll_talents: roll_talents, talents_list: talents_list });
  });
}

//插件系统核心
async function ProcessExecute(msg, qq_num, group_num) {
  let returnResult = "";
  for (let i in plugins) {
    const reg = new RegExp(plugins[i].指令);
    if (reg.test(msg)) {
      try {
        returnResult = await plugins[i].execute(msg, qq_num, group_num);
      } catch (e) {
        logger.error(
          `插件 ${plugins[i].插件名} ${plugins[i].版本} 爆炸啦: ${e.stack}`.error,
        );
        return `插件 ${plugins[i].插件名} ${plugins[i].版本} 爆炸啦: ${e.stack}`;
      }
      logger.info(
        `插件 ${plugins[i].插件名} ${plugins[i].版本} 响应了消息`.log,
      );
      return returnResult;
    }
  }
  return returnResult;
}

/**
 * 🎧 ArkLight —— M2U
 */
