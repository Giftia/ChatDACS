module.exports = Object.freeze({
  // 正则表达式
  change_reply_probability_reg: new RegExp(/^回复率 ([0-9]*)/), // 匹配修改qqBot小夜回复率
  change_fudu_probability_reg: new RegExp(/^复读率 ([0-9]*)/), // 匹配修改qqBot小夜复读率
  isImage_reg: new RegExp(/\[CQ:image,file/), // 匹配qq图片消息
  img_url_reg: new RegExp(/https(.*term=3)/), // 匹配图片地址
  isVideo_reg: new RegExp(/\[CQ:video,file:/), // 匹配qq视频消息
  video_url_reg: new RegExp(/http(.*term:unknow)/), // 匹配视频地址
  come_yap_reg: new RegExp(/^嘴臭(.*)/), // 匹配对话语音
  hand_grenade_reg: new RegExp(/^一个手雷(.*)/), // 匹配一个手雷
  mine_reg: new RegExp(/^埋地雷/), // 匹配埋地雷
  fuck_mine_reg: new RegExp(/^踩地雷/), // 匹配踩地雷
  hope_flower_reg: new RegExp(/^希望的花(.*)/), // 匹配希望的花
  loop_bomb_reg: new RegExp(/^击鼓传雷(.*)/), // 匹配击鼓传雷
  is_qq_reg: new RegExp(/^[1-9][0-9]{4,9}$/), // 校验是否是合法的qq号
  has_qq_reg: new RegExp(/\[CQ:at,qq=(\d*)\]/), // 匹配是否有@qq
  i_have_a_friend_reg: new RegExp(/我有.?个朋友说(.*)/), // 匹配我有个朋友指令
  open_ju_reg: new RegExp(/张菊/), // 匹配张菊指令
  close_ju_reg: new RegExp(/闭菊/), // 匹配闭菊指令
  gu_gua_reg: new RegExp(/^孤寡(.*)/), // 匹配孤寡指令
  fake_forward_reg: new RegExp(/^强制迫害(.*)/), // 匹配伪造转发指令
  approve_group_invite_reg: new RegExp(/^批准 (.*)/), // 匹配批准加群指令
  reply_reg: new RegExp(/\[CQ:reply,id=.*复读/), // 匹配回复测试指令

  // 全局常量
  TTS_FILE_RECV_PATH: "./static/xiaoye/live_latest_reply.txt", // 哔哩哔哩字幕文件存储路径
  HTML_PATH: "/static/index.html", // 首页
  AUDIO_START: 0, // AudioControl 开始播放操作
  // winston 日志配置
  LOG_LEVELS: {
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6,
    },
    colors: {
      error: "red",
      warn: "orange",
      info: "yellow",
      http: "green",
      verbose: "blue",
      debug: "gray",
      silly: "gray",
    },
  },
  HELP_CONTENT:
    "主人你好，我是小夜。欢迎使用沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)。在这里，你可以与经过 2w+用户调教养成的人工智能机器人小夜实时聊天，它有着令人激动的、实用的在线涩图功能，还可以和在线的其他人分享你的图片、视频与文件。现在就试试使用在聊天框下方的便捷功能栏吧，功能栏右侧还有更多功能。",

});
