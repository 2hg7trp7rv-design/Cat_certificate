import Phaser from './phaser.js'
import BootScene from './scenes/BootScene.js'
import DebugScene from './scenes/DebugScene.js'
import FirstMeetingScene from './scenes/FirstMeetingScene.js'
import RoomScene from './scenes/RoomScene.js'

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
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
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
