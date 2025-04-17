module.exports = {
  插件名: '语音合成插件',
  指令: '^[/!]?吠(.*)',
  版本: '2.2', // 升级版本号
  作者: 'Giftina',
  描述: '让小夜开口说话吧。小夜使用基于大数据的情感幼女语音合成技术，能吠出更自然的发音、更丰富的情感和更强大的表现力。可以插入一些棒读音以提高生草效果。',
  使用示例:
    '/吠 太好听了吧啊，你唱歌真的好嗷好听啊，简直就是天岸籁，我刚才听到你唱歌了，我们以后一起唱好不好，一起唱昂，一起做学园偶像昂',
  预期返回: '[唐可可中文语音]',

  // 初始化方法，用于依赖注入
  init({logger, axios, fs, utils, constants}) {
    this.logger = logger
    this.axios = axios
    this.fs = fs
    this.utils = utils
    this.constants = constants
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const ttsContextFromIncomingMessage = new RegExp(this.指令).exec(msg)?.[1]
    const ttsContent = ttsContextFromIncomingMessage || '你好谢谢小笼包再见!'
    // 如果有图片回复，则不合成语音
    if (this.constants.isImage_reg.test(ttsContent)) {
      return ''
    }

    const ttsFile = await this.TTS(ttsContent)
    return {type: 'audio', content: ttsFile}
  },

  // 语音合成逻辑
  TTS: async function (ttsContent) {
    try {
      const ttsResult = await this.axios({
        url: 'https://ai.baidu.com/aidemo',
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          Referer: 'https://ai.baidu.com/tech/speech/tts_online',
        },
        params: {
          type: 'tns',
          lan: 'zh',
          per: '4103', // 声线选择，4103为度米朵
          spd: '7', // 语速，取值0-15，默认为5中语速
          pit: '10', // 音调，取值0-15，默认为5中语调
          vol: '9', // 音量，取值0-15，默认为5中音量
          aue: '3', // 格式，3：mp3
          tex: encodeURI(ttsContent),
        },
      })

      const data = ttsResult.data.data
      if (data) {
        this.logger.info(`${ttsContent} 的小夜语音合成成功`)
        const base64Data = data.replace('data:audio/x-mpeg;base64,', '')
        const dataBuffer = Buffer.from(base64Data, 'base64')
        const MP3Duration = await this.utils.getMP3Duration(dataBuffer)
        const ttsFile = `/xiaoye/tts/${this.utils.sha1(dataBuffer)}.mp3`
        this.fs.writeFileSync(`./static${ttsFile}`, dataBuffer)
        return {
          file: ttsFile,
          filename: '小夜语音回复',
          duration: MP3Duration,
        }
      }
    } catch (error) {
      this.logger.error(`语音合成小夜TTS失败: ${error.message}`)
      return '语音合成失败，请稍后再试。'
    }
  },
}
