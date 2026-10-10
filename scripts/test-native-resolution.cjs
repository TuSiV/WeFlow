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
const target = process.platform === 'darwin' ? 'darwin-arm64' : 'win32-x64'
const [testPlatform, testArch] = target.split('-')
function resolver(resourcesPath, platform = testPlatform, dirname = path.join(root, 'electron/services'), arch = testArch) {
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require,
    __dirname: dirname, process: { platform, arch, resourcesPath } })
  return module.exports.resolveBundledComponentPath
}
const keys = Object.keys(manifest.platforms[target])
const development = resolver(path.join(root, 'node_modules/electron/dist'))
for (const key of keys) assert.equal(development(key), manifest.runtimeBlocks?.[target]?.[key]
  ? null : path.join(root, manifest.platforms[target][key]))
assert.equal(resolver(undefined, 'linux')('wcdbLibPath'), null)
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-bundle-test-'))
try {
  for (const file of selectFiles(target)) {
    const destination = path.join(temporary, file.path)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(root, file.path), destination)
  }
  const packaged = resolver(temporary, testPlatform, path.join(temporary, 'app.asar/dist-electron'))
  for (const key of keys) assert.equal(packaged(key), manifest.runtimeBlocks?.[target]?.[key]
    ? null : path.join(temporary, manifest.platforms[target][key]))
  const dependency = selectFiles(target).find(file => /(?:WCDB.dll|libWCDB.dylib)$/.test(file.path))
  fs.appendFileSync(path.join(temporary, dependency.path), 'tampered')
  assert.equal(packaged('wcdbLibPath'), null, 'Reject a modified database dependency before loading')
  fs.rmSync(path.join(temporary, manifest.platforms[target].imageNativeAddonPath))
  assert.equal(packaged('imageNativeAddonPath'), null, 'Missing bundle must not resolve')
  assert.equal(resolver(temporary, 'darwin', path.join(temporary,'app.asar'), 'x64')('wcdbLibPath'), null, 'Intel Mac has no verified bundle')
  console.log('Development/packaged resolution, unsupported platform, tampered dependency and missing component checks passed.')
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
