/* Giftina：https://giftia.moe
ChatDACS：一个无需服务器，可私有化部署、可独立运行于内网的H5聊天工具

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

  若出现
    c:\users\travis\build\yanyiwu\nodejieba\deps\cppjieba\dicttrie.hpp:203 FATAL exp: [ifs.is_open()] false. open C:\snapshot\web\node_modules\nodejieba/dict/jieba.dict.utf8 failed.
  这样的问题，请执行
    npm install nodejieba --registry=https://registry.npm.taobao.org --nodejieba_binary_host_mirror=https://npm.taobao.org/mirrors/nodejieba

  若使用pm2守护神启动:
  隐藏界面请按:  Ctrl + C
  查看监视器请运行:  pm2 monit
  完全关闭请运行:  pm2 kill

  另外，若想使用更完善的功能，请访问以下申请地址，申请自己的接口密钥后，修改 /config/config.yml文件：
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

*/

//中文路径检查
const _cn_reg = new RegExp("[\u4e00-\u9fa5]");
if (_cn_reg.test(`${process.cwd()}`)) {
  console.log(
    `因为Unicode的兼容性问题，程序所在路劲不能有汉字日语韩语表情包之类的奇奇怪怪的字符噢，最好使用常规的ASCII字符，请检查！如有疑问，请在QQ群 120243247 内咨询。当前路径：${process.cwd()}`
  );
  while (1);
}


/*好了！以上就是系统的基本配置，如果没有必要，请不要再往下继续编辑了。请保存本文件。祝使用愉快！
 *
 *
 *下面开始就是核心代码咯，小心误操作噢
 */

//模块依赖和底层配置
const compression = require("compression"); //用于gzip压缩
const express = require("express"); //轻巧的express框架
const app = require("express")();
app.use(compression()); //对express所有路由启用gzip
app.use(express.static("static")); //静态文件引入
app.use(express.json()); //解析post
app.use(express.urlencoded({ extended: false })); //解析post
const multer = require("multer"); //用于文件上传
const cookie = require("cookie");
const http = require("http").Server(app);
const io = require("socket.io")(http);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
const colors = require("colors");
const path = require("path");
const jieba = require("nodejieba"); //中文分词器
jieba.load({
  dict: path.join(`${process.cwd()}`, "config", "jieba.dict.utf8"),
  hmmDict: path.join(`${process.cwd()}`, "config", "hmm_model.utf8"),
  userDict: path.join(`${process.cwd()}`, "config", "userDict.txt"), //加载自定义分词库
  idfDict: path.join(`${process.cwd()}`, "config", "idf.utf8"),
  stopWordDict: path.join(`${process.cwd()}`, "config", "stopWordDict.txt"), //加载分词库黑名单
});
require.all = require("require.all"); //插件加载器

// //错误捕获
// process.on("uncaughtException", (err) => {
//   io.emit("system message", `@未捕获的异常：${err}`);
//   console.log(`未捕获的异常，错误：${err}`.error);
// });

// //promise错误捕获
// process.on("unhandledRejection", (err) => {
//   io.emit("system message", `@未捕获的promise异常：${err}`);
//   console.log(`未捕获的promise异常：${err}`.error);
// });

console.log(`当前工作目录：${process.cwd()}`.log);

import {
  Curentyyyymmdd,
  CurentTime,
  sha1,
  Getnews,
  GetUserData,
  Bv2Av,
  RandomCos,
  RandomR18,
  SearchTag,
  RandomTbshow,
  RandomECY,
  RandomHomeword,
  RandomNickname,
  PrprDoge,
  ReadConfig,
  InitConfig,
  sqliteAll,
  ChatJiebaFuzzy,
  ChatProcess,
  SaveQQimg,
  RandomGroupList,
  GetBalabalaList,
  TTS,
  BetterTTS,
  GetLaststDanmu,
  DelayAlert,
  Gugua,
  QunGugua,
  WenDa,
  ECYWenDa,
  RainbowPi
} from "./system/System";

//载入配置
InitConfig();

/*
 *
 *下面是三大核心功能和实现：web端、qq端、直播间端
 *
 */

//web端核心代码，socket事件处理
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

      //更新登录次数
      db.run(`UPDATE users SET logintimes = logintimes + 1 WHERE CID ='${CID}'`);

      //更新最后登陆时间
      db.run(`UPDATE users SET lastlogintime = '${Curentyyyymmdd()}${CurentTime()}' WHERE CID ='${CID}'`);

      socket.username = nickname;

      io.emit("system message", `@欢迎回来，${socket.username}(${CID}) 。这是你第${logintimes}次访问。上次访问时间：${lastlogintime}`);
    })
    //若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作：
    .catch((reject) => {
      let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
      console.log(`GetUserData(): rejected, and err:${reject}`.warn);
      console.log(`${Curentyyyymmdd() + CurentTime()}新用户 ${CID} 已连接`.log);
      RandomNickname()
        .then((resolve) => {
          db.run(`INSERT INTO users VALUES('${resolve}', '${CID}', '2', '${Curentyyyymmdd()}${CurentTime()}')`);
          socket.username = resolve;
          io.emit("system message", `@新用户 ${CID} 已连接。小夜帮你取了一个随机昵称：「${socket.username}」，请前往 更多-设置 来更改昵称`);
          socket.emit("chat message", {
            CID: "0",
            msg: help,
          });
        })
        .catch((reject) => {
          console.log(`随机昵称错误：${reject}`.error);
          db.run(`INSERT INTO users VALUES('匿名', '${CID}', '2', '${Curentyyyymmdd()}${CurentTime()}')`);
          socket.username = "匿名";
          io.emit("system message", `@新用户 ${CID} 已连接。现在你的昵称是 匿名 噢，请前往 更多-设置 来更改昵称`);
          socket.emit("chat message", {
            CID: "0",
            msg: help,
          });
        });
    });

  socket.on("disconnect", () => {
    onlineusers--;
    io.emit("onlineusers", onlineusers);
    console.log(`${Curentyyyymmdd()}${CurentTime()} 用户 ${socket.username} 已断开连接`.log);
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
    socket.emit("updatelog", updatelog);
  });

  //致谢列表
  socket.on("thanks", () => {
    socket.emit("thanks", thanks);
  });

  //web端最核心代码，聊天处理
  socket.on("chat message", (msg) => {
    let CID = cookie.parse(socket.request.headers.cookie || "").ChatdacsID;
    var msg = msg.msg;
    msg = msg.replace(/'/g, ""); //防爆
    msg = msg.replace(/</g, ""); //防爆
    msg = msg.replace(/>/g, ""); //防爆
    console.log(`${Curentyyyymmdd() + CurentTime()}收到用户 ${socket.username}(${CID}) 的消息: ${msg}`.warn);
    db.run(`INSERT INTO messages VALUES('${Curentyyyymmdd()}', '${CurentTime()}', '${CID}', '${msg}')`);

    io.emit("chat message", { CID: CID, name: socket.username, msg: msg }); //用户广播

    //开始if地狱
    if (rename_reg.test(msg)) {
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
          console.log(data).log;
          io.emit("chart message", data);
        } else {
          console.log(`/log_view错误：${e}`.error);
          io.emit("chat message", { CID: "0", msg: `@${e}` });
        }
      });
    } else if (bv2av_reg.test(msg)) {
      msg = msg.replace(" ", "");
      Bv2Av(msg)
        .then((resolve) => {
          io.emit("chat message", { CID: "0", msg: resolve });
        })
        .catch((reject) => {
          console.log(`Bv2Av(): rejected, and err:${reject}`.error);
          io.emit("system message", `@Bv2Av() err:${reject}`);
        });
    } else if (msg === "/reload") {
      io.emit("reload");
    } else if (msg === "/帮助") {
      io.emit("chat message", { CID: "0", msg: `@${help}` });
    } else if (msg === "/随机cos") {
      RandomCos()
        .then((resolve) => {
          io.emit("pic message", resolve);
        })
        .catch((reject) => {
          console.log(`RandomCos(): rejected, and err:${reject}`.error);
          io.emit("system message", `@RandomCos() err:${reject}`);
        });
    } else if (msg === "/随机买家秀") {
      RandomTbshow()
        .then((resolve) => {
          io.emit("pic message", resolve);
        })
        .catch((reject) => {
          console.log(`RandomTbshow(): rejected, and err:${reject}`.error);
          io.emit("system message", `@RandomTbshow() err:${reject}`);
        });
    } else if (msg === "/随机冷知识") {
      RandomHomeword()
        .then((resolve) => {
          io.emit("chat message", { CID: "0", msg: `@${resolve}` });
        })
        .catch((reject) => {
          console.log(`RandomHomeword(): rejected, and err:${reject}`.error);
          io.emit("system message", `@RandomHomeword() err:${reject}`);
        });
    } else if (msg === "/随机二次元图") {
      RandomECY()
        .then((resolve) => {
          io.emit("pic message", resolve);
        })
        .catch((reject) => {
          console.log(`RandomECY(): rejected, and err:${reject}`.error);
          io.emit("system message", `@RandomECY() err:${reject}`);
        });
    } //吠
    else if (yap_reg.test(msg)) {
      msg = msg.replace("/吠 ", "");
      msg = msg.replace("/吠", "");
      BetterTTS(msg)
        .then((resolve) => {
          io.emit("audio message", resolve);
        })
        .catch((reject) => {
          console.log(`TTS错误：${reject}`.error);
          io.emit("system message", `@TTS错误：${reject}`);
        });
    } //教学系统，抄板于虹原翼版小夜v3
    else if (teach_reg.test(msg)) {
      msg = msg.substr(2).split("答：");
      if (msg.length !== 2) {
        console.log(`教学指令：分割有误，退出教学`.error);
        io.emit("system message", `@你教的姿势不对噢qwq`);
        return 0;
      }
      let ask = msg[0].trim(),
        ans = msg[1].trim();
      if (ask == "" || ans == "") {
        console.log(`问/答为空，退出教学`.error);
        io.emit("system message", `@你教的姿势不对噢qwq`);
        return 0;
      }
      if (ask.indexOf(/\r?\n/g) !== -1) {
        console.log(`教学指令：关键词换行了，退出教学`.error);
        io.emit("system message", `@关键词不能换行啦qwq`);
        return 0;
      }
      console.log(`web端 ${socket.username} 想要教给小夜：问：${ask} 答：${ans}，现在开始检测合法性`.log);
      for (let i in black_list_words) {
        if (
          ask.toLowerCase().indexOf(black_list_words[i].toLowerCase()) !== -1 ||
          ans.toLowerCase().indexOf(black_list_words[i].toLowerCase()) !== -1
        ) {
          console.log(`教学指令：检测到不允许的词：${black_list_words[i]}，退出教学`.error);
          io.emit("system message", `@你教的内容里有主人不允许小夜学习的词qwq`);
          return 0;
        }
      }
      if (Buffer.from(ask).length < 4) {
        //关键词最低长度：4个英文或2个汉字
        console.log(`教学指令：关键词太短，退出教学`.error);
        io.emit("system message", `@关键词太短了啦qwq，至少要4个字节啦`);
        return 0;
      }
      if (ask.length > 350 || ans.length > 350) {
        //图片长度差不多是350左右
        console.log(`教学指令：教的太长了，退出教学`.error);
        io.emit("system message", `@你教的内容太长了，小夜要坏掉了qwq，不要呀`);
        return 0;
      }
      //到这里都没有出错的话就视为没有问题，可以让小夜学了
      console.log(`教学指令：没有检测到问题，可以学习`.log);
      db.run(`INSERT INTO chat VALUES('${ask}', '${ans}')`);
      console.log(`教学指令：学习成功`.log);
      io.emit("system message", `@哇！小夜学会啦！对我说：${ask} 试试吧，小夜有可能会回复 ${ans} 噢`);
      return 0;
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
                console.log(`舔狗回复：${resolve}`.log);
                io.emit("chat message", {
                  CID: "0",
                  msg: resolve,
                });
              })
              .catch((reject) => {
                console.log(`随机舔狗错误：${reject}`.error);
              });
          });
      } else {
        return 0;
      }
    }
  });
});
