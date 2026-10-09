const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const esbuild = require('esbuild')
const manifest = require('../shared/native-components.json')
const { selectFiles } = require('./install-native-components.cjs')
const root = path.resolve(__dirname, '..')
const code = esbuild.buildSync({
  entryPoints: [path.join(root, 'electron/services/bundledNativeComponents.ts')],
  bundle: true, platform: 'node', format: 'cjs', write: false
}).outputFiles[0].text
function resolver(resourcesPath, platform = 'win32', dirname = path.join(root, 'electron/services')) {
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require,
    __dirname: dirname, process: { platform, arch: 'x64', resourcesPath } })
  return module.exports.resolveBundledComponentPath
}
const keys = Object.keys(manifest.platforms['win32-x64'])
const development = resolver(path.join(root, 'node_modules/electron/dist'))
for (const key of keys) assert.equal(development(key), manifest.runtimeBlocks?.['win32-x64']?.[key]
  ? null : path.join(root, manifest.platforms['win32-x64'][key]))
assert.equal(resolver(undefined, 'linux')('wcdbLibPath'), null)
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-bundle-test-'))
try {
  for (const file of selectFiles('win32-x64')) {
    const destination = path.join(temporary, file.path)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(root, file.path), destination)
  }
  const packaged = resolver(temporary, 'win32', path.join(temporary, 'app.asar/dist-electron'))
  for (const key of keys) assert.equal(packaged(key), manifest.runtimeBlocks?.['win32-x64']?.[key]
    ? null : path.join(temporary, manifest.platforms['win32-x64'][key]))
  fs.appendFileSync(path.join(temporary, 'resources/wcdb/win32/x64/WCDB.dll'), 'tampered')
  assert.equal(packaged('wcdbLibPath'), null, 'Reject a modified database dependency before loading')
  fs.rmSync(path.join(temporary, 'resources/key/win32/x64/wx_key.dll'))
  assert.equal(packaged('keyDllPath'), null, 'Missing bundle must not resolve')
  console.log('Development/packaged resolution, unsupported platform, tampered dependency and missing component checks passed.')
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
