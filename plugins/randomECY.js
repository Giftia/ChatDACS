module.exports = {
  插件名: '随机二次元图插件',
  指令: '^[/!]?(随机)二次元(图)$|^[/!]?二次元$',
  版本: '3.2',
  作者: 'Giftina',
  描述: '发送一张正常尺度的二次元图。',
  使用示例: '二次元',
  预期返回: '[一张随机二次元图]',

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === 'qq') {
      await axios.get(
        `http://${ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
          '你等等，我去问问小冰有没有二次元',
        )}`,
      )

      const fileDirectPath = url.pathToFileURL(path.resolve(`./static${await RandomECY()}`))

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: 'node',
            data: {
              name: `${userName}的二次元图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      }

      await axios.post(`http://${ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

      return {type: 'text', content: ''}
    }

    const filePath = await RandomECY()
    return {type: 'picture', content: {file: filePath}}
  },
}

const request = require('request')
const fs = require('fs')
const axios = require('axios').default
const url = require('url')
let ONE_BOT_API_URL
const yaml = require('yaml')
const path = require('path')

//随机二次元图
function RandomECY() {
  return new Promise((resolve, reject) => {
    request('https://iw233.cn/api/Random.php', (err, response, _body) => {
      if (!err) {
        const picUrl = response.request.uri.href
        request(picUrl).pipe(
          fs.createWriteStream(`./static/images/${picUrl.split('/').pop()}`).on('close', (_err) => {
            console.log(`保存了好康的二次元图：${picUrl}，然后再给用户`.log)
            resolve(`/images/${picUrl.split('/').pop()}`) // 绕过防盗链，保存为本地图片
          }),
        )
      } else {
        reject('随机二次元图错误，是这个神秘接口的锅。错误原因：图片太鸡儿大了')
      }
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
