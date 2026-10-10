export interface ExportMessageRef {
  localId: number
  createTime: number
  serverIdRaw?: string
  localType?: number
  dbPath?: string
  tableName?: string
}

function normalizeSourcePath(value: string): string {
  const normalized = value.replace(/\\/g, '/')
  return /^(?:[a-z]:\/|\/\/)/i.test(normalized) ? normalized.toLowerCase() : normalized
}

/** Match database identities, never content or a time range alone. Fail closed on ambiguity. */
export function selectExportMessages<T extends Record<string, any>>(rows: T[], selection: ExportMessageRef[]): T[] {
  if (!Array.isArray(selection) || selection.length === 0) throw new Error('请至少选择一条消息')
  const index = new Map<string, T[]>()
  for (const row of rows) {
    const token = `${row.localId}:${row.createTime}`
    const matches = index.get(token) || []
    matches.push(row)
    index.set(token, matches)
  }
  const selected = new Set<T>()
  for (const ref of selection) {
    if (!Number.isSafeInteger(ref.localId) || ref.localId <= 0 || !Number.isFinite(ref.createTime) || ref.createTime <= 0) {
      throw new Error('所选消息标识无效，请重新选择')
    }
    const matches = (index.get(`${ref.localId}:${ref.createTime}`) || []).filter(row => {
      const hasServerIdentity = !!ref.serverIdRaw && ref.serverIdRaw !== '0'
      if (hasServerIdentity && String(row.serverIdRaw || '') !== ref.serverIdRaw) return false
      if (ref.localType !== undefined && row.localType !== ref.localType) return false
      // Missing source hints require a matching full server ID, never a local-ID fallback.
      if (ref.dbPath && !row._db_path && !hasServerIdentity) return false
      if (ref.tableName && !row.table_name && !hasServerIdentity) return false
      if (ref.dbPath && row._db_path && normalizeSourcePath(String(row._db_path)) !== normalizeSourcePath(ref.dbPath)) return false
      if (ref.tableName && row.table_name && row.table_name !== ref.tableName) return false
      return true
    })
    if (matches.length !== 1) throw new Error(matches.length ? '所选消息标识存在歧义，已停止导出' : '所选消息已变化或无法读取，请刷新聊天后重新选择')
    selected.add(matches[0])
  }
  return rows.filter(row => selected.has(row))
}
