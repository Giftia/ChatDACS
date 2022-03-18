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
      一个简单的机器人框架，支持接入哔哩哔哩直播，具备完全功能的web网页控制台。<br/>
      技术栈：语言——JavaScript，web框架——Express，前端组件库——layui，qq协议端——go-cqhttp。<br/>
      画师：塘李<br/>
      <br/>
      示例 DEMO：<a href="http://110.42.221.72/" target="_blank">http://110.42.221.72/</a><br/>
      简易搭建教程 Tutorials：<a href="https://zhuanlan.zhihu.com/p/67995935" target="_blank">zhuanlan.zhihu.com/p/67995935</a><br/>
      语录来自小夜：<a href="https://github.com/Giftia/Project_Xiaoye" target="_blank">github.com/Giftia/Project_Xiaoye</a>
      <br>
    </p>
  </td>

  <td style="width:20%;vertical-align:top;">
    <img src="https://i.loli.net/2021/08/25/sILl6XREJMDPAmt.png" width="200" alt="stand" />
    <p align="center">
      星野夜蝶 立绘
    </p>
  </td>
  </tr>
</table>

<p align="center">
  <a href="https://stats.uptimerobot.com/JYr8kI8jqg"><img src="https://img.shields.io/uptimerobot/ratio/m783632550-7da46d24226cb151b978c810?label=%E5%AD%98%E6%B4%BB%E7%8E%87&style=for-the-badge" alt="Uptime(30 days)" /></a>
  &nbsp;
  <a href="http://chatdacs.giftia.moe/"><img src="https://img.shields.io/website?label=demo&style=for-the-badge&up_message=online&url=http://chatdacs.giftia.moe/" alt="Demo" /></a>
  &nbsp;
  <a href="https://github.com/Giftia/ChatDACS/actions"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/Giftia/ChatDACS/Compile%20ChatDACS%20for%20Windows?label=%E8%87%AA%E5%8A%A8%E6%9E%84%E5%BB%BA&style=for-the-badge"></a>
  &nbsp;
  <img src="https://img.shields.io/github/license/Giftia/ChatDACS?label=%E5%BC%80%E6%BA%90%E8%AE%B8%E5%8F%AF&style=for-the-badge" alt="License" />
  &nbsp;
  <img src="https://img.shields.io/github/languages/code-size/Giftia/ChatDACS?label=%E4%BB%A3%E7%A0%81%E5%A4%A7%E5%B0%8F&style=for-the-badge" alt="Code size" />
</p>

---

## 😘 写在最前面 Hi

如有任何疑问、建议或者需要联系我，请加官方 QQ 群 120243247：点击链接加入群聊【星野夜蝶 粉丝群】：https://jq.qq.com/?_wv=1027&k=ovqyydCe

对于普通用户，推荐您直接使用官方免费的公共服务 QQ 账号：1648468212

但更推荐您使用私人部署，私人部署的好处都有啥：（好处来源：https://github.com/Sora233/DDBOT ）

- 保护您的隐私，bot 完全属于您，我无法得知您 bot 的任何信息（我甚至无法知道您部署了一个私人 bot）
- 稳定的功能，不会因为公共服务离线而无法运行
- 可自行定制 BOT 账号的头像、名字、签名，甚至是自己写功能
- 减轻我的服务器负担
- 很 cool，很极客

私人部署方式请下滑至下方的 快速启动 章节 ↓

## ✔ 功能介绍 Orders

- 基础功能（默认设定 聊天回复率 1%，随机复读率 1%，突然抽风率 0‰）

  - [x] 在群里随便聊天吧~小夜会随时准备好嘴臭的！还有概率会随机复读和抽风噢。在@小夜的时候回复几率会提高。
  - [x] `戳一戳`
    - 戳一戳小夜有利于身心健康。
  - [x] `/ping`
    - 测试小夜的连通性，附带一个简单的跑分，耗时越短越好。
  - [x] `张菊@小夜` & `闭菊`
    - 小夜的群服务开关。如果觉得小夜太吵了，想让小夜安静一会，那么在群里发 闭菊 即可关闭群内小夜的服务。张菊@小夜 为启用这只小夜的群服务，闭菊为停止群服务。请勿光速一开一合调整菊部呼吸。
  - [x] `问：关键词 答：小夜的回答`
    - 调教小夜说话吧！在优秀的聊天算法加成下，帮助养成由数万用户调教练就的嘴臭词库。当小夜收到含有关键词的语句时便会有几率触发回复，若该关键词有多个回复将会随机选择一个回复。支持图片问答。注意！冒号是中文全角的：，而不是英文半角的:，并且在 关键词 和 答：之间有一个空格。注意注意！如果像这样 “问：小夜的主人到底是谁呀 答：是你呀” 直接教完整的一句话的话是很难有效触发的，这就很考验你应该如何选择关键词了噢。像上面那个例子的话建议改成这样噢：“问：主人 答：是你呀”。
      - 使用例：`问：HELLO 答：WORLD`
  - [x] `/说不出话 文字或者图片`
    - 教给小夜一些比较通用的回复。对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复，类似狗屁不通文章的效果，回复了但没有完全回复。
  - [x] `/status`
    - 查询小夜的版本以及小夜的相关信息，该指令可以在登录 qq 与配置 qq 不匹配时自动更正。

- 地 雷 战（需小夜是群管理时有效）

  - [x] `埋地雷`
    - 一个有趣的小游戏，在群内埋下一坨极不稳定的地雷，有 30%的几率是掺了沙子的哑雷。在接下来的发言群员中会有一名幸运群友一脚踩到地雷，将会被炸伤 0 到 120 秒（禁言）。
  - [x] `踩地雷`
    - 觉得手雷和地雷都伤不到你，自带主角光环？还是说想当排雷步兵？不如来试试踩地雷吧！一脚踩到群友埋的地雷上，对你造成 60 到 240 秒的暴击伤害。
  - [x] `一个手雷 @被害者`
    - 一个有趣的小游戏，向@被害者丢出一个手雷，一位幸运玩家将会被炸伤 0 到 120 秒（禁言）。有千分之一的概率手雷会转化为神圣手雷（Holly Hand Grenade），将会炸伤所有无辜群友（全体禁言）。
  - [x] `希望的花 @希望目标`
    - 团长，你在做什么啊！团长！朝 @希望目标 丢出一朵希望的花，救活目标（解除禁言），但是团长自己会被炸成重伤，造成 60 到 600 秒的暴击伤害。
  - [x] `击鼓传雷`
    - 小夜会传给你一个手雷，你必须在 60 秒内尽快正确回答一个问题，不然就会在你手上爆炸噢。在回答正确之后，小夜会随机抽取一名幸运群友，把手雷传给 ta，ta 的回答时间将会是前一个玩家回答之后所剩的时间，依次类推，直到手雷在某个不幸群友手上爆炸才结束。这是一个只有死亡才能结束的游戏，做好准备了吗。

- 其他功能

  - [x] `/吠 你好谢谢小笼包再见`
    - 让小夜开口说话吧。小夜使用基于大数据的情感幼女语音合成技术，能吠出更自然的发音、更丰富的情感和更强大的表现力。可以插入一些棒读音以提高生草效果。
      - 使用例：`/吠 太好听了吧啊，你唱歌真的好嗷好听啊，简直就是天岸籁，我刚才听到你唱歌了，我们以后一起唱好不好，一起唱昂，一起做学园偶像昂`
  - [x] `/嘴臭 对话`
    - 小夜会通过语音来回应你的对话噢，还是要注意指令和对话之间要有个空格。
  - [x] `/舔我`
    - 让小夜化身舔狗，舔你一口
  - [x] `/彩虹屁`
    - 让小夜放个彩虹屁
  - [x] `/prpr 想pr的人`
    - 让小夜帮你舔 ta 吧
  - [x] `/今日不带套`
    - 七夕节快乐，让小夜帮你计算今天不带套的结果
  - [x] `/画师算命`
    - 一个简单的 avg 小说，可以自由扩展
  - [x] `/迫害 [迫害对象] (迫害文字)`
    - 让小夜来制作缺德的迫害表情包吧，欢迎提供表情包素材给小夜。现在可以迫害的对象：["唐可可", "上原步梦", "猛男狗", "令和", "鸭鸭", "陈睿"]
      - 使用例：`/迫害 上原步梦 是我，是我先，明明都是我先来的……接吻也好，拥抱也好，还是喜欢上那家伙也好。`
  - [x] `我有个朋友说(我有个朋友)[@谁]`
    - 小夜会 P 一张你朋友说的图。
  - [x] `/强制迫害 (@对象) (说了什么) (小夜说了什么)`
    - 小夜转发了一段来自平行世界的对话，适度娱乐噢。
  - [x] `/孤寡 @孤寡对象`
    - 七夕节快乐，小夜收到了你的孤寡订单，现在就开始孤寡 ta 辣！
  - [x] `cp 攻 受`
    - 让小夜生成一段简单的 cp 文。简简单单，就是最好的爱。
      - 使用例：`cp 小夜 小雫`
  - [x] `/报错 (报错内容)`
    - 向小夜开发组反馈消息，消息会实时转达到小夜开发成员。
  - [x] `qr (内容)`
    - 让小夜帮你快速生成二维码。
  - [x] `/黑白图 (图片) (第一排文字) (第二排文字)`
    - 让小夜帮你生成一张黑白生草图。
  - [ ] `人生重开`
    - 风靡全球的人生重开小游戏，数据来自 https://github.com/VickScarlet/lifeRestart 。
  - [x] `/roll`
    - 随机 roll 出 0 到 1000000 的随机数，可以自行跟随参数。

- 好康的

  - [x] `来图 或 图来`
    - 在普通限度的尺度下让小夜发一张合法的 cos 图
  - [x] `福利姬`
    - 在无限度的尺度下让小夜发一张非法的福利姬色图，危险注意！
  - [x] `二次元`
    - 在普通限度的尺度下让小夜发一张合法的二次元图
  - [x] `r18`
    - 在无限度的尺度下让小夜发一张非法的二次元图，超危险注意！
  - [x] `来点xx`
    - 在无限度的尺度下让小夜搜索一张非法的二次元图，xx 即你想搜索的 tag，超危险注意！

---

## ✨ 功能与特性 Features

- [x] web 端完善的聊天界面与各种奇奇怪怪的功能 `Nice UI and funny functions on web end`
- [x] 无限制的在线聊天 `Unlimit chatroom`
- [x] 与经过 2w+用户调教养成的人工智能机器人小夜实时聊天 `Chat with Ai Xiaoye`
- [x] 令人激动的、实用的在线涩图功能 `Nice pictures`
- [x] web 端图片、视频与文件分享 `Share your images,videos and files on web end`
- [x] 与 go-cqhttp 对接，实现了小夜 v3 分支框架 `Connectable with go-cqhttp`
- [ ] 插件系统 `Plugins System`
- [ ] 自定义表情包 `Use your own stickers`
- [ ] 私聊 `Private chat`

---

## ⚡️ 快速启动 Quick start

不想要枯燥的部署和配置操作，只想要快速运行一个属于自己的小夜？首先来试试快速启动吧：

进入自动化部署工作流 Actions https://github.com/Giftia/ChatDACS/actions ，

点击最新成功构建的 Compile ChatDACS for Windows 工作流，

在页面下方的 Artifacts 里点击下载自动构建好的 ChatDACS 包，解压出来，

用记事本打开 plugins\go-cqhttp 文件夹里的 config.yml 文件，修改并保存第 4、5 行的 qq 和密码为 bot 使用的 qq 帐号密码，

然后运行 go-cqhttp_windows_amd64.exe，看看 qq 有没有正常登陆上，

之后打开 config 文件夹里的 config.yml 文件，修改并保存第 43 行 bot_qq 的配置项为 bot 使用的 qq 帐号，

最后直接运行 chatdacs.exe 就可以辣。

（正在逐步改善启动便捷性，以后会越来越方便的）

---

## 🕹 快速部署 Quick deploy

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

如果还是有问题的话，请进群来问问题吧，有问必答噢。

如果想要手动生成适合您的系统的绿色免安装运行 exe 文件，可以使用手动打包指令：

```bash
pkg .
```

---

## 😘 赞助者致谢名单：https://afdian.net/@xiaoye_bot

| 用户名             |      金额/人民币      | 留言：                                                                                                                                                                                |
| ------------------ | :-------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 可莉               |   15 请我喝3杯奶茶    |                                                                                                                                                                                       |
| 缤瑶               | 170 小夜挂件立牌 * 10 | 加油喔！                                                                                                                                                                              |
| 卖萌傲娇萝莉赛高   |          50           | 夜爹真心对不住，我有个群友手贱举报了，把夜爹封了，已经踢出群了，赞助一下就当赎罪券了                                                                                                  |
| 小恩               |    30 定制专属小夜    |                                                                                                                                                                                       |
| 这是一只可爱的蛆呢 |           5           | 很好玩的 bot 啦                                                                                                                                                                       |
| 缤瑶               |          30           | 加油喔                                                                                                                                                                                |
| 爱发电用户\_ERJy   |          30           | 永远滴神 1 1 1                                                                                                                                                                        |
| 缤瑶               |         0.91          |                                                                                                                                                                                       |
| Ai-Ding            |           3           |                                                                                                                                                                                       |
| 缤瑶               |          30           | 加油！                                                                                                                                                                                |
| 缤瑶               |          30           | 加油喔，希望小夜出道！                                                                                                                                                                |
| 爱发电用户\_AeSn   |           5           |                                                                                                                                                                                       |
| 缤瑶               |          30           | 加油鸭                                                                                                                                                                                |
| 缤瑶               |          30           | 加油很喜欢小夜嘴臭的样子                                                                                                                                                              |
| 卖萌傲娇萝莉赛高   |          30           | 很好玩的 bot，加油                                                                                                                                                                    |
| 眠眠打破\_         |         13.14         | 初次遇见小夜应该是 18 年初的时候 那时还在备战高考 今天的我正式走上了工作岗位 看到小夜复出 很感动 请 p 主喝杯奶茶 希望能在炎炎夏日为您带来一点糖分 愿 p 主和小夜的故事能够长远书写下去 |
| xian_yui           |          10           | 夜爹冲鸭                                                                                                                                                                              |
| On my own.         |          10           | 好耶                                                                                                                                                                                  |
| 冰菓               |         15.21         | 缇娜加油奥，在学代码了，等我学成归来了和你一块干 小夜                                                                                                                                 |
| 爱发电用户\_vcFq   |          30           | 为什么没有连续包月折扣！！                                                                                                                                                            |
| 爱发电用户\_TWAG   |          10           |
| kono 豆豆 da！     |           5           | 奶茶可以灌在膀胱里么嘤（bushi）                                                                                                                                                       |
| 砂糖酱             |          50           |
| 爱发电用户\_VhfC   |          10           |
| 咕咕子             |          10           |
| 爱发电用户\_7jHF   |          10           |
| 十八               |           5           | 夜爸爸加油                                                                                                                                                                            |
| 棒棒槌子           |           5           |
| 砂糖酱             |          50           |
| 棒棒槌子           |           5           |
| 砂糖酱             |          66           | 嗯 加点油                                                                                                                                                                             |
| 爱发电用户\_Jc5b   |          30           |
| 玫瑰陨星之忆       |           5           |
| 玫瑰陨星之忆       |         6.66          |
| 爱发电用户\_WJPF   |           5           |
| 滑小稽             |           5           |
| Yui                |          10           |
| 多芒小丸子         |          10           |
| 爱发电用户\_wScP   |           6           |
| 昀翳               |          50           |
| 爱发电用户\_KGMa   |          10           |
| 余薪               |          10           | 不知道做不做得出 ai 思考性行为...                                                                                                                                                     |
| 爱发电用户\_qr83   |          10           | xxxx)hhjjiskejeududnn3kssioskwnssj                                                                                                                                                    |

对本项目提供帮助的致谢名单（排名不分先后）：https://niconi.co.ni/ 、 https://www.layui.com/ 、 https://lceda.cn/ 、 https://www.dnspod.cn/ 、 Daisy_Liu 、 http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html 、 https://ihateregex.io/ 、 https://www.maoken.com/ 、 https://www.ngrok.cc/ 、 https://uptimerobot.com/ 、 https://shields.io/ 、 https://ctf.bugku.com/ 、 https://blog.squix.org/ 、 https://hostker.com/ 、 https://www.tianapi.com/ 、 https://api.sumt.cn/ 、 https://github.com/Mrs4s/go-cqhttp 、 https://colorhunt.co/ 、 https://github.com/ 、 https://gitee.com/ 、 https://github.com/windrises/dialogue.moe 、 https://api.oddfar.com/ 、 https://github.com/ssp97 、https://github.com/mxh-mini-apps/mxh-cp-stories 、https://github.com/Sora233/DDBOT 、 还有我的朋友们，以及倾心分享知识的各位

---

## 协议 License

本项目使用 GPLv3 开源协议，一经使用则视为同意该协议，意味着你可以原封不动地运行本项目，并向你的用户提供服务。但如果对项目进行了任何修改，则需要 fork 本仓库并开源，至少需要将你修改后的版本对你的用户开源。出现的一切事故情况，请自行处理，与我无瓜。禁止任何形式的倒卖转售。
