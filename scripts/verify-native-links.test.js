'use strict'

const path = require('node:path')
const {auditNativeLinks, parseLdd, parseOtool} = require('./verify-native-links')

const root = path.resolve('/native-links-fixture')
const addon = path.join(root, 'node_modules', 'canvas', 'canvas.node')
const executable = path.join(root, 'runtime', 'node')
function fixture(files = [addon], links = {}) {
  const nodes = new Map()
  function directory(file) {
    if (nodes.has(file)) return
    nodes.set(file, 'directory')
    const parent = path.dirname(file)
    if (parent !== file) directory(parent)
  }
  directory(root)
  for (const file of files) { directory(path.dirname(file)); nodes.set(file, 'file') }
  for (const [file, target] of Object.entries(links)) { directory(path.dirname(file)); nodes.set(file, {target}) }
  function realpath(file) {
    if (!nodes.has(file)) throw Object.assign(new Error('not found'), {code: 'ENOENT'})
    return typeof nodes.get(file) === 'object' ? realpath(nodes.get(file).target) : file
  }
  const stat = kind => ({isDirectory: () => kind === 'directory', isFile: () => kind === 'file'})
  const fileSystem = {
    existsSync: file => { try { realpath(file); return true } catch { return false } },
    realpathSync: realpath,
    statSync: file => stat(nodes.get(realpath(file))),
    readdirSync: file => [...nodes].filter(([name]) => name !== file && path.dirname(name) === file)
      .map(([name, kind]) => ({name: path.basename(name), ...stat(kind), isSymbolicLink: () => typeof kind === 'object'})),
  }
  return fileSystem
}
const metadata = platform => JSON.stringify({node: 'v26.13.0', abi: '147', napi: '10', arch: 'arm64', platform})
function linux(files, output, links) {
  const fileSystem = fixture(files, links)
  const execFileSync = jest.fn((tool) => tool === executable ? metadata('linux') : output)
  return {result: auditNativeLinks({root, platform: 'linux', execFileSync, fileSystem}), execFileSync}
}
function mac(files, libraries, commands, links) {
  const fileSystem = fixture(files, links)
  const execFileSync = jest.fn((tool, args) => tool === executable ? metadata('darwin') :
    (args[0] === '-L' ? libraries(args[1]) : commands(args[1])))
  return {result: auditNativeLinks({root, platform: 'darwin', execFileSync, fileSystem}), execFileSync}
}

test('Windows explicitly reports notApplicable without scanning or executing tools', () => {
  const execFileSync = jest.fn()
  const result = auditNativeLinks({root, platform: 'win32', execFileSync, fileSystem: {}})
  expect(result).toMatchObject({platform: 'win32', status: 'notApplicable', dependencies: [], missing: [], requiresExternalLibraries: false})
  expect(execFileSync).not.toHaveBeenCalled()
})

test('Linux separates bundled, base system, external graphics and missing dependencies', () => {
  const bundled = path.join(root, 'lib', 'libbundled.so')
  const external = '/usr/lib/aarch64-linux-gnu/libpango-1.0.so.0'
  const libc = '/lib/aarch64-linux-gnu/libc.so.6'
  const {result, execFileSync} = linux([addon, bundled, external, libc], `
linux-vdso.so.1 (0x123)
libbundled.so => ${bundled} (0x456)
libpango-1.0.so.0 => ${external} (0x789)
libc.so.6 => ${libc} (0x111)
libmissing.so => not found
`)
  expect(result.dependencies.map(entry => entry.pathClass)).toEqual(['system', 'bundled', 'external', 'system', 'missing'])
  expect(result.dependencies.every(entry => entry.source === addon)).toBe(true)
  expect(result.requiresExternalLibraries).toBe(true)
  expect(result.missing).toEqual([{source: addon, reference: 'libmissing.so', resolved: null, pathClass: 'missing'}])
  expect(execFileSync).toHaveBeenCalledWith('ldd', ['-v', addon], expect.objectContaining({shell: false, timeout: 10000,
    stdio: ['ignore', 'pipe', 'pipe']}))
})

test('Linux symbol versions belong to the inspected binary, not the host libraries', () => {
  const source = '/package/canvas.node'
  const parsed = parseLdd(`libc.so.6 => /lib/libc.so.6 (0x1)
Version information:
${source}:
 libc.so.6 (GLIBC_2.28) => /lib/libc.so.6
 libstdc++.so.6 (GLIBCXX_3.4.29) => /lib/libstdc++.so.6
/lib/libc.so.6:
 ld-linux.so.2 (GLIBC_2.39) => /lib/ld-linux.so.2
`, source)
  expect(parsed.references).toHaveLength(1)
  expect(parsed.requiredSymbolVersions).toEqual(['GLIBCXX_3.4.29', 'GLIBC_2.28'])
})

test('runtime ABI comes from the bundled Node, without claiming an addon ABI', () => {
  const {result} = linux([addon, executable], 'linux-vdso.so.1 (0x1)')
  expect(result.runtime).toMatchObject({source: executable, abi: '147', node: 'v26.13.0', arch: 'arm64'})
  expect(result.binaries.find(binary => binary.source === addon).addonAbi).toBe('notInspected')
  expect(result.binaries.find(binary => binary.source === addon).minOS).toBeNull()
})

test('tool failures preserve partial missing evidence and never print raw stderr or errors', () => {
  const execFileSync = jest.fn(() => {
    throw Object.assign(new Error('private payload sentinel'), {status: 1,
      stdout: 'libabsent.so => not found\n', stderr: 'private credential sentinel'})
  })
  const result = auditNativeLinks({root, platform: 'linux', execFileSync, fileSystem: fixture()})
  expect(result.status).toBe('partial')
  expect(result.missing).toHaveLength(1)
  expect(result.requiresExternalLibraries).toBe(true)
  expect(JSON.stringify(result)).not.toMatch(/private payload|private credential/)
})

test('unavailable ldd is partial, not a closure-passed verdict', () => {
  const result = auditNativeLinks({root, platform: 'linux', fileSystem: fixture(),
    execFileSync: () => { throw Object.assign(new Error(), {code: 'ENOENT'}) }})
  expect(result.status).toBe('partial')
  expect(result.diagnostics[0]).toMatchObject({tool: 'ldd', code: 'TOOL_FAILED'})
})

test('empty successful tool output is not treated as an audited binary', () => {
  const {result} = linux([addon], '')
  expect(result.status).toBe('partial')
  expect(result.diagnostics[0].code).toBe('NO_DEPENDENCY_DATA')
})

test('statically linked ELF is represented explicitly', () => {
  const {result} = linux([addon], 'statically linked')
  expect(result.status).toBe('audited')
  expect(result.binaries[0].staticallyLinked).toBe(true)
})

test('macOS resolves loader paths and keeps Homebrew external without mislabeling dyld cache libraries missing', () => {
  const bundled = path.join(path.dirname(addon), 'libcanvas.dylib')
  const external = '/opt/homebrew/opt/cairo/lib/libcairo.2.dylib'
  const {result} = mac([addon, bundled, external], () => `${addon}:
 @loader_path/libcanvas.dylib (compatibility version 1.0.0, current version 1.0.0)
 ${external} (compatibility version 2.0.0, current version 2.0.0)
 /usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1.0.0)
`, () => 'Load command 1\n cmd LC_BUILD_VERSION\n minos 13.0\n sdk 15.0\n')
  expect(result.dependencies.map(entry => entry.pathClass)).toEqual(['bundled', 'external', 'system'])
  expect(result.binaries[0].minOS).toEqual([{version: '13.0', sdk: '15.0', architecture: null, command: 'LC_BUILD_VERSION'}])
  expect(result.requiresExternalLibraries).toBe(true)
  expect(result.scope).toBe('otool-direct')
})

test('macOS resolves @rpath using inherited runtime paths and executable-relative paths', () => {
  const library = path.join(root, 'runtime', 'lib', 'libshared.dylib')
  const {result} = mac([addon, executable, library], file => file === addon ? `${addon}:
 @rpath/libshared.dylib (compatibility version 1.0.0, current version 1.0.0)
 @executable_path/lib/libshared.dylib (compatibility version 1.0.0, current version 1.0.0)
` : `${executable}:\n /usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1.0.0)`,
  file => file === executable ? 'Load command 0\n cmd LC_RPATH\n path @executable_path/lib (offset 12)' : '')
  expect(result.dependencies.filter(entry => entry.source === addon).map(entry => entry.resolved)).toEqual([library, library])
  expect(result.requiresExternalLibraries).toBe(false)
})

test('unresolved @rpath remains missing instead of guessing a Homebrew or runner path', () => {
  const {result} = mac([addon], () => `${addon}:\n @rpath/absent.dylib (compatibility version 1.0.0, current version 1.0.0)`, () => '')
  expect(result.missing[0]).toMatchObject({reference: '@rpath/absent.dylib', resolved: null})
  expect(result.requiresExternalLibraries).toBe(true)
})

test('fat Mach-O minimum OS metadata keeps the two architectures separate', () => {
  const parsed = parseOtool('', `fat (architecture x86_64):
Load command 1
 cmd LC_VERSION_MIN_MACOSX
 version 10.15
 sdk 12.0
fat (architecture arm64):
Load command 1
 cmd LC_BUILD_VERSION
 minos 11.0
 sdk 15.0
`)
  expect(parsed.minOS.map(entry => [entry.architecture, entry.version])).toEqual([['x86_64', '10.15'], ['arm64', '11.0']])
})

test('a bundled-looking symlink escaping root is external and is not inspected', () => {
  const outside = path.resolve('/outside/liboutside.node')
  const {result, execFileSync} = linux([outside], '', {[addon]: outside})
  expect(result.dependencies[0]).toMatchObject({source: addon, resolved: outside, pathClass: 'external'})
  expect(result.status).toBe('partial')
  expect(result.requiresExternalLibraries).toBe(true)
  expect(execFileSync).not.toHaveBeenCalled()
})

test('dependency symlinks are classified by their real path rather than root prefix', () => {
  const outside = path.resolve('/outside/liboutside.so')
  const link = path.join(root, 'lib', 'libalias.so')
  const {result} = linux([addon, outside], `libalias.so => ${link} (0x1)`, {[link]: outside})
  expect(result.dependencies.some(entry => entry.reference === 'libalias.so' && entry.pathClass === 'external' && entry.resolved === outside)).toBe(true)
})

test('empty roots and unsupported platforms do not fabricate runtime ABI or dependencies', () => {
  const result = auditNativeLinks({root, platform: 'linux', execFileSync: jest.fn(), fileSystem: fixture([])})
  expect(result).toMatchObject({status: 'audited', dependencies: [], runtime: null, binaries: []})
})

test('a neighboring root-prefix directory is external, not bundled', () => {
  const outside = path.join(root + '-other', 'liboutside.so')
  const {result} = linux([addon, outside], `liboutside.so => ${outside} (0x1)`)
  expect(result.dependencies[0].pathClass).toBe('external')
})

test('system-only references need no external library, without claiming platform portability', () => {
  const libc = '/usr/lib/x86_64-linux-gnu/libc.so.6'
  const loader = '/lib64/ld-linux-x86-64.so.2'
  const {result} = linux([addon, libc, loader], `libc.so.6 => ${libc} (0x1)\n${loader} (0x2)`)
  expect(result.requiresExternalLibraries).toBe(false)
  expect(result.dependencies.map(entry => entry.pathClass)).toEqual(['system', 'system'])
  expect(result).not.toHaveProperty('closurePassed')
})

test('invalid bundled Node metadata is partial and is not replaced by host ABI', () => {
  const execFileSync = jest.fn(tool => tool === executable ? '{"node":"secret diagnostic sentinel"}' : 'linux-vdso.so.1 (0x1)')
  const result = auditNativeLinks({root, platform: 'linux', execFileSync, fileSystem: fixture([executable])})
  expect(result).toMatchObject({status: 'partial', runtime: null})
  expect(result.diagnostics[0].code).toBe('INVALID_RUNTIME_METADATA')
  expect(JSON.stringify(result)).not.toContain('secret diagnostic sentinel')
})

test('timeouts are recorded without raw command errors', () => {
  const result = auditNativeLinks({root, platform: 'darwin', fileSystem: fixture(),
    execFileSync: () => { throw Object.assign(new Error('private error sentinel'), {code: 'ETIMEDOUT'}) }})
  expect(result.status).toBe('partial')
  expect(result.diagnostics.some(entry => entry.code === 'TOOL_TIMEOUT')).toBe(true)
  expect(JSON.stringify(result)).not.toContain('private error sentinel')
})

test('unrelated file symlinks are outside the native-library scan scope', () => {
  const outside = path.resolve('/outside/tool.js')
  const link = path.join(root, 'node_modules', '.bin', 'tool')
  const {result, execFileSync} = linux([outside], '', {[link]: outside})
  expect(result.dependencies).toEqual([])
  expect(execFileSync).not.toHaveBeenCalled()
})

test.each([addon, executable])('broken native/runtime link %s remains explicit missing evidence', file => {
  const {result, execFileSync} = linux([], '', {[file]: '/absent/target'})
  expect(result).toMatchObject({status: 'partial', requiresExternalLibraries: true})
  expect(result.missing[0]).toMatchObject({source: file, resolved: null, pathClass: 'missing'})
  expect(execFileSync).not.toHaveBeenCalled()
})

test('an unavailable root yields a partial JSON report rather than a guessed success', () => {
  const execFileSync = jest.fn()
  const result = auditNativeLinks({root, platform: 'linux', execFileSync,
    fileSystem: {realpathSync() { throw new Error('private root sentinel') }}})
  expect(result.status).toBe('partial')
  expect(result.diagnostics[0].code).toBe('ROOT_UNAVAILABLE')
  expect(JSON.stringify(result)).not.toContain('private root sentinel')
  expect(execFileSync).not.toHaveBeenCalled()
})
