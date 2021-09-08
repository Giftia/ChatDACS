class Global {
    //系统配置和开关，以及固定变量
    version = `ChatDACS v3.0.20-Dev`; //版本号，会显示在浏览器tab与标题栏
    html = "/static/index.html"; //前端页面路径，old.html为旧版前端
    boom_timer; //60s计时器
    onlineusers = 0; //预定义
    Tiankey = null;
    sumtkey = null;
    baidu_app_id = null;
    baidu_api_key = null;
    baidu_secret_key = null;
    last_danmu_timeline = null;
    bot_qq = null;
    black_list_words = null;
    qq_admin_list = null;
    blive_room_id = null;
    chat_swich = null;
    conn_go_cqhttp = null;
    Now_On_Live = null;
    web_port = null;
    go_cqhttp_service = null;
    go_cqhttp_api = null;
    topN = null;
    reply_probability = null;
    fudu_probability = null;
    chaos_probability = null;
    req_fuliji_list = null;
    req_ECY_list = null;
    req_no_trap_list = null;
    qqimg_to_web = null;
    max_mine_count = null;
    cos_total_count = null;
    xiaoye_ated = null;
    private_service_swich = null;
    c1c_count = 0;
    
    //web端配置
    help = "主人你好，我是小夜。欢迎使用沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)。在这里，你可以与经过 2w+用户调教养成的人工智能机器人小夜实时聊天，它有着令人激动的、实用的在线涩图功能，还可以和在线的其他人分享你的图片、视频与文件。现在就试试使用在聊天框下方的便捷功能栏吧，功能栏往右拖动还有更多功能。";
    thanks = "致谢（排名不分先后）：https://niconi.co.ni/、https://www.layui.com/、https://lceda.cn/、https://www.dnspod.cn/、Daisy_Liu、http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html、https://ihateregex.io/、https://www.maoken.com/、https://www.ngrok.cc/、https://uptimerobot.com/、https://shields.io/、https://ctf.bugku.com/、https://blog.squix.org/、https://hostker.com/、https://www.tianapi.com/、https://api.sumt.cn/、https://github.com/Mrs4s/go-cqhttp、https://colorhunt.co/、https://github.com/、https://gitee.com/、https://github.com/windrises/dialogue.moe、https://api.lolicon.app/、https://bww.lolicon.app/、https://iw233.cn/main.html、https://blog.csdn.net/jia20003/article/details/7228464、还有我的朋友们，以及倾心分享知识的各位";
    update_text = `优化r18与来点xx提示`;
    updatelog = `<h1>${this.version}</h1><br/>${this.update_text}`;
  
    //正则
    rename_reg = new RegExp("^/rename [\u4e00-\u9fa5a-z0-9]{1,10}$"); //允许1-10长度的数英汉昵称
    bv2av_reg = new RegExp("^[a-zA-Z0-9]{10,12}$"); //匹配bv号
    isImage_reg = new RegExp("\\[CQ:image,file="); //匹配qqBot图片
    change_reply_probability_reg = new RegExp("^/admin_change_reply_probability [0-9]*"); //匹配修改qqBot小夜回复率
    change_fudu_probability_reg = new RegExp("^/admin_change_fudu_probability [0-9]*"); //匹配修改qqBot小夜复读率
    img_url_reg = new RegExp("https(.*term=)"); //匹配图片地址
    isVideo_reg = new RegExp("^\\[CQ:video,file="); //匹配qqBot图片
    video_url_reg = new RegExp("http(.*term=unknow)"); //匹配视频地址
    yap_reg = new RegExp("^/吠.*"); //匹配请求语音
    come_yap_reg = new RegExp("^/嘴臭(.*)"); //匹配对话语音
    teach_reg = new RegExp("^问：(.*)答：(.*)"); //匹配教学指令
    prpr_reg = new RegExp("^/prpr (.*)"); //匹配prpr
    pohai_reg = new RegExp("^/迫害 (.*)"); //匹配迫害p图
    teach_balabala_reg = new RegExp("^/说不出话 (.*)"); //匹配balabala教学
    hand_grenade_reg = new RegExp("^一个手雷(.*)"); //匹配一个手雷
    mine_reg = new RegExp("^埋地雷"); //匹配埋地雷
    fuck_mine_reg = new RegExp("^踩地雷"); //匹配踩地雷
    hope_flower_reg = new RegExp("^希望的花(.*)"); //匹配希望的花
    loop_bomb_reg = new RegExp("^击鼓传雷(.*)"); //匹配击鼓传雷
    is_qq_reg = new RegExp("^[1-9][0-9]{4,9}$"); //校验是否是合法的qq号
    has_qq_reg = new RegExp("\\[CQ:at,qq=(.*)\\]"); //匹配是否有@
    admin_reg = new RegExp("/admin (.*)"); //匹配管理员指令
    setu_reg = new RegExp(".*图.*来.*|.*来.*图.*|.*[色涩瑟].*图.*"); //匹配色图来指令
    i_have_a_friend_reg = new RegExp("我有一个朋友说.*|我有个朋友说.*"); //匹配我有个朋友指令
    open_ju = new RegExp("张菊.*"); //匹配张菊指令
    close_ju = new RegExp("闭菊.*"); //匹配闭菊指令
    feed_back = new RegExp("^/报错.*"); //匹配报错指令
    ascii_draw = new RegExp("/字符画.*"); //匹配字符画指令
    gugua = new RegExp("^/孤寡.*"); //匹配孤寡指令
    cp_story = new RegExp("^/cp.*|^cp.*"); //匹配cp文指令
    fake_forward = new RegExp("^/强制迫害.*"); //匹配伪造转发指令
    approve_group_invite = new RegExp("^/批准 (.*)"); //匹配批准加群指令
    make_qrcode = new RegExp("^qr (.*)"); //匹配生成二维码指令
    come_some = new RegExp("^来点(.*)"); //匹配来点xx指令
    bww_reg = new RegExp("^/黑白图 (.*)"); //匹配黑白图
  
    //声明TTS调用接口
    SpeechClient;
}

export {Global};
