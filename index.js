"use strict";
/**
 * Author: Giftina: https://github.com/Giftia/
 * 沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)，一个简单的机器人框架，支持接入哔哩哔哩直播，具备完全功能的web网页控制台。
 */

/**
 * 启动时中文路径检查
 */
const { exec } = require("child_process");
const _cn_reg = new RegExp("[\u4e00-\u9fa5]");
if (_cn_reg.test(process.cwd())) {
  const warnMessage = `因为Unicode字符的兼容性问题，本程序所在路径不能存在非ASCII字符。如有疑问，请加QQ群 157311946 咨询。当前路径含有非ASCII字符: ${process.cwd()}`;
  console.log(warnMessage);
  exec(`msg %username% ${warnMessage}`);
}

/**
 * 声明依赖与配置
 */
const versionNumber = `v${require("./package.json").version}`; // 版本号
const version = `ChatDACS ${versionNumber}`; // 系统版本，会显示在web端标题栏
const utils = require("./plugins/system/utils.js"); // 载入系统通用模块
const Constants = require("./config/constants.js"); // 系统常量
const compression = require("compression"); // 用于gzip压缩
const express = require("express"); // 轻巧的express框架
const app = require("express")();
app.use(compression()); // 对express所有路由启用gzip
app.use(express.static("static")); // 静态文件引入
app.use(express.json()); // 解析post
app.use(express.urlencoded({ extended: false })); // 解析post
const multer = require("multer"); // 用于文件上传
const upload = multer({ dest: "./static/uploads/" }); // 用户上传目录
const cookie = require("cookie");
const http = require("http").Server(app);
const io = require("socket.io")(http);
const request = require("request");
const axios = require("axios").default;
const https = require("https");
const colors = require("colors"); // Console日志染色颜色配置
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
require.all = require("require.all"); // 插件加载器
const { KeepLiveTCP } = require("bilibili-live-ws");
const yaml = require("yaml"); // 使用yaml解析配置文件
const voicePlayer = require("play-sound")({
  player: path.join(process.cwd(), "plugins", "mpg123", "mpg123.exe"),
}); // mp3静默播放工具，用于直播时播放语音
const ipTranslator = require("lib-qqwry")(true); // lib-qqwry是一个高效纯真IP库(qqwry.dat)引擎，传参 true 是将IP库文件读入内存中以提升效率
const { createOpenAPI, createWebsocket } = require("qq-guild-bot"); // QQ频道SDK
const semverDiff = require("semver-diff"); // 版本比较
const TelegramBot = require("node-telegram-bot-api"); // Telegram机器人SDK

/**
 * 中文分词器
 */
const jieba = require("nodejieba");
jieba.load({
  dict: path.join(process.cwd(), "config", "jieba.dict.utf8"),
  hmmDict: path.join(process.cwd(), "config", "hmm_model.utf8"),
  userDict: path.join(process.cwd(), "config", "userDict.txt"), // 加载自定义分词库
  idfDict: path.join(process.cwd(), "config", "idf.utf8"),
  stopWordDict: path.join(process.cwd(), "config", "stopWordDict.txt"), // 加载分词库黑名单
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

winston.addColors(Constants.LOG_LEVELS.colors);

const logger = winston.createLogger({
  levels: Constants.LOG_LEVELS.levels,
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

logger.info("world.execute(me);".alert);

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
var boomTimer; // 60s计时器
var onlineUsers = 0, // 预定义
  QQBOT_ADMIN_LIST,
  QQ_GROUP_WELCOME_MESSAGE,
  QQ_GROUP_POKE_REPLY_MESSAGE,
  QQ_GROUP_POKE_BOOM_REPLY_MESSAGE,
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
  QQBOT_PRIVATE_CHAT_SWITCH,
  AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH,
  c1c_count = 0,
  CONNECT_QQ_GUILD_SWITCH,
  QQ_GUILD_APP_ID,
  QQ_GUILD_TOKEN,
  CONNECT_TELEGRAM_SWITCH,
  TELEGRAM_BOT_TOKEN;

/**
 * 声明结束，开始初始化
 */
console.log("_______________________________________\n".rainbow);
console.log(`\n|          ${version}           |`.alert);
console.log(" Giftina: https://github.com/Giftia/ \n".alert);
console.log("_______________________________________\n".rainbow);
logger.info("开始加载插件……".log);
const plugins = require.all({
  dir: path.join(process.cwd(), "plugins"),
  match: /\.js$/,
  require: /\.js$/,
  recursive: false,
  encoding: "utf-8",
  resolve: function (plugins) {
    plugins.all.load();
  },
});
let pluginsMap = ["当前安装的插件列表："];
for (const i in plugins) {
  pluginsMap.push(plugins[i].插件名);
}
console.log(pluginsMap);
logger.info("插件加载完毕√".log);

InitConfig();

/**
 * 下面是各种功能实现
 */

/**
 * web端消息处理，前端使用layim框架
 */
io.on("connection", async (socket) => {
  socket.emit("getCookie");
  const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
  if (CID == undefined) {
    socket.emit("getCookie");
    return 0;
  }

  // 获取 ip 与 地理位置
  const ip = socket.handshake.headers["x-forwarded-for"] ? socket.handshake.headers["x-forwarded-for"]?.split("::ffff:")[1] : socket.handshake.address.split("::ffff:")[1] ?? socket.handshake.address;
  let location = "未知归属地";
  try {
    location = ipTranslator.searchIP(ip).Country;
  } catch (error) {
    logger.error(`获取地理位置失败: ${error}`);
  }

  socket.emit("version", version);
  io.emit("onlineUsers", ++onlineUsers);

  // 开始获取用户信息并处理
  const { nickname, loginTimes, updatedAt } = await utils.GetUserData(CID);

  if (updatedAt) {
    socket.username = `${nickname}[来自${location}]`;

    logger.info(
      `web端用户 ${nickname}(${CID}) 已经连接，登录次数 ${loginTimes + 1}，上次登录时间 ${updatedAt}`.log,
    );

    // 更新登录次数
    utils.UpdateLoginTimes(CID);

    io.emit("system",
      `@欢迎回来，${socket.username}(${CID}) 。这是你第${loginTimes + 1}次访问。上次访问时间: ${updatedAt}`,
    );

  } else {
    // 若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作:
    const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
    const randomNickname = await utils.RandomNickname();
    socket.username = `${randomNickname}[来自${location}]`;

    logger.info(
      `web端用户 ${socket.username}(${CID}) 第一次访问，新增该用户`.log,
    );

    // 新增用户
    utils.AddUser(CID, randomNickname);

    io.emit("system",
      `@新用户 ${socket.username}(${CID}) 已连接。小夜帮你取了一个随机昵称: ${socket.username}，请前往 更多-设置 来更改昵称`,
    );

    socket.emit("message", {
      CID: "0",
      msg: Constants.HELP_CONTENT,
    });
  }

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

  // 用户设置
  socket.on("getSettings", () => {
    const CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
    socket.emit("settings", { CID: CID, name: socket.username });
  });

  // web端最核心代码，聊天处理
  socket.on("message", async (msgIn) => {
    const CID =
      cookie.parse(socket.request.headers.cookie || "").ChatdacsID ?? 0;
    const msg = msgIn.msg.replace(/['<>]/g, ""); // 防爆
    logger.info(
      `web端用户 ${socket.username}(${CID}) 发送了消息: ${msg}`.warn,
    );

    // 新消息写入数据库
    utils.AddMessage(CID, msg);

    io.emit("message", { CID: CID, name: socket.username, msg: msg }); // 用户广播

    // web端插件应答器
    const pluginsReply = await ProcessExecute(
      msg,
      CID,
      socket.username,
      "",
      "",
      {
        type: "web",
      }
    ) ?? "";
    if (pluginsReply) {
      const replyToWeb = utils.PluginAnswerToWebStyle(pluginsReply);
      const answerMessage = {
        CID: "0",
        msg: replyToWeb,
      };
      io.emit("message", answerMessage);
    }

    if (CHAT_SWITCH) {
      // 交给聊天函数处理
      const chatReply = await ChatProcess(msg);
      if (chatReply) {
        io.emit("message", { CID: "0", msg: chatReply });
      }
    }
  });
});

/**
 * qq端消息处理，对接go-cqhttp
 */
async function StartQQBot() {
  /**
   * go-cqhttp 启动后加载当前所有群，写入数据库进行群服务初始化
   */
  logger.info("正在进行群服务初始化……".log);
  await utils.InitGroupList();

  app.post(GO_CQHTTP_SERVICE_ANTI_POST_API, async (req, res) => {
    const event = req.body;

    // 处理频道消息
    if (event.message_type == "guild") {
      logger.info(`小夜收到频道 ${event.channel_id} 的 ${event.user_id} (${event.sender.nickname}) 发来的消息: ${event.message}`);
      await ProcessGuildMessage(event);
      return 0;
    }

    // 被禁言1小时以上自动退群
    if (event.sub_type == "ban" && event.user_id == event.self_id) {
      if (event.duration >= 3599) {
        axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_leave?group_id=${event.group_id}`);
        logger.info(
          `小夜在群 ${event.group_id} 被禁言超过1小时，自动退群`.error,
        );
        io.emit(
          "system",
          `@小夜在群 ${event.group_id} 被禁言超过1小时，自动退群`,
        );
      } else {
        // 被禁言改名
        axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${event.group_id}&user_id=${event.self_id}&card=${encodeURI("你妈的，为什么 禁言我")}`);
        logger.info(
          `小夜在群 ${event.group_id} 被禁言，自动改名为 你妈的，为什么 禁言我`.log,
        );
      }
      res.send();
      return 0;
    }

    // 添加好友请求
    if (event.request_type == "friend") {
      logger.info(
        `小夜收到好友请求，请求人：${event.user_id}，请求内容：${event.comment}，按配置自动处理`.log,
      );
      res.send({ approve: AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH });
      return 0;
    }

    // 加群请求发送给管理员
    if (event.request_type == "group" && event.sub_type == "invite") {
      const msg = `用户 ${event.user_id} 邀请小夜加入群 ${event.group_id}，批准请发送
批准 ${event.flag}`;
      logger.info(
        `小夜收到加群请求，请求人：${event.user_id}，请求内容：${event.comment}，发送小夜管理员审核`.log,
      );
      axios.get(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${QQBOT_ADMIN_LIST[0]}&message=${encodeURI(msg)}`,
      );
      // 发送给邀请者批准提醒
      const inviteReplyContent = `你好呀，谢谢你邀请小夜，请联系这只小夜的主人 ${QQBOT_ADMIN_LIST[0]} 来批准入群邀请噢。小夜开源于 https://github.com/Giftia/ChatDACS ，开发组欢迎你的加入！`;
      axios.get(
        `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${event.user_id}&message=${encodeURI(inviteReplyContent)}`,
      );
      res.send({});
      return 0;
    }

    // 管理员批准群邀请
    if (
      event.message_type == "private" &&
      event.user_id == QQBOT_ADMIN_LIST[0] &&
      Constants.approve_group_invite_reg.test(event.message)
    ) {
      const flag = event.message.match(Constants.approve_group_invite_reg)[1];

      axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_add_request?flag=${encodeURI(flag)}&type=invite&approve=1`);

      logger.info(
        `管理员批准了群邀请请求 ${flag}`.log,
      );
      res.send({ reply: "已批准" });
      return 0;
    }

    // ————————————————————下面是功能————————————————————
    let notify = "";
    switch (event.sub_type) {
      case "friend":
      case "group":
        notify = `小夜收到好友 ${event.user_id} (${event.sender.nickname}) 发来的消息: ${event.message}`;
        break;
      case "normal":
        notify = `小夜收到群 ${event.group_id} 的 ${event.user_id} (${event.sender.nickname}) 发来的消息: ${event.message}`;
        break;
      case "approve":
        notify = `${event.user_id} 加入了群 ${event.group_id}`.log;
        break;
      case "ban":
        notify =
          `${event.user_id} 在群 ${event.group_id} 被禁言 ${event.duration} 秒`.error;
        break;
      case "poke":
        notify = `${event.user_id} 戳了一下 ${event.target_id}`.log;
        break;
      default:
        res.send();
        return 0;
    }
    logger.info(notify);
    io.emit("system", `@${notify}`);

    // 转发图片到web端
    if (QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH) {
      if (Constants.isImage_reg.test(event.message)) {
        const url = Constants.img_url_reg.exec(event.message);
        try {
          const resolve = await utils.SaveQQimg(url);
          io.emit("qqImage", resolve);
        } catch (error) {
          logger.error(`转发图片失败：${error}`.error);
        }
        res.send();
        return 0;
      }
    }

    // 转发视频到web端
    if (Constants.isVideo_reg.test(event.message)) {
      const url = Constants.video_url_reg.exec(event.message)[0];
      io.emit("qqVideo", { file: url, filename: "qq视频" });
      res.send();
      return 0;
    }

    // 群服务开关判断
    const subTypeCondition = ["ban", "poke", "friend_add"];
    if (
      event.message_type == "group" ||
      event.notice_type == "group_increase" ||
      subTypeCondition.includes(event.sub_type)
    ) {
      // 服务启用开关
      // 指定小夜的话
      if (
        Constants.open_ju_reg.test(event.message) &&
        Constants.has_qq_reg.test(event.message)
      ) {
        const who = Constants.has_qq_reg.exec(event.message)[1];
        if (Constants.is_qq_reg.test(who)) {
          // 如果是自己要被张菊，那么张菊
          if (event.self_id == who) {
            axios.get(
              `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${event.group_id}&user_id=${event.user_id}`
            ).then(async (response) => {
              if (response.data.data.role === "owner" || response.data.data.role === "admin") {
                logger.info(
                  `群 ${event.group_id} 启用了小夜服务`.log
                );
                await utils.EnableGroupService(event.group_id);
                res.send({
                  reply: "小夜的菊花被管理员张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊",
                });
                return 0;
              }
              // 申请人不是管理，再看看是不是qqBot管理员
              else {
                for (let i in QQBOT_ADMIN_LIST) {
                  if (event.user_id == QQBOT_ADMIN_LIST[i]) {
                    logger.info(
                      `群 ${event.group_id} 启用了小夜服务`.log
                    );
                    await utils.EnableGroupService(event.group_id);
                    res.send({
                      reply:
                        "小夜的菊花被主人张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊",
                    });
                    return 0;
                  }
                }
                // 看来真不是管理员呢
                res.send({
                  reply:
                    "你不是群管理呢，小夜不张，张菊需要让管理员来帮忙张噢",
                });
                return 0;
              }
            });
            return 0;
          }
          // 不是这只小夜被张菊的话，嘲讽那只小夜
          else {
            res.send({ reply: `[CQ:at,qq=${who}] 说你呢，快张菊!` });
            return 0;
          }
        }
      }
      // 在收到群消息的时候判断群服务开关
      else {
        const groupServiceSwitch = await utils.GetGroupServiceSwitch(event.group_id);

        // 闭嘴了就无视掉所有消息
        if (!groupServiceSwitch) {
          logger.info(
            `群 ${event.group_id} 服务已停用，无视群所有消息`.error,
          );
          res.send();
          return 0;
        } else {
          // 服务启用了，允许进入后续的指令系统

          // 群欢迎
          if (event.notice_type === "group_increase") {
            console.log(
              `${event.user_id} 加入了群 ${event.group_id}，小夜欢迎了ta`.log,
            );

            const welcomeMessage = QQ_GROUP_WELCOME_MESSAGE.replace(/@新人/g, `[CQ:at,qq=${event.user_id}]`);

            axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(welcomeMessage)}`);

            // 在小夜加入新群后，将新群写入群服务表
            await utils.AddNewGroup(event.group_id);
            return 0;
          }

          // 地雷爆炸判断，先判断这条消息是否引爆，再从数据库取来群地雷数组，引爆后删除地雷，原先的地雷是用随机数生成被炸前最大回复作为引信，现在换一种思路，用更简单的随机数引爆
          const boom = Math.floor(Math.random() * 100) < 10; // 踩中地雷的概率为10%
          // 如果判定踩中，检查该群是否有雷
          if (boom) {
            const mine = await utils.GetGroupMine(event.group_id);

            if (mine) {
              // 先把地雷排掉
              await utils.DeleteGroupMine(mine.id);

              // 判断是否哑雷
              const isDumb = Math.floor(Math.random() * 100) < 30; // 哑雷的概率为30%
              if (isDumb) {
                console.log(
                  `${mine.owner} 在群 ${mine.groupId} 埋的地雷被踩中，但这是一颗哑雷`.log,
                );
                res.send({
                  reply: `[CQ:at,qq=${event.user_id}]恭喜你躲过一劫，[CQ:at,qq=${mine.owner}]埋的地雷掺了沙子，是哑雷，炸了，但没有完全炸`,
                });
              }
              // 判断是否神圣地雷
              else {
                const isHollyMine = Math.floor(Math.random() * 100) < 1; // 神圣地雷的概率为1%
                if (isHollyMine) {
                  axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_whole_ban?group_id=${event.group_id}&enable=1`);

                  console.log(
                    `${mine.owner} 在群 ${mine.groupId} 触发了神圣地雷`.error,
                  );
                  res.send({
                    reply: "噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣地雷！我是说，这是一颗毁天灭地的神圣地雷啊！哈利路亚！麻烦管理员解除一下",
                  });
                }
                // 是常规地雷
                else {
                  const boomTime = Math.floor(Math.random() * 60 * 2); // 造成伤害时间，2分钟内
                  console.log(
                    `${mine.owner} 在群 ${mine.groupId} 埋的地雷被引爆，伤害时间${boomTime}秒`.log,
                  );

                  res.send({
                    reply: `[CQ:at,qq=${event.user_id}]恭喜你，被[CQ:at,qq=${mine.owner}]所埋地雷炸伤，休养生息${boomTime}秒!`,
                    ban: 1,
                    ban_duration: boomTime,
                  });
                }
              }
            }
            return 0; // 踩中地雷后不再处理消息
          }

          // 服务停用开关
          // 指定小夜的话
          if (
            Constants.close_ju_reg.test(event.message) &&
            Constants.has_qq_reg.test(event.message)
          ) {
            const who = Constants.has_qq_reg.exec(event.message)[1];
            if (Constants.is_qq_reg.test(who)) {
              // 如果是自己要被闭菊，那么闭菊
              if (event.self_id == who) {
                console.log(
                  `群 ${event.group_id} 停止了小夜服务`.error,
                );
                await utils.DisableGroupService(event.group_id);
                res.send({
                  reply: `小夜的菊花闭上了，这只小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${event.self_id}]`,
                });
                // 不是这只小夜被闭菊的话，嘲讽那只小夜（或人
              } else {
                res.send({ reply: `[CQ:at,qq=${who}] 说你呢，快闭菊!` });
              }
              return 0;
            }
            // 没指定小夜
          } else if (event.message === "闭菊") {
            console.log(
              `群 ${event.group_id} 停止了小夜服务`.error
            );
            await utils.DisableGroupService(event.group_id);
            res.send({
              reply: `小夜的菊花闭上了，小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${event.self_id}]`,
            });
            return 0;
          }

          // qq端插件应答器
          const pluginsReply = await ProcessExecute(
            event.message,
            event.user_id,
            event?.sender?.nickname,
            event.group_id,
            (await axios.get(
              `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_info?group_id=${event.group_id}&no_cache=1`
            )).data.data.group_name,
            {
              selfId: event.self_id,
              targetId: event.sub_type == "poke" ? event.target_id : null,
              type: "qq",
            }
          );
          if (pluginsReply != "") {
            const replyToQQ = utils.PluginAnswerToGoCqhttpStyle(pluginsReply);
            axios.get(
              `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(replyToQQ)}`
            );
          }

          // 戳一戳
          if (
            event.sub_type === "poke" &&
            event.target_id == event.self_id
          ) {
            logger.info("小夜被戳了".log);
            c1c_count++;

            if (c1c_count > 2) {
              logger.info(
                `小夜被戳坏了，${event.user_id} 被禁言10s`.error,
              );
              c1c_count = 0;
              axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(QQ_GROUP_POKE_BOOM_REPLY_MESSAGE)}`);
              axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${event.group_id}&user_id=${event.user_id}&duration=10`);
            } else {
              // 被戳的回复
              axios.get(
                `http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(QQ_GROUP_POKE_REPLY_MESSAGE)}`
              );
            }
            return 0;
          }

          // 嘴臭，小夜的回复转化为语音
          if (Constants.come_yap_reg.test(event.message)) {
            const message = event.message.match(Constants.come_yap_reg)[1];
            console.log(`有人对线说 ${message}，小夜要嘴臭了`.log);
            io.emit(
              "system message",
              `@有人对线说 ${message}，小夜要嘴臭了`,
            );
            ChatProcess(message)
              .then((reply) => {
                plugins.tts.execute(`吠 ${reply}`)
                  .then((resolve) => {
                    const tts_file = `[CQ:record,file=http://127.0.0.1:${WEB_PORT}${resolve.file},url=http://127.0.0.1:${WEB_PORT}${resolve.file}]`;
                    res.send({ reply: tts_file });
                  })
                  .catch((reject) => {
                    console.log(`TTS错误: ${reject}`.error);
                  });
              });
            return 0;
          }

          // 伪造转发
          if (Constants.fake_forward_reg.test(event.message)) {
            let who,
              name = event.sender.nickname,
              text,
              xiaoye_say,
              requestData;
            if (event.message == "强制迫害") {
              who = event.sender.user_id; // 如果没有要求迫害谁，那就是迫害自己
            } else {
              let msg = event.message + " "; // 结尾加一个空格防爆

              // for (let i in msg.substr(i).split(" ")) {
              //   console.log(msg[i]);
              // }

              msg = msg.substr(4).split(" ");
              who = msg[1].trim(); // 谁
              text = msg[2].trim(); // 说啥
              xiaoye_say = msg[3].trim(); // 小夜说啥
              who = event.message.match(Constants.fake_forward_reg)[1];
              who = who.replace("[CQ:at,qq=", "").replace("]", "").trim();
              if (Constants.is_qq_reg.test(who)) {
                console.log(
                  `群 ${event.group_id} 的 群员 ${event.user_id} 强制迫害 ${who}`
                    .log,
                );
              } else {
                // 目标不是qq号
                who = event.sender.user_id; // 如果没有要求迫害谁，那就是迫害自己
              }
            }

            if (!name) {
              name = event.sender.nickname;
            }

            if (!text) {
              text = "我是群友专用RBQ";
            }

            if (!xiaoye_say) {
              xiaoye_say =
                "[CQ:image,file=1ea870ec3656585d4a81e13648d66db5.image,url=https://gchat.qpic.cn/gchatpic_new/1277161008/2063243247-2238741340-1EA870EC3656585D4A81E13648D66DB5/0?term=3]";
            }

            // 发送
            // 先获取昵称
            request(
              `http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_info?group_id=${event.group_id}&user_id=${who}&no_cache=0`,
              function (error, _response, body) {
                if (!error) {
                  body = JSON.parse(body);
                  name = body.data.nickname;

                  requestData = {
                    group_id: event.group_id,
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
                    group_id: event.group_id,
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

          // 埋地雷
          if (Constants.mine_reg.test(event.message)) {
            // 搜索地雷库中现有地雷
            const mines = await utils.GetGroupAllMines(event.group_id);

            // 该群是否已经达到最大共存地雷数
            if (mines.length < QQBOT_MAX_MINE_AT_MOST) {
              // 地雷还没满，增加群地雷
              await utils.AddOneGroupMine(event.group_id, event.user_id);

              console.log(
                `${event.user_id} 在群 ${event.group_id} 埋了一颗地雷`
                  .log,
              );
              res.send({
                reply: `大伙注意啦![CQ:at,qq=${event.user_id}]埋雷干坏事啦!`,
              });
            }
            // 雷满了，不能埋了
            else {
              console.log(`群 ${event.group_id} 的地雷满了`.log);
              res.send({
                reply: `[CQ:at,qq=${event.user_id}] 这个群的地雷已经塞满啦，等有幸运群友踩中地雷之后再来埋吧`,
              });
            }

            return 0;
          }

          // 踩地雷
          if (Constants.fuck_mine_reg.test(event.message)) {
            // 搜索地雷库中现有地雷
            const mine = await utils.GetGroupMine(event.group_id);

            if (mine) {
              // 先把地雷排掉
              await utils.DeleteGroupMine(mine.id);

              // 有雷，直接炸
              const boomTime = Math.floor(Math.random() * 60 * 3) + 60; // 造成伤害时间，随机在60-180秒内
              console.log(
                `${mine.owner} 在群 ${mine.groupId} 埋的地雷被排爆`.log,
              );
              res.send({
                reply: `[CQ:at,qq=${event.user_id}] 踩了一脚地雷，为什么要想不开呢，被[CQ:at,qq=${mine.owner}]所埋地雷炸成重伤，休养生息${boomTime}秒!`,
                ban: 1,
                ban_duration: boomTime,
              });
            } else {
              // 没有雷
              res.send({
                reply: `[CQ:at,qq=${event.user_id}] 这个雷区里的雷似乎已经被勇士们排干净了，不如趁现在埋一个吧!`,
              });
            }

            return 0;
          }

          // 希望的花
          if (Constants.hope_flower_reg.test(event.message)) {
            let who;
            let boomTime = Math.floor(Math.random() * 30); // 造成0-30伤害时间
            if (event.message === "希望的花") {
              console.log(
                `群 ${event.group_id} 的群员 ${event.user_id} 朝自己丢出一朵希望的花`
                  .log,
              );
              res.send({
                reply: "团长，你在做什么啊！团长！希望的花，不要乱丢啊啊啊啊",
              });
              return 0;
            } else {
              who = Constants.has_qq_reg.exec(event.message)[1];
              if (Constants.is_qq_reg.test(who)) {
                console.log(
                  `群 ${event.group_id} 的 群员 ${event.user_id} 向 ${who} 丢出一朵希望的花`
                    .log,
                );
              } else {
                // 目标不是qq号
                res.send({
                  reply: `团长，你在做什么啊！团长！希望的花目标不可以是${who}，不要乱丢啊啊啊啊`,
                });
                return 0;
              }
            }

            // 先救活目标
            axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${event.group_id}&user_id=${who}&duration=0`);
            console.log(
              `群 ${event.group_id} 的 群员 ${event.user_id} 救活了 ${who}`.log,
            );
            res.send({
              reply: `团长，团长你在做什么啊团长，团长！为什么要救他啊，哼，呃，啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊！！！团长救下了[CQ:at,qq=${who}]，但自己被炸飞了，休养生息${boomTime}秒！不要停下来啊！`,
            });

            // 再禁言团长
            axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${event.group_id}&user_id=${event.user_id}&duration=${boomTime}`);
            console.log(
              `${event.user_id} 团长自己被炸伤${boomTime}秒`.log,
            );
            return 0;
          }

          // 击鼓传雷
          if (Constants.loop_bomb_reg.test(event.message)) {
            // 先检查群有没有开始游戏
            const loopBombGame = await utils.GetGroupLoopBombGameStatus(event.group_id);

            // 判断游戏开关，没有开始的话就开始游戏，如果游戏已经超时结束了的话就重新开始
            if (
              !loopBombGame.loopBombEnabled ||
              60 - process.hrtime([loopBombGame.loopBombStartTime, 0])[0] < 0
            ) {
              // 游戏开始
              const text = "击鼓传雷游戏开始啦，这是一个只有死亡才能结束的游戏，做好准备了吗";
              axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(text)}`);
              console.log(
                `群 ${event.group_id} 开始了击鼓传雷`.log,
              );

              // 给发起人出题，等待ta回答
              const wenDa = await ECYWenDa();

              const question = `那么[CQ:at,qq=${event.user_id}]请听题：${wenDa.question} 请按如下格式告诉小夜：击鼓传雷 你的答案，时间剩余59秒`;

              // 把答案、持有人、开始时间存入数据库
              await utils.StartGroupLoopBombGame(event.group_id, wenDa.answer, event.user_id, process.hrtime()[0]);

              // 金手指
              axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${event.group_id}&user_id=${event.user_id}&card=${encodeURI(wenDa.answer)}`);

              // 丢出问题
              setTimeout(() => {
                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(question)}`);
              }, 1000);

              // 开始倒计时，倒计时结束宣布游戏结束
              boomTimer = setTimeout(async () => {
                console.log(
                  `群 ${event.group_id} 的击鼓传雷到达时间，炸了`.log
                );
                const boomTime = Math.floor(Math.random() * 60 * 3) + 60; // 造成伤害时间，随机在60-180秒内

                // 获取这个雷现在是谁手上，炸ta
                const { bombHolder, bombAnswer } = await utils.GetGroupLoopBomb(event.group_id);

                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${event.group_id}&user_id=${bombHolder}&duration=${boomTime}`);
                console.log(
                  `${bombHolder} 在群 ${event.group_id} 回答超时，被炸伤${boomTime}秒`.log
                );

                // 金手指关闭
                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${event.group_id}&user_id=${bombHolder}&card=`);

                const gameOverContent = `时间到了，pia，雷在[CQ:at,qq=${bombHolder}]手上炸了，你被炸成重伤了，休养生息${boomTime}秒！游戏结束！下次加油噢，那么答案公布：${bombAnswer}`;

                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(gameOverContent)}`);

                // 游戏结束，清空数据
                await utils.EndGroupLoopBombGame(event.group_id);

                return 0;
              }, 1000 * 60);
            }
            // 已经开始游戏了，判断答案对不对
            else {
              let playerAnswer = event.message;
              playerAnswer = playerAnswer.replace("击鼓传雷 ", "");
              playerAnswer = playerAnswer.replace("击鼓传雷", "");
              playerAnswer = playerAnswer.trim();

              // 从数据库里取答案判断
              const { bombHolder, bombAnswer } = await utils.GetGroupLoopBomb(event.group_id);

              // 判断答案 loop_bomb_answer
              if (bombAnswer == playerAnswer) {
                let reply = "";

                // 答对了
                if (bombHolder != event.user_id) {
                  // 不是本人回答，是来抢答的，无论对错都惩罚
                  console.log(
                    `抢答了，${event.user_id} 被禁言`.log,
                  );
                  reply = `[CQ:at,qq=${event.user_id}] 抢答正确！答案确实是 ${bombAnswer} ！但因为抢答了别人的题目所以被惩罚了！`;

                  // 金手指关闭
                  axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${event.group_id}&user_id=${bombHolder}&card=`);

                  // 禁言这个游戏周期
                  axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${event.group_id}&user_id=${event.user_id}&duration=60`);
                }
                // 回答正确
                else {
                  console.log(`${bombHolder} 回答正确`.log);
                  reply = `[CQ:at,qq=${event.user_id}] 回答正确！答案确实是 ${bombAnswer} ！`;

                  // 金手指关闭
                  axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${event.group_id}&user_id=${bombHolder}&card=`);
                }

                // 答题成功，返回消息
                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(reply)}`);

                // 把雷传给随机幸运群友，进入下一题
                setTimeout(async () => {
                  // 随机选一位幸运群友
                  const randomMember = await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/get_group_member_list?group_id=${event.group_id}`)
                    .then(async (response) => {
                      const members = response.data.data;
                      const randomMember = members[Math.floor(Math.random() * members.length)].user_id;
                      console.log(
                        `随机选取一个群友 ${randomMember} 给他下一题`.log
                      );
                      return randomMember;
                    });

                  // 开始下一轮游戏，，给幸运群友出题，等待ta回答

                  console.log(
                    `群 ${event.group_id} 开始了下一轮击鼓传雷`.log
                  );

                  //获取剩余时间
                  const { bombStartTime } = await utils.GetGroupLoopBomb(event.group_id);
                  const diff = 60 - process.hrtime([bombStartTime, 0])[0]; // 剩余时间

                  const wenDa = await ECYWenDa();

                  const question = `抽到了幸运群友[CQ:at,qq=${randomMember}]！请听题：${wenDa.question} 请按如下格式告诉小夜：击鼓传雷 你的答案，时间还剩余${diff}秒`;

                  // 把答案、持有人存入数据库
                  await utils.UpdateGroupLoopBombGame(event.group_id, wenDa.answer, randomMember);

                  // 金手指
                  axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${event.group_id}&user_id=${event.user_id}&card=${encodeURI(wenDa.answer)}`);

                  // 丢出问题
                  setTimeout(() => {
                    axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(question)}`);
                  }, 1000);

                  return 0;
                }, 500);
              }
              // 答错了，游戏结束
              else {
                const boomTime = Math.floor(Math.random() * 60 * 3) + 60; // 造成伤害时间
                const endGameContent = `[CQ:at,qq=${event.user_id}] 回答错误，好可惜，你被炸成重伤了，休养生息${boomTime}秒！游戏结束！下次加油噢，那么答案公布：${bombAnswer}`;

                console.log(
                  `${event.user_id} 回答错误，被炸伤${boomTime}秒`.log,
                );

                // 禁言
                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_ban?group_id=${event.group_id}&user_id=${event.user_id}&duration=${boomTime}`);

                clearTimeout(boomTimer);

                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/send_group_msg?group_id=${event.group_id}&message=${encodeURI(endGameContent)}`);


                // 游戏结束，删掉游戏记录
                await utils.EndGroupLoopBombGame(event.group_id);


                // 金手指关闭
                axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/set_group_card?group_id=${event.group_id}&user_id=${bombHolder}&card=`);
                return 0;
              }
            }
          }

          // 孤寡
          if (Constants.gu_gua_reg.test(event.message)) {
            if (event.message == "孤寡") {
              res.send({
                reply: "小夜收到了你的孤寡订单，现在就开始孤寡你了噢孤寡~",
              });
              utils.GuGua(event.user_id);
              return 0;
            }

            const who = Constants.has_qq_reg.exec(event.message)[1];
            console.log(`孤寡对象：${who}`.log);
            if (Constants.is_qq_reg.test(who)) {
              axios.get(
                `http://${GO_CQHTTP_SERVICE_API_URL}/get_friend_list`,
              ).then((response) => {
                if (response.length != 0) {
                  // 判断 who 是否在 response.data.data 数组里
                  const userExist = response.data.data.some((item) => {
                    return item.user_id == who;
                  });

                  if (userExist) {
                    console.log(
                      `群 ${event.group_id} 的 群员 ${event.user_id} 孤寡了 ${who}`.log,
                    );
                    res.send({
                      reply: `小夜收到了你的孤寡订单，现在就开始孤寡[CQ:at,qq=${who}]了噢孤寡~`,
                    });
                    axios.get(
                      `http://${GO_CQHTTP_SERVICE_API_URL}/send_private_msg?user_id=${who}&message=${encodeURI(
                        `您好，我是孤寡小夜，您的好友 ${event.user_id} 给您点了一份孤寡套餐，请查收`,
                      )}`
                    );
                    utils.GuGua(who);
                    return 0;
                  }
                  // 没有加好友，不能私聊孤寡
                  else {
                    res.send({
                      reply: `小夜没有加[CQ:at,qq=${who}]为好友，没有办法孤寡ta呢，请先让ta加小夜为好友吧，为了补偿，小夜就在群里孤寡大家吧`,
                    });
                    utils.QunGuGua(event.group_id);
                    return 0;
                  }
                }
              });
            } else {
              // 目标不是qq号
              console.log("孤寡对象目标不是qq号");
              res.send({
                reply: `你想孤寡谁啊，目标不可以是${who}，不要乱孤寡，小心孤寡你一辈子啊`,
              });
            }
            return 0;
          }

          // 手动复读，复读回复中指定的消息
          if (Constants.reply_reg.test(event.message)) {
            // 从 [CQ:reply,id=-1982767585][CQ:at,qq=1005056803] 复读 消息里获取id
            const msgID = event.message.split("id=")[1].split("]")[0].trim();
            logger.info(`收到手动复读指令，消息id: ${msgID}`.log);

            const historyMessage = (await axios.get(`http://${GO_CQHTTP_SERVICE_API_URL}/get_msg?message_id=${msgID}`)).data.data.message;
            logger.info(`复读历史消息: ${historyMessage}`.log);
            res.send({ reply: historyMessage });
            return 0;
          }

          // 管理员功能: 修改聊天回复率
          if (
            Constants.change_reply_probability_reg.test(event.message)
          ) {
            for (let i in QQBOT_ADMIN_LIST) {
              if (event.user_id == QQBOT_ADMIN_LIST[i]) {
                const replyPercentage = event.message.match(Constants.change_reply_probability_reg)[1];
                QQBOT_REPLY_PROBABILITY = replyPercentage;
                res.send({
                  reply: `小夜回复率已修改为${replyPercentage}%`,
                });
                return 0;
              }
            }
            res.send({
              reply: "你不是狗管理噢，不能让小夜这样那样的",
            });
            return 0;
          }

          // 管理员功能: 修改聊天随机复读率
          if (
            Constants.change_fudu_probability_reg.test(event.message)
          ) {
            for (let i in QQBOT_ADMIN_LIST) {
              if (event.user_id == QQBOT_ADMIN_LIST[i]) {
                const fuduPercentage = event.message.match(Constants.change_fudu_probability_reg)[1];
                QQBOT_FUDU_PROBABILITY = fuduPercentage;
                res.send({
                  reply: `小夜复读率已修改为${fuduPercentage}%`,
                });
                return 0;
              }
            }
            res.send({
              reply: "你不是狗管理噢，不能让小夜这样那样的",
            });
            return 0;
          }

          // 是否触发复读
          const couldRepeat = Math.floor(Math.random() * 100) < QQBOT_FUDU_PROBABILITY;
          if (couldRepeat) {
            console.log(`小夜复读 ${event.message}`.log);
            res.send({ reply: event.message });
            return 0;
          }

          // 是否触发回复
          let replyFlag = Math.floor(Math.random() * 100);
          // 如果被@了，那么回复几率上升80%
          let atReplacedMsg = event.message; // 要把[CQ:at,qq=${event.self_id}] 去除掉，否则聊天核心会乱成一锅粥
          if (new RegExp(`\\[CQ:at,qq=${event.self_id}\\]`).test(event.message)) {
            replyFlag -= 80;
            atReplacedMsg = event.message
              .replace(`[CQ:at,qq=${event.self_id}]`, "")
              .trim(); // 去除@小夜
          }
          // 根据权重回复
          if (replyFlag < QQBOT_REPLY_PROBABILITY) {
            let replyMsg = await ChatProcess(atReplacedMsg);

            if (replyMsg.indexOf("[name]") || replyMsg.indexOf("&#91;name&#93;")) {
              replyMsg = replyMsg.toString()
                .replace("[name]", `[CQ:at,qq=${event.user_id}]`); // 替换[name]为正确的@
              replyMsg = replyMsg.toString()
                .replace("&#91;name&#93;", `[CQ:at,qq=${event.user_id}]`,); // 替换[name]为正确的@
            }

            console.log(`对于QQ聊天 ${atReplacedMsg} ，小夜回复 ${replyMsg}`.log);
            res.send({ reply: replyMsg });
            return 0;

          } else {
            res.send(); // 相当于严格模式，如果有多条res.send将会报错 `重复响应`
          }
        }
      }
    } else if (
      event.message_type == "private" &&
      QQBOT_PRIVATE_CHAT_SWITCH == true
    ) {
      // 私聊回复
      ChatProcess(event.message)
        .then((resolve) => {
          logger.info(`小夜回复 ${resolve}`.log);
          io.emit("system", `@小夜回复: ${resolve}`);
          res.send({ reply: resolve });
        });
      return 0;
    } else {
      res.send();
      return 0;
    }
  });

  // 每隔24小时搜索qqGroup表，随机延时提醒停用服务的群启用服务
  setInterval(async () => await utils.DelayAlert(), 1000 * 60 * 60 * 24);
}

/**
 * qq内嵌频道的消息处理，并非独立的qq频道
 */
async function ProcessGuildMessage(event) {
  const content = event.message;
  // qq内嵌频道插件应答器
  const pluginsReply = await ProcessExecute(
    content,
    event.user_id,
    event?.sender?.nickname,
    event.channel_id,
    "",
    {
      type: "qqInsideGuild",
    }
  );

  let replyToGuild = "";
  if (pluginsReply) {
    replyToGuild = utils.PluginAnswerToGoCqhttpStyle(pluginsReply);
  } else {
    // 交给聊天函数处理
    const replyFlag = Math.floor(Math.random() * 100);
    if (replyFlag < QQBOT_REPLY_PROBABILITY) {
      const chatReply = await ChatProcess(content);
      if (chatReply) {
        console.log(`对于QQ频道聊天 ${content} ，小夜回复 ${chatReply}`.log);
        replyToGuild = chatReply;
      }
    }
  }

  if (replyToGuild) {
    axios.get(
      `http://${GO_CQHTTP_SERVICE_API_URL}/send_guild_channel_msg?guild_id=${event.guild_id}&channel_id=${event.channel_id}&message=${encodeURI(replyToGuild)}`
    );
  }
}

/**
 * b站直播端消息处理，虚拟主播星野夜蝶上线!
 */
async function StartLive() {
  const live = new KeepLiveTCP(BILIBILI_LIVE_ROOM_ID);
  live.on("open", () => logger.info(`哔哩哔哩直播间 ${BILIBILI_LIVE_ROOM_ID} 连接成功`.log));

  live.on("live", () => {
    live.on("heartbeat", (online) => logger.info(`直播间在线人数: ${online}`.log));

    live.on("DANMU_MSG", async (data) => {
      const danmu = {
        content: data.info[1],
        userId: data.info[2][0],
        userName: data.info[2][1]
      };

      console.log(`${danmu.userName} 说: ${danmu.content}`.log);

      // 哔哩哔哩端插件应答器
      const pluginsReply = await ProcessExecute(
        danmu.content,
        danmu.userId,
        danmu.userName,
        "",
        "",
        {
          type: "bilibili",
        }
      ) ?? "";
      let replyToBiliBili = "";
      if (pluginsReply) {
        // 插件响应弹幕
        replyToBiliBili = pluginsReply;
      } else {
        // 交给聊天函数处理
        const chatReply = await ChatProcess(danmu.content);
        if (chatReply) {
          replyToBiliBili = chatReply;
        }
      }

      fs.writeFileSync(Constants.TTS_FILE_RECV_PATH, `@${danmu.userName} ${replyToBiliBili}`);
      const chatReplyToTTS = await plugins.tts.execute(`吠 ${replyToBiliBili}`);

      // 如果语音合成成功的话，直接播放
      if (chatReplyToTTS.content.file) {
        const ttsFile = `${process.cwd()}/static${chatReplyToTTS.content.file}`;
        voicePlayer.play(ttsFile, function (err) {
          if (err) {
            console.log("播放失败：", err);
          }
        });
      }
    });

    live.on("SEND_GIFT", (data) => {
      const gift = data.data;
      console.log(`${gift.uname}送了 ${gift.num} 个 ${gift.giftName}`.log);
    });

    live.on("WELCOME", (data) => {
      const welcome = data.data;
      console.log(`${welcome.uname} 进入直播间`.log);
    });

    live.on("WELCOME_GUARD", (data) => {
      const welcome = data.data;
      console.log(`${welcome.uname} 进入直播间`.log);
    });
  });
}

/**
 * qq频道消息处理，需要注册独立的qq频道bot号
 */
async function StartQQGuild() {
  const testConfig = {
    appID: QQ_GUILD_APP_ID,
    token: QQ_GUILD_TOKEN,
    intents: ["GUILD_MESSAGES"], // 事件订阅,用于开启可接收的消息类型
    sandbox: true, // 沙箱频道
  };
  const qqGuildClient = createOpenAPI(testConfig);
  const qqGuildWS = createWebsocket(testConfig);

  // 消息监听
  qqGuildWS.on("READY", (data) => {
    console.log("[READY] 事件接收 :", data);
  });
  qqGuildWS.on("ERROR", (data) => {
    console.log("[ERROR] 事件接收 :", data);
  });
  qqGuildWS.on("GUILDS", (data) => {
    console.log("[GUILDS] 事件接收 :", data);
  });
  qqGuildWS.on("GUILD_MEMBERS", (data) => {
    console.log("[GUILD_MEMBERS] 事件接收 :", data);
  });
  qqGuildWS.on("GUILD_MESSAGE_REACTIONS", (data) => {
    console.log("[GUILD_MESSAGE_REACTIONS] 事件接收 :", data);
  });
  qqGuildWS.on("DIRECT_MESSAGE", (data) => {
    console.log("[DIRECT_MESSAGE] 事件接收 :", data);
  });
  qqGuildWS.on("INTERACTION", (data) => {
    console.log("[INTERACTION] 事件接收 :", data);
  });
  qqGuildWS.on("MESSAGE_AUDIT", (data) => {
    console.log("[MESSAGE_AUDIT] 事件接收 :", data);
  });
  qqGuildWS.on("FORUMS_EVENT", (data) => {
    console.log("[FORUMS_EVENT] 事件接收 :", data);
  });
  qqGuildWS.on("AUDIO_ACTION", (data) => {
    console.log("[AUDIO_ACTION] 事件接收 :", data);
  });
  qqGuildWS.on("GUILD_MESSAGES", async (data) => {
    console.log("[GUILD_MESSAGES] 事件接收 :", data);

    // 需要把指令前 <@!1234567890 > 和 [sandbox] 移除
    const content = data.msg.content?.replace(/<@!\d+> /g, "").replace(/\[sandbox\]/g, "");

    // QQ频道端插件应答器
    const pluginsReply = await ProcessExecute(
      content,
      data.msg.author.id,
      data.msg.author.username,
      data.msg.channel_id,
      "",
      {
        type: "qqGuild",
      }
    );

    const channelID = data.msg.channel_id;
    const replyMsgID = data.msg.id;

    if (pluginsReply) {
      const replyToQQGuild = utils.PluginAnswerToQQGuildStyle(pluginsReply);

      if (replyToQQGuild?.audio) {
        const message = {
          audio_url: replyToQQGuild.audio,
          msg_id: replyMsgID,
          text: replyToQQGuild.text,
          state: Constants.AUDIO_START,
        };

        qqGuildClient.audioApi.postAudio(channelID, message)
          .then((res) => {
            console.log("[GUILD_MESSAGES] 语音应答成功 :", res);
          })
          .catch((err) => {
            console.log("[GUILD_MESSAGES] 语音应答失败 :", err);
          });
      } else {
        const message = {
          content: replyToQQGuild?.text ?? "",
          msg_id: replyMsgID,
          image: replyToQQGuild?.image ?? "",
        };

        qqGuildClient.messageApi.postMessage(channelID, message)
          .then((res) => {
            console.log("[GUILD_MESSAGES] 插件应答成功 :", res.data);
          })
          .catch((err) => {
            console.log("[GUILD_MESSAGES] 插件应答失败 :", err);
          });
      }
    } else {
      // 交给聊天函数处理
      const replyFlag = Math.floor(Math.random() * 100);
      if (replyFlag < QQBOT_REPLY_PROBABILITY) {
        const chatReply = await ChatProcess(content);
        if (chatReply) {
          console.log(`对于QQ频道Bot端聊天 ${content} ，小夜回复 ${chatReply}`.log);
          const message = {
            content: chatReply,
            msg_id: replyMsgID,
          };

          qqGuildClient.messageApi.postMessage(channelID, message)
            .then((res) => {
              console.log("[GUILD_MESSAGES] 聊天应答成功 :", res.data);
            })
            .catch((err) => {
              console.log("[GUILD_MESSAGES] 聊天应答失败 :", err);
            });
        }
      }
    }
  });
}

/**
 * Telegram端消息处理
 */
async function StartTelegram() {
  const telegramClient = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  telegramClient.on("message", async (data) => {
    const chatId = data.chat.id;
    const content = data.text;
    const userName = data.from.username;
    logger.info(`[Telegram] 收到用户 ${userName} 的消息: ${content}`);

    // Telegram插件应答器
    const pluginsReply = await ProcessExecute(
      content,
      data.from.id,
      userName,
      chatId,
      "",
      {
        type: "telegram",
      }
    );

    if (pluginsReply) {
      const replyToTelegram = utils.PluginAnswerToTelegramStyle(pluginsReply);
      if (pluginsReply.type == "text") {
        telegramClient.sendMessage(chatId, replyToTelegram.text);
      }
      else if (pluginsReply.type == "picture" || pluginsReply.type == "directPicture") {
        telegramClient.sendPhoto(chatId, replyToTelegram.image, {}, {
          contentType: "image/jpeg",
        });
      }
      else if (pluginsReply.type == "audio") {
        telegramClient.sendAudio(chatId, replyToTelegram.audio, {
          title: replyToTelegram.text,
          duration: replyToTelegram.duration,
        }, {
          contentType: "audio/mpeg",
        });
      }
    } else {
      // 交给聊天函数处理
      const replyFlag = Math.floor(Math.random() * 100);
      if (replyFlag < QQBOT_REPLY_PROBABILITY) {
        const chatReply = await ChatProcess(content);
        if (chatReply) {
          console.log(`对于Telegram端聊天 ${content} ，小夜回复 ${chatReply}`.log);
          telegramClient.sendMessage(chatId, chatReply);
        }
      }
    }
  });
}

/**
 * 更改web端个人资料接口
 */
app.get("/profile", async (req, res) => {
  await utils.UpdateNickname(req.query.CID, req.query.name);
  res.sendFile(process.cwd() + Constants.HTML_PATH);
});

/**
 * web端图片上传接口
 */
app.post("/upload/image", upload.single("file"), function (req) {
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
app.post("/upload/file", upload.single("file"), function (req) {
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
  CONNECT_QQ_GUILD_SWITCH = config.System.CONNECT_QQ_GUILD_SWITCH ?? false;
  CONNECT_TELEGRAM_SWITCH = config.System.CONNECT_TELEGRAM_SWITCH ?? false;
  WEB_PORT = config.System.WEB_PORT ?? 80;
  GO_CQHTTP_SERVICE_ANTI_POST_API = config.System.GO_CQHTTP_SERVICE_ANTI_POST_API ?? "/bot";
  GO_CQHTTP_SERVICE_API_URL = config.System.GO_CQHTTP_SERVICE_API_URL ?? "127.0.0.1:5700";

  QQ_GUILD_APP_ID = config.ApiKey.QQ_GUILD_APP_ID ?? "";
  QQ_GUILD_TOKEN = config.ApiKey.QQ_GUILD_TOKEN ?? "";

  TELEGRAM_BOT_TOKEN = config.ApiKey.TELEGRAM_BOT_TOKEN ?? "";

  QQBOT_ADMIN_LIST = config.qqBot.QQBOT_ADMIN_LIST; // 小夜的管理员列表
  QQ_GROUP_WELCOME_MESSAGE = config.qqBot.QQ_GROUP_WELCOME_MESSAGE; // qq入群欢迎语
  QQ_GROUP_POKE_REPLY_MESSAGE = config.qqBot.QQ_GROUP_POKE_REPLY_MESSAGE; // 戳一戳的文案
  QQ_GROUP_POKE_BOOM_REPLY_MESSAGE = config.qqBot.QQ_GROUP_POKE_BOOM_REPLY_MESSAGE; // 戳坏了的文案
  AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH = config.qqBot.AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH; // 自动批准好友请求开关
  QQBOT_PRIVATE_CHAT_SWITCH = config.qqBot.QQBOT_PRIVATE_CHAT_SWITCH; // 私聊开关
  CHAT_JIEBA_LIMIT = config.qqBot.CHAT_JIEBA_LIMIT; // qqBot限制分词数量
  QQBOT_REPLY_PROBABILITY = config.qqBot.QQBOT_REPLY_PROBABILITY; // 回复几率
  QQBOT_FUDU_PROBABILITY = config.qqBot.QQBOT_FUDU_PROBABILITY; // 复读几率
  QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH = config.qqBot.QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH; // 保存接收图片开关
  QQBOT_MAX_MINE_AT_MOST = config.qqBot.QQBOT_MAX_MINE_AT_MOST; // 最大共存地雷数

  BILIBILI_LIVE_ROOM_ID = config.Others.BILIBILI_LIVE_ROOM_ID ?? 49148; // 哔哩哔哩直播间id

  if (CHAT_SWITCH) {
    logger.info("小夜web端自动聊天开启".on);
  } else {
    logger.info("小夜web端自动聊天关闭".off);
  }

  if (CONNECT_GO_CQHTTP_SWITCH) {
    /**
     * 在 Windows、Linux 系统下自动启动go-cqhttp
     */
    const autoStartGoCqhttpSystemCondition = ["win32", "linux"];
    const goCqhttpFile = { win32: "go-cqhttp.bat", linux: "./go-cqhttp -faststart" };
    if (autoStartGoCqhttpSystemCondition.includes(process.platform)) {
      const goCqhttp = exec(goCqhttpFile[process.platform], {
        cwd: path.join(process.cwd(), "plugins", "go-cqhttp"),
        windowsHide: true,
      }, (error) => {
        if (error) {
          logger.error(`go-cqhttp启动失败，错误原因: ${error}`.error);
          return;
        }
        logger.error("go-cqhttp窗口意外退出，qq小夜将无法正常使用，请在右下角托盘区右键小夜头像，选择 重启go-cqhttp".error);
        return;
      });

      /**
       * 在 Linux 系统下直接输出 go-cqhttp 的打印信息
       */
      if (process.platform === "linux") {
        goCqhttp.stdout.on("data", function (data) {
          console.log(data.toString());
        });
      }
    }

    logger.info(
      `小夜QQ接入开启，配置: \n  ·对接go-cqhttp接口 ${GO_CQHTTP_SERVICE_API_URL}\n  ·监听反向post于 127.0.0.1:${WEB_PORT}${GO_CQHTTP_SERVICE_ANTI_POST_API}\n  ·私聊服务${QQBOT_PRIVATE_CHAT_SWITCH ? "开启" : "关闭"}`.on,
    );
    await StartQQBot();
  } else {
    logger.info("小夜QQ接入关闭".off);
  }

  if (CONNECT_BILIBILI_LIVE_SWITCH) {
    logger.info(
      `小夜哔哩哔哩直播接入开启，直播间id为 ${BILIBILI_LIVE_ROOM_ID}`.on,
    );
    StartLive();
  } else {
    logger.info("小夜哔哩哔哩直播接入关闭".off);
  }

  if (CONNECT_QQ_GUILD_SWITCH) {
    logger.info("小夜QQ频道接入开启".on);
    StartQQGuild();
  } else {
    logger.info("小夜QQ频道接入关闭".off);
  }

  if (CONNECT_TELEGRAM_SWITCH) {
    logger.info("小夜Telegram接入开启".on);
    StartTelegram();
  } else {
    logger.info("小夜Telegram接入关闭".off);
  }

  StartHttpServer();

  CheckUpdate();

  RunMigration();
}

/**
 * HTTP服务器启动
 */
function StartHttpServer() {
  http.listen(WEB_PORT, () => {
    logger.info(`HTTP服务启动完毕，访问 127.0.0.1:${WEB_PORT} 即可进入本地web端√`.log);
  });
};

http.on("error", (err) => {
  http.close();
  logger.error(`本机${WEB_PORT}端口被其他应用程序占用，请尝试关闭占用${WEB_PORT}端口的其他程序 或 修改配置文件的 WEB_PORT 配置项。错误代码：${err.code}`.error);
  setTimeout(() => StartHttpServer(), 10000);
});

const UnauthorizedHttpsAgent = new https.Agent({ rejectUnauthorized: false }); // #303，Watt Toolkit(Steam++)的自签证书问题

/**
 * 检查本体更新
 */
function CheckUpdate() {
  axios.get(
    "https://api.github.com/repos/Giftia/ChatDACS/releases/latest", { UnauthorizedHttpsAgent }
  ).then((res) => {
    if (semverDiff(versionNumber, res.data.tag_name) !== undefined) {
      logger.info(`当前小夜版本 ${versionNumber}，检测到小夜最新发行版本是 ${res.data.tag_name}，请前往 https://github.com/Giftia/ChatDACS/releases 更新小夜吧
${res.data.tag_name}更新日志：
${res.data.body}`.alert);
    } else {
      logger.info(`当前小夜已经是最新发行版本 ${versionNumber}`.log);
    }
  }).catch((err) => {
    logger.error(`检查小夜更新失败，错误原因: ${err}，可能是网络原因`.error);
  });
}

/**
 * 数据库migration
 */
function RunMigration() {
  const migration = exec("npm run migrate");
  logger.info("正在检查数据库迁移".log);
  let migrationLog = "";
  migration.stdout.on("data", (data) => {
    migrationLog += data;
  });

  migration.on("close", (code) => {
    if (code === 0) {
      if (migrationLog.includes("database schema was already up to date")) {
        logger.info("数据库迁移检查完毕，无需迁移√".log);
      } else {
        logger.info("数据库迁移检查完毕，迁移完毕√".log);
      }
    } else {
      logger.error(`数据库迁移失败，错误原因: ${migrationLog}`.error);
    }
  });
}

/**
 * 异步结巴 thanks@ssp97
 * @param {Promise<string>} text
 */
async function ChatJiebaFuzzy(msg) {
  msg = msg.replace("/", "");
  msg = jieba.extract(msg, CHAT_JIEBA_LIMIT); // 按权重分词

  if (msg.length === 0) {
    return [];
  }

  let candidate = [];
  let candidateNextList = [];
  let candidateNextGrand = 0;
  // 收集数据开始
  for (const key in msg) {
    if (Object.hasOwnProperty.call(msg, key)) {
      const element = msg[key];
      const rows = await utils.FuzzyContentSearchAnswer(element.word);
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
  return candidateNextList;
}

/**
 * 响应聊天回复，超智能(障)的聊天算法: 全匹配搜索 => 模糊搜索 => 分词模糊搜索 => 敷衍
 * @param {string} ask 关键词
 * @returns {Promise<string>} 小夜回复
 */
async function ChatProcess(ask) {
  //如果ask异常，可能是非聊天事件触发了响应聊天回复，直接敷衍回复
  if (!ask) {
    console.log("ask异常，直接敷衍回复".log);
    const randomBalaBala = await utils.PerfunctoryAnswer();
    console.log(`返回随机敷衍：${randomBalaBala}`.alert);
    return randomBalaBala;
  }

  console.log("开始全匹配搜索".log);
  const fullContentSearchAnswer = await utils.FullContentSearchAnswer(ask);

  // 优先回复全匹配匹配
  if (fullContentSearchAnswer) {
    console.log(`返回全匹配匹配：${fullContentSearchAnswer}`.alert);
    return fullContentSearchAnswer;
  }

  console.log("没有匹配到全匹配回复，开始模糊搜索".log);
  const fuzzyContentSearchAnswer = await utils.FuzzyContentSearchAnswer(ask);

  // 其次是模糊匹配
  if (fuzzyContentSearchAnswer) {
    console.log(`返回模糊匹配：${fuzzyContentSearchAnswer}`.alert);
    return fuzzyContentSearchAnswer;
  }

  // 最后是分词模糊搜索
  console.log("没有匹配到模糊回复，开始分词模糊搜索".log);
  const jiebaCandidateList = await ChatJiebaFuzzy(ask);
  if (jiebaCandidateList.length > 0 && !jiebaCandidateList[0]) {
    const candidateListAnswer = jiebaCandidateList[
      Math.floor(Math.random() * jiebaCandidateList.length)
    ];
    console.log(`返回分词模糊匹配：${candidateListAnswer}`.alert);
    return candidateListAnswer;
  }

  // 如果什么回复都没有匹配到，那么随机敷衍
  console.log("没有匹配到分词模糊搜索，敷衍一下吧".log);
  const randomBalaBala = await utils.PerfunctoryAnswer();
  console.log(`返回随机敷衍：${randomBalaBala}`.alert);
  return randomBalaBala;
}

/**
 * 浓度极高的ACGN圈台词问答题库
 * @returns {Promise<object>} { question, answer }
 */
async function ECYWenDa() {
  const data = (await axios.get("https://api.oddfar.com/yl/q.php?c=2001&encode=json")).data;
  const keyWord = jieba.extract(data.text, CHAT_JIEBA_LIMIT); // 分词出关键词
  if (keyWord.length == 0) {
    // 如果分词不了，那就直接夜爹牛逼
    return {
      question: "啊噢，出不出题了，你直接回答 夜爹牛逼 吧",
      answer: "夜爹牛逼",
    };
  }

  const randomAnswer = keyWord[Math.floor(Math.random() * keyWord.length)].word;
  console.log(
    `原句为: ${data.text}，随机切去关键词 ${randomAnswer} 作为答案`.log,
  );
  // 将答案切除作为问题
  const question = data.text.replace(randomAnswer, "______");
  return { question: question, answer: randomAnswer };
}

/**
 * 插件系统核心
 * @param {string} msg 传入消息
 * @param {string} userId 消息发送者id
 * @param {string} userName 消息发送者昵称
 * @param {string} groupId 消息所属群id
 * @param {string} groupName 消息所属群昵称
 * @param {string} options 其他参数
 * @returns {Promise<string>} 插件回复
 */
async function ProcessExecute(msg, userId, userName, groupId, groupName, options) {
  if (!msg || !userId || !userName || !groupId || !groupName) {
    throw new Error("Invalid input");
  }
  let pluginReturn = "";
  // 插件开关
  try {
    if (Constants.plugins_switch_reg.test(msg)) {
      const pluginName = msg.match(Constants.plugins_switch_reg)[1];
      if (!pluginName) return "插件名获取有误";
      for (const i in plugins) {
        if (plugins[i].插件名 == pluginName) {
          const pluginStatus = await utils.ToggleGroupPlugin(groupId, pluginName);

          console.log(`群${groupId} 的插件 ${pluginName} 状态切换为 ${pluginStatus}`.log);

          return { type: "text", content: `${pluginName} 已${pluginStatus ? "开启" : "关闭"}` };
        }
      }
    }
    else {
      for (const i in plugins) {
        const reg = new RegExp(plugins[i].指令);
        if (reg.test(msg)) {
          const pluginStatus = await utils.GetGroupPluginStatus(groupId, plugins[i].插件名);
          if (!pluginStatus) {
            console.log(`群${groupId} 的插件 ${plugins[i].插件名} 已关闭，不响应`.log);
            return { type: "text", content: `群内的 ${plugins[i].插件名} 已关闭，不响应` };
          };

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
    }
  } catch (e) {
    logger.error(`Error in ProcessExecute: ${e.stack}`.error);
    return `插件爆炸啦：${e.stack}`;
  }
  return pluginReturn;
}

/**
 * 我正在听：🎧 Eutopia - 法元明菜
 */
