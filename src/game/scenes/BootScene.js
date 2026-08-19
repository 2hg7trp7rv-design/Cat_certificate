import Phaser from '../phaser.js'
import { prepareDirectArt, preloadDirectArt } from '../art/DirectArt.js'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
    this.directArtLoadError = null
  }

  preload() {
    this.directArtLoadError = null
    this.load.once('loaderror', file => {
      this.directArtLoadError = `原画像を読み込めませんでした: ${file?.src ?? file?.key ?? 'unknown asset'}`
    })
    preloadDirectArt(this)
  }

  create() {
    const ui = this.registry.get('ui')
    const store = this.registry.get('store')

    try {
      if (this.directArtLoadError) throw new Error(this.directArtLoadError)
      const art = prepareDirectArt(this)
      window.__TAIL_ROOM_QA__.directArt = {
        source: art.manifest.source,
        version: art.manifest.version,
        files: art.verifiedFiles.length,
        poses: art.registeredPoses.length,
        derived: art.derivedKeys.length,
        room: { ...art.manifest.room },
      }
      window.__TAIL_ROOM_QA__.renderer = this.game.renderer.type === Phaser.WEBGL ? 'webgl' : 'unexpected'
      window.__TAIL_ROOM_QA__.ready = true
      window.__TAIL_ROOM_READY__ = true
      const destination = store.getState().onboarded ? 'RoomScene' : 'FirstMeetingScene'
      this.scene.start(destination)
    } catch (error) {
      console.error('Tail Room boot failed', error)
      window.__TAIL_ROOM_QA__.bootError = String(error?.message || error)
      ui.showRuntimeError('指定された原画像の準備に失敗しました。Creator Previewのコンソール証跡を確認してください。')
    }
  }
}

export default BootScene
