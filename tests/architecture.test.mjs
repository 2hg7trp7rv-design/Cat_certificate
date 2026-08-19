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
const REQUIRED_LAYERS = ['room', 'shadow', 'furniture', 'cat', 'foreground', 'light']

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

test('v0.8 has no Base64 scene chunks or assets_source dependency', async () => {
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

test('all four v0.8 scenes exist, extend Phaser.Scene, and are registered', async () => {
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

test('Phaser is explicitly configured for capped-HiDPI direct-image WebGL', async () => {
  const configPath = resolve(ROOT, 'src/game/config.js')
  assert.equal(await exists(configPath), true, 'Missing src/game/config.js')
  const source = await readText(configPath)
  const entry = await readText(resolve(ROOT, 'src/main.js'))
  const hiDpi = await readText(resolve(ROOT, 'src/game/render/HiDpiScale.js'))
  const debugScene = await readText(resolve(ROOT, 'src/game/scenes/DebugScene.js'))
  assert.match(source, /\btype\s*:\s*Phaser\.WEBGL\b/, 'Phaser config must use `type: Phaser.WEBGL`')
  assert.doesNotMatch(source, /\btype\s*:\s*Phaser\.(?:AUTO|CANVAS|HEADLESS)\b/, 'AUTO/CANVAS/HEADLESS renderer fallback is not accepted for v0.8.1')
  assert.match(entry, /getContext\(['"]webgl['"]\)/, 'preflight must probe the WebGL1 context Phaser 4.2.1 requests')
  assert.doesNotMatch(entry, /getContext\(['"]webgl2['"]\)/, 'a WebGL2-only preflight can disagree with the Phaser renderer')
  assert.match(entry, /WEBGL_lose_context/, 'the preflight context must be released before Phaser allocates its renderer')
  assert.doesNotMatch(
    `${entry}\n${source}`,
    /failIfMajorPerformanceCaveat\s*:\s*true/,
    'WebGL must remain available on low-power GPUs; performance is validated separately',
  )
  assert.match(source, /pixelArt\s*:\s*false/, 'the approved high-detail PNGs must not be forced through Phaser pixel-art sampling')
  assert.match(source, /roundPixels\s*:\s*false/, 'fractional centered cover must not be shifted by renderer pixel rounding')
  assert.match(source, /antialias\s*:\s*true/, 'the approved high-detail PNGs require filtered downscaling')
  assert.match(source, /mode\s*:\s*Phaser\.Scale\.NONE/, 'HiDPI backing-store control requires Phaser Scale.NONE')
  assert.doesNotMatch(source, /mode\s*:\s*Phaser\.Scale\.RESIZE/, 'Scale.RESIZE collapses the backing store to one pixel per CSS pixel')
  assert.match(source, /hiDpiMetrics\?\.backingWidth/, 'config width must come from measured HiDPI backing metrics')
  assert.match(source, /hiDpiMetrics\?\.backingHeight/, 'config height must come from measured HiDPI backing metrics')
  assert.match(source, /hiDpiMetrics\?\.zoom/, 'Scale.NONE must start at the inverse render-scale zoom')
  assert.match(hiDpi, /MAX_RENDER_SCALE\s*=\s*2\b/, 'the backing-store scale must remain capped at DPR 2')
  assert.match(hiDpi, /scaleManager\.setZoom\(metrics\.zoom\)/, 'runtime HiDPI sync must use public ScaleManager.setZoom')
  assert.match(hiDpi, /scaleManager\.resize\(metrics\.backingWidth,\s*metrics\.backingHeight\)/, 'runtime HiDPI sync must use public ScaleManager.resize')
  assert.match(entry, /getInitialHiDpiMetrics\(gameHost\)/, 'startup must measure the actual #game CSS box before creating Phaser')
  assert.ok(
    entry.indexOf('applyQaSize(options.requestedSize)') < entry.indexOf('getInitialHiDpiMetrics(gameHost)'),
    'QA CSS dimensions must be applied before the startup HiDPI measurement',
  )
  assert.match(entry, /installHiDpiScaleSync\(instance\.scale,\s*gameHost/, 'postBoot must keep Scale.NONE synchronized with host and DPR changes')
  assert.match(entry, /Phaser\.Core\.Events\.DESTROY,\s*\(\)\s*=>\s*hiDpiScale\.destroy\(\)/, 'game destruction must clean up HiDPI observers')
  assert.match(debugScene, /this\.scale\.displayScale\?\.x/, 'DebugScene CSS-space overlay coordinates must account for the backing scale')
  assert.match(debugScene, /setPosition\(10\s*\*\s*backingScale,\s*96\s*\*\s*backingScale\)/, 'DebugScene panel coordinates must scale with the backing store')

  const camera = await readText(resolve(ROOT, 'src/game/world/WorldCamera.js'))
  assert.match(camera, /WORLD_WIDTH\s*=\s*852\b/, 'world width must equal the approved room PNG')
  assert.match(camera, /WORLD_HEIGHT\s*=\s*1846\b/, 'world height must equal the approved room PNG')
  assert.match(camera, /calculateWorldZoom/, 'world camera must calculate a viewport-dependent cover zoom')
  assert.match(camera, /Math\.max\(width\s*\/\s*WORLD_WIDTH,\s*height\s*\/\s*WORLD_HEIGHT\)/, 'world camera must use cover rather than contain/stretch')
  assert.match(camera, /setZoom\(zoom\)/, 'world scenes must apply the calculated cover zoom')

  const styles = await readText(resolve(ROOT, 'src/styles.css'))
  const canvasRule = styles.match(/\.game-host canvas\s*\{[\s\S]*?\}/)?.[0] ?? ''
  assert.match(canvasRule, /image-rendering\s*:\s*auto/, 'Canvas CSS must preserve filtered direct-image rendering')
})

test('runtime preloads the approved direct-art manifest without procedural fallback art', async () => {
  const manifestPath = resolve(ROOT, 'src/game/art/DirectArtManifest.js')
  const directArtPath = resolve(ROOT, 'src/game/art/DirectArt.js')
  assert.equal(await exists(manifestPath), true, 'Missing src/game/art/DirectArtManifest.js')
  assert.equal(await exists(directArtPath), true, 'Missing src/game/art/DirectArt.js')
  const manifest = await readText(manifestPath)
  const directArt = await readText(directArtPath)
  const boot = await readText(resolve(ROOT, 'src/game/scenes/BootScene.js'))
  const roomWorld = await readText(resolve(ROOT, 'src/game/world/RoomWorld.js'))
  const interactiveObject = await readText(resolve(ROOT, 'src/game/entities/InteractiveObject.js'))
  assert.match(manifest, /DIRECT_ART_MANIFEST/)
  assert.match(manifest, /IMG_3036\.png/)
  assert.match(manifest, /IMG_3037\.png/)
  assert.match(manifest, /IMG_3038\.png/)
  assert.match(directArt, /preloadDirectArt/)
  assert.match(directArt, /scene\.load\.image/)
  assert.match(directArt, /prepareDirectArt/)
  assert.match(boot, /preload\s*\(\)/)
  assert.match(boot, /preloadDirectArt\(this\)/)
  assert.match(boot, /prepareDirectArt\(this\)/)
  assert.match(roomWorld, /DIRECT_ART_FILES\.room\.key,\s*['"]__BASE['"]/, 'the approved room must render its full __BASE frame')
  assert.match(roomWorld, /DIRECT_DERIVED_TEXTURES\.bedForeground\.key/, 'bed occlusion must use a WebGL-safe transparent derivative')
  assert.match(interactiveObject, /getInteractionBounds\s*\(/, 'invisible Canvas hit containers must expose their non-empty interaction footprint')
  assert.match(roomWorld, /getInteractionBounds\?\.\(\)\s*\?\?\s*object\?\.getBounds/, 'responsive QA must prefer Canvas interaction bounds over empty Container render bounds')
  assert.doesNotMatch(roomWorld, /\.setMask\s*\(/, 'Phaser 4 GameObject.setMask is not supported by the required WebGL renderer')
  assert.doesNotMatch(`${manifest}\n${directArt}\n${boot}`, /createPixelTextures|createPlaceholderTextures|placeholder\./)
  assert.equal(await exists(resolve(ROOT, 'src/game/art/PixelArt.js')), false, 'Remove the procedural PixelArt.js runtime fallback')
  assert.equal(await exists(resolve(ROOT, 'src/game/art/PlaceholderArt.js')), false, 'Remove v0.7 PlaceholderArt.js')
})

test('the six direct-art render layers are explicit Phaser display-list layers', async () => {
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

test('the visual-readback bridge and preserved framebuffer are strictly QA-query guarded', async () => {
  const roomWorld = await readText(resolve(ROOT, 'src/game/world/RoomWorld.js'))
  const config = await readText(resolve(ROOT, 'src/game/config.js'))
  const entry = await readText(resolve(ROOT, 'src/main.js'))

  assert.match(roomWorld, /QA_BRIDGE_KEY\s*=\s*['"]__TAIL_ROOM_QA_BRIDGE__['"]/)
  assert.match(roomWorld, /document\.documentElement\.dataset\.qa\s*!==\s*['"]true['"]/, 'QA bridge must reject normal documents')
  assert.match(
    roomWorld,
    /Object\.freeze\(\{[\s\S]*?inspect:[\s\S]*?getTextureSource:[\s\S]*?setPose:[\s\S]*?freezeFrame:[\s\S]*?resumeFrame:/,
    'QA bridge must expose only the guarded visual inspection, pose, and atomic frame-capture controls',
  )
  assert.match(roomWorld, /systems\?\.pause\?\./, 'QA frame capture must pause Scene Systems before PNG encoding')
  assert.match(roomWorld, /systems\?\.resume\?\./, 'QA frame capture must resume Scene Systems after PNG encoding')
  assert.match(roomWorld, /Boolean\(systems\?\.isPaused\?\.\(\)\)/, 'QA frame capture must report the actual Phaser paused state')
  assert.match(roomWorld, /delete\s+window\[QA_BRIDGE_KEY\]/, 'QA bridge must be removed during RoomWorld destruction')
  assert.doesNotMatch(entry, /__TAIL_ROOM_QA_BRIDGE__/, 'application entrypoint must not expose the QA bridge globally')

  assert.match(config, /preserveDrawingBuffer\s*=\s*false/, 'normal runtime must default framebuffer preservation off')
  assert.match(config, /preserveDrawingBuffer:\s*Boolean\(preserveDrawingBuffer\)/, 'renderer must use only the guarded option')
  assert.match(entry, /qaApproved\s*=\s*isLoopbackHostname\(location\.hostname\)\s*&&\s*QA_SIZES\.has\(requestedQaSize\)/, 'QA mode must require both loopback and an approved QA viewport')
  assert.match(entry, /preserveDrawingBuffer:\s*options\.qaApproved/, 'framebuffer preservation must require the complete QA authorization gate')
  assert.match(entry, /requestedScene\s*=\s*qaApproved\s*&&/, 'scene bypass must not be available to normal URLs')
})

test('WebGL smoke evidence is isolated to a freshly cleared v0.8.1 artifact directory', async () => {
  const smoke = await readText(resolve(ROOT, 'scripts/browser-smoke.mjs'))
  const workflow = await readText(resolve(ROOT, '.github/workflows/quality.yml'))

  assert.match(smoke, /ARTIFACT_DIR\s*=\s*resolve\(ROOT,\s*['"]artifacts\/v0\.8\.1['"]\)/)
  assert.match(smoke, /await\s+rm\(ARTIFACT_DIR,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/, 'smoke must clear prior evidence before creating screenshots')
  assert.match(smoke, /withFrozenQaFrame\([\s\S]*?play-pounce[\s\S]*?room-toy-pounce\.png/, 'pounce evidence must be captured from an atomic frozen frame')
  assert.match(smoke, /pounceScreenshot\.sha256[\s\S]*?catchScreenshot\.sha256/, 'pounce and catch PNG evidence must be proven distinct')
  assert.match(workflow, /name:\s*tail-room-v0\.8\.1-webgl-smoke/)
  assert.match(workflow, /path:\s*artifacts\/v0\.8\.1/)
  assert.doesNotMatch(`${smoke}\n${workflow}`, /artifacts\/v0\.8(?:\/|['"])/, 'v0.8 evidence path can mix stale PNGs into v0.8.1')
})

test('first meeting preserves the approved daytime source colors', async () => {
  const source = await readText(resolve(ROOT, 'src/game/world/RoomWorld.js'))
  assert.match(
    source,
    /const phase\s*=\s*this\.firstMeeting\s*\?\s*['"]day['"]\s*:/,
    'onboarding must not tint the approved source before the player sees it',
  )
})

test('Container hit areas account for Phaser display origins', async () => {
  const cat = await readText(resolve(ROOT, 'src/game/entities/Cat.js'))
  const interactive = await readText(resolve(ROOT, 'src/game/entities/InteractiveObject.js'))
  const combined = `${cat}\n${interactive}`

  assert.match(combined, /alignCenteredHitArea/)
  assert.equal((combined.match(/this\.displayOriginX/g) || []).length >= 2, true)
  assert.equal((combined.match(/this\.displayOriginY/g) || []).length >= 2, true)
  assert.doesNotMatch(
    combined,
    /this\.setDisplayOrigin\s*\(/,
    'Phaser 4 Containers do not implement setDisplayOrigin; translate their hit geometry instead',
  )
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

test('the required naming step cannot be dismissed into a stuck onboarding state', async () => {
  const ui = await readText(resolve(ROOT, 'src/ui/UIController.js'))
  assert.match(ui, /openSheet\s*!==\s*e\.namePanel\)\s*this\.close\(\)/)
  assert.match(ui, /openSheet\s*===\s*e\.namePanel\)\s*return/)
})

test('direct side-view cat poses flip with their travel direction', async () => {
  const cat = await readText(resolve(ROOT, 'src/game/entities/Cat.js'))
  assert.match(cat, /DIRECT_ART_FILES\.cat\.key/)
  assert.match(cat, /resolveDirectCatPose/)
  assert.match(cat, /flip\s*=\s*this\.facing\s*===\s*['"]right['"]/)
  assert.match(cat, /setFlipX\(flip\)/)
  assert.doesNotMatch(cat, /pixel\.cat\./)
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

test('runtime and package identify the v0.8.1 direct-art milestone', async () => {
  const packagePath = resolve(ROOT, 'package.json')
  const pkg = JSON.parse(await readText(packagePath))
  assert.equal(pkg.version, '0.8.1', 'package.json must identify the direct-art milestone')

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
    /\b(?:Creator\s+Preview|version|v)\s*0\.7(?:\.0)?\b/i,
    /["']0\.7\.0["']/,
    /\b__TAIL_ROOM_VERSION__\s*=\s*["']0\.6(?:\.0)?["']/,
    /["']raster-scene["']/,
  ])
  assert.deepEqual(offenders, [], `Remove stale pre-v0.8 identity markers:\n${offenders.join('\n')}`)
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
