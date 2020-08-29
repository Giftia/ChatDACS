/*
初次使用请看:
  首先安装Node.js
  接着启动cmd,进入代码根目录运行:
    npm install -g cnpm --registry=https://registry.npm.taobao.org
  等待进度完成后运行:
    cnpm i
  等待进度完成后运行:
    pm2 start . --no-daemon
  访问127.0.0.1,有公网或穿透那更好,尽情使用吧~
  隐藏界面请按:  Ctrl + C
  查看监视器请运行:  pm2 monit
  完全关闭请运行:  pm2 stop all
  每当次版本号迭代,如 1.1.0 --> 1.2.0,意味着需要更新依赖,请运行:  ncu -u  ,等待进度完成后运行:  cnpm i
  版本号的改变规律,如 1.2.3-45,形如 A.B.C-D:
    A 大版本号,当整端重构或出现不向后兼容的改变时增加A,更新代码需要更新依赖
    B 次版本号,功能更新,当功能增加、修改或删除时增加B,更新代码需要更新依赖
    C 尾版本号,表示小修改,如修复一些重要bug时增加C,更新代码可以不更新依赖
    D 迭代号,表示Github commits 即代码提交次数,属于非必要更新,可以不更新代码
*/

//系统变量和开关，根据你的需要改动
var version = "ChatDACS 1.10.0-78-O"; //版本号，-O代表OLD，指老版本UI
var chat_swich = 1; //是否开启自动聊天，需数据库中配置聊天表
var news_swich = 1; //是否开启首屏新闻
var jc_swich = 0; //是否开启酱菜物联服务
var password = "233333"; //配置开门密码
var apikey = "2333333333333333"; //换成你自己申请的 jcck_apikey，非必须
var eval_swich = 0; //是否开启动态注入和执行，便于调试，但开启有极大风险，最好完全避免启用它，特别是在生产环境部署时
var html = "/new.html"; //前端页面路径

/* 好了！请不要再继续编辑。请保存本文件。使用愉快！ */

//模块依赖
var compression = require("compression");
var express = require("express");
var app = require("express")();
app.use(compression());
app.use(express.static("static")); //静态文件引入
var http = require("http").Server(app);
var io = require("socket.io")(http);
var net = require("net");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
var colors = require("colors");

//debug颜色配置
colors.setTheme({
  ver: "inverse",
  random: "random",
  on: "magenta",
  off: "green",
  warn: "yellow",
  error: "red",
});

//待改进的变量
var userip = "";
var userdata = "";
var nickname = "";
var logintimes = "";
var lastlogintime = "";

//固定变量
var onlineusers = 0;

//正则
var door_reg = new RegExp("^/开门 [a-zA-Z0-9]*$"); //匹配开门
var rename_reg = new RegExp("^/rename [\u4e00-\u9fa5]*$"); //只允许汉字昵称
var bv2av__reg = new RegExp("^[a-zA-Z0-9]{10,12}"); //匹配bv号

//若表不存在则新建表
db.run("CREATE TABLE IF NOT EXISTS messages(yyyymmdd char, time char, ip char, message char)");
db.run("CREATE TABLE IF NOT EXISTS users(nickname char, ip char, logintimes long, lastlogintime char)");

console.log(version.ver);

if (chat_swich) {
  console.log("用户配置：自动聊天开启".on);
} else {
  console.log("用户配置：自动聊天关闭".debug);
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

http.listen(80, function () {
  console.log(Curentyyyymmdd() + CurentTime() + "配置完毕，系统启动，正在监听于端口80");
});

app.get("/", function (req, res) {
  var ip =
    req.headers["x-real-ip"] || //内网穿透natapp的header里的ip
    req.headers["x-forwarded-for"] ||
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
  if (ip.split(",").length > 0) {
    ip = ip.split(",")[0];
  }
  ip = ip.replace("::ffff:", "");
  userip = ip;
  if (userip === " " || Number.isNaN(userip) || userip === undefined || userip === "") {
    userip = "未知ip";
  }
  res.sendFile(__dirname + html);
});

io.on("connection", function (socket) {
  onlineusers++;
  io.emit("onlineusers", onlineusers);
  io.emit("version", version);
  GetUserData().then(
    function (data) {
      io.emit("chat massage", data);
      if (userip === " " || Number.isNaN(userip) || userip === undefined || userip === "") {
        userip = "未知ip";
      }
      console.log(Curentyyyymmdd() + CurentTime() + "用户 " + nickname + "(" + userip + ")" + " 已连接");
      db.run("UPDATE users SET logintimes = logintimes + 1 WHERE ip ='" + userip + "'");
      db.run("UPDATE users SET lastlogintime = '" + Curentyyyymmdd() + CurentTime() + "' WHERE ip ='" + userip + "'");
      logintimes++;
      io.emit("system message", "欢迎回来，" + nickname + "(" + userip + ")" + " 。这是你第" + logintimes + "次访问。上次访问时间：" + lastlogintime);
      userdata = "";
      nickname = "";
      logintimes = "";
      lastlogintime = "";
    },
    function (err, data) {
      console.log("GetUserData(): rejected, and err:\r\n" + err);
      if (userip === " " || Number.isNaN(userip) || userip === undefined || userip === "") {
        userip = "未知ip";
      }
      io.emit("system massage", "GetUserData() err:" + data);
      console.log(Curentyyyymmdd() + CurentTime() + "新用户 " + userip + " 已连接");
      db.run("INSERT INTO users VALUES('匿名', '" + userip + "', '1', '" + Curentyyyymmdd() + CurentTime() + "')");
      io.emit(
        "system message",
        "新用户 " +
          userip +
          " 已连接，你好，这是一个以聊天为主的辅助功能性系统，不定期增加功能。<br />指令列表：<br />·门禁系统：<br />/开门 密码<br />用户指令：<br />/log_view<br />/reload<br />/rename 昵称<br />·其他指令：<br />经过2w+用户养成的即时人工智能聊天<br />输入BV号直接转换为AV号<br />/随机cos<br />首屏新闻展示"
      );
    }
  );
  io.emit("system message", '项目开源于<a href="//github.com/Giftia/ChatDACS/"> github.com/Giftia/ChatDACS </a>，欢迎Star。系统已与小夜联动最新聊天词库，请随意聊天。若有卡顿现象，也可以访问<a href="//120.78.200.105/">120.78.200.105</a>获得更好的用户体验');
  if (news_swich) {
    Getnews().then(
      function (data) {
        io.emit("chat message", data);
      },
      function (err, data) {
        console.log("Getnews(): rejected, and err:\r\n" + err);
        io.emit("system massage", "Getnews() err:" + data);
      }
    );
  }

  socket.on("disconnect", function () {
    onlineusers--;
    io.emit("onlineusers", onlineusers);
    console.log(Curentyyyymmdd() + CurentTime() + "用户 " + userip + " 已断开连接");
    io.emit("system message", "用户 " + userip + " 已断开连接");
  });

  socket.on("typing", function (msg) {
    io.emit("typing", userip + " 正在输入...");
  });

  socket.on("typing_over", function (msg) {
    io.emit("typing", "");
  });

  socket.on("chat message", function (msg) {
    msg = msg.replace(/'/g, "[非法字符]"); //遇到'就会爆炸
    msg = msg.replace(/</g, "[非法字符]"); //遇到<就会爆炸
    msg = msg.replace(/>/g, "[非法字符]"); //遇到>就会爆炸
    if (eval_swich) {
      eval(msg);
    }
    var receive_debug = Curentyyyymmdd() + CurentTime() + "收到用户 " + userip + " 消息: " + msg;
    console.log(receive_debug.warn);
    db.run("INSERT INTO messages VALUES('" + Curentyyyymmdd() + "', '" + CurentTime() + "', '" + userip + "', '" + msg + "')");
    io.emit("chat message", nickname + "(" + userip + ")" + " : " + msg);

    if (door_reg.test(msg)) {
      if (jc_swich) {
        if (msg === "/开门 " + password) {
          Opendoor();
          io.emit("chat message", "密码已确认，开门指令已发送");
          io.emit("chat message", "计算机科创基地提醒您：道路千万条，安全第一条。开门不关门，亲人两行泪。");
          console.log(Curentyyyymmdd() + CurentTime() + "用户 " + userip + " 开门操作");
        } else {
          io.emit("chat message", "密码错误，请重试");
        }
      } else {
        io.emit("chat message", "酱菜物联服务未启动，故门禁服务一并禁用");
      }
    } else if (msg === "/log") {
      db.all("SELECT * FROM messages", function (e, sql) {
        if (!e) {
          var data = "";
          for (let i = 0; i < sql.length; i++) {
            var time = JSON.stringify(sql[i].time);
            var ip = JSON.stringify(sql[i].ip);
            var message = JSON.stringify(sql[i].message);
            data = data + "<br><br>" + time + ip + message;
          }
          console.log(sql);
          io.emit("chat message", "共有" + sql.length + "条记录：" + data);
        } else {
          console.log(e);
          io.emit("chat message", e);
        }
      });
    } /*else if (msg === "/cls") {
      db.all("DELETE FROM messages", function (e, sql) {
        if (!e) {
          io.emit("chat message", "管理指令：聊天信息数据库清空完毕");
          console.log(Curentyyyymmdd() + CurentTime() + "已清空聊天信息数据库");
        } else {
          console.log(e);
          io.emit("chat message", e);
        }
      });
    }*/ else if (
      rename_reg.test(msg)
    ) {
      db.run("UPDATE users SET nickname = '" + msg + "' WHERE ip ='" + userip + "'");
      io.emit("chat message", "昵称重命名完毕");
    } else if (msg === "/log_view") {
      db.all("SELECT yyyymmdd, COUNT(*) As count FROM messages Group by yyyymmdd", function (e, sql) {
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
          io.emit("chat message", e);
        }
      });
    } else if (bv2av__reg.test(msg)) {
      msg = msg.replace(" ", "");
      Bv2Av(msg).then(
        function (data) {
          io.emit("chat message", data);
        },
        function (err, data) {
          console.log("Bv2Av(): rejected, and err:\r\n" + err);
          io.emit("system massage", "Bv2Av() err:" + data);
        }
      );
    } else if (msg === "/reload") {
      io.emit("reload");
    } else if (msg === "/随机cos") {
      RandomCos().then(
        function (data) {
          io.emit("pic message", data);
        },
        function (err, data) {
          console.log("RandomCos(): rejected, and err:\r\n" + err);
          io.emit("system massage", "RandomCos() err:" + data);
        }
      );
    } else {
      if (chat_swich) {
        msg = msg.replace("/", "");
        db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg + "%'", function (e, sql) {
          if (!e && sql.length > 0) {
            console.log("对于对话: " + msg + "，匹配到 " + sql.length + " 条回复");
            var ans = Math.floor(Math.random() * (sql.length - 1 - 0 + 1) + 0);
            var answer = JSON.stringify(sql[ans].answer);
            console.log("随机选取第" + ans + "条回复：" + sql[ans].answer);
            io.emit("chat message", answer);
          } else {
            console.log("聊天组件抛错：" + e);
          }
        });
      }
    }
  });
});

function Connjc() {
  //酱菜物联服务
  var client = new net.Socket();
  client.setEncoding("utf8");
  client.connect(8266, "112.74.59.29", function () {
    client.write("mode=bind&apikey=" + apikey + "&data={ck001000bind}");
    console.log(CurentTime() + "酱菜物联服务绑定成功");
  });
  client.on("data", function (data) {
    //console.log(data);
  });
  client.on("error", function (err) {
    io.emit("酱菜物联服务绑定错误，错误为 %s", err.code);
    console.log(Curentyyyymmdd() + CurentTime() + "酱菜物联服务绑定错误，错误为 %s", err.code);
    client.destroy();
  });
}

function Opendoor() {
  //开门逻辑
  var client = new net.Socket();
  client.setEncoding("utf8");
  client.connect(8266, "112.74.59.29", function () {
    client.write("mode=exe&apikey=" + apikey + "&data={ck0040001}");
    setTimeout(function () {
      client.write("mode=exe&apikey=" + apikey + "&data={ck0040000}");
      io.emit("chat message", "自动关门指令已发送，仍需手动带门吸合电磁铁");
      console.log(Curentyyyymmdd() + CurentTime() + "自动关门");
    }, 3000);
  });
  client.on("data", function (data) {
    console.log(data);
  });
  client.on("error", function (err) {
    io.emit("开门错误，错误为 %s，请反馈系统管理员", err.code);
    console.log("开门错误，错误为 %s", err.code);
    client.destroy();
  });
}

function Curentyyyymmdd() {
  //年月日
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

function CurentTime() {
  //时分秒
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

function Getnews() {
  //新闻
  var p = new Promise(function (resolve, reject) {
    request("https://3g.163.com/touch/reconstruct/article/list/BBM54PGAwangning/0-10.html", function (err, response, body) {
      if (!err && response.statusCode === 200) {
        body = body.substring(9, body.length - 1);
        var content_news = "今日要闻：";
        var main = JSON.parse(body);
        var news = main.BBM54PGAwangning;
        for (let id = 0; id < 10; id++) {
          var print_id = id + 1;
          content_news = content_news + "<br>" + print_id + "." + news[id].title + ' <a href="' + news[id].url + '" target="_blank">查看原文</a>';
        }
        resolve(content_news);
      } else {
        resolve("获取新闻错误，这个问题雨女无瓜，是新闻接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

function GetUserData() {
  //写入用户信息
  var p = new Promise(function (resolve, reject) {
    db.all("SELECT * FROM users WHERE ip = '" + userip + "'", function (err, sql) {
      if (!err && sql[0]) {
        nickname = JSON.stringify(sql[0].nickname);
        var ip = JSON.stringify(sql[0].ip);
        logintimes = JSON.stringify(sql[0].logintimes);
        lastlogintime = JSON.stringify(sql[0].lastlogintime);
        userdata = nickname + ip + logintimes + lastlogintime;
        resolve(userdata);
      } else {
        resolve("写入用户信息错误，一般这个错误出现在断连重连的时候，这个问题雨女无瓜，是写代码的锅。错误原因：" + err);
      }
    });
  });
  return p;
}

function Bv2Av(msg) {
  //BV转AV
  var p = new Promise(function (resolve, reject) {
    request("https://api.bilibili.com/x/web-interface/view?bvid=" + msg, function (err, response, body) {
      body = JSON.parse(body);
      if (!err && response.statusCode === 200 && body.code === 0) {
        var content = '<a href="https://www.bilibili.com/video/av';
        var av = body.data;
        var av_number = av.aid;
        var av_title = av.title;
        content = content + av_number + '" target="_blank">' + av_title + "，av" + av_number + "</a>";
        resolve(content);
      } else {
        resolve("解析错误，是否输入了不正确的BV号？错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

function RandomCos(msg) {
  //随机cos
  var p = new Promise(function (resolve, reject) {
    request("https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=hot&page_num=4&page_size=1", function (err, response, body) {
      var body = JSON.parse(body);
      if (!err && response.statusCode === 200 && body.code === 0) {
        // var rand = parseInt(Math.random() * (9 - 1 + 1) + 1, 10);
        // var pic = body.data.items[0].item.pictures[rand].img_src;
        var pic = body.data.items[0].item.pictures[0].img_src;
        console.log(pic);
        resolve(pic);
      } else {
        resolve("获取随机cos错误，这个问题雨女无瓜，是B站接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}
