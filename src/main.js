import Phaser from './game/phaser.js'
import { createGameConfig } from './game/config.js'
import { getInitialHiDpiMetrics, installHiDpiScaleSync } from './game/render/HiDpiScale.js'
import GameStateStore from './state/GameStateStore.js'
import UIController from './ui/UIController.js'

const APP_VERSION = '0.8.1'
const PHASER_VERSION = '4.2.1'
const QA_SIZES = new Set(['320x667', '393x852', '430x932'])

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (normalized === 'localhost' || normalized === '::1') return true
  const octets = normalized.split('.')
  return octets.length === 4
    && octets[0] === '127'
    && octets.every(octet => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
}

function queryOptions() {
  const params = new URLSearchParams(location.search)
  const requestedQaSize = params.get('qa')
  const qaApproved = isLoopbackHostname(location.hostname) && QA_SIZES.has(requestedQaSize)
  const requestedSize = qaApproved ? requestedQaSize : null
  const requestedScene = qaApproved && ['first-meeting', 'room'].includes(params.get('scene'))
    ? params.get('scene')
    : null
  return { requestedSize, requestedScene, debug: qaApproved && params.get('debug') === '1', qaApproved }
}

function applyQaSize(size) {
  if (!size) return
  const [width, height] = size.split('x').map(Number)
  document.documentElement.dataset.qa = 'true'
  document.documentElement.style.setProperty('--qa-width', `${width}px`)
  document.documentElement.style.setProperty('--qa-height', `${height}px`)
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(context)
  } catch {
    return false
  }
}

const options = queryOptions()
applyQaSize(options.requestedSize)
const gameHost = document.querySelector('#game')
const initialHiDpiMetrics = getInitialHiDpiMetrics(gameHost)

const store = new GameStateStore({ qaScene: options.requestedScene })
const ui = new UIController(store)

window.__TAIL_ROOM_VERSION__ = APP_VERSION
window.__TAIL_ROOM_READY__ = false
window.__TAIL_ROOM_QA__ = {
  version: APP_VERSION,
  phaser: PHASER_VERSION,
  renderer: 'webgl-required',
  ready: false,
  qaSize: options.requestedSize,
  qaScene: options.requestedScene,
  contextLost: false,
  hiDpi: { ...initialHiDpiMetrics },
  layers: [],
  directArt: {
    source: 'user-approved-original-files',
    room: { width: 852, height: 1846 },
    files: 0,
    poses: 0,
  },
  fps: { current: 0, minimum: null, average: null },
}

function bootWebGL() {
  const failBoot = error => {
    window.__TAIL_ROOM_QA__.renderer = 'unavailable'
    window.__TAIL_ROOM_QA__.bootError = String(error?.message || error || 'WebGL boot timed out')
    ui.showRuntimeError('WebGL描画の初期化を完了できませんでした。Canvas版へは切り替えません。')
  }
  const bootWatchdog = setTimeout(() => {
    if (!window.__TAIL_ROOM_READY__ && !window.__TAIL_ROOM_QA__.bootError) failBoot('WebGL boot timed out')
  }, 8000)

  try {
    const game = new Phaser.Game(createGameConfig({
      store,
      ui,
      preserveDrawingBuffer: options.qaApproved,
      hiDpiMetrics: initialHiDpiMetrics,
      onReady(instance) {
        ui.bindGame(instance)
        const hiDpiScale = installHiDpiScaleSync(instance.scale, gameHost, {
          onMetrics(metrics) {
            window.__TAIL_ROOM_QA__.hiDpi = { ...metrics }
          },
        })
        instance.events.once(Phaser.Core.Events.DESTROY, () => hiDpiScale.destroy())
        const canvas = instance.canvas
        canvas?.addEventListener('webglcontextlost', event => {
          event.preventDefault()
          window.__TAIL_ROOM_QA__.contextLost = true
        })
        canvas?.addEventListener('webglcontextrestored', () => {
          window.__TAIL_ROOM_QA__.contextLost = false
        })
        if (options.debug) instance.scene.run('DebugScene')
      },
    }))

    ui.bindGame(game)
    setInterval(() => store.refresh(), 60_000)
  } catch (error) {
    clearTimeout(bootWatchdog)
    console.error('Tail Room WebGL boot failed', error)
    failBoot(error)
  }
}

if (!supportsWebGL()) {
  ui.showRuntimeError('この端末ではWebGLの初期化に失敗しました。描画差異を隠すCanvasフォールバックは行いません。')
  window.__TAIL_ROOM_QA__.renderer = 'unavailable'
} else {
  // Give the feature-probe context one paint boundary to release before
  // asking Phaser for the sole long-lived WebGL context (important on iOS).
  requestAnimationFrame(() => bootWebGL())
}
