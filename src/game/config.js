import Phaser from './phaser.js'
import BootScene from './scenes/BootScene.js'
import DebugScene from './scenes/DebugScene.js'
import FirstMeetingScene from './scenes/FirstMeetingScene.js'
import RoomScene from './scenes/RoomScene.js'
export {
  WORLD_CENTER_X,
  WORLD_CENTER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  calculateWorldZoom,
  configureWorldCamera,
} from './world/WorldCamera.js'

export const DESIGN_WIDTH = 393
export const DESIGN_HEIGHT = 852
export function createGameConfig({
  store,
  ui,
  onReady,
  preserveDrawingBuffer = false,
  hiDpiMetrics = null,
} = {}) {
  const backingWidth = Math.max(1, Math.round(Number(hiDpiMetrics?.backingWidth) || DESIGN_WIDTH))
  const backingHeight = Math.max(1, Math.round(Number(hiDpiMetrics?.backingHeight) || DESIGN_HEIGHT))
  const initialZoom = Math.max(0.01, Number(hiDpiMetrics?.zoom) || 1)

  return {
    type: Phaser.WEBGL,
    parent: 'game',
    width: backingWidth,
    height: backingHeight,
    backgroundColor: '#171411',
    transparent: false,
    banner: false,
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      smoothPixelArt: false,
      roundPixels: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: Boolean(preserveDrawingBuffer),
    },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: backingWidth,
      height: backingHeight,
      zoom: initialZoom,
    },
    input: {
      activePointers: 3,
      smoothFactor: 0.2,
    },
    fps: {
      target: 60,
      min: 30,
      smoothStep: true,
    },
    scene: [BootScene, FirstMeetingScene, RoomScene, DebugScene],
    callbacks: {
      preBoot(game) {
        game.registry.set('store', store)
        game.registry.set('ui', ui)
      },
      postBoot(game) {
        onReady?.(game)
      },
    },
  }
}

export default createGameConfig
