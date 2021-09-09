/// <reference path="Core.ts" />
/// <reference path="Global.ts" />

// 加载全局配置
const Global = require('./Global');

//模块依赖和底层配置
const app = require("express")();
const multer = require("multer"); //用于文件上传
const upload = multer({ dest: "static/uploads/" }); //用户上传目录
const http = require("http").Server(app);
const io = require("socket.io")(http);
const request = require("request");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db"); //数据库位置，默认与index.js同目录
const fs = require("fs");
const path = require("path");
const jieba = require("nodejieba"); //中文分词器
jieba.load({
  dict: Global.jieba_load("jieba.dict.utf8"),
  hmmDict: Global.jieba_load("hmm_model.utf8"),
  userDict: Global.jieba_load("userDict.txt"), //加载自定义分词库
  idfDict: Global.jieba_load("idf.utf8"),
  stopWordDict: Global.jieba_load("stopWordDict.txt"), //加载分词库黑名单
});
const yaml = require("yaml"); //使用yaml解析配置文件
const AipSpeech = require("baidu-aip-sdk").speech; //百度语音sdk
const crypto = require("crypto"); //编码库，用于sha1生成文件名
require.all = require("require.all"); //插件加载器

class Tools {
  core: Core.Core;
  global: Global.Global;

  init(core: Core.Core, global: Global.Global) {
    this.core = core;
    this.global = global;
  }

  getGlobal() {
    return this.global;
  }

  //年月日
  Curentyyyymmdd() {
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
  CurentTime() {
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

  //生成唯一文件名
  sha1(buf) {
    return crypto.createHash("sha1").update(buf).digest("hex");
  }

  //新闻
  Getnews() {
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
  GetUserData(msg) {
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

  //BV转AV
  Bv2Av(msg) {
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
  RandomCos() {
    return new Promise((resolve, reject) => {
      var rand_page_num = Math.floor(Math.random() * this.global.cos_total_count);
      request(
        "https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=hot&page_num=" + rand_page_num + "&page_size=1",
        (err, response, body) => {
          body = JSON.parse(body);
          if (!err && response.statusCode === 200 && body.code === 0 && body.data.total_count != 0) {
            this.global.cos_total_count = body.data.total_count;
            try {
              var obj = body.data.items[0].item.pictures; //经常出现某个item里没有图片的毛病，阿B你在干什么啊
            } catch (err) {
              reject("获取随机cos错误，是B站的锅。这个item里又双草没有图片，阿B你在干什么啊。错误原因：" + JSON.stringify(response.body));
              return 0;
            }
            var count = Object.keys(obj).length;
            var picUrl = obj[Math.floor(Math.random() * count)].img_src;
            console.log(`cos总数：${this.global.cos_total_count}页，当前选择：${rand_page_num}页，发送图片：${picUrl}`);
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

  //随机r18
  RandomR18() {
    return new Promise((resolve, reject) => {
      request("https://api.lolicon.app/setu/v2?r18=1&size=regular", (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          var picUrl = body.data[0].urls.regular;
          console.log(`发送r18图片：${picUrl}`);
          request(picUrl, (err) => {
            if (err) {
              reject("获取tag错误，错误原因：" + err);
            }
          }).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
              if (!err) {
                resolve(`/images/${picUrl.split("/").pop()}`);
              } else {
                reject("这张色图太大了，下不下来");
              }
            })
          ); //绕过防盗链，保存为本地图片
        } else {
          reject("获取随机r18错误，错误原因：" + JSON.stringify(response.body));
        }
      });
    });
  }

  //搜索tag
  SearchTag(tag) {
    return new Promise((resolve, reject) => {
      request(`https://api.lolicon.app/setu/v2?r18=1&size=regular&tag=${encodeURI(tag)}`, (err, response, body) => {
        body = JSON.parse(body);
        if (!err && body.data[0] != null) {
          var picUrl = body.data[0].urls.regular;
          console.log(`发送tag图片：${picUrl}`);
          request(picUrl, (err) => {
            if (err) {
              reject(`${tag}的色图太大了，下不下来`);
            }
          }).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (err) => {
              if (!err) {
                resolve(`/images/${picUrl.split("/").pop()}`);
              } else {
                reject(`${tag}的色图太大了，下不下来`);
              }
            })
          ); //绕过防盗链，保存为本地图片
        } else {
          reject(`找不到${tag}的色图`);
        }
      });
    });
  }

  //随机买家秀
  RandomTbshow() {
    return new Promise((resolve, reject) => {
      request(`https://api.sumt.cn/api/rand.tbimg.php?token=${sumtkey}&format=json`, (err, response, body) => {
        body = JSON.parse(body);
        if (!err && body.code === 200) {
          let picUrl = body.pic_url;
          request(picUrl).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
              console.log(`保存了珍贵的随机买家秀：${picUrl}，然后再给用户`);
            })
          ); //来之不易啊，保存为本地图片
          resolve(body.pic_url); //但是不给本地地址，还是给的源地址，这样节省带宽
        } else {
          reject("随机买家秀错误，是卡特实验室接口的锅。错误原因：" + JSON.stringify(response.body));
        }
      });
    });
  }

  //随机二次元图
  RandomECY() {
    return new Promise((resolve, reject) => {
      request(`https://iw233.cn/api/Random.php`, (err, response, _body) => {
        if (!err) {
          let picUrl = response.request.uri.href;
          request(picUrl).pipe(
            fs.createWriteStream(`./static/images/${picUrl.split("/").pop()}`).on("close", (_err) => {
              console.log(`保存了好康的二次元图：${picUrl}，然后再给用户`);
            })
          ); //来之不易啊，保存为本地图片
          resolve(picUrl); //但是不给本地地址，还是给的源地址，这样节省带宽
        } else {
          reject("随机二次元图错误，是这个神秘接口的锅。错误原因：图片太鸡儿大了");
        }
      });
    });
  }

  //随机冷知识
  RandomHomeword() {
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
  RandomNickname() {
    return new Promise((resolve, reject) => {
      request(`http://api.tianapi.com/txapi/cname/index?key=${Tiankey}`, (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          try {
            body.newslist[0].naming;
          } catch (err) {
            reject(
              "获取随机昵称错误，是天行接口的锅，可能是您还没有配置密钥，这条错误可以无视，不影响正常使用。错误原因：" + JSON.stringify(response.body)
            );
          }
          resolve(body.newslist[0].naming);
        } else {
          reject("获取随机昵称错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
        }
      });
    });
  }

  //舔狗回复
  PrprDoge() {
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

  //读取配置文件 config.yml
  ReadConfig() {
    console.log(`开始加载……`);
    try {
      var data = fs.readFileSync(path.join(`${process.cwd()}`, "config", "config.yml"), "utf-8");
      return yaml.parse(data);
    } catch (err) {
      console.log("读取配置文件错误。错误原因：" + err);
      return false;
    }
  }

  //初始化配置
  InitConfig() {
    let resolve = this.ReadConfig();
    this.global.chat_swich = resolve.System.chat_swich;
    this.global.conn_go_cqhttp = resolve.System.conn_go_cqhttp;
    this.global.Now_On_Live = resolve.System.Now_On_Live;
    this.global.web_port = resolve.System.web_port;
    this.global.go_cqhttp_service = resolve.System.go_cqhttp_service;
    this.global.go_cqhttp_api = resolve.System.go_cqhttp_api;

    this.global.Tiankey = resolve.ApiKey.Tiankey; //天行接口key
    this.global.sumtkey = resolve.ApiKey.sumtkey; //卡特实验室接口key
    this.global.baidu_app_id = resolve.ApiKey.baidu_app_id; //百度应用id
    this.global.baidu_api_key = resolve.ApiKey.baidu_api_key; //百度接口key
    this.global.baidu_secret_key = resolve.ApiKey.baidu_secret_key; //百度接口密钥

    this.global.bot_qq = resolve.qqBot.bot_qq; //qqBot使用的qq帐号
    this.global.qq_admin_list = resolve.qqBot.qq_admin_list; //qqBot小夜的管理员列表
    this.global.private_service_swich = resolve.qqBot.private_service_swich; //私聊开关
    this.global.topN = resolve.qqBot.topN; //qqBot限制分词数量
    this.global.reply_probability = resolve.qqBot.reply_probability; //回复几率
    this.global.fudu_probability = resolve.qqBot.fudu_probability; //复读几率
    this.global.chaos_probability = resolve.qqBot.chaos_probability; //抽风几率
    this.global.req_fuliji_list = resolve.qqBot.req_fuliji_list; //福利姬
    this.global.req_ECY_list = resolve.qqBot.req_ECY_list; //二次元图
    this.global.req_no_trap_list = resolve.qqBot.req_no_trap_list; //今日不带套
    this.global.qqimg_to_web = resolve.qqBot.qqimg_to_web; //保存接收图片开关
    this.global.max_mine_count = resolve.qqBot.max_mine_count; //最大共存地雷数
    this.global.black_list_words = resolve.qqBot.black_list_words; //教学系统的黑名单

    this.global.blive_room_id = resolve.Others.blive_room_id; //哔哩哔哩直播间id
    this.global.cos_total_count = resolve.Others.cos_total_count; //哔哩哔哩直播间ID

    this.global.SpeechClient = new AipSpeech(this.global.baidu_app_id, this.global.baidu_api_key, this.global.baidu_secret_key); //建立TTS调用接口
    
    console.log(`_______________________________________\n`);
    console.log(`\n         ${this.global.version}          \n`);

    if (this.global.chat_swich) {
      console.log("web端自动聊天开启\n");
    } else {
      console.log("web端自动聊天关闭\n");
    }

    if (this.global.conn_go_cqhttp) {
      console.log(
        `qqBot小夜开启，配置：\n  ·使用QQ帐号 ${this.global.bot_qq}\n  ·对接go-cqhttp接口 ${this.global.go_cqhttp_api}\n  ·监听反向post于 127.0.0.1:${this.global.web_port}${this.global.go_cqhttp_service}\n  ·私聊服务是否开启：${this.global.private_service_swich}\n`
      );
      this.global.xiaoye_ated = new RegExp(`\\[CQ:at,qq=${this.global.bot_qq}\\]`); //匹配小夜被@
      this.core.start_qqbot();
    } else {
      console.log("qqBot小夜关闭\n");
    }

    if (this.global.Now_On_Live) {
      console.log(`小夜直播对线开启，请确认哔哩哔哩直播间id是否为 ${this.global.blive_room_id}\n`);
      this.core.start_live();
    } else {
      console.log("小夜直播对线关闭\n");
    }
  }

  //异步sqliteALL by@ssp97
  sqliteAll(query) {
    return new Promise(function (resolve, reject) {
      db.all(query, function (err, rows) {
        if (err) reject(err.message);
        else {
          resolve(rows);
        }
      });
    });
  };

  //异步结巴 by@ssp97
  async ChatJiebaFuzzy(msg) {
    msg = msg.replace("/", "");
    msg = jieba.extract(msg, this.global.topN); //按权重分词
    let candidate = [];
    let candidateNextList = [];
    let candidateNextGrand = 0;
    console.log(`分词出关键词：`);
    console.log(msg);
    //收集数据开始
    for (const key in msg) {
      if (Object.hasOwnProperty.call(msg, key)) {
        const element = msg[key];
        console.log(element);
        var rows: any = await this.sqliteAll("SELECT * FROM chat WHERE ask LIKE '%" + element.word + "%'");
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

  //聊天处理，最核心区块，超智能(智障)的聊天算法：整句搜索，模糊搜索，分词模糊搜索并轮询
  async ChatProcess(msg) {
    const full_search = await new Promise((resolve, _reject) => {
      console.log("开始整句搜索");
      db.all("SELECT * FROM chat WHERE ask = '" + msg + "'", (e, sql) => {
        if (!e && sql.length > 0) {
          console.log(`对于整句:  ${msg} ，匹配到 ${sql.length} 条回复`);
          let ans = Math.floor(Math.random() * sql.length);
          let answer = JSON.stringify(sql[ans].answer);
          answer = answer.replace(/"/g, "");
          console.log(`随机选取第${ans + 1}条回复：${answer}`);
          resolve(answer);
          return 0;
        } else {
          console.log(`聊天数据库中没有匹配到整句 ${msg} 的回复`);
          resolve();
        }
      });
    });

    if (full_search) {
      //优先回复整句匹配
      console.log(`返回整句匹配`);
      return full_search;
    }

    const like_serach = await new Promise((resolve, _reject) => {
      console.log("开始模糊搜索");
      db.all("SELECT * FROM chat WHERE ask LIKE '%" + msg + "%'", (e, sql) => {
        if (!e && sql.length > 0) {
          console.log(`模糊搜索: ${msg} ，匹配到 ${sql.length} 条回复`);
          let ans = Math.floor(Math.random() * sql.length);
          let answer = JSON.stringify(sql[ans].answer);
          answer = answer.replace(/"/g, "");
          console.log(`随机选取第${ans + 1}条回复：${answer}`);
          resolve(answer);
          return 0;
        } else {
          console.log(`聊天数据库中没有匹配到 ${msg} 的模糊回复`);
          resolve();
        }
      });
    });

    if (like_serach) {
      //其次是模糊匹配
      console.log(`返回模糊匹配`);
      return like_serach;
    }

    // 分词模糊搜索
    let candidateList = await this.ChatJiebaFuzzy(msg);
    if (candidateList.length > 0) {
      return candidateList[Math.floor(Math.random() * candidateList.length)];
    }
    // 随机敷衍
    let result = await this.sqliteAll("SELECT * FROM balabala ORDER BY RANDOM()"); //有待优化
    //console.log(result)
    return result[0].balabala;
  }

  //保存qq侧传来的图
  SaveQQimg(imgUrl) {
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
  RandomGroupList() {
    return new Promise((resolve, reject) => {
      request(`http://${this.global.go_cqhttp_api}/get_group_list`, (err, response, body) => {
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

  //获取balabala
  GetBalabalaList() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM balabala;", (err, sql) => {
        if (!err && sql[0]) {
          let balabala = sql;
          resolve(balabala);
        } else {
          reject("获取balabala错误。错误原因：" + err + ", sql:" + sql);
        }
      });
    });
  }

  //语音合成TTS
  TTS(tex) {
    return new Promise((resolve, reject) => {
      if (!tex) tex = "你好谢谢小笼包再见!";
      this.global.SpeechClient.text2audio(tex, {
        spd: 5, //1-9  语速,正常语速为5
        pit: 8, //1-9  语调,正常语调为5
        per: 4, //1-12 声线,1=2:普通男性,3:有情感的播音男性,4:有情感的萝莉声线-度丫丫;5:普通女性,6:抑扬顿挫有情感的讲故事男性(纪录频道),7:有情感的广东话女性,8:语气平淡的念诗男性(葛平),9:速读普通男性,10:略有情感的刚成年男性,11:刺耳而略有情感的讲故事男性(情感强度比6弱),12:温柔的有情感的讲故事女性,1-12以外的数值会被转为12
      }).then(
        function (result) {
          if (result.data) {
            console.log(`${tex} 的语音合成成功`);
            fs.writeFileSync(`./static/xiaoye/tts/${this.sha1(result.data)}.mp3`, result.data);
            let file = { file: `/xiaoye/tts/${this.sha1(result.data)}.mp3`, filename: "小夜语音回复" };
            resolve(file);
          } else {
            // 合成服务发生错误
            console.log(`语音合成失败：${JSON.stringify(result)}`);
            reject("语音合成TTS错误：", JSON.stringify(result));
          }
        },
        function (err) {
          console.log(err.error);
          reject("语音合成TTS错误：", err);
        }
      );
    });
  }

  //扒的百度臻品音库-度米朵
  BetterTTS(tex) {
    return new Promise((resolve, reject) => {
      if (!tex) tex = "你好谢谢小笼包再见!";
      request("https://ai.baidu.com/aidemo?type=tns&per=4103&spd=6&pit=10&vol=10&aue=6&tex=" + encodeURI(tex), (err, _response, body) => {
        body = JSON.parse(body);
        if (!err && body.data) {
          console.log(`${tex} 的幼女版语音合成成功`);
          let base64Data = body.data.replace(/^data:audio\/x-mpeg;base64,/, "");
          let dataBuffer = Buffer.from(base64Data, "base64");
          fs.writeFileSync(`./static/xiaoye/tts/${this.sha1(dataBuffer)}.mp3`, dataBuffer);
          let file = { file: `/xiaoye/tts/${this.sha1(dataBuffer)}.mp3`, filename: "小夜幼女版语音回复" };
          resolve(file);
        } else {
          //估计被发现扒接口了
          console.log(`语音合成幼女版失败：${JSON.stringify(body)}`);
          reject("语音合成幼女版TTS错误：", JSON.stringify(body));
        }
      });
    });
  }

  //获取最新直播间弹幕
  GetLaststDanmu() {
    return new Promise((resolve, reject) => {
      request(`https://api.live.bilibili.com/xlive/web-room/v1/dM/gethistory?roomid=${blive_room_id}`, (err, response, body) => {
        if (!err) {
          body = JSON.parse(body); //居然返回的是字符串而不是json
          try {
            body.data.room[0].text;
          } catch (err) {
            reject("直播间刚开，还没有弹幕，请再等等吧", err, response);
            return 0;
          }
          resolve({ text: body.data.room[body.data.room.length - 1].text, timeline: body.data.room[body.data.room.length - 1].timeline });
        } else {
          reject(err, response);
        }
      });
    });
  }

  //随机延时提醒闭菊的群
  DelayAlert(service_stoped_list) {
    let alert_msg = [
      //提醒文本列表
      `呜呜呜，把人家冷落了那么久，能不能让小夜张菊了呢...小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${this.global.bot_qq}] 才可以了噢`,
      `闭菊那么久了，朕的菊花痒了！还不快让小夜张菊！小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${this.global.bot_qq}] 才可以了噢`,
      `小夜也想为大家带来快乐，所以让小夜张菊，好吗？小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${this.global.bot_qq}] 才可以了噢`,
      `欧尼酱，不要再无视我了，小夜那里很舒服的，让小夜张菊试试吧~小夜的张菊指令更新了，现在需要发 张菊[CQ:at,qq=${this.global.bot_qq}] 才可以了噢`,
    ];
    for (let i in service_stoped_list) {
      let delay_time = Math.floor(Math.random() * 60); //随机延时0到60秒
      let random_alert_msg = alert_msg[Math.floor(Math.random() * alert_msg.length)];
      console.log(`qqBot小夜将会延时 ${delay_time} 秒后提醒群 ${service_stoped_list[i]} 张菊，提醒文本为：${random_alert_msg}`);
      setTimeout(function () {
        request(
          `http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${service_stoped_list[i]}&message=${encodeURI(random_alert_msg)}`,
          function (error, _response, _body) {
            if (!error) {
              console.log(`qqBot小夜提醒了群 ${service_stoped_list[i]} 张菊，提醒文本为：${random_alert_msg}`);
            } else {
              console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
            }
          }
        );
      }, 1000 * delay_time);
    }
  }

  //私聊发送孤寡
  Gugua(who) {
    let gugua_pic_list = [
      //图片列表
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.png",
      "5.gif",
    ];
    for (let i in gugua_pic_list) {
      let file_online = `http://127.0.0.1:${this.global.web_port}/xiaoye/ps/${gugua_pic_list[i]}`;
      let pic_now = `[CQ:image,file=${file_online},url=${file_online}]`;
      setTimeout(function () {
        request(`http://${this.global.go_cqhttp_api}/send_private_msg?user_id=${who}&message=${encodeURI(pic_now)}`, function (error, _response, _body) {
          if (!error) {
            console.log(`qqBot小夜孤寡了 ${who}，孤寡图为：${pic_now}`);
          } else {
            console.log(`请求${this.global.go_cqhttp_api}/send_private_msg错误：${error}`);
          }
        });
      }, 1000 * 5 * i);
    }
  }

  //群发送孤寡
  QunGugua(who) {
    let gugua_pic_list = [
      //图片列表
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.png",
      "5.gif",
    ];
    for (let i in gugua_pic_list) {
      let file_online = `http://127.0.0.1:${this.global.web_port}/xiaoye/ps/${gugua_pic_list[i]}`;
      let pic_now = `[CQ:image,file=${file_online},url=${file_online}]`;
      setTimeout(function () {
        request(`http://${this.global.go_cqhttp_api}/send_group_msg?group_id=${who}&message=${encodeURI(pic_now)}`, function (error, _response, _body) {
          if (!error) {
            console.log(`qqBot小夜孤寡了群 ${who}，孤寡图为：${pic_now}`);
          } else {
            console.log(`请求${this.global.go_cqhttp_api}/send_group_msg错误：${error}`);
          }
        });
      }, 1000 * 5 * i);
    }
  }

  //百科问答题库
  WenDa() {
    return new Promise((resolve, reject) => {
      request(`http://api.tianapi.com/txapi/wenda/index?key=${this.global.Tiankey}`, (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          resolve({ quest: body.newslist[0].quest, result: body.newslist[0].result });
        } else {
          reject("问答错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
        }
      });
    });
  }

  //浓度极高的ACGN圈台词问答题库
  ECYWenDa() {
    return new Promise((resolve, _reject) => {
      request(`https://api.oddfar.com/yl/q.php?c=2001&encode=json`, (err, _response, body) => {
        body = JSON.parse(body);
        if (!err) {
          var msg = jieba.extract(body.text, this.global.topN); //按权重分词
          if (msg.length == 0) {
            //如果分词不了，那就直接夜爹牛逼
            resolve({ quest: `啊噢，出不出题了，你直接回答 夜爹牛逼 吧`, result: `夜爹牛逼` });
            return 0;
          }
          let rand_word_num = Math.floor(Math.random() * msg.length);
          let answer = msg[rand_word_num].word;
          console.log(`原句为：${body.text}，随机切去第 ${rand_word_num + 1} 个关键词 ${answer} 作为答案`);
          let quest = body.text.replace(answer, "________");
          resolve({ quest: quest, result: answer });
        } else {
          resolve({ quest: `啊噢，出不出题了，你直接回答 夜爹牛逼 吧`, result: `夜爹牛逼` });
        }
      });
    });
  }

  //彩虹屁回复
  RainbowPi() {
    return new Promise((resolve, reject) => {
      request(`http://api.tianapi.com/txapi/caihongpi/index?key=${this.global.Tiankey}`, (err, response, body) => {
        body = JSON.parse(body);
        if (!err) {
          resolve(body.newslist[0].content);
        } else {
          reject("彩虹屁错误，是天行接口的锅。错误原因：" + JSON.stringify(response.body));
        }
      });
    });
  }

  app_interface() {
    //更改个人资料接口
    app.get("/profile", (req, res) => {
      db.run(`UPDATE users SET nickname = '${req.query.name}' WHERE CID ='${req.query.CID}'`);
      res.sendFile(process.cwd() + g.html);
    });
    
    //图片上传接口
    app.post("/upload/image", upload.single("file"), function (req, _res, _next) {
      console.log(`用户上传图片：${req.file}`);
      let oldname = req.file.path;
      let newname = req.file.path + path.parse(req.file.originalname).ext;
      fs.renameSync(oldname, newname);
      io.emit("pic message", `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`);
    });
    
    //文件/视频上传接口
    app.post("/upload/file", upload.single("file"), function (req, _res, _next) {
      console.log(`用户上传文件：${req.file}`);
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
  }
}

export { Tools };
