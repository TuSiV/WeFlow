const crypto = require('node:crypto')
// Only the two fixed September 2026 date branches in the pinned arm64 library.
// Process identity checks and encrypted database authentication are unchanged.
const originalSha256 = '9917b74e6723efea63ac64927c9f6be1ed53133a62ff2c694c68d647690cead1'
const edits = [
  { offset:0x6d5c, before:'8d000054', after:'04000014', target:0x6d6c },
  { offset:0x6ec8, before:'8d060054', after:'34000014', target:0x6f98 }
]
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex') }
function repairAdHocCodeHashes(data) {
  // This exact source has one linker-generated ad-hoc SHA-256 CodeDirectory.
  // Refresh only the hashes of the pages containing the changed instructions.
  const signature = 1490992, directory = 1491012
  if (data.readUInt32BE(signature) !== 0xfade0cc0 || data.readUInt32BE(signature + 8) !== 1
    || data.readUInt32BE(directory) !== 0xfade0c02 || data.readUInt32BE(directory + 12) !== 0x20002
    || data.readUInt32BE(directory + 16) !== 106 || data.readUInt32BE(directory + 28) !== 365
    || data.readUInt32BE(directory + 32) !== signature || data[directory + 36] !== 32
    || data[directory + 37] !== 2 || data[directory + 39] !== 12) throw new Error('Unexpected Mac ad-hoc signature layout')
  for (const page of new Set(edits.map(edit => Math.floor(edit.offset / 4096)))) {
    const digest = crypto.createHash('sha256').update(data.subarray(page * 4096, Math.min((page + 1) * 4096, signature))).digest()
    digest.copy(data, directory + 106 + page * 32)
  }
}
function applyDateCompatibility(data) {
  if (sha256(data) === patchedSha256) return Buffer.from(data)
  if (sha256(data) !== originalSha256) throw new Error('Mac WCDB source SHA-256 mismatch')
  const output = Buffer.from(data)
  for (const edit of edits) {
    if (!output.subarray(edit.offset, edit.offset + 4).equals(Buffer.from(edit.before, 'hex'))) throw new Error('Mac date branch signature mismatch')
    Buffer.from(edit.after, 'hex').copy(output, edit.offset)
  }
  repairAdHocCodeHashes(output)
  if (sha256(output) !== patchedSha256) throw new Error('Mac compatibility output SHA-256 mismatch')
  return output
}
const patchedSha256 = '5085c303134bd4b56220fe641d7785df5b3c4eeed705b1cec2e4ebeaee4469e7'
module.exports = { applyDateCompatibility, originalSha256, patchedSha256, edits, repairAdHocCodeHashes }
