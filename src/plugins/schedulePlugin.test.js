const source = require('../../plugins/schedule')
const dayjs = require('dayjs')

function fixture(base = 'mock.invalid:5700', enabled = true) {
  const plugin = {...source}
  const axios = {get: jest.fn().mockResolvedValue({data: {status: 'ok'}})}
  const logger = {info: jest.fn(), error: jest.fn()}
  const schedule = {scheduleJob: jest.fn()}
  plugin.init({logger, axios, schedule, dayjs,
    config: {ONE_BOT_API_URL: base, CONNECT_ONE_BOT_SWITCH: enabled}})
  return {plugin, axios, logger, schedule}
}

describe('schedule plugin with fake scheduling and injected transport', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 10, 4, 10, 20, 30))
  })
  afterEach(() => jest.useRealTimers())

  test.each(['mock.invalid:5700', 'http://mock.invalid:5700', 'https://mock.invalid:5700/api/'])(
    'encodes message and target as single parameters for base %s', async (base) => {
      const {plugin, axios, schedule} = fixture(base)
      const message = '提醒我明天晚上检查 &group_id=999&message=other/#?中文 +%='
      const text = message.slice(2).replace(/我/g, '你')
      const name = 'A&B/#中文'
      const reply = await plugin.execute(message, 123, name, 789, 'group', {})
      expect(reply).toEqual({type: 'text', content: `好的，我会提醒${text}`})
      expect(schedule.scheduleJob).toHaveBeenCalledTimes(1)
      expect(schedule.scheduleJob.mock.calls[0][0]).toEqual(new Date(2026, 10, 5, 21, 20, 30))
      expect(axios.get).not.toHaveBeenCalled()
      await schedule.scheduleJob.mock.calls[0][1]()
      expect(axios.get).toHaveBeenCalledTimes(1)
      expect(axios.get.mock.calls[0]).toHaveLength(1)
      const url = new URL(axios.get.mock.calls[0][0])
      expect(url.origin).toBe(base.startsWith('https:') ? 'https://mock.invalid:5700' : 'http://mock.invalid:5700')
      expect(url.pathname).toBe(base.startsWith('https:') ? '/api/send_group_msg' : '/send_group_msg')
      expect([...url.searchParams.keys()]).toEqual(['group_id', 'message'])
      expect(url.searchParams.getAll('group_id')).toEqual(['789'])
      expect(url.searchParams.getAll('message')).toEqual([`小夜提醒${name}：${text}`])
      expect(url.hash).toBe('')
    },
  )

  test.each(['reject', 'throw', 'invalid base'])('callback %s failure is contained, sanitized and never retried', async (failure) => {
    const {plugin, axios, logger, schedule} = fixture(failure === 'invalid base' ? 'http://user:SECRET@mock.invalid' : undefined)
    const error = Object.assign(new Error('SECRET http://mock.invalid?access_token=SECRET'),
      {config: {url: 'SECRET_URL'}, response: {data: 'SECRET_BODY'}})
    if (failure === 'reject') axios.get.mockRejectedValue(error)
    if (failure === 'throw') axios.get.mockImplementation(() => { throw error })
    await plugin.execute('提醒我明天晚上检查', 123, 'name', 789, 'group', {})
    await expect(schedule.scheduleJob.mock.calls[0][1]()).resolves.toBeUndefined()
    expect(logger.error.mock.calls).toEqual([['SCHEDULE_REMINDER_FAILED']])
    expect(JSON.stringify([logger.info.mock.calls, logger.error.mock.calls])).not.toContain('SECRET')
    await jest.advanceTimersByTimeAsync(86400000)
    expect(axios.get).toHaveBeenCalledTimes(failure === 'invalid base' ? 0 : 1)
    expect(schedule.scheduleJob).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('disabled OneBot still acknowledges and schedules without sending', async () => {
    const {plugin, axios, schedule} = fixture(undefined, false)
    expect(await plugin.execute('提醒我今天晚上检查', 123, 'name', 789, 'group', {}))
      .toEqual({type: 'text', content: '好的，我会提醒你今天晚上检查'})
    await schedule.scheduleJob.mock.calls[0][1]()
    expect(axios.get).not.toHaveBeenCalled()
  })

  test.each([
    ['今天', 0], ['明天', 1], ['后天', 2],
    ['大后天', 3], ['大大后天', 4], ['大大大后天', 5], ['没有日期', 0],
  ])('%s uses day offset %i without changing the reminder protocol', async (word, offset) => {
    const {plugin, schedule} = fixture()
    const expected = new Date(2026, 10, 4 + offset, 10, 20, 30)
    expect(plugin.DayToTime(`你${word}晚上检查`).toDate()).toEqual(expected)
    expect(await plugin.execute(`提醒我${word}晚上检查`, 123, 'name', 789, 'group', {}))
      .toEqual({type: 'text', content: `好的，我会提醒你${word}晚上检查`})
    expect(schedule.scheduleJob.mock.calls[0][0]).toEqual(new Date(2026, 10, 4 + offset, 21, 20, 30))
  })

  test.each([['马上', 10], ['待会', 600]])('preserves the existing %s delay rule', async (word, seconds) => {
    const {plugin, schedule} = fixture()
    await plugin.execute(`提醒我${word}检查`, 123, 'name', 789, 'group', {})
    expect(schedule.scheduleJob.mock.calls[0][0].getTime()).toBe(Date.now() + seconds * 1000)
  })
})
