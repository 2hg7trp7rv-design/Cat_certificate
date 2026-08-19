import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  DIRECT_ART_FILES,
  DIRECT_ART_MANIFEST,
  DIRECT_CAT_POSES,
  DIRECT_CAT_STATE_MAP,
  DIRECT_DERIVED_TEXTURES,
} from '../src/game/art/DirectArtManifest.js'

const ROOT = resolve(process.cwd())
const ARTIFACT_DIR = resolve(ROOT, 'artifacts/v0.8.1')
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
const DIRECT_POSE_NAMES = new Set(Object.keys(DIRECT_CAT_POSES))
const QA_BABY_CAT_SCALE = 0.75 * 0.86
const CAT_CONTAINER_SOURCE_SIZE = Object.freeze({ width: 500, height: 400 })
const CATCH_BALL_REPLACEMENT_ROI = Object.freeze({ x: 518, y: 1458, width: 68, height: 68 })
const processLogs = new Map()
const children = []
let driver = null

const report = {
  schema: 1,
  milestone: 'v0.8.1-direct-art',
  createdAt: new Date().toISOString(),
  environment: {
    runner: process.env.RUNNER_ENVIRONMENT || null,
    os: process.platform,
    architecture: process.arch,
    node: process.version,
    requestedRenderer: 'Chrome headless / ANGLE SwiftShader WebGL',
    unsafeSwiftShaderFlag: true,
    diagnosticOnly: true,
    qaPreserveDrawingBufferOnly: true,
  },
  scope: {
    ciSoftwareWebGL: true,
    qaReadbackPreservesDrawingBuffer: true,
    normalRuntimePreservesDrawingBuffer: false,
    iOSSafari: false,
    physicalIPhone: false,
    hardwareGPU: false,
    productionPerformance: false,
  },
  rooms: [],
  brandParity: null,
  interaction: null,
  responsiveInteractions: [],
  poseParity: [],
  derivedTextures: null,
  dprStatic: [],
  dprInputs: [],
  productionBridgeGuard: null,
  status: 'running',
}

const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const parseSize = size => {
  const [width, height] = String(size).split('x').map(Number)
  assert.ok(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0, `Invalid QA size: ${size}`)
  return { width, height }
}

const expectedCatRenderContract = ({ pose, facing, x, y }) => {
  const sourceOriginX = pose.pivot.x / pose.rect.width
  const flipX = facing === 'right'
  return {
    pose: pose.frame,
    facing,
    container: {
      texture: null,
      frame: null,
      x,
      y,
      originX: 0.5,
      originY: 0.5,
      scaleX: QA_BABY_CAT_SCALE,
      scaleY: QA_BABY_CAT_SCALE,
      displayWidth: CAT_CONTAINER_SOURCE_SIZE.width * QA_BABY_CAT_SCALE,
      displayHeight: CAT_CONTAINER_SOURCE_SIZE.height * QA_BABY_CAT_SCALE,
      visible: true,
      alpha: 1,
      flipX: false,
    },
    sprite: {
      texture: DIRECT_ART_FILES.cat.key,
      frame: pose.frame,
      x: 0,
      y: 0,
      originX: flipX ? 1 - sourceOriginX : sourceOriginX,
      originY: pose.pivot.y / pose.rect.height,
      scaleX: 1,
      scaleY: 1,
      displayWidth: pose.rect.width,
      displayHeight: pose.rect.height,
      visible: true,
      alpha: 1,
      flipX,
    },
  }
}

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

  executeAsync(script, args = []) {
    return this.command('POST', '/execute/async', { script, args }, { timeoutMs: 30_000 })
  }

  cdp(command, params = {}) {
    return this.command('POST', '/goog/cdp/execute', { cmd: command, params })
  }

  async emulateViewport(size, { deviceScaleFactor = 1 } = {}) {
    const { width, height } = parseSize(size)
    await this.cdp('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: true,
      screenWidth: width,
      screenHeight: height,
      positionX: 0,
      positionY: 0,
      screenOrientation: { type: 'portraitPrimary', angle: 0 },
    })
    await this.cdp('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 3,
    })
    return { width, height, deviceScaleFactor }
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
    const capture = await this.captureElementScreenshot(selector, filename)
    const { dataUrl: _dataUrl, ...evidence } = capture
    return evidence
  }

  async captureElementScreenshot(selector, filename) {
    const elementId = await this.find(selector)
    const base64 = await this.command('GET', `/element/${elementId}/screenshot`)
    const image = Buffer.from(base64, 'base64')
    await writeFile(resolve(ARTIFACT_DIR, filename), image)
    return {
      file: filename,
      bytes: image.length,
      width: image.readUInt32BE(16),
      height: image.readUInt32BE(20),
      dataUrl: `data:image/png;base64,${base64}`,
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
      const attributes = gl.getContextAttributes();
      webgl = {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        contextLost: gl.isContextLost(),
        preserveDrawingBuffer: attributes?.preserveDrawingBuffer === true,
        drawingBufferWidth: gl.drawingBufferWidth,
        drawingBufferHeight: gl.drawingBufferHeight,
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
  const hudStyle = document.querySelector('#hud') ? getComputedStyle(document.querySelector('#hud')) : null;
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
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      visualWidth: window.visualViewport?.width ?? null,
      visualHeight: window.visualViewport?.height ?? null,
      devicePixelRatio: window.devicePixelRatio,
      narrowQuery: matchMedia('(max-width: 340px)').matches,
      shortQuery: matchMedia('(max-height: 700px)').matches,
      hudLeft: hudStyle ? Number.parseFloat(hudStyle.left) : null,
      hudRight: hudStyle ? Number.parseFloat(hudStyle.right) : null,
    },
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
    qaBridgePresent: Boolean(window.__TAIL_ROOM_QA_BRIDGE__),
  };
`

const ROOM_PARITY_ROIS = Object.freeze([
  Object.freeze({ name: 'upper-wall', x: 90, y: 145, width: 130, height: 120 }),
  Object.freeze({ name: 'left-curtain', x: 285, y: 300, width: 82, height: 190 }),
  Object.freeze({ name: 'window-sky', x: 430, y: 300, width: 110, height: 130 }),
  Object.freeze({ name: 'sofa', x: 585, y: 790, width: 130, height: 105 }),
  Object.freeze({ name: 'lower-floor', x: 45, y: 1590, width: 180, height: 120 }),
])

const BRAND_PROBE_SCRIPT = `
  const options = arguments[0];
  const done = arguments[arguments.length - 1];
  (async () => {
    const emblem = document.querySelector('.intro-emblem');
    if (!emblem) throw new Error('First-meeting emblem element is missing');
    await emblem.decode?.();

    const expectedUrl = new URL(options.url, document.baseURI);
    const currentUrl = new URL(emblem.currentSrc || emblem.src, document.baseURI);
    if (expectedUrl.href !== currentUrl.href) {
      throw new Error('First-meeting emblem does not use the approved source URL');
    }

    const response = await fetch(expectedUrl, { cache: 'no-store' });
    if (!response.ok || response.type === 'opaque') {
      throw new Error('Approved first-meeting emblem fetch failed: ' + response.status);
    }
    const bytes = await response.arrayBuffer();
    const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const digest = [...digestBytes].map(value => value.toString(16).padStart(2, '0')).join('');
    if (digest !== options.sha256) throw new Error('Served first-meeting emblem SHA-256 changed');

    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    const reference = new Image();
    try {
      await new Promise((resolve, reject) => {
        reference.onload = resolve;
        reference.onerror = () => reject(new Error('Approved first-meeting emblem could not be decoded'));
        reference.src = blobUrl;
      });
      const captured = new Image();
      await new Promise((resolve, reject) => {
        captured.onload = resolve;
        captured.onerror = () => reject(new Error('Rendered first-meeting emblem screenshot could not be decoded'));
        captured.src = options.screenshotDataUrl;
      });

      const sampleSize = 256;
      const sample = document.createElement('canvas');
      sample.width = sampleSize;
      sample.height = sampleSize;
      const context = sample.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = true;
      context.drawImage(reference, 0, 0, sampleSize, sampleSize);
      const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
      let nonTransparent = 0;
      let opaque = 0;
      let lumaSum = 0;
      let lumaSquaredSum = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha <= 8) continue;
        nonTransparent += 1;
        if (alpha >= 247) opaque += 1;
        const luma = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
        lumaSum += luma;
        lumaSquaredSum += luma * luma;
      }
      const meanLuma = nonTransparent ? lumaSum / nonTransparent : 0;
      const lumaVariance = nonTransparent
        ? Math.max(0, lumaSquaredSum / nonTransparent - meanLuma * meanLuma)
        : 0;
      const rect = emblem.getBoundingClientRect();
      const style = getComputedStyle(emblem);
      const effectChain = [...function * () {
        let node = emblem;
        while (node instanceof Element) {
          yield node;
          node = node.parentElement;
        }
      }()].map(node => {
        const nodeStyle = getComputedStyle(node);
        return {
          tag: node.tagName,
          id: node.id || null,
          className: String(node.className || ''),
          hidden: Boolean(node.hidden),
          display: nodeStyle.display,
          visibility: nodeStyle.visibility,
          opacity: Number(nodeStyle.opacity),
          filter: nodeStyle.filter,
          transform: nodeStyle.transform,
          clipPath: nodeStyle.clipPath,
          mixBlendMode: nodeStyle.mixBlendMode,
        };
      });
      const ancestorsVisible = effectChain.every(node => {
        return !node.hidden
          && node.display !== 'none'
          && node.visibility !== 'hidden'
          && node.opacity > 0;
      });

      const renderedSize = 112;
      const expectedRendered = document.createElement('canvas');
      expectedRendered.width = renderedSize;
      expectedRendered.height = renderedSize;
      const expectedRenderedContext = expectedRendered.getContext('2d', { willReadFrequently: true });
      expectedRenderedContext.imageSmoothingEnabled = true;
      expectedRenderedContext.drawImage(reference, 0, 0, renderedSize, renderedSize);
      const expectedRenderedPixels = expectedRenderedContext.getImageData(0, 0, renderedSize, renderedSize).data;
      const actualRendered = document.createElement('canvas');
      actualRendered.width = renderedSize;
      actualRendered.height = renderedSize;
      const actualRenderedContext = actualRendered.getContext('2d', { willReadFrequently: true });
      actualRenderedContext.imageSmoothingEnabled = true;
      actualRenderedContext.drawImage(captured, 0, 0, renderedSize, renderedSize);
      const actualRenderedPixels = actualRenderedContext.getImageData(0, 0, renderedSize, renderedSize).data;
      const signedError = [0, 0, 0];
      const errors = [];
      let renderedChannelError = 0;
      let renderedBadPixels = 0;
      let renderedOpaqueInterior = 0;
      for (let index = 0; index < expectedRenderedPixels.length; index += 4) {
        if (expectedRenderedPixels[index + 3] < 250) continue;
        let pixelError = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          const difference = actualRenderedPixels[index + channel] - expectedRenderedPixels[index + channel];
          signedError[channel] += difference;
          pixelError += Math.abs(difference);
          renderedChannelError += Math.abs(difference);
        }
        pixelError /= 3;
        errors.push(pixelError);
        if (pixelError > 24) renderedBadPixels += 1;
        if (actualRenderedPixels[index + 3] >= 250) renderedOpaqueInterior += 1;
      }
      errors.sort((left, right) => left - right);
      const renderedCount = errors.length;
      const renderedPercentile = quantile => errors.length
        ? errors[Math.min(errors.length - 1, Math.floor((errors.length - 1) * quantile))]
        : 0;

      done({
        ok: true,
        url: currentUrl.pathname,
        sha256: digest,
        natural: { width: reference.naturalWidth, height: reference.naturalHeight },
        elementNatural: { width: emblem.naturalWidth, height: emblem.naturalHeight },
        rendered: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        style: {
          imageRendering: style.imageRendering,
          objectFit: style.objectFit,
          opacity: Number(style.opacity),
          filter: style.filter,
          transform: style.transform,
          clipPath: style.clipPath,
          mixBlendMode: style.mixBlendMode,
        },
        ancestorsVisible,
        effectChain,
        screenshot: {
          natural: { width: captured.naturalWidth, height: captured.naturalHeight },
          comparedOpaqueInterior: renderedCount,
          meanAbsoluteError: renderedChannelError / Math.max(1, renderedCount * 3),
          channelBias: signedError.map(value => value / Math.max(1, renderedCount)),
          maximumAbsoluteChannelBias: Math.max(...signedError.map(value => Math.abs(value / Math.max(1, renderedCount)))),
          badPixelRatio: renderedBadPixels / Math.max(1, renderedCount),
          opaqueInteriorRatio: renderedOpaqueInterior / Math.max(1, renderedCount),
          errorPercentiles: {
            p50: renderedPercentile(0.5),
            p90: renderedPercentile(0.9),
            p95: renderedPercentile(0.95),
            p99: renderedPercentile(0.99),
          },
        },
        sample: {
          pixels: sampleSize * sampleSize,
          nonTransparent,
          opaque,
          coverage: nonTransparent / (sampleSize * sampleSize),
          lumaVariance,
        },
      });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  })().catch(error => done({ ok: false, error: error.stack || String(error) }));
`

const VISUAL_PROBE_SCRIPT = `
  const options = arguments[0];
  const done = arguments[arguments.length - 1];
  (async () => {
    const bridge = window.__TAIL_ROOM_QA_BRIDGE__;
    if (!bridge) throw new Error('Guarded QA bridge is unavailable');

    if (options.kind === 'pose') bridge.setPose(options.poseName, options.facing || 'right');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = document.querySelector('#game canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl') || canvas?.getContext('experimental-webgl');
    if (!canvas || !gl) throw new Error('WebGL canvas is unavailable');
    while (gl.getError() !== gl.NO_ERROR) { /* Drain pre-existing renderer diagnostics. */ }
    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const previousPackAlignment = gl.getParameter(gl.PACK_ALIGNMENT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    gl.finish();
    const actual = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, actual);
    const glError = gl.getError();
    gl.pixelStorei(gl.PACK_ALIGNMENT, previousPackAlignment);
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
    if (glError !== gl.NO_ERROR) throw new Error('WebGL readPixels failed with ' + glError);

    const inspection = bridge.inspect();
    const camera = inspection.camera;
    if (!camera) throw new Error('Actual Phaser camera inspection is unavailable');
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const scaleX = width / camera.width;
    const scaleY = height / camera.height;
    const worldViewX = camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom);
    const worldViewY = camera.scrollY + camera.height / 2 - camera.height / (2 * camera.zoom);
    const worldToCanvas = (x, y) => ({
      x: (x - worldViewX) * camera.zoom * scaleX,
      y: (y - worldViewY) * camera.zoom * scaleY,
    });
    const makeCanvas = () => {
      const target = document.createElement('canvas');
      target.width = width;
      target.height = height;
      const context = target.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'low';
      return { canvas: target, context };
    };
    const loadImage = source => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode reference image: ' + source));
      image.src = source;
    });
    const loadVerifiedImage = async (source, expectedSha256) => {
      const url = new URL(source, document.baseURI);
      if (url.origin !== location.origin) throw new Error('Reference image is not same-origin: ' + url.href);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok || response.type === 'opaque') throw new Error('Reference fetch failed: ' + response.status + ' ' + url.href);
      const bytes = await response.arrayBuffer();
      const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const digest = [...digestBytes].map(value => value.toString(16).padStart(2, '0')).join('');
      if (expectedSha256 && digest !== expectedSha256) throw new Error('Served reference SHA-256 changed: ' + url.href);
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      try {
        return { image: await loadImage(blobUrl), digest };
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };
    const roomReference = await loadVerifiedImage(options.roomUrl, options.roomSha256);
    const roomImage = roomReference.image;
    const drawRoom = context => {
      const topLeft = worldToCanvas(0, 0);
      context.drawImage(
        roomImage,
        topLeft.x,
        topLeft.y,
        roomImage.naturalWidth * camera.zoom * scaleX,
        roomImage.naturalHeight * camera.zoom * scaleY,
      );
    };
    const drawObject = (context, image, object, sourceRect = null) => {
      const source = sourceRect || { x: 0, y: 0, width: image.width, height: image.height };
      const objectWidth = Number(object.displayWidth || source.width);
      const objectHeight = Number(object.displayHeight || source.height);
      const left = Number(object.x) - Number(object.originX || 0) * objectWidth;
      const top = Number(object.y) - Number(object.originY || 0) * objectHeight;
      const destination = worldToCanvas(left, top);
      context.drawImage(
        image,
        source.x,
        source.y,
        source.width,
        source.height,
        destination.x,
        destination.y,
        objectWidth * camera.zoom * scaleX,
        objectHeight * camera.zoom * scaleY,
      );
    };
    const drawCat = (context, catImage, pose, cat, expectedFlip = cat.sprite.flipX) => {
      const container = cat.container;
      const sprite = cat.sprite;
      const pivot = worldToCanvas(
        container.x + sprite.x * container.scaleX,
        container.y + sprite.y * container.scaleY,
      );
      const sx = Math.abs(container.scaleX * sprite.scaleX) * camera.zoom * scaleX;
      const sy = Math.abs(container.scaleY * sprite.scaleY) * camera.zoom * scaleY;
      context.save();
      context.translate(pivot.x, pivot.y);
      context.scale(expectedFlip ? -sx : sx, sy);
      context.drawImage(
        catImage,
        pose.rect.x,
        pose.rect.y,
        pose.rect.width,
        pose.rect.height,
        -pose.pivot.x,
        -pose.pivot.y,
        pose.rect.width,
        pose.rect.height,
      );
      context.restore();
    };
    const imageData = target => target.context.getImageData(0, 0, width, height).data;
    const expectedPixel = (data, x, y) => {
      const index = (y * width + x) * 4;
      return [data[index], data[index + 1], data[index + 2], data[index + 3]];
    };
    const actualPixel = (x, y) => {
      const index = ((height - 1 - y) * width + x) * 4;
      return [actual[index], actual[index + 1], actual[index + 2], actual[index + 3]];
    };
    const colorDistance = (left, right) =>
      (Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2])) / 3;
    const comparePoints = (points, expected, baseline = null) => {
      let channelError = 0;
      let severeChannels = 0;
      let badPixels = 0;
      let baselineDistance = 0;
      let baselineChanged = 0;
      let actualLuma = 0;
      let actualLumaSquared = 0;
      let expectedLuma = 0;
      let expectedLumaSquared = 0;
      let actualAlphaMinimum = 255;
      let actualAlphaMaximum = 0;
      let expectedAlphaMinimum = 255;
      let expectedAlphaMaximum = 0;
      let actualOpaque = 0;
      const signedChannelError = [0, 0, 0];
      const pixelErrors = [];
      let count = 0;
      for (const point of points) {
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const wanted = expectedPixel(expected, x, y);
        if (wanted[3] < 245) continue;
        const rendered = actualPixel(x, y);
        let pixelError = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          const error = Math.abs(rendered[channel] - wanted[channel]);
          channelError += error;
          pixelError += error;
          signedChannelError[channel] += rendered[channel] - wanted[channel];
          if (error > 48) severeChannels += 1;
        }
        pixelError /= 3;
        pixelErrors.push(pixelError);
        if (pixelError > 24) badPixels += 1;
        actualAlphaMinimum = Math.min(actualAlphaMinimum, rendered[3]);
        actualAlphaMaximum = Math.max(actualAlphaMaximum, rendered[3]);
        expectedAlphaMinimum = Math.min(expectedAlphaMinimum, wanted[3]);
        expectedAlphaMaximum = Math.max(expectedAlphaMaximum, wanted[3]);
        if (rendered[3] >= 245) actualOpaque += 1;
        const renderedLuma = rendered[0] * 0.2126 + rendered[1] * 0.7152 + rendered[2] * 0.0722;
        const wantedLuma = wanted[0] * 0.2126 + wanted[1] * 0.7152 + wanted[2] * 0.0722;
        actualLuma += renderedLuma;
        actualLumaSquared += renderedLuma * renderedLuma;
        expectedLuma += wantedLuma;
        expectedLumaSquared += wantedLuma * wantedLuma;
        if (baseline) {
          const distance = colorDistance(rendered, expectedPixel(baseline, x, y));
          baselineDistance += distance;
          if (distance > 8) baselineChanged += 1;
        }
        count += 1;
      }
      const channels = Math.max(1, count * 3);
      const actualMean = actualLuma / Math.max(1, count);
      const expectedMean = expectedLuma / Math.max(1, count);
      pixelErrors.sort((left, right) => left - right);
      const percentile = quantile => {
        if (!pixelErrors.length) return 0;
        return pixelErrors[Math.min(pixelErrors.length - 1, Math.floor((pixelErrors.length - 1) * quantile))];
      };
      const channelBias = signedChannelError.map(value => value / Math.max(1, count));
      return {
        count,
        requestedPoints: points.length,
        acceptedPointRatio: count / Math.max(1, points.length),
        meanAbsoluteError: channelError / channels,
        channelBias,
        maximumAbsoluteChannelBias: Math.max(...channelBias.map(Math.abs)),
        badPixelRatio: badPixels / Math.max(1, count),
        severeChannelRatio: severeChannels / channels,
        meanBaselineDistance: baseline ? baselineDistance / Math.max(1, count) : null,
        baselineChangedRatio: baseline ? baselineChanged / Math.max(1, count) : null,
        errorPercentiles: {
          p50: percentile(0.5),
          p90: percentile(0.9),
          p95: percentile(0.95),
          p99: percentile(0.99),
          maximum: pixelErrors.at(-1) ?? 0,
        },
        alpha: {
          actualMinimum: count ? actualAlphaMinimum : null,
          actualMaximum: count ? actualAlphaMaximum : null,
          expectedMinimum: count ? expectedAlphaMinimum : null,
          expectedMaximum: count ? expectedAlphaMaximum : null,
          actualOpaqueRatio: actualOpaque / Math.max(1, count),
        },
        actualLumaVariance: actualLumaSquared / Math.max(1, count) - actualMean * actualMean,
        expectedLumaVariance: expectedLumaSquared / Math.max(1, count) - expectedMean * expectedMean,
      };
    };

    if (options.kind === 'room') {
      const reference = makeCanvas();
      drawRoom(reference.context);
      const referencePixels = imageData(reference);
      const regions = options.rois.map(region => {
        const points = [];
        for (let sourceY = region.y + 1; sourceY < region.y + region.height - 1; sourceY += 3) {
          for (let sourceX = region.x + 1; sourceX < region.x + region.width - 1; sourceX += 3) {
            points.push(worldToCanvas(sourceX, sourceY));
          }
        }
        return { name: region.name, ...comparePoints(points, referencePixels) };
      });
      const cssWidth = Math.max(1, canvas.getBoundingClientRect().width);
      const fullFrameStep = Math.max(3, Math.round(3 * width / cssWidth));
      const catBounds = inspection.cat?.container?.bounds;
      const catExclusionTopLeft = catBounds
        ? worldToCanvas(catBounds.x - 50, catBounds.y - 50)
        : { x: -1, y: -1 };
      const catExclusionBottomRight = catBounds
        ? worldToCanvas(catBounds.right + 50, catBounds.bottom + 50)
        : { x: -1, y: -1 };
      const exclusion = {
        left: Math.min(catExclusionTopLeft.x, catExclusionBottomRight.x),
        right: Math.max(catExclusionTopLeft.x, catExclusionBottomRight.x),
        top: Math.min(catExclusionTopLeft.y, catExclusionBottomRight.y),
        bottom: Math.max(catExclusionTopLeft.y, catExclusionBottomRight.y),
      };
      const fullFramePoints = [];
      let fullFrameGridPoints = 0;
      for (let y = 1; y < height - 1; y += fullFrameStep) {
        for (let x = 1; x < width - 1; x += fullFrameStep) {
          fullFrameGridPoints += 1;
          const insideCatAndShadow = catBounds
            && x >= exclusion.left && x <= exclusion.right
            && y >= exclusion.top && y <= exclusion.bottom;
          if (!insideCatAndShadow) fullFramePoints.push({ x, y });
        }
      }
      return done({
        ok: true,
        kind: options.kind,
        buffer: { width, height },
        regions,
        totalCompared: regions.reduce((sum, region) => sum + region.count, 0),
        fullFrame: {
          gridStep: fullFrameStep,
          gridPoints: fullFrameGridPoints,
          excludedPoints: fullFrameGridPoints - fullFramePoints.length,
          exclusion,
          ...comparePoints(fullFramePoints, referencePixels),
        },
        actualLayerOrder: inspection.layerOrder,
      });
    }

    if (options.kind === 'pose') {
      const catImage = (await loadVerifiedImage(options.catUrl, options.catSha256)).image;
      const room = makeCanvas();
      drawRoom(room.context);
      const expected = makeCanvas();
      drawRoom(expected.context);
      drawCat(expected.context, catImage, options.pose, options.expectedCat, options.expectedCat.sprite.flipX);
      const mask = makeCanvas();
      drawCat(mask.context, catImage, options.pose, options.expectedCat, options.expectedCat.sprite.flipX);
      const roomPixels = imageData(room);
      const expectedPixels = imageData(expected);
      const maskPixels = imageData(mask);
      const points = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (maskPixels[(y * width + x) * 4 + 3] >= 235) points.push({ x, y });
        }
      }
      return done({
        ok: true,
        kind: options.kind,
        pose: options.poseName,
        metrics: comparePoints(points, expectedPixels, roomPixels),
        expectedCat: options.expectedCat,
        render: inspection.cat,
        actualLayerOrder: inspection.layerOrder,
      });
    }

    if (options.kind === 'derived') {
      const textures = {};
      for (const [name, specification] of Object.entries(options.textures)) {
        const source = bridge.getTextureSource(specification.key);
        if (!source) throw new Error('Derived texture source is unavailable: ' + specification.key);
        const actualCanvas = document.createElement('canvas');
        actualCanvas.width = specification.crop.width;
        actualCanvas.height = specification.crop.height;
        const actualContext = actualCanvas.getContext('2d', { willReadFrequently: true });
        actualContext.drawImage(source, 0, 0);
        const actualBytes = actualContext.getImageData(0, 0, actualCanvas.width, actualCanvas.height).data;

        const expectedCanvas = document.createElement('canvas');
        expectedCanvas.width = specification.crop.width;
        expectedCanvas.height = specification.crop.height;
        const expectedContext = expectedCanvas.getContext('2d', { willReadFrequently: true });
        expectedContext.beginPath();
        expectedContext.moveTo(specification.mask.polygon[0][0], specification.mask.polygon[0][1]);
        for (const point of specification.mask.polygon.slice(1)) expectedContext.lineTo(point[0], point[1]);
        expectedContext.closePath();
        expectedContext.clip();
        expectedContext.drawImage(
          roomImage,
          specification.crop.x,
          specification.crop.y,
          specification.crop.width,
          specification.crop.height,
          0,
          0,
          specification.crop.width,
          specification.crop.height,
        );
        const expectedBytes = expectedContext.getImageData(0, 0, expectedCanvas.width, expectedCanvas.height).data;
        let differingChannels = 0;
        let totalError = 0;
        let nonTransparent = 0;
        let opaque = 0;
        let hash = 0x811c9dc5;
        for (let index = 0; index < actualBytes.length; index += 1) {
          const error = Math.abs(actualBytes[index] - expectedBytes[index]);
          totalError += error;
          if (error > 1) differingChannels += 1;
          hash ^= actualBytes[index];
          hash = Math.imul(hash, 0x01000193);
          if (index % 4 === 3) {
            if (actualBytes[index] > 0) nonTransparent += 1;
            if (actualBytes[index] >= 250) opaque += 1;
          }
        }
        const cornerAlpha = [];
        for (const [x, y] of [[0, 0], [actualCanvas.width - 1, 0], [0, actualCanvas.height - 1], [actualCanvas.width - 1, actualCanvas.height - 1]]) {
          cornerAlpha.push(actualBytes[(y * actualCanvas.width + x) * 4 + 3]);
        }
        textures[name] = {
          width: actualCanvas.width,
          height: actualCanvas.height,
          pixels: actualCanvas.width * actualCanvas.height,
          nonTransparent,
          opaque,
          coverage: nonTransparent / (actualCanvas.width * actualCanvas.height),
          differingChannels,
          meanAbsoluteError: totalError / actualBytes.length,
          cornerAlpha,
          fnv1a: (hash >>> 0).toString(16).padStart(8, '0'),
        };
      }
      return done({ ok: true, kind: options.kind, textures });
    }

    if (options.kind === 'catch') {
      const catImage = (await loadVerifiedImage(options.catUrl, options.catSha256)).image;
      const caughtToySource = bridge.getTextureSource(options.caughtToy.key);
      if (!caughtToySource) throw new Error('Caught-toy texture source is unavailable');
      const room = makeCanvas();
      drawRoom(room.context);
      const withCover = makeCanvas();
      drawRoom(withCover.context);
      drawObject(withCover.context, roomImage, inspection.toyFloorCover, options.floorCover.rect);
      const withBall = makeCanvas();
      withBall.context.drawImage(withCover.canvas, 0, 0);
      drawObject(withBall.context, caughtToySource, inspection.caughtToy);
      const expected = makeCanvas();
      expected.context.drawImage(withBall.canvas, 0, 0);
      drawCat(expected.context, catImage, options.catPose, options.expectedCat, options.expectedCat.sprite.flipX);

      const coverMask = makeCanvas();
      drawObject(coverMask.context, roomImage, inspection.toyFloorCover, options.floorCover.rect);
      const ballMask = makeCanvas();
      drawObject(ballMask.context, caughtToySource, inspection.caughtToy);
      const catMask = makeCanvas();
      drawCat(catMask.context, catImage, options.catPose, options.expectedCat, options.expectedCat.sprite.flipX);
      const roomPixels = imageData(room);
      const coverPixels = imageData(withCover);
      const ballPixels = imageData(withBall);
      const expectedPixels = imageData(expected);
      const coverMaskPixels = imageData(coverMask);
      const ballMaskPixels = imageData(ballMask);
      const catMaskPixels = imageData(catMask);
      const coverPoints = [];
      const ballPoints = [];
      const fixedBallPoints = [];
      let fixedBallCandidates = 0;
      const fixedTopLeft = worldToCanvas(options.catchBallRoi.x, options.catchBallRoi.y);
      const fixedBottomRight = worldToCanvas(
        options.catchBallRoi.x + options.catchBallRoi.width,
        options.catchBallRoi.y + options.catchBallRoi.height,
      );
      const fixedLeft = Math.max(0, Math.ceil(Math.min(fixedTopLeft.x, fixedBottomRight.x)));
      const fixedRight = Math.min(width - 1, Math.floor(Math.max(fixedTopLeft.x, fixedBottomRight.x)));
      const fixedTop = Math.max(0, Math.ceil(Math.min(fixedTopLeft.y, fixedBottomRight.y)));
      const fixedBottom = Math.min(height - 1, Math.floor(Math.max(fixedTopLeft.y, fixedBottomRight.y)));
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const catAlpha = catMaskPixels[index + 3];
          const ballAlpha = ballMaskPixels[index + 3];
          const coverReplacesRoom = coverMaskPixels[index + 3] >= 250
            && colorDistance(expectedPixel(coverPixels, x, y), expectedPixel(roomPixels, x, y)) > 8;
          if (ballAlpha >= 170 && catAlpha < 45
            && colorDistance(expectedPixel(ballPixels, x, y), expectedPixel(coverPixels, x, y)) > 10) {
            ballPoints.push({ x, y });
          }
          if (coverReplacesRoom && catAlpha < 45 && ballAlpha < 45) {
            coverPoints.push({ x, y });
          }
          if (x >= fixedLeft && x <= fixedRight && y >= fixedTop && y <= fixedBottom && coverReplacesRoom) {
            fixedBallCandidates += 1;
            if (catAlpha < 45 && ballAlpha < 45) fixedBallPoints.push({ x, y });
          }
        }
      }
      return done({
        ok: true,
        kind: options.kind,
        cover: comparePoints(coverPoints, expectedPixels, roomPixels),
        ball: comparePoints(ballPoints, expectedPixels, coverPixels),
        fixedBallRoi: {
          world: { ...options.catchBallRoi },
          framebuffer: {
            x: fixedLeft,
            y: fixedTop,
            width: Math.max(0, fixedRight - fixedLeft + 1),
            height: Math.max(0, fixedBottom - fixedTop + 1),
          },
          candidateCount: fixedBallCandidates,
          ...comparePoints(fixedBallPoints, expectedPixels, roomPixels),
        },
        expectedCat: options.expectedCat,
        render: {
          toyFloorCover: inspection.toyFloorCover,
          caughtToy: inspection.caughtToy,
          cat: inspection.cat,
        },
      });
    }

    if (options.kind === 'bed') {
      const catImage = (await loadVerifiedImage(options.catUrl, options.catSha256)).image;
      const bedSource = bridge.getTextureSource(options.bedForeground.key);
      if (!bedSource) throw new Error('Bed foreground texture source is unavailable');
      const room = makeCanvas();
      drawRoom(room.context);
      const catComposite = makeCanvas();
      drawRoom(catComposite.context);
      drawCat(catComposite.context, catImage, options.catPose, options.expectedCat, options.expectedCat.sprite.flipX);
      const catMask = makeCanvas();
      drawCat(catMask.context, catImage, options.catPose, options.expectedCat, options.expectedCat.sprite.flipX);
      const bedMask = makeCanvas();
      drawObject(bedMask.context, bedSource, inspection.bedForeground);
      const roomPixels = imageData(room);
      const catPixels = imageData(catComposite);
      const catMaskPixels = imageData(catMask);
      const bedMaskPixels = imageData(bedMask);
      const overlap = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          if (catMaskPixels[index + 3] >= 160 && bedMaskPixels[index + 3] >= 180
            && colorDistance(expectedPixel(catPixels, x, y), expectedPixel(roomPixels, x, y)) > 18) {
            overlap.push({ x, y });
          }
        }
      }
      return done({
        ok: true,
        kind: options.kind,
        overlap: comparePoints(overlap, roomPixels, catPixels),
        expectedCat: options.expectedCat,
        render: { bedForeground: inspection.bedForeground, cat: inspection.cat },
      });
    }

    throw new Error('Unknown visual probe: ' + options.kind);
  })().catch(error => done({ ok: false, kind: options.kind, error: error?.stack || String(error) }));
`

async function runVisualProbe(options) {
  let expectedCat = null
  if (options.kind === 'pose') {
    expectedCat = expectedCatRenderContract({
      pose: options.pose,
      facing: options.facing,
      x: 370,
      y: 1320,
    })
  } else if (options.kind === 'catch') {
    expectedCat = expectedCatRenderContract({
      pose: options.catPose,
      facing: 'left',
      x: 551,
      y: 1510,
    })
  } else if (options.kind === 'bed') {
    expectedCat = expectedCatRenderContract({
      pose: options.catPose,
      facing: 'right',
      x: 744,
      y: 1170,
    })
  }
  const result = await driver.executeAsync(VISUAL_PROBE_SCRIPT, [{
    roomSha256: DIRECT_ART_FILES.room.sha256,
    catSha256: DIRECT_ART_FILES.cat.sha256,
    catchBallRoi: CATCH_BALL_REPLACEMENT_ROI,
    ...options,
    expectedCat,
  }])
  assert.equal(result?.ok, true, `${options.kind} visual probe failed: ${result?.error || 'unknown error'}`)
  return result
}

async function waitForScene(scene) {
  try {
    const uiFontLoad = await driver.executeAsync(`
      const done = arguments[arguments.length - 1];
      if (!document.fonts) {
        done({ error: 'CSS Font Loading API is unavailable', matchCounts: [], statuses: [] });
      } else {
        Promise.all([
          document.fonts.load('400 16px "Tail Room JP"', '日本語'),
          document.fonts.load('700 16px "Tail Room JP"', '日本語'),
        ]).then(groups => done({
          error: null,
          matchCounts: groups.map(group => group.length),
          statuses: groups.map(group => group.map(face => face.status)),
        })).catch(error => done({
          error: error?.message || String(error),
          matchCounts: [],
          statuses: [],
        }));
      }
    `)
    assert.equal(uiFontLoad.error, null, `Bundled Japanese UI font load failed: ${uiFontLoad.error}`)
    assert.deepEqual(uiFontLoad.matchCounts, [1, 1], 'Bundled Japanese UI font faces did not match both weights')
    assert.deepEqual(uiFontLoad.statuses, [['loaded'], ['loaded']], 'Bundled Japanese UI font faces did not finish loading')
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

function assertDirectArtSnapshot(snapshot, label) {
  const directArt = snapshot?.qa?.directArt
  assert.ok(directArt, `${label}: direct-art diagnostics are unavailable`)
  assert.equal(directArt.source, DIRECT_ART_MANIFEST.source, `${label}: approved source identity changed`)
  assert.equal(directArt.version, DIRECT_ART_MANIFEST.version, `${label}: direct-art manifest version changed`)
  assert.equal(directArt.files, Object.keys(DIRECT_ART_FILES).length, `${label}: not all approved files loaded`)
  assert.equal(directArt.poses, Object.keys(DIRECT_CAT_POSES).length, `${label}: not all approved cat poses registered`)
  assert.equal(directArt.derived, Object.keys(DIRECT_DERIVED_TEXTURES).length, `${label}: approved-source derivatives are incomplete`)
  assert.deepEqual(directArt.room, DIRECT_ART_MANIFEST.room, `${label}: approved room geometry changed`)
}

function assertBrandVisualParity(probe, label) {
  assert.equal(probe?.ok, true, `${label}: first-meeting emblem probe failed: ${probe?.error || 'unknown error'}`)
  assert.equal(probe.sha256, DIRECT_ART_FILES.brand.sha256, `${label}: first-meeting emblem bytes changed`)
  assert.ok(probe.url.endsWith('/assets/game/IMG_3038.png'), `${label}: first-meeting emblem URL changed`)
  assert.deepEqual(
    probe.natural,
    { width: DIRECT_ART_FILES.brand.width, height: DIRECT_ART_FILES.brand.height },
    `${label}: independently decoded emblem dimensions changed`,
  )
  assert.deepEqual(probe.elementNatural, probe.natural, `${label}: DOM emblem did not decode the approved full-resolution image`)
  assert.equal(probe.ancestorsVisible, true, `${label}: first-meeting emblem or an ancestor is hidden`)
  assert.ok(Math.abs(probe.rendered.width - 112) < 0.5, `${label}: emblem rendered width changed`)
  assert.ok(Math.abs(probe.rendered.height - 112) < 0.5, `${label}: emblem rendered height changed`)
  assert.ok(probe.rendered.x >= 0 && probe.rendered.y >= 0, `${label}: emblem begins outside the viewport`)
  assert.equal(probe.style.imageRendering, 'auto', `${label}: emblem filtering changed`)
  assert.equal(probe.style.objectFit, 'contain', `${label}: emblem object-fit changed`)
  assert.equal(probe.style.opacity, 1, `${label}: emblem is not fully visible`)
  assert.equal(probe.style.filter, 'none', `${label}: emblem gained an unapproved direct filter`)
  assert.equal(probe.style.transform, 'none', `${label}: emblem gained an unapproved transform`)
  assert.equal(probe.style.clipPath, 'none', `${label}: emblem gained an unapproved clip-path`)
  assert.equal(probe.style.mixBlendMode, 'normal', `${label}: emblem gained an unapproved blend mode`)
  const introCopy = probe.effectChain.find(node => node.id === 'introCopy')
  assert.ok(introCopy, `${label}: intro-copy ancestor effect contract is missing`)
  assert.match(introCopy.filter, /^drop-shadow\(.+\)$/, `${label}: intended intro-copy drop-shadow is missing`)
  assert.match(introCopy.filter, /43[^\d]+33[^\d]+26/, `${label}: intro-copy drop-shadow color changed`)
  assert.match(introCopy.filter, /3px/, `${label}: intro-copy drop-shadow offset changed`)
  for (const node of probe.effectChain) {
    assert.equal(node.transform, 'none', `${label}: ${node.tag}#${node.id || ''} applies an ancestor transform`)
    assert.equal(node.clipPath, 'none', `${label}: ${node.tag}#${node.id || ''} clips the emblem`)
    assert.equal(node.mixBlendMode, 'normal', `${label}: ${node.tag}#${node.id || ''} blends the emblem`)
    assert.equal(node.opacity, 1, `${label}: ${node.tag}#${node.id || ''} changes emblem opacity`)
    if (node.id !== 'introCopy') {
      assert.equal(node.filter, 'none', `${label}: ${node.tag}#${node.id || ''} adds an unapproved ancestor filter`)
    }
  }
  assert.ok(probe.sample.nonTransparent > probe.sample.pixels * 0.2, `${label}: decoded emblem is effectively transparent`)
  assert.ok(probe.sample.opaque > probe.sample.pixels * 0.15, `${label}: decoded emblem has no solid subject pixels`)
  assert.ok(probe.sample.coverage < 0.95, `${label}: emblem lost its approved transparent exterior`)
  assert.ok(probe.sample.lumaVariance > 100, `${label}: decoded emblem lacks source-image color detail`)
  assert.deepEqual(probe.screenshot.natural, { width: 112, height: 112 }, `${label}: emblem screenshot dimensions changed`)
  assert.ok(probe.screenshot.comparedOpaqueInterior >= 5_000, `${label}: too few opaque emblem screenshot pixels were compared`)
  assert.ok(probe.screenshot.meanAbsoluteError <= 4, `${label}: rendered emblem/source MAE is ${probe.screenshot.meanAbsoluteError}`)
  assert.ok(
    probe.screenshot.maximumAbsoluteChannelBias <= 2,
    `${label}: rendered emblem has a global color shift ${JSON.stringify(probe.screenshot.channelBias)}`,
  )
  assert.ok(probe.screenshot.badPixelRatio <= 0.01, `${label}: rendered emblem >24-error ratio is ${probe.screenshot.badPixelRatio}`)
  assert.ok(probe.screenshot.errorPercentiles.p50 <= 3, `${label}: rendered emblem p50 error is ${probe.screenshot.errorPercentiles.p50}`)
  assert.ok(probe.screenshot.errorPercentiles.p90 <= 9, `${label}: rendered emblem p90 error is ${probe.screenshot.errorPercentiles.p90}`)
  assert.ok(probe.screenshot.errorPercentiles.p95 <= 13, `${label}: rendered emblem p95 error is ${probe.screenshot.errorPercentiles.p95}`)
  assert.ok(probe.screenshot.opaqueInteriorRatio >= 0.999, `${label}: rendered emblem lost opaque interior coverage`)
}

function assertActualLayerOrder(layerOrder, label) {
  assert.deepEqual(layerOrder, REQUIRED_LAYERS, `${label}: actual Phaser display-list layer order is incorrect`)
}

function assertMetricEnvelope(metrics, label, {
  meanAbsoluteError,
  maximumAbsoluteChannelBias,
  badPixelRatio,
  severeChannelRatio,
  p50,
  p90,
  p95,
  minimumBaselineChangedRatio = null,
}) {
  assert.ok(metrics.count > 0, `${label}: visual metric sample is empty`)
  assert.ok(metrics.acceptedPointRatio >= 0.95, `${label}: expected-alpha sample coverage is ${metrics.acceptedPointRatio}`)
  assert.ok(metrics.meanAbsoluteError <= meanAbsoluteError, `${label}: mean RGB error is ${metrics.meanAbsoluteError}`)
  assert.ok(
    metrics.maximumAbsoluteChannelBias <= maximumAbsoluteChannelBias,
    `${label}: signed channel bias ${JSON.stringify(metrics.channelBias)} indicates a global color shift`,
  )
  assert.ok(metrics.badPixelRatio <= badPixelRatio, `${label}: >24 RGB-error pixel ratio is ${metrics.badPixelRatio}`)
  assert.ok(metrics.severeChannelRatio <= severeChannelRatio, `${label}: >48 channel-error ratio is ${metrics.severeChannelRatio}`)
  assert.ok(metrics.errorPercentiles.p50 <= p50, `${label}: p50 RGB error is ${metrics.errorPercentiles.p50}`)
  assert.ok(metrics.errorPercentiles.p90 <= p90, `${label}: p90 RGB error is ${metrics.errorPercentiles.p90}`)
  assert.ok(metrics.errorPercentiles.p95 <= p95, `${label}: p95 RGB error is ${metrics.errorPercentiles.p95}`)
  assert.ok(metrics.alpha.expectedMinimum >= 245, `${label}: expected sample contains unbounded alpha`)
  assert.ok(metrics.alpha.actualOpaqueRatio >= 0.999, `${label}: actual framebuffer lost opaque coverage`)
  if (minimumBaselineChangedRatio !== null) {
    assert.ok(
      metrics.baselineChangedRatio >= minimumBaselineChangedRatio,
      `${label}: only ${metrics.baselineChangedRatio} of expected subject pixels differ from the room`,
    )
  }
}

function assertCatRenderContract(render, expected, label) {
  assert.deepEqual(render && { pose: render.pose, facing: render.facing }, {
    pose: expected.pose,
    facing: expected.facing,
  }, `${label}: cat pose/facing changed`)

  for (const [partName, expectedPart] of Object.entries({
    container: expected.container,
    sprite: expected.sprite,
  })) {
    const actualPart = render?.[partName]
    assert.ok(actualPart, `${label}: ${partName} render inspection is missing`)
    for (const property of ['texture', 'frame', 'visible', 'flipX']) {
      assert.equal(actualPart[property], expectedPart[property], `${label}: ${partName}.${property} changed`)
    }
    for (const property of ['x', 'y', 'originX', 'originY', 'scaleX', 'scaleY', 'displayWidth', 'displayHeight', 'alpha']) {
      assert.ok(
        Math.abs(actualPart[property] - expectedPart[property]) < 1e-9,
        `${label}: ${partName}.${property} ${actualPart[property]} changed from ${expectedPart[property]}`,
      )
    }
  }
}

function assertRoomVisualParity(probe, size, { renderScale = 1 } = {}) {
  const { width, height } = parseSize(size)
  assert.deepEqual(
    probe.buffer,
    { width: width * renderScale, height: height * renderScale },
    `${size}@${renderScale}x: framebuffer dimensions changed during room parity`,
  )
  assertActualLayerOrder(probe.actualLayerOrder, `${size} room parity`)
  assert.ok(probe.totalCompared >= 2_000, `${size}: room parity compared too few pixels (${probe.totalCompared})`)
  assert.equal(probe.regions.length, ROOM_PARITY_ROIS.length, `${size}: room parity ROI count changed`)
  for (const region of probe.regions) {
    assert.ok(region.count >= 150, `${size}/${region.name}: too few independent room samples (${region.count})`)
    assertMetricEnvelope(region, `${size}/${region.name}`, {
      meanAbsoluteError: 4,
      maximumAbsoluteChannelBias: 2,
      badPixelRatio: 0.01,
      severeChannelRatio: 0.001,
      p50: 3,
      p90: 9,
      p95: 13,
    })
    assert.ok(region.expectedLumaVariance > 1, `${size}/${region.name}: reference ROI is unexpectedly blank`)
    assert.ok(region.actualLumaVariance > 1, `${size}/${region.name}: WebGL ROI is unexpectedly blank`)
  }
  assert.ok(probe.fullFrame.gridPoints >= 20_000, `${size}: full-frame room grid is too sparse`)
  assert.ok(probe.fullFrame.count >= 20_000, `${size}: full-frame room comparison retained too few pixels`)
  assert.ok(
    probe.fullFrame.count / probe.fullFrame.gridPoints >= 0.65,
    `${size}: cat/shadow exclusion removed too much of the room frame`,
  )
  assertMetricEnvelope(probe.fullFrame, `${size}/full-frame`, {
    meanAbsoluteError: 4,
    maximumAbsoluteChannelBias: 2,
    badPixelRatio: 0.01,
    severeChannelRatio: 0.001,
    p50: 3,
    p90: 9,
    p95: 13,
  })
}

function assertPoseVisualParity(probe, poseName, pose, facing = 'right') {
  const metrics = probe.metrics
  const render = probe.render
  assertActualLayerOrder(probe.actualLayerOrder, `${poseName} pose parity`)
  assert.equal(probe.pose, poseName, `${poseName}: visual probe returned the wrong pose`)
  assert.ok(metrics.count >= 80, `${poseName}: too few opaque cat pixels reached WebGL (${metrics.count})`)
  assertMetricEnvelope(metrics, `${poseName} pose`, {
    meanAbsoluteError: 7,
    maximumAbsoluteChannelBias: 2.5,
    badPixelRatio: 0.05,
    severeChannelRatio: 0.008,
    p50: 3,
    p90: 15,
    p95: 24,
    minimumBaselineChangedRatio: 0.65,
  })
  assert.ok(metrics.meanBaselineDistance >= 7, `${poseName}: rendered cat is not distinguishable from the room (${metrics.meanBaselineDistance})`)
  const expected = expectedCatRenderContract({ pose, facing, x: 370, y: 1320 })
  assert.deepEqual(probe.expectedCat, expected, `${poseName}: independent expected-cat composition changed`)
  assertCatRenderContract(render, expected, `${poseName} ${facing}`)
}

function assertDerivedTextureIntegrity(probe) {
  assert.deepEqual(Object.keys(probe.textures).sort(), Object.keys(DIRECT_DERIVED_TEXTURES).sort(), 'Derived texture probe set changed')
  for (const [name, specification] of Object.entries(DIRECT_DERIVED_TEXTURES)) {
    const texture = probe.textures[name]
    assert.ok(texture, `${name}: derived texture probe is missing`)
    assert.equal(texture.width, specification.crop.width, `${name}: derived width changed`)
    assert.equal(texture.height, specification.crop.height, `${name}: derived height changed`)
    assert.ok(texture.nonTransparent > texture.pixels * 0.12, `${name}: derived texture is effectively transparent`)
    assert.ok(texture.opaque > texture.pixels * 0.08, `${name}: derived texture has no opaque source interior`)
    assert.ok(texture.coverage < 0.92, `${name}: polygon clipping no longer leaves a transparent exterior`)
    assert.deepEqual(texture.cornerAlpha, [0, 0, 0, 0], `${name}: transparent outer corners were lost`)
    assert.equal(texture.differingChannels, 0, `${name}: derived pixels differ from the independently decoded approved-room crop`)
    assert.equal(texture.meanAbsoluteError, 0, `${name}: derived pixel mean error is not zero`)
    assert.match(texture.fnv1a, /^[0-9a-f]{8}$/, `${name}: derived pixel digest is unavailable`)
  }
}

function assertCatchVisualParity(probe, label) {
  const { toyFloorCover, caughtToy, cat } = probe.render
  const expectedCat = expectedCatRenderContract({
    pose: DIRECT_CAT_POSES.crouch,
    facing: 'left',
    x: 551,
    y: 1510,
  })
  assert.deepEqual(probe.expectedCat, expectedCat, `${label}: independent catch-cat composition changed`)
  assertCatRenderContract(cat, expectedCat, `${label} cat`)
  assert.equal(toyFloorCover.visible, true, `${label}: actual floor-cover GameObject is hidden during catch`)
  assert.equal(toyFloorCover.texture, DIRECT_ART_FILES.room.key, `${label}: floor-cover source texture changed`)
  assert.equal(toyFloorCover.frame, 'toy-floor-cover', `${label}: floor-cover source frame changed`)
  assert.equal(toyFloorCover.x, 552, `${label}: floor-cover x moved off the baked ball`)
  assert.equal(toyFloorCover.y, 1493, `${label}: floor-cover y moved off the baked ball`)
  assert.equal(toyFloorCover.originX, 0.5, `${label}: floor-cover originX changed`)
  assert.equal(toyFloorCover.originY, 0.5, `${label}: floor-cover originY changed`)
  assert.equal(toyFloorCover.displayWidth, 92, `${label}: floor-cover display width changed`)
  assert.equal(toyFloorCover.displayHeight, 92, `${label}: floor-cover display height changed`)

  assert.equal(caughtToy.visible, true, `${label}: actual caught-toy GameObject is hidden during catch`)
  assert.equal(caughtToy.texture, DIRECT_DERIVED_TEXTURES.caughtToy.key, `${label}: caught-toy texture changed`)
  assert.equal(caughtToy.originX, 0.5, `${label}: caught-toy originX changed`)
  assert.equal(caughtToy.originY, 0.5, `${label}: caught-toy originY changed`)
  assert.equal(caughtToy.displayWidth, 88, `${label}: caught-toy display width changed`)
  assert.equal(caughtToy.displayHeight, 94, `${label}: caught-toy display height changed`)

  assert.equal(caughtToy.x, 447, `${label}: caught toy no longer follows the left-facing paw x anchor`)
  assert.equal(caughtToy.y, 1502, `${label}: caught toy no longer follows the paw y anchor`)

  assert.ok(probe.cover.count >= 12, `${label}: no independently visible floor-cover pixels reached WebGL`)
  assertMetricEnvelope(probe.cover, `${label} floor-cover`, {
    meanAbsoluteError: 2.5,
    maximumAbsoluteChannelBias: 1.8,
    badPixelRatio: 0.01,
    severeChannelRatio: 0.002,
    p50: 2,
    p90: 4,
    p95: 5,
    minimumBaselineChangedRatio: 0.55,
  })
  assert.ok(probe.cover.meanBaselineDistance >= 5, `${label}: floor cover did not replace the baked ball region`)
  assert.ok(probe.ball.count >= 8, `${label}: no independently visible caught-toy pixels reached WebGL`)
  assertMetricEnvelope(probe.ball, `${label} caught-toy`, {
    meanAbsoluteError: 2.5,
    maximumAbsoluteChannelBias: 1.8,
    badPixelRatio: 0.01,
    severeChannelRatio: 0.002,
    p50: 2,
    p90: 4,
    p95: 5,
    minimumBaselineChangedRatio: 0.55,
  })
  assert.ok(probe.ball.meanBaselineDistance >= 5, `${label}: caught toy is not distinguishable from the covered floor`)
  assert.deepEqual(probe.fixedBallRoi.world, CATCH_BALL_REPLACEMENT_ROI, `${label}: fixed baked-ball replacement ROI changed`)
  assert.ok(probe.fixedBallRoi.framebuffer.width >= 20, `${label}: fixed baked-ball ROI is too narrow in the framebuffer`)
  assert.ok(probe.fixedBallRoi.framebuffer.height >= 20, `${label}: fixed baked-ball ROI is too short in the framebuffer`)
  assert.ok(probe.fixedBallRoi.candidateCount >= 20, `${label}: fixed baked-ball ROI has no independently changed cover pixels`)
  assert.ok(probe.fixedBallRoi.count >= 12, `${label}: fixed baked-ball ROI is fully obscured or unchanged`)
  assertMetricEnvelope(probe.fixedBallRoi, `${label} fixed baked-ball ROI`, {
    meanAbsoluteError: 2.5,
    maximumAbsoluteChannelBias: 1.8,
    badPixelRatio: 0.01,
    severeChannelRatio: 0.002,
    p50: 2,
    p90: 4,
    p95: 5,
    minimumBaselineChangedRatio: 0.55,
  })
  assert.ok(probe.fixedBallRoi.meanBaselineDistance >= 5, `${label}: fixed baked-ball ROI still shows the baked ball`)
}

function assertBedVisualParity(probe, label) {
  const foreground = probe.render.bedForeground
  const expectedCat = expectedCatRenderContract({
    pose: DIRECT_CAT_POSES.curl,
    facing: 'right',
    x: 744,
    y: 1170,
  })
  assert.deepEqual(probe.expectedCat, expectedCat, `${label}: independent sleep-cat composition changed`)
  assertCatRenderContract(probe.render.cat, expectedCat, `${label} cat`)
  assert.equal(foreground.visible, true, `${label}: bed foreground is hidden`)
  assert.equal(foreground.texture, DIRECT_DERIVED_TEXTURES.bedForeground.key, `${label}: bed foreground texture changed`)
  assert.equal(foreground.x, 620, `${label}: bed foreground x moved`)
  assert.equal(foreground.y, 1075, `${label}: bed foreground y moved`)
  assert.equal(foreground.originX, 0, `${label}: bed foreground originX changed`)
  assert.equal(foreground.originY, 0, `${label}: bed foreground originY changed`)
  assert.equal(foreground.displayWidth, 232, `${label}: bed foreground display width changed`)
  assert.equal(foreground.displayHeight, 145, `${label}: bed foreground display height changed`)
  assert.ok(probe.overlap.count >= 12, `${label}: cat and bed foreground have no verified WebGL overlap`)
  assertMetricEnvelope(probe.overlap, `${label} bed-occlusion`, {
    meanAbsoluteError: 5,
    maximumAbsoluteChannelBias: 1.5,
    badPixelRatio: 0.01,
    severeChannelRatio: 0.002,
    p50: 4,
    p90: 11,
    p95: 14,
    minimumBaselineChangedRatio: 0.55,
  })
  assert.ok(probe.overlap.meanBaselineDistance >= 5, `${label}: foreground did not visibly replace cat pixels`)
}

function assertCenteredCover(snapshot, size) {
  const room = snapshot.qa.directArt.room
  const camera = snapshot.qa.room?.camera
  assert.ok(camera, `${size}: room camera diagnostics are unavailable`)
  const expectedZoom = Math.max(camera.width / room.width, camera.height / room.height)
  assert.ok(Math.abs(camera.zoom - expectedZoom) < 1e-7, `${size}: camera zoom ${camera.zoom} is not centered cover ${expectedZoom}`)

  const visibleWidth = camera.width / camera.zoom
  const visibleHeight = camera.height / camera.zoom
  const worldViewX = camera.scrollX + camera.width / 2 - visibleWidth / 2
  const worldViewY = camera.scrollY + camera.height / 2 - visibleHeight / 2
  const centeredX = (room.width - visibleWidth) / 2
  const centeredY = (room.height - visibleHeight) / 2
  assert.ok(Math.abs(worldViewX - centeredX) < 1e-5, `${size}: room is not horizontally centered`)
  assert.ok(Math.abs(worldViewY - centeredY) < 1e-5, `${size}: room is not vertically centered`)
  assert.ok(room.width * camera.zoom + 1e-5 >= camera.width, `${size}: room does not cover backing viewport width`)
  assert.ok(room.height * camera.zoom + 1e-5 >= camera.height, `${size}: room does not cover backing viewport height`)
  assert.ok(
    Math.abs(room.width * camera.zoom - camera.width) < 1e-5
      || Math.abs(room.height * camera.zoom - camera.height) < 1e-5,
    `${size}: cover did not fit either room axis exactly`,
  )
}

function assertRoomSnapshot(snapshot, size) {
  const [expectedWidth, expectedHeight] = size.split('x').map(Number)
  assert.equal(snapshot.version, '0.8.1', `${size}: unexpected application version`)
  assert.equal(snapshot.ready, true, `${size}: runtime did not reach ready state`)
  assert.equal(snapshot.qa.renderer, 'webgl', `${size}: Phaser did not select WebGL`)
  assert.equal(snapshot.qa.scene, 'RoomScene', `${size}: RoomScene is not active`)
  assert.equal(snapshot.appMode, 'room', `${size}: DOM UI is not in room mode`)
  assert.equal(snapshot.canvasCount, 1, `${size}: expected exactly one Phaser canvas`)
  assert.ok(snapshot.viewport, `${size}: viewport diagnostics are unavailable`)
  assert.equal(snapshot.viewport.innerWidth, expectedWidth, `${size}: layout viewport width is not the requested device width`)
  assert.equal(snapshot.viewport.innerHeight, expectedHeight, `${size}: layout viewport height is not the requested device height`)
  assert.equal(snapshot.viewport.clientWidth, expectedWidth, `${size}: root client width is not the requested device width`)
  assert.equal(snapshot.viewport.clientHeight, expectedHeight, `${size}: root client height is not the requested device height`)
  assert.ok(Math.abs(snapshot.viewport.visualWidth - expectedWidth) < 0.5, `${size}: visual viewport width is ${snapshot.viewport.visualWidth}`)
  assert.ok(Math.abs(snapshot.viewport.visualHeight - expectedHeight) < 0.5, `${size}: visual viewport height is ${snapshot.viewport.visualHeight}`)
  assert.equal(snapshot.viewport.devicePixelRatio, 1, `${size}: primary geometry gate must run at DPR 1`)
  assert.deepEqual(
    snapshot.qa.hiDpi,
    {
      cssWidth: expectedWidth,
      cssHeight: expectedHeight,
      backingWidth: expectedWidth,
      backingHeight: expectedHeight,
      renderScale: 1,
      zoom: 1,
    },
    `${size}: DPR 1 HiDPI diagnostics differ from the measured #game box`,
  )
  assert.equal(snapshot.viewport.narrowQuery, expectedWidth <= 340, `${size}: narrow-width media query evaluated against the wrong viewport`)
  assert.equal(snapshot.viewport.shortQuery, expectedHeight <= 700, `${size}: short-height media query evaluated against the wrong viewport`)
  assert.equal(snapshot.viewport.hudLeft, expectedWidth <= 340 ? 10 : 14, `${size}: responsive HUD left inset is incorrect`)
  assert.equal(snapshot.viewport.hudRight, expectedWidth <= 340 ? 10 : 14, `${size}: responsive HUD right inset is incorrect`)
  assert.equal(snapshot.uiFont?.loaded, true, `${size}: bundled Japanese UI fonts did not load`)
  assert.match(snapshot.uiFont?.computedFamily || '', /^"?Tail Room JP"?/, `${size}: bundled UI font is not first in the font stack`)
  assert.ok(snapshot.appRect, `${size}: #app has no measurable bounds`)
  assert.ok(snapshot.canvasRect, `${size}: the Phaser canvas has no measurable bounds`)
  assert.ok(snapshot.canvasAttributes, `${size}: the Phaser canvas has no bitmap dimensions`)
  assert.ok(snapshot.canvasClient, `${size}: the Phaser canvas has no client dimensions`)
  assert.ok(snapshot.canvasCss, `${size}: the Phaser canvas has no computed style`)
  assert.ok(snapshot.webgl, `${size}: the Phaser canvas has no WebGL context`)
  assert.equal(snapshot.webgl.contextLost, false, `${size}: WebGL context is lost`)
  assert.equal(snapshot.webgl.preserveDrawingBuffer, true, `${size}: QA-only framebuffer preservation is unavailable`)
  assert.equal(snapshot.qa.contextLost, false, `${size}: the runtime reported a lost WebGL context`)
  assert.deepEqual(snapshot.layers, REQUIRED_LAYERS, `${size}: Phaser layer order differs from the v0.8.1 contract`)
  assert.ok(Math.abs(snapshot.appRect.width - expectedWidth) < 0.5, `${size}: app width is ${snapshot.appRect.width}`)
  assert.ok(Math.abs(snapshot.appRect.height - expectedHeight) < 0.5, `${size}: app height is ${snapshot.appRect.height}`)
  assert.ok(Math.abs(snapshot.canvasRect.width - expectedWidth) < 0.5, `${size}: canvas width is ${snapshot.canvasRect.width}`)
  assert.ok(Math.abs(snapshot.canvasRect.height - expectedHeight) < 0.5, `${size}: canvas height is ${snapshot.canvasRect.height}`)
  assert.deepEqual(
    snapshot.canvasAttributes,
    { width: expectedWidth, height: expectedHeight },
    `${size}: canvas bitmap attributes do not match the QA viewport`,
  )
  assert.equal(snapshot.webgl.drawingBufferWidth, snapshot.canvasAttributes.width, `${size}: WebGL drawing buffer width differs from the canvas bitmap`)
  assert.equal(snapshot.webgl.drawingBufferHeight, snapshot.canvasAttributes.height, `${size}: WebGL drawing buffer height differs from the canvas bitmap`)
  assert.deepEqual(
    snapshot.canvasClient,
    { width: expectedWidth, height: expectedHeight },
    `${size}: canvas CSS client dimensions do not match the QA viewport`,
  )
  assert.ok(Math.abs(snapshot.canvasCss.width - expectedWidth) < 0.5, `${size}: computed canvas width is ${snapshot.canvasCss.width}`)
  assert.ok(Math.abs(snapshot.canvasCss.height - expectedHeight) < 0.5, `${size}: computed canvas height is ${snapshot.canvasCss.height}`)
  assert.equal(snapshot.canvasCss.imageRendering, 'auto', `${size}: Canvas is forcing ${JSON.stringify(snapshot.canvasCss.imageRendering)} sampling`)
  assert.deepEqual(snapshot.horizontalOverflow, { document: false, body: false, app: false }, `${size}: horizontal overflow detected`)
  assert.equal(snapshot.runtimeErrorVisible, false, `${size}: runtime error UI is visible`)
  assert.equal(snapshot.bootError, null, `${size}: BootScene reported an error`)
  assert.equal(snapshot.qaBridgePresent, true, `${size}: guarded QA inspection bridge is unavailable`)
  assertDirectArtSnapshot(snapshot, size)
  assert.equal(snapshot.qa.pixelTextures, undefined, `${size}: legacy procedural texture diagnostics are still present`)
  assert.equal(snapshot.qa.pixelWorld, undefined, `${size}: legacy low-resolution world diagnostics are still present`)
  assert.ok(snapshot.qa.room?.behavior, `${size}: cat behavior diagnostics are unavailable`)
  assert.ok(Number.isFinite(snapshot.qa.room.behavior.clock), `${size}: cat behavior clock is not finite`)
  assert.equal(snapshot.qa.room?.camera?.width, expectedWidth, `${size}: room camera width does not match the viewport`)
  assert.equal(snapshot.qa.room?.camera?.height, expectedHeight, `${size}: room camera height does not match the viewport`)
  assertCenteredCover(snapshot, size)
  assert.equal(snapshot.qa.room?.visibility?.toy, true, `${size}: room toy remained hidden outside its catch frame`)
  assert.equal(snapshot.qa.room?.art?.roomTexture, DIRECT_ART_FILES.room.key, `${size}: room is not using the approved PNG`)
  assert.equal(snapshot.qa.room?.art?.roomFrame, '__BASE', `${size}: room backdrop is not the complete approved PNG`)
  assert.deepEqual(
    snapshot.qa.room?.art?.roomDisplay,
    { width: DIRECT_ART_FILES.room.width, height: DIRECT_ART_FILES.room.height },
    `${size}: room backdrop dimensions changed`,
  )
  assert.equal(snapshot.qa.room?.art?.catTexture, DIRECT_ART_FILES.cat.key, `${size}: cat is not using the approved source sheet`)
  assert.equal(
    snapshot.qa.room?.art?.bedForeground,
    DIRECT_DERIVED_TEXTURES.bedForeground.key,
    `${size}: WebGL-safe bed foreground is missing`,
  )
  assert.ok(DIRECT_POSE_NAMES.has(snapshot.qa.room?.art?.catPose), `${size}: cat pose is not one of the eight approved drawings`)
  assert.equal(snapshot.qa.room?.art?.catFrame, snapshot.qa.room?.art?.catPose, `${size}: displayed cat frame and approved pose disagree`)
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
    result.emulation = await driver.emulateViewport(size)
    await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room&debug=1`)
    await waitForScene('RoomScene')
    result.warmedFps = await warmedFpsDiagnostic()
    await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room`)
    await waitForScene('RoomScene')
    result.runtime = await driver.execute(RUNTIME_SNAPSHOT)
    result.roomParity = await runVisualProbe({
      kind: 'room',
      roomUrl: DIRECT_ART_FILES.room.url,
      rois: ROOM_PARITY_ROIS,
    })
    assertRoomVisualParity(result.roomParity, size)
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

async function runPoseAndDerivedParityCase() {
  const size = '393x852'
  await driver.emulateViewport(size)
  await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room`)
  await waitForScene('RoomScene')

  const derived = await runVisualProbe({
    kind: 'derived',
    roomUrl: DIRECT_ART_FILES.room.url,
    textures: DIRECT_DERIVED_TEXTURES,
  })
  report.derivedTextures = derived
  assertDerivedTextureIntegrity(derived)

  for (const [poseName, pose] of Object.entries(DIRECT_CAT_POSES)) {
    const probe = await runVisualProbe({
      kind: 'pose',
      roomUrl: DIRECT_ART_FILES.room.url,
      catUrl: DIRECT_ART_FILES.cat.url,
      poseName,
      pose,
      facing: 'right',
    })
    const parity = { pose: poseName, facing: 'right', probe, status: 'running' }
    report.poseParity.push(parity)
    try {
      assertPoseVisualParity(probe, poseName, pose)
      const screenshot = await driver.saveElementScreenshot('#app', `cat-pose-${poseName}.png`)
      assert.deepEqual(
        { width: screenshot.width, height: screenshot.height },
        parseSize(size),
        `${poseName}: pose evidence screenshot dimensions changed`,
      )
      parity.screenshot = screenshot
      parity.status = 'passed'
    } catch (error) {
      parity.status = 'failed'
      parity.error = error.stack || String(error)
      throw error
    }
  }

  const flipPoseName = 'walking'
  const flipPose = DIRECT_CAT_POSES[flipPoseName]
  const flipProbe = await runVisualProbe({
    kind: 'pose',
    roomUrl: DIRECT_ART_FILES.room.url,
    catUrl: DIRECT_ART_FILES.cat.url,
    poseName: flipPoseName,
    pose: flipPose,
    facing: 'left',
  })
  report.flipParity = {
    pose: flipPoseName,
    facing: 'left',
    probe: flipProbe,
    status: 'running',
  }
  try {
    assertPoseVisualParity(flipProbe, flipPoseName, flipPose, 'left')
    report.flipParity.screenshot = await driver.saveElementScreenshot('#app', 'cat-pose-walking-left.png')
    report.flipParity.status = 'passed'
  } catch (error) {
    report.flipParity.status = 'failed'
    report.flipParity.error = error.stack || String(error)
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
    result.emulation = await driver.emulateViewport(result.size)
    await driver.navigate(`${APP_ORIGIN}/?qa=393x852&scene=first-meeting`)
    await waitForScene('FirstMeetingScene')
    const firstMeetingRuntime = await driver.execute(RUNTIME_SNAPSHOT)
    assert.equal(firstMeetingRuntime.qa.scene, 'FirstMeetingScene', 'First meeting scene diagnostics are unavailable')
    assert.equal(firstMeetingRuntime.appMode, 'first-meeting', 'First meeting DOM mode is not active')
    assert.deepEqual(firstMeetingRuntime.layers, REQUIRED_LAYERS, 'First meeting does not use the six-layer world')
    assertDirectArtSnapshot(firstMeetingRuntime, '393x852 first meeting')
    assert.equal(firstMeetingRuntime.qa.room?.art?.roomTexture, DIRECT_ART_FILES.room.key, 'First meeting room is not the approved PNG')
    assert.equal(firstMeetingRuntime.qa.room?.art?.catTexture, DIRECT_ART_FILES.cat.key, 'First meeting cat is not the approved source sheet')
    assert.ok(DIRECT_POSE_NAMES.has(firstMeetingRuntime.qa.room?.art?.catPose), 'First meeting cat pose is not approved')
    assertCenteredCover(firstMeetingRuntime, '393x852')
    const brandCapture = await driver.captureElementScreenshot('.intro-emblem', 'first-meeting-emblem.png')
    result.brandParity = await driver.executeAsync(BRAND_PROBE_SCRIPT, [{
      url: DIRECT_ART_FILES.brand.url,
      sha256: DIRECT_ART_FILES.brand.sha256,
      screenshotDataUrl: brandCapture.dataUrl,
    }])
    assertBrandVisualParity(result.brandParity, '393x852 first meeting')
    const { dataUrl: _brandDataUrl, ...brandEvidence } = brandCapture
    result.brandParity.evidence = brandEvidence
    report.brandParity = result.brandParity
    result.firstMeetingCenters = assertCoreCentersVisible(firstMeetingRuntime, '393x852 first meeting')
    result.firstMeetingCatBounds = assertCatBoundsVisible(firstMeetingRuntime, '393x852 first meeting')
    result.steps.push({ name: 'first-meeting-ready', screenshot: await driver.saveElementScreenshot('#app', 'first-meeting-ready.png') })

    await driver.execute(`
      window.__TAIL_ROOM_QA_BRIDGE__.setPose('seated', 'right');
      return true;
    `)
    await sleep(80)
    const pettingRuntime = await driver.execute(RUNTIME_SNAPSHOT)
    const pettingBounds = assertPlainBounds(pettingRuntime.qa.room.bounds.cat, '393x852 first-meeting petting cat')
    const petWorldPath = Array.from({ length: 5 }, (_, index) => ({
      x: pettingBounds.x + pettingBounds.width * (0.3 + index * 0.1),
      y: pettingBounds.y + pettingBounds.height * 0.45,
    }))
    const petPath = petWorldPath.map((point, index) => ({
      ...worldToCanvasPoint(pettingRuntime, point),
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
    let catchParity = null
    const playDeadline = Date.now() + 12_000
    while (Date.now() < playDeadline) {
      const playDiagnostic = await driver.execute(`
        const room = window.__TAIL_ROOM_QA__?.room;
        return room ? {
          behavior: room.behavior || null,
          pose: room.art?.catPose || null,
          toyVisible: room.visibility?.toy,
          toyFloorCoverVisible: room.visibility?.toyFloorCover,
          caughtToyVisible: room.visibility?.caughtToy,
        } : null;
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
          assert.equal(playDiagnostic.toyFloorCoverVisible, true, 'The approved-room floor cover must hide the baked ball during catch')
          assert.equal(playDiagnostic.caughtToyVisible, true, 'The cat must visibly carry the exact ball cutout during catch')
          catchParity = await runVisualProbe({
            kind: 'catch',
            roomUrl: DIRECT_ART_FILES.room.url,
            catUrl: DIRECT_ART_FILES.cat.url,
            catPose: DIRECT_CAT_POSES.crouch,
            floorCover: DIRECT_ART_MANIFEST.room.frames['toy-floor-cover'],
            caughtToy: DIRECT_DERIVED_TEXTURES.caughtToy,
          })
          result.catchVisualParity = catchParity
          assertCatchVisualParity(catchParity, '393x852 catch')
          catchScreenshot = await driver.saveElementScreenshot('#app', 'room-toy-catch.png')
        }
      } else if (playStarted) {
        break
      }
      await sleep(100)
    }
    const expectedMotion = [
      { state: 'walk', pose: 'standing' },
      { state: 'play-notice', pose: 'loaf' },
      { state: 'play-crouch', pose: 'crouch' },
      { state: 'play-pounce', pose: 'pounce' },
      { state: 'play-catch', pose: 'crouch' },
      { state: 'play-recover', pose: 'pounce' },
    ]
    const playMotionTrace = await driver.execute(`
      return (window.__TAIL_ROOM_QA__?.room?.motionTrace || [])
        .filter(entry => entry?.action === 'player-play' && entry?.state)
        .map(entry => ({ state: entry.state, pose: entry.pose, clock: entry.clock }));
    `)
    for (const entry of playMotionTrace) observedMotion.add(entry.state)
    let traceCursor = -1
    for (const expected of expectedMotion) {
      traceCursor = playMotionTrace.findIndex((entry, index) => index > traceCursor && entry.state === expected.state)
      assert.ok(traceCursor >= 0, `Toy motion trace omitted or reordered state: ${expected.state}`)
      assert.equal(playMotionTrace[traceCursor].pose, expected.pose, `Toy state ${expected.state} did not use approved pose ${expected.pose}`)
    }
    assert.deepEqual(
      expectedMotion.map(entry => entry.state).filter(state => !observedMotion.has(state)),
      [],
      `Toy sequence omitted states: ${expectedMotion.map(entry => entry.state).filter(state => !observedMotion.has(state)).join(', ')}`,
    )
    assert.ok(pounceScreenshot, 'Toy sequence never produced screenshot evidence for play-pounce')
    assert.ok(catchScreenshot, 'Toy sequence never produced screenshot evidence for play-catch')
    assert.equal(
      await driver.execute('return window.__TAIL_ROOM_QA__?.room?.visibility?.toy;'),
      true,
      'Room toy was not restored after the play sequence',
    )
    assert.equal(
      await driver.execute('return window.__TAIL_ROOM_QA__?.room?.visibility?.toyFloorCover;'),
      false,
      'Room floor cover remained visible after the play sequence',
    )
    assert.equal(
      await driver.execute('return window.__TAIL_ROOM_QA__?.room?.visibility?.caughtToy;'),
      false,
      'Caught toy remained attached to the cat after the play sequence',
    )
    result.toySequence = {
      states: [...observedMotion],
      motionTrace: playMotionTrace,
      screenshots: { pounce: pounceScreenshot, catch: catchScreenshot },
      visualParity: catchParity,
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
          pose: room.art?.catPose || null,
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

    const expectedSleepStates = [
      { state: 'walk', poses: DIRECT_CAT_STATE_MAP.walk },
      { state: 'sleep-curl-transition', poses: DIRECT_CAT_STATE_MAP['sleep-curl-transition'] },
      { state: 'sleep-curl', poses: DIRECT_CAT_STATE_MAP['sleep-curl'] },
    ]
    const observedSleepStates = result.sleepSequence.transitions.map(entry => entry.behavior.state)
    let observedIndex = -1
    for (const expected of expectedSleepStates) {
      observedIndex = observedSleepStates.indexOf(expected.state, observedIndex + 1)
      assert.notEqual(observedIndex, -1, `Forced sleep sequence did not reach ${expected.state} in order`)
      const observedPose = result.sleepSequence.transitions[observedIndex].pose
      assert.ok(
        expected.poses.includes(observedPose),
        `Sleep state ${expected.state} used ${observedPose}, outside approved poses ${expected.poses.join(', ')}`,
      )
    }
    assert.ok(sleepRuntime, `Forced sleep did not reach sleep-curl within ${sleepDeadlineMs}ms`)
    const bedParity = await runVisualProbe({
      kind: 'bed',
      roomUrl: DIRECT_ART_FILES.room.url,
      catUrl: DIRECT_ART_FILES.cat.url,
      catPose: DIRECT_CAT_POSES.curl,
      bedForeground: DIRECT_DERIVED_TEXTURES.bedForeground,
    })
    result.sleepSequence.visualParityProbe = bedParity
    assertBedVisualParity(bedParity, '393x852 sleep-curl')
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
    result.sleepSequence.visualParity = bedParity
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

async function runResponsiveInteractionCase(size) {
  const result = { size, status: 'running', steps: [] }
  report.responsiveInteractions.push(result)
  const id = size.replace('x', '-')
  try {
    result.emulation = await driver.emulateViewport(size)
    await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room`)
    await waitForScene('RoomScene')
    const runtime = await driver.execute(RUNTIME_SNAPSHOT)
    assertRoomSnapshot(runtime, size)
    result.initialCenters = assertCoreCentersVisible(runtime, `${size} responsive interaction`)

    const bowlPoint = worldToCanvasPoint(runtime, runtime.qa.room.centers.bowl)
    await pointerSequence([bowlPoint], { pointerId: `bowl-${id}`, pauseMs: 160 })
    await waitFor(`${size} food sheet after bowl tap`, () => driver.execute(visibleScript('#foodSheet')))
    result.steps.push({ name: 'bowl-open', point: bowlPoint })
    await driver.click(await driver.find('#foodSheet [data-close]'))
    await waitFor(`${size} food sheet close`, async () => !(await driver.execute(visibleScript('#foodSheet'))))

    const bedPoint = worldToCanvasPoint(runtime, runtime.qa.room.centers.bed)
    await pointerSequence([bedPoint], { pointerId: `bed-${id}`, pauseMs: 160 })
    await waitFor(`${size} bed feedback`, () => driver.execute(`
      const toast = document.querySelector('#toast');
      return !toast?.hidden && /寝床|眠/.test(toast?.textContent || '');
    `))
    result.steps.push({ name: 'bed-feedback', point: bedPoint })

    const toyPoint = worldToCanvasPoint(runtime, runtime.qa.room.centers.toy)
    await pointerSequence([toyPoint], { pointerId: `toy-${id}`, pauseMs: 160 })
    await waitFor(`${size} player toy sequence`, () => driver.execute(`
      return window.__TAIL_ROOM_QA__?.room?.behavior?.action === 'player-play';
    `), { timeoutMs: 8_000 })

    let caught = null
    const catchDeadline = Date.now() + 12_000
    while (Date.now() < catchDeadline) {
      const diagnostic = await driver.execute(`
        const room = window.__TAIL_ROOM_QA__?.room;
        return room ? {
          action: room.behavior?.action || null,
          state: room.behavior?.state || null,
          pose: room.art?.catPose || null,
          visibility: room.visibility || null,
        } : null;
      `)
      if (diagnostic?.action === 'player-play' && diagnostic.state === 'play-catch') {
        assert.equal(diagnostic.pose, 'crouch', `${size}: catch did not use the crouch source pose`)
        assert.deepEqual(
          diagnostic.visibility,
          { toy: false, toyFloorCover: true, caughtToy: true },
          `${size}: catch visibility switch is incorrect`,
        )
        caught = {
          diagnostic,
          visualParity: await runVisualProbe({
            kind: 'catch',
            roomUrl: DIRECT_ART_FILES.room.url,
            catUrl: DIRECT_ART_FILES.cat.url,
            catPose: DIRECT_CAT_POSES.crouch,
            floorCover: DIRECT_ART_MANIFEST.room.frames['toy-floor-cover'],
            caughtToy: DIRECT_DERIVED_TEXTURES.caughtToy,
          }),
        }
        result.catch = caught
        assertCatchVisualParity(caught.visualParity, `${size} catch`)
        caught.screenshot = await driver.saveElementScreenshot('#app', `room-${size}-toy-catch.png`)
        break
      }
      await sleep(70)
    }
    assert.ok(caught, `${size}: toy sequence never reached a verified catch frame`)
    result.catch = caught
    await waitFor(`${size} toy restoration`, () => driver.execute(`
      const room = window.__TAIL_ROOM_QA__?.room;
      return room?.behavior?.action !== 'player-play'
        && room?.visibility?.toy === true
        && room?.visibility?.toyFloorCover === false
        && room?.visibility?.caughtToy === false;
    `), { timeoutMs: 12_000 })

    await driver.click(await driver.find('#creatorButton'))
    await waitFor(`${size} creator sheet before sleep`, () => driver.execute(visibleScript('#creatorSheet')))
    await driver.click(await driver.find('#creatorSheet [data-debug="sleep"]'))
    await waitFor(`${size} sleep-curl`, () => driver.execute(`
      const room = window.__TAIL_ROOM_QA__?.room;
      return room?.behavior?.action === 'sleep'
        && room?.behavior?.state === 'sleep-curl'
        && room?.art?.catPose === 'curl';
    `), { timeoutMs: 12_000, intervalMs: 50 })
    const sleepRuntime = await driver.execute(RUNTIME_SNAPSHOT)
    const bedParity = await runVisualProbe({
      kind: 'bed',
      roomUrl: DIRECT_ART_FILES.room.url,
      catUrl: DIRECT_ART_FILES.cat.url,
      catPose: DIRECT_CAT_POSES.curl,
      bedForeground: DIRECT_DERIVED_TEXTURES.bedForeground,
    })
    result.sleepVisualParity = bedParity
    assertBedVisualParity(bedParity, `${size} sleep-curl`)
    assertRoomSnapshot(sleepRuntime, size)
    result.sleep = {
      runtime: sleepRuntime.qa.room.behavior,
      catBounds: assertCatBoundsVisible(sleepRuntime, `${size} sleep-curl`),
      visualParity: bedParity,
      screenshot: await driver.saveElementScreenshot('#app', `room-${size}-sleep-curl.png`),
    }
    result.browserLogs = await driver.browserLogs()
    assertNoSevereLogs(result.browserLogs, `${size} responsive interaction`)
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
    if (error.sceneDiagnostics) result.sceneDiagnostics = error.sceneDiagnostics
    try {
      result.failureScreenshot = await driver.savePageScreenshot(`interaction-${size}-failure.png`)
    } catch {
      // Preserve the primary interaction error.
    }
    throw error
  }
}

const cameraWorldView = camera => ({
  width: camera.width / camera.zoom,
  height: camera.height / camera.zoom,
  x: camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom),
  y: camera.scrollY + camera.height / 2 - camera.height / (2 * camera.zoom),
})

async function runDprStaticCase(deviceScaleFactor, baselineSnapshot) {
  const size = '393x852'
  const result = { size, deviceScaleFactor, status: 'running' }
  report.dprStatic.push(result)
  try {
    result.emulation = await driver.emulateViewport(size, { deviceScaleFactor })
    await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room`)
    await waitForScene('RoomScene')
    const snapshot = await driver.execute(RUNTIME_SNAPSHOT)
    const { width, height } = parseSize(size)
    const renderScale = Math.min(deviceScaleFactor, 2)
    assert.equal(snapshot.viewport.devicePixelRatio, deviceScaleFactor, `${size}@DPR${deviceScaleFactor}: emulated DPR changed`)
    assert.equal(snapshot.viewport.innerWidth, width, `${size}@DPR${deviceScaleFactor}: layout viewport width changed`)
    assert.equal(snapshot.viewport.innerHeight, height, `${size}@DPR${deviceScaleFactor}: layout viewport height changed`)
    assert.ok(Math.abs(snapshot.canvasRect.width - width) < 0.5, `${size}@DPR${deviceScaleFactor}: canvas CSS width changed`)
    assert.ok(Math.abs(snapshot.canvasRect.height - height) < 0.5, `${size}@DPR${deviceScaleFactor}: canvas CSS height changed`)
    assert.deepEqual(
      snapshot.canvasAttributes,
      { width: width * renderScale, height: height * renderScale },
      `${size}@DPR${deviceScaleFactor}: HiDPI backing-store scale changed`,
    )
    assert.deepEqual(
      snapshot.qa.hiDpi,
      {
        cssWidth: width,
        cssHeight: height,
        backingWidth: width * renderScale,
        backingHeight: height * renderScale,
        renderScale,
        zoom: 1 / renderScale,
      },
      `${size}@DPR${deviceScaleFactor}: runtime HiDPI metrics changed`,
    )
    assert.equal(snapshot.webgl.drawingBufferWidth, snapshot.canvasAttributes.width, `${size}@DPR${deviceScaleFactor}: drawing-buffer width mismatch`)
    assert.equal(snapshot.webgl.drawingBufferHeight, snapshot.canvasAttributes.height, `${size}@DPR${deviceScaleFactor}: drawing-buffer height mismatch`)
    assert.equal(snapshot.webgl.preserveDrawingBuffer, true, `${size}@DPR${deviceScaleFactor}: QA readback buffer is not preserved`)
    assert.equal(snapshot.qaBridgePresent, true, `${size}@DPR${deviceScaleFactor}: guarded QA bridge is missing`)
    assert.equal(snapshot.canvasCss.imageRendering, 'auto', `${size}@DPR${deviceScaleFactor}: filtered direct-art rendering changed`)

    assertCenteredCover(snapshot, `${size}@DPR${deviceScaleFactor}`)
    const baselineCamera = baselineSnapshot.qa.room.camera
    const baselineView = cameraWorldView(baselineCamera)
    const currentView = cameraWorldView(snapshot.qa.room.camera)
    for (const property of ['x', 'y', 'width', 'height']) {
      assert.ok(
        Math.abs(currentView[property] - baselineView[property]) < 1e-5,
        `${size}@DPR${deviceScaleFactor}: visible world ${property} changed across DPR`,
      )
    }
    const centers = assertCoreCentersVisible(snapshot, `${size}@DPR${deviceScaleFactor}`)
    const baselineCenters = assertCoreCentersVisible(baselineSnapshot, `${size}@DPR1 baseline`)
    for (const name of REQUIRED_CORE_CENTERS) {
      assert.ok(
        Math.abs(centers[name].canvas.x - baselineCenters[name].canvas.x) <= 1
          && Math.abs(centers[name].canvas.y - baselineCenters[name].canvas.y) <= 1,
        `${size}@DPR${deviceScaleFactor}: ${name} world-to-canvas point moved across DPR`,
      )
    }
    result.roomParity = await runVisualProbe({
      kind: 'room',
      roomUrl: DIRECT_ART_FILES.room.url,
      rois: ROOM_PARITY_ROIS,
    })
    assertRoomVisualParity(result.roomParity, size, { renderScale })
    result.screenshot = await driver.saveElementScreenshot('#app', `room-${size}-dpr${deviceScaleFactor}.png`)
    result.runtime = {
      viewport: snapshot.viewport,
      canvasRect: snapshot.canvasRect,
      canvasAttributes: snapshot.canvasAttributes,
      camera: snapshot.qa.room.camera,
      worldView: currentView,
      centers,
      hiDpi: snapshot.qa.hiDpi,
    }
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
    throw error
  }
}

function assertHiDpiInputGeometry(snapshot, size, deviceScaleFactor, label) {
  const { width, height } = parseSize(size)
  const renderScale = Math.min(deviceScaleFactor, 2)
  assert.equal(snapshot.viewport.devicePixelRatio, deviceScaleFactor, `${label}: emulated DPR changed`)
  assert.equal(snapshot.viewport.innerWidth, width, `${label}: layout viewport width changed`)
  assert.equal(snapshot.viewport.innerHeight, height, `${label}: layout viewport height changed`)
  assert.ok(Math.abs(snapshot.canvasRect.width - width) < 0.5, `${label}: canvas CSS width changed`)
  assert.ok(Math.abs(snapshot.canvasRect.height - height) < 0.5, `${label}: canvas CSS height changed`)
  assert.deepEqual(
    snapshot.canvasAttributes,
    { width: width * renderScale, height: height * renderScale },
    `${label}: backing-store dimensions changed`,
  )
  assert.equal(snapshot.webgl.drawingBufferWidth, width * renderScale, `${label}: drawing-buffer width changed`)
  assert.equal(snapshot.webgl.drawingBufferHeight, height * renderScale, `${label}: drawing-buffer height changed`)
  assert.deepEqual(
    snapshot.qa.hiDpi,
    {
      cssWidth: width,
      cssHeight: height,
      backingWidth: width * renderScale,
      backingHeight: height * renderScale,
      renderScale,
      zoom: 1 / renderScale,
    },
    `${label}: runtime HiDPI metrics changed`,
  )
  assert.equal(snapshot.qa.room.camera.width, width * renderScale, `${label}: Phaser camera width is not backing-scaled`)
  assert.equal(snapshot.qa.room.camera.height, height * renderScale, `${label}: Phaser camera height is not backing-scaled`)
  assertCenteredCover(snapshot, label)
}

async function assertCanvasInputPoint(point, label) {
  const target = await driver.execute(`
    const element = document.elementFromPoint(arguments[0], arguments[1]);
    return element ? {
      tag: element.tagName,
      id: element.id || null,
      className: String(element.className || ''),
    } : null;
  `, [point.x, point.y])
  assert.equal(target?.tag, 'CANVAS', `${label}: CSS input point is covered by ${JSON.stringify(target)}`)
  return target
}

async function runHiDpiInputCase(deviceScaleFactor, {
  verifySlowDrag = false,
  verifyToy = false,
} = {}) {
  const size = '393x852'
  const label = `${size}@DPR${deviceScaleFactor} input`
  const result = {
    size,
    deviceScaleFactor,
    verifySlowDrag,
    verifyToy,
    status: 'running',
    steps: [],
  }
  report.dprInputs.push(result)

  try {
    result.emulation = await driver.emulateViewport(size, { deviceScaleFactor })

    if (verifySlowDrag) {
      await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=first-meeting`)
      await waitForScene('FirstMeetingScene')
      await driver.execute(`
        window.__TAIL_ROOM_QA_BRIDGE__.setPose('seated', 'right');
        return true;
      `)
      await sleep(80)
      const firstMeeting = await driver.execute(RUNTIME_SNAPSHOT)
      assertHiDpiInputGeometry(firstMeeting, size, deviceScaleFactor, `${label} slow-drag`)
      const bounds = assertPlainBounds(firstMeeting.qa.room.bounds.cat, `${label} cat`)
      const petWorldPath = Array.from({ length: 5 }, (_, index) => ({
        x: bounds.x + bounds.width * (0.3 + index * 0.1),
        y: bounds.y + bounds.height * 0.45,
      }))
      const petCanvasPath = petWorldPath.map((point, index) => ({
        ...worldToCanvasPoint(firstMeeting, point),
        ...(index ? { duration: 280 } : {}),
      }))
      await assertCanvasInputPoint(petCanvasPath[0], `${label} cat slow-drag start`)
      await assertCanvasInputPoint(petCanvasPath.at(-1), `${label} cat slow-drag end`)
      await pointerSequence(petCanvasPath, {
        pointerId: `hidpi-pet-dpr${deviceScaleFactor}`,
        pauseMs: 220,
      })
      await waitFor(`${label} name panel after slow Canvas drag`, () => driver.execute(visibleScript('#namePanel')))
      result.steps.push({
        name: 'cat-slow-drag',
        worldPath: petWorldPath,
        cssPath: petCanvasPath,
        backing: firstMeeting.canvasAttributes,
        camera: firstMeeting.qa.room.camera,
        accepted: true,
      })
    }

    await driver.navigate(`${APP_ORIGIN}/?qa=${size}&scene=room`)
    await waitForScene('RoomScene')
    const room = await driver.execute(RUNTIME_SNAPSHOT)
    assertHiDpiInputGeometry(room, size, deviceScaleFactor, label)
    const centers = assertCoreCentersVisible(room, label)

    const bowlPoint = worldToCanvasPoint(room, room.qa.room.centers.bowl)
    await assertCanvasInputPoint(bowlPoint, `${label} bowl`)
    await pointerSequence([bowlPoint], {
      pointerId: `hidpi-bowl-dpr${deviceScaleFactor}`,
      pauseMs: 160,
    })
    await waitFor(`${label} food sheet after bowl Canvas tap`, () => driver.execute(visibleScript('#foodSheet')))
    result.steps.push({
      name: 'bowl-tap',
      world: room.qa.room.centers.bowl,
      css: bowlPoint,
      backing: room.canvasAttributes,
      accepted: true,
    })
    await driver.click(await driver.find('#foodSheet [data-close]'))
    await waitFor(`${label} food sheet close`, async () => !(await driver.execute(visibleScript('#foodSheet'))))

    if (verifyToy) {
      const toyPoint = worldToCanvasPoint(room, room.qa.room.centers.toy)
      await assertCanvasInputPoint(toyPoint, `${label} toy`)
      await pointerSequence([toyPoint], {
        pointerId: `hidpi-toy-dpr${deviceScaleFactor}`,
        pauseMs: 160,
      })
      const behavior = await waitFor(`${label} player toy action`, () => driver.execute(`
        const behavior = window.__TAIL_ROOM_QA__?.room?.behavior;
        return behavior?.action === 'player-play' ? { ...behavior } : null;
      `), { timeoutMs: 8_000 })
      result.steps.push({
        name: 'toy-tap-start',
        world: room.qa.room.centers.toy,
        css: toyPoint,
        backing: room.canvasAttributes,
        behavior,
        accepted: true,
      })
    }

    result.runtime = {
      viewport: room.viewport,
      canvasRect: room.canvasRect,
      canvasAttributes: room.canvasAttributes,
      drawingBuffer: {
        width: room.webgl.drawingBufferWidth,
        height: room.webgl.drawingBufferHeight,
      },
      camera: room.qa.room.camera,
      centers,
      hiDpi: room.qa.hiDpi,
    }
    result.screenshot = await driver.saveElementScreenshot('#app', `room-${size}-dpr${deviceScaleFactor}-input.png`)
    result.browserLogs = await driver.browserLogs()
    assertNoSevereLogs(result.browserLogs, label)
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
    if (error.sceneDiagnostics) result.sceneDiagnostics = error.sceneDiagnostics
    try {
      result.failureScreenshot = await driver.savePageScreenshot(`room-393x852-dpr${deviceScaleFactor}-input-failure.png`)
    } catch {
      // Preserve the primary input failure.
    }
    throw error
  }
}

async function runProductionBridgeGuard() {
  const size = '393x852'
  const result = { size, status: 'running' }
  report.productionBridgeGuard = result
  try {
    await driver.emulateViewport(size)
    await driver.navigate(`${APP_ORIGIN}/`)
    await waitFor('normal runtime WebGL readiness', () => driver.execute(`
      return Boolean(
        window.__TAIL_ROOM_READY__ === true
        && window.__TAIL_ROOM_QA__?.ready === true
        && window.__TAIL_ROOM_QA__?.renderer === 'webgl'
        && ['FirstMeetingScene', 'RoomScene'].includes(window.__TAIL_ROOM_QA__?.scene)
      );
    `), { timeoutMs: 30_000 })
    const snapshot = await driver.execute(RUNTIME_SNAPSHOT)
    assert.equal(snapshot.qaBridgePresent, false, 'QA bridge leaked into a normal URL')
    assert.equal(snapshot.webgl.preserveDrawingBuffer, false, 'QA framebuffer preservation leaked into a normal URL')
    const normalGuard = await driver.execute(`
      return {
        hasBridge: Object.prototype.hasOwnProperty.call(window, '__TAIL_ROOM_QA_BRIDGE__'),
        qaDataset: document.documentElement.dataset.qa || null,
        search: location.search,
      };
    `)
    assert.equal(normalGuard.hasBridge, false, 'Normal URL retains the guarded QA bridge property')
    assert.equal(normalGuard.qaDataset, null, 'Normal URL was marked as a QA document')
    assert.equal(normalGuard.search, '', 'Production guard did not load the normal URL')
    result.runtime = {
      qaBridgePresent: snapshot.qaBridgePresent,
      preserveDrawingBuffer: snapshot.webgl.preserveDrawingBuffer,
      renderer: snapshot.qa.renderer,
      scene: snapshot.qa.scene,
      hiDpi: snapshot.qa.hiDpi,
    }
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
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
  await rm(ARTIFACT_DIR, { recursive: true, force: true })
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
    await runPoseAndDerivedParityCase()
  } catch (error) {
    failures.push(error)
  }
  try {
    await runInteractionCase()
  } catch (error) {
    failures.push(error)
  }
  for (const size of ['320x667', '430x932']) {
    try {
      await runResponsiveInteractionCase(size)
    } catch (error) {
      failures.push(error)
    }
  }
  const baselineSnapshot = report.rooms.find(room => room.size === '393x852')?.runtime
  if (!baselineSnapshot?.qa?.room?.camera) {
    failures.push(new Error('393x852 DPR 1 runtime baseline is unavailable'))
  } else {
    for (const deviceScaleFactor of [2, 3]) {
      try {
        await runDprStaticCase(deviceScaleFactor, baselineSnapshot)
      } catch (error) {
        failures.push(error)
      }
    }
  }
  for (const inputCase of [
    { deviceScaleFactor: 2, verifySlowDrag: true, verifyToy: true },
    { deviceScaleFactor: 3, verifySlowDrag: false, verifyToy: false },
  ]) {
    try {
      await runHiDpiInputCase(inputCase.deviceScaleFactor, inputCase)
    } catch (error) {
      failures.push(error)
    }
  }
  try {
    await runProductionBridgeGuard()
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
