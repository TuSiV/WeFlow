const crypto = require('node:crypto')

// The pinned executable compares GetSystemTimePreciseAsFileTime with a fixed
// expiry, then branches to the "this build has expired" exit path.
// Remove only that six-byte branch; keep the clock-validity check and CLI.
const originalSha256 = '1c73c5cf710468f6bc400f5eb4680e1eeab149dabdba83852f493f4c5ef07bcf'
const patchedSha256 = '62a472e7564b95f5c992db6e7e94d637ba64fd8d6696517191106b49ca9f5e33'
const edits = [{ offset: 0xf249c, before: '0f8dac130000', after: '909090909090' }]
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex')

function applyDateCompatibility(data) {
  if (sha256(data) === patchedSha256) return Buffer.from(data)
  if (sha256(data) !== originalSha256) throw new Error('Unsupported WeLive executable: original SHA-256 mismatch')
  const output = Buffer.from(data)
  for (const edit of edits) {
    const before = Buffer.from(edit.before, 'hex')
    if (!output.subarray(edit.offset, edit.offset + before.length).equals(before)) {
      throw new Error('WeLive date branch signature mismatch')
    }
    Buffer.from(edit.after, 'hex').copy(output, edit.offset)
  }
  if (sha256(output) !== patchedSha256) throw new Error('WeLive compatibility output SHA-256 mismatch')
  return output
}

module.exports = { applyDateCompatibility, originalSha256, patchedSha256, edits }
