var app = require('express')();
var session = require('express-session');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var userip = '';
var net = require('net');
var request = require('request');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('/db.db');
var apikey = '23333333333333333';	//replce your jcck_apikey here
var reg = new RegExp('^/开门 [0-9]*$');

http.listen(80, function(){
  console.log(CurentTime() + '系统启动，正在监听于端口80');
  Connjc();
});

app.use(session({
    secret: 'NicoNicoNi~'
  }));

db.run("CREATE TABLE IF NOT EXISTS messages(time char, ip char PRIMARY KEY, message char)");
db.run("CREATE TABLE IF NOT EXISTS users(nickname char, ip char PRIMARY KEY, lastlogin char, logintimes long)");

app.get('/', function(req, res){
    var ip = req.headers['x-forwarded-for'] ||
        req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress || '';
    if(ip.split(',').length > 0){
        ip = ip.split(',')[0];
    };
    ip = ip.replace('::ffff:', '');
    userip = ip;
    res.sendFile(__dirname + '/new.html');
    if(req.session.sign){
        console.log(CurentTime() + '用户 ' + userip + ' 已连接，req.session.name：' + req.session.name);
        db.run("UPDATE users SET lastlogin = '" + CurentTime() + "' WHERE ip = '" + userip +"'");
		db.run("UPDATE users SET logintimes = logintimes + 1 WHERE ip = '" + userip + "'");
      } else {
        console.log(CurentTime() + '新用户 ' + userip + ' 已连接，req.session.name：' + req.session.name);
        req.session.sign = true;
        req.session.name = userip;
        db.run("INSERT INTO users VALUES('" + "无名氏" + "', '" + userip + "', '" + CurentTime() + "', 1)");
      };
});

io.on('connection', function(socket){
	db.all("SELECT logintimes FROM users WHERE ip = '" + userip + "'", function(e, sql){
		
	});
    if(sign){
        io.emit('system message', '系统消息：欢迎回来，用户 ' + userip + ' 。');
    } else {
        io.emit('system message', '系统消息：新用户 ' + userip + ' 已连接。你是第一次访问，你可以发送诸如 “/开门 233333” 的通关密码来开门（去掉双引号），密码是基地WiFi密码。');
    };
    io.emit('chat message', '系统消息：本项目已开源于<a href="https://github.com/Giftia/ChatDACS/">https://github.com/Giftia/ChatDACS/</a>，欢迎Star');
    Getnews().then(function(data){
            //console.log('resolved, and data:\r\n' + data);
            io.emit('chat message', data);
        }, function(err, data){
            console.log('rejected, and err:\r\n' + err);
        });
    socket.on('disconnect', function(){
        console.log(CurentTime() + '用户 ' + userip + ' 已断开连接');
        io.emit('system message', '系统消息：用户 ' + userip + ' 已断开连接');
    });
    socket.on('typing', function(msg){
        io.emit('typing', userip + ' 正在输入...');
    });
    socket.on('typing_over', function(msg){
        io.emit('typing', '');
    });
    socket.on('chat message', function(msg){
        console.log(CurentTime() + '收到用户 ' + userip + ' 消息: ' + msg);
        db.run("INSERT INTO messages VALUES('" + CurentTime() + "', '" + userip + "', '" + msg + "')");
        io.emit('chat message', userip + ' : ' + msg);
		if(reg.test(msg)){
			if(msg == '/开门 74037403'){
				Opendoor();
				io.emit('chat message', '系统消息：开门指令已发送');
				io.emit('chat message', '计算机科创基地提醒您：道路千万条，安全第一条。开门不关门，亲人两行泪。');
				console.log(CurentTime() + '用户 ' + userip + ' 开门操作');
			} else {
				io.emit('chat message', '系统消息：密码错误，请重试');
			};
		} else if(msg == '/log'){
            db.all("SELECT * FROM messages", function(e, sql){
                if(!e){
                    var data = '';
                    for(i = 0; i < sql.length; i++){
                        var time = JSON.stringify(sql[i].time);
                        var ip = JSON.stringify(sql[i].ip);
                        var message = JSON.stringify(sql[i].message);
                        data = data + '<br><br>' + time + ip + message;
                    };
                    console.log(sql);
                    io.emit('chat message', '共有' + sql.length + '条记录：' + data);
                } else {
                    console.log(e);
                    io.emit('chat message', e);
                };
            });
        } else if(msg == '/cls'){
            db.all("DELETE FROM messages", function(e, sql){
                if(!e){
                    io.emit('chat message', '管理指令：聊天信息数据库清空完毕');
                    console.log(CurentTime() + '已清空聊天信息数据库');
                } else {
                    console.log(e);
                    io.emit('chat message', e);
                };
            });
        };
    });
});

function Connjc(){
    var client = new net.Socket();
    client.setEncoding('utf8');
    client.connect(8266, 'www.jcckiot.com', function(){
        client.write('mode=bind&apikey=' + apikey + '&data={ck001000bind}');
        console.log('绑定成功');
    });
    client.on('data', function(data){
        //console.log(data);
    });
    client.on('error', function(err){
        io.emit('绑定错误，错误为 %s', err.code);
        console.log('绑定错误，错误为 %s', err.code);
        client.destroy();
    });
};

function Opendoor(){
    var client = new net.Socket();
    client.setEncoding('utf8');
    client.connect(8266, 'www.jcckiot.com', function(){
        client.write('mode=exe&apikey=' + apikey + '&data={ck0040001}');
        setTimeout(function(){
            client.write('mode=exe&apikey=' + apikey + '&data={ck0040000}');
            io.emit('chat message', '系统消息：自动关门指令已发送');
            //console.log(CurentTime() + '自动关门');
        }, 3000);
    });
    client.on('data', function(data){
        console.log(data);
    });
    client.on('error', function(err){
        io.emit('开门错误，错误为 %s', err.code);
        console.log('开门错误，错误为 %s', err.code);
        client.destroy();
    });
};

function CurentTime(){
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    var hh = now.getHours();
    var mm = now.getMinutes();
    var ss = now.getSeconds();
    var clock;// = year + '-';
    //if(month < 10)
    //    clock += '0';
    clock = month + '月';
    if(day < 10)
        clock += '0';
    clock += day + '日 ';
    if(hh < 10)
        clock += '0';
    clock += hh + ':';
    if (mm < 10) clock += '0';
    clock += mm + ':';
    if (ss < 10) clock += '0';
    clock += ss + ' ';
    return(clock);
};

function Getnews(){
    var p = new Promise(function(resolve, reject){
        request('http://3g.163.com/touch/jsonp/sy/recommend/0-9.html?callback=n', function(err, response, body){
        if(!err && response.statusCode == 200){
                body = body.substring(2, body.length - 1);
                var content_news = '今日要闻：';
                var main = JSON.parse(body);
                var news = main.list;
                for(id = 4; id < 10; id++){
                    print_id = id - 3;
                    content_news = content_news + '<br>' + print_id + '.' + news[id].title + '...👉<a href="' + news[id].link + '" target="_blank">查看原文</a>';
                    };
                resolve(content_news);
            } else {
                reject('系统消息：获取新闻错误。\r\nerr: ' + err + '\r\nresponse: ' + response);
            };
        });
    });
    return p;
};
