const PHASE_ACTIVITY = Object.freeze({ morning: 1, day: 1, evening: 0.7, night: 0.35 })

export class AmbientRoomMotion {
  constructor(scene, {
    roomLayer,
    curtains = [],
    lampGlow = null,
    windowLight = null,
  } = {}) {
    this.scene = scene
    this.curtains = curtains
    this.lampGlow = lampGlow
    this.windowLight = windowLight
    this.activity = 1
    this.step = 0
    this.baseCurtains = curtains.map(curtain => ({ x: curtain.x, y: curtain.y }))
    this.dust = [
      [49, 118, 0], [63, 137, 2], [79, 101, 4], [87, 151, 6], [102, 124, 8], [112, 163, 10],
    ].map(([x, y, delay], index) => {
      const pixel = scene.add.rectangle(x, y, index % 2 ? 1 : 2, 1, 0xffdfa1, 0.35)
      pixel.setData({ baseX: x, baseY: y, delay })
      roomLayer?.add(pixel)
      return pixel
    })

    this.timer = scene.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => this.tick(),
    })
  }

  setPhase(phase = 'day') {
    this.activity = PHASE_ACTIVITY[phase] ?? 1
    return this
  }

  tick() {
    this.step += 1
    const curtainOffset = this.step % 8 < 4 ? 0 : 1
    this.curtains.forEach((curtain, index) => {
      const base = this.baseCurtains[index]
      curtain.setPosition(base.x + (index ? -curtainOffset : curtainOffset), base.y)
    })

    for (const pixel of this.dust) {
      const baseX = pixel.getData('baseX')
      const baseY = pixel.getData('baseY')
      const delay = pixel.getData('delay')
      const local = (this.step + delay) % 18
      pixel.setPosition(baseX + (local % 6 === 0 ? 1 : 0), baseY - Math.floor(local / 3))
      pixel.setAlpha((local < 13 ? 0.28 : 0.1) * this.activity)
    }

    if (this.lampGlow?.visible) {
      const pulse = this.step % 10 < 5 ? 0 : 0.035
      this.lampGlow.setAlpha(Math.max(0, Number(this.lampGlow.getData('baseAlpha') || 0) + pulse))
    }
    if (this.windowLight?.visible) {
      const shimmer = this.step % 12 < 6 ? 0 : 0.018
      this.windowLight.setAlpha(Math.max(0, Number(this.windowLight.getData('baseAlpha') || 0) + shimmer))
    }
  }

  destroy() {
    this.timer?.destroy()
    for (const pixel of this.dust) pixel.destroy()
    this.dust.length = 0
  }
}

export default AmbientRoomMotion
