const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { applyDateCompatibility, originalSha256, patchedSha256, edits } = require('./welive-date-compat.cjs')
const { verify } = require('./install-native-components.cjs')
const file = require('../shared/native-components.json').files.find(file => file.transform === 'welive-date-compat-v1')
const patched = fs.readFileSync(path.resolve(__dirname, '..', file.path))
verify(patched, file)
assert.equal(crypto.createHash('sha256').update(patched).digest('hex'), patchedSha256)
const original = Buffer.from(patched)
for (const edit of edits) Buffer.from(edit.before, 'hex').copy(original, edit.offset)
assert.equal(crypto.createHash('sha256').update(original).digest('hex'), originalSha256)
verify(original, { ...file, gitBlobSha: file.sourceGitBlobSha })
assert.throws(() => verify(original, file), /Integrity mismatch/)
assert.deepEqual(applyDateCompatibility(original), patched)
assert.deepEqual(applyDateCompatibility(patched), patched)
const tampered = Buffer.from(original)
tampered[100] ^= 1
assert.throws(() => applyDateCompatibility(tampered), /SHA-256 mismatch/)
assert.throws(() => applyDateCompatibility(Buffer.alloc(0)), /SHA-256 mismatch/)
for (let index = 0; index < original.length; index++) {
  if (original[index] !== patched[index]) {
    assert(edits.some(edit => index >= edit.offset && index < edit.offset + edit.before.length / 2))
  }
}
assert.equal(patched.subarray(0xf2489, 0xf248f).toString('hex'), '0f8e94130000', 'Clock-validity branch must remain unchanged')
console.log('WeLive exact output hash, six-byte expiry branch change, preserved clock-validity check and tamper rejection passed.')
