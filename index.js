var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var userip = '';
var net = require('net');
var request = require('request');

http.listen(80, function(){
  console.log(CurentTime() + '系统启动，正在监听于端口80');
  Connjc();
});

app.get('/', function(req, res){
    var ip = req.headers['x-forwarded-for'] ||
        req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress || '';
    if(ip.split(',').length > 0){
        ip = ip.split(',')[0]
    }
	ip = ip.replace('::ffff:','');
    userip = ip;
	res.sendfile('new.html');
});

io.on('connection', function(socket){
  console.log(CurentTime() + '用户 ' + userip + ' 已连接');
	io.emit('system message', '系统消息：用户 ' + userip + ' 已连接。你可以发送 /开门 这个指令来开门。');
	Getnews().then(function(data){
			console.log('resolved, and data:\r\n' + data);
			io.emit('chat message', data);
		},function(err, data){
			console.log('rejected, and err:\r\n' + err);
		}
	)
  socket.on('disconnect', function(){
    console.log(CurentTime() + '用户 ' + userip + ' 已断开连接');
		io.emit('system message', '系统消息：用户 ' + userip + ' 已断开连接');
    });
  socket.on('chat message', function(msg){
	console.log(CurentTime() + '收到用户 ' + userip + ' 消息: ' + msg);
	io.emit('chat message', userip + ' : ' + msg);
	if(msg == '/开门'){
		Opendoor();
		io.emit('chat message', '系统消息：门已开');
		console.log('开门成功');
		}
	});
});

function Connjc(){
	var client = new net.Socket();
	client.setEncoding('utf8');
	client.connect(8266, 'www.jcckiot.com', function(){
		client.write('mode=bind&apikey=[your_key]&data={ck001000bind}');
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
		client.write('mode=exe&apikey=[your_key]&data={ck0040001}');
		setTimeout(function(){
			client.write('mode=exe&apikey=[your_key]&data={ck0040000}');
			io.emit('chat message', '系统消息：自动关门');
			console.log(CurentTime() + '自动关门');
		},3000)
	});
	client.on('data', function(data){
		//console.log(data);
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
	//	clock += '0';
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
		if(!err && response.statusCode == 200) {
				body = body.substring(2, body.length - 1);
				var content_news = '今日要闻：';
				var main = JSON.parse(body);
				var news = main.list;
				for(id = 4; id < 10; id++){
					print_id = id - 3;
					content_news = content_news + '<br>' + print_id + '.' + news[id].title + '...👉<a href="' + news[id].link + '" target="_blank">查看原文</a>';
					}
				resolve(content_news);
			}else{
				reject('系统消息：获取新闻错误。\r\nerr: ' + err + '\r\nresponse: ' + response);
			};
		});
    });
	return p;
};
