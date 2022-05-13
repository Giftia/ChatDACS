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
      技术栈：语言 —— JavaScript，Web框架 —— Express，前端组件库 —— layui。<br/>
      画师：塘李<br/>
      <br/>
      示例 DEMO：<a href="http://110.42.221.72/" target="_blank">http://110.42.221.72/</a><br/>
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
  <a href="http://110.42.221.72/"><img src="https://img.shields.io/website?label=demo&style=for-the-badge&up_message=online&url=http://110.42.221.72/" alt="Demo" /></a>
  &nbsp;
  <a href="https://github.com/Giftia/ChatDACS/actions"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/Giftia/ChatDACS/Compile%20ChatDACS%20for%20Windows?label=%E8%87%AA%E5%8A%A8%E6%9E%84%E5%BB%BA&style=for-the-badge"></a>
  &nbsp;
  <img src="https://img.shields.io/github/license/Giftia/ChatDACS?label=%E5%BC%80%E6%BA%90%E8%AE%B8%E5%8F%AF&style=for-the-badge" alt="License" />
  &nbsp;
  <img src="https://img.shields.io/github/languages/code-size/Giftia/ChatDACS?label=%E4%BB%A3%E7%A0%81%E5%A4%A7%E5%B0%8F&style=for-the-badge" alt="Code size" />
</p>

---

## 😘 写在最前面 Hi

在线体验地址：[沙雕Ai聊天系统](http://110.42.221.72/)

如有任何疑问、建议或者需要联系我，请加官方 QQ 群 120243247：点击链接加入群聊【星野夜蝶 粉丝群】：https://jq.qq.com/?_wv=1027&k=ovqyydCe

对于普通用户，推荐您直接使用官方免费的公共小夜 QQ 账号：1648468212（不定时会被疼讯封号 7 天），邀请小夜入群即可，我会不定期批准请求。

你也可以加入交流群，群里有不少群友自发个人部署的第三方小夜，你可以申请使用群友搭建的小夜。

但更推荐您使用私人部署，私人部署的好处都有啥：

- 保护您的隐私，BOT 完全属于您，我无法得知您 BOT 的任何信息（我甚至无法知道您部署了一个私人 BOT）
- 高可用度，稳定的功能，不会因为公共小夜离线而无法运行；独立的词库，不会出现 ky 的回复
- 可自行定制 BOT 账号的头像、名字、功能，甚至是自己改造功能
- 减轻我的服务器负担，让公共小夜活得更久，可循环利用
- 通过搭建流程体验，学习一门先进的技术，很 cool，很极客

私人部署教程请点击跳转至下方的 [快速启动](#QuickDeploy) 章节 ↓

## ✔ 功能介绍 Orders

- 在 web 端、qq 端、哔哩哔哩直播端 都通用的功能：

  - [x] 聊天回复率 `1%`，随机复读率 `1%`
    - 大家随心所欲地聊天吧~小夜会随时准备好嘴臭的！还有概率会随机复读噢。在消息里成功 `@小夜` 的时候，小夜回复几率会提高。

  - [x] 复读机
    - 当某条消息重复 `2` 次时小夜会跟风复读一次。

  - [x] `/help` 或 `帮助` 或 `菜单` 或 `插件列表` 或 `说明`
    - 会回复系统当前可用插件列表，描述插件版本和对应的触发指令正则表达式。[体验正则表达式](https://regex101.com/)

  - [x] `/ping`
    - 测试指令，用于测试小夜的连通性。

  - [x] `问：关键词 答：小夜的回答`
    - 调教小夜说话吧！在优秀的聊天算法加成下，帮助养成由数万用户调教练就的嘴臭词库。当小夜收到含有关键词的语句时便会有几率触发回复，若该关键词有多个回复将会随机选择一个回复。支持图片问答。注意！冒号是中文全角的：，而不是英文半角的:，并且在 关键词 和 答：之间有一个空格。注意注意！如果像这样 “问：小夜的主人到底是谁呀 答：是你呀” 直接教完整的一句话的话是很难有效触发的，这就很考验你应该如何选择关键词了噢。像上面那个例子的话建议改成这样噢：“问：主人 答：是你呀”。
      - 使用例：`问：HELLO 答：WORLD`

  - [x] `/说不出话 文字或者图片`
    - 教给小夜一些比较通用的回复。对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复，非常敷衍，回复了，但完全没有回复的意义。

  - [x] `/status` 或 `/状态`
    - 查询小夜的版本以及小夜的相关信息。

  - [x] `/吠 你好谢谢小笼包再见`
    - 让小夜开口说话吧。小夜使用基于大数据的情感幼女语音合成技术，能吠出更自然的发音、更丰富的情感和更强大的表现力。可以插入一些棒读音以提高生草效果。
      - 使用例：`/吠 太好听了吧啊，你唱歌真的好嗷好听啊，简直就是天岸籁，我刚才听到你唱歌了，我们以后一起唱好不好，一起唱昂，一起做学园偶像昂`

  - [x] `/嘴臭 对话`
    - 小夜会通过语音来回应你的对话噢，还是要注意指令和对话之间要有个空格。

  - [x] `/prpr 想pr的人`
    - 让小夜帮你舔 ta 吧。

  - [x] `/今日不带套`
    - 七夕节快乐，让小夜帮你计算今天不带套的结果。

  - [x] `/画师算命`
    - 一个简单的 avg 小说，可以自由二次扩展开发。
    
  - [x] `/迫害 [迫害对象] (迫害文字)`
    - 让小夜来制作缺德的迫害表情包吧。现在可以迫害的对象：["唐可可", "上原步梦", "猛男狗", "令和", "鸭鸭", "陈睿"]
      - 使用例：`/迫害 上原步梦 是我，是我先，明明都是我先来的……接吻也好，拥抱也好，还是喜欢上那家伙也好。`

  - [x] `/cp 攻 受`
    - 让小夜生成一段简单的 cp 文。简简单单，就是最好的爱。
      - 使用例：`cp 小夜 小雫`

  - [x] `/报错 (报错内容)`
    - 向小夜开发组反馈消息，消息会实时转达到小夜开发成员。

  - [x] `qr (内容)`
    - 让小夜帮你快速生成一个二维码。

  - [x] `/黑白图 (图片) (第一排文字) (第二排文字)`
    - 让小夜帮你生成一张黑白生草图。

  - [ ] `人生重开`
    - 风靡全球的人生重开小游戏，数据来自 https://github.com/VickScarlet/lifeRestart 。还没写好。

  - [x] `/roll`
    - 随机 roll 出 0 到 1000000 的随机数，可以自行跟随参数。

  - [x] `BV19q4y1c7K4`
    - 哔哩哔哩BV解析，返回av号和标题。

  - [x] `晚上提醒我手冲`
    - 将指定格式的消息推送至微信息知指定频道，适合传送消息至微信。

  - [x] `/notify 该手冲了`
    - 会在小夜宿主电脑上弹出一条消息通知。

  - [x] `cos图` 或 `cosplay`
    - 在普通限度的尺度下让小夜发一张合法的 cos 图。

  - [x] `买家秀` 或 `福利姬`
    - 在无限度的尺度下让小夜发一张非法的买家秀福利图，危险注意！

  - [x] `二次元`
    - 在普通限度的尺度下让小夜发一张合法的二次元图。

  - [x] `r18` 或 `可以色色` 或 `色、涩、瑟图`
    - 在无限度的尺度下让小夜发一张非法的二次元图，超危险注意！

  - [x] `来点xx` 或 `来点好的xx` 或 `来点坏的xx`
    - 让小夜搜索一张指定tag的二次元图，xx 即你想搜索的 tag。
    - `好的` 代表正常尺度，`坏的` 代表🈲，超危险注意！

  - [x] `让我看看` 或 `图来`
    - 从本地图片文件夹随机发送图片，默认使用其他插件自动下载保存的图库文件夹。

  - [x] `随机网图`
    - 发送一张从随机网络图源获取的图片，图源可以自定义，网上很多。

- 仅在 qq 中生效的功能：

  - [x] `张菊@小夜` 与 `闭菊`
      - 小夜的群服务开关。如果觉得小夜太吵了，想让小夜安静一会，那么在群里发 `闭菊` 即可关闭群内小夜的服务。`张菊@小夜` 为启用指定小夜的群服务。请勿光速一开一合调整菊部呼吸导致呼吸困难。

  - [x] `戳一戳`
    - 戳一戳小夜有利于身心健康。连续戳小夜 `3` 下就会生气把你禁言。

  - [x] `/孤寡 @孤寡对象`
      - 七夕节快乐，小夜收到了你的孤寡订单，现在就开始孤寡 ta 辣！

  - [x] `我有个朋友说(我有个朋友)[@谁]`
    - 小夜会 P 一张你朋友说的图。
      - 使用例：`我有个朋友说我好了@Giftina`

  - [x] `/强制迫害 (@对象) (说了什么) (小夜说了什么)`
    - 小夜转发了一段来自平行世界的对话，适度娱乐噢。

  - QQ 地 雷 战（需小夜是群管理时有效）

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

---

## ✨ 功能与特性 Features

- [x] 完善的 web端 聊天界面与各种奇奇怪怪的功能 `Nice H5 UI and some funny functions`
- [x] 无限制的在线聊天 `Unlimited chatroom`
- [x] 与经过 2w+ 用户调教养成的人工智能机器人小夜实时聊天 `Chat with Ai Xiaoye`
- [x] 令人激动的、实用的在线涩图功能 `🈲`
- [x] web 端图片、视频与文件分享 `Share your images, videos and files on webEnd`
- [x] 与 go-cqhttp 对接，实现了 qq 机器人小夜 `Connectable with go-cqhttp`
- [x] 简单好用的插件系统 `Easy Use Plugins System`
- [ ] 自定义表情包 `Use your own stickers`
- [ ] 私聊 `Private chat`

---

<span id = "QuickDeploy"></span>
## ⚡️ 快速启动 Quick start

来试试快速启动吧，`一`键运行，`一`分钟运行`一`个属于自己的小夜：

首先点击进入自动化部署工作流 `Actions` https://github.com/Giftia/ChatDACS/actions ，

点击最新成功构建的工作流 `Compile ChatDACS for Windows` ，

在页面下方的产品 `Artifacts` 里点击下载自动构建好的 `ChatDACS` 压缩包，

解压 `ChatDACS` 压缩包，直接运行 `chatdacs.exe` 就可以辣。

如果在操作过程中有任何问题的话，请进 QQ 群 `120243247` 来问问题吧，有问必答噢。

⚠ 注意 1：开箱即用，若想使用更完善的功能，请访问以下申请地址，申请自己的接口密钥后，修改 `config` 文件夹内的 `config.yml` 文件:

- 天行接口，用于 随机昵称 与 舔狗 功能，申请地址 https://www.tianapi.com/
- 卡特实验室接口，用于 随机买家秀 功能，申请地址 https://api.sumt.cn/
- 息知频道 key，用于 微信息知频道消息推送 功能，申请地址 https://xz.qqoq.net/

⚠ 注意 2：建议使用注册久点的 QQ 号作为机器人登陆使用，不容易被封号，新号很容易因为疼讯检测到突然频繁发言而被风控。

⚠ 注意 3：请避免在程序窗口中点击或者拖动，否则会由于触发窗口的文字选择，导致程序时停。如果观察到程序左上角出现了 `选择` 字样，说明已经进入了时停，请在窗口内 `黑色背景区域` 右键一下以退出时停，才可以继续运行。

⚠ 注意 4：如果程序时停过长，解除时停后会将所有时停期间的消息进行瞬间处理，有可能会导致伤害过大导致小夜猛烈输出。这种时候建议选择右上角 X 掉，重新启动。

⚠ 注意 5：如果想要切换机器人使用的 QQ 账号，请先关闭两个程序窗口，进入 `plugins` 文件夹里的 `go-cqhttp` 文件夹，删除 `device.json` 和 `session.token` 这两个文件，随后重新启动 `chatdacs.exe` 即可重新扫码登陆。

⚠ 注意 6：若想跳过 qq 扫码登陆，保持 qq 持久化登录，请先关闭两个程序窗口，请进入 `plugins` 文件夹里的 `go-cqhttp` 文件夹，修改第 4、5 行的 uin 和 password 为 qq账号和密码，以后的启动都会保持登陆。

---

## 🕹 快速部署 Quick deploy

### 该流程需要一定的计算机基础，不建议新手操作，但适合新手了解小夜背后的 nodejs 是如何构建的

如果自动化部署工作流 `Actions` 年久失修，没有更新，那么请尝试快速部署：

首先去 https://nodejs.org/zh-cn/ 下载安装 LTS(长期支持版) Node.js，

然后下载最新代码压缩包 https://github.com/Giftia/ChatDACS/archive/refs/heads/master.zip ，

解压到任意文件夹，双击代码根目录下的 init.bat 一键部署，

部署完毕后 沙雕 Ai 聊天系统 会自动启动。以后可双击 run.bat 启动。

---

## 🛠 手动部署 Manual deployment

### 该流程需要一定的debug基础，不建议新手操作

若您的操作系统和架构并不是常见的 Windows OS x64，

或者是在快速启动、部署过程出现了错误，

亦或者是需要给小夜更新依赖，请按如下操作进行常规的手动部署：

打开系统的 `shell` ，如 `Bash`、`CMD`、`PowerShell` 等，用 `cd` 命令进入代码根目录运行：

```bash
npm install -g cnpm --registry=https://registry.npm.taobao.org
```

等待进度完成后运行：

```bash
cnpm ci
```

等待进度完成后运行：

```bash
node index.js
```

好了，它应该已经启动了 🎉。更详细的部署和配置说明请查看 `index.js` 文件。插件位于 `plugins` 文件夹。

如果想要手动生成适合您的系统的可执行文件，可以使用手动打包指令：

```bash
npm install pkg -g
npm pkg
```

---

## 😘 赞助者致谢名单：https://afdian.net/@xiaoye_bot

| 用户名             |      金额/人民币       | 留言：                                                                                                                                                                                |
| ------------------ | :--------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 爱发电用户\_8AP6   |           30           |                                                                                                                                                                                       |
| 可莉               |   15 请我喝 3 杯奶茶   |                                                                                                                                                                                       |
| 缤瑶               | 170 小夜挂件立牌 \* 10 | 加油喔！                                                                                                                                                                              |
| 卖萌傲娇萝莉赛高   |           50           | 夜爹真心对不住，我有个群友手贱举报了，把夜爹封了，已经踢出群了，赞助一下就当赎罪券了                                                                                                  |
| 小恩               |    30 定制专属小夜     |                                                                                                                                                                                       |
| 这是一只可爱的蛆呢 |           5            | 很好玩的 bot 啦                                                                                                                                                                       |
| 缤瑶               |           30           | 加油喔                                                                                                                                                                                |
| 爱发电用户\_ERJy   |           30           | 永远滴神 1 1 1                                                                                                                                                                        |
| 缤瑶               |          0.91          |                                                                                                                                                                                       |
| Ai-Ding            |           3            |                                                                                                                                                                                       |
| 缤瑶               |           30           | 加油！                                                                                                                                                                                |
| 缤瑶               |           30           | 加油喔，希望小夜出道！                                                                                                                                                                |
| 爱发电用户\_AeSn   |           5            |                                                                                                                                                                                       |
| 缤瑶               |           30           | 加油鸭                                                                                                                                                                                |
| 缤瑶               |           30           | 加油很喜欢小夜嘴臭的样子                                                                                                                                                              |
| 卖萌傲娇萝莉赛高   |           30           | 很好玩的 bot，加油                                                                                                                                                                    |
| 眠眠打破\_         |         13.14          | 初次遇见小夜应该是 18 年初的时候 那时还在备战高考 今天的我正式走上了工作岗位 看到小夜复出 很感动 请 p 主喝杯奶茶 希望能在炎炎夏日为您带来一点糖分 愿 p 主和小夜的故事能够长远书写下去 |
| xian_yui           |           10           | 夜爹冲鸭                                                                                                                                                                              |
| On my own.         |           10           | 好耶                                                                                                                                                                                  |
| 冰菓               |         15.21          | 缇娜加油奥，在学代码了，等我学成归来了和你一块干 小夜                                                                                                                                 |
| 爱发电用户\_vcFq   |           30           | 为什么没有连续包月折扣！！                                                                                                                                                            |
| 爱发电用户\_TWAG   |           10           |
| kono 豆豆 da！     |           5            | 奶茶可以灌在膀胱里么嘤（bushi）                                                                                                                                                       |
| 砂糖酱             |           50           |
| 爱发电用户\_VhfC   |           10           |
| 咕咕子             |           10           |
| 爱发电用户\_7jHF   |           10           |
| 十八               |           5            | 夜爸爸加油                                                                                                                                                                            |
| 棒棒槌子           |           5            |
| 砂糖酱             |           50           |
| 棒棒槌子           |           5            |
| 砂糖酱             |           66           | 嗯 加点油                                                                                                                                                                             |
| 爱发电用户\_Jc5b   |           30           |
| 玫瑰陨星之忆       |           5            |
| 玫瑰陨星之忆       |          6.66          |
| 爱发电用户\_WJPF   |           5            |
| 滑小稽             |           5            |
| Yui                |           10           |
| 多芒小丸子         |           10           |
| 爱发电用户\_wScP   |           6            |
| 昀翳               |           50           |
| 爱发电用户\_KGMa   |           10           |
| 余薪               |           10           | 不知道做不做得出 ai 思考性行为...                                                                                                                                                     |
| 爱发电用户\_qr83   |           10           | xxxx)hhjjiskejeududnn3kssioskwnssj                                                                                                                                                    |

对本项目提供帮助的致谢名单（排名不分先后）：https://niconi.co.ni/ 、 https://www.layuion.com/ 、 https://lceda.cn/ 、 https://www.dnspod.cn/ 、 Daisy_Liu 、 http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html 、 https://ihateregex.io/ 、 https://www.maoken.com/ 、 https://www.ngrok.cc/ 、 https://uptimerobot.com/ 、 https://shields.io/ 、 https://ctf.bugku.com/ 、 https://blog.squix.org/ 、 https://hostker.com/ 、 https://www.tianapi.com/ 、 https://api.sumt.cn/ 、 https://github.com/Mrs4s/go-cqhttp 、 https://colorhunt.co/ 、 https://github.com/ 、 https://gitee.com/ 、 https://github.com/windrises/dialogue.moe 、 https://api.oddfar.com/ 、 https://github.com/ssp97 、https://github.com/mxh-mini-apps/mxh-cp-stories 、https://github.com/Sora233/DDBOT 、 还有我的朋友们，以及倾心分享知识的各位

---

## 协议 License

本项目使用 GPLv3 开源协议，一经使用则视为同意该协议，意味着你可以原封不动地运行本项目，并向你的用户提供服务。但如果对项目进行了任何修改，则需要 fork 本仓库并开源，至少需要将你修改后的版本对你的用户开源。出现的一切事故意外，请自行处理，与我无关。禁止任何形式的倒卖转售。

## 免责声明 Disclaimer
若本项目涉及任何侵权、违规、违法情况，请联系我： `admin@giftia.moe` ，我将第一时间进行处理。
