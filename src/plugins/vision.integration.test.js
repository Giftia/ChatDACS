'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const {createPluginRuntime} = require('./runtime')
jest.mock('require.all', () => jest.fn())

test.each(['group', 'private'])('QQ %s vision uses the existing runtime and legacy execute interface', async scope => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-vision-'))
  const plugin = {...require('../../plugins/ollama')}
  const prepare = jest.fn(async () => ['data:image/png;base64,aW1hZ2U='])
  const post = jest.fn(async () => ({data: {choices: [{message: {content: '看见绿色'}}]}}))
  const logger = {info() {}, warn() {}, error() {}}
  try {
    const qrExecute = jest.fn(async () => ({type: 'text', content: 'legacy QR reply'}))
    require('require.all').mockReturnValue({ollama: plugin,
      qr: {插件名: 'legacy QR', 指令: '^qr ', execute: qrExecute}, repeat: {...require('../../plugins/repeat')}})
    const runtime = createPluginRuntime({pluginDir: 'fixture', logger, dependencies: {
      config: {llm: {provider: 'openai', model: 'fixture-vision', baseUrl: 'https://fixture.invalid/v1',
        apiKeyFile: path.join(directory, 'key.credentials.json'), personaDir: directory,
        personaStateFile: path.join(directory, 'persona.json'), modelStateFile: path.join(directory, 'model.json')}},
      axios: {post}, logger, imageInput: {prepare},
    }})
    fs.writeFileSync(path.join(directory, 'key.credentials.json'), JSON.stringify({apiKey: 'synthetic-vision-test'}))
    runtime.load()
    const event = {message_type: scope, self_id: 12, user_id: 34, group_id: scope === 'group' ? 56 : undefined}
    const context = {text: '[CQ:image,file=sample.jpg,url=https://gchat.qpic.cn/sample?rkey=private]', platform: 'qq', selfId: 12,
      userId: 34, userName: 'Tester', groupId: scope === 'group' ? 56 : undefined,
      raw: {scope, event}}
    expect(await runtime.execute({...context, text: 'qr ' + context.text})).toMatchObject({content: 'legacy QR reply'})
    expect(qrExecute).toHaveBeenCalledTimes(1)
    expect(prepare).not.toHaveBeenCalled()
    plugin.observeMessage(context)
    // The legacy bridge creates new options but carries the same OneBot event.
    expect((await runtime.execute({...context, raw: {scope, event}})).handled).toBe(false)
    expect(post).not.toHaveBeenCalled()
    const result = await runtime.executeFallback({...context, raw: {scope, event}})
    expect(result).toMatchObject({handled: true, content: '看见绿色', pluginName: plugin.插件名})
    expect(prepare).toHaveBeenCalledWith([{file: 'sample.jpg', url: 'https://gchat.qpic.cn/sample?rkey=private'}])
    expect(post.mock.calls[0][1].messages.at(-1).content[1].type).toBe('image_url')
    expect(post.mock.calls[0][1].messages.map(entry => entry.role)).toEqual(['system', 'user'])
    expect(result.safeError).toBeUndefined()
    plugin.recordReply(context, result.content)
    const repeated = {...context, raw: {scope, event: {...event}}}
    plugin.observeMessage(repeated)
    const echo = await runtime.execute(repeated)
    expect(echo.content).toBe(context.text)
    plugin.recordReply(repeated, echo.content)
    const followup = {...context, text: '继续解释', raw: {scope, event: {...event}}}
    plugin.observeMessage(followup)
    await runtime.executeFallback(followup)
    const request = JSON.stringify(post.mock.calls[1][1])
    expect(request).not.toContain('qpic.cn')
    expect(request).not.toContain('rkey')
    expect(request).not.toContain('image_url')
    expect(request).toContain('[图片]')
  } finally { fs.rmSync(directory, {recursive: true, force: true}) }
})
