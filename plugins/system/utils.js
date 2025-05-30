const fs = require('fs')
const path = require('path')
const yaml = require('yaml')
const url = require('url')
const crypto = require('crypto')
const axios = require('axios').default
const mp3Duration = require('mp3-duration')
const sequelize = require('sequelize')
const Op = sequelize.Op
// 在 Windows 平台下，在 sharp 之前加载 canvas 会导致 "Error: The specified procedure could not be found." https://github.com/Automattic/node-canvas/issues/930
if (process.platform === 'win32') {
  require('canvas')
}
const sharp = require('sharp')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Shanghai')

// models
const UserModel = require('./model/userModel.js')
const MessageModel = require('./model/messageModel.js')
const QQGroupModel = require('./model/qqGroupModel.js')
const MineModel = require('./model/mineModel.js')
const ChatModel = require('./model/chatModel.js')
const PerfunctoryModel = require('./model/perfunctoryModel.js')
const HandGrenadeModel = require('./model/handGrenadeModel.js')

let WEB_PORT, ONE_BOT_API_URL, TIAN_XING_API_KEY

Init()

// 读取配置文件
function ReadConfig() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(process.cwd(), 'config', 'config.yml'), 'utf-8', (err, data) => {
      if (!err) {
        resolve(yaml.parse(data))
      } else {
        reject('读取配置文件错误。错误原因：' + err)
      }
    })
  })
}

// 初始化WEB_PORT和TIAN_XING_API_KEY
async function Init() {
  const resolve = await ReadConfig()
  WEB_PORT = resolve.System.WEB_PORT
  ONE_BOT_API_URL = resolve.System.ONE_BOT_API_URL
  TIAN_XING_API_KEY = resolve.ApiKey.TIAN_XING_API_KEY
}

// 孤寡图序列
const guGuaPicList = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.gif']

/**
 * @name 系统工具类
 * @description 各种公用函数和系统底层函数
 */
module.exports = {
  /**
   * 年月日时分秒
   * @returns {object} { YearMonthDay: "yyyy-mm-dd", Clock: "hh:mm:ss" }
   */
  GetTimes() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()
    let yearMonthDay = year + '-'
    if (month < 10) yearMonthDay += '0'
    yearMonthDay += month + '-'
    if (day < 10) yearMonthDay += '0'
    yearMonthDay += day

    const hh = now.getHours()
    const mm = now.getMinutes()
    const ss = now.getSeconds()
    let clock = ' '
    if (hh < 10) clock += '0'
    clock += hh + ':'
    if (mm < 10) clock += '0'
    clock += mm + ':'
    if (ss < 10) clock += '0'
    clock += ss + ' '

    return {YearMonthDay: yearMonthDay, Clock: clock}
  },

  /**
   * 通过sha1生成唯一文件名
   * @param {any} buf 啥都行
   * @returns {string} "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   */
  sha1(buf) {
    return crypto.createHash('sha1').update(buf).digest('hex')
  },

  /**
   * 获取用户信息
   * @param {string} CID 用户唯一标识
   * @returns {Promise<object>} { "nickname", "logintimes", "lastlogintime" }
   */
  async GetUserData(CID) {
    const user = await UserModel.findOne({where: {CID}}).then((user) => ({
      nickname: user?.nickname ?? null,
      loginTimes: user?.logintimes ?? null,
      updatedAt: user?.updatedAt ?? null,
    }))
    return user
  },

  /**
   * 更新登陆次数
   * @param {string} CID 用户唯一标识
   * @returns {void} void
   */
  UpdateLoginTimes(CID) {
    UserModel.findOne({where: {CID}}).then((user) => {
      if (user) {
        user.update({
          logintimes: ++user.logintimes,
        })
      }
    })
  },

  /**
   * 新增用户
   * @param {string} CID 用户唯一标识
   * @param {string} nickname 用户昵称
   * @returns {void} void
   */
  AddUser(CID, nickname) {
    UserModel.create({CID, nickname})
  },

  /**
   * web端新消息写入数据库
   * @param {string} CID 用户唯一标识
   * @param {string} message 消息内容
   * @returns {void} void
   */
  AddMessage(CID, message) {
    MessageModel.create({CID, message})
  },

  /**
   * 自动随机昵称，若没有成功随机到昵称则默认昵称为 匿名
   * @returns {Promise<string>} "昵称" ?? "匿名"
   */
  async RandomNickname() {
    const nickname = await axios
      .get(`http://api.tianapi.com/txapi/cname/index?key=${TIAN_XING_API_KEY}`)
      .then((response) => {
        if (response.data.code === 200) {
          return response.data.newslist[0].naming
        } else {
          return '匿名'
        }
      })
    return nickname
  },

  /**
   * 更新用户昵称
   * @param {string} CID 用户唯一标识
   * @param {string} nickname 用户昵称
   * @returns {Promise<void>} void
   */
  async UpdateNickname(CID, nickname) {
    const userExists = await UserModel.findOne({where: {CID}})

    if (userExists) {
      userExists.update({nickname})
    }
  },

  /**
   * 获取tts语音时长
   * @param {buffer} dataBuffer 音频buffer
   * @returns {Promise<number>} "xxx"(单位为毫秒)
   */
  async getMP3Duration(dataBuffer) {
    mp3Duration(dataBuffer, (err, duration) => {
      return err ? 0 : duration
    })
  },

  /**
   * 将插件回复转为 web前端 能解析的格式
   * @param {string} answer 插件回复
   * @returns {string} 转换结果
   */
  PluginAnswerToWebStyle(answer) {
    if (!answer.content?.file) {
      return answer.content
    }
    const styleMap = {
      picture: `img[${answer.content?.file}]`,
      directPicture: `img[${answer.content?.file}]`,
      audio: `audio[${answer.content?.file}](${answer.content?.filename})`,
      video: `video[${answer.content?.file}](${answer.content?.filename})`,
      file: `file(${answer.content?.file})[${answer.content?.filename}]`,
    }
    return styleMap[answer.type]
  },

  /**
   * 将插件回复转为 go-cqhttp 能解析的格式
   * @param {string} answer 插件回复
   * @returns {string} 转换结果
   */
  PluginAnswerToGoCqhttpStyle(answer) {
    if (!answer.content?.file) {
      return answer.content
    }
    const styleMap = {
      picture: `[CQ:image,file=${
        answer.content?.file.indexOf('http') === -1
          ? `http://127.0.0.1:${WEB_PORT}${answer.content?.file}`
          : answer.content?.file
      }]`,
      directPicture: `[CQ:image,file=${url.pathToFileURL(path.resolve(answer.content?.file))}]`,
      audio: `[CQ:record,file=http://127.0.0.1:${WEB_PORT}${answer.content?.file}]`,
      video: `[CQ:video,file=http://127.0.0.1:${WEB_PORT}${answer.content?.file}]`,
    }
    return styleMap[answer.type]
  },

  /**
   * 将插件回复转为 QQ频道 能解析的格式
   * @param {string} answer 插件回复
   * @returns {object} { image, audio, text }
   */
  PluginAnswerToQQGuildStyle(answer) {
    switch (answer.type) {
      case 'picture':
        return {
          image: `http://127.0.0.1:${WEB_PORT}${answer.content?.file}`,
        }
      case 'directPicture':
        return {
          image: `http://127.0.0.1:${WEB_PORT}${answer.content?.file.replace('./static', '')}`,
        }
      case 'audio':
        return {
          text: answer.content.filename,
          audio: `http://127.0.0.1:${WEB_PORT}${answer.content?.file}`,
        }
      default:
        return {
          text: answer.content,
        }
    }
  },

  /**
   * 将插件回复转为 Telegram 能解析的格式
   * @param {string} answer 插件回复
   * @returns {object} { image, audio, text }
   */
  PluginAnswerToTelegramStyle(answer) {
    switch (answer.type) {
      case 'picture':
        return {
          image: `./static${answer.content?.file}`,
        }
      case 'directPicture':
        return {
          image: answer.content?.file,
        }
      case 'audio':
        return {
          text: answer.content.filename,
          audio: `./static${answer.content?.file}`,
          duration: answer.content.duration,
        }
      default:
        return {
          text: answer.content,
        }
    }
  },

  /**
   * 保存qq侧传来的图
   * @param {string} imgUrl 源链接
   * @returns {Promise<string>} "/xiaoye/images/xxx.jpg"
   */
  async SaveQQimg(imgUrl) {
    const filePath = '/xiaoye/images/'
    const fileName = `${imgUrl[0].split('/')[imgUrl[0].split('/').length - 2]}.jpg`
    // 使用axios下载图片
    const result = await axios
      .get(imgUrl[0], {
        responseType: 'stream',
      })
      .then((response) => {
        fs.createWriteStream(`./static${filePath}${fileName}`)
          .on('close', () => {
            return `${filePath}${fileName}`
          })
          .write(response.data)
      })
      .catch((err) => {
        return '保存 qq 侧传来的图错误。错误原因：' + err
      })
    return result
  },

  /**
   * goCqhttp 启动后加载当前所有群，写入数据库进行群服务初始化
   * @returns {Promise<void>} boolean
   * @description 该函数会在 goCqhttp 启动后自动调用，加载当前所有群，并将群信息写入数据库进行群服务初始化
   */
  async InitGroupList() {
    const groupList = await axios
      .get(`http://${ONE_BOT_API_URL}/get_group_list`)
      .then((response) => {
        return response.data.data
      })
      .catch((err) => {
        console.error('获取群列表失败，错误原因：', err.code)
        return false
      })

    if (!groupList) {
      return false
    } else {
      const groupIdList = groupList.map((group) => group.group_id)

      // 如果在数据库中已经存在，则不再重复添加
      const groupListInDB = await QQGroupModel.findAll()
      const groupIdListInDB = groupListInDB.map((group) => group.groupId)
      const groupIdListToAdd = groupIdList.filter((groupId) => !groupIdListInDB.includes(groupId))
      if (groupIdListToAdd.length > 0) {
        await QQGroupModel.bulkCreate(groupIdListToAdd.map((groupId) => ({groupId})))
      }

      console.log(
        `群服务初始化完毕，新加载了${groupIdListToAdd.length}个群，共${
          groupIdListInDB.length + groupIdListToAdd.length
        }个群`.log,
      )
    }
    return true
  },

  /**
   * 初始化小夜新加入的群的群服务
   * @param {string} groupId 群id
   * @returns {Promise<void>} void
   */
  async AddNewGroup(groupId) {
    const groupExist = await QQGroupModel.findOne({where: {groupId}})
    if (!groupExist) {
      await QQGroupModel.create({groupId})
      console.log(`初始化小夜新加入的群的群服务：${groupId}`.log)
    }
  },

  /**
   * 启用群服务开关
   * @param {number} groupId 群id
   * @returns {Promise<void>} void
   */
  async EnableGroupService(groupId) {
    await QQGroupModel.update(
      {
        serviceEnabled: true,
      },
      {
        where: {
          groupId,
        },
      },
    )
  },

  /**
   * 禁用群服务开关
   * @param {number} groupId 群id
   * @returns {Promise<void>} void
   */
  async DisableGroupService(groupId) {
    await QQGroupModel.update(
      {
        serviceEnabled: false,
      },
      {
        where: {
          groupId,
        },
      },
    )
  },

  /**
   * 获取群服务开关
   * @param {number} groupId 群id
   * @returns {Promise<boolean>} 群服务开关
   */
  async GetGroupServiceSwitch(groupId) {
    // 偶发性找不到groupId，无害化处理
    if (!groupId) {
      return true
    }
    const group = await QQGroupModel.findOne({where: {groupId}})

    // 如果没有获取到群，应该是小夜刚刚加入群，默认开启群服务
    if (!group) {
      return true
    }

    return group.serviceEnabled
  },

  /**
   * 检查QQ群中是否有地雷
   * @param {string} groupId 群ID
   * @returns {Promise<object | false>} 地雷的信息 或 false
   */
  async GetGroupMine(groupId) {
    const mine = await MineModel.findOne({where: {groupId}})

    return mine ?? false
  },

  /**
   * 获取QQ群中所有地雷
   * @param {string} groupId 群ID
   * @returns {Promise<object | false>} 地雷的信息 或 false
   */
  async GetGroupAllMines(groupId) {
    const mine = await MineModel.findAll({where: {groupId}})

    return mine ?? false
  },

  /**
   * 删除地雷
   * @param {string} id 地雷id
   * @returns {Promise<void>} void
   */
  async DeleteGroupMine(id) {
    await MineModel.destroy(
      {
        where: {id},
      },
      {
        force: true,
      },
    )
  },

  /**
   * 埋地雷
   * @param {string} groupId 群ID
   * @param {string} owner 地雷兵ID
   * @returns {Promise<void>} void
   */
  async AddOneGroupMine(groupId, owner) {
    await MineModel.create({groupId, owner})
  },

  /**
   * 获取击鼓传雷游戏状态
   * @param {string} groupId 群ID
   * @returns {Promise<object | false>} 状态信息 或 false
   */
  async GetGroupLoopBombGameStatus(groupId) {
    const group = await QQGroupModel.findOne({where: {groupId}})

    return group.toJSON() ?? false
  },

  /**
   * 开始击鼓传雷游戏，将击鼓传雷游戏的 答案、持有人、开始时间 存入数据库
   * @param {string} groupId 群ID
   * @param {string} loopBombAnswer 答案
   * @param {string} loopBombHolder 持有人
   * @param {string} loopBombStartTime 开始时间
   * @returns {Promise<void>} void
   */
  async StartGroupLoopBombGame(groupId, loopBombAnswer, loopBombHolder, loopBombStartTime) {
    await QQGroupModel.update(
      {
        loopBombEnabled: true,
        loopBombAnswer,
        loopBombHolder,
        loopBombStartTime,
      },
      {
        where: {
          groupId,
        },
      },
    )
  },

  /**
   * 更新下一题击鼓传雷游戏
   * @param {string} groupId 群ID
   * @param {string} loopBombAnswer 答案
   * @param {string} loopBombHolder 持有人
   * @returns {Promise<void>} void
   */
  async UpdateGroupLoopBombGame(groupId, loopBombAnswer, loopBombHolder) {
    await QQGroupModel.update(
      {
        loopBombAnswer,
        loopBombHolder,
      },
      {
        where: {
          groupId,
        },
      },
    )
  },

  /**
   * 获取当前击鼓传雷的数据
   * @param {string} groupId 群ID
   * @returns {Promise<object>} { 持有人, 答案, 开始时间 }
   */
  async GetGroupLoopBomb(groupId) {
    const group = await QQGroupModel.findOne({where: {groupId}})

    return {
      bombHolder: group.loopBombHolder,
      bombAnswer: group.loopBombAnswer,
      bombStartTime: group.loopBombStartTime,
    }
  },

  /**
   * 击鼓传雷游戏结束，清空数据
   * @param {string} groupId 群ID
   * @returns {Promise<void>} void
   */
  async EndGroupLoopBombGame(groupId) {
    await QQGroupModel.update(
      {
        loopBombEnabled: false,
        loopBombAnswer: null,
        loopBombHolder: null,
        loopBombStartTime: null,
      },
      {
        where: {
          groupId,
        },
      },
    )
  },

  /**
   * 自动为停用服务的群启用服务
   * @returns {Promise<void>} void
   */
  async AutoEnableQQGroupService() {
    console.log('开始自动为停用服务的群启用服务'.log)
    // 获取停用服务的群列表
    const serviceStoppedGroupsList = await QQGroupModel.findAll({
      where: {
        serviceEnabled: false,
      },
    }).then((groups) => groups.map((group) => group.groupId))

    if (!serviceStoppedGroupsList) {
      console.log('目前没有群是关闭服务的，挺好'.log)
      return
    } else {
      console.log(`以下群未启用小夜服务: ${serviceStoppedGroupsList} ，自动启用服务`.log)
      serviceStoppedGroupsList.forEach((groupId) => {
        const delayTime = Math.floor(Math.random() * 60) // 随机延时0到60秒
        console.log(`小夜将会延时 ${delayTime} 秒后提醒群 ${groupId} 小夜已自动张菊`)
        setTimeout(async () => {
          await axios
            .get(
              `http://${ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
                '害害嗨，小夜自动张菊了',
              )}`,
            )
            .then(async () => {
              await this.EnableGroupService(groupId)
              console.log(`小夜提醒了群 ${groupId} 服务已经自动启用`)
            })
        }, 1000 * delayTime)
      })
    }
  },

  /**
   * 私聊发送孤寡
   * @param {string} qqId QQ号
   * @returns {void} void
   */
  GuGua(qqId) {
    console.log(`小夜孤寡了 ${qqId}`.log)

    guGuaPicList.forEach((pic, index) => {
      const picUrl = `[CQ:image,file=http://127.0.0.1:${WEB_PORT}/xiaoye/ps/${pic}]`
      setTimeout(async () => {
        await axios.get(`http://${ONE_BOT_API_URL}/send_private_msg?user_id=${qqId}&message=${encodeURI(picUrl)}`)
      }, 1000 * 5 * index)
    })
  },

  /**
   * 群发送孤寡
   * @param {string} groupId 群ID
   * @returns {void} void
   */
  QunGuGua(groupId) {
    console.log(`小夜孤寡了群 ${groupId}`.log)

    guGuaPicList.forEach((pic, index) => {
      const picUrl = `[CQ:image,file=http://127.0.0.1:${WEB_PORT}/xiaoye/ps/${pic}]`
      setTimeout(async () => {
        await axios.get(`http://${ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(picUrl)}`)
      }, 1000 * 5 * index)
    })
  },

  /**
   * 全匹配语料，随机回复
   * @param {string} ask 关键词
   * @returns {Promise<string>} 回复内容
   */
  async FullContentSearchAnswer(ask) {
    const answers = await ChatModel.findAll({where: {ask}})

    return answers[Math.floor(Math.random() * answers.length)]?.answer ?? null
  },

  /**
   * 模糊匹配语料，随机回复
   * @param {string} ask 关键词
   * @returns {Promise<string>} 回复内容
   */
  async FuzzyContentSearchAnswer(ask) {
    const answers = await ChatModel.findAll({
      where: {
        ask: {
          [Op.like]: `%${ask}%`,
        },
      },
    })

    return answers[Math.floor(Math.random() * answers.length)]?.answer ?? null
  },

  /**
   * 随机回复敷衍语料
   * @returns {Promise<string>} 敷衍回复
   */
  async PerfunctoryAnswer() {
    const perfunctoryWords = await PerfunctoryModel.findAll()

    return perfunctoryWords[Math.floor(Math.random() * perfunctoryWords.length)].content ?? null
  },

  /**
   * 学习问答
   * @param {string} ask 关键词
   * @param {string} answer 回复内容
   * @param {string} teacherUserId 教学者
   * @param {string} teacherGroupId 教学者所处群
   * @param {string} teacherType 教学者平台类型
   * @returns {Promise<void>} void
   */
  async CreateOneConversation(ask, answer, teacherUserId, teacherGroupId, teacherType) {
    await ChatModel.create({ask, answer, teacherUserId, teacherGroupId, teacherType})
  },

  /**
   * 魔改图片的一个随机像素点为随机颜色
   * @param {string} picPath 原始图片的路径
   * @returns {Promise<string>} 修改后图片的路径
   */
  async ModifyPic(picPath) {
    // 读取图片为原始像素数据
    const image = sharp(picPath)
    const {width, height, channels} = await image.metadata()
    const raw = await image.raw().toBuffer()

    // 随机像素点
    const x = Math.floor(Math.random() * width)
    const y = Math.floor(Math.random() * height)
    const idx = (y * width + x) * channels

    // 随机颜色
    const color = [
      Math.floor(Math.random() * 256), // R
      Math.floor(Math.random() * 256), // G
      Math.floor(Math.random() * 256), // B
    ]
    if (channels === 4) color.push(255) // 保持 alpha 不变或设为 255

    // 修改像素
    for (let c = 0; c < channels; c++) {
      raw[idx + c] = color[c] ?? raw[idx + c]
    }

    // 保存新图片
    const modifiedPicPath = `./static/images/modified/${Date.now()}.png`
    await sharp(raw, {raw: {width, height, channels}}).png().toFile(modifiedPicPath)
    return modifiedPicPath
  },

  /**
   * 玩家的手雷次数+1
   * @param {string} userId 玩家QQ号
   * @returns {Promise<void>} void
   */
  async IncreaseHandGrenadePlayedTimes(userId, times) {
    await HandGrenadeModel.update({times: times}, {where: {userId}})
  },

  /**
   * 查询玩家的当日手雷次数，当日有效
   * @param {string} userId 玩家QQ号
   * @returns {Promise<number>} 当日手雷次数
   */
  async GetUserHandGrenadeTimesToday(userId) {
    const handGrenade = await HandGrenadeModel.findOrCreate({
      where: {userId},
      defaults: {userId},
    })

    // handGrenade[1] 表示是否是新建记录
    if (handGrenade[1]) {
      return 0
    }
    // 如果玩家这一天没有丢过手雷，则手雷次数初始化为0
    else if (dayjs(handGrenade[0].updatedAt).endOf('day').toDate() < dayjs().endOf('day').toDate()) {
      await this.IncreaseHandGrenadePlayedTimes(userId, 1)
      return 0
    } else {
      return handGrenade[0].times
    }
  },

  /**
   * 切换群插件开关
   * @param {number} groupId 群id
   * @param {string} pluginName 插件名
   * @returns {Promise<boolean>} 插件开关状态
   */
  async ToggleGroupPlugin(groupId, pluginName) {
    const group = (await QQGroupModel.findOrCreate({where: {groupId}}))[0]
    if (!group.pluginsList || !Object.prototype.hasOwnProperty.call(group.pluginsList, pluginName)) {
      console.log(`该群没有初始化 ${pluginName} ，给一个初始开`.log)

      group.pluginsList = {
        ...group.pluginsList,
        [pluginName]: true,
      }
    }

    const pluginStatus = group.pluginsList[pluginName]
    console.log(`小夜将会将群 ${groupId} 的 ${pluginName} 插件状态从 ${pluginStatus} 变为 ${!pluginStatus}`.log)
    await QQGroupModel.update({pluginsList: {...group.pluginsList, [pluginName]: !pluginStatus}}, {where: {groupId}})
    return !pluginStatus
  },

  /**
   * 获取群插件开关
   * @param {number} groupId 群id
   * @param {string} pluginName 插件名
   * @returns {Promise<boolean>} 插件开关状态
   */
  async GetGroupPluginStatus(groupId, pluginName) {
    const group = (await QQGroupModel.findOrCreate({where: {groupId}}))[0]
    if (!group.pluginsList) {
      console.log('该群没有初始化插件列表，初始化一下'.log)

      await QQGroupModel.update({pluginsList: {[pluginName]: true}}, {where: {groupId}})
      return true
    }

    const pluginExists = Object.prototype.hasOwnProperty.call(group.pluginsList, pluginName)
    if (!pluginExists) {
      console.log(`该群没有初始化 ${pluginName} ，给一个初始开`.log)

      await QQGroupModel.update({pluginsList: {...group.pluginsList, [pluginName]: true}}, {where: {groupId}})
      return true
    }

    return group.pluginsList[pluginName]
  },

  UserModel,
  MessageModel,
  QQGroupModel,
  MineModel,
  ChatModel,
  PerfunctoryModel,
  HandGrenadeModel,
}
