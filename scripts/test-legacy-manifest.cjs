const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const esbuild = require('esbuild')
async function main() {
  const code = esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '../electron/services/legacyWeliveManifest.ts')],
    bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require, Buffer })
  const { readLegacyRawManifest } = module.exports
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-legacy-'))
  try {
    const root = path.join(temporary, 'exports')
    fs.mkdirSync(root)
    const file = path.join(root, 'session.jsonl')
    const content = JSON.stringify({ message_content: '中文\u2028连续消息', media_type: 'image', media_error: 'missing' }) + '\r\n\n' + JSON.stringify({ message_content: 'second' })
    fs.writeFileSync(file, content)
    const manifest = await readLegacyRawManifest(file, root)
    assert.equal(manifest.rows, 2)
    assert.equal(manifest.bytes, Buffer.byteLength(content))
    assert.equal(manifest.images_failed, 1)
    fs.appendFileSync(file, '\n{"truncated":')
    await assert.rejects(readLegacyRawManifest(file, root))
    const outside = path.join(temporary, 'outside.jsonl')
    fs.writeFileSync(outside, '{}')
    await assert.rejects(readLegacyRawManifest(outside, root))
    console.log('Legacy manifest: Unicode, CRLF, last line, byte/row/media counts, truncated data and output boundary checks passed.')
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
