const {ChatProcess} = require('./src/core/chat.js')
const utils = require('./plugins/system/utils.js')

jest.mock('canvas', () => ({}))
jest.mock('play-sound', () => () => ({play: jest.fn()}))
jest.mock('trayicon', () => ({}))
jest.mock('lib-qqwry', () => () => ({
  searchIP: jest.fn(() => ({Country: '测试'})),
}))
jest.mock('bilibili-live-ws', () => ({KeepLiveTCP: jest.fn()}))
jest.mock('qq-guild-bot', () => ({
  createOpenAPI: jest.fn(),
  createWebsocket: jest.fn(),
}))
jest.mock('node-telegram-bot-api', () => jest.fn())
jest.mock('./plugins/system/utils.js')

describe('ChatProcess', () => {
  let logSpy

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    logSpy.mockRestore()
  })

  test('should return full content search answer if found', async () => {
    const mockAnswer = 'this is a full match'
    utils.FullContentSearchAnswer.mockResolvedValue(mockAnswer)

    const result = await ChatProcess('test ask')
    expect(result).toBe(mockAnswer)
    expect(utils.FullContentSearchAnswer).toHaveBeenCalledWith('test ask')
    expect(utils.FuzzyContentSearchAnswer).not.toHaveBeenCalled()
  })

  test('should return fuzzy content search answer if full search fails', async () => {
    const mockAnswer = 'this is a fuzzy match'
    utils.FullContentSearchAnswer.mockResolvedValue(null)
    utils.FuzzyContentSearchAnswer.mockResolvedValue(mockAnswer)

    const result = await ChatProcess('test ask')
    expect(result).toBe(mockAnswer)
    expect(utils.FullContentSearchAnswer).toHaveBeenCalledWith('test ask')
    expect(utils.FuzzyContentSearchAnswer).toHaveBeenCalledWith('test ask')
  })

  test('should return perfunctory answer as a last resort', async () => {
    const mockAnswer = 'this is a perfunctory answer'
    utils.FullContentSearchAnswer.mockResolvedValue(null)
    utils.FuzzyContentSearchAnswer.mockResolvedValue(null)
    utils.ChatJiebaFuzzy.mockResolvedValue([])
    utils.PerfunctoryAnswer.mockResolvedValue(mockAnswer)

    const result = await ChatProcess('unmatched phrase')
    expect(result).toBe(mockAnswer)
    expect(utils.PerfunctoryAnswer).toHaveBeenCalled()
  })

  test('should return a jieba fuzzy candidate before perfunctory fallback', async () => {
    const mockAnswer = 'this is a jieba fuzzy candidate'
    utils.FullContentSearchAnswer.mockResolvedValue(null)
    utils.FuzzyContentSearchAnswer.mockResolvedValue(null)
    utils.ChatJiebaFuzzy.mockResolvedValue([mockAnswer])

    const result = await ChatProcess('partially matched phrase')
    expect(result).toBe(mockAnswer)
    expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
  })
})

describe('index module startup guard', () => {
  test('should export startup functions without starting the app when required', () => {
    const indexModule = require('./index.js')

    expect(indexModule.main).toEqual(expect.any(Function))
    expect(indexModule.InitConfig).toEqual(expect.any(Function))
    expect(indexModule.ProcessExecute).toEqual(expect.any(Function))
  })
})
