'use strict'

const fs = require('fs')
const path = require('path')
const {spawnSync} = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const rootFiles = ['index.js', 'plugin_dependencies.js', 'plugin_tester.js']
const sourceDirs = ['config', 'migrations', 'plugins', 'scripts', 'src']
const checkTargets = [
  ...rootFiles.map((file) => path.join(rootDir, file)),
  ...sourceDirs.flatMap((dir) => findJsFiles(path.join(rootDir, dir))),
].sort()
let failed = false

for (const file of checkTargets) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: rootDir,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    failed = true
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`)
  }
}

if (failed) {
  process.exit(1)
}

console.log(`Syntax check passed for ${checkTargets.length} files.`)

function findJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return []
  }

  return fs
    .readdirSync(dir, {withFileTypes: true})
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return findJsFiles(fullPath)
      }
      return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : []
    })
    .sort()
}
