'use strict'

const utils = require('../../plugins/system/utils.js')
const jieba = require('nodejs-jieba')
const axios = require('axios').default

/**
 * 响应聊天回复，超智能(障)的聊天算法: 全匹配搜索 => 模糊搜索 => 分词模糊搜索 => 敷衍
 * @param {string} ask 关键词
 * @returns {Promise<string>} 小夜回复
 */
async function ChatProcess(ask) {
  //如果ask异常，可能是非聊天事件触发了响应聊天回复，直接敷衍回复
  if (!ask) {
    console.log('ask异常，直接敷衍回复'.log)
    const randomBalaBala = await utils.PerfunctoryAnswer()
    console.log(`返回随机敷衍：${randomBalaBala}`.alert)
    return randomBalaBala
  }

  console.log('开始全匹配搜索'.log)
  const fullContentSearchAnswer = await utils.FullContentSearchAnswer(ask)

  // 优先回复全匹配匹配
  if (fullContentSearchAnswer) {
    console.log(`返回全匹配匹配：${fullContentSearchAnswer}`.alert)
    return fullContentSearchAnswer
  }

  console.log('没有匹配到全匹配回复，开始模糊搜索'.log)
  const fuzzyContentSearchAnswer = await utils.FuzzyContentSearchAnswer(ask)

  // 其次是模糊匹配
  if (fuzzyContentSearchAnswer) {
    console.log(`返回模糊匹配：${fuzzyContentSearchAnswer}`.alert)
    return fuzzyContentSearchAnswer
  }

  // 最后是分词模糊搜索
  console.log('没有匹配到模糊回复，开始分词模糊搜索'.log)
  const jiebaCandidateList = await utils.ChatJiebaFuzzy(ask)
  if (jiebaCandidateList.length > 0 && jiebaCandidateList[0]) {
    const candidateListAnswer = jiebaCandidateList[Math.floor(Math.random() * jiebaCandidateList.length)]
    console.log(`返回分词模糊匹配：${candidateListAnswer}`.alert)
    return candidateListAnswer
  }

  // 如果什么回复都没有匹配到，那么随机敷衍
  console.log('没有匹配到分词模糊搜索，敷衍一下吧'.log)
  const randomBalaBala = await utils.PerfunctoryAnswer()
  console.log(`返回随机敷衍：${randomBalaBala}`.alert)
  return randomBalaBala
}

/**
 * 浓度极高的ACGN圈台词问答题库
 * @returns {Promise<object>} { question, answer }
 */
async function ECYWenDa(config) {
  const data = (await axios.get('https://api.oddfar.com/yl/q.php?c=2001&encode=json')).data
  const keyWord = jieba.extract(data.text, config.CHAT_JIEBA_LIMIT) // 分词出关键词
  if (keyWord.length == 0) {
    // 如果分词不了，那就直接夜爹牛逼
    return {
      question: '啊噢，出不出题了，你直接回答 夜爹牛逼 吧',
      answer: '夜爹牛逼',
    }
  }

  const randomAnswer = keyWord[Math.floor(Math.random() * keyWord.length)].word
  console.log(`原句为: ${data.text}，随机切去关键词 ${randomAnswer} 作为答案`.log)
  // 将答案切除作为问题
  const question = data.text.replace(randomAnswer, '______')
  return {question: question, answer: randomAnswer}
}

module.exports = {
  ChatProcess,
  ECYWenDa,
}
