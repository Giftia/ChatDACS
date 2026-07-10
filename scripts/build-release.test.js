'use strict'

const {
  assertNativeTarget,
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

  test('rejects cross-target packaging so native dependencies cannot be mislabeled', () => {
    expect(() => assertNativeTarget('win-arm64', {platform: 'win32', arch: 'x64'})).toThrow(
      '必须在目标架构的原生 runner 上构建',
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
      createReleaseManifest({appVersion: '4.0.0-alpha.1', nodeVersion: 'v18.20.8', target: 'win-x64'}),
    ).toEqual(
      expect.objectContaining({
        appVersion: '4.0.0-alpha.1',
        nodeVersion: 'v18.20.8',
        target: 'win-x64',
        entrypoint: 'ChatDACS.cmd',
      }),
    )
  })

  test('selects product files without tests or unrelated workspace output', () => {
    expect(
      selectProjectFiles([
        'README.md',
        'src/server.js',
        'src/server.test.js',
        'static/index.html',
        'tmp/package-smoke/package.json',
      ]),
    ).toEqual(['README.md', 'src/server.js', 'static/index.html'])
  })
})
