const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { selectFiles, verify } = require('./install-native-components.cjs')
assert.equal(process.platform, 'darwin')
assert.equal(process.arch, 'arm64')
const resources = path.resolve('release/mac-arm64/WeFlow.app/Contents/Resources')
for (const file of selectFiles('darwin-arm64')) verify(fs.readFileSync(path.join(resources, file.path)), file)
assert(!fs.existsSync(path.join(resources, 'resources/welive')), 'Do not distribute untested WeLive engine')
const asar = require('@electron/asar')
for (const file of ['dist-electron/main.js', 'dist-electron/exportWorker.js']) {
  assert.deepEqual(asar.extractFile(path.join(resources, 'app.asar'), file), fs.readFileSync(file), `Shipped code differs: ${file}`)
}
// Re-run the real Electron runtime checks against native resources copied into the .app.
execFileSync(process.execPath, ['scripts/check-native-macos.cjs'], {
  stdio: 'inherit', env: { ...process.env, WEFLOW_NATIVE_RESOURCES: resources }
})
console.log('Packaged macOS native resources, shipped code identity and packaged-resource export checks passed.')
