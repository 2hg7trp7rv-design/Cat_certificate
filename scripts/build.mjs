import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(process.cwd())
const dist = join(root, 'dist')
const mustExist = [
  'index.html',
  'privacy.html',
  'robots.txt',
  'src/app.js',
  'src/game-state.js',
  'src/icons.js',
  'src/pet-art.js',
  'src/styles.css',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/favicon.svg',
]

for (const path of mustExist) {
  if (!existsSync(join(root, path))) throw new Error(`Missing required file: ${path}`)
}

const manifest = JSON.parse(await readFile(join(root, 'public/manifest.webmanifest'), 'utf8'))
if (manifest.display !== 'standalone' || manifest.orientation !== 'portrait') {
  throw new Error('PWA manifest must remain standalone and portrait-oriented')
}

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(join(root, 'index.html'), join(dist, 'index.html'))
await cp(join(root, 'src'), join(dist, 'src'), { recursive: true })
await cp(join(root, 'public'), dist, { recursive: true })
for (const path of ['privacy.html', 'robots.txt']) {
  if (existsSync(join(root, path))) await cp(join(root, path), join(dist, path))
}

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
await writeFile(join(dist, 'build-meta.json'), `${JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  runtime: 'static-pwa',
  generatedBy: 'scripts/build.mjs',
}, null, 2)}\n`)

console.log(`Tail Room ${pkg.version} built successfully → ${dist}`)
