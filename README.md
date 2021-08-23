<table width="100%" border="0">
  <tr>
  <td style="width:80%;vertical-align:top;">
    <h1 align="center">
      <img src="https://repository-images.githubusercontent.com/171253757/27be1b16-8dbb-41ba-90b5-4b28157f3def" width="200" height="200" alt="ChatDACS"/><br/>
      星野夜蝶<br/>
      Hoshino Yedie<br/>
    </h1>
    <h2 align="center">
      沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)
    </h2>
    <p align="center">
      一个无需服务器，可私有化部署、可独立运行于内网的H5聊天工具。<br/>
      技术栈：语言——Node.js，web框架——Express，前端组件库——layui。<br/>
      开箱即用，非常好用，我的朋友。<br/>
      画师：塘李<br/>
      <br/>
      示例 DEMO：<a href="http://chatdacs.giftia.moe/" target="_blank">chatdacs.giftia.moe</a><br/>
      简易搭建教程 Tutorials：<a href="https://zhuanlan.zhihu.com/p/67995935" target="_blank">zhuanlan.zhihu.com/p/67995935</a><br/>
      隶属于星野夜蝶Official：<a href="https://github.com/Giftia/Project_Xiaoye" target="_blank">github.com/Giftia/Project_Xiaoye</a>
      <br>
    </p>
  </td>

  <td style="width:20%;vertical-align:top;">
    <img src="https://raw.githubusercontent.com/Giftia/ChatDACS/master/static/xiaoye/images/yedie_out.png" width="200" alt="stand" />
    <p align="center">
      星野夜蝶 立绘
    </p>
  </td>
  </tr>
</table>

<p align="center">
  <img src="https://img.shields.io/uptimerobot/ratio/m783632550-7da46d24226cb151b978c810?label=%E5%AD%98%E6%B4%BB%E7%8E%87&style=for-the-badge" alt="Uptime(30 days)" />
  &nbsp;
  <img src="https://img.shields.io/website?label=demo&style=for-the-badge&up_message=online&url=http://chatdacs.giftia.moe/" alt="Demo" />
  &nbsp;
  <img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/Giftia/ChatDACS/Compile%20ChatDACS%20for%20Windows?label=%E8%87%AA%E5%8A%A8%E6%9E%84%E5%BB%BA&style=for-the-badge">
  &nbsp;
  <img src="https://img.shields.io/github/license/Giftia/ChatDACS?label=%E5%BC%80%E6%BA%90%E8%AE%B8%E5%8F%AF&style=for-the-badge" alt="License" />
  &nbsp;
  <img src="https://img.shields.io/github/languages/code-size/Giftia/ChatDACS?label=%E4%BB%A3%E7%A0%81%E5%A4%A7%E5%B0%8F&style=for-the-badge" alt="Code size" />
</p>

---

## ✨ 功能与特性 Features

- [x] 完善的聊天界面与各种奇奇怪怪的功能 `Nice UI and funny functions`
- [x] 无限制的在线聊天 `Unlimit chatroom`
- [x] 与经过 2w+用户调教养成的人工智能机器人小夜实时聊天 `Chat with Ai Xiaoye`
- [x] 令人激动的、实用的在线涩图功能 `Nice pictures`
- [x] 图片、视频与文件分享 `Share your images,videos and files`
- [x] 与 go-cqhttp 对接，实现了小夜 v3 分支框架 `Connectable with go-cqhttp`
- [ ] 自定义表情包 `Use your own stickers`
- [ ] 私聊 `Private chat`
- [ ] 付费内容 `Premium content`

---

## ⚡️ 快速启动 Quick start

不想要枯燥的部署和配置操作，只想要快速运行一个属于自己的小夜？首先来试试快速启动吧：

进入自动化部署工作流 Actions https://github.com/Giftia/ChatDACS/actions，

点击最新成功构建的 Compile ChatDACS for Windows 工作流，

在页面下方的 Artifacts 里点击下载自动构建好的 ChatDACS 包，解压出来，

打开 plugins\go-cqhttp 文件夹里的 config.yml 文件，修改并保存第 4、5 行的 qq 和密码为 bot 使用的 qq 帐号密码，

然后运行 go-cqhttp_windows_amd64.exe，看看 qq 有没有正常登陆上，

之后打开 config 文件夹里的 config.yml 文件，修改并保存第 43 行 bot_qq 的配置项为 bot 使用的 qq 帐号，

最后直接运行 chatdacs.exe 就可以辣。

（正在逐步改善启动便捷性，以后会越来越方便的）

---

## ✅ 快速部署 Quick deploy

如果在快速启动过程中出现了各种的问题，那么请尝试快速部署：

首先去 https://nodejs.org/zh-cn/ 下载安装 LTS(长期支持版) Node.js，

然后下载最新代码压缩包 https://github.com/Giftia/ChatDACS/archive/refs/heads/master.zip ，

解压到任意文件夹，双击代码根目录下的 init.bat 一键部署，

部署完毕后 沙雕 Ai 聊天系统 会自动启动。以后可双击 run.bat 启动。

---

## 🛠 手动部署 Manual deployment

若您的操作系统和架构并不是常见的 Windows OS x64，

或者是在快速启动、部署过程出现了错误，

亦或者是还想给小夜加一些功能，请按如下操作进行常规的手动部署：

打开系统的 shell ，如 Bash、CMD、PowerShell 等，用 cd 命令进入代码根目录运行：

```bash
npm install -g cnpm --registry=https://registry.npm.taobao.org
```

等待进度完成后运行：

```bash
cnpm install
```

等待进度完成后运行：

```bash
node index.js
```

好了，它应该已经启动了 🎉。更详细的部署和配置说明请查看 index.js 文件。

如果还是有问题的话，请进群来问问题吧，我们有问必答噢。点击链接加入群聊【星野夜蝶   粉丝群】：https://jq.qq.com/?_wv=1027&k=ovqyydCe

如果想要手动生成适合您的系统的绿色免安装运行 exe 文件，可以使用手动打包指令：

```bash
pkg .
```

---

## 😘 赞助者致谢名单：https://afdian.net/@xiaoye_bot

| 用户名           | 金额/人民币 | 留言：                                                                                                                                                                                |
| ---------------- | :---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 缤瑶             |     30      | 加油鸭                                                                                                                                                              |
| 缤瑶             |     30      | 加油很喜欢小夜嘴臭的样子                                                                                                                                                              |
| 卖萌傲娇萝莉赛高 |     30      | 很好玩的 bot，加油                                                                                                                                                                    |
| 眠眠打破\_       |    13.14    | 初次遇见小夜应该是 18 年初的时候 那时还在备战高考 今天的我正式走上了工作岗位 看到小夜复出 很感动 请 p 主喝杯奶茶 希望能在炎炎夏日为您带来一点糖分 愿 p 主和小夜的故事能够长远书写下去 |
| xian_yui         |     10      | 夜爹冲鸭                                                                                                                                                                              |
| On my own.       |     10      | 好耶                                                                                                                                                                                  |
| 冰菓             |    15.21    | 缇娜加油奥，在学代码了，等我学成归来了和你一块干 小夜                                                                                                                                 |
| 爱发电用户\_vcFq |     30      | 为什么没有连续包月折扣！！                                                                                                                                                            |
| 爱发电用户\_TWAG |     10      |
| kono 豆豆 da！   |      5      | 奶茶可以灌在膀胱里么嘤（bushi）                                                                                                                                                       |
| 砂糖酱           |     50      |
| 爱发电用户\_VhfC |     10      |
| 咕咕子           |     10      |
| 爱发电用户\_7jHF |     10      |
| 十八             |      5      | 夜爸爸加油                                                                                                                                                                            |
| 棒棒槌子         |      5      |
| 砂糖酱           |     50      |
| 棒棒槌子         |      5      |
| 砂糖酱           |     66      | 嗯 加点油                                                                                                                                                                             |
| 爱发电用户\_Jc5b |     30      |
| 玫瑰陨星之忆     |      5      |
| 玫瑰陨星之忆     |    6.66     |
| 爱发电用户\_WJPF |      5      |
| 滑小稽           |      5      |
| Yui              |     10      |
| 多芒小丸子       |     10      |
| 爱发电用户\_wScP |      6      |
| 昀翳             |     50      |
| 爱发电用户\_KGMa |     10      |
| 余薪             |     10      | 不知道做不做得出 ai 思考性行为...                                                                                                                                                     |
| 爱发电用户\_qr83 |     10      | xxxx)hhjjiskejeududnn3kssioskwnssj                                                                                                                                                    |

对本项目提供帮助的致谢名单（排名不分先后）：https://niconi.co.ni/ 、 https://www.layui.com/ 、 https://lceda.cn/ 、 https://www.dnspod.cn/ 、 Daisy_Liu 、 http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html 、 https://ihateregex.io/ 、 https://www.maoken.com/ 、 https://www.ngrok.cc/ 、 https://uptimerobot.com/ 、 https://shields.io/ 、 https://ctf.bugku.com/ 、 https://blog.squix.org/ 、 https://hostker.com/ 、 https://www.tianapi.com/ 、 https://api.sumt.cn/ 、 https://github.com/Mrs4s/go-cqhttp 、 https://colorhunt.co/ 、 https://github.com/ 、 https://gitee.com/ 、 https://github.com/windrises/dialogue.moe 、 https://api.oddfar.com/ 、 https://github.com/ssp97 、https://github.com/mxh-mini-apps/mxh-cp-stories、 还有我的朋友们，以及倾心分享知识的各位

---

禁止任何形式的倒卖转售，如有任何疑问、建议或者需要联系我，请加 QQ 群 120243247：点击链接加入群聊【星野夜蝶   粉丝群】：https://jq.qq.com/?_wv=1027&k=ovqyydCe
