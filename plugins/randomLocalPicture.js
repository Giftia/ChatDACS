module.exports = {
  插件名: '本地随机图插件',
  指令: '[让给]我[看康]{1,3}|^[/!]?图来$',
  版本: '3.2',
  作者: 'Giftina',
  描述: '从本地图片文件夹随机发送一张图片，默认使用其他插件自动下载保存的图库文件夹。',
  使用示例: '让我康康',
  预期返回: '[一张本地的随机图]',

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === 'qq') {
      await axios.get(`http://${ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI('杰哥不要！')}`)

      const fileDirectPath = url.pathToFileURL(path.resolve(`${图片文件夹}${await RandomLocalPicture(图片文件夹)}`))

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: 'node',
            data: {
              name: `${userName}的本地随机图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      }

      await axios.post(`http://${ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

      return {type: 'text', content: ''}
    }

    // web端的非网站目录图片需要返回 base64
    const filePath = `${图片文件夹}${await RandomLocalPicture(图片文件夹)}`
    const base64Img = `data:image/png;base64,${Buffer.from(fs.readFileSync(filePath)).toString('base64')}`
    return {type: 'directPicture', content: {file: base64Img}}
  },
}

const 图片文件夹 = './static/images/' // 修改为自己的图库文件夹，绝对路径和相对路径都可以，绝对路径类似 D:\\色图\\贫乳\\ ，记得要像这样 \\ 多加一个反斜杠
const path = require('path')
const fs = require('fs')
const axios = require('axios').default
const url = require('url')
const randomFile = require('select-random-file')
let ONE_BOT_API_URL
const yaml = require('yaml')

//随机图
function RandomLocalPicture() {
  return new Promise((resolve, reject) => {
    randomFile(图片文件夹, (err, file) => {
      if (err) {
        reject(err)
      }
      resolve(file)
    })
  })
}

Init()

// 读取配置文件
function ReadConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(process.cwd(), 'config', 'config.yml'), 'utf-8', function (err, data) {
      if (!err) {
        resolve(yaml.parse(data))
      } else {
        reject('读取配置文件错误。错误原因：' + err)
      }
    })
  })
}

// 初始化
async function Init() {
  const resolve = await ReadConfig()
  ONE_BOT_API_URL = resolve.System.ONE_BOT_API_URL
}
