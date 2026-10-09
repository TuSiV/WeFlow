const crypto = require('node:crypto')

// Independently checked against the pinned DLL disassembly. Only these two
// date branches are changed; branch targets and instruction lengths stay fixed.
// Reference: Dinnerb0ne2/WeFlow-WCDB-Patch, DETAILS.md (CC BY-NC-SA 4.0).
const originalSha256 = '6397760da70de8062829fbe6a2ec01cf0616d6f2b334e6fe54873898f38f7ad7'
const patchedSha256 = '1536606b1b1b2a0dc9de631a7f45504f5d466de0979e50b3f94548ae124993d0'
const edits = [
  { offset: 0x80dc5, before: '7e0a', after: 'eb0a' },
  { offset: 0xe85d7, before: '0f8e30010000', after: 'e93101000090' }
]
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex')

function applyDateCompatibility(data) {
  if (sha256(data) === patchedSha256) return Buffer.from(data)
  if (sha256(data) !== originalSha256) throw new Error('Unsupported WCDB DLL: original SHA-256 mismatch')
  const output = Buffer.from(data)
  for (const edit of edits) {
    const before = Buffer.from(edit.before, 'hex')
    if (!output.subarray(edit.offset, edit.offset + before.length).equals(before)) {
      throw new Error('WCDB date branch signature mismatch')
    }
    Buffer.from(edit.after, 'hex').copy(output, edit.offset)
  }
  if (sha256(output) !== patchedSha256) throw new Error('WCDB compatibility output SHA-256 mismatch')
  return output
}

module.exports = { applyDateCompatibility, originalSha256, patchedSha256, edits }
