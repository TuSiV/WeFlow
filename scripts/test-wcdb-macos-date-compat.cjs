const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { applyDateCompatibility, originalSha256, patchedSha256, edits, repairAdHocCodeHashes } = require('./wcdb-macos-date-compat.cjs')
const { verify } = require('./install-native-components.cjs')
const manifest = require('../shared/native-components.json')
const file = manifest.files.find(file => file.transform === 'wcdb-macos-date-compat-v1')
const patched = fs.readFileSync(file.path)
const hash = data => crypto.createHash('sha256').update(data).digest('hex')
verify(patched, file)
assert.equal(hash(patched), patchedSha256)
const original = Buffer.from(patched)
for (const edit of edits) Buffer.from(edit.before,'hex').copy(original,edit.offset)
repairAdHocCodeHashes(original)
assert.equal(hash(original), originalSha256)
verify(original,{...file,gitBlobSha:file.sourceGitBlobSha})
assert.deepEqual(applyDateCompatibility(original),patched)
assert.deepEqual(applyDateCompatibility(patched),patched)
const signExtend = (value,bits) => (value << (32-bits)) >> (32-bits)
for (const edit of edits) {
  const before = original.readUInt32LE(edit.offset), after = patched.readUInt32LE(edit.offset)
  assert.equal(before & 15,13, 'Original condition is signed less-than-or-equal')
  assert.equal(before >>> 24,0x54)
  assert.equal(after >>> 26,0x05, 'New instruction is an unconditional B')
  assert.equal(edit.offset + signExtend((before >>> 5) & 0x7ffff,19)*4,edit.target)
  assert.equal(edit.offset + signExtend(after & 0x3ffffff,26)*4,edit.target)
}
const directory=1491012,signature=1490992
for(let page=0;page<365;page++) {
  const expected=crypto.createHash('sha256').update(patched.subarray(page*4096,Math.min((page+1)*4096,signature))).digest()
  assert.deepEqual(patched.subarray(directory+106+page*32,directory+106+(page+1)*32),expected,'Every ad-hoc code page hash must match')
}
for(let index=0;index<original.length;index++) if(original[index]!==patched[index]) {
  assert(edits.some(e=>index>=e.offset&&index<e.offset+4) || (index>=directory+106+6*32&&index<directory+106+7*32),'Changes are restricted to two date branches and their page hash')
}
const tampered=Buffer.from(original);tampered[100]^=1
assert.throws(()=>applyDateCompatibility(tampered),/SHA-256 mismatch/)
assert.throws(()=>applyDateCompatibility(Buffer.alloc(0)),/SHA-256 mismatch/)
console.log('Mac date compatibility: exact hashes, unchanged branch targets, all ad-hoc code hashes, bounded changes and tamper rejection passed.')
