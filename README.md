<h1 align="center">
  <img src="https://repository-images.githubusercontent.com/171253757/5f987680-d2ab-11eb-927b-655b4967c9a3" width="650px"/><br/>
  沙雕Ai聊天系统 ChatDACS<br/>
(Chatbot : shaDiao Ai Chat System)
</h1>
<p align="center">
一个无需服务器，可私有化部署、可独立运行于内网的H5聊天工具。<br/>
技术栈：语言——Node.js，web框架——Express，前端组件库——layui。<br/>
与硬件端<a href="https://github.com/Giftia/ChaosNodeMCU/" target="_blank">ChaosNodeMCU</a>联动为一个完整的物联网项目。<br/>
开箱即用，非常好用，我的朋友。<br/>
<br/>
示例 DEMO：<a href="http://chatdacs.giftia.moe/" target="_blank">chatdacs.giftia.moe</a><br/>
简易搭建教程 Tutorials：<a href="https://zhuanlan.zhihu.com/p/67995935" target="_blank">zhuanlan.zhihu.com/p/67995935</a><br/>
词库来源于小夜计划：<a href="https://github.com/Giftia/Project_Xiaoye" target="_blank">github.com/Giftia/Project_Xiaoye</a>
</p>
  <p align="center">
  <img src="https://img.shields.io/uptimerobot/ratio/m783632550-7da46d24226cb151b978c810?style=for-the-badge" alt="Uptime(30 days)" />&nbsp;
  <img src="https://img.shields.io/website?label=demo&style=for-the-badge&up_message=online&url=http://chatdacs.giftia.moe/" alt="Demo" />
  &nbsp;
  <img src="https://img.shields.io/github/v/release/Giftia/ChatDACS?style=for-the-badge" alt="GitHub release latest" />
  &nbsp;
  <img src="https://img.shields.io/github/license/Giftia/ChatDACS?style=for-the-badge" alt="License" />
  &nbsp;
  <img src="https://img.shields.io/github/languages/code-size/Giftia/ChatDACS?style=for-the-badge" alt="Code size" />
  </p>

---

## ✨ 功能与特性 Features

- [x] 完善的聊天界面与各种奇奇怪怪的功能 `Nice UI and funny functions`
- [x] 无限制的在线聊天 `Unlimit chatroom`
- [x] 与经过 2w+用户调教养成的人工智能机器人小夜实时聊天 `Chat with Ai Xiaoye`
- [x] 令人激动的、实用的在线涩图功能 `Nice pictures`
- [x] 图片、视频与文件分享 `Share your images,videos and files`
- [x] 与 qqBot 小夜对接 `Connect With Bot Xiaoye`
- [ ] 自定义表情包 `Use your own stickers`
- [ ] 私聊 `Private chat`
- [ ] 付费内容 `Premium content`

---

## ⚡️ 快速启动 Quick start

首先去 https://nodejs.org/zh-cn/ 下载安装长期支持版 Node.js，

然后下载最新代码压缩包 https://github.com/Giftia/ChatDACS/archive/refs/heads/master.zip ，

解压到任意文件夹，双击代码根目录下的 init.bat 一键部署，

部署完毕后 沙雕 Ai 聊天系统 会自动启动。以后可双击 run.bat 启动。

---

## 🛠 手动部署 Manual deployment

若您的操作系统并不是 Windows OS，或者是在快速启动过程出现了错误，请按如下操作手动部署：

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

---

如有任何疑问、建议或者需要联系我，请加 QQ 群 646493880：点击链接加入群聊【Giftia 终端服务部】：https://jq.qq.com/?_wv=1027&k=B51zJPm7
