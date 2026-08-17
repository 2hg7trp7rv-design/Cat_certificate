export function classifyPettingZone(x, y) {
  if (y < -48) return 'head'
  if (x > 72 && y > -34) return 'tail'
  if (x < -12) return 'back'
  return 'flank'
}

export function classifyPettingPace(distance, durationMs) {
  return distance / Math.max(1, durationMs) > 0.92 ? 'fast' : 'slow'
}

const toLocal = (cat, pointer) => ({
  x: (pointer.worldX - cat.x) / Math.max(0.001, cat.scaleX),
  y: (pointer.worldY - cat.y) / Math.max(0.001, cat.scaleY),
})

export class PettingInput {
  constructor(cat, { onComplete, onMove } = {}) {
    this.cat = cat
    this.onComplete = onComplete
    this.onMove = onMove
    this.active = null
    this.handlers = {
      down: pointer => this.start(pointer),
      move: pointer => this.move(pointer),
      up: pointer => this.finish(pointer),
      out: pointer => this.finish(pointer),
    }
    cat.on('pointerdown', this.handlers.down)
    cat.on('pointermove', this.handlers.move)
    cat.on('pointerup', this.handlers.up)
    cat.on('pointerout', this.handlers.out)
  }

  start(pointer) {
    const local = toLocal(this.cat, pointer)
    this.active = {
      pointerId: pointer.id,
      startedAt: performance.now(),
      lastX: pointer.worldX,
      lastY: pointer.worldY,
      distance: 0,
      local,
    }
  }

  move(pointer) {
    if (!this.active || this.active.pointerId !== pointer.id) return
    const step = Math.hypot(pointer.worldX - this.active.lastX, pointer.worldY - this.active.lastY)
    this.active.distance += step
    this.active.lastX = pointer.worldX
    this.active.lastY = pointer.worldY
    this.active.local = toLocal(this.cat, pointer)
    this.onMove?.({ ...this.active, pointer })
  }

  finish(pointer) {
    if (!this.active || this.active.pointerId !== pointer.id) return
    const duration = performance.now() - this.active.startedAt
    const local = toLocal(this.cat, pointer)
    const result = {
      zone: classifyPettingZone(local.x, local.y),
      pace: classifyPettingPace(this.active.distance, duration),
      distance: this.active.distance,
      duration,
      local,
    }
    this.active = null
    this.onComplete?.(result)
  }

  destroy() {
    this.cat.off('pointerdown', this.handlers.down)
    this.cat.off('pointermove', this.handlers.move)
    this.cat.off('pointerup', this.handlers.up)
    this.cat.off('pointerout', this.handlers.out)
    this.active = null
  }
}

export default PettingInput
