import { readdir, lstat, readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

export interface DiscoveredAccount {
  accountId: string
  accountDir: string
  dbPath: string
  layout: 'wcdb4' | 'legacy3'
  supported: boolean
}
export interface AccountScanResult {
  accounts: DiscoveredAccount[]
  searchedPaths: string[]
  warnings: string[]
}

/** Scan only supplied roots and known containers; never recurse through a drive. */
export async function discoverAccounts(roots: string[]): Promise<AccountScanResult> {
  const result: AccountScanResult = { accounts: [], searchedPaths: [], warnings: [] }
  const visited = new Set<string>()
  const accounts = new Set<string>()
  const canonical = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
  const isFile = async (file: string) => {
    try { const info = await lstat(file); return info.isFile() && info.size > 0 } catch { return false }
  }
  async function visit(directory: string, depth: number): Promise<void> {
    const absolute = resolve(directory)
    const key = canonical(absolute)
    if (visited.has(key)) return
    visited.add(key)
    let entries
    try {
      const info = await lstat(absolute)
      if (!info.isDirectory() || info.isSymbolicLink()) return
      result.searchedPaths.push(absolute)
      const modern = await isFile(join(absolute, 'db_storage', 'session', 'session.db'))
        || await isFile(join(absolute, 'db_storage', 'session.db'))
      const legacy = !modern && await isFile(join(absolute, 'Msg', 'MicroMsg.db'))
      if (modern || legacy) {
        if (!accounts.has(key)) {
          accounts.add(key)
          result.accounts.push({ accountId: basename(absolute), accountDir: absolute,
            dbPath: dirname(absolute), layout: modern ? 'wcdb4' : 'legacy3', supported: modern })
        }
        return
      }
      if (depth === 0) return
      entries = await readdir(absolute, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') result.warnings.push(`无法读取目录：${absolute}`)
      return
    }
    // One level of account children; deeper traversal is limited to known containers.
    for (const entry of entries.slice(0, 1024)) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      const container = ['xwechat_files', 'wechat files'].includes(entry.name.toLowerCase())
      await visit(join(absolute, entry.name), container ? depth - 1 : 0)
    }
    if (entries.length > 1024) result.warnings.push(`目录项目过多，请直接选择微信数据根目录：${absolute}`)
  }
  for (const root of roots.filter(value => typeof value === 'string' && value.trim())) await visit(root, 3)
  result.accounts.sort((a, b) => Number(b.supported) - Number(a.supported) || a.accountDir.localeCompare(b.accountDir))
  return result
}

export async function defaultAccountRoots(documents: string, home: string, appData?: string, platform: NodeJS.Platform = process.platform): Promise<string[]> {
  const bases = [documents, join(home, 'Documents')]
  const configuredRoots: string[] = []
  // This optional client config can name a custom storage base. Unknown/invalid
  // contents are ignored; no account identity is inferred from this file.
  if (appData) {
    try {
      const file = join(appData, 'Tencent', 'WeChat', 'All Users', 'config', '3ebffe94.ini')
      const info = await lstat(file)
      if (info.isFile() && info.size <= 8192) {
        const bytes = await readFile(file)
        const raw = bytes.includes(0) ? bytes.toString('utf16le') : bytes.toString('utf8')
        const value = raw.replace(/^\uFEFF/, '').trim()
        if (/^[a-zA-Z]:[\\/]/.test(value) && !/[\r\n\0]/.test(value)) { bases.push(value); configuredRoots.push(value) }
      }
    } catch { /* Optional config is absent on many client installations. */ }
  }
  const macRoots = platform === 'darwin' ? [join(home, 'Library', 'Containers', 'com.tencent.xinWeChat', 'Data', 'Documents', 'xwechat_files')] : []
  return [...new Set([...configuredRoots, ...macRoots, ...bases.flatMap(base => [join(base, 'xwechat_files'), join(base, 'WeChat Files')])])]
}
