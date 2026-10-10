// Cache derivation adapted from Panther114/Weport@3b9e2afd341f0eef56d4be9dafca25c8fe8be533 (CC BY-NC-SA 4.0).
import { join, dirname, basename } from 'path'
import { homedir } from 'os'
import { readdirSync, openSync, readSync, closeSync, fstatSync } from 'fs'
import { resolveAccountImageDirs, selectVerifiedImageKey, canonicalWxidVariants } from './bundledWindowsKeyService'

export function parseMacKeyResult(text: string): { success: boolean; key?: string; error?: string } {
  for (const line of text.split(/\r?\n/).reverse()) {
    try {
      const payload = JSON.parse(line.trim())
      const key = payload.success === true ? (payload.key ?? payload.result) : undefined
      if (typeof key === 'string' && /^[a-f\d]{64}$/i.test(key)) return { success: true, key }
    } catch { /* Only the documented helper JSON is accepted. */ }
  }
  if (/task_for_pid|ATTACH_FAILED|permission denied|not permitted/i.test(text)) {
    return { success: false, error: '系统拒绝访问微信进程。管理员授权也不保证能够访问当前微信版本；可手动填写密钥或配置兼容外部工具。无需关闭 SIP 或修改微信签名。' }
  }
  if (/PROCESS_NOT_FOUND/.test(text)) return { success: false, error: '目标应用进程未运行，请先打开微信' }
  if (/HOOK_TIMEOUT|FRIDA_TIMEOUT|timeout/i.test(text)) return { success: false, error: '未在等待时间内捕获密钥，请保持微信打开并切换会话后重试' }
  if (/SCAN_FAILED|HOOK_FAILED|pattern not found|module not found/i.test(text)) return { success: false, error: '当前微信版本的密钥获取特征未匹配，请手动填写密钥或配置兼容外部工具' }
  return { success: false, error: '内置 Mac 密钥工具未返回有效的 64 位数据库密钥' }
}

export function macKvcommRoots(accountPath: string, home = homedir()): string[] {
  const data = join(home, 'Library/Containers/com.tencent.xinWeChat/Data')
  const roots = new Set([
    join(data, 'Documents/app_data/net/kvcomm'),
    join(data, 'Library/Application Support/com.tencent.xinWeChat/xwechat/net/kvcomm'),
    join(data, 'Library/Application Support/com.tencent.xinWeChat/net/kvcomm'),
    join(data, 'Documents/xwechat/net/kvcomm')
  ])
  const normalized = accountPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const index = normalized.indexOf('/xwechat_files')
  if (index >= 0) roots.add(join(normalized.slice(0, index), 'app_data/net/kvcomm'))
  let cursor = accountPath
  for (let i = 0; i < 6 && cursor; i++) {
    roots.add(join(cursor, 'net/kvcomm'))
    const parent = dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
  return [...roots]
}

export function readMacTemplates(accountDir: string) {
  const ciphertexts: Buffer[] = [], files: string[] = []
  const tails = new Map<number, number>()
  let entriesRead = 0
  const walk = (dir: string, depth: number) => {
    if (depth > 12 || files.length >= 32 || entriesRead >= 10000) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (++entriesRead > 10000 || files.length >= 32) break
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full, depth + 1); continue }
      if (!entry.isFile() || !entry.name.endsWith('_t.dat')) continue
      let fd: number | undefined
      try {
        fd = openSync(full, 'r')
        const header = Buffer.alloc(31)
        if (readSync(fd, header, 0, 31, 0) !== 31 || !header.subarray(0, 6).equals(Buffer.from([7,8,86,50,8,7]))) continue
        ciphertexts.push(header.subarray(15,31)); files.push(full)
        const size = fstatSync(fd).size
        if (size >= 33) {
          const tail = Buffer.alloc(2)
          if (readSync(fd, tail, 0, 2, size - 2) === 2) {
            const xor = tail[0] ^ 255
            if ((tail[1] ^ 217) === xor) tails.set(xor, (tails.get(xor) || 0) + 1)
          }
        }
      } catch { /* unreadable templates do not become a successful key */ }
      finally { if (fd !== undefined) closeSync(fd) }
    }
  }
  walk(accountDir, 0)
  const xor = [...tails].sort((a,b) => b[1]-a[1])
  return { ciphertexts, files, dirs:[accountDir], xorKey: xor.length && xor[0][1] >= 2 ? xor[0][0] : null }
}

export function getMacImageKey(accountPath: string, accountId?: string, onProgress?: (message: string) => void, home?: string) {
  const scope = resolveAccountImageDirs(accountPath, accountId)
  const exact = scope.dirs.filter(dir => basename(dir) === accountId)
  if (exact.length === 1) scope.dirs = exact
  if (accountId && scope.dirs.length === 1 && !canonicalWxidVariants(basename(scope.dirs[0])).some(value => canonicalWxidVariants(accountId).includes(value)))
    return { success:false, error:'所选账号与图片目录不一致，请重新选择账号' }
  // Never use another account's templates, or guess between suffix variants.
  if (!scope.scoped || scope.dirs.length !== 1) return { success:false, error:'请直接选择唯一的当前账号目录后再获取图片密钥' }
  const templates = readMacTemplates(scope.dirs[0])
  const codes = new Set<number>()
  for (const dir of macKvcommRoots(scope.dirs[0], home)) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes:true })) {
        if (!entry.isFile()) continue
        const match = /^key_(\d+)_.+\.statistic$/i.exec(entry.name)
        const code = Number(match?.[1])
        if (Number.isInteger(code) && code > 0 && code <= 0xffffffff) codes.add(code)
      }
    } catch { /* Try other known cache directories. */ }
  }
  return selectVerifiedImageKey({ payload:{accounts:[{keys:[...codes].map(code=>({code}))}]}, scope,
    rootDir:accountPath, wxidParam:accountId, templates, onProgress })
}
