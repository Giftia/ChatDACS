'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const {parse} = require('@babel/parser')
const cookie = require('cookie')
const html = fs.readFileSync(path.resolve('static/index.html'), 'utf8')
const callbacks = {}
function visit(node, source) {
  if (!node || typeof node !== 'object') return
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
      ['socket', 'layim'].includes(node.callee.object.name) && node.callee.property.name === 'on' &&
      node.arguments[0]?.type === 'StringLiteral') {
    const callback = node.arguments[1]
    callbacks[`${node.callee.object.name}:${node.arguments[0].value}`] = source.slice(callback.start, callback.end)
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => visit(item, source))
    else if (value && typeof value === 'object') visit(value, source)
  }
}
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  let ast
  try { ast = parse(match[1]) } catch { continue }
  visit(ast, match[1])
}

function client(rawCookie) {
  const assignments = []
  const document = {}
  Object.defineProperty(document, 'cookie', {get: () => rawCookie, set: (value) => assignments.push(value)})
  const reload = jest.fn()
  const layim = {getMessage: jest.fn()}
  const socket = {emit: jest.fn()}
  const context = vm.createContext({document, window: {location: {reload}}, layim, socket, myCID: '', username: '',
    Date: class { getTime() { return 1700000000123 } }})
  const callback = (name) => {
    if (!callbacks[name]) throw new Error(`ACTUAL_CALLBACK_MISSING:${name}`)
    return vm.runInContext(`(${callbacks[name]})`, context)
  }
  return {context, assignments, reload, layim, socket, getCookie: callback('socket:getCookie'),
    receive: callback('socket:message'), send: callback('layim:sendMessage')}
}

test.each(['theme=dark', 'theme=dark; ChatdacsID=', 'theme=dark; ChatdacsID=0',
  'theme=dark; ChatdacsID=%30'])('actual getCookie creates a new nonreserved ID and reloads for %s', (rawCookie) => {
  const value = client(rawCookie)
  value.getCookie()
  expect(value.assignments).toEqual(['ChatdacsID=1700000000123;expires=Fri, 1 Apr 2050 17:00:00 GMT'])
  expect(value.reload).toHaveBeenCalledTimes(1)
})

test.each([
  ['ChatdacsID=legacy-user-123; theme=dark', 'legacy-user-123'],
  ['theme=dark; ChatdacsID=user%20%E4%B8%AD%3D42; mode=quiet', 'user 中=42'],
  ['mode=quiet; theme=dark; ChatdacsID=legacy-user-123', 'legacy-user-123'],
  ['theme=dark; ChatdacsID=bad%zz; mode=quiet', 'bad%zz'],
  ['theme=dark; ChatdacsID=%E0%A4%A; mode=quiet', '%E0%A4%A'],
  ['NotChatdacsID=wrong; ChatdacsID=correct; ChatdacsID_extra=wrong', 'correct'],
])('actual getCookie matches server cookie decoding without reload: %s', (rawCookie, expected) => {
  const value = client(rawCookie)
  expect(() => value.getCookie()).not.toThrow()
  expect(value.context.myCID).toBe(expected)
  expect(value.context.myCID).toBe(cookie.parse(rawCookie).ChatdacsID)
  expect(value.assignments).toEqual([])
  expect(value.reload).not.toHaveBeenCalled()
})

test('actual send/message callbacks suppress only the own server echo when other cookies and encoded CID are present', () => {
  const rawCookie = 'theme=dark; ChatdacsID=user%20%E4%B8%AD%3D42; mode=quiet'
  const value = client(rawCookie)
  value.getCookie()
  const localEcho = 'synthetic local echo'
  const rendered = [{content: localEcho}]
  value.layim.getMessage.mockImplementation((message) => rendered.push(message))
  value.socket.emit.mockImplementation((event, message) => {
    if (event === 'message') value.receive({CID: cookie.parse(rawCookie).ChatdacsID,
      name: 'synthetic', msg: message.msg})
  })
  value.send({mine: {content: localEcho}})
  expect(value.socket.emit).toHaveBeenCalledWith('message', {CID: 'user 中=42', msg: localEcho})
  expect(value.layim.getMessage).not.toHaveBeenCalled()
  expect(rendered).toHaveLength(1)
  value.receive({CID: 'other-synthetic-user', name: 'other', msg: 'remote text'})
  expect(value.layim.getMessage).toHaveBeenCalledTimes(1)
  expect(rendered).toHaveLength(2)
  value.receive({CID: '0', msg: 'bot text'})
  expect(value.layim.getMessage).toHaveBeenCalledTimes(2)
  expect(rendered.at(-1).content).toBe('bot text')
})
