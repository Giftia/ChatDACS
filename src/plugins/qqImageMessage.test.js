'use strict'
const {parseQQImageMessage, toCQMessage} = require('./qqImageMessage')

test('keeps ordinary text unchanged', () => {
  expect(parseQQImageMessage('hello [CQ:at,qq=1]')).toEqual({text: 'hello [CQ:at,qq=1]', images: []})
})
test('parses actual CQ images and escaped query parameters without treating escaped text as images', () => {
  expect(parseQQImageMessage('看这里[CQ:image,file=a.jpg,url=https://gchat.qpic.cn/a?x=1&amp;y=a&#44;b]'))
    .toEqual({text: '看这里', images: [{file: 'a.jpg', url: 'https://gchat.qpic.cn/a?x=1&y=a,b'}]})
  expect(parseQQImageMessage('&#91;CQ:image,file=fake&#93;').images).toEqual([])
})
test('supports segment arrays, keeps captions and escapes CQ-looking text', () => {
  const segments = [{type: 'text', data: {text: 'caption [CQ:image,file=fake]'}}, {type: 'image', data: {file: 'real.jpg', url: 'https://gchat.qpic.cn/a,b'}}]
  expect(parseQQImageMessage(segments)).toEqual({text: 'caption &#91;CQ:image,file=fake&#93;', images: [{file: 'real.jpg', url: 'https://gchat.qpic.cn/a,b'}]})
  expect(toCQMessage([{type: 'at', data: {qq: 123}}])).toBe('[CQ:at,qq=123]')
})
test('retains an invalid descriptor or fourth image for explicit failure instead of ignoring it', () => {
  expect(parseQQImageMessage('[CQ:image,type=show]').images).toEqual([{}])
  expect(parseQQImageMessage('[CQ:image,file=x]'.repeat(20)).images).toHaveLength(4)
})
