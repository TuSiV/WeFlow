const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { install } = require('./install-native-components.cjs')

async function main() {
  assert.equal(process.platform, 'win32', 'Native runtime checks require Windows')
  assert.equal(process.arch, 'x64', 'This bundle supports Windows x64')
  await install('win32-x64', true)
  const root = path.resolve(__dirname, '..')
  const koffi = require('koffi')
  const wcdb = koffi.load(path.join(root, 'resources/wcdb/win32/x64/wcdb_api.dll'))
  const init = wcdb.func('int32 wcdb_init()')
  const shutdown = wcdb.func('int32 wcdb_shutdown()')
  const initCode = init()
  assert.equal(initCode, 0, `WCDB initialization failed (${initCode})`)
  shutdown()
  const key = koffi.load(path.join(root, 'resources/key/win32/x64/wx_key.dll'))
  key.func('bool InitializeHook(uint32 pid)')
  key.func('bool PollKeyData(_Out_ char *keyBuffer, int bufferSize)')
  key.func('bool GetImageKey(_Out_ char *resultBuffer, int bufferSize)')
  // Bind only: do not attach to or restart any process in CI.
  const addon = require(path.join(root, 'resources/wedecrypt/win32/x64/weflow-image-native-win32-x64.node'))
  assert.equal(typeof addon.decryptDatNative, 'function')
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-native-'))
  try {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex')
    const dat = path.join(temporary, 'fixture.dat')
    fs.writeFileSync(dat, png.map(value => value ^ 0x66))
    assert.deepEqual(addon.decryptDatNative(dat, 0x66).data, png)
    const request = {
      account: { sessionDb: path.join(temporary, 'missing', 'session.db'), dbKey: '00'.repeat(32) },
      sessionIds: ['synthetic-test'], outputDir: path.join(temporary, 'output')
    }
    const result = spawnSync(path.join(root, 'resources/welive/win32/x64/welive.exe'), ['weflow-export'], {
      input: JSON.stringify(request) + '\n', encoding: 'utf8', timeout: 30000, windowsHide: true,
      cwd: temporary, maxBuffer: 1024 * 1024
    })
    assert.ifError(result.error)
    const events = result.stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    assert(events.some(event => event.type === 'result' && event.success === false),
      'WeLive must report a structured failed result for a missing synthetic database')
    console.log('Native load, synthetic image decrypt and WeLive failure protocol checks passed.')
    console.log('Real-account key acquisition and successful chat export are not tested by this check.')
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
