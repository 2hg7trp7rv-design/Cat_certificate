import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const ARTIFACT_DIR = resolve(ROOT, 'artifacts/v0.8')
const APP_PORT = Number(process.env.SMOKE_APP_PORT || 4173)
const DRIVER_PORT = Number(process.env.SMOKE_DRIVER_PORT || 9515)
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`
const DRIVER_ORIGIN = `http://127.0.0.1:${DRIVER_PORT}`
const ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf'
const ROOM_SIZES = ['320x667', '393x852', '430x932']
const REQUIRED_LAYERS = [
  'roomLayer',
  'shadowLayer',
  'furnitureLayer',
  'catLayer',
  'foregroundLayer',
  'lightLayer',
]
const REQUIRED_CORE_CENTERS = ['cat', 'bowl', 'toy', 'bed', 'window']
const processLogs = new Map()
const children = []
let driver = null

const report = {
  schema: 1,
  milestone: 'v0.8',
  createdAt: new Date().toISOString(),
  environment: {
    runner: process.env.RUNNER_ENVIRONMENT || null,
    os: process.platform,
    architecture: process.arch,
    node: process.version,
    requestedRenderer: 'Chrome headless / ANGLE SwiftShader WebGL',
    unsafeSwiftShaderFlag: true,
    diagnosticOnly: true,
  },
  scope: {
    ciSoftwareWebGL: true,
    iOSSafari: false,
    physicalIPhone: false,
    hardwareGPU: false,
    productionPerformance: false,
  },
  rooms: [],
  interaction: null,
  status: 'running',
}

const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))

async function executable(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    if (!candidate.includes('/')) return candidate
    try {
      await access(candidate, fsConstants.X_OK)
      return candidate
    } catch {
      // Try the next preinstalled location.
    }
  }
  return candidates.filter(Boolean).at(-1)
}

function spawnLogged(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
  const output = []
  const record = (stream, chunk) => {
    const line = `[${new Date().toISOString()}] ${stream}: ${chunk}`
    output.push(line)
    if (process.env.CI) process[stream === 'stderr' ? 'stderr' : 'stdout'].write(`[${label}] ${chunk}`)
  }
  child.stdout?.on('data', chunk => record('stdout', chunk.toString()))
  child.stderr?.on('data', chunk => record('stderr', chunk.toString()))
  child.on('error', error => output.push(`[${new Date().toISOString()}] process error: ${error.stack || error}`))
  child.on('exit', (code, signal) => output.push(`[${new Date().toISOString()}] exit code=${code} signal=${signal}`))
  processLogs.set(label, output)
  children.push(child)
  return child
}

async function request(url, { method = 'GET', body, timeoutMs = 15_000 } = {}) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { value: text }
    }
  }
  const protocolError = payload?.value?.error
  if (!response.ok || protocolError) {
    const message = payload?.value?.message || payload?.message || text || `${response.status} ${response.statusText}`
    throw new Error(`${method} ${url} failed: ${message}`)
  }
  return payload?.value ?? payload
}

async function waitFor(label, check, { timeoutMs = 20_000, intervalMs = 150 } = {}) {
  const startedAt = Date.now()
  let lastError = null
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await sleep(intervalMs)
  }
  const suffix = lastError ? ` Last error: ${lastError.message}` : ''
  throw new Error(`Timed out waiting for ${label}.${suffix}`)
}

class WebDriverClient {
  constructor(origin) {
    this.origin = origin
    this.sessionId = null
    this.capabilities = null
  }

  async create() {
    const chromeBinary = await executable([
      process.env.CHROME_PATH,
      process.env.GOOGLE_CHROME_BIN,
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      'google-chrome',
    ])
    const result = await request(`${this.origin}/session`, {
      method: 'POST',
      body: {
        capabilities: {
          alwaysMatch: {
            browserName: 'chrome',
            pageLoadStrategy: 'normal',
            'goog:loggingPrefs': { browser: 'ALL' },
            'goog:chromeOptions': {
              binary: chromeBinary,
              args: [
                '--headless=new',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--enable-gpu',
                '--enable-webgl',
                '--ignore-gpu-blocklist',
                '--enable-unsafe-swiftshader',
                '--use-gl=angle',
                '--use-angle=swiftshader-webgl',
                '--touch-events=enabled',
                '--hide-scrollbars',
                '--force-device-scale-factor=1',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--window-size=1200,1100',
              ],
            },
          },
        },
      },
      timeoutMs: 30_000,
    })
    this.sessionId = result.sessionId
    this.capabilities = result.capabilities
    assert.ok(this.sessionId, 'ChromeDriver did not return a W3C session id')
    await this.command('POST', '/window/rect', { x: 0, y: 0, width: 1200, height: 1100 })
  }

  async command(method, path, body, options) {
    assert.ok(this.sessionId, 'WebDriver session is not available')
    return request(`${this.origin}/session/${this.sessionId}${path}`, { method, body, ...options })
  }

  navigate(url) {
    return this.command('POST', '/url', { url }, { timeoutMs: 30_000 })
  }

  execute(script, args = []) {
    return this.command('POST', '/execute/sync', { script, args })
  }

  async find(selector) {
    const element = await this.command('POST', '/element', { using: 'css selector', value: selector })
    assert.ok(element?.[ELEMENT_KEY], `WebDriver could not find ${selector}`)
    return element[ELEMENT_KEY]
  }

  click(elementId) {
    return this.command('POST', `/element/${elementId}/click`, {})
  }

  actions(actions) {
    return this.command('POST', '/actions', { actions: Array.isArray(actions) ? actions : [actions] }, { timeoutMs: 30_000 })
  }

  releaseActions() {
    return this.command('DELETE', '/actions')
  }

  async saveElementScreenshot(selector, filename) {
    const elementId = await this.find(selector)
    const base64 = await this.command('GET', `/element/${elementId}/screenshot`)
    const image = Buffer.from(base64, 'base64')
    await writeFile(resolve(ARTIFACT_DIR, filename), image)
    return {
      file: filename,
      bytes: image.length,
      width: image.readUInt32BE(16),
      height: image.readUInt32BE(20),
    }
  }

  async savePageScreenshot(filename) {
    const base64 = await this.command('GET', '/screenshot')
    const image = Buffer.from(base64, 'base64')
    await writeFile(resolve(ARTIFACT_DIR, filename), image)
    return { file: filename, bytes: image.length }
  }

  async browserLogs() {
    for (const path of ['/se/log', '/log']) {
      try {
        return await this.command('POST', path, { type: 'browser' })
      } catch {
        // ChromeDriver has used both endpoint forms; try the other one.
      }
    }
    return []
  }

  async close() {
    if (!this.sessionId) return
    const sessionId = this.sessionId
    this.sessionId = null
    try {
      await request(`${this.origin}/session/${sessionId}`, { method: 'DELETE', timeoutMs: 10_000 })
    } catch {
      // Cleanup must not hide the smoke-test result.
    }
  }
}

const RUNTIME_SNAPSHOT = `
  const app = document.querySelector('#app');
  const canvas = document.querySelector('#game canvas');
  const runtimeError = document.querySelector('#runtimeError');
  const qa = window.__TAIL_ROOM_QA__ || {};
  const appRect = app?.getBoundingClientRect();
  const canvasRect = canvas?.getBoundingClientRect();
  const canvasStyle = canvas ? getComputedStyle(canvas) : null;
  const uiFontFaces = document.fonts
    ? [...document.fonts].filter(face => face.family.replace(/["']/g, '') === 'Tail Room JP')
    : [];
  let gl = null;
  let webgl = null;
  if (canvas) {
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      webgl = {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        contextLost: gl.isContextLost(),
      };
    }
  }
  const visible = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const transparentHotspots = [...document.querySelectorAll('#app button, #app a, #app input, #app [role="button"]')]
    .filter(visible)
    .filter(element => {
      const style = getComputedStyle(element);
      const identity = [element.id, element.className, element.getAttribute('data-hotspot'), element.getAttribute('data-zone')]
        .filter(Boolean).join(' ');
      const label = (element.getAttribute('aria-label') || element.textContent || element.value || '').trim();
      const explicitlyLegacy = /hotspot|(?:cat|intro-cat|window|bed|bowl|toy|room)[-_]?zone/i.test(identity);
      const effectivelyInvisible = Number.parseFloat(style.opacity || '1') <= 0.05 || style.pointerEvents === 'none';
      const hiddenAccessibleControl = element.getAttribute('aria-hidden') === 'true' && style.pointerEvents !== 'none';
      return explicitlyLegacy || effectivelyInvisible || hiddenAccessibleControl || (!label && style.backgroundColor === 'rgba(0, 0, 0, 0)');
    })
    .map(element => ({ id: element.id, className: String(element.className), tag: element.tagName }));
  const legacySelectors = '.hotspot, [data-hotspot], [data-zone], #introCat, #catZone, #windowZone, #bedZone, #bowlZone, #toyZone, #roomZone';
  return {
    version: window.__TAIL_ROOM_VERSION__ || null,
    ready: window.__TAIL_ROOM_READY__ === true && qa.ready === true,
    qa,
    appMode: app?.dataset.mode || null,
    appRect: appRect ? { x: appRect.x, y: appRect.y, width: appRect.width, height: appRect.height } : null,
    canvasRect: canvasRect ? { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height } : null,
    canvasAttributes: canvas ? { width: canvas.width, height: canvas.height } : null,
    canvasClient: canvas ? { width: canvas.clientWidth, height: canvas.clientHeight } : null,
    canvasCss: canvasStyle ? {
      width: Number.parseFloat(canvasStyle.width),
      height: Number.parseFloat(canvasStyle.height),
      imageRendering: canvasStyle.imageRendering,
    } : null,
    canvasCount: document.querySelectorAll('#game canvas').length,
    uiFont: {
      setStatus: document.fonts?.status || null,
      computedFamily: app ? getComputedStyle(app).fontFamily : null,
      faces: uiFontFaces.map(face => ({ family: face.family, weight: face.weight, status: face.status })),
      loaded: document.fonts?.status === 'loaded'
        && uiFontFaces.length === 2
        && uiFontFaces.every(face => face.status === 'loaded'),
    },
    webgl,
    runtimeErrorVisible: runtimeError ? visible(runtimeError) : true,
    bootError: qa.bootError || null,
    layers: Array.isArray(qa.layers) ? qa.layers : [],
    horizontalOverflow: {
      document: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      body: document.body.scrollWidth > document.body.clientWidth,
      app: app ? app.scrollWidth > app.clientWidth : true,
    },
    gameChildTags: [...document.querySelector('#game')?.children || []].map(element => element.tagName),
    legacyHotspotCount: document.querySelectorAll(legacySelectors).length,
    transparentHotspots,
  };
`

async function waitForScene(scene) {
  try {
    return await waitFor(`${scene} WebGL readiness`, () => driver.execute(`
      const uiFontFaces = document.fonts
        ? [...document.fonts].filter(face => face.family.replace(/["']/g, '') === 'Tail Room JP')
        : [];
      return Boolean(
        window.__TAIL_ROOM_READY__ === true &&
        window.__TAIL_ROOM_QA__?.ready === true &&
        window.__TAIL_ROOM_QA__?.renderer === 'webgl' &&
        window.__TAIL_ROOM_QA__?.scene === ${JSON.stringify(scene)} &&
        document.fonts?.status === 'loaded' &&
        uiFontFaces.length === 2 &&
        uiFontFaces.every(face => face.status === 'loaded')
      );
    `), { timeoutMs: 30_000 })
  } catch (error) {
    const runtime = await driver.execute(`
      const qa = window.__TAIL_ROOM_QA__ || {};
      return {
        documentReadyState: document.readyState,
        appMode: document.querySelector('#app')?.dataset.mode || null,
        canvasCount: document.querySelectorAll('#game canvas').length,
        ready: window.__TAIL_ROOM_READY__ === true,
        qaReady: qa.ready === true,
        renderer: qa.renderer || null,
        scene: qa.scene || null,
        bootError: qa.bootError || null,
        contextLost: qa.contextLost === true,
        uiFonts: document.fonts ? [...document.fonts].map(face => ({
          family: face.family,
          weight: face.weight,
          status: face.status,
        })) : [],
      };
    `).catch(diagnosticError => ({ diagnosticError: diagnosticError.message }))
    const browserLogs = await driver.browserLogs().catch(diagnosticError => ([{
      level: 'DIAGNOSTIC_ERROR',
      message: diagnosticError.message,
    }]))
    const diagnostics = {
      runtime,
      browserLogs: browserLogs.slice(-20).map(entry => ({
        level: entry.level || null,
        message: String(entry.message || '').slice(0, 2_000),
        timestamp: entry.timestamp || null,
      })),
    }
    const enriched = new Error(`${error.message} Scene diagnostics: ${JSON.stringify(diagnostics)}`, { cause: error })
    enriched.sceneDiagnostics = diagnostics
    throw enriched
  }
}

async function warmedFpsDiagnostic() {
  await sleep(1_500)
  const samples = []
  for (let index = 0; index < 12; index += 1) {
    const fps = await driver.execute('return Number(window.__TAIL_ROOM_QA__?.fps?.current || 0);')
    if (Number.isFinite(fps) && fps > 0) samples.push(fps)
    await sleep(250)
  }
  const average = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : null
  return {
    warmupMs: 1_500,
    sampleIntervalMs: 250,
    samples,
    minimum: samples.length ? Math.min(...samples) : null,
    average: average === null ? null : Number(average.toFixed(2)),
    maximum: samples.length ? Math.max(...samples) : null,
    appReported: await driver.execute('return window.__TAIL_ROOM_QA__?.fps || null;'),
    diagnosticOnly: true,
  }
}

function assertPlainBounds(bounds, label) {
  assert.ok(bounds, `${label}: bounds diagnostics are unavailable`)
  assert.deepEqual(
    Object.keys(bounds).sort(),
    ['bottom', 'height', 'right', 'width', 'x', 'y'],
    `${label}: bounds must contain plain numeric geometry only`,
  )
  for (const property of ['x', 'y', 'width', 'height', 'right', 'bottom']) {
    assert.ok(Number.isFinite(bounds[property]), `${label}: bounds.${property} is not finite`)
  }
  assert.ok(bounds.width > 0 && bounds.height > 0, `${label}: bounds are empty`)
  assert.ok(Math.abs(bounds.right - (bounds.x + bounds.width)) < 0.001, `${label}: bounds.right is inconsistent`)
  assert.ok(Math.abs(bounds.bottom - (bounds.y + bounds.height)) < 0.001, `${label}: bounds.bottom is inconsistent`)
  return bounds
}

function assertRoomSnapshot(snapshot, size) {
  const [expectedWidth, expectedHeight] = size.split('x').map(Number)
  assert.equal(snapshot.version, '0.8.0', `${size}: unexpected application version`)
  assert.equal(snapshot.ready, true, `${size}: runtime did not reach ready state`)
  assert.equal(snapshot.qa.renderer, 'webgl', `${size}: Phaser did not select WebGL`)
  assert.equal(snapshot.qa.scene, 'RoomScene', `${size}: RoomScene is not active`)
  assert.equal(snapshot.appMode, 'room', `${size}: DOM UI is not in room mode`)
  assert.equal(snapshot.canvasCount, 1, `${size}: expected exactly one Phaser canvas`)
  assert.equal(snapshot.uiFont?.loaded, true, `${size}: bundled Japanese UI fonts did not load`)
  assert.match(snapshot.uiFont?.computedFamily || '', /^"?Tail Room JP"?/, `${size}: bundled UI font is not first in the font stack`)
  assert.ok(snapshot.appRect, `${size}: #app has no measurable bounds`)
  assert.ok(snapshot.canvasRect, `${size}: the Phaser canvas has no measurable bounds`)
  assert.ok(snapshot.canvasAttributes, `${size}: the Phaser canvas has no bitmap dimensions`)
  assert.ok(snapshot.canvasClient, `${size}: the Phaser canvas has no client dimensions`)
  assert.ok(snapshot.canvasCss, `${size}: the Phaser canvas has no computed style`)
  assert.ok(snapshot.webgl, `${size}: the Phaser canvas has no WebGL context`)
  assert.equal(snapshot.webgl.contextLost, false, `${size}: WebGL context is lost`)
  assert.equal(snapshot.qa.contextLost, false, `${size}: the runtime reported a lost WebGL context`)
  assert.deepEqual(snapshot.layers, REQUIRED_LAYERS, `${size}: Phaser layer order differs from the v0.8 contract`)
  assert.ok(Math.abs(snapshot.appRect.width - expectedWidth) < 0.5, `${size}: app width is ${snapshot.appRect.width}`)
  assert.ok(Math.abs(snapshot.appRect.height - expectedHeight) < 0.5, `${size}: app height is ${snapshot.appRect.height}`)
  assert.ok(Math.abs(snapshot.canvasRect.width - expectedWidth) < 0.5, `${size}: canvas width is ${snapshot.canvasRect.width}`)
  assert.ok(Math.abs(snapshot.canvasRect.height - expectedHeight) < 0.5, `${size}: canvas height is ${snapshot.canvasRect.height}`)
  assert.deepEqual(
    snapshot.canvasAttributes,
    { width: expectedWidth, height: expectedHeight },
    `${size}: canvas bitmap attributes do not match the QA viewport`,
  )
  assert.deepEqual(
    snapshot.canvasClient,
    { width: expectedWidth, height: expectedHeight },
    `${size}: canvas CSS client dimensions do not match the QA viewport`,
  )
  assert.ok(Math.abs(snapshot.canvasCss.width - expectedWidth) < 0.5, `${size}: computed canvas width is ${snapshot.canvasCss.width}`)
  assert.ok(Math.abs(snapshot.canvasCss.height - expectedHeight) < 0.5, `${size}: computed canvas height is ${snapshot.canvasCss.height}`)
  assert.ok(
    ['pixelated', 'crisp-edges'].includes(snapshot.canvasCss.imageRendering),
    `${size}: canvas image-rendering is ${JSON.stringify(snapshot.canvasCss.imageRendering)}`,
  )
  assert.deepEqual(snapshot.horizontalOverflow, { document: false, body: false, app: false }, `${size}: horizontal overflow detected`)
  assert.equal(snapshot.runtimeErrorVisible, false, `${size}: runtime error UI is visible`)
  assert.equal(snapshot.bootError, null, `${size}: BootScene reported an error`)
  assert.equal(snapshot.qa.pixelTextures?.temporary, false, `${size}: runtime still reports temporary art`)
  assert.equal(snapshot.qa.pixelTextures?.created, 131, `${size}: v0.8 pixel texture inventory changed unexpectedly`)
  assert.equal(snapshot.qa.pixelTextures?.nonEmpty, 131, `${size}: one or more pixel textures rendered empty`)
  assert.equal(snapshot.qa.pixelTextures?.grid, 8, `${size}: pixel texture grid is not 8px`)
  assert.equal(snapshot.qa.pixelWorld?.zoom, 2, `${size}: world camera zoom is not the fixed 2× contract`)
  assert.equal(snapshot.qa.pixelWorld?.grid, 8, `${size}: world grid is not the fixed 8px contract`)
  assert.ok(snapshot.qa.room?.behavior, `${size}: cat behavior diagnostics are unavailable`)
  assert.ok(Number.isFinite(snapshot.qa.room.behavior.clock), `${size}: cat behavior clock is not finite`)
  assert.equal(snapshot.qa.room?.camera?.width, expectedWidth, `${size}: room camera width does not match the viewport`)
  assert.equal(snapshot.qa.room?.camera?.height, expectedHeight, `${size}: room camera height does not match the viewport`)
  assert.equal(snapshot.qa.room?.camera?.zoom, 2, `${size}: room camera is not using 2× zoom`)
  assert.equal(snapshot.qa.room?.visibility?.toy, true, `${size}: room toy remained hidden outside its catch frame`)
  assertPlainBounds(snapshot.qa.room?.bounds?.cat, `${size}: cat`)
  for (const name of ['bed', 'bowl', 'toy', 'window']) {
    assertPlainBounds(snapshot.qa.room?.bounds?.objects?.[name], `${size}: ${name}`)
  }
  assert.deepEqual(snapshot.gameChildTags, ['CANVAS'], `${size}: #game contains a DOM world overlay`)
  assert.equal(snapshot.legacyHotspotCount, 0, `${size}: legacy DOM hotspot selector detected`)
  assert.deepEqual(snapshot.transparentHotspots, [], `${size}: transparent DOM hotspot detected`)
}

function worldToCanvasPoint(snapshot, point, { round = true } = {}) {
  const room = snapshot?.qa?.room
  const camera = room?.camera
  const rect = snapshot?.canvasRect
  assert.ok(camera && rect, 'World-to-canvas conversion requires QA camera and canvas geometry')
  const scaleX = rect.width / camera.width
  const scaleY = rect.height / camera.height
  const worldViewX = camera.scrollX + (camera.width / 2) - (camera.width / (2 * camera.zoom))
  const worldViewY = camera.scrollY + (camera.height / 2) - (camera.height / (2 * camera.zoom))
  const converted = {
    x: rect.x + ((point.x - worldViewX) * camera.zoom) * scaleX,
    y: rect.y + ((point.y - worldViewY) * camera.zoom) * scaleY,
  }
  return round ? { x: Math.round(converted.x), y: Math.round(converted.y) } : converted
}

function assertCoreCentersVisible(snapshot, size) {
  const centers = snapshot.qa.room?.centers
  const rect = snapshot.canvasRect
  assert.ok(centers, `${size}: room center diagnostics are unavailable`)
  const visibleCenters = {}

  for (const name of REQUIRED_CORE_CENTERS) {
    const center = centers[name]
    assert.ok(
      center && Number.isFinite(center.x) && Number.isFinite(center.y),
      `${size}: ${name} has no finite world center`,
    )
    const point = worldToCanvasPoint(snapshot, center)
    assert.ok(
      point.x >= rect.x && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height,
      `${size}: ${name} center ${JSON.stringify(point)} is outside the canvas`,
    )
    visibleCenters[name] = { world: center, canvas: point }
  }

  return visibleCenters
}

function assertCatBoundsVisible(snapshot, size) {
  const bounds = assertPlainBounds(snapshot.qa.room?.bounds?.cat, `${size}: cat`)
  const rect = snapshot.canvasRect

  const topLeft = worldToCanvasPoint(snapshot, bounds, { round: false })
  const bottomRight = worldToCanvasPoint(snapshot, { x: bounds.right, y: bounds.bottom }, { round: false })
  assert.ok(topLeft.x >= rect.x, `${size}: cat extends beyond the left canvas edge`)
  assert.ok(topLeft.y >= rect.y, `${size}: cat extends beyond the top canvas edge`)
  assert.ok(bottomRight.x <= rect.x + rect.width, `${size}: cat extends beyond the right canvas edge`)
  assert.ok(bottomRight.y <= rect.y + rect.height, `${size}: cat extends beyond the bottom canvas edge`)

  return { world: bounds, canvas: { topLeft, bottomRight } }
}

function assertNoSevereLogs(logs, label) {
  const severe = (Array.isArray(logs) ? logs : [])
    .filter(entry => String(entry.level).toUpperCase() === 'SEVERE')
    .filter(entry => !/favicon\.ico|404 \(Not Found\)/i.test(String(entry.message)))
  assert.deepEqual(severe, [], `${label}: severe browser console errors detected`)
}

async function runRoomCase(size) {
  const result = { size, status: 'running' }
  report.rooms.push(result)
  try {
    await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room&debug=1`)
    await waitForScene('RoomScene')
    result.warmedFps = await warmedFpsDiagnostic()
    await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room`)
    await waitForScene('RoomScene')
    result.runtime = await driver.execute(RUNTIME_SNAPSHOT)
    result.screenshot = await driver.saveElementScreenshot('#app', `room-${size}.png`)
    if (size === '393x852') {
      result.night = await driver.execute(`
        const app = document.querySelector('#app');
        const advance = document.querySelector('[data-time="3600000"]');
        let leftInitialNight = app?.dataset.phase !== 'night';
        let shiftedHours = 0;
        while (shiftedHours < 25) {
          advance.click();
          shiftedHours += 1;
          if (app.dataset.phase !== 'night') leftInitialNight = true;
          if (leftInitialNight && app.dataset.phase === 'night') break;
        }
        return { phase: app?.dataset.phase || null, shiftedHours, virtualTime: document.querySelector('#debugTime')?.textContent || null };
      `)
      await sleep(500)
      result.night.runtime = await driver.execute(RUNTIME_SNAPSHOT)
      result.night.screenshot = await driver.saveElementScreenshot('#app', 'room-393x852-night.png')
      assert.equal(result.night.phase, 'night', '393x852: creator time controls did not reach the night phase')
      assert.equal(result.night.runtime.qa.scene, 'RoomScene', '393x852 night: RoomScene is not active')
      assert.equal(result.night.runtime.webgl?.contextLost, false, '393x852 night: WebGL context is lost')
      assert.deepEqual(
        { width: result.night.screenshot.width, height: result.night.screenshot.height },
        { width: 393, height: 852 },
        '393x852 night: element screenshot is not clipped to the exact app bounds',
      )
    }
    result.browserLogs = await driver.browserLogs()
    assertRoomSnapshot(result.runtime, size)
    result.coreCenters = assertCoreCentersVisible(result.runtime, size)
    result.catBounds = assertCatBoundsVisible(result.runtime, size)
    const [expectedWidth, expectedHeight] = size.split('x').map(Number)
    assert.deepEqual(
      { width: result.screenshot.width, height: result.screenshot.height },
      { width: expectedWidth, height: expectedHeight },
      `${size}: element screenshot is not clipped to the exact app bounds`,
    )
    assert.equal(result.warmedFps.appReported?.warmed, true, `${size}: debug FPS sampling did not finish its warm-up`)
    assert.ok(result.warmedFps.samples.length > 0, `${size}: no warmed FPS diagnostic samples were recorded`)
    assertNoSevereLogs(result.browserLogs, size)
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
    if (error.sceneDiagnostics) result.sceneDiagnostics = error.sceneDiagnostics
    try {
      result.failureScreenshot = await driver.savePageScreenshot(`room-${size}-failure.png`)
    } catch {
      // The JSON failure remains authoritative if the browser session is gone.
    }
    throw error
  }
}

const visibleScript = selector => `
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element || element.hidden) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
`

async function pointerSequence(points, { pointerId, pauseMs = 180 } = {}) {
  const actions = [
    { type: 'pointerMove', duration: 0, origin: 'viewport', x: points[0].x, y: points[0].y },
    { type: 'pointerDown', button: 0 },
    { type: 'pause', duration: pauseMs },
  ]
  for (const point of points.slice(1)) {
    actions.push({ type: 'pointerMove', duration: point.duration || 300, origin: 'viewport', x: point.x, y: point.y })
  }
  actions.push({ type: 'pause', duration: pauseMs }, { type: 'pointerUp', button: 0 })
  try {
    await driver.actions({
      type: 'pointer',
      id: pointerId,
      parameters: { pointerType: 'touch' },
      actions,
    })
  } finally {
    await driver.releaseActions().catch(() => {})
  }
}

async function runInteractionCase() {
  const result = { size: '393x852', status: 'running', steps: [] }
  report.interaction = result
  try {
    await driver.navigate(`${APP_ORIGIN}/?qa=393x852&scene=first-meeting`)
    await waitForScene('FirstMeetingScene')
    const firstMeetingRuntime = await driver.execute(RUNTIME_SNAPSHOT)
    assert.equal(firstMeetingRuntime.qa.scene, 'FirstMeetingScene', 'First meeting scene diagnostics are unavailable')
    assert.equal(firstMeetingRuntime.appMode, 'first-meeting', 'First meeting DOM mode is not active')
    assert.deepEqual(firstMeetingRuntime.layers, REQUIRED_LAYERS, 'First meeting does not use the six-layer world')
    assert.equal(firstMeetingRuntime.qa.pixelTextures?.created, 131, 'First meeting texture inventory is incomplete')
    result.firstMeetingCenters = assertCoreCentersVisible(firstMeetingRuntime, '393x852 first meeting')
    result.firstMeetingCatBounds = assertCatBoundsVisible(firstMeetingRuntime, '393x852 first meeting')
    result.steps.push({ name: 'first-meeting-ready', screenshot: await driver.saveElementScreenshot('#app', 'first-meeting-ready.png') })

    const catCenter = firstMeetingRuntime.qa.room.centers.cat
    const petWorldPath = [
      { x: catCenter.x - 10, y: catCenter.y - 32 },
      { x: catCenter.x - 5, y: catCenter.y - 33 },
      { x: catCenter.x, y: catCenter.y - 34 },
      { x: catCenter.x + 5, y: catCenter.y - 33 },
      { x: catCenter.x + 10, y: catCenter.y - 32 },
    ]
    const petPath = petWorldPath.map((point, index) => ({
      ...worldToCanvasPoint(firstMeetingRuntime, point),
      ...(index ? { duration: 340 } : {}),
    }))
    await pointerSequence(petPath, { pointerId: 'petting-finger', pauseMs: 220 })
    await waitFor('name panel after slow petting', () => driver.execute(visibleScript('#namePanel')))
    assert.equal(await driver.execute(visibleScript('#namePanel')), true, 'Slow touch drag did not open the name panel')
    result.steps.push({ name: 'name-panel-open', screenshot: await driver.saveElementScreenshot('#app', 'first-meeting-name-panel.png') })

    result.defaultName = await driver.execute("return document.querySelector('#petNameInput')?.value || null;")
    assert.equal(result.defaultName, 'こむぎ', 'The name panel did not preserve the default cat name')
    await driver.click(await driver.find('#startLife'))
    await waitForScene('RoomScene')
    assert.equal(await driver.execute("return document.querySelector('#app')?.dataset.mode;"), 'room', 'Start button did not enter room mode')
    assert.equal(
      await driver.execute("return document.querySelector('#petNameTitle')?.textContent?.trim() || null;"),
      'こむぎ',
      'Starting without edits did not use the default cat name',
    )
    result.steps.push({ name: 'room-after-start', screenshot: await driver.saveElementScreenshot('#app', 'first-meeting-room.png') })

    const roomRuntime = await driver.execute(RUNTIME_SNAPSHOT)
    assertRoomSnapshot(roomRuntime, '393x852')
    result.roomCenters = assertCoreCentersVisible(roomRuntime, '393x852 interaction room')
    const bowlPoint = worldToCanvasPoint(roomRuntime, roomRuntime.qa.room.centers.bowl)
    const hitTarget = await driver.execute(`
      const element = document.elementFromPoint(arguments[0], arguments[1]);
      return element ? { tag: element.tagName, id: element.id, className: String(element.className || '') } : null;
    `, [bowlPoint.x, bowlPoint.y])
    assert.equal(hitTarget?.tag, 'CANVAS', `Bowl coordinate is covered by ${JSON.stringify(hitTarget)}`)
    await pointerSequence([bowlPoint], { pointerId: 'bowl-finger', pauseMs: 160 })
    await waitFor('food sheet after bowl tap', () => driver.execute(visibleScript('#foodSheet')))
    assert.equal(await driver.execute(visibleScript('#foodSheet')), true, 'Touching the bowl did not open the food sheet')
    result.steps.push({ name: 'food-sheet-open', screenshot: await driver.saveElementScreenshot('#app', 'room-food-sheet.png') })

    await driver.click(await driver.find('#foodSheet [data-close]'))
    await waitFor('food sheet close', async () => !(await driver.execute(visibleScript('#foodSheet'))))
    const playRuntime = await driver.execute(RUNTIME_SNAPSHOT)
    const bedPoint = worldToCanvasPoint(playRuntime, playRuntime.qa.room.centers.bed)
    await pointerSequence([bedPoint], { pointerId: 'bed-finger', pauseMs: 160 })
    await waitFor('bed touch feedback', () => driver.execute(`
      const toast = document.querySelector('#toast');
      return !toast?.hidden && /寝床|眠/.test(toast?.textContent || '');
    `))
    result.steps.push({ name: 'bed-touch-feedback' })

    const toyPoint = worldToCanvasPoint(playRuntime, playRuntime.qa.room.centers.toy)
    const toyHitTarget = await driver.execute(`
      const element = document.elementFromPoint(arguments[0], arguments[1]);
      return element ? { tag: element.tagName, id: element.id, className: String(element.className || '') } : null;
    `, [toyPoint.x, toyPoint.y])
    assert.equal(toyHitTarget?.tag, 'CANVAS', `Toy coordinate is covered by ${JSON.stringify(toyHitTarget)}`)
    await pointerSequence([toyPoint], { pointerId: 'toy-finger', pauseMs: 160 })
    await waitFor('player toy sequence', () => driver.execute(`
      return window.__TAIL_ROOM_QA__?.room?.behavior?.action === 'player-play';
    `), { timeoutMs: 8_000 })

    const observedMotion = new Set()
    let playStarted = false
    let pounceScreenshot = null
    let catchScreenshot = null
    const playDeadline = Date.now() + 12_000
    while (Date.now() < playDeadline) {
      const playDiagnostic = await driver.execute(`
        const room = window.__TAIL_ROOM_QA__?.room;
        return room ? { behavior: room.behavior || null, toyVisible: room.visibility?.toy } : null;
      `)
      const behavior = playDiagnostic?.behavior
      if (behavior?.action === 'player-play') {
        playStarted = true
        if (behavior.state) observedMotion.add(behavior.state)
        if (behavior.state === 'play-pounce' && !pounceScreenshot) {
          pounceScreenshot = await driver.saveElementScreenshot('#app', 'room-toy-pounce.png')
        }
        if (behavior.state === 'play-catch' && !catchScreenshot) {
          assert.equal(playDiagnostic.toyVisible, false, 'Room toy must hide while the cat carries its caught toy')
          catchScreenshot = await driver.saveElementScreenshot('#app', 'room-toy-catch.png')
        }
      } else if (playStarted) {
        break
      }
      await sleep(100)
    }
    const expectedMotion = ['walk', 'play-notice', 'play-crouch', 'play-pounce', 'play-catch', 'play-recover']
    assert.deepEqual(
      expectedMotion.filter(state => !observedMotion.has(state)),
      [],
      `Toy sequence omitted states: ${expectedMotion.filter(state => !observedMotion.has(state)).join(', ')}`,
    )
    assert.ok(pounceScreenshot, 'Toy sequence never produced screenshot evidence for play-pounce')
    assert.ok(catchScreenshot, 'Toy sequence never produced screenshot evidence for play-catch')
    assert.equal(
      await driver.execute('return window.__TAIL_ROOM_QA__?.room?.visibility?.toy;'),
      true,
      'Room toy was not restored after the play sequence',
    )
    result.toySequence = {
      states: [...observedMotion],
      screenshots: { pounce: pounceScreenshot, catch: catchScreenshot },
      roomToyRestored: true,
    }

    await driver.click(await driver.find('#creatorButton'))
    await waitFor('creator sheet before forced sleep', () => driver.execute(visibleScript('#creatorSheet')))

    const sleepDeadlineMs = 12_000
    const sleepStartedAt = Date.now()
    result.sleepSequence = {
      deadlineMs: sleepDeadlineMs,
      trigger: 'creator debug sleep',
      transitions: [],
      status: 'running',
    }
    await driver.click(await driver.find('#creatorSheet [data-debug="sleep"]'))

    let previousSleepState = null
    let sleepScreenshot = null
    let sleepRuntime = null
    while (Date.now() - sleepStartedAt < sleepDeadlineMs) {
      const diagnostic = await driver.execute(`
        const room = window.__TAIL_ROOM_QA__?.room;
        return room ? {
          behavior: room.behavior ? { ...room.behavior } : null,
          catCenter: room.centers?.cat ? { ...room.centers.cat } : null,
          catBounds: room.bounds?.cat ? { ...room.bounds.cat } : null,
        } : null;
      `)
      const state = diagnostic?.behavior?.action === 'sleep' ? diagnostic.behavior.state : null
      if (state && state !== previousSleepState) {
        result.sleepSequence.transitions.push({
          elapsedMs: Date.now() - sleepStartedAt,
          ...diagnostic,
        })
        previousSleepState = state
      }
      if (state === 'sleep-curl') {
        result.sleepSequence.reachedAtMs = Date.now() - sleepStartedAt
        sleepRuntime = await driver.execute(RUNTIME_SNAPSHOT)
        sleepScreenshot = await driver.saveElementScreenshot('#app', 'room-sleep-curl.png')
        break
      }
      await sleep(50)
    }

    const expectedSleepStates = ['walk', 'sleep-curl-transition', 'sleep-curl']
    const observedSleepStates = result.sleepSequence.transitions.map(entry => entry.behavior.state)
    let observedIndex = -1
    for (const expectedState of expectedSleepStates) {
      observedIndex = observedSleepStates.indexOf(expectedState, observedIndex + 1)
      assert.notEqual(observedIndex, -1, `Forced sleep sequence did not reach ${expectedState} in order`)
    }
    assert.ok(sleepRuntime, `Forced sleep did not reach sleep-curl within ${sleepDeadlineMs}ms`)
    assert.equal(sleepRuntime.qa.room.behavior.action, 'sleep', 'Sleep screenshot was not captured during the sleep action')
    assert.equal(sleepRuntime.qa.room.behavior.state, 'sleep-curl', 'Sleep screenshot was not captured on the curl loop')
    assert.deepEqual(
      { width: sleepScreenshot.width, height: sleepScreenshot.height },
      { width: 393, height: 852 },
      'Sleep-curl screenshot does not match the 393x852 app bounds',
    )
    result.sleepSequence.status = 'passed'
    result.sleepSequence.completedAtMs = Date.now() - sleepStartedAt
    result.sleepSequence.screenshot = sleepScreenshot
    result.sleepSequence.finalBehavior = sleepRuntime.qa.room.behavior
    result.sleepSequence.catBounds = assertCatBoundsVisible(sleepRuntime, '393x852 sleep-curl')
    result.steps.push({ name: 'forced-sleep-curl', screenshot: sleepScreenshot })

    result.runtime = sleepRuntime
    result.browserLogs = await driver.browserLogs()
    assertRoomSnapshot(result.runtime, '393x852')
    result.finalCenters = assertCoreCentersVisible(result.runtime, '393x852 interaction final')
    result.finalCatBounds = assertCatBoundsVisible(result.runtime, '393x852 interaction final')
    assertNoSevereLogs(result.browserLogs, 'first-meeting interaction')
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
    if (error.sceneDiagnostics) result.sceneDiagnostics = error.sceneDiagnostics
    if (result.sleepSequence?.status === 'running') {
      result.sleepSequence.status = 'failed'
      result.sleepSequence.error = result.error
    }
    try {
      result.failureScreenshot = await driver.savePageScreenshot('interaction-failure.png')
    } catch {
      // Preserve the primary interaction error.
    }
    throw error
  }
}

async function flushArtifacts() {
  await mkdir(ARTIFACT_DIR, { recursive: true })
  report.completedAt = new Date().toISOString()
  await writeFile(resolve(ARTIFACT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  for (const [label, lines] of processLogs) {
    await writeFile(resolve(ARTIFACT_DIR, `${label}.log`), `${lines.join('')}\n`)
  }
}

async function cleanup() {
  await driver?.close()
  for (const child of children.reverse()) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  }
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true })
  const devServer = spawnLogged('dev-server', process.execPath, [resolve(ROOT, 'scripts/dev.mjs')], {
    cwd: resolve(ROOT, 'dist'),
    env: { ...process.env, PORT: String(APP_PORT) },
  })
  await waitFor('Tail Room development server', async () => {
    if (devServer.exitCode !== null) throw new Error(`dev server exited with ${devServer.exitCode}`)
    const response = await fetch(`${APP_ORIGIN}/`, { signal: AbortSignal.timeout(2_000) })
    return response.ok
  })

  const driverBinary = await executable([
    process.env.CHROMEDRIVER_PATH,
    process.env.CHROMEWEBDRIVER && join(process.env.CHROMEWEBDRIVER, 'chromedriver'),
    '/usr/local/share/chromedriver-linux64/chromedriver',
    '/usr/bin/chromedriver',
    'chromedriver',
  ])
  const driverProcess = spawnLogged('chromedriver', driverBinary, [`--port=${DRIVER_PORT}`, '--allowed-origins=*'])
  await waitFor('ChromeDriver', async () => {
    if (driverProcess.exitCode !== null) throw new Error(`ChromeDriver exited with ${driverProcess.exitCode}`)
    const status = await request(`${DRIVER_ORIGIN}/status`, { timeoutMs: 2_000 })
    return status?.ready
  })

  driver = new WebDriverClient(DRIVER_ORIGIN)
  await driver.create()
  report.environment.webdriverCapabilities = driver.capabilities

  const failures = []
  for (const size of ROOM_SIZES) {
    try {
      await runRoomCase(size)
    } catch (error) {
      failures.push(error)
    }
  }
  try {
    await runInteractionCase()
  } catch (error) {
    failures.push(error)
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} WebGL smoke case(s) failed`)
  report.status = 'passed'
}

try {
  await main()
} catch (error) {
  report.status = 'failed'
  report.error = error.stack || String(error)
  console.error(error)
  process.exitCode = 1
} finally {
  await cleanup()
  await flushArtifacts()
}
