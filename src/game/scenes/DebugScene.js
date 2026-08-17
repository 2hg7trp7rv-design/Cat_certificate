import Phaser from '../phaser.js'

export class DebugScene extends Phaser.Scene {
  constructor() {
    super('DebugScene')
    this.samples = []
    this.lastRenderAt = 0
  }

  create() {
    this.panel = this.add.rectangle(10, 96, 373, 110, 0x15110e, 0.78).setOrigin(0)
    this.label = this.add.text(22, 108, '', {
      color: '#fff7ec',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '12px',
      lineSpacing: 5,
    })
    this.hitGraphics = this.add.graphics()
    this.scene.bringToTop()
  }

  update(time) {
    const fps = Number(this.game.loop.actualFps || (1000 / Math.max(1, this.game.loop.delta)))
    if (Number.isFinite(fps)) {
      this.samples.push(fps)
      if (this.samples.length > 600) this.samples.shift()
    }
    if (time - this.lastRenderAt < 250) return
    this.lastRenderAt = time
    const average = this.samples.length ? this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length : 0
    const minimum = this.samples.length ? Math.min(...this.samples) : 0
    const room = this.scene.get('RoomScene')
    const size = `${this.scale.gameSize.width}×${this.scale.gameSize.height}`
    const layerNames = room?.world?.layerNames || window.__TAIL_ROOM_QA__.layers || []
    this.label.setText([
      `Tail Room v0.7.0 / Phaser 4.2.1 / WebGL`,
      `Canvas ${size}  FPS ${fps.toFixed(1)}  min ${minimum.toFixed(1)}  avg ${average.toFixed(1)}`,
      `Layers ${layerNames.join(' · ')}`,
      `Context ${window.__TAIL_ROOM_QA__.contextLost ? 'LOST' : 'active'}  Art temporary raster parts`,
    ])
    window.__TAIL_ROOM_QA__.fps = {
      current: Number(fps.toFixed(2)),
      minimum: Number(minimum.toFixed(2)),
      average: Number(average.toFixed(2)),
      samples: this.samples.length,
    }
    this.drawInputShapes(room)
  }

  drawInputShapes(room) {
    this.hitGraphics.clear()
    this.hitGraphics.lineStyle(1, 0x4fffc4, 0.68)
    for (const object of room?.world?.getInteractiveObjects?.() || []) {
      const bounds = object.getBounds()
      this.hitGraphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
    }
  }
}

export default DebugScene
