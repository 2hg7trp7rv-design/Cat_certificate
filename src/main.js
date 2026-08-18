import Phaser from './game/phaser.js'
import { createGameConfig } from './game/config.js'
import GameStateStore from './state/GameStateStore.js'
import UIController from './ui/UIController.js'

const APP_VERSION = '0.8.0'
const PHASER_VERSION = '4.2.1'
const QA_SIZES = new Set(['320x667', '393x852', '430x932'])

function queryOptions() {
  const params = new URLSearchParams(location.search)
  const requestedSize = QA_SIZES.has(params.get('qa')) ? params.get('qa') : null
  const requestedScene = ['first-meeting', 'room'].includes(params.get('scene')) ? params.get('scene') : null
  return { requestedSize, requestedScene, debug: params.get('debug') === '1' }
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
  layers: [],
  pixelWorld: {
    grid: 8,
    zoom: 2,
    room: { width: 216, height: 472 },
    safeArea: { width: 160, height: 328 },
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
      onReady(instance) {
        ui.bindGame(instance)
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
