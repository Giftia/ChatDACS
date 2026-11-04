'use strict'

const {
  assertBuildTarget,
  copyProjectFile,
  copyDirectory,
  createLauncherFiles,
  createReleaseManifest,
  getHostTarget,
  selectProjectFiles,
  verifyReleaseLayout,
} = require('./build-release')

describe('runtime release builder', () => {
  test.each([
    ['linux-x64', ['plugins/go-cqhttp/go-cqhttp']],
    ['linux-arm64', []],
    ['win-x64', ['plugins/go-cqhttp/go-cqhttp.bat', 'plugins/go-cqhttp/go-cqhttp_windows_amd64.exe']],
    ['win-arm64', ['plugins/go-cqhttp/go-cqhttp.bat', 'plugins/go-cqhttp/go-cqhttp_windows_amd64.exe']],
    ['macos-x64', []],
    ['macos-arm64', []],
  ])('%s only bundles compatible legacy go-cqhttp binaries', (target, expected) => {
    const files = ['plugins/go-cqhttp/go-cqhttp', 'plugins/go-cqhttp/go-cqhttp.bat',
      'plugins/go-cqhttp/go-cqhttp_windows_amd64.exe', 'src/platforms/oneBotHttp.js']
    expect(selectProjectFiles(files, target)).toEqual([...expected, 'src/platforms/oneBotHttp.js'].sort())
  })

  test.each(['README.md', 'LICENSE'])('layout requires %s in addition to existing runtime contents', (missing) => {
    const fs = require('fs')
    const path = require('path')
    const manifest = {runtime: 'runtime/node', entrypoint: 'chatdacs'}
    const exists = jest.spyOn(fs, 'existsSync').mockImplementation((entry) => entry !== path.join('mock-stage', missing))
    try {
      expect(() => verifyReleaseLayout('mock-stage', manifest)).toThrow(missing)
      expect(exists).toHaveBeenCalledWith(path.join('mock-stage', 'README.md'))
      expect(exists).toHaveBeenCalledWith(path.join('mock-stage', 'LICENSE'))
    } finally { exists.mockRestore() }
  })

  test('directory copy preserves symlink text without dereferencing dependencies', () => {
    const fs = require('fs')
    const copy = jest.spyOn(fs, 'cpSync').mockImplementation(() => {})
    try {
      copyDirectory('fixture-source', 'fixture-destination')
      expect(copy).toHaveBeenCalledWith('fixture-source', 'fixture-destination', {recursive: true, verbatimSymlinks: true})
    } finally { copy.mockRestore() }
  })

  test('copied dependency symlinks stay relative and resolve inside the moved bundle', () => {
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-release-symlink-'))
    try {
      const source = path.join(directory, 'source')
      const destination = path.join(directory, 'bundle')
      fs.mkdirSync(path.join(source, '.bin'), {recursive: true})
      fs.mkdirSync(path.join(source, 'fixture-package'))
      fs.writeFileSync(path.join(source, 'fixture-package', 'cli.js'), 'mock fixture', 'utf8')
      try {
        fs.symlinkSync('../fixture-package/cli.js', path.join(source, '.bin', 'fixture-cli'), 'file')
      } catch (error) {
        if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) throw error
        const copy = jest.spyOn(fs, 'cpSync').mockImplementation(() => {})
        try {
          copyDirectory(source, destination)
          expect(copy).toHaveBeenCalledWith(source, destination, {recursive: true, verbatimSymlinks: true})
        } finally { copy.mockRestore() }
        return
      }
      copyDirectory(source, destination)
      const relocated = path.join(directory, 'relocated')
      fs.renameSync(destination, relocated)
      const link = path.join(relocated, '.bin', 'fixture-cli')
      expect(fs.readlinkSync(link).replaceAll('\\', '/')).toBe('../fixture-package/cli.js')
      expect(fs.realpathSync(link)).toBe(fs.realpathSync(path.join(relocated, 'fixture-package', 'cli.js')))
    } finally { fs.rmSync(directory, {recursive: true, force: true}) }
  })

  test.each(['linux-x64', 'linux-arm64', 'win-x64', 'win-arm64', 'macos-x64', 'macos-arm64'])(
    'explicitly excludes private QQ integration documents from %s regardless of Git tracking', (target) => {
      const privateFiles = ['CHECKPOINT.md', 'PLATFORM-QUERY.md', 'AUTH-COMPATIBILITY.md'].flatMap((name) => [
        `integrations/qq-official/${name}`,
        `integrations/qq-official/${name.toLowerCase()}`,
        `INTEGRATIONS/QQ-OFFICIAL/${name.toLowerCase()}`,
        `integrations\\qq-official\\${name}`,
        `InTeGrAtIoNs\\Qq-OfFiCiAl\\${name.toLowerCase()}`,
      ])
      const publicFiles = ['integrations/qq-official/README.md', 'integrations/qq-official/DESIGN.md',
        'integrations/qq-official/readme.MD', 'integrations/qq-official/Design.md',
        'integrations/qq-official-other/CHECKPOINT.md', 'src/new-source.js']
      const files = [...privateFiles, ...publicFiles]
      expect(selectProjectFiles(files, target)).toEqual([...publicFiles].sort())
      expect(selectProjectFiles(files, target, {trackedFiles: files})).toEqual([...publicFiles].sort())
      expect(selectProjectFiles(['integrations\\qq-official\\README.md', 'integrations\\qq-official\\DESIGN.md'], target))
        .toEqual(['integrations/qq-official/DESIGN.md', 'integrations/qq-official/README.md'])
    },
  )

  test.each(['config/config.yml', 'config/db.db'])('copies the HEAD baseline for %s without reading or changing the local file', (file) => {
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-release-copy-'))
    try {
      fs.mkdirSync(path.join(directory, 'config'))
      const local = Buffer.from('fake private local state')
      const baseline = Buffer.from([0, 1, 2, 255])
      fs.writeFileSync(path.join(directory, file), local)
      const readBaseline = jest.fn(() => baseline)
      const copy = jest.spyOn(fs, 'copyFileSync')
      try {
        copyProjectFile(file, path.join(directory, 'output'), {sourceRoot: directory, readBaseline})
        expect(copy).not.toHaveBeenCalled()
        expect(readBaseline).toHaveBeenCalledWith(file)
        expect(fs.readFileSync(path.join(directory, 'output'))).toEqual(baseline)
        expect(fs.readFileSync(path.join(directory, file))).toEqual(local)
      } finally { copy.mockRestore() }
    } finally { fs.rmSync(directory, {recursive: true, force: true}) }
  })

  test('only tracked persona files may enter a release, while other new source remains eligible', () => {
    const files = ['plugins/persona/shipped.json', 'plugins/persona/user.json',
      'plugins/persona/nested/user.json', 'src/new-module.js']
    expect(selectProjectFiles(files, 'win-x64')).toEqual(['src/new-module.js'])
    expect(selectProjectFiles(files, 'win-x64', {trackedFiles: ['plugins/persona/shipped.json']}))
      .toEqual(['plugins/persona/shipped.json', 'src/new-module.js'])
  })

  test.each(['linux-x64', 'linux-arm64', 'win-x64', 'win-arm64', 'macos-x64', 'macos-arm64'])(
    'only tracked uploads enter %s releases without excluding ordinary static source', (target) => {
      const files = ['static/uploads/.gitkeep', 'static/uploads/shipped.png',
        'static/uploads/private.png', 'static/uploads/nested/private.js',
        'static/app.js', 'static/uploads-other/public.png']
      expect(selectProjectFiles(files, target)).toEqual(['static/app.js', 'static/uploads-other/public.png'])
      expect(selectProjectFiles(files, target, {trackedFiles: ['static\\uploads\\.gitkeep', 'static/uploads/shipped.png']}))
        .toEqual(['static/app.js', 'static/uploads-other/public.png', 'static/uploads/.gitkeep', 'static/uploads/shipped.png'])
    },
  )

  test('bundles OneBot, NapCat, binding and startup scripts with their current local dependencies', () => {
    const fs = require('fs')
    const path = require('path')
    const scripts = ['scripts/bind-qq-official.js', 'scripts/check-onebot.js', 'scripts/generate-onebot-config.js',
      'scripts/check-napcat.js', 'scripts/generate-napcat-config.js', 'scripts/verify-startup.js']
    const dependencies = ['src/bots/qq/oneBotProvider.js', 'src/bots/qq/napcat.js',
      'src/bots/qqOfficial/credentials.js', 'src/config/runtimeConfig.js', 'src/platforms/oneBotHttp.js']
    const files = scripts.concat(dependencies)
    expect(selectProjectFiles(files, 'win-x64')).toEqual([...files].sort())
    for (const script of scripts) {
      const source = fs.readFileSync(path.join(__dirname, '..', script), 'utf8')
      for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
        const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(script), match[1])) + '.js'
        expect(selectProjectFiles([dependency], 'win-x64')).toContain(dependency)
      }
    }
  })

  test('includes binding CLI and excludes local bot credentials from bundles', () => {
    expect(selectProjectFiles([
      'scripts/bind-qq-official.js', 'config/qq-official.credentials.json',
      'config/other.credentials.json', 'config/llm.credentials.json', 'config/qq-official.credentials.json.x.tmp',
      'config/llm-persona-state.json', 'config/llm-persona-state.json.test.tmp',
      'config/llm-model-state.json', 'config/llm-model-state.json.test.tmp',
    ], 'win-x64')).toEqual(['scripts/bind-qq-official.js'])
  })
  test('Docker build context excludes local LLM state and private personas', () => {
    const fs = require('fs')
    const path = require('path')
    const patterns = fs.readFileSync(path.join(__dirname, '../.dockerignore'), 'utf8').split(/\r?\n/).map((line) => line.trim())
    expect(patterns).toEqual(expect.arrayContaining(['plugins/persona', '**/llm-persona-state.json', '**/llm-persona-state.json.*.tmp',
      '**/llm-model-state.json', '**/llm-model-state.json.*.tmp']))
  })
  test.each([
    ['win32', 'x64', 'win-x64'],
    ['linux', 'arm64', 'linux-arm64'],
    ['darwin', 'x64', 'macos-x64'],
  ])('maps %s %s to %s', (platform, arch, expected) => {
    expect(getHostTarget(platform, arch)).toBe(expected)
  })

  test('allows the Windows ARM package to use an x64 compatibility runtime for native modules', () => {
    expect(() => assertBuildTarget('win-arm64', {platform: 'win32', arch: 'x64'})).not.toThrow()
  })

  test('rejects unsupported cross-target packaging so native dependencies cannot be mislabeled', () => {
    expect(() => assertBuildTarget('linux-arm64', {platform: 'linux', arch: 'x64'})).toThrow(
      '运行时架构与发布目标不兼容',
    )
  })

  test('creates platform launchers that use the bundled runtime', () => {
    const windows = createLauncherFiles('win-x64')
    const linux = createLauncherFiles('linux-x64')

    expect(windows).toEqual([
      expect.objectContaining({name: 'ChatDACS.cmd', content: expect.stringContaining('runtime\\node.exe')}),
    ])
    expect(linux).toEqual([
      expect.objectContaining({name: 'chatdacs', mode: 0o755, content: expect.stringContaining('runtime/node')}),
    ])
    expect(linux[0].content).toContain('cd "$SCRIPT_DIR"\nexec ')
  })

  test('records the exact application and Node runtime versions', () => {
    expect(
      createReleaseManifest({
        appVersion: '4.0.0-alpha.1',
        nodeVersion: 'v26.13.0',
        target: 'win-arm64',
        runtimeArch: 'x64',
      }),
    ).toEqual(
      expect.objectContaining({
        appVersion: '4.0.0-alpha.1',
        nodeVersion: 'v26.13.0',
        target: 'win-arm64',
        runtimeArch: 'x64',
        compatibility: 'x64-emulation',
        entrypoint: 'ChatDACS.cmd',
      }),
    )
  })

  test('selects product files without tests or unrelated workspace output', () => {
    expect(
      selectProjectFiles([
        'README.md',
        'integrations/napcat/README.md',
        'integrations/napcat/onebot11.json.example',
        'plugins/go-cqhttp/go-cqhttp',
        'plugins/go-cqhttp/go-cqhttp.bat',
        'plugins/go-cqhttp/go-cqhttp_windows_amd64.exe',
        'src/server.js',
        'src/server.test.js',
        'static/index.html',
        'tmp/package-smoke/package.json',
      ], 'linux-x64'),
    ).toEqual([
      'README.md',
      'integrations/napcat/README.md',
      'integrations/napcat/onebot11.json.example',
      'plugins/go-cqhttp/go-cqhttp',
      'src/server.js',
      'static/index.html',
    ])
  })
})
