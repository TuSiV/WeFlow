import { existsSync, readFileSync } from 'fs'
import { createHash } from 'crypto'
import { join, resolve } from 'path'
import manifest from '../../shared/native-components.json'

type ComponentKey = 'wcdbLibPath' | 'imageNativeAddonPath' | 'welivePath' | 'keyDllPath'

/** Resolve only the pinned Windows x64 bundle. Explicit user paths remain overrides. */
export function resolveBundledComponentPath(key: ComponentKey): string | null {
  if (process.platform !== 'win32' || process.arch !== 'x64') return null
  const paths = manifest.platforms['win32-x64'] as Partial<Record<ComponentKey, string>>
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
