'use strict'

jest.mock('../../plugins/system/utils.js', () => ({FullContentSearchAnswer: jest.fn(), FuzzyContentSearchAnswer: jest.fn(),
  ChatJiebaFuzzy: jest.fn(), PerfunctoryAnswer: jest.fn()}))
jest.mock('nodejs-jieba', () => ({extract: jest.fn()}))
jest.mock('axios', () => ({default: {get: jest.fn(() => { throw new Error('Unexpected network') })}}))
const utils = require('../../plugins/system/utils')
const {matchChat, ChatProcess} = require('./chat')

beforeEach(() => {
  jest.clearAllMocks()
  utils.FullContentSearchAnswer.mockResolvedValue(null)
  utils.FuzzyContentSearchAnswer.mockResolvedValue(null)
  utils.ChatJiebaFuzzy.mockResolvedValue([])
  utils.PerfunctoryAnswer.mockResolvedValue('legacy answer')
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

test.each(['', '  ', null, undefined, 12])('matchChat ignores empty/non-text input %# without consulting the database', async (input) => {
  await expect(matchChat(input)).resolves.toEqual({handled: false, content: '', matchType: null})
  expect(utils.FullContentSearchAnswer).not.toHaveBeenCalled()
  expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
})

test('matchChat reports a genuine miss without generating a random perfunctory reply', async () => {
  await expect(matchChat('no match')).resolves.toEqual({handled: false, content: '', matchType: null})
  expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
})

test.each(['full', 'fuzzy', 'jieba'])('matchChat reports %s hits and preserves the complete reply', async (kind) => {
  const content = 'complete reply '.repeat(1000)
  if (kind === 'full') utils.FullContentSearchAnswer.mockResolvedValue(content)
  if (kind === 'fuzzy') utils.FuzzyContentSearchAnswer.mockResolvedValue(content)
  if (kind === 'jieba') utils.ChatJiebaFuzzy.mockResolvedValue(['', null, ' ', content])
  await expect(matchChat('fixture')).resolves.toEqual({handled: true, content, matchType: kind})
  expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
  if (kind === 'full') expect(utils.FuzzyContentSearchAnswer).not.toHaveBeenCalled()
})

test.each([undefined, null, [], ['', ' ', null]])('empty candidate results remain misses %#', async (candidates) => {
  utils.FullContentSearchAnswer.mockResolvedValue(' ')
  utils.FuzzyContentSearchAnswer.mockResolvedValue('')
  utils.ChatJiebaFuzzy.mockResolvedValue(candidates)
  await expect(matchChat('fixture')).resolves.toMatchObject({handled: false})
})

test('match failures are explicit safe errors, never disguised as misses', async () => {
  utils.FullContentSearchAnswer.mockRejectedValueOnce(new Error('SECRET database payload'))
  await expect(matchChat('fixture')).rejects.toMatchObject({message: 'CHAT_MATCH_FAILED', code: 'CHAT_MATCH_FAILED'})
  expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
})

test('ChatProcess retains its old signature, matching priority and default perfunctory fallback', async () => {
  expect(ChatProcess.length).toBe(1)
  await expect(ChatProcess('legacy miss')).resolves.toBe('legacy answer')
  await expect(ChatProcess('')).resolves.toBe('legacy answer')
  utils.FullContentSearchAnswer.mockResolvedValue('legacy corpus')
  await expect(ChatProcess('legacy hit')).resolves.toBe('legacy corpus')
})
