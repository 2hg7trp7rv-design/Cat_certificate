import Phaser from './game/phaser.js'
import { createGameConfig } from './game/config.js'
import GameStateStore from './state/GameStateStore.js'
import UIController from './ui/UIController.js'

const APP_VERSION = '0.7.0'
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
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
      || canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true })
      || canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true })
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
  fps: { current: 0, minimum: null, average: null },
}

if (!supportsWebGL()) {
  ui.showRuntimeError('この端末ではWebGLの初期化に失敗しました。描画差異を隠すCanvasフォールバックは行いません。')
  window.__TAIL_ROOM_QA__.renderer = 'unavailable'
} else {
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
    },
  }))

  ui.bindGame(game)
  if (options.debug) game.scene.launch('DebugScene')
  setInterval(() => store.refresh(), 60_000)
}
