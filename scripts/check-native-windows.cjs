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
  if (initCode !== 0) {
    try {
      const output = [null]
      wcdb.func('int32 wcdb_get_logs(_Out_ void **outJson)')(output)
      if (output[0]) {
        console.error('WCDB diagnostics:', koffi.decode(output[0], 'char', -1))
        wcdb.func('void wcdb_free_string(void *ptr)')(output[0])
      }
    } catch (error) { console.error('No WCDB diagnostic log:', String(error)) }
  }
  assert.equal(initCode, 0, `WCDB initialization failed (${initCode})`)
  shutdown()
  console.log('WCDB date compatibility: initialization passed.')
  const key = koffi.load(path.join(root, 'resources/key/win32/x64/wx_key.dll'))
  key.func('bool InitializeHook(uint32 pid)')
  key.func('bool PollKeyData(_Out_ char *keyBuffer, int bufferSize)')
  key.func('bool GetImageKey(_Out_ char *resultBuffer, int bufferSize)')
  // Bind only: do not attach to or restart any process in CI.
  const addon = require(path.join(root, 'resources/wedecrypt/win32/x64/weflow-image-native-win32-x64.node'))
  assert.equal(typeof addon.decryptDatNative, 'function')
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-native-'))
  try {
    const fixture = require('./fixtures/windows-wcdb.json')
    const accountDir = path.join(temporary, 'synthetic_me')
    for (const file of fixture.files) {
      const data = Buffer.from(file.base64, 'base64')
      assert.equal(require('node:crypto').createHash('sha256').update(data).digest('hex'), file.sha256)
      const destination = path.join(accountDir, file.path)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.writeFileSync(destination, data)
    }
    const { Module } = require('node:module')
    const coreModule = new Module(__filename, module)
    coreModule.paths = module.paths
    coreModule._compile(require('esbuild').buildSync({
      entryPoints: [path.join(root, 'electron/services/wcdbCore.ts')],
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false
    }).outputFiles[0].text, __filename)
    const core = new coreModule.exports.WcdbCore()
    core.setPaths(root, temporary)
    core.setLibPath(path.join(root, 'resources/wcdb/win32/x64/wcdb_api.dll'))
    assert.equal(await core.initialize(), true, coreModule.exports.getLastDllInitError())
    try {
      assert.equal(await core.open(accountDir, fixture.dbKey), true, coreModule.exports.getLastDllInitError())
      const sessions = await core.getSessions()
      console.log('Synthetic sessions:', JSON.stringify(sessions))
      assert.equal(sessions.success, true)
      assert(JSON.stringify(sessions.sessions).includes(fixture.sessionId))
      const messages = await core.getMessages(fixture.sessionId, 10, 0)
      console.log('Synthetic messages:', JSON.stringify(messages))
      assert.equal(messages.success, true)
      assert(JSON.stringify(messages).includes(fixture.message))
    } finally { core.close() }
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
    console.log('WeLive missing DB diagnostic:', JSON.stringify({ status: result.status, stdout: result.stdout, stderr: result.stderr }))
    const events = result.stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    assert(events.some(event => event.type === 'result' && event.success === false) ||
      (result.status === 1 && /session\.db|sessionDb|accountDir|not found|does not exist/i.test(result.stderr)),
    'WeLive must explicitly reject a missing synthetic database without crashing')
    const exportRequest = {
      account: { sessionDb: path.join(accountDir, 'db_storage/session/session.db'), dbKey: fixture.dbKey,
        accountDir, myAccountId: 'synthetic_me' },
      sessionIds: [fixture.sessionId], outputDir: path.join(temporary, 'successful-export'),
      format: 'raw-jsonl', parseContent: false, preserveMessageContent: true
    }
    const exported = spawnSync(path.join(root, 'resources/welive/win32/x64/welive.exe'), ['weflow-export'], {
      input: JSON.stringify(exportRequest) + '\n', encoding: 'utf8', timeout: 30000, windowsHide: true,
      cwd: temporary, maxBuffer: 1024 * 1024
    })
    assert.ifError(exported.error)
    console.log('Synthetic WeLive export:', JSON.stringify({ status: exported.status, stdout: exported.stdout, stderr: exported.stderr }))
    assert.equal(exported.status, 0)
    const exportEvents = exported.stdout.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    const done = exportEvents.find(event => event.type === 'result')
    assert(done && done.success === true && done.fail_count === 0)
    const outputPaths = Object.values(done.raw_session_output_paths || done.session_output_paths || {})
    assert(outputPaths.some(file => fs.readFileSync(file, 'utf8').includes(fixture.message)))
    console.log('Native application binding, encrypted session/message reads, image decrypt and successful synthetic JSONL export passed.')
    console.log('Real-account key acquisition and real-account chat export are not tested by this check.')
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
if (!process.versions.electron) {
  // Use the application's actual host/ABI, rather than plain node.exe.
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  const child = spawnSync(require('electron'), [__filename], {
    env: environment, stdio: 'inherit', timeout: 60000
  })
  if (child.error) console.error(child.error)
  process.exitCode = child.status ?? 1
} else {
  const { app } = require('electron')
  app.whenReady().then(main).then(() => app.exit(0)).catch(error => {
    console.error(error)
    app.exit(1)
  })
}
