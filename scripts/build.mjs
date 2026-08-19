import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DIRECT_ART_FILES, DIRECT_ART_VERSION } from '../src/game/art/DirectArtManifest.js'

const root = resolve(process.cwd())
const dist = join(root, 'dist')
const vendorRoot = join(root, 'vendor', 'phaser-4.2.1')
const required = [
  'index.html',
  'src/main.js',
  'src/state.js',
  'src/styles.css',
  'vendor/phaser-4.2.1/manifest.json',
  'vendor/phaser-4.2.1/phaser.esm.min.js',
  'vendor/phaser-4.2.1/LICENSE.md',
  ...Object.values(DIRECT_ART_FILES).map(file => `public/${file.url.replace(/^\.\//, '')}`),
  'public/assets/fonts/noto-sans-jp-400.ttf',
  'public/assets/fonts/noto-sans-jp-700.ttf',
  'public/assets/fonts/OFL.txt',
  'robots.txt',
  'vercel.json'
]

for (const file of required) {
  if (!existsSync(join(root, file))) throw new Error(`Missing required file: ${file}`)
}

const vendorManifest = JSON.parse(await readFile(join(vendorRoot, 'manifest.json'), 'utf8'))
const vendorBytes = await readFile(join(vendorRoot, vendorManifest.entry))
const vendorSha = createHash('sha256').update(vendorBytes).digest('hex')

if (vendorManifest.version !== '4.2.1') {
  throw new Error(`Unexpected Phaser version: ${vendorManifest.version}`)
}

if (vendorSha !== vendorManifest.sha256) {
  throw new Error(`Phaser vendor checksum mismatch: ${vendorSha}`)
}

const directArtSha256 = {}
for (const [name, file] of Object.entries(DIRECT_ART_FILES)) {
  const assetPath = join(root, 'public', file.url.replace(/^\.\//, ''))
  const bytes = await readFile(assetPath)
  const signature = bytes.subarray(0, 8).toString('hex')
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const checksum = createHash('sha256').update(bytes).digest('hex')
  if (signature !== '89504e470d0a1a0a') throw new Error(`Direct art is not a PNG: ${file.url}`)
  if (width !== file.width || height !== file.height) {
    throw new Error(`Direct art dimensions changed for ${file.url}: ${width}x${height}`)
  }
  if (checksum !== file.sha256) throw new Error(`Direct art checksum mismatch: ${file.url}`)
  directArtSha256[name] = checksum
}

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(join(root, 'index.html'), join(dist, 'index.html'))
await cp(join(root, 'src'), join(dist, 'src'), { recursive: true })
await cp(join(root, 'vendor'), join(dist, 'vendor'), { recursive: true })
if (existsSync(join(root, 'public'))) {
  await cp(join(root, 'public'), dist, { recursive: true })
}
await cp(join(root, 'robots.txt'), join(dist, 'robots.txt'))

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const meta = {
  name: pkg.name,
  version: pkg.version,
  target: 'creator-preview',
  renderer: 'webgl',
  engine: `phaser-${vendorManifest.version}`,
  engineSha256: vendorSha,
  runtimeFetches: false,
  externalRuntimeFetches: false,
  directArt: {
    version: DIRECT_ART_VERSION,
    source: 'user-approved-original-files',
    sha256: directArtSha256,
  },
  builtAt: new Date().toISOString()
}

await writeFile(join(dist, 'build-meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
console.log(`Built ${pkg.name} ${pkg.version} with Phaser ${vendorManifest.version} -> ${dist}`)
