const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { install } = require('./install-native-components.cjs')

async function main() {
  const target = `${process.platform}-${process.arch}`
  assert(['win32-x64', 'darwin-arm64'].includes(target), `Unsupported native test host: ${target}`)
  const paths = require('../shared/native-components.json').platforms[target]
  await install(target, true)
  const root = path.resolve(__dirname, '..')
  const nativeRoot = process.env.WEFLOW_NATIVE_RESOURCES || root
  const koffi = require('koffi')
  if (process.platform === 'darwin') koffi.load(path.join(nativeRoot, 'resources/wcdb/macos/universal/libWCDB.dylib'))
  const wcdb = koffi.load(path.join(nativeRoot, paths.wcdbLibPath))
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
  console.log(`WCDB native initialization passed on ${process.platform}-${process.arch}.`)
  if (paths.keyDllPath) {
  const key = koffi.load(path.join(nativeRoot, paths.keyDllPath))
  key.func('bool InitializeHook(uint32 pid)')
  key.func('bool PollKeyData(_Out_ char *keyBuffer, int bufferSize)')
  key.func('bool GetImageKey(_Out_ char *resultBuffer, int bufferSize)')
  // Bind only: do not attach to or restart any process in CI.
  }
  const addon = require(path.join(nativeRoot, paths.imageNativeAddonPath))
  assert.equal(typeof addon.decryptDatNative, 'function')
  const temporary = process.env.WEFLOW_NATIVE_TEST_TEMP
  assert(temporary, 'The parent test runner must provide a temporary directory')
  try {
    const fixture = require('./fixtures/windows-wcdb-passphrase.json')
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
    const discoveryModule = new Module(__filename, module)
    discoveryModule.paths = module.paths
    discoveryModule._compile(require('esbuild').buildSync({
      entryPoints: [path.join(root, 'electron/services/accountDiscovery.ts')],
      bundle: true, platform: 'node', format: 'cjs', write: false
    }).outputFiles[0].text, __filename)
    const scan = await discoveryModule.exports.discoverAccounts([temporary])
    assert.equal(scan.accounts.length, 1)
    assert.equal(scan.accounts[0].accountId, 'synthetic_me')
    assert.equal(scan.accounts[0].dbPath, temporary)
    assert.equal(scan.accounts[0].supported, true)
    console.log('Native fixture account discovery passed.')
    let selectedRef
    const core = new coreModule.exports.WcdbCore()
    core.setPaths(root, temporary)
    core.setLibPath(path.join(nativeRoot, paths.wcdbLibPath))
    assert.equal(await core.initialize(), true, coreModule.exports.getLastDllInitError())
    try {
      const opened = await core.open(accountDir, fixture.dbKey)
      if (!opened) {
        const logs = [null]
        wcdb.func('int32 wcdb_get_logs(_Out_ void **outJson)')(logs)
        if (logs[0]) {
          console.error('Fixture open diagnostics:', koffi.decode(logs[0], 'char', -1))
          wcdb.func('void wcdb_free_string(void *ptr)')(logs[0])
        }
      }
      assert.equal(opened, true, coreModule.exports.getLastDllInitError())
      const sessions = await core.getSessions()
      console.log('Synthetic sessions:', JSON.stringify(sessions))
      assert.equal(sessions.success, true)
      assert(JSON.stringify(sessions.sessions).includes(fixture.sessionId))
      const messages = await core.getMessages(fixture.sessionId, 10, 0)
      console.log('Synthetic messages:', JSON.stringify(messages))
      assert.equal(messages.success, true)
      assert(JSON.stringify(messages).includes(fixture.message))
      const row = messages.messages[0]
      selectedRef = {localId:Number(row.local_id),createTime:Number(row.create_time),serverIdRaw:String(row.server_id || '0'),localType:Number(row.local_type)}
    } finally { core.close() }
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex')
    const dat = path.join(temporary, 'fixture.dat')
    fs.writeFileSync(dat, png.map(value => value ^ 0x66))
    assert.deepEqual(addon.decryptDatNative(dat, 0x66).data, png)
    const { Worker } = require('node:worker_threads')
    const outputDir = path.join(temporary, 'successful-export')
    const worker = new Worker(path.join(root, 'dist-electron/exportWorker.js'), {
      env: { ...process.env, WEFLOW_USER_DATA_PATH: path.join(temporary, 'worker-config') },
      workerData: {
        sessionIds: [fixture.sessionId], outputDir, dbPath: temporary, accountDir,
        decryptKey: fixture.dbKey, myAccountId: 'synthetic_me',
        resourcesPath: path.join(nativeRoot, 'resources'), userDataPath: temporary,
        wcdbLibPath: path.join(nativeRoot, paths.wcdbLibPath),
        options: { format: 'html', exportImages: false, exportVoices: false, exportVideos: false,
          exportEmojis: false, exportFiles: false }
      }
    })
    let timeout
    try {
      const exported = await new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Synthetic HTML export timed out')), 30000)
        worker.on('message', message => {
          if (message.type === 'export:result') resolve(message.data)
          if (message.type === 'export:error') reject(new Error(message.error))
        })
        worker.on('error', reject)
        worker.on('exit', code => reject(new Error(`Export worker exited before returning result (${code})`)))
      })
      console.log('Synthetic application HTML export:', JSON.stringify(exported))
      assert.equal(exported.success, true)
      assert.equal(exported.successCount, 1)
      const outputPaths = Object.values(exported.sessionOutputPaths || {})
      assert(outputPaths.some(file => path.extname(file) === '.html' && fs.readFileSync(file, 'utf8').includes(fixture.message)))
    } finally {
      clearTimeout(timeout)
      await worker.terminate()
    }
    await require('./check-chat-export-windows.cjs')(root, temporary, {
      sessionIds:[fixture.sessionId], dbPath:temporary, accountDir, decryptKey:fixture.dbKey, myAccountId:'synthetic_me',
      resourcesPath:path.join(nativeRoot,'resources'), userDataPath:temporary,
      wcdbLibPath:path.join(nativeRoot,paths.wcdbLibPath), expectedText:fixture.message
    }, selectedRef)
    await require('./check-account-chooser-windows.cjs')(root, temporary)
    console.log('Native application binding, encrypted session/message reads, image decrypt and source HTML export passed.')
    console.log('Real-account key acquisition and real-account chat export are not tested by this check.')
  } finally {
    // The parent removes fixtures after this native host exits and releases
    // all database/log handles. Async file cleanup in this host can stall.
    console.log('Native assertions completed; fixture cleanup delegated to parent.')
  }
}
if (!process.versions.electron) {
  // Use the application's actual host/ABI, rather than plain node.exe.
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-native-'))
  environment.WEFLOW_NATIVE_TEST_TEMP = temporary
  const host = process.platform === 'darwin' ? require('./prepare-macos-test-host.cjs')(temporary) : require('electron')
  const child = spawnSync(host, [__filename], {
    env: environment, stdio: 'inherit', timeout: 180000
  })
  if (child.error) console.error(child.error)
  const completionMarker = path.join(temporary, 'all-native-checks-completed.json')
  const allChecksCompleted = child.status === 0 && fs.existsSync(completionMarker)
  process.exitCode = allChecksCompleted ? 0 : (child.status || 1)
  if (!allChecksCompleted) console.error('Native host did not complete all assertions; refusing to accept a premature clean exit.')
  try { fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
  catch (error) { console.warn('Temporary cleanup failed:', String(error)) }
} else {
  const { app } = require('electron')
  // PDF checks close and reopen hidden windows. Keep the test host alive between them.
  app.on('window-all-closed', () => {})
  // This headless test has no application lifecycle to close. Exit the test
  // process directly after its assertions and cleanup, avoiding Electron's
  // GUI shutdown path while native libraries have been loaded.
  app.whenReady().then(main).then(() => {
    fs.writeFileSync(path.join(process.env.WEFLOW_NATIVE_TEST_TEMP, 'all-native-checks-completed.json'), JSON.stringify({ completed: true }))
    console.log('Native test cleanup completed; exiting test host.')
    process.exit(0)
  }).catch(error => {
    console.error(error)
    process.exit(1)
  })
}
