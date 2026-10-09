import { createReadStream } from 'fs'
import { realpath, stat } from 'fs/promises'
import { isAbsolute, relative, resolve, sep } from 'path'
import { iterateJsonlLines } from './export/utils/jsonlLineReader'
import type { WeliveRawExportManifest } from './weliveBridge'

/** Derive file metadata for older engines; this does not establish source completeness. */
export async function readLegacyRawManifest(file: string, exportsDir: string): Promise<WeliveRawExportManifest> {
  const root = await realpath(exportsDir)
  const output = await realpath(resolve(file))
  const location = relative(root, output)
  if (!location || location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location)) {
    throw new Error('WeLive 原始文件不在指定导出目录中')
  }
  const before = await stat(output)
  if (!before.isFile()) throw new Error('WeLive 原始输出不是文件')
  const manifest: WeliveRawExportManifest = { path: output, rows: 0, bytes: before.size,
    images_failed: 0, voices_failed: 0, videos_failed: 0, emojis_failed: 0, files_failed: 0 }
  const failures = { image: 'images_failed', voice: 'voices_failed', video: 'videos_failed',
    emoji: 'emojis_failed', file: 'files_failed' } as const
  for await (const line of iterateJsonlLines(createReadStream(output))) {
    if (!line.trim()) continue
    const row = JSON.parse(line)
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('WeLive 原始记录必须是 JSON 对象')
    manifest.rows++
    if (String(row.media_error || row.mediaError || '').trim()) {
      const type = String(row.media_type || row.mediaType || '') as keyof typeof failures
      const key = failures[type] || 'files_failed'
      manifest[key] = Number(manifest[key] || 0) + 1
    }
  }
  const after = await stat(output)
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('读取期间 WeLive 原始文件发生变化')
  return manifest
}
