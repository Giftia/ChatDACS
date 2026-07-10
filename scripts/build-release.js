'use strict'

const fs = require('fs')
const path = require('path')
const {execFileSync} = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const releaseDir = path.join(rootDir, '.release')
const platformNames = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'win',
}

function getHostTarget(platform = process.platform, arch = process.arch) {
  const platformName = platformNames[platform]
  if (!platformName || !['x64', 'arm64'].includes(arch)) {
    throw new Error(`不支持的发布主机: ${platform}-${arch}`)
  }
  return `${platformName}-${arch}`
}

function assertNativeTarget(target, host = {platform: process.platform, arch: process.arch}) {
  const hostTarget = getHostTarget(host.platform, host.arch)
  if (target !== hostTarget) {
    throw new Error(`发布包必须在目标架构的原生 runner 上构建: target=${target}, host=${hostTarget}`)
  }
}

function createLauncherFiles(target) {
  if (target.startsWith('win-')) {
    return [
      {
        name: 'ChatDACS.cmd',
        mode: 0o755,
        content: [
          '@echo off',
          'setlocal',
          'cd /d "%~dp0"',
          '"%~dp0runtime\\node.exe" "%~dp0index.js" %*',
          '',
        ].join('\r\n'),
      },
    ]
  }

  return [
    {
      name: 'chatdacs',
      mode: 0o755,
      content: [
        '#!/bin/sh',
        'set -eu',
        'SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
        'exec "$SCRIPT_DIR/runtime/node" "$SCRIPT_DIR/index.js" "$@"',
        '',
      ].join('\n'),
    },
  ]
}

function createReleaseManifest({appVersion, nodeVersion, target, createdAt = new Date().toISOString()}) {
  return {
    product: 'ChatDACS',
    appVersion,
    nodeVersion,
    target,
    createdAt,
    entrypoint: target.startsWith('win-') ? 'ChatDACS.cmd' : 'chatdacs',
    runtime: target.startsWith('win-') ? 'runtime/node.exe' : 'runtime/node',
  }
}

async function buildRelease({target = process.env.RELEASE_TARGET ?? getHostTarget()} = {}) {
  assertNativeTarget(target)

  const packageJson = require(path.join(rootDir, 'package.json'))
  const expectedNodeVersion = `v${packageJson.engines.node}`
  if (process.version !== expectedNodeVersion) {
    throw new Error(`发布运行时必须是 ${expectedNodeVersion}，当前为 ${process.version}`)
  }

  const releaseName = `ChatDACS-v${packageJson.version}_${target}`
  const stageDir = path.join(releaseDir, 'stage', releaseName)
  const outputFile = path.join(releaseDir, `${releaseName}.zip`)

  resetDirectory(stageDir)
  copyReleaseContents(stageDir)
  copyRuntime(stageDir, target)

  for (const launcher of createLauncherFiles(target)) {
    const launcherPath = path.join(stageDir, launcher.name)
    fs.writeFileSync(launcherPath, launcher.content, {encoding: 'utf8', mode: launcher.mode})
    fs.chmodSync(launcherPath, launcher.mode)
  }

  const manifest = createReleaseManifest({
    appVersion: packageJson.version,
    nodeVersion: process.version,
    target,
  })
  fs.writeFileSync(path.join(stageDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  verifyReleaseLayout(stageDir, manifest)
  await createZip(stageDir, outputFile)

  const result = {
    ok: true,
    target,
    nodeVersion: process.version,
    stageDir,
    outputFile,
    bytes: fs.statSync(outputFile).size,
  }
  console.log(JSON.stringify(result, null, 2))
  return result
}

function resetDirectory(directory) {
  const resolved = path.resolve(directory)
  const allowedRoot = `${path.resolve(releaseDir)}${path.sep}`
  if (!resolved.startsWith(allowedRoot)) {
    throw new Error(`拒绝清理发布目录之外的路径: ${resolved}`)
  }
  fs.rmSync(resolved, {recursive: true, force: true})
  fs.mkdirSync(resolved, {recursive: true})
}

function copyReleaseContents(stageDir) {
  const projectFiles = selectProjectFiles(listRepositoryFiles())
  for (const relativePath of projectFiles) {
    const destination = path.join(stageDir, relativePath)
    fs.mkdirSync(path.dirname(destination), {recursive: true})
    if (relativePath === 'config/db.db') {
      copyCommittedDatabase(destination)
    } else {
      fs.copyFileSync(path.join(rootDir, relativePath), destination)
    }
  }

  copyDirectory(path.join(rootDir, 'node_modules'), path.join(stageDir, 'node_modules'))
}

function listRepositoryFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
}

function selectProjectFiles(files) {
  const directories = ['config/', 'migrations/', 'plugins/', 'src/', 'static/']
  const rootFiles = new Set([
    'CONTEXT.md',
    'LICENSE',
    'README.md',
    'UPGRADE.md',
    'index.js',
    'package-lock.json',
    'package.json',
    'plugin_dependencies.js',
    'plugin_tester.js',
  ])

  return files
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => !file.endsWith('.test.js') && !file.includes('/__tests__/'))
    .filter((file) => rootFiles.has(file) || directories.some((directory) => file.startsWith(directory)))
    .sort()
}

function copyCommittedDatabase(destination) {
  const database = execFileSync('git', ['show', 'HEAD:config/db.db'], {
    cwd: rootDir,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
  fs.writeFileSync(destination, database)
}

function copyDirectory(source, destination) {
  fs.cpSync(source, destination, {recursive: true})
}

function copyRuntime(stageDir, target) {
  const runtimeDir = path.join(stageDir, 'runtime')
  const runtimeName = target.startsWith('win-') ? 'node.exe' : 'node'
  fs.mkdirSync(runtimeDir, {recursive: true})
  fs.copyFileSync(process.execPath, path.join(runtimeDir, runtimeName))
  fs.chmodSync(path.join(runtimeDir, runtimeName), 0o755)
}

function verifyReleaseLayout(stageDir, manifest) {
  const required = [
    'config',
    'migrations',
    'node_modules',
    'plugins',
    'src',
    'static',
    'index.js',
    'package.json',
    'release-manifest.json',
    manifest.entrypoint,
    manifest.runtime,
  ]
  const missing = required.filter((entry) => !fs.existsSync(path.join(stageDir, entry)))
  if (missing.length > 0) {
    throw new Error(`发布包缺少必要文件: ${missing.join(', ')}`)
  }
}

async function createZip(stageDir, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), {recursive: true})
  fs.rmSync(outputFile, {force: true})

  const archiver = loadArchiver()
  const output = fs.createWriteStream(outputFile)
  const archive = archiver('zip', {zlib: {level: 9}})
  const completed = new Promise((resolve, reject) => {
    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
  })

  archive.pipe(output)
  archive.directory(stageDir, false)
  await archive.finalize()
  await completed
}

function loadArchiver() {
  if (process.env.ARCHIVER_MODULE_PATH) {
    return require(process.env.ARCHIVER_MODULE_PATH)
  }
  try {
    return require('archiver')
  } catch (error) {
    throw new Error('缺少发布构建依赖 archiver，请先运行 npm install', {cause: error})
  }
}

if (require.main === module) {
  buildRelease().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = {
  assertNativeTarget,
  buildRelease,
  createLauncherFiles,
  createReleaseManifest,
  getHostTarget,
  selectProjectFiles,
}
