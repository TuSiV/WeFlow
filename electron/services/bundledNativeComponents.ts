import { existsSync, readFileSync } from 'fs'
import { createHash } from 'crypto'
import { join, resolve } from 'path'
import manifest from '../../shared/native-components.json'

type ComponentKey = 'wcdbLibPath' | 'imageNativeAddonPath' | 'welivePath' | 'keyDllPath'

/** Resolve verified desktop bundles. Explicit user paths remain overrides. */
export function resolveBundledComponentPath(key: ComponentKey): string | null {
  const target = `${process.platform}-${process.arch}`
  if (target !== 'win32-x64' && target !== 'darwin-arm64') return null
  const blocks = manifest.runtimeBlocks as Partial<Record<string, Partial<Record<ComponentKey, string>>>>
  if (blocks[target]?.[key]) return null
  const paths = manifest.platforms[target] as Partial<Record<ComponentKey, string>>
  const relative = paths[key]
  if (!relative) return null
  const packagedRoot = process.resourcesPath
  const roots = [packagedRoot, resolve(__dirname, '..'), resolve(__dirname, '../..')]
    .filter((root): root is string => Boolean(root))
  for (const root of roots) {
    const candidate = join(root, relative)
    if (!existsSync(candidate)) continue
    const dir = relative.slice(0, relative.lastIndexOf('/') + 1)
    // Verify sibling dependencies too, before passing a native file to a loader.
    const files = manifest.files.filter(file => file.path.startsWith(dir))
    try {
      for (const file of files) {
        const data = readFileSync(join(root, file.path))
        const hash = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
        if (data.length !== file.size || hash !== file.gitBlobSha) return null
      }
      return candidate
    } catch {
      return null
    }
  }
  return null
}
