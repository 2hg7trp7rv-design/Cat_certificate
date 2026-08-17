import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import test from 'node:test'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs', '.ts', '.tsx'])
const SCENES = ['BootScene', 'FirstMeetingScene', 'RoomScene', 'DebugScene']
const REQUIRED_LAYERS = ['room', 'furniture', 'cat', 'light', 'shadow']

const toPosix = value => value.split(sep).join('/')
const repoPath = value => toPosix(relative(ROOT, value))
const extension = value => {
  const name = value.slice(value.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot)
}
const exists = async value => stat(value).then(() => true, () => false)
const readText = value => readFile(value, 'utf8')
const sha256 = value => createHash('sha256').update(value).digest('hex')

async function walk(directory, { excluded = new Set() } = {}) {
  if (!(await exists(directory))) return []
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue
    const absolute = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute, { excluded }))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

async function textFilesUnder(directory, options) {
  return (await walk(directory, options)).filter(file => TEXT_EXTENSIONS.has(extension(toPosix(file))))
}

async function authoredRuntimeFiles() {
  const files = []
  const index = resolve(ROOT, 'index.html')
  if (await exists(index)) files.push(index)
  files.push(...await textFilesUnder(resolve(ROOT, 'src')))
  return files
}

async function builtRuntimeFiles() {
  const files = []
  const index = resolve(DIST, 'index.html')
  if (await exists(index)) files.push(index)
  for (const file of await textFilesUnder(DIST, { excluded: new Set(['vendor']) })) {
    if (!files.includes(file)) files.push(file)
  }
  return files
}

async function findMatches(files, expressions) {
  const matches = []
  for (const file of files) {
    const source = await readText(file)
    for (const expression of expressions) {
      expression.lastIndex = 0
      if (expression.test(source)) matches.push(`${repoPath(file)} (${expression})`)
    }
  }
  return matches
}

test('v0.7 has no Base64 scene chunks or assets_source dependency', async () => {
  const files = await walk(ROOT, { excluded: new Set(['.git', 'node_modules']) })
  const forbiddenFiles = files
    .map(repoPath)
    .filter(file => file.split('/').includes('assets_source') || file.endsWith('.b64'))
  const references = await findMatches(
    [...await authoredRuntimeFiles(), ...await builtRuntimeFiles()],
    [/\bassets_source\b/i, /\.b64\b/i, /scene_day_\d+/i],
  )

  assert.deepEqual(forbiddenFiles, [], `Remove legacy Base64 scene files:\n${forbiddenFiles.join('\n')}`)
  assert.deepEqual(references, [], `Remove Base64 scene references:\n${references.join('\n')}`)
})

test('game-world input is not implemented with transparent DOM hotspots', async () => {
  const files = [...await authoredRuntimeFiles(), ...await builtRuntimeFiles()]
  const offenders = []

  for (const file of files) {
    const source = await readText(file)
    const ext = extension(toPosix(file))
    const expressions = ext === '.html' || ext === '.css'
      ? [/\bhotspot\b/i, /\b(?:cat|intro-cat|window|bed|bowl|toy|room)[-_]zone\b/i]
      : [
          /["'`]#(?:introCat|(?:cat|window|bed|bowl|toy)Zone)["'`]/,
          /\b(?:getElementById|querySelector)\s*\(\s*["'`](?:#)?(?:introCat|(?:cat|window|bed|bowl|toy)Zone)["'`]\s*\)/,
        ]
    for (const expression of expressions) {
      expression.lastIndex = 0
      if (expression.test(source)) offenders.push(`${repoPath(file)} (${expression})`)
    }
  }

  for (const file of files.filter(file => extension(toPosix(file)) === '.html')) {
    const html = await readText(file)
    const overlay = /<(?:button|a|div|span)\b[^>]*(?:id|class)=["'][^"']*(?:hotspot|(?:cat|intro-cat|window|bed|bowl|toy|room)[-_]?zone)[^"']*["'][^>]*>/i
    if (overlay.test(html)) offenders.push(`${repoPath(file)} (interactive DOM overlay)`)
  }

  assert.deepEqual(
    [...new Set(offenders)],
    [],
    `Move cat/furniture hit testing into Phaser geometry and keep DOM controls for UI/accessibility only:\n${[...new Set(offenders)].join('\n')}`,
  )
})

test('runtime loads only local application and Phaser assets', async () => {
  const files = [...await authoredRuntimeFiles(), ...await builtRuntimeFiles()]
  const remoteLoaderPatterns = [
    /(?:raw\.githubusercontent\.com|api\.github\.com|github\.com\/[^\s"'`)]+\/(?:raw|blob)\/)/i,
    /(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|esm\.sh|cdn\.skypack\.dev)/i,
    /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//i,
    /\b(?:fetch|import)\s*\(\s*["'`]https?:\/\//i,
  ]
  const offenders = await findMatches(files, remoteLoaderPatterns)
  assert.deepEqual(offenders, [], `Vendor runtime dependencies locally; remote GitHub/CDN loading is forbidden:\n${offenders.join('\n')}`)
})

test('all four v0.7 scenes exist, extend Phaser.Scene, and are registered', async () => {
  const configPath = resolve(ROOT, 'src/game/config.js')
  const mainPath = resolve(ROOT, 'src/main.js')
  const registrySource = [configPath, mainPath]
    .map(file => exists(file).then(found => found ? readText(file) : ''))
  const registry = (await Promise.all(registrySource)).join('\n')

  for (const scene of SCENES) {
    const file = resolve(ROOT, `src/game/scenes/${scene}.js`)
    assert.equal(await exists(file), true, `Missing scene: src/game/scenes/${scene}.js`)
    const source = await readText(file)
    assert.match(source, new RegExp(`\\bclass\\s+${scene}\\b`), `${scene}.js must declare class ${scene}`)
    assert.match(source, /extends\s+(?:Phaser\.)?Scene\b/, `${scene} must extend Phaser.Scene`)
    assert.match(source, /\bexport\b/, `${scene} must be exported`)
    assert.match(registry, new RegExp(`\\b${scene}\\b`), `${scene} must be registered by src/game/config.js or src/main.js`)
  }
})

test('Phaser is explicitly configured for WebGL', async () => {
  const configPath = resolve(ROOT, 'src/game/config.js')
  assert.equal(await exists(configPath), true, 'Missing src/game/config.js')
  const source = await readText(configPath)
  const entry = await readText(resolve(ROOT, 'src/main.js'))
  assert.match(source, /\btype\s*:\s*Phaser\.WEBGL\b/, 'Phaser config must use `type: Phaser.WEBGL`')
  assert.doesNotMatch(source, /\btype\s*:\s*Phaser\.(?:AUTO|CANVAS|HEADLESS)\b/, 'AUTO/CANVAS/HEADLESS renderer fallback is not accepted for v0.7')
  assert.match(entry, /getContext\(['"]webgl['"]\)/, 'preflight must probe the WebGL1 context Phaser 4.2.1 requests')
  assert.doesNotMatch(entry, /getContext\(['"]webgl2['"]\)/, 'a WebGL2-only preflight can disagree with the Phaser renderer')
  assert.match(entry, /WEBGL_lose_context/, 'the preflight context must be released before Phaser allocates its renderer')
  assert.doesNotMatch(
    `${entry}\n${source}`,
    /failIfMajorPerformanceCaveat\s*:\s*true/,
    'WebGL must remain available on low-power GPUs; performance is validated separately',
  )
})

test('room, furniture, cat, light, and shadow are named Phaser layers', async () => {
  const roomScenePath = resolve(ROOT, 'src/game/scenes/RoomScene.js')
  const roomWorldPath = resolve(ROOT, 'src/game/world/RoomWorld.js')
  assert.equal(await exists(roomScenePath), true, 'Missing src/game/scenes/RoomScene.js')
  assert.equal(await exists(roomWorldPath), true, 'Missing src/game/world/RoomWorld.js')
  const source = `${await readText(roomScenePath)}\n${await readText(roomWorldPath)}`

  for (const layer of REQUIRED_LAYERS) {
    const explicitName = new RegExp(`(?:\\b${layer}Layer\\b|["']${layer}["']\\s*[:,])`, 'i')
    assert.match(source, explicitName, `RoomScene must name a separate ${layer} layer`)
  }

  const layerCreations = source.match(/\b(?:this|scene)\.add\.layer\s*\(/g) ?? []
  const factoryCreatesLayers = /(?:map|reduce|forEach|Object\.fromEntries)[\s\S]{0,500}\b(?:this|scene)\.add\.layer\s*\(/.test(source)
  assert.ok(
    layerCreations.length >= REQUIRED_LAYERS.length || factoryCreatesLayers,
    `RoomScene must create distinct Phaser layers (${REQUIRED_LAYERS.join(', ')})`,
  )
})

test('Container hit areas account for Phaser display origins', async () => {
  const cat = await readText(resolve(ROOT, 'src/game/entities/Cat.js'))
  const interactive = await readText(resolve(ROOT, 'src/game/entities/InteractiveObject.js'))
  const combined = `${cat}\n${interactive}`

  assert.match(combined, /alignCenteredHitArea/)
  assert.equal((combined.match(/this\.displayOriginX/g) || []).length >= 2, true)
  assert.equal((combined.match(/this\.displayOriginY/g) || []).length >= 2, true)
})

test('debug scene uses the Phaser 4 SceneManager API', async () => {
  const entry = await readText(resolve(ROOT, 'src/main.js'))
  const ui = await readText(resolve(ROOT, 'src/ui/UIController.js'))
  const combined = `${entry}\n${ui}`

  assert.doesNotMatch(combined, /game\.scene\.launch\s*\(/)
  assert.match(combined, /\.scene\.run\(['"]DebugScene['"]\)/)
})

test('passive room guidance cannot block Canvas input', async () => {
  const styles = await readText(resolve(ROOT, 'src/styles.css'))
  const rule = styles.match(/\.world-hint,\s*\.toast\s*\{[\s\S]*?\}/)?.[0] || ''
  assert.match(rule, /pointer-events\s*:\s*none/)
})

test('the pinned Phaser 4 vendor artifact has a verified SHA-256 manifest', async () => {
  const jsonFiles = (await walk(ROOT, { excluded: new Set(['.git', 'dist', 'node_modules']) }))
    .filter(file => extension(toPosix(file)) === '.json')
    .filter(file => !/^package(?:-lock)?\.json$/.test(toPosix(file).split('/').at(-1)))

  const candidates = []
  for (const file of jsonFiles) {
    let manifest
    try { manifest = JSON.parse(await readText(file)) } catch { continue }
    const pathSuggestsPhaser = /phaser/i.test(repoPath(file))
    const dataSuggestsPhaser = /phaser/i.test(String(manifest.name ?? manifest.package ?? manifest.library ?? ''))
    if (pathSuggestsPhaser || dataSuggestsPhaser) candidates.push({ file, manifest })
  }
  assert.ok(candidates.length > 0, 'Missing a local Phaser vendor manifest (for example vendor/phaser/manifest.json)')

  const selected = candidates.find(({ manifest }) => {
    const artifact = manifest.artifact ?? manifest.vendor ?? manifest.phaser ?? manifest
    return artifact.file || artifact.path || artifact.entry
  }) ?? candidates[0]
  const { file: manifestPath, manifest } = selected
  const artifact = manifest.artifact ?? manifest.vendor ?? manifest.phaser ?? manifest
  const version = String(manifest.version ?? manifest.phaserVersion ?? artifact.version ?? '')
  const artifactReference = artifact.file ?? artifact.path ?? artifact.entry ?? manifest.file ?? manifest.path
  const declaredChecksum = artifact.sha256 ?? manifest.sha256 ?? artifact.checksum ?? manifest.checksum
  const checksum = typeof declaredChecksum === 'object' ? declaredChecksum.sha256 : declaredChecksum

  assert.match(version, /^4\.\d+\.\d+$/, `${repoPath(manifestPath)} must pin an exact stable Phaser 4 version`)
  assert.equal(typeof artifactReference, 'string', `${repoPath(manifestPath)} must declare the local artifact file/path`)
  assert.doesNotMatch(artifactReference, /^(?:https?:)?\/\//i, 'The Phaser artifact path must be local')
  assert.match(String(checksum ?? ''), /^[a-f\d]{64}$/i, `${repoPath(manifestPath)} must declare a 64-character hexadecimal SHA-256`)

  const relativeToManifest = resolve(dirname(manifestPath), artifactReference)
  const relativeToRoot = resolve(ROOT, artifactReference)
  const artifactPath = await exists(relativeToManifest) ? relativeToManifest : relativeToRoot
  assert.ok(repoPath(artifactPath) && !repoPath(artifactPath).startsWith('../'), 'The Phaser artifact must stay inside the repository')
  assert.equal(await exists(artifactPath), true, `Missing Phaser artifact declared by ${repoPath(manifestPath)}: ${artifactReference}`)
  const actualChecksum = sha256(await readFile(artifactPath))
  assert.equal(actualChecksum, String(checksum).toLowerCase(), `Phaser checksum mismatch for ${repoPath(artifactPath)}`)

  const runtimeEntrypoints = [resolve(ROOT, 'index.html'), resolve(ROOT, 'src/main.js'), resolve(ROOT, 'src/game/config.js'), resolve(ROOT, 'src/game/phaser.js')]
  const runtimeSource = (await Promise.all(runtimeEntrypoints.map(async file => await exists(file) ? readText(file) : ''))).join('\n')
  assert.match(
    runtimeSource,
    new RegExp(basename(artifactPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Runtime entrypoints must import the checksummed local Phaser artifact ${repoPath(artifactPath)}`,
  )
})

test('runtime and package contain no stale v0.6 identity markers', async () => {
  const packagePath = resolve(ROOT, 'package.json')
  const pkg = JSON.parse(await readText(packagePath))
  assert.match(pkg.version, /^0\.7\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'package.json must identify the v0.7 milestone')

  const files = [
    packagePath,
    ...await authoredRuntimeFiles(),
    ...await builtRuntimeFiles(),
  ].filter(file => !/(?:^|\/)src\/state\.js$/.test(toPosix(file)))
  const buildMeta = resolve(DIST, 'build-meta.json')
  if (await exists(buildMeta) && !files.includes(buildMeta)) files.push(buildMeta)
  const offenders = await findMatches([...new Set(files)], [
    /\b(?:Creator\s+Preview|version|v)\s*0\.6(?:\.0)?\b/i,
    /["']0\.6\.0["']/,
    /\b__TAIL_ROOM_VERSION__\s*=\s*["']0\.6(?:\.0)?["']/,
    /["']raster-scene["']/,
  ])
  assert.deepEqual(offenders, [], `Remove stale v0.6/raster identity markers:\n${offenders.join('\n')}`)
})

test('dist is a complete byte-for-byte static build of current runtime sources', async () => {
  assert.equal(await exists(DIST), true, 'Missing dist/; run the production build before architecture tests')
  const packagePath = resolve(ROOT, 'package.json')
  const buildMetaPath = resolve(DIST, 'build-meta.json')
  const pkg = JSON.parse(await readText(packagePath))
  assert.equal(await exists(buildMetaPath), true, 'Missing dist/build-meta.json')
  const buildMeta = JSON.parse(await readText(buildMetaPath))
  assert.equal(buildMeta.version, pkg.version, 'dist/build-meta.json version does not match package.json')

  const sourceMappings = [{ source: resolve(ROOT, 'index.html'), output: resolve(DIST, 'index.html') }]
  const sourceFiles = await walk(resolve(ROOT, 'src'))
  for (const source of sourceFiles) sourceMappings.push({ source, output: resolve(DIST, 'src', relative(resolve(ROOT, 'src'), source)) })

  const vendorRoot = resolve(ROOT, 'vendor')
  for (const source of await walk(vendorRoot)) sourceMappings.push({ source, output: resolve(DIST, 'vendor', relative(vendorRoot, source)) })

  const publicRoot = resolve(ROOT, 'public')
  for (const source of await walk(publicRoot)) sourceMappings.push({ source, output: resolve(DIST, relative(publicRoot, source)) })

  const robots = resolve(ROOT, 'robots.txt')
  if (await exists(robots)) sourceMappings.push({ source: robots, output: resolve(DIST, 'robots.txt') })

  const missing = []
  const changed = []
  for (const { source, output } of sourceMappings) {
    if (!(await exists(output))) {
      missing.push(`${repoPath(source)} -> ${repoPath(output)}`)
      continue
    }
    if (sha256(await readFile(source)) !== sha256(await readFile(output))) changed.push(`${repoPath(source)} != ${repoPath(output)}`)
  }

  const sourceSet = new Set(sourceFiles.map(file => toPosix(relative(resolve(ROOT, 'src'), file))))
  const extraDistSources = (await walk(resolve(DIST, 'src')))
    .map(file => toPosix(relative(resolve(DIST, 'src'), file)))
    .filter(file => !sourceSet.has(file))

  assert.deepEqual(missing, [], `Production build is missing runtime files:\n${missing.join('\n')}`)
  assert.deepEqual(changed, [], `Production build contains stale runtime files:\n${changed.join('\n')}`)
  assert.deepEqual(extraDistSources, [], `Production build contains obsolete src files:\n${extraDistSources.join('\n')}`)
})
