import Phaser from '../phaser.js'

export class DebugScene extends Phaser.Scene {
  constructor() {
    super('DebugScene')
    this.samples = []
    this.lastRenderAt = 0
    this.lastSampleAt = 0
    this.warmupUntil = 0
  }

  create() {
    this.samples.length = 0
    this.lastRenderAt = 0
    this.panel = this.add.rectangle(10, 96, Math.max(280, this.scale.width - 20), 110, 0x15110e, 0.78).setOrigin(0)
    this.label = this.add.text(22, 108, '', {
      color: '#fff7ec',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '12px',
      lineSpacing: 5,
    })
    this.hitGraphics = this.add.graphics()
    this.scene.bringToTop()
    this.lastSampleAt = performance.now()
    this.warmupUntil = this.lastSampleAt + 1000
    this.onResize = gameSize => this.panel.setSize(Math.max(280, gameSize.width - 20), 110)
    this.scale.on('resize', this.onResize)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.onResize))
  }

  update(time) {
    const sampledAt = performance.now()
    const rawDelta = sampledAt - this.lastSampleAt
    this.lastSampleAt = sampledAt
    if (rawDelta > 250) {
      this.samples.length = 0
      this.warmupUntil = sampledAt + 1000
    } else if (sampledAt >= this.warmupUntil && Number.isFinite(rawDelta) && rawDelta > 0) {
      this.samples.push(rawDelta)
      if (this.samples.length > 600) this.samples.shift()
    }
    if (time - this.lastRenderAt < 250) return
    this.lastRenderAt = time
    const latestDelta = this.samples.at(-1) || 0
    const averageDelta = this.samples.length ? this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length : 0
    const maximumDelta = this.samples.length ? Math.max(...this.samples) : 0
    const fps = latestDelta ? 1000 / latestDelta : 0
    const average = averageDelta ? 1000 / averageDelta : 0
    const minimum = maximumDelta ? 1000 / maximumDelta : 0
    const room = this.scene.get('RoomScene')
    const canvas = this.game.canvas
    const internalSize = `${this.scale.gameSize.width}×${this.scale.gameSize.height}`
    const displaySize = `${Math.round(canvas?.clientWidth || 0)}×${Math.round(canvas?.clientHeight || 0)}`
    const layerNames = room?.world?.layerNames || window.__TAIL_ROOM_QA__.layers || []
    this.label.setText([
      `Tail Room v0.8.0 / Phaser 4.2.1 / WebGL pixel`,
      `Canvas ${internalSize} → ${displaySize}  FPS ${fps.toFixed(1)}  min ${minimum.toFixed(1)}  avg ${average.toFixed(1)}`,
      `Layers ${layerNames.join(' · ')}`,
      `Context ${window.__TAIL_ROOM_QA__.contextLost ? 'LOST' : 'active'}  World 2× / 8px grid`,
    ])
    window.__TAIL_ROOM_QA__.displaySize = displaySize
    window.__TAIL_ROOM_QA__.fps = {
      current: Number(fps.toFixed(2)),
      minimum: Number(minimum.toFixed(2)),
      average: Number(average.toFixed(2)),
      samples: this.samples.length,
      warmed: sampledAt >= this.warmupUntil,
      maximumFrameMs: Number(maximumDelta.toFixed(2)),
    }
    this.drawInputShapes(room)
  }

  drawInputShapes(room) {
    this.hitGraphics.clear()
    this.hitGraphics.lineStyle(1, 0x4fffc4, 0.68)
    const camera = room?.cameras?.main
    if (!camera) return
    const worldViewX = camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom)
    const worldViewY = camera.scrollY + camera.height / 2 - camera.height / (2 * camera.zoom)
    for (const object of room?.world?.getInteractiveObjects?.() || []) {
      const bounds = object.getBounds()
      this.hitGraphics.strokeRect(
        Math.round((bounds.x - worldViewX) * camera.zoom),
        Math.round((bounds.y - worldViewY) * camera.zoom),
        Math.round(bounds.width * camera.zoom),
        Math.round(bounds.height * camera.zoom),
      )
    }
  }
}

export default DebugScene
