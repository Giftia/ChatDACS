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
  另外请查看70行，请去各个所述接口网站申请自己的接口密钥

  若使用pm2守护神启动:
  隐藏界面请按:  Ctrl + C
  查看监视器请运行:  pm2 monit
  完全关闭请运行:  pm2 stop all

  每当次版本号迭代,如 1.1.0 --> 1.2.0,意味着需要更新依赖,请运行:  ncu -u  ,等待进度完成后运行:  cnpm install
  出现任何缺失的依赖包请运行:  cnpm install 缺失的包名
  版本号的改变规律,如 1.2.3-45,形如 A.B.C-D:
    A 大版本号,当整端重构或出现不向后兼容的改变时增加A,更新代码需要更新依赖,且需要重载数据库
    B 次版本号,功能更新,当功能增加、修改或删除时增加B,更新代码需要更新依赖
    C 尾版本号,表示小修改,如修复一些重要bug时增加C,更新代码可以不更新依赖
    D 迭代号,表示Github commits 即代码提交次数,属于非必要更新,可以不更新代码

    致谢（排名不分先后）：https://niconi.co.ni/、https://www.layui.com/、https://lceda.cn/、https://www.dnspod.cn/、Daisy_Liu、http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html、https://ihateregex.io/、https://www.maoken.com/、https://www.ngrok.cc/、https://uptimerobot.com/、https://shields.io/、https://ctf.bugku.com/、https://blog.squix.org/、https://hostker.com/、还有我的朋友们，以及倾心分享知识的各位
*/

//系统参数和开关，根据你的需要改动
const version = "ChatDACS 2.3.2-146"; //版本号，会显示在浏览器tab与标题栏
const chat_swich = 1; //自动聊天开关，需数据库中配置聊天表，自带的数据库已经配置好小夜嘴臭语录，开箱即用
const news_swich = 0; //首屏新闻开关
const jc_swich = 0; //酱菜物联服务开关
const password = "233333"; //配置开门密码
let jcckapikey, Tiankey, sumtkey; //用于67行配置api接口密钥
const eval_swich = 0; //动态注入和执行开关，便于调试，但开启有极大风险，最好完全避免启用它，特别是在生产环境部署时
const html = "/static/index.html"; //前端页面路径，old.html为旧版前端
const help =
  "主人你好，我是小夜。欢迎使用沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)。在这里，你可以与经过 2w+用户调教养成的人工智能机器人小夜实时聊天，它有着令人激动的、实用的在线涩图功能，还可以和在线的其他人分享你的图片、视频与文件。现在就试试使用在聊天框下方的便捷功能栏吧，功能栏往右拖动还有更多功能。";
const updatelog =
  "<h2>v2.3.2-146，小修小改：</h2><ul><li>· 修复换行符导致的显示异常；</li><li>· 修复链接显示；</li><li>· 将格式化文本功能换为发送链接功能；</li></ul>";
let cos_total_count = 50; //初始化随机cos上限，50个应该比较保守，使用随机cos功能后会自动更新为最新值

/* 好了！以上就是系统的基本配置，如果没有必要，请不要再往下继续编辑了。请保存本文件。祝使用愉快！ */

//模块依赖
let compression = require("compression");
let express = require("express");
let app = require("express")();
app.use(compression());
app.use(express.static("static")); //静态文件引入
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

//载入api接口密钥配置，若您是初次使用，请访问申请地址，申请自己的接口密钥后修改目录下的 keys.ini 文件
ReadApiKey()
  .then((resolve) => {
    jcckapikey = resolve.jcckapikey; //酱菜创客接口key，若不配置则门禁功能失效，平台已跑路，仅剩幻肢
    Tiankey = resolve.Tiankey; //天行接口key，若不配置则随机昵称与舔狗失效，申请地址 https://www.tianapi.com/
    sumtkey = resolve.sumtkey; //卡特实验室接口key，若不配置则随机买家秀失效，申请地址 https://api.sumt.cn/
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

//正则
let door_reg = new RegExp("^/开门 [a-zA-Z0-9]*$"); //匹配开门
let rename_reg = new RegExp("^/rename [\u4e00-\u9fa5a-z0-9]{1,10}$"); //1-10长度的数英汉昵称
let bv2av__reg = new RegExp("^[a-zA-Z0-9]{10,12}$"); //匹配bv号

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
  console.log(Curentyyyymmdd() + CurentTime() + "配置完毕，系统启动，访问 127.0.0.1 即可体验沙雕Ai聊天系统");
});

// socket接入，开始用户操作
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
        socket.emit("chat message", {
          CID: "0",
          msg: resolve,
        });
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

  socket.on("getsettings", () => {
    let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
    socket.emit("settings", { CID: CID, name: socket.username });
  });

  socket.on("getupdatelog", () => {
    socket.emit("updatelog", updatelog);
  });

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
            data += "<br><br>" + time + CID + message;
          }
          console.log(sql);
          io.emit("chat message", { CID: "0", msg: `${data}<br />共有${sql.length}条记录` });
        } else {
          console.log(e);
          io.emit("chat message", { CID: "0", msg: e });
        }
      });
    } else if (msg === "/cls") {
        db.all("DELETE FROM messages", function (e, sql) {
          if (!e) {
            io.emit("chat message", { CID: "0", msg: "管理指令：聊天信息数据库清空完毕"});
            console.log(Curentyyyymmdd() + CurentTime() + "已清空聊天信息数据库");
          } else {
            console.log(e);
            io.emit("chat message", { CID: "0", msg: e});
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
    } else if (bv2av__reg.test(msg)) {
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
    } else {
      if (chat_swich) {
        msg = msg.replace("/", "");
        db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg + "%'", (e, sql) => {
          if (!e && sql.length > 0) {
            console.log("对于对话: " + msg + "，匹配到 " + sql.length + " 条回复");
            var ans = Math.floor(Math.random() * sql.length);
            var answer = JSON.stringify(sql[ans].answer);
            console.log(`随机选取第${ans}条回复：${sql[ans].answer}`);
            io.emit("chat message", { CID: "0", msg: answer });
          } else {
            console.log("聊天数据库中无匹配，使用舔狗回复");
            PrprDoge()
              .then((resolve) => {
                io.emit("chat message", {
                  CID: "0",
                  msg: resolve,
                });
              })
              .catch((reject) => {
                console.log(`随机舔狗错误：${reject}`);
              });
          }
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
  io.emit("pic message", `/uploads/${req.file.filename}`);
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
  var p = new Promise((resolve, reject) => {
    request("https://3g.163.com/touch/reconstruct/article/list/BBM54PGAwangning/0-10.html", (err, response, body) => {
      if (!err && response.statusCode === 200) {
        body = body.substring(9, body.length - 1);
        var content_news = "今日要闻：";
        var main = JSON.parse(body);
        var news = main.BBM54PGAwangning;
        for (let id = 0; id < 10; id++) {
          var print_id = id + 1;
          content_news += "        " + print_id + "." + news[id].title + "a(" + news[id].url + '")[查看原文]';
        }
        resolve(content_news);
      } else {
        reject("获取新闻错误，这个问题雨女无瓜，是新闻接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

//获取用户信息
function GetUserData(msg) {
  var p = new Promise((resolve, reject) => {
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
  return p;
}

//更新登录次数
function UpdateLogintimes(msg) {
  var p = new Promise((resolve, reject) => {
    db.run(`UPDATE users SET logintimes = logintimes + 1 WHERE CID ='${msg}'`),
      (err, sql) => {
        if (!err && sql) {
          resolve(sql);
        } else {
          reject(err);
        }
      };
  });
  return p;
}

//更新最后登陆时间
function UpdateLastLogintime(msg) {
  var p = new Promise((resolve, reject) => {
    db.run(`UPDATE users SET lastlogintime = '${Curentyyyymmdd()}${CurentTime()}' WHERE CID ='${msg}'`),
      (err, sql) => {
        if (!err && sql) {
          resolve(sql);
        } else {
          reject(err);
        }
      };
  });
  return p;
}

//BV转AV
function Bv2Av(msg) {
  var p = new Promise((resolve, reject) => {
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
  return p;
}

//随机cos
function RandomCos() {
  var p = new Promise((resolve, reject) => {
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
  return p;
}

//随机买家秀
function RandomTbshow() {
  var p = new Promise((resolve, reject) => {
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
  return p;
}

//随机二次元图，新版Chrome加入了HSTS策略而暂时无法使用。如需使用，请用户访问 chrome://net-internals/#hsts，在最下面的Delete domain security policies中，输入 acg.yanwz.cn，点击Delete删除即可
function RandomECY() {
  var p = new Promise((resolve, _reject) => {
    var pic = "https://acg.yanwz.cn/api.php";
    resolve(pic);
  });
  return p;
}

//随机冷知识
function RandomHomeword() {
  var p = new Promise((resolve, reject) => {
    request("https://passport.csdn.net/v1/api/get/homeword", (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        var title = "<h2>" + body.data.title + "</h2>";
        var content = body.data.content;
        var count = body.data.count;
        resolve(title + content + "<br />—— 有" + count + "人陪你一起已读");
      } else {
        reject("获取随机冷知识错误，这个问题雨女无瓜，是CSDN接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

//自动随机昵称
function RandomNickname() {
  var p = new Promise((resolve, reject) => {
    request(`http://api.tianapi.com/txapi/cname/index?key=${Tiankey}`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        resolve(body.newslist[0].naming);
      } else {
        reject("获取随机昵称错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

//舔狗回复
function PrprDoge() {
  var p = new Promise((resolve, reject) => {
    request(`http://api.tianapi.com/txapi/tiangou/index?key=${Tiankey}`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        resolve(body.newslist[0].content);
      } else {
        reject("舔狗错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

//读取api接口密钥配置文件 keys.ini
function ReadApiKey() {
  var p = new Promise((resolve, reject) => {
    fs.readFile(`${__dirname}/keys.ini`, "utf-8", function (err, data) {
      if (!err) {
        resolve(JSON.parse(data));
      } else {
        reject("读取api接口密钥配置文件错误。错误原因：" + err);
      }
    });
  });
  return p;
}

process.on("uncaughtException", (err) => {
  io.emit("system message", `未捕获的异常：${err}`);
  console.log("未捕获的异常，错误：" + err);
});

process.on("unhandledRejection", (err, p) => {
  io.emit("system message", `未捕获的异常，位于抛秘史：${p}，${err}`);
  console.log("未捕获的异常，位于抛秘史：" + p + "，" + err);
});
