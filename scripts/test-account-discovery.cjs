const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Module } = require('node:module')
const { buildSync } = require('esbuild')
function load(file) {
  const m = new Module(__filename, module); m.paths = module.paths
  m._compile(buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, file)
  return m.exports
}
const { discoverAccounts, defaultAccountRoots } = load('electron/services/accountDiscovery.ts')
const { resolveAccountDir } = load('electron/services/accountDirResolver.ts')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weflow-discovery-'))
const touch = file => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'synthetic fixture') }
;(async () => {
  try {
    const modern = path.join(root, 'WeChat Files', 'xwechat_files')
    const a = path.join(modern, 'wxid_friend_abcd')
    const b = path.join(modern, 'wxid_friend_efgh')
    touch(path.join(a, 'db_storage/session/session.db'))
    touch(path.join(b, 'db_storage/session.db'))
    touch(path.join(modern, 'my_custom_name', 'db_storage/session/session.db'))
    touch(path.join(root, 'WeChat Files', 'old_alias', 'Msg/MicroMsg.db'))
    fs.mkdirSync(path.join(modern, 'empty_account', 'db_storage'), { recursive: true })
    touch(path.join(modern, 'all_users', 'config', 'session.db'))
    touch(path.join(root, 'unrelated', 'nested', 'wxid_hidden', 'db_storage/session/session.db'))
    try { fs.symlinkSync(a, path.join(modern, 'linked_account'), 'junction') } catch {}
    const result = await discoverAccounts([root, modern, a, path.join(root, 'absent')])
    assert.equal(result.accounts.length, 4)
    assert.equal(result.accounts.filter(a => a.supported).length, 3)
    assert.equal(result.accounts.find(a => a.accountId === 'old_alias').layout, 'legacy3')
    assert(!result.accounts.some(a => /empty|hidden|linked|all_users/.test(a.accountId)))
    assert.equal((await discoverAccounts([a])).accounts[0].dbPath, modern)
    assert.equal((await discoverAccounts([path.join(root, 'absent')])).accounts.length, 0)
    // Even after a cleaned-prefix lookup is cached, an explicit account selection
    // must retain the exact full directory rather than switch to a sibling.
    assert(resolveAccountDir(modern, 'wxid_friend'))
    assert.equal(resolveAccountDir(modern, path.basename(a)), a)
    assert.equal(resolveAccountDir(modern, path.basename(b)), b)
    const roaming = path.join(root, 'roaming')
    const config = path.join(roaming, 'Tencent/WeChat/All Users/config/3ebffe94.ini')
    touch(config)
    fs.writeFileSync(config, 'Z:\\wechat-custom', 'utf16le')
    const defaults = await defaultAccountRoots(path.join(root, 'Documents'), root, roaming)
    assert(defaults.some(p => p.includes('wechat-custom')))
    console.log('Account discovery: nested/direct/custom roots, multiple accounts, arbitrary names, legacy status, missing roots, empty/cache exclusions and exact account resolution passed.')
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})().catch(error => { console.error(error); process.exitCode = 1 })
