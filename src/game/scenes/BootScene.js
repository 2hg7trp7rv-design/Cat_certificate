import Phaser from '../phaser.js'
import { createPlaceholderTextures } from '../art/PlaceholderArt.js'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    const ui = this.registry.get('ui')
    const store = this.registry.get('store')

    try {
      const textures = createPlaceholderTextures(this)
      window.__TAIL_ROOM_QA__.placeholderTextures = {
        created: textures.createdKeys.length,
        reused: textures.reusedKeys.length,
        temporary: true,
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
