"use strict";
exports.__esModule = true;
exports.Global = void 0;
var Global = /** @class */ (function () {
    function Global() {
        //系统配置和开关，以及固定变量
        this.version = "ChatDACS v3.0.20-Dev"; //版本号，会显示在浏览器tab与标题栏
        this.html = "/static/index.html"; //前端页面路径，old.html为旧版前端
        this.onlineusers = 0; //预定义
        this.Tiankey = null;
        this.sumtkey = null;
        this.baidu_app_id = null;
        this.baidu_api_key = null;
        this.baidu_secret_key = null;
        this.last_danmu_timeline = null;
        this.bot_qq = null;
        this.black_list_words = null;
        this.qq_admin_list = null;
        this.blive_room_id = null;
        this.chat_swich = null;
        this.conn_go_cqhttp = null;
        this.Now_On_Live = null;
        this.web_port = null;
        this.go_cqhttp_service = null;
        this.go_cqhttp_api = null;
        this.topN = null;
        this.reply_probability = null;
        this.fudu_probability = null;
        this.chaos_probability = null;
        this.req_fuliji_list = null;
        this.req_ECY_list = null;
        this.req_no_trap_list = null;
        this.qqimg_to_web = null;
        this.max_mine_count = null;
        this.cos_total_count = null;
        this.xiaoye_ated = null;
        this.private_service_swich = null;
        this.c1c_count = 0;
        //web端配置
        this.help = "主人你好，我是小夜。欢迎使用沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)。在这里，你可以与经过 2w+用户调教养成的人工智能机器人小夜实时聊天，它有着令人激动的、实用的在线涩图功能，还可以和在线的其他人分享你的图片、视频与文件。现在就试试使用在聊天框下方的便捷功能栏吧，功能栏往右拖动还有更多功能。";
        this.thanks = "致谢（排名不分先后）：https://niconi.co.ni/、https://www.layui.com/、https://lceda.cn/、https://www.dnspod.cn/、Daisy_Liu、http://blog.luckly-mjw.cn/tool-show/iconfont-preview/index.html、https://ihateregex.io/、https://www.maoken.com/、https://www.ngrok.cc/、https://uptimerobot.com/、https://shields.io/、https://ctf.bugku.com/、https://blog.squix.org/、https://hostker.com/、https://www.tianapi.com/、https://api.sumt.cn/、https://github.com/Mrs4s/go-cqhttp、https://colorhunt.co/、https://github.com/、https://gitee.com/、https://github.com/windrises/dialogue.moe、https://api.lolicon.app/、https://bww.lolicon.app/、https://iw233.cn/main.html、https://blog.csdn.net/jia20003/article/details/7228464、还有我的朋友们，以及倾心分享知识的各位";
        this.update_text = "\u4F18\u5316r18\u4E0E\u6765\u70B9xx\u63D0\u793A";
        this.updatelog = "<h1>" + this.version + "</h1><br/>" + this.update_text;
        //正则
        this.rename_reg = new RegExp("^/rename [\u4e00-\u9fa5a-z0-9]{1,10}$"); //允许1-10长度的数英汉昵称
        this.bv2av_reg = new RegExp("^[a-zA-Z0-9]{10,12}$"); //匹配bv号
        this.isImage_reg = new RegExp("\\[CQ:image,file="); //匹配qqBot图片
        this.change_reply_probability_reg = new RegExp("^/admin_change_reply_probability [0-9]*"); //匹配修改qqBot小夜回复率
        this.change_fudu_probability_reg = new RegExp("^/admin_change_fudu_probability [0-9]*"); //匹配修改qqBot小夜复读率
        this.img_url_reg = new RegExp("https(.*term=)"); //匹配图片地址
        this.isVideo_reg = new RegExp("^\\[CQ:video,file="); //匹配qqBot图片
        this.video_url_reg = new RegExp("http(.*term=unknow)"); //匹配视频地址
        this.yap_reg = new RegExp("^/吠.*"); //匹配请求语音
        this.come_yap_reg = new RegExp("^/嘴臭(.*)"); //匹配对话语音
        this.teach_reg = new RegExp("^问：(.*)答：(.*)"); //匹配教学指令
        this.prpr_reg = new RegExp("^/prpr (.*)"); //匹配prpr
        this.pohai_reg = new RegExp("^/迫害 (.*)"); //匹配迫害p图
        this.teach_balabala_reg = new RegExp("^/说不出话 (.*)"); //匹配balabala教学
        this.hand_grenade_reg = new RegExp("^一个手雷(.*)"); //匹配一个手雷
        this.mine_reg = new RegExp("^埋地雷"); //匹配埋地雷
        this.fuck_mine_reg = new RegExp("^踩地雷"); //匹配踩地雷
        this.hope_flower_reg = new RegExp("^希望的花(.*)"); //匹配希望的花
        this.loop_bomb_reg = new RegExp("^击鼓传雷(.*)"); //匹配击鼓传雷
        this.is_qq_reg = new RegExp("^[1-9][0-9]{4,9}$"); //校验是否是合法的qq号
        this.has_qq_reg = new RegExp("\\[CQ:at,qq=(.*)\\]"); //匹配是否有@
        this.admin_reg = new RegExp("/admin (.*)"); //匹配管理员指令
        this.setu_reg = new RegExp(".*图.*来.*|.*来.*图.*|.*[色涩瑟].*图.*"); //匹配色图来指令
        this.i_have_a_friend_reg = new RegExp("我有一个朋友说.*|我有个朋友说.*"); //匹配我有个朋友指令
        this.open_ju = new RegExp("张菊.*"); //匹配张菊指令
        this.close_ju = new RegExp("闭菊.*"); //匹配闭菊指令
        this.feed_back = new RegExp("^/报错.*"); //匹配报错指令
        this.ascii_draw = new RegExp("/字符画.*"); //匹配字符画指令
        this.gugua = new RegExp("^/孤寡.*"); //匹配孤寡指令
        this.cp_story = new RegExp("^/cp.*|^cp.*"); //匹配cp文指令
        this.fake_forward = new RegExp("^/强制迫害.*"); //匹配伪造转发指令
        this.approve_group_invite = new RegExp("^/批准 (.*)"); //匹配批准加群指令
        this.make_qrcode = new RegExp("^qr (.*)"); //匹配生成二维码指令
        this.come_some = new RegExp("^来点(.*)"); //匹配来点xx指令
        this.bww_reg = new RegExp("^/黑白图 (.*)"); //匹配黑白图
    }
    return Global;
}());
exports.Global = Global;
