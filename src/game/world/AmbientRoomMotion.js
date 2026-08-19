const PHASE_ACTIVITY = Object.freeze({ morning: 1, day: 1, evening: 0.7, night: 0.35 })

export class AmbientRoomMotion {
  constructor(scene, {
    lampGlow = null,
    windowLight = null,
  } = {}) {
    this.scene = scene
    this.lampGlow = lampGlow
    this.windowLight = windowLight
    this.activity = 1
    this.step = 0

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

    if (this.lampGlow?.visible) {
      const baseAlpha = Math.max(0, Number(this.lampGlow.getData('baseAlpha') || 0))
      const pulse = this.step % 10 < 5 ? 0 : 0.018
      this.lampGlow.setAlpha(baseAlpha > 0 ? baseAlpha + pulse : 0)
    }
    if (this.windowLight?.visible) {
      const baseAlpha = Math.max(0, Number(this.windowLight.getData('baseAlpha') || 0))
      const shimmer = this.step % 12 < 6 ? 0 : 0.018
      this.windowLight.setAlpha(baseAlpha > 0 ? baseAlpha + shimmer : 0)
    }
  }

  destroy() {
    this.timer?.destroy()
  }
}

export default AmbientRoomMotion
