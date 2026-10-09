const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const manifest = require('../shared/native-components.json')
const transforms = {
  'wcdb-date-compat-v1': require('./wcdb-date-compat.cjs').applyDateCompatibility,
  'welive-date-compat-v1': require('./welive-date-compat.cjs').applyDateCompatibility
}
const root = path.resolve(__dirname, '..')

function selectFiles(target) {
  const paths = manifest.platforms[target]
  if (!paths) throw new Error(`Unsupported target: ${target}`)
  const dirs = Object.values(paths).map(p => path.posix.dirname(p) + '/')
  return manifest.files.filter(f => dirs.some(d => f.path.startsWith(d)))
}

function verify(data, file) {
  const hash = crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')
  if (data.length !== file.size || hash !== file.gitBlobSha) throw new Error(`Integrity mismatch: ${file.path}`)
}

async function install(target, checkOnly = false) {
  for (const file of selectFiles(target)) {
    const destination = path.join(root, file.path)
    try {
      verify(await fs.readFile(destination), file)
      console.log(`Verified ${file.path}`)
      continue
    } catch (error) {
      if (checkOnly) throw error
    }
    const url = `https://raw.githubusercontent.com/${manifest.source.repository}/${manifest.source.commit}/${file.path}`
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) })
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${file.path}`)
    let data = Buffer.from(await response.arrayBuffer())
    verify(data, { ...file, gitBlobSha: file.sourceGitBlobSha || file.gitBlobSha })
    if (file.transform) {
      const transform = transforms[file.transform]
      if (!transform) throw new Error(`Unsupported transform: ${file.transform}`)
      data = transform(data)
    }
    verify(data, file)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    const temporary = destination + `.download-${process.pid}`
    try {
      await fs.writeFile(temporary, data, { flag: 'wx' })
      await fs.rename(temporary, destination)
    } finally {
      await fs.rm(temporary, { force: true })
    }
    if (!file.path.endsWith('.dll') && !file.path.endsWith('.node')) await fs.chmod(destination, 0o755)
    console.log(`Installed ${file.path}`)
  }
  console.log('Files verified; no native code was executed. Keys must be supplied separately.')
}

module.exports = { selectFiles, verify, install }
if (require.main === module) {
  const args = process.argv.slice(2)
  const target = args.find(a => !a.startsWith('--')) || `${process.platform}-${process.arch}`
  install(target, args.includes('--check')).catch(error => { console.error(error.message); process.exitCode = 1 })
}
