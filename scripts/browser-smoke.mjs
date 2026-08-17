import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const ARTIFACT_DIR = resolve(ROOT, 'artifacts/v0.7')
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
const processLogs = new Map()
const children = []
let driver = null

const report = {
  schema: 1,
  milestone: 'v0.7',
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
    canvasCount: document.querySelectorAll('#game canvas').length,
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
  return waitFor(`${scene} WebGL readiness`, () => driver.execute(`
    return Boolean(
      window.__TAIL_ROOM_READY__ === true &&
      window.__TAIL_ROOM_QA__?.ready === true &&
      window.__TAIL_ROOM_QA__?.renderer === 'webgl' &&
      window.__TAIL_ROOM_QA__?.scene === ${JSON.stringify(scene)}
    );
  `), { timeoutMs: 30_000 })
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

function assertRoomSnapshot(snapshot, size) {
  const [expectedWidth, expectedHeight] = size.split('x').map(Number)
  assert.equal(snapshot.version, '0.7.0', `${size}: unexpected application version`)
  assert.equal(snapshot.ready, true, `${size}: runtime did not reach ready state`)
  assert.equal(snapshot.qa.renderer, 'webgl', `${size}: Phaser did not select WebGL`)
  assert.equal(snapshot.qa.scene, 'RoomScene', `${size}: RoomScene is not active`)
  assert.equal(snapshot.appMode, 'room', `${size}: DOM UI is not in room mode`)
  assert.equal(snapshot.canvasCount, 1, `${size}: expected exactly one Phaser canvas`)
  assert.ok(snapshot.appRect, `${size}: #app has no measurable bounds`)
  assert.ok(snapshot.canvasRect, `${size}: the Phaser canvas has no measurable bounds`)
  assert.ok(snapshot.webgl, `${size}: the Phaser canvas has no WebGL context`)
  assert.equal(snapshot.webgl.contextLost, false, `${size}: WebGL context is lost`)
  assert.deepEqual(snapshot.layers, REQUIRED_LAYERS, `${size}: Phaser layer order differs from the v0.7 contract`)
  assert.ok(Math.abs(snapshot.appRect.width - expectedWidth) < 0.5, `${size}: app width is ${snapshot.appRect.width}`)
  assert.ok(Math.abs(snapshot.appRect.height - expectedHeight) < 0.5, `${size}: app height is ${snapshot.appRect.height}`)
  assert.deepEqual(snapshot.horizontalOverflow, { document: false, body: false, app: false }, `${size}: horizontal overflow detected`)
  assert.equal(snapshot.runtimeErrorVisible, false, `${size}: runtime error UI is visible`)
  assert.equal(snapshot.bootError, null, `${size}: BootScene reported an error`)
  assert.equal(snapshot.qa.placeholderTextures?.created, 23, `${size}: expected 23 separate placeholder textures`)
  assert.deepEqual(snapshot.gameChildTags, ['CANVAS'], `${size}: #game contains a DOM world overlay`)
  assert.equal(snapshot.legacyHotspotCount, 0, `${size}: legacy DOM hotspot selector detected`)
  assert.deepEqual(snapshot.transparentHotspots, [], `${size}: transparent DOM hotspot detected`)
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

function canvasPoint(rect, designX, designY) {
  return {
    x: Math.round(rect.x + (designX / 393) * rect.width),
    y: Math.round(rect.y + (designY / 852) * rect.height),
  }
}

async function runInteractionCase() {
  const result = { size: '393x852', status: 'running', steps: [] }
  report.interaction = result
  try {
    await driver.navigate(`${APP_ORIGIN}/?qa=393x852&scene=first-meeting`)
    await waitForScene('FirstMeetingScene')
    result.steps.push({ name: 'first-meeting-ready', screenshot: await driver.saveElementScreenshot('#app', 'first-meeting-ready.png') })

    const canvasRect = await driver.execute(`
      const rect = document.querySelector('#game canvas').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    `)
    const petPath = [
      canvasPoint(canvasRect, 177, 580),
      { ...canvasPoint(canvasRect, 185, 590), duration: 320 },
      { ...canvasPoint(canvasRect, 193, 602), duration: 320 },
      { ...canvasPoint(canvasRect, 200, 613), duration: 320 },
      { ...canvasPoint(canvasRect, 207, 624), duration: 320 },
    ]
    await pointerSequence(petPath, { pointerId: 'petting-finger', pauseMs: 220 })
    await waitFor('name panel after slow petting', () => driver.execute(visibleScript('#namePanel')))
    assert.equal(await driver.execute(visibleScript('#namePanel')), true, 'Slow touch drag did not open the name panel')
    result.steps.push({ name: 'name-panel-open', screenshot: await driver.saveElementScreenshot('#app', 'first-meeting-name-panel.png') })

    await driver.click(await driver.find('#startLife'))
    await waitForScene('RoomScene')
    assert.equal(await driver.execute("return document.querySelector('#app')?.dataset.mode;"), 'room', 'Start button did not enter room mode')
    result.steps.push({ name: 'room-after-start', screenshot: await driver.saveElementScreenshot('#app', 'first-meeting-room.png') })

    const roomCanvasRect = await driver.execute(`
      const rect = document.querySelector('#game canvas').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    `)
    const bowlPoint = canvasPoint(roomCanvasRect, 333, 775)
    const hitTarget = await driver.execute(`
      const element = document.elementFromPoint(arguments[0], arguments[1]);
      return element ? { tag: element.tagName, id: element.id, className: String(element.className || '') } : null;
    `, [bowlPoint.x, bowlPoint.y])
    assert.equal(hitTarget?.tag, 'CANVAS', `Bowl coordinate is covered by ${JSON.stringify(hitTarget)}`)
    await pointerSequence([bowlPoint], { pointerId: 'bowl-finger', pauseMs: 160 })
    await waitFor('food sheet after bowl tap', () => driver.execute(visibleScript('#foodSheet')))
    assert.equal(await driver.execute(visibleScript('#foodSheet')), true, 'Touching the bowl did not open the food sheet')
    result.steps.push({ name: 'food-sheet-open', screenshot: await driver.saveElementScreenshot('#app', 'room-food-sheet.png') })
    result.runtime = await driver.execute(RUNTIME_SNAPSHOT)
    result.browserLogs = await driver.browserLogs()
    assertRoomSnapshot(result.runtime, '393x852')
    assertNoSevereLogs(result.browserLogs, 'first-meeting interaction')
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
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
