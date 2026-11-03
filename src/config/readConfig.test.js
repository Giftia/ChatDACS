'use strict'

const {readConfig} = require('./readConfig')

test('parses configuration without starting any runtime', async () => {
  const readFile = jest.fn((file, encoding, callback) => callback(null, 'System:\n  WEB_PORT: 8080'))
  await expect(readConfig('test.yml', {readFile})).resolves.toEqual({System: {WEB_PORT: 8080}})
  expect(readFile).toHaveBeenCalledWith('test.yml', 'utf8', expect.any(Function))
})

test('YAML diagnostics cannot escape the promise or expose configuration fragments', async () => {
  const readFile = (_file, _encoding, callback) => {
    queueMicrotask(() => callback(null, 'privateKey: test-secret\nprivateKey: test-secret'))
  }
  const error = await readConfig('test.yml', {readFile}).catch(error => error)
  expect(error).toMatchObject({code: 'CONFIG_INVALID', message: 'CONFIG_INVALID'})
  expect(error.stack).not.toContain('test-secret')
  expect(error.cause).toBeUndefined()
})

test.each(['null', '[]', 'plain text'])('rejects non-object configuration %s', async (content) => {
  const readFile = (_file, _encoding, callback) => callback(null, content)
  await expect(readConfig('test.yml', {readFile})).rejects.toMatchObject({code: 'CONFIG_INVALID'})
})

test.each([false, true])('safe file read failure, synchronous=%s', async (synchronous) => {
  const readFile = (_file, _encoding, callback) => {
    const error = new Error('private path and secret')
    if (synchronous) throw error
    callback(error)
  }
  await expect(readConfig('test.yml', {readFile})).rejects.toMatchObject({message: 'CONFIG_READ_FAILED'})
})
