'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {execFileSync: defaultExecFileSync} = require('node:child_process')

const RUNTIME_METADATA = 'JSON.stringify({node:process.version,abi:process.versions.modules,napi:process.versions.napi,arch:process.arch,platform:process.platform})'
const LINUX_BASE_LIBRARY = /^(?:ld-(?:linux[^/]*|musl[^/]*)\.so(?:\.\d+)*|lib(?:c|m|dl|pthread|rt|resolv|util|anl|gcc_s|stdc\+\+)\.so(?:\.\d+)*)$/
const inside = (root, file) => {
  const relative = path.relative(root, file)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function parseLdd(output, source) {
  const [links, versions = ''] = output.split(/\n\s*Version information:\s*\n/)
  const references = []
  for (const line of links.split(/\r?\n/)) {
    const text = line.trim()
    const mapped = text.match(/^(.*?)\s+=>\s+(.*)$/)
    if (mapped) {
      const resolved = mapped[2].replace(/\s+\(0x[\da-f]+\)\s*$/i, '').trim()
      references.push({reference: mapped[1], resolved: resolved === 'not found' ? null : resolved})
    } else if (/^linux-(?:vdso|gate)\b/.test(text)) {
      references.push({reference: text.split(/\s+/)[0], resolved: null, virtual: true})
    } else if (text.startsWith('/')) {
      const resolved = text.replace(/\s+\(0x[\da-f]+\)\s*$/i, '').trim()
      references.push({reference: resolved, resolved})
    }
  }
  let owner = null
  const requiredSymbolVersions = new Set()
  for (const line of versions.split(/\r?\n/)) {
    const header = line.match(/^\s*(\/.*):\s*$/)
    if (header) owner = header[1]
    else if (owner === source) {
      for (const match of line.matchAll(/\b(?:GLIBC|GLIBCXX|CXXABI)_[\d.]+\b/g)) requiredSymbolVersions.add(match[0])
    }
  }
  return {references, requiredSymbolVersions: [...requiredSymbolVersions].sort(), staticallyLinked: /statically linked/i.test(links)}
}

function parseOtool(libraries, commands) {
  const references = []
  let architecture = null
  for (const line of libraries.split(/\r?\n/)) {
    const arch = line.match(/\(architecture ([^)]+)\):$/)
    if (arch) architecture = arch[1]
    const entry = line.trim().match(/^(.*?)\s+\(compatibility version /)
    if (entry) references.push({reference: entry[1], architecture})
  }
  const rpaths = []
  const minOS = []
  let command = null
  let minimum = null
  architecture = null
  function finish() { if (minimum) minOS.push(minimum); minimum = null }
  for (const line of commands.split(/\r?\n/)) {
    const text = line.trim()
    const arch = text.match(/\(architecture ([^)]+)\):$/)
    if (arch) { finish(); architecture = arch[1]; command = null }
    if (/^Load command /.test(text)) { finish(); command = null }
    if (text.startsWith('cmd ')) command = text.slice(4)
    if (command === 'LC_RPATH') {
      const entry = text.match(/^path (.*?) \(offset \d+\)$/)
      if (entry) rpaths.push({path: entry[1], architecture})
    }
    if (['LC_BUILD_VERSION', 'LC_VERSION_MIN_MACOSX'].includes(command)) {
      const entry = text.match(/^(?:minos|version) ([\d.]+)$/)
      if (entry) minimum = {version: entry[1], sdk: null, architecture, command}
      const sdk = text.match(/^sdk ([\d.]+)$/)
      if (sdk && minimum) minimum.sdk = sdk[1]
    }
  }
  finish()
  return {references, rpaths, minOS}
}

// Only run on trusted npm/tool artifacts: ldd can invoke an ELF interpreter.
function auditNativeLinks({root = process.cwd(), platform = process.platform,
  execFileSync = defaultExecFileSync, fileSystem = fs} = {}) {
  root = path.resolve(root)
  const report = {platform, dependencies: [], requiresExternalLibraries: false, missing: [],
    status: 'audited', root, scope: platform === 'linux' ? 'ldd-transitive' : 'otool-direct',
    binaries: [], runtime: null, hostRuntime: {node: process.version, abi: process.versions.modules,
      arch: process.arch, platform: process.platform}, diagnostics: []}
  if (!['linux', 'darwin'].includes(platform)) {
    report.status = 'notApplicable'
    report.scope = 'notApplicable'
    return report
  }
  const diagnostic = (source, tool, code, status = null) => {
    report.diagnostics.push({source, tool, code, status})
    report.status = 'partial'
  }
  const env = {...process.env, LC_ALL: 'C', LANG: 'C'}
  for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'NODE_COMPILE_CACHE', 'NODE_V8_COVERAGE', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES']) delete env[key]
  function run(tool, args, source) {
    try {
      return {output: String(execFileSync(tool, args, {encoding: 'utf8', timeout: 10000,
        maxBuffer: 4 * 1024 * 1024, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env})), ok: true}
    } catch (error) {
      diagnostic(source, tool === source ? 'node' : tool, error?.code === 'ETIMEDOUT' ? 'TOOL_TIMEOUT' : 'TOOL_FAILED',
        Number.isInteger(error?.status) ? error.status : null)
      return {output: error?.stdout ? String(error.stdout) : '', ok: false}
    }
  }
  let canonicalRoot
  try { canonicalRoot = fileSystem.realpathSync(root) } catch {
    diagnostic(root, 'filesystem', 'ROOT_UNAVAILABLE')
    return report
  }
  function systemLibrary(file) {
    const unix = file.replaceAll('\\', '/')
    if (platform === 'darwin') return unix.startsWith('/usr/lib/') || unix.startsWith('/System/Library/')
    return /^\/(?:usr\/)?lib(?:32|64)?\//.test(unix) && LINUX_BASE_LIBRARY.test(path.posix.basename(unix))
  }
  function dependency(source, reference, resolved, {virtual = false, architecture = null} = {}) {
    let pathClass = 'missing'
    if (virtual) pathClass = 'system'
    else if (resolved) {
      // Mach-O system libraries may exist only in the dyld shared cache.
      if (platform === 'darwin' && systemLibrary(resolved)) pathClass = 'system'
      else if (fileSystem.existsSync(resolved)) {
        try { resolved = fileSystem.realpathSync(resolved) } catch { /* Keep the tool's resolved path. */ }
        pathClass = inside(canonicalRoot, resolved) ? 'bundled' : systemLibrary(resolved) ? 'system' : 'external'
      }
    }
    const entry = {source, reference, resolved, pathClass}
    if (architecture) entry.architecture = architecture
    report.dependencies.push(entry)
  }
  const sources = []
  const executable = path.join(root, 'runtime', 'node')
  const visited = new Set()
  function scan(directory) {
    const real = fileSystem.realpathSync(directory)
    if (visited.has(real)) return
    visited.add(real)
    const entries = fileSystem.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.name === '.git') continue
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        let stat
        try { stat = fileSystem.statSync(file) } catch {
          if (entry.name.endsWith('.node') || file === executable) {
            dependency(file, file, null)
            diagnostic(file, 'filesystem', 'BROKEN_SYMLINK')
          }
          continue
        }
        if (!stat.isDirectory() && !entry.name.endsWith('.node')) continue
        let target
        try { target = fileSystem.realpathSync(file) } catch {
          diagnostic(file, 'filesystem', 'BROKEN_SYMLINK')
          continue
        }
        if (!inside(canonicalRoot, target)) {
          dependency(file, file, target)
          diagnostic(file, 'filesystem', 'SYMLINK_OUTSIDE_ROOT')
          continue
        }
        if (stat.isDirectory()) scan(file)
        else if (entry.name.endsWith('.node')) sources.push(file)
      } else if (entry.isDirectory()) scan(file)
      else if (entry.isFile() && entry.name.endsWith('.node')) sources.push(file)
    }
  }
  try { scan(root) } catch { diagnostic(root, 'filesystem', 'SCAN_FAILED') }
  if (fileSystem.existsSync(executable)) {
    try {
      const actual = fileSystem.realpathSync(executable)
      if (inside(canonicalRoot, actual)) sources.unshift(executable)
      else { dependency(executable, executable, actual); diagnostic(executable, 'filesystem', 'RUNTIME_OUTSIDE_ROOT') }
    } catch { diagnostic(executable, 'filesystem', 'RUNTIME_UNAVAILABLE') }
  }
  const macCache = new Map()
  function macInfo(source) {
    if (!macCache.has(source)) {
      const libraries = run('otool', ['-L', source], source)
      const commands = run('otool', ['-l', source], source)
      macCache.set(source, parseOtool(libraries.output, commands.output))
    }
    return macCache.get(source)
  }
  function expand(token, loader) {
    if (token === '@loader_path' || token.startsWith('@loader_path/')) return path.resolve(path.dirname(loader), token.slice(12).replace(/^\//, ''))
    if (token === '@executable_path' || token.startsWith('@executable_path/')) return path.resolve(path.dirname(executable), token.slice(16).replace(/^\//, ''))
    return token.startsWith('/') ? token : null
  }
  for (const source of sources) {
    const binary = {source, kind: source === executable ? 'runtime' : 'addon', minOS: null,
      requiredSymbolVersions: [], addonAbi: source === executable ? null : 'notInspected'}
    report.binaries.push(binary)
    if (platform === 'linux') {
      const result = run('ldd', ['-v', source], source)
      const parsed = parseLdd(result.output, source)
      binary.requiredSymbolVersions = parsed.requiredSymbolVersions
      binary.staticallyLinked = parsed.staticallyLinked
      if (result.ok && !parsed.references.length && !parsed.staticallyLinked) diagnostic(source, 'ldd', 'NO_DEPENDENCY_DATA')
      for (const entry of parsed.references) dependency(source, entry.reference, entry.resolved, entry)
    } else {
      const parsed = macInfo(source)
      binary.minOS = parsed.minOS
      binary.rpaths = parsed.rpaths
      if (!parsed.references.length) diagnostic(source, 'otool', 'NO_DEPENDENCY_DATA')
      for (const entry of parsed.references) {
        let resolved = expand(entry.reference, source)
        if (entry.reference.startsWith('@rpath/')) {
          const inherited = source !== executable && sources.includes(executable) ? macInfo(executable).rpaths : []
          const candidates = [...parsed.rpaths.map(item => ({...item, loader: source})),
            ...inherited.map(item => ({...item, loader: executable}))]
            .filter(item => !item.architecture || !entry.architecture || item.architecture === entry.architecture)
            .map(item => { const base = expand(item.path, item.loader); return base && path.join(base, entry.reference.slice(7)) })
            .filter(Boolean)
          resolved = candidates.find(file => systemLibrary(file) || fileSystem.existsSync(file)) || null
        }
        dependency(source, entry.reference, resolved, entry)
      }
    }
    if (source === executable) {
      const result = run(source, ['-p', RUNTIME_METADATA], source)
      if (result.ok) {
        try {
          const metadata = JSON.parse(result.output)
          if (![metadata.node, metadata.abi, metadata.arch, metadata.platform].every(value => typeof value === 'string') || metadata.platform !== platform) throw new Error()
          report.runtime = {source, node: metadata.node, abi: metadata.abi, napi: metadata.napi ?? null,
            arch: metadata.arch, platform: metadata.platform}
        } catch { diagnostic(source, 'node', 'INVALID_RUNTIME_METADATA') }
      }
    }
  }
  report.missing = report.dependencies.filter(entry => entry.pathClass === 'missing')
  report.requiresExternalLibraries = report.dependencies.some(entry => ['external', 'missing'].includes(entry.pathClass))
  return report
}

if (require.main === module) {
  const report = auditNativeLinks()
  console.log(JSON.stringify(report, null, 2))
}

module.exports = {auditNativeLinks, parseLdd, parseOtool}
