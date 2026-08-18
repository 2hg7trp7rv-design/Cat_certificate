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
  WORLD_ZOOM,
  configureWorldCamera,
} from './world/WorldCamera.js'

export const DESIGN_WIDTH = 393
export const DESIGN_HEIGHT = 852
export function createGameConfig({ store, ui, onReady } = {}) {
  return {
    type: Phaser.WEBGL,
    parent: 'game',
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundColor: '#171411',
    transparent: false,
    banner: false,
    render: {
      antialias: false,
      antialiasGL: false,
      pixelArt: true,
      smoothPixelArt: false,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
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
