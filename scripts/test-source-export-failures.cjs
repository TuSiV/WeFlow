const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const esbuild = require('esbuild')
const filename = path.resolve(__dirname, '../electron/services/export/core/ExportContext.ts')
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
const klass = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'ExportContext')
const method = klass.members.find(node => node.name?.getText(source) === 'collectMessages')
assert(method, 'Test the actual collection method from the application source')
const code = esbuild.transformSync(`class TestedContext { ${method.getText(source)} }; globalThis.TestedContext = TestedContext`, { loader: 'ts', target: 'node24' }).code

async function check(open, batch, expected, expectedCloses) {
  let closes = 0
  const sandbox = {
    console, normalizeExportDateRange: () => null,
    wcdbService: {
      openMessageCursor: async () => open,
      fetchMessageBatch: async () => batch,
      closeMessageCursor: async () => { closes++ }
    }
  }
  vm.runInNewContext(code, sandbox)
  const context = new sandbox.TestedContext()
  Object.assign(context, {
    collectMessagesFromWeliveRaw: async () => null,
    isFileOnlyMediaFilter: () => false, throwIfStopRequested: () => {},
    resolveFastMediaStreamType: () => null
  })
  await assert.rejects(() => context.collectMessages('synthetic_friend', 'synthetic_me'), expected)
  assert.equal(closes, expectedCloses)
}

(async () => {
  await check({ success: false, error: 'synthetic cursor failure' }, null, /synthetic cursor failure/, 0)
  await check({ success: true, cursor: 1 }, { success: false, error: 'synthetic batch interruption' }, /synthetic batch interruption/, 1)
  await check({ success: true, cursor: 1 }, { success: true }, /有效的行数组/, 1)
  console.log('Source export rejects cursor failure, interrupted reads and malformed batches; open cursors are closed.')
})().catch(error => { console.error(error); process.exitCode = 1 })
