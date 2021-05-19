/*
Giftina：https://giftia.moe

初次使用请看:
  首先去 https://nodejs.org/zh-cn/ 安装长期支持版Node.js
  接着启动cmd或powershell,进入代码根目录运行:
    npm install -g cnpm --registry=https://registry.npm.taobao.org
  等待进度完成后运行:
    cnpm install
  等待进度完成后运行:
    node index.js
  或在windows系统下懒人启动:
    双击目录下的 run.bat
  或使用pm2守护神启动:
    pm2 start index.js
  访问127.0.0.1即可体验,有公网或穿透那更好,尽情使用吧~

  若使用pm2守护神启动:
  隐藏界面请按:  Ctrl + C
  查看监视器请运行:  pm2 monit
  完全关闭请运行:  pm2 stop all

  每当次版本号迭代,如 1.1.0 --> 1.2.0,意味着需要更新依赖,请运行:  ncu -u  ,等待进度完成后运行:  cnpm install
  出现任何缺失的依赖包请运行:  cnpm install 缺失的包名
  版本号的改变规律,如 1.2.3-45,形如 A.B.C-D:
    A 大版本号,当整端重构或出现不向后兼容的改变时增加A,更新代码需要更新依赖
    B 次版本号,功能更新,当功能增加、修改或删除时增加B,更新代码需要更新依赖
    C 尾版本号,表示小修改,如修复一些重要bug时增加C,更新代码可以不更新依赖
    D 迭代号,表示Github commits 即代码提交次数,属于非必要更新,可以不更新代码
*/

//系统参数和开关，根据你的需要改动
const version = "ChatDACS 2.0.0-122"; //版本号
const chat_swich = 1; //自动聊天开关，需数据库中配置聊天表
const news_swich = 1; //首屏新闻开关
const jc_swich = 0; //酱菜物联服务开关
const password = "233333"; //配置开门密码
const apikey = "2333333333333333"; //换成你自己申请的 jcck_apikey，非必须
const Tiankey = "f21f0dd07e3e07ef6e95c5f93cf6dd1c"; //天行接口key，私有，图个方便先直接放上去了
const eval_swich = 0; //动态注入和执行开关，便于调试，但开启有极大风险，最好完全避免启用它，特别是在生产环境部署时
const html = "/new.html"; //前端页面路径
const help =
  "功能列表：<br />·门禁系统：<br />/开门 密码<br />用户指令：<br />/log_view<br />/reload<br />/rename 昵称<br />·其他指令：<br />经过2w+用户养成的即时人工智能聊天<br />输入BV号直接转换为AV号<br />/随机cos<br />/随机买家秀<br />/随机冷知识<br />首屏新闻展示<br />/随机二次元图";
const welcome =
  '项目开源于<a href="//github.com/Giftia/ChatDACS/"> github.com/Giftia/ChatDACS </a>，欢迎Star。系统已与小夜联动最新聊天词库，请随意聊天。需要帮助请发送 /帮助';

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
let fs = require("fs");

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
var onlineusers = 0;

//正则
var door_reg = new RegExp("^/开门 [a-zA-Z0-9]*$"); //匹配开门
var rename_reg = new RegExp("^/rename [\u4e00-\u9fa5a-z0-9]{1,10}$"); //1-10长度的数英汉昵称
var bv2av__reg = new RegExp("^[a-zA-Z0-9]{10,12}$"); //匹配bv号

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
  console.log(Curentyyyymmdd() + CurentTime() + "配置完毕，系统启动，正在监听于端口80");
});

//  客户端接入，先发送前端
app.get("/", (req, res) => {
  res.sendFile(__dirname + html);
});

// socket接入，开始用户操作
io.on("connection", (socket) => {
  onlineusers++;
  io.emit("onlineusers", onlineusers);
  io.emit("version", version);
  socket.emit("getcookie");
  //开始获取用户信息并处理
  socket.on("cookiecoming", (msg) => {
    msg = msg.replace("ChatdacsID=", "");
    GetUserData(msg)
      .then(([nickname, CID, logintimes, lastlogintime]) => {
        console.log(`GetUserData传来${nickname},${logintimes},${lastlogintime}`);
        console.log(`${Curentyyyymmdd() + CurentTime()}用户 ${nickname}(${msg}) 已连接`.log);

        UpdateLogintimes(msg).then(
          (data) => {
            console.log(`update successfully, ${data}`);
          },
          (err, data) => {
            console.log(`err, ${err}, data:, ${data}`);
          }
        );

        UpdateLastLogintime(msg).then(
          (data) => {
            console.log(`update successfully, ${data}`);
          },
          (err, data) => {
            console.log(`err, ${err}, data:, ${data}`);
          }
        );

        socket.username = nickname;

        io.emit(
          "system message",
          `欢迎回来，${socket.username}(${msg}) 。这是你第${logintimes}次访问。上次访问时间：${lastlogintime}`
        );
      })
      .catch((err, data) => {
        //若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作：
        console.log(`GetUserData(): rejected, and err:${err}, data:${data}`);
        console.log(`${Curentyyyymmdd() + CurentTime()}新用户 ${msg} 已连接`.log);
        RandomNickname().then(
          (data) => {
            db.run(`INSERT INTO users VALUES('${data}', '${msg}', '1', '${Curentyyyymmdd()}${CurentTime()}')`);

            socket.username = data;
            socket.emit("setcookie", `[${data}, ${msg}]`); //将用户信息保存至客户端cookie

            io.emit(
              "system message",
              `新用户 ${msg} 已连接。已为你分配了一个随机昵称：「${data}」，更改昵称可以通过 /rename 昵称。主人你好，我是小夜，这里是一个以聊天为主的辅助功能性系统，在下面的聊天框中输入 小夜 发送试试吧。${help}`
            );
          },
          (err, data) => {
            console.log(`随机昵称错误：${err} , ${data}`);
          }
        );
      });
  });

  io.emit("system message", welcome);

  if (news_swich) {
    Getnews().then(
      (data) => {
        io.emit("chat message", data);
      },
      (err, data) => {
        console.log(`Getnews(): rejected, and err:${err}`);
        io.emit("system message", `Getnews() err:${data}`);
      }
    );
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

  socket.on("chat message", (msgWITHcid) => {
    CID = msgWITHcid[0];
    CID = CID.replace("ChatdacsID=", "");
    msg = msgWITHcid[1];
    msg = msg.replace(/'/g, "[非法字符]"); //防爆
    msg = msg.replace(/</g, "[非法字符]"); //防爆
    msg = msg.replace(/>/g, "[非法字符]"); //防爆
    if (eval_swich) {
      eval(msg);
    }
    var receive_debug = `${Curentyyyymmdd() + CurentTime()}收到用户 ${socket.username}(${CID}) 的消息: ${msg}`;
    console.log(receive_debug.warn);
    db.run(`INSERT INTO messages VALUES('${Curentyyyymmdd()}', '${CurentTime()}', '${CID}', '${msg}')`);
    io.emit("chat message", `${socket.username}(${CID}) : ${msg}`);

    if (door_reg.test(msg)) {
      if (jc_swich) {
        if (msg === "/开门 " + password) {
          Opendoor();
          io.emit("chat message", "密码已确认，开门指令已发送");
          io.emit("chat message", "计算机科创基地提醒您：道路千万条，安全第一条。开门不关门，亲人两行泪。");
          console.log(`${Curentyyyymmdd() + CurentTime()}用户 ${CID} 开门操作`);
        } else {
          io.emit("chat message", "密码错误，请重试");
        }
      } else {
        io.emit("chat message", "酱菜物联服务未启动，故门禁服务一并禁用");
      }
    } else if (msg === "/log") {
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
          io.emit("chat message", `${data}<br />共有${sql.length}条记录`);
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
      }*/ else if (rename_reg.test(msg)) {
      db.run(`UPDATE users SET nickname = '${msg.slice(8)}' WHERE CID ='${CID}'`);
      io.emit("chat message", `昵称重命名完毕，你现在叫 ${msg.slice(8)} 啦`);
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
          io.emit("chat message", e);
        }
      });
    } else if (bv2av__reg.test(msg)) {
      msg = msg.replace(" ", "");
      Bv2Av(msg).then(
        (data) => {
          io.emit("chat message", data);
        },
        (err, data) => {
          console.log(`Bv2Av(): rejected, and err:${err}`);
          io.emit("system message", `Bv2Av() err:${data}`);
        }
      );
    } else if (msg === "/reload") {
      io.emit("reload");
    } else if (msg === "/帮助") {
      io.emit("chat message", help);
    } else if (msg === "/随机cos") {
      RandomCos().then(
        (data) => {
          io.emit("pic message", data);
        },
        (err, data) => {
          console.log(`RandomCos(): rejected, and err:${err}`);
          io.emit("system message", `RandomCos() err:${data}`);
        }
      );
    } else if (msg === "/随机买家秀") {
      RandomTbshow().then(
        (data) => {
          io.emit("pic message", data);
        },
        (err, data) => {
          console.log(`RandomTbshow(): rejected, and err:${err}`);
          io.emit("system message", `RandomTbshow() err:${data}`);
        }
      );
    } else if (msg === "/随机冷知识") {
      RandomHomeword().then(
        (data) => {
          io.emit("chat message", data);
        },
        (err, data) => {
          console.log(`RandomHomeword(): rejected, and err:${err}`);
          io.emit("system message", `RandomHomeword() err:${data}`);
        }
      );
    } else if (msg === "/随机二次元图") {
      RandomECY().then(
        (data) => {
          io.emit("pic message", data);
        },
        (err, data) => {
          console.log(`RandomECY(): rejected, and err:${err}`);
          io.emit("system message", `RandomECY() err:${data}`);
        }
      );
    } else {
      if (chat_swich) {
        msg = msg.replace("/", "");
        db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg + "%'", (e, sql) => {
          if (!e && sql.length > 0) {
            console.log("对于对话: " + msg + "，匹配到 " + sql.length + " 条回复");
            var ans = Math.floor(Math.random() * sql.length);
            var answer = JSON.stringify(sql[ans].answer);
            console.log(`随机选取第${ans}条回复：${sql[ans].answer}`);
            io.emit("chat message", answer);
          } else {
            console.log(`聊天组件抛错：${e}`);
            io.emit("chat message", "小夜好像不是很懂你在说什么，你等着，我去问问小爱，嘿Siri~");
          }
        });
      } else {
        return 0;
      }
    }
  });
});

function Connjc() {
  //酱菜物联服务
  var client = new net.Socket();
  client.setEncoding("utf8");
  client.connect(8266, "112.74.59.29", () => {
    client.write(`mode=bind&apikey=${apikey}&data={ck001000bind}`);
    console.log(`${CurentTime()}酱菜物联服务绑定成功`);
  });
  client.on("data", (data) => {
    //console.log(data);
  });
  client.on("error", (err) => {
    io.emit("酱菜物联服务绑定错误，错误为 %s", err.code);
    console.log(`${Curentyyyymmdd() + CurentTime()}酱菜物联服务绑定错误，错误为 %s`, err.code);
    client.destroy();
  });
}

function Opendoor() {
  //开门逻辑
  var client = new net.Socket();
  client.setEncoding("utf8");
  client.connect(8266, "112.74.59.29", () => {
    client.write(`mode=exe&apikey=${apikey}&data={ck0040001}`);
    setTimeout(() => {
      client.write(`mode=exe&apikey=${apikey}&data={ck0040000}`);
      io.emit("chat message", "自动关门指令已发送，仍需手动带门吸合电磁铁");
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
  var p = new Promise((resolve, reject) => {
    request("https://3g.163.com/touch/reconstruct/article/list/BBM54PGAwangning/0-10.html", (err, response, body) => {
      if (!err && response.statusCode === 200) {
        body = body.substring(9, body.length - 1);
        var content_news = "今日要闻：";
        var main = JSON.parse(body);
        var news = main.BBM54PGAwangning;
        for (let id = 0; id < 10; id++) {
          var print_id = id + 1;
          content_news +=
            "<br>" + print_id + "." + news[id].title + ' <a href="' + news[id].url + '" target="_blank">查看原文</a>';
        }
        resolve(content_news);
      } else {
        resolve("获取新闻错误，这个问题雨女无瓜，是新闻接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

function GetUserData(msg) {
  //获取用户信息
  var p = new Promise((resolve, reject) => {
    db.all("SELECT * FROM users WHERE CID = '" + msg + "'", (err, sql) => {
      if (!err && sql[0]) {
        let nickname = JSON.stringify(sql[0].nickname);
        let CID = JSON.stringify(sql[0].CID);
        let logintimes = JSON.stringify(sql[0].logintimes);
        let lastlogintime = JSON.stringify(sql[0].lastlogintime);
        resolve([nickname, CID, logintimes, lastlogintime]);
      } else {
        reject("获取用户信息错误，一般是因为用户第一次登录。错误原因：" + err + ", sql:" + sql[0]);
      }
    });
  });
  return p;
}

function UpdateLogintimes(msg) {
  //更新登录次数
  var p = new Promise((resolve, reject) => {
    db.run(`UPDATE users SET logintimes = logintimes + 1 WHERE CID ='${msg}'`),
      (err, sql) => {
        if (!err && sql) {
          resolve(sql);
        } else {
          resolve(err);
        }
      };
  });
  return p;
}

function UpdateLastLogintime(msg) {
  //更新最后登陆时间
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

function Bv2Av(msg) {
  //BV转AV
  var p = new Promise((resolve, reject) => {
    request("https://api.bilibili.com/x/web-interface/view?bvid=" + msg, (err, response, body) => {
      body = JSON.parse(body);
      if (!err && response.statusCode === 200 && body.code === 0) {
        var content = '<a href="https://www.bilibili.com/video/av';
        var av = body.data;
        var av_number = av.aid;
        var av_title = av.title;
        content += av_number + '" target="_blank">' + av_title + "，av" + av_number + "</a>";
        resolve(content);
      } else {
        resolve("解析错误，是否输入了不正确的BV号？错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

function RandomCos() {
  //随机cos
  var p = new Promise((resolve, reject) => {
    var rand_page_num = Math.floor(Math.random() * 9);
    request(
      "https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=hot&page_num=" + rand_page_num + "&page_size=1",
      (err, response, body) => {
        body = JSON.parse(body);
        if (!err && response.statusCode === 200 && body.code === 0) {
          var obj = body.data.items[0].item.pictures;
          var count = Object.keys(obj).length;
          var picUrl = obj[Math.floor(Math.random() * count)].img_src;
          console.log(picUrl);
          request(picUrl).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (err) => {
              resolve(`/images/${picUrl.split("/").pop()}`);
            })
          ); //绕过防盗链，保存为本地图片
        } else {
          resolve("获取随机cos错误，这个问题雨女无瓜，是B站接口的锅。错误原因：" + JSON.stringify(response.body));
        }
      }
    );
  });
  return p;
}

function RandomTbshow() {
  //随机买家秀
  var p = new Promise((resolve, reject) => {
    var pic = "https://api.66mz8.com/api/rand.tbimg.php";
    resolve(pic);
  });
  return p;
}

function RandomECY() {
  //随机二次元图，新版Chrome加入了HSTS策略而暂时无法使用。如需使用，请用户访问 chrome://net-internals/#hsts，在最下面的Delete domain security policies中，输入 acg.yanwz.cn，点击Delete删除即可
  var p = new Promise((resolve, reject) => {
    var pic = "https://acg.yanwz.cn/api.php";
    resolve(pic);
  });
  return p;
}

function RandomHomeword() {
  //随机冷知识
  var p = new Promise((resolve, reject) => {
    request("https://passport.csdn.net/v1/api/get/homeword", (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        var title = "<h2>" + body.data.title + "</h2>";
        var content = body.data.content;
        var count = body.data.count;
        resolve(title + content + "<br />—— 有" + count + "人陪你一起已读");
      } else {
        resolve("获取随机冷知识错误，这个问题雨女无瓜，是CSDN接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}

function RandomNickname() {
  //自动随机昵称
  var p = new Promise((resolve, reject) => {
    request(`http://api.tianapi.com/txapi/cname/index?key=${Tiankey}`, (err, response, body) => {
      body = JSON.parse(body);
      if (!err) {
        resolve(body.newslist[0].naming);
      } else {
        resolve("获取随机昵称错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
      }
    });
  });
  return p;
}
