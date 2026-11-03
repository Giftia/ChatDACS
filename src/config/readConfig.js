'use strict'

const fs = require('fs')
const yaml = require('yaml')

function readConfig(filePath, {readFile = fs.readFile, parse = yaml.parse} = {}) {
  return new Promise((resolve, reject) => {
    const fail = (code) => reject(Object.assign(new Error(code), {code}))
    try {
      readFile(filePath, 'utf8', (error, data) => {
        if (error) return fail('CONFIG_READ_FAILED')
        try {
          const config = parse(data)
          if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return fail('CONFIG_INVALID')
          }
          resolve(config)
        } catch {
          fail('CONFIG_INVALID')
        }
      })
    } catch {
      fail('CONFIG_READ_FAILED')
    }
  })
}

module.exports = {readConfig}
