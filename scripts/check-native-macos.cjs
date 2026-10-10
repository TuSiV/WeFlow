const assert = require('node:assert/strict')
assert.equal(process.platform, 'darwin')
assert.equal(process.arch, 'arm64')
require('./check-native-desktop.cjs')
