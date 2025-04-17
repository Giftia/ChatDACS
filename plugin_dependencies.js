const axios = require('axios').default
const fs = require('fs')
const path = require('path')
const request = require('request')
const url = require('url')
const express = require('express')
const compression = require('compression')
const multer = require('multer')
const cookie = require('cookie')
const http = require('http')
const io = require('socket.io')(http)
const jieba = require('nodejs-jieba')
const yaml = require('yaml')
const winston = require('winston')
const Parser = require('rss-parser')
const randomFile = require('select-random-file')
const wallpaper = require('wallpaper')
const canvas = require('canvas')
const trayicon = require('trayicon')
const Constants = require('./config/constants.js')
const voicePlayer = require('play-sound')({
  player: path.join(process.cwd(), 'plugins', 'mpg123', 'mpg123.exe'),
})
const ipTranslator = require('lib-qqwry')(true)

const globalConfig = {} // 你可以在这里初始化全局配置

const pluginDependencies = {
  axios,
  logger: console, // 替换为实际的日志工具
  config: globalConfig,
  utils: require('./plugins/system/utils.js'),
  fs,
  path,
  request,
  url,
  express,
  compression,
  multer,
  cookie,
  http,
  io,
  jieba,
  yaml,
  winston,
  Parser,
  randomFile,
  wallpaper,
  canvas,
  trayicon,
  Constants,
  voicePlayer,
  ipTranslator,
}

module.exports = pluginDependencies
