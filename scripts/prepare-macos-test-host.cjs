const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
// Use the shipped application's executable name and bundle identity in native
// tests. The upstream Mac library requires a WeFlow host rather than node/Electron.
// Native libraries remain byte-for-byte unchanged.
module.exports = function(temporary) {
  const electron = require('electron')
  const source = path.resolve(electron, '../../..')
  const bundle = path.join(temporary, 'WeFlow.app')
  fs.cpSync(source, bundle, { recursive: true })
  const macos = path.join(bundle, 'Contents', 'MacOS')
  const executable = path.join(macos, 'WeFlow')
  fs.renameSync(path.join(macos, 'Electron'), executable)
  const info = path.join(bundle, 'Contents', 'Info.plist')
  for (const [key, value] of Object.entries({ CFBundleExecutable:'WeFlow', CFBundleName:'WeFlow', CFBundleIdentifier:'com.WeFlow.app' })) {
    execFileSync('/usr/bin/plutil', ['-replace', key, '-string', value, info])
  }
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio:'inherit' })
  return executable
}
