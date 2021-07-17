/*
Giftina：https://giftia.moe
一个无需服务器，可私有化部署、可独立运行于内网的H5聊天工具

初次使用请看:
  首先去 https://nodejs.org/zh-cn/ 安装长期支持版Node.js
  接着启动cmd或powershell,进入代码根目录运行:
    npm install -g cnpm --registry=https://registry.npm.taobao.org
  等待进度完成后运行:
    cnpm install
  等待进度完成后运行:
    node index.js
  也可在Node.js安装完毕后双击目录下的 init.bat 一键部署
  部署完毕后会自动启动，之后可双击 run.bat 启动
  或使用pm2守护神启动:
    pm2 start index.js
  访问127.0.0.1即可体验,有公网或穿透那更好,尽情使用吧~

  若使用pm2守护神启动:
  隐藏界面请按:  Ctrl + C
  查看监视器请运行:  pm2 monit
  完全关闭请运行:  pm2 kill

  另外，若想使用更完善的功能，请访问以下申请地址，申请自己的接口密钥后，修改目录下的 keys.ini 文件：
  -- 天行接口，用于 随机昵称 与 舔狗 功能，申请地址 https://www.tianapi.com/
  -- 卡特实验室接口，用于 随机买家秀 功能，申请地址 https://api.sumt.cn/

  目录下的 userdicy.txt 是自定义分词表，用于提高聊天智能
  修改时请注意，一个关键词占一行，每一行按顺序分为三部分：词语、词频（省略则交给分词器自动计算）、词性（可省略），以空格隔开

  每当次版本号迭代,如 1.1.0 --> 1.2.0,意味着需要更新依赖,请运行:  ncu -u  ,等待进度完成后运行:  cnpm install
  出现任何缺失的依赖包请运行:  cnpm install 缺失的包名
  版本号的改变规律,如 1.2.3-45,形如 A.B.C-D:
    A 大版本号,当整端重构或出现不向后兼容的改变时增加A,更新代码需要更新依赖,且需要重载数据库
    B 次版本号,功能更新,当功能增加、修改或删除时增加B,更新代码需要更新依赖
    C 尾版本号,表示小修改,如修复一些重要bug时增加C,更新代码可以不更新依赖
    D 迭代号,表示最小修改版本,用于体现该版本稳定性

    致谢（排名不分先后）：https://niconi.co.ni/、https://www.layui.com/、https://lceda.cn/、https://www.dnspod.cn/、Daisy_Liu、http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html、https://ihateregex.io/、https://www.maoken.com/、https://www.ngrok.cc/、https://uptimerobot.com/、https://shields.io/、https://ctf.bugku.com/、https://blog.squix.org/、https://hostker.com/、https://www.tianapi.com/、https://api.sumt.cn/、https://github.com/Mrs4s/go-cqhttp、群419581116、群959746024、https://colorhunt.co/、还有我的朋友们，以及倾心分享知识的各位
*/

//系统参数和开关，根据你的需要改动
const version = "ChatDACS 2.5.1-Alpha"; //版本号，会显示在浏览器tab与标题栏
const chat_swich = 1; //自动聊天开关，需数据库中配置聊天表，自带的数据库已经配置好小夜嘴臭语录，开箱即用
const news_swich = 0; //首屏新闻开关
const jc_swich = 0; //酱菜物联服务开关
const password = "233333"; //配置开门密码
const eval_swich = 0; //动态注入和执行开关，便于调试，但开启有极大风险，最好完全避免启用它，特别是在生产环境部署时
const html = "/static/index.html"; //前端页面路径，old.html为旧版前端

//聊天参数
const topN = 5; //限制分词权重数量，设置得越低，更侧重大意，回复更贴近重点，但容易重复相同的回复；设置得越高，回复会更随意、更沙雕，但更容易答非所问
let reply_probability = 3; //qqBot小夜回复几率，单位是%，可通过 /admin_change_reply_probability 指令更改
let fudu_probability = 1; //qqBot小夜复读几率，单位是%，可通过 /admin_change_fudu_probability 指令更改
let copy_msg_probability = 1; //qqBot小夜抽风几率，转发随机消息，单位是‰

//其他参数
let cos_total_count = 50; //初始化随机cos上限，50个应该比较保守，使用随机cos功能后会自动更新为最新值
const help =
  "主人你好，我是小夜。欢迎使用沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)。在这里，你可以与经过 2w+用户调教养成的人工智能机器人小夜实时聊天，它有着令人激动的、实用的在线涩图功能，还可以和在线的其他人分享你的图片、视频与文件。现在就试试使用在聊天框下方的便捷功能栏吧，功能栏往右拖动还有更多功能。";
const thanks =
  "致谢（排名不分先后）：https://niconi.co.ni/、https://www.layui.com/、https://lceda.cn/、https://www.dnspod.cn/、Daisy_Liu、http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html、https://ihateregex.io/、https://www.maoken.com/、https://www.ngrok.cc/、https://uptimerobot.com/、https://shields.io/、https://ctf.bugku.com/、https://blog.squix.org/、https://hostker.com/、https://www.tianapi.com/、https://api.sumt.cn/、https://github.com/Mrs4s/go-cqhttp、群419581116、群959746024、https://colorhunt.co/、还有我的朋友们，以及倾心分享知识的各位";
const updatelog = `<h1>2.5.1-Alpha，优化与改进：</h1><br/><ul style="text-align:left"><li>·qqBot小夜去除随机舔狗，改为随机回复一些无意义语气词；</li><li>·qqBot小夜将会自动转发传来的消息至web端；</li><li>·qqBot小夜将会概率性复读；</li><li>·qqBot小夜将会概率性抽风；</li><li>·qqBot小夜在被@时提升回复概率；</li><li>·重写了聊天处理函数；</li><li>·修复了web端用户保存图片时没有后缀名的问题；</li><li>·增加了自定义分词黑名单；</li><li>·在web端添加致谢名单；</li></ul>`;

/* 好了！以上就是系统的基本配置，如果没有必要，请不要再往下继续编辑了。请保存本文件。祝使用愉快！ */

//模块依赖和底层配置
let compression = require("compression");
let express = require("express");
let app = require("express")();
app.use(compression());
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
let multer = require("multer");
let upload = multer({ dest: "static/uploads/" }); //用户上传目录
let cookie = require("cookie");
let http = require("http").Server(app);
let io = require("socket.io")(http);
let net = require("net");
let request = require("request");
let sqlite3 = require("sqlite3").verbose();
let db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
let colors = require("colors");
let fs = require("fs");
let path = require("path");
let jieba = require("nodejieba");
const { resolve } = require("path");
jieba.load({
  dict: jieba.DEFAULT_DICT,
  hmmDict: jieba.DEFAULT_HMM_DICT,
  userDict: "userdict.txt",
  idfDict: jieba.DEFAULT_IDF_DICT,
  stopWordDict: "stopWordDict.txt",
});

//错误捕获
process.on("uncaughtException", (err) => {
  io.emit("system message", `未捕获的异常：${err}`);
  console.log(`未捕获的异常，错误：${err}`.error);
});

//promise错误捕获
process.on("unhandledRejection", (err) => {
  io.emit("system message", `未捕获的promise异常：${err}`);
  console.log(`未捕获的promise异常：${err}`.error);
});

//载入api接口密钥配置
ReadApiKey()
  .then((resolve) => {
    jcckapikey = resolve.jcckapikey; //酱菜创客接口key，若不配置则门禁功能失效，平台已跑路，仅剩幻肢
    Tiankey = resolve.Tiankey; //天行接口key
    sumtkey = resolve.sumtkey; //卡特实验室接口key
  })
  .catch((reject) => {
    console.log(`载入api接口密钥文件错误，错误信息：${reject}`);
  });

//debug颜色配置
colors.setTheme({
  ver: "inverse",
  random: "random",
  on: "magenta",
  off: "green",
  warn: "yellow",
  error: "red",
  log: "blue",
});

//固定变量
let onlineusers = 0;
let jcckapikey, Tiankey, sumtkey;

//正则
const door_reg = new RegExp("^/开门 [a-zA-Z0-9]*$"); //匹配开门
const rename_reg = new RegExp("^/rename [\u4e00-\u9fa5a-z0-9]{1,10}$"); //1-10长度的数英汉昵称
const bv2av_reg = new RegExp("^[a-zA-Z0-9]{10,12}$"); //匹配bv号
const isImage_reg = new RegExp("\\[CQ:image,file="); //匹配qqBot图片
const xiaoye_ated = new RegExp("\\[CQ:at,qq=1648468212\\]"); //匹配小夜被@
const change_reply_probability_reg = new RegExp("^/admin_change_reply_probability [0-9]*"); //匹配修改qqBot小夜回复率
const change_fudu_probability_reg = new RegExp("^/admin_change_fudu_probability [0-9]*"); //匹配修改qqBot小夜复读率
const img_url_reg = new RegExp("https(.*term=3)"); //匹配图片地址
const isVideo_reg = new RegExp("^\\[CQ:video,file="); //匹配qqBot图片
const video_url_reg = new RegExp("http(.*term=unknow)"); //匹配视频地址

//若表不存在则新建表
db.run("CREATE TABLE IF NOT EXISTS messages(yyyymmdd char, time char, CID char, message char)");
db.run("CREATE TABLE IF NOT EXISTS users(nickname char, CID char, logintimes long, lastlogintime char)");

console.log(version.ver);

if (chat_swich) {
  console.log("用户配置：自动聊天开启".on);
} else {
  console.log("用户配置：自动聊天关闭".off);
}

if (news_swich) {
  console.log("用户配置：首屏新闻开启".on);
} else {
  console.log("用户配置：首屏新闻关闭".off);
}

if (jc_swich) {
  console.log("用户配置：酱菜物联服务开启".on);
  Connjc();
} else {
  console.log("用户配置：酱菜物联服务关闭".off);
}

if (eval_swich) {
  console.log("用户配置：动态注入和执行开启".on);
} else {
  console.log("用户配置：动态注入和执行关闭".off);
}

http.listen(80, () => {
  console.log(Curentyyyymmdd() + CurentTime() + "系统启动，访问 127.0.0.1 即可使用");
});

//socket接入，开始用户操作
io.on("connection", (socket) => {
  socket.emit("getcookie");
  let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
  if (CID === undefined) {
    socket.emit("getcookie");
    return 0;
  }
  socket.emit("version", version);
  io.emit("onlineusers", ++onlineusers);

  //开始获取用户信息并处理
  GetUserData(CID)
    .then(([nickname, logintimes, lastlogintime]) => {
      console.log(`${Curentyyyymmdd() + CurentTime()}用户 ${nickname}(${CID}) 已连接`.log);

      UpdateLogintimes(CID)
        .then((resolve) => {
          console.log(`update successfully, ${resolve}`);
        })
        .catch((reject) => {
          console.log(`err, ${reject}`);
        });

      UpdateLastLogintime(CID)
        .then((resolve) => {
          console.log(`update successfully, ${resolve}`);
        })
        .catch((reject) => {
          console.log(`err, ${reject}`);
        });

      socket.username = nickname;

      io.emit("system message", `欢迎回来，${socket.username}(${CID}) 。这是你第${logintimes}次访问。上次访问时间：${lastlogintime}`);
    })
    .catch((reject) => {
      //若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作：
      let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
      console.log(`GetUserData(): rejected, and err:${reject}`);
      console.log(`${Curentyyyymmdd() + CurentTime()}新用户 ${CID} 已连接`.log);
      RandomNickname()
        .then((resolve) => {
          db.run(`INSERT INTO users VALUES('${resolve}', '${CID}', '2', '${Curentyyyymmdd()}${CurentTime()}')`);
          socket.username = resolve;
          io.emit("system message", `新用户 ${CID} 已连接。小夜帮你取了一个随机昵称：「${socket.username}」，请前往 更多-设置 来更改昵称`);
          socket.emit("chat message", {
            CID: "0",
            msg: help,
          });
        })
        .catch((reject) => {
          console.log(`随机昵称错误：${reject}`);
        });
    });

  if (news_swich) {
    Getnews()
      .then((resolve) => {
        io.emit("system message", resolve); //过于影响新UI的聊天界面，改为在系统消息显示
      })
      .catch((reject) => {
        console.log(`Getnews(): rejected, and err:${reject}`);
        socket.emit("system message", `Getnews() err:${reject}`);
      });
  }

  socket.on("disconnect", () => {
    onlineusers--;
    io.emit("onlineusers", onlineusers);
    console.log(Curentyyyymmdd() + CurentTime() + "用户 " + socket.username + " 已断开连接");
    io.emit("system message", "用户 " + socket.username + " 已断开连接");
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
    socket.emit("updatelog", updatelog);
  });

  //致谢列表
  socket.on("thanks", () => {
    socket.emit("thanks", thanks);
  });

  //处理接收聊天消息
  socket.on("chat message", (msg) => {
    let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
    var msg = msg.msg;
    msg = msg.replace(/'/g, "[非法字符]"); //防爆
    msg = msg.replace(/</g, "[非法字符]"); //防爆
    msg = msg.replace(/>/g, "[非法字符]"); //防爆
    if (eval_swich) {
      eval(msg);
    }
    var receive_debug = `${Curentyyyymmdd() + CurentTime()}收到用户 ${socket.username}(${CID}) 的消息: ${msg}`;
    console.log(receive_debug.warn);
    db.run(`INSERT INTO messages VALUES('${Curentyyyymmdd()}', '${CurentTime()}', '${CID}', '${msg}')`);

    io.emit("chat message", { CID: CID, name: socket.username, msg: msg }); //用户广播

    if (door_reg.test(msg)) {
      if (jc_swich) {
        if (msg === "/开门 " + password) {
          Opendoor();
          io.emit("chat message", {
            CID: "0",
            msg: "密码已确认，开门指令已发送",
          });
          io.emit("chat message", {
            CID: "0",
            msg: "计算机科创基地提醒您：道路千万条，安全第一条。开门不关门，亲人两行泪。",
          });
          console.log(`${Curentyyyymmdd() + CurentTime()}用户 ${CID} 开门操作`);
        } else {
          io.emit("chat message", { CID: "0", msg: "密码错误，请重试" });
        }
      } else {
        io.emit("chat message", { CID: "0", msg: "酱菜物联服务未启动，故门禁服务一并禁用" });
      }
    } /*else if (msg === "/log") {
      db.all("SELECT * FROM messages", (e, sql) => {
        if (!e) {
          var data = "";
          for (let i = 0; i < sql.length; i++) {
            var time = JSON.stringify(sql[i].time);
            var CID = JSON.stringify(sql[i].CID);
            var message = JSON.stringify(sql[i].message);
            data += "/r/n" + time + CID + message;
          }
          console.log(sql);
          io.emit("chat message", { CID: "0", msg: `${data}<br />共有${sql.length}条记录` });
        } else {
          console.log(e);
          io.emit("chat message", { CID: "0", msg: e });
        }
      });
    }*/ else if (rename_reg.test(msg)) {
      db.run(`UPDATE users SET nickname = '${msg.slice(8)}' WHERE CID ='${CID}'`);
      io.emit("chat message", {
        CID: "0",
        msg: `昵称重命名完毕，小夜现在会称呼你为 ${msg.slice(8)} 啦`,
      });
    } else if (msg === "/log_view") {
      db.all("SELECT yyyymmdd, COUNT(*) As count FROM messages Group by yyyymmdd", (e, sql) => {
        console.log(sql);
        var data = [];
        if (!e) {
          for (let i = 0; i < sql.length; i++) {
            data.push([sql[i].yyyymmdd, sql[i].count]);
          }
          console.log(data);
          io.emit("chart message", data);
        } else {
          console.log(e);
          io.emit("chat message", { CID: "0", msg: e });
        }
      });
    } else if (bv2av_reg.test(msg)) {
      msg = msg.replace(" ", "");
      Bv2Av(msg)
        .then((resolve) => {
          io.emit("chat message", { CID: "0", msg: resolve });
        })
        .catch((reject) => {
          console.log(`Bv2Av(): rejected, and err:${reject}`);
          io.emit("system message", `Bv2Av() err:${reject}`);
        });
    } else if (msg === "/reload") {
      io.emit("reload");
    } else if (msg === "/帮助") {
      io.emit("chat message", { CID: "0", msg: help });
    } else if (msg === "/随机cos") {
      RandomCos()
        .then((resolve) => {
          io.emit("pic message", resolve);
        })
        .catch((reject) => {
          console.log(`RandomCos(): rejected, and err:${reject}`);
          io.emit("system message", `RandomCos() err:${reject}`);
        });
    } else if (msg === "/随机买家秀") {
      RandomTbshow()
        .then((resolve) => {
          io.emit("pic message", resolve);
        })
        .catch((reject) => {
          console.log(`RandomTbshow(): rejected, and err:${reject}`);
          io.emit("system message", `RandomTbshow() err:${reject}`);
        });
    } else if (msg === "/随机冷知识") {
      RandomHomeword()
        .then((resolve) => {
          io.emit("chat message", { CID: "0", msg: resolve });
        })
        .catch((reject) => {
          console.log(`RandomHomeword(): rejected, and err:${reject}`);
          io.emit("system message", `RandomHomeword() err:${reject}`);
        });
    } else if (msg === "/随机二次元图") {
      RandomECY()
        .then((resolve) => {
          io.emit("pic message", resolve);
        })
        .catch((reject) => {
          console.log(`RandomECY(): rejected, and err:${reject}`);
          io.emit("system message", `RandomECY() err:${reject}`);
        });
      //更改qqBot小夜回复率
    } else if (change_reply_probability_reg.test(msg)) {
      msg = msg.replace("/admin_change_reply_probability ", "");
      reply_probability = msg;
      socket.emit("system message", `qqBot小夜回复率已修改为${msg}%`);
      //更改qqBot小夜复读率
    } else if (change_fudu_probability_reg.test(msg)) {
      msg = msg.replace("/admin_change_fudu_probability ", "");
      fudu_probability = msg;
      socket.emit("system message", `qqBot小夜复读率已修改为${msg}%`);
    } else {
      if (chat_swich) {
        //交给聊天函数处理
        ChatProcess(msg)
          .then((resolve) => {
            io.emit("chat message", {
              CID: "0",
              msg: resolve,
            });
          })
          .catch((reject) => {
            //如果没有匹配到回复，那就让舔狗来回复
            console.log(`${reject}，交给舔狗回复`.warn);
            PrprDoge()
              .then((resolve) => {
                console.log("舔狗回复：", resolve);
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

//更改个人资料
app.get("/profile", (req, res) => {
  db.run(`UPDATE users SET nickname = '${req.query.name}' WHERE CID ='${req.query.CID}'`);
  res.sendFile(__dirname + html);
});

//图片上传接口
app.post("/upload/image", upload.single("file"), function (req, _res, _next) {
  console.log(req.file);
  let oldname = req.file.path;
  let newname = req.file.path + path.parse(req.file.originalname).ext;
  fs.renameSync(oldname, newname);
  io.emit("pic message", `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`);
});

//文件/视频上传接口
app.post("/upload/file", upload.single("file"), function (req, _res, _next) {
  console.log(req.file);
  let oldname = req.file.path;
  let newname = req.file.path + path.parse(req.file.originalname).ext;
  fs.renameSync(oldname, newname);
  let isVideo = new RegExp("^video*");
  let isAudio = new RegExp("^audio*");
  let file = { file: `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`, filename: req.file.originalname };
  if (isVideo.test(req.file.mimetype)) {
    io.emit("video message", file);
  } else if (isAudio.test(req.file.mimetype)) {
    io.emit("audio message", file);
  } else {
    io.emit("file message", file);
  }
});

//对接go-cqhttp
app.post("/bot", (req, res) => {
  if (req.body.message) {
    let notify;
    switch (req.body.message_type) {
      case "private":
        notify = `qqBot小夜收到 ${req.body.user_id} (${req.body.sender.nickname}) 发来的消息：${req.body.message}`;
        break;
      case "group":
        notify = `qqBot小夜收到群 ${req.body.group_id} 的 ${req.body.user_id} (${req.body.sender.nickname}) 发来的消息：${req.body.message}`;
        break;
      default:
        res.send();
        break;
    }
    console.log(notify);
    io.emit("system message", notify);

    //转发图片到web端
    if (isImage_reg.test(req.body.message)) {
      console.log("qqBot小夜转发图片到web端".log);
      let url = img_url_reg.exec(req.body.message);
      SaveQQimg(url)
        .then((resolve) => {
          io.emit("qqpic message", resolve);
        })
        .catch((reject) => {
          console.log(reject);
        });
      res.send();
      return 0;
    }

    //转发视频到web端
    if (isVideo_reg.test(req.body.message)) {
      console.log("qqBot小夜转发视频到web端".log);
      let url = video_url_reg.exec(req.body.message)[0];
      console.log(url);
      io.emit("qqvideo message", { file: url, filename: "qq视频" });
      res.send();
      return 0;
    }

    //随机抽风，丢一个骰子，按 copy_msg_probability 几率转发消息
    let copy_msg_flag = Math.floor(Math.random() * 1000);
    if (copy_msg_flag < copy_msg_probability) {
      //随机选一个群转发
      RandomGroupList()
        .then((resolve) => {
          request(
            "http://127.0.0.1:5700/send_group_msg?group_id=" + resolve + "&message=" + encodeURI(req.body.message),
            function (error, _response, _body) {
              if (!error) {
                console.log(`qqBot小夜转发消息 ${req.body.message} 到 群 ${resolve}`.log);
                io.emit("system message", `@qqBot小夜转发消息 ${req.body.message} 到 群 ${resolve}`);
              } else {
                console.log("请求127.0.0.1:5700/send_group_msg错误：", error);
              }
            }
          );
        })
        .catch((reject) => {
          console.log(reject);
          res.send();
        });
      return 0;
    }

    //丢一个骰子，按fudu_probability几率复读
    let fudu_flag = Math.floor(Math.random() * 100);
    if (fudu_flag < fudu_probability) {
      console.log(`qqBot小夜复读 ${req.body.message}`.log);
      io.emit("system message", `@qqBot小夜复读 ${req.body.message}`);
      res.send({ reply: req.body.message });
      return 0;
    }

    //丢一个骰子，按reply_probability几率回复
    let reply_flag = Math.floor(Math.random() * 100);
    //如果被@了，那么回复几率上升20%
    if (xiaoye_ated.test(req.body.message)) {
      reply_flag -= 20;
    }
    if (reply_flag < reply_probability) {
      //骰子命中，那就让小夜来自动回复
      ChatProcess(req.body.message)
        .then((resolve) => {
          console.log("qqBot小夜回复：", resolve);
          io.emit("system message", `@qqBot小夜回复：${resolve}`);
          res.send({ reply: resolve });
        })
        .catch((reject) => {
          //无匹配则随机回复无意义语气词
          let blablabla = [
            "确实",
            "不错",
            "嗯",
            "对",
            "有道理",
            "这么厉害啊",
            "啊这",
            "就这",
            "好耶",
            "好起来了",
            "牛逼",
            "再来点",
            "草",
            "艹",
            "小夜学习了",
            "长知识了",
            "开眼界了",
            "好家伙",
            "可以",
            "还行",
            "6",
            "没懂",
            "不是吧 阿sir",
            "原来如此",
            "真不错",
            "不错，硬了",
            "不会吧不会吧",
            "笑死",
            "还有这种事",
          ];
          let random_blablabla = blablabla[Math.floor(Math.random() * blablabla.length)];
          res.send({ reply: random_blablabla });
          io.emit("system message", `@qqBot小夜觉得${random_blablabla}`);
          console.log(`${reject}，qqBot小夜觉得${random_blablabla}`.log);
        });
    } else {
      res.send();
    }
  } else {
    res.send();
  }
});

//酱菜物联服务
function Connjc() {
  var client = new net.Socket();
  client.setEncoding("utf8");
  client.connect(8266, "112.74.59.29", () => {
    client.write(`mode=bind&apikey=${jcckapikey}&data={ck001000bind}`);
    console.log(`${CurentTime()}酱菜物联服务绑定成功`);
  });
  client.on("data", (_data) => {
    //console.log(data);
  });
  client.on("error", (err) => {
    io.emit("酱菜物联服务绑定错误，错误为 %s", err.code);
    console.log(`${Curentyyyymmdd() + CurentTime()}酱菜物联服务绑定错误，错误为 %s`, err.code);
    client.destroy();
  });
}

//开门逻辑
function Opendoor() {
  var client = new net.Socket();
  client.setEncoding("utf8");
  client.connect(8266, "112.74.59.29", () => {
    client.write(`mode=exe&apikey=${jcckapikey}&data={ck0040001}`);
    setTimeout(() => {
      client.write(`mode=exe&apikey=${jcckapikey}&data={ck0040000}`);
      io.emit("chat message", { CID: "0", msg: "自动关门指令已发送，仍需手动带门吸合电磁铁" });
      console.log(`${Curentyyyymmdd() + CurentTime()}自动关门`);
    }, 3000);
  });
  client.on("data", (data) => {
    console.log(data);
  });
  client.on("error", (err) => {
    io.emit("开门错误，错误为 %s，请反馈系统管理员", err.code);
    console.log("开门错误，错误为 %s", err.code);
    client.destroy();
  });
}

//年月日
function Curentyyyymmdd() {
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var day = now.getDate();
  var yyyymmdd = year + "-";
  if (month < 10) yyyymmdd += "0";
  yyyymmdd += month + "-";
  if (day < 10) yyyymmdd += "0";
  yyyymmdd += day;
  return yyyymmdd;
}

//时分秒
function CurentTime() {
  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes();
  var ss = now.getSeconds();
  var clock = " ";
  if (hh < 10) clock += "0";
  clock += hh + ":";
  if (mm < 10) clock += "0";
  clock += mm + ":";
  if (ss < 10) clock += "0";
  clock += ss + " ";
  return clock;
}

//新闻
function Getnews() {
  return new Promise((resolve, reject) => {
    request("https://3g.163.com/touch/reconstruct/article/list/BBM54PGAwangning/0-10.html", (err, response, body) => {
      if (!err && response.statusCode === 200) {
        body = body.substring(9, body.length - 1);
        var content_news = "今日要闻：";
        var main = JSON.parse(body);
        var news = main.BBM54PGAwangning;
        for (let id = 0; id < 10; id++) {
          var print_id = id + 1;
          content_news += "\r\n" + print_id + "." + news[id].title + "a(" + news[id].url + ")[查看原文]";
        }
        resolve(content_news);
      } else {
        reject("获取新闻错误，这个问题雨女无瓜，是新闻接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

//获取用户信息
function GetUserData(msg) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM users WHERE CID = '" + msg + "'", (err, sql) => {
      if (!err && sql[0]) {
        let nickname = JSON.stringify(sql[0].nickname);
        let logintimes = JSON.stringify(sql[0].logintimes);
        let lastlogintime = JSON.stringify(sql[0].lastlogintime);
        resolve([nickname, logintimes, lastlogintime]);
      } else {
        reject("获取用户信息错误，一般是因为用户第一次登录。错误原因：" + err + ", sql:" + sql[0]);
      }
    });
  });
}

//更新登录次数
function UpdateLogintimes(msg) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET logintimes = logintimes + 1 WHERE CID ='${msg}'`),
      (err, sql) => {
        if (!err && sql) {
          resolve(sql);
        } else {
          reject(err);
        }
      };
  });
}

//更新最后登陆时间
function UpdateLastLogintime(msg) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET lastlogintime = '${Curentyyyymmdd()}${CurentTime()}' WHERE CID ='${msg}'`),
      (err, sql) => {
        if (!err && sql) {
          resolve(sql);
        } else {
          reject(err);
        }
      };
  });
}

//BV转AV
function Bv2Av(msg) {
  return new Promise((resolve, reject) => {
    request("https://api.bilibili.com/x/web-interface/view?bvid=" + msg, (err, response, body) => {
      body = JSON.parse(body);
      if (!err && response.statusCode === 200 && body.code === 0) {
        var content = "a(https://www.bilibili.com/video/av";
        var av = body.data;
        var av_number = av.aid;
        var av_title = av.title;
        content += av_number + ")[" + av_title + "，av" + av_number + "]";
        resolve(content);
      } else {
        reject("解析错误，是否输入了不正确的BV号？错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

//随机cos
function RandomCos() {
  return new Promise((resolve, reject) => {
    var rand_page_num = Math.floor(Math.random() * cos_total_count);
    request(
      "https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=hot&page_num=" + rand_page_num + "&page_size=1",
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err && response.statusCode === 200 && body.code === 0 && body.data.total_count != 0) {
          cos_total_count = body.data.total_count;
          try {
            var obj = body.data.items[0].item.pictures; //经常出现某个item里没有图片的毛病，阿B你在干什么啊
          } catch (err) {
            reject("获取随机cos错误，是B站的锅。这个item里又双草没有图片，阿B你在干什么啊。错误原因：" + JSON.stringify(response.body));
            return 0;
          }
          var count = Object.keys(obj).length;
          var picUrl = obj[Math.floor(Math.random() * count)].img_src;
          console.log(`cos总数：${cos_total_count}页，当前选择：${rand_page_num}页，发送图片：${picUrl}`);
          request(picUrl).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
              resolve(`/images/${picUrl.split("/").pop()}`);
            })
          ); //绕过防盗链，保存为本地图片
        } else {
          reject("获取随机cos错误，是B站的锅。错误原因：" + JSON.stringify(response.body));
        }
      }
    );
  });
}

//随机买家秀
function RandomTbshow() {
  return new Promise((resolve, reject) => {
    request(`https://api.sumt.cn/api/rand.tbimg.php?token=${sumtkey}&format=json`, (err, response, body) => {
      body = JSON.parse(body);
      console.log(body);
      if (!err && body.code === 200) {
        resolve(body.pic_url);
      } else {
        reject("随机买家秀错误，是卡特实验室接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

//随机二次元图，新版Chrome加入了HSTS策略而暂时无法使用。如需使用，请用户访问 chrome://net-internals/#hsts，在最下面的Delete domain security policies中，输入 acg.yanwz.cn，点击Delete删除即可
function RandomECY() {
  return new Promise((resolve, _reject) => {
    var pic = "https://acg.yanwz.cn/api.php";
    resolve(pic);
  });
}

//随机冷知识
function RandomHomeword() {
  return new Promise((resolve, reject) => {
    request("https://passport.csdn.net/v1/api/get/homeword", (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        var title = "<h2>" + body.data.title + "</h2>";
        var content = body.data.content;
        var count = body.data.count;
        resolve(title + content + "\r\n—— 有" + count + "人陪你一起已读");
      } else {
        reject("获取随机冷知识错误，这个问题雨女无瓜，是CSDN接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

//自动随机昵称
function RandomNickname() {
  return new Promise((resolve, reject) => {
    request(`http://api.tianapi.com/txapi/cname/index?key=${Tiankey}`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        resolve(body.newslist[0].naming);
      } else {
        reject("获取随机昵称错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

//舔狗回复
function PrprDoge() {
  return new Promise((resolve, reject) => {
    request(`http://api.tianapi.com/txapi/tiangou/index?key=${Tiankey}`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        resolve(body.newslist[0].content);
      } else {
        reject("舔狗错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}

//读取api接口密钥配置文件 keys.ini
function ReadApiKey() {
  return new Promise((resolve, reject) => {
    fs.readFile(`${__dirname}/keys.ini`, "utf-8", function (err, data) {
      if (!err) {
        resolve(JSON.parse(data));
      } else {
        reject("读取api接口密钥配置文件错误。错误原因：" + err);
      }
    });
  });
}

//聊天处理，先整句搜索，再模糊搜索，没有的话再分词模糊搜索
async function ChatProcess(msg) {
  const result_1 = await new Promise((resolve, _reject) => {
    console.log("开始整句搜索".log);
    db.all("SELECT * FROM chat WHERE ask = '" + msg + "'", (e, sql_1) => {
      if (!e && sql_1.length > 0) {
        console.log(`对于整句:  ${msg} ，匹配到 ${sql_1.length} 条回复`.log);
        let ans = Math.floor(Math.random() * sql_1.length);
        let answer = JSON.stringify(sql_1[ans].answer);
        answer = answer.replace(/"/g, "");
        console.log(`随机选取第${ans}条回复：${answer}`.log);
        resolve(answer);
      } else {
        console.log(`聊天数据库中没有匹配到整句 ${msg} 的回复，开始模糊搜索`.log);
        resolve();
      }
    });
  });
  const result_2 = await new Promise((resolve_1, _reject_1) => {
    console.log("开始模糊搜索".log);
    db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg + "%'", (e, sql_2) => {
      if (!e && sql_2.length > 0) {
        console.log(`模糊搜索:  ${msg} ，匹配到 ${sql_2.length} 条回复`.log);
        let ans = Math.floor(Math.random() * sql_2.length);
        let answer = JSON.stringify(sql_2[ans].answer);
        answer = answer.replace(/"/g, "");
        console.log(`随机选取第${ans}条回复：${answer}`.log);
        resolve_1(answer);
      } else {
        console.log(`聊天数据库中没有匹配到 ${msg} 的模糊回复，开始分词搜索`.log);
        resolve_1();
      }
    });
  });
  return await new Promise((resolve_2, reject_2) => {
    if (result_1) {
      //优先回复整句匹配
      resolve_2(result_1);
    } else if (result_2) {
      //其次是模糊匹配
      resolve_2(result_2);
    } else {
      //分词模糊搜索
      console.log("开始分词搜索".log);
      msg = msg.replace("/", "");
      msg = jieba.extract(msg, topN); //按权重分词
      console.log("分词出关键词：", msg);
      if (msg.length == 0) {
        reject_2(`不能分词，可能是语句无含义`.warn);
      } else if (msg.length == 1) {
        //如果就分词出一个关键词，那么可以加入一些噪声词以提高对话智能性，避免太单调
        console.log("只有一个关键词，添加噪声词".log);
        msg.push({ word: "" });
        console.log("分词出最终关键词：", msg);
      }
      let rand_word_num = Math.floor(Math.random() * msg.length);
      console.log(`随机选择第${rand_word_num}个关键词 ${msg[rand_word_num].word} 来回复`.log);
      db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg[rand_word_num].word + "%'", (e_1, sql_2) => {
        if (!e_1 && sql_2.length > 0) {
          console.log(`对于关键词:  ${msg[rand_word_num].word} ，匹配到 ${sql_2.length} 条回复`.log);
          let ans_1 = Math.floor(Math.random() * sql_2.length);
          let answer_1 = JSON.stringify(sql_2[ans_1].answer);
          answer_1 = answer_1.replace(/"/g, "");
          console.log(`随机选取第${ans_1}条回复：${answer_1}`.log);
          resolve_2(answer_1);
        } else {
          reject_2(`聊天数据库中没有匹配到 ${msg[rand_word_num].word} 的回复`);
        }
      });
    }
  });
}

//保存qq侧传来的图
function SaveQQimg(imgUrl) {
  return new Promise((resolve, reject) => {
    request(imgUrl[0]).pipe(
      fs.createWriteStream(`./static/xiaoye/images/${imgUrl[0].split("/")[imgUrl[0].split("/").length - 2]}.jpg`).on("close", (err) => {
        if (!err) {
          resolve(`/xiaoye/images/${imgUrl[0].split("/")[imgUrl[0].split("/").length - 2]}.jpg`);
        } else {
          reject("保存qq侧传来的图错误。错误原因：" + err);
        }
      })
    );
  });
}

//随机选取一个群
function RandomGroupList() {
  return new Promise((resolve, reject) => {
    request("http://127.0.0.1:5700/get_group_list", (err, response, body) => {
      body = JSON.parse(body);
      if (!err && body.data.length != 0) {
        var rand_group_num = Math.floor(Math.random() * body.data.length);
        console.log("随机选取一个群：", body.data[rand_group_num].group_id);
        resolve(body.data[rand_group_num].group_id);
      } else {
        reject("随机选取一个群错误。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
}
