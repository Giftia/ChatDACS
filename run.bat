@echo off
Title ChatDACS
chcp 65001
Echo 正在启动...
call 127.0.0.1.url
call node .
COLOR fc
Echo 爆炸了！你可能需要先运行init.bat
Pause