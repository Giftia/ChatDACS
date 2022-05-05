module.exports = Object.freeze({
  //正则
  rename_reg: new RegExp("^/rename [\u4e00-\u9fa5a-z0-9]{1,10}$"), //允许1-10长度的数英汉昵称
  isImage_reg: new RegExp("\\[CQ:image,file:"), //匹配qqBot图片
  change_reply_probability_reg: new RegExp("^/回复率 [0-9]*"), //匹配修改qqBot小夜回复率
  change_fudu_probability_reg: new RegExp("^/复读率 [0-9]*"), //匹配修改qqBot小夜复读率
  img_url_reg: new RegExp("https(.*term=3)"), //匹配图片地址
  isVideo_reg: new RegExp("^\\[CQ:video,file:"), //匹配qqBot图片
  video_url_reg: new RegExp("http(.*term:unknow)"), //匹配视频地址
  come_yap_reg: new RegExp("^/嘴臭(.*)"), //匹配对话语音
  pohai_reg: new RegExp("^/迫害 (.*)"), //匹配迫害p图
  hand_grenade_reg: new RegExp("^一个手雷(.*)"), //匹配一个手雷
  mine_reg: new RegExp("^埋地雷"), //匹配埋地雷
  fuck_mine_reg: new RegExp("^踩地雷"), //匹配踩地雷
  hope_flower_reg: new RegExp("^希望的花(.*)"), //匹配希望的花
  loop_bomb_reg: new RegExp("^击鼓传雷(.*)"), //匹配击鼓传雷
  is_qq_reg: new RegExp("^[1-9][0-9]{4,9}$"), //校验是否是合法的qq号
  has_qq_reg: new RegExp("\\[CQ:at,qq=(.*)\\]"), //匹配是否有@
  i_have_a_friend_reg: new RegExp("我有一个朋友说.*|我有个朋友说.*"), //匹配我有个朋友指令
  open_ju_reg: new RegExp("张菊.*"), //匹配张菊指令
  close_ju_reg: new RegExp("闭菊.*"), //匹配闭菊指令
  gugua_reg: new RegExp("^/孤寡.*"), //匹配孤寡指令
  fake_forward_reg: new RegExp("^/强制迫害.*"), //匹配伪造转发指令
  approve_group_invite_reg: new RegExp("^/批准 (.*)"), //匹配批准加群指令
  test_reply_reg: new RegExp("\\[CQ:reply,id:.*复读"), //匹配回复测试指令
  life_restart_reg: new RegExp("^人生重开"), //匹配人生重开指令
  roll_talents_reg: new RegExp("^选择天赋 (.*)"), //匹配选择天赋指令
  set_points_reg: new RegExp("^分配属性 (.*)"), //匹配分配属性指令
  only_0to9_reg: new RegExp("^[0-9]$"), //匹配仅0-9

  //全局常量
  TTS_FILE_RECV_PATH: "./static/xiaoye/live_lastst_reply.txt", //tts文件存储路径
  HTML_PATH: "/static/index.html", //首页
});
