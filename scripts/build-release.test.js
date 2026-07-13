'use strict'

const {
  assertBuildTarget,
  createLauncherFiles,
  createReleaseManifest,
  getHostTarget,
  selectProjectFiles,
} = require('./build-release')

describe('runtime release builder', () => {
  test.each([
    ['win32', 'x64', 'win-x64'],
    ['linux', 'arm64', 'linux-arm64'],
    ['darwin', 'x64', 'macos-x64'],
  ])('maps %s %s to %s', (platform, arch, expected) => {
    expect(getHostTarget(platform, arch)).toBe(expected)
  })

  test('allows the Windows ARM package to use the Node 18 x64 compatibility runtime', () => {
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
  })

  test('records the exact application and Node runtime versions', () => {
    expect(
      createReleaseManifest({
        appVersion: '4.0.0-alpha.1',
        nodeVersion: 'v18.20.8',
        target: 'win-arm64',
        runtimeArch: 'x64',
      }),
    ).toEqual(
      expect.objectContaining({
        appVersion: '4.0.0-alpha.1',
        nodeVersion: 'v18.20.8',
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
