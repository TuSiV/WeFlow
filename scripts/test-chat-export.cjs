const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Module } = require('node:module')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
function load(source) {
  const compiled = esbuild.buildSync({ entryPoints: [path.join(root, source)], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false }).outputFiles[0].text
  const module = new Module(path.join(root, source), exports)
  module.paths = require('node:module').Module._nodeModulePaths(root)
  module._compile(compiled, path.join(root, source))
  return module.exports
}
const { selectExportMessages } = load('shared/exportSelection.ts')
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
async function buildSyntheticPdfHtml(file, count = 620, selection) {
  // Only WCDB is stubbed. Compile the actual formatter and its parsing/escaping helpers.
  // Use a transformed in-memory entry to replace the database binding only.
  const source = fs.readFileSync(path.join(root, 'electron/services/export/formatters/HtmlFormatter.ts'), 'utf8')
    .replace(/import \{ wcdbService \} from "\.\.\/\.\.\/wcdbService";/, 'const wcdbService = { getContact: async () => ({success:false}) };')
  const module = new Module(__filename, exports)
  module.paths = require('node:module').Module._nodeModulePaths(root)
  module._compile(esbuild.buildSync({ stdin: { contents: source, loader: 'ts', resolveDir: path.join(root, 'electron/services/export/formatters') }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false }).outputFiles[0].text, __filename)
  const rows = Array.from({ length: count }, (_, i) => ({ localId: i + 1, serverIdRaw: String(90000 + i), createTime: 1700000000 + i,
    localType: 1, content: `MESSAGE_${String(i + 1).padStart(4, '0')}_END` + (i === 0 ? ' <script>malicious()</script> 中文内容' : ''), senderUsername: i % 2 ? 'me' : 'friend', isSend: i % 2 }))
  const chosen = selection ? selectExportMessages(rows, selection) : rows
  const context = {
    throwIfStopRequested: () => {}, ensureConnected: async () => ({success:true, cleanedAccountId:'me'}),
    getConfiguredMyAccountId: () => 'me', getContactInfo: async username => ({ displayName: username }),
    createCollectProgressReporter: () => () => {}, collectMessagesForExport: async () => ({ rows:chosen, memberSet:new Map() }),
    createWeliveRawOutputPlaceholder: async () => {}, hydrateEmojiCaptionsForMessages: async () => {}, preloadContacts: async () => {},
    getMediaLayout: () => ({exportMediaEnabled:false, mediaRootDir:path.dirname(file), mediaRelativePrefix:''}), collectMediaMessagesForExport: () => [],
    buildFileOnlyExportFailure: () => null, getMediaDoneFilesCount: () => 0, preloadWeliveRawEmojiMedia: async () => {},
    getExportMeta: () => ({chatlab:{exportedAt:1700000000}}), loadExportHtmlStyles: () => fs.readFileSync(path.join(root, 'electron/services/exportHtml.css'), 'utf8'),
    resolveLogicalOutputPath: value => value, recordCreatedFileBeforeWrite: async () => {},
    getMediaCacheKey: message => String(message.localId), resolveWeliveRawMediaItem: async () => null,
    getMessageTypeName: () => '文本', resolveQuotedReplyDisplayWithNames: async () => null, formatHtmlMessageText: content => content,
    extractHtmlLinkCard: () => null, renderTextWithEmoji: escape, getExportPlatformMessageId: message => message.serverIdRaw,
    getExportReplyToMessageId: () => null, isStopError: () => false, isPauseError: () => false
  }
  const result = await new module.exports.HtmlFormatter(context).export('friend', file, {format:'pdf'}, undefined, undefined)
  assert.equal(result.success, true, result.error)
  const html = fs.readFileSync(file, 'utf8')
  assert.equal((html.match(/data-message-index=/g) || []).length, chosen.length)
  assert(!html.includes('<script>'))
  assert(html.includes('&lt;script&gt;malicious()&lt;/script&gt;') === chosen.some(row => row.localId === 1))
  assert(!html.includes('WEFLOW_DATA') && !html.includes('id="scrollContainer"'))
  return chosen
}
async function main() {
  const rows = [
    {localId:1, createTime:100, localType:1, serverIdRaw:'18446744073709551610', _db_path:'C:/a.db'},
    {localId:2, createTime:100, localType:1, serverIdRaw:'18446744073709551611', _db_path:'C:/a.db'},
    {localId:1, createTime:100, localType:1, serverIdRaw:'18446744073709551612', _db_path:'C:/b.db'},
    {localId:3, createTime:102, localType:1, serverIdRaw:'0'}
  ]
  assert.deepEqual(selectExportMessages(rows, [{localId:3, createTime:102}, {localId:1, createTime:100, dbPath:'C:\\a.db'}]), [rows[0],rows[3]])
  assert.deepEqual(selectExportMessages(rows, [{localId:1, createTime:100, serverIdRaw:'18446744073709551612'}]), [rows[2]])
  assert.throws(() => selectExportMessages(rows, [{localId:1, createTime:100}]), /歧义/)
  assert.throws(() => selectExportMessages(rows, [{localId:1, createTime:100, dbPath:'C:/missing.db'}]), /无法读取/)
  assert.throws(() => selectExportMessages(rows, [{localId:9, createTime:100}]), /无法读取/)
  assert.throws(() => selectExportMessages(rows, []), /至少选择/)
  assert.throws(() => selectExportMessages(rows, [{localId:0, createTime:100}]), /标识无效/)
  // Test the actual collection bridge, including narrowing cursor reads and retaining only exact rows.
  const ts = require('typescript'), vm = require('node:vm')
  const text = fs.readFileSync(path.join(root, 'electron/services/export/core/ExportContext.ts'), 'utf8')
  const parsed = ts.createSourceFile('ExportContext.ts',text,ts.ScriptTarget.Latest,true)
  const klass = parsed.statements.find(node=>ts.isClassDeclaration(node) && node.name.text==='ExportContext')
  const method = klass.members.find(node=>ts.isMethodDeclaration(node) && node.name.getText(parsed)==='collectMessagesForExport')
  const sandbox = {selectExportMessages}
  vm.runInNewContext(esbuild.transformSync(`class Context { ${method.getText(parsed)} }; globalThis.Context = Context`, {loader:'ts',target:'node24'}).code,sandbox)
  const context = new sandbox.Context()
  let args
  context.resolveCollectParams = () => ({mode:'text-fast'})
  context.collectMessages = async (...values) => {args=values;return {rows,memberSet:new Map()}}
  const result = await context.collectMessagesForExport('friend','me',{format:'html',selectedMessages:[{localId:2,createTime:100},{localId:3,createTime:102}],dateRange:{start:1,end:2}})
  assert.deepEqual(result.rows,[rows[1],rows[3]])
  assert.equal(args[2].start,100);assert.equal(args[2].end,102);assert.equal(args[4],'full')
  await assert.rejects(()=>context.collectMessagesForExport('friend','me',{format:'pdf',selectedMessages:[{localId:99,createTime:100}]}),/无法读取/)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-selection-'))
  try {
    const file = path.join(directory, 'long.html')
    await buildSyntheticPdfHtml(file)
    assert(fs.readFileSync(file, 'utf8').includes('MESSAGE_0620_END'))
    const selectedFile = path.join(directory, 'selected.html')
    await buildSyntheticPdfHtml(selectedFile, 620, [{localId:1,createTime:1700000000},{localId:620,createTime:1700000619}])
    const selectedHtml = fs.readFileSync(selectedFile, 'utf8')
    assert(selectedHtml.includes('MESSAGE_0001_END') && selectedHtml.includes('MESSAGE_0620_END'))
    assert(!selectedHtml.includes('MESSAGE_0002_END') && !selectedHtml.includes('MESSAGE_0619_END'))
    console.log('Exact selection: same timestamps, database collisions, 64-bit IDs, missing/deleted messages and empty selections checked; static PDF formatter contains all 620 messages without virtualization and only the selected messages.')
  } finally { fs.rmSync(directory, {recursive:true,force:true}) }
}
module.exports = { buildSyntheticPdfHtml, load }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
