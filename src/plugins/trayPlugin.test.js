'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const trayPlugin = require('../../plugins/tray')

describe('tray plugin startup', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')

  afterEach(() => {
    Object.defineProperty(process, 'platform', platformDescriptor)
  })

  test('logs a tray startup failure instead of creating an unhandled rejection', async () => {
    Object.defineProperty(process, 'platform', {...platformDescriptor, value: 'win32'})
    const logger = {error: jest.fn()}
    const trayicon = {create: jest.fn().mockRejectedValue(new Error('desktop unavailable'))}

    trayPlugin.init({logger, trayicon, path, fs, os, exec: jest.fn()})
    await new Promise((resolve) => setImmediate(resolve))

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('desktop unavailable'))
  })
})
