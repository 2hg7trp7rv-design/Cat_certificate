import Phaser from '../phaser.js'
import { createPixelTextures } from '../art/PixelArt.js'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    const ui = this.registry.get('ui')
    const store = this.registry.get('store')

    try {
      const textures = createPixelTextures(this)
      window.__TAIL_ROOM_QA__.pixelTextures = {
        created: textures.createdKeys.length,
        reused: textures.reusedKeys.length,
        nonEmpty: textures.verifiedNonEmptyKeys.length,
        temporary: false,
        grid: 8,
      }
      window.__TAIL_ROOM_QA__.renderer = this.game.renderer.type === Phaser.WEBGL ? 'webgl' : 'unexpected'
      window.__TAIL_ROOM_QA__.ready = true
      window.__TAIL_ROOM_READY__ = true
      const destination = store.getState().onboarded ? 'RoomScene' : 'FirstMeetingScene'
      this.scene.start(destination)
    } catch (error) {
      console.error('Tail Room boot failed', error)
      window.__TAIL_ROOM_QA__.bootError = String(error?.message || error)
      ui.showRuntimeError('描画用テクスチャの準備に失敗しました。Creator Previewのコンソール証跡を確認してください。')
    }
  }
}

export default BootScene
