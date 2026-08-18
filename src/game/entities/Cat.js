import Phaser from '../phaser.js'
import { alignCenteredHitArea } from '../input/HitArea.js'

const animation = (frames, durations, { loop = false } = {}) => Object.freeze({
  frames,
  durations: Object.freeze([...durations]),
  loop,
  duration: durations.reduce((sum, value) => sum + value, 0),
})

/**
 * v0.8 pixel-animation contract. Slow holds are deliberate: a 60 fps render
 * loop still presents authored cat poses at roughly 8–12 drawings per second,
 * while breathing and sleep retain the quiet pauses real cats need.
 */
export const CAT_ANIMATION_SPECS = Object.freeze({
  idle: animation(4, [620, 180, 620, 180], { loop: true }),
  blink: animation(4, [80, 70, 95, 80]),
  ear: animation(3, [110, 120, 170]),
  look: animation(5, [130, 120, 150, 120, 150]),
  tail: animation(6, [140, 130, 120, 120, 130, 160]),
  stand: animation(6, [110, 105, 100, 100, 105, 120]),
  sit: animation(6, [105, 100, 100, 105, 110, 130]),
  loaf: animation(4, [520, 560, 520, 640], { loop: true }),
  lie: animation(8, [120, 115, 110, 105, 105, 110, 115, 140]),
  walk: animation(6, [110, 105, 110, 105, 110, 120], { loop: true }),
  turn: animation(5, [100, 95, 95, 100, 120]),
  'sleep-curl-transition': animation(8, [140, 130, 125, 120, 120, 125, 130, 160]),
  'sleep-curl': animation(4, [760, 680, 760, 820], { loop: true }),
  'sleep-side-transition': animation(7, [135, 130, 125, 120, 125, 135, 165]),
  'sleep-side': animation(4, [720, 680, 720, 840], { loop: true }),
  'play-notice': animation(4, [120, 110, 120, 150]),
  'play-crouch': animation(6, [115, 110, 105, 105, 110, 135]),
  'play-pounce': animation(6, [90, 85, 80, 85, 90, 110]),
  'play-catch': animation(6, [105, 100, 95, 105, 110, 150]),
  'play-recover': animation(6, [115, 110, 105, 110, 120, 150]),
  welcome: animation(5, [115, 105, 105, 115, 150]),
})

export const getCatAnimationSpec = state => CAT_ANIMATION_SPECS[state] ?? CAT_ANIMATION_SPECS.idle

export const resolveCatAnimationFrame = (state, elapsedMs = 0, loopOverride) => {
  const spec = getCatAnimationSpec(state)
  const loop = loopOverride ?? spec.loop
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const position = loop && spec.duration > 0
    ? elapsed % spec.duration
    : Math.min(elapsed, Math.max(0, spec.duration - 1))

  let cursor = 0
  for (let index = 0; index < spec.frames; index += 1) {
    cursor += spec.durations[index] ?? spec.durations.at(-1) ?? 100
    if (position < cursor) return index
  }
  return spec.frames - 1
}

const CAT_HIT_POLYGON = Object.freeze([
  -34, 3, -38, -22, -32, -52, -20, -75, -8, -85,
  12, -82, 30, -62, 38, -35, 37, -4, 25, 3,
])

export class Cat extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { scale = 0.72 } = {}) {
    super(scene, x, y)
    this.baseScale = scale
    this.motionState = 'idle'
    this.motionFrame = 0
    this.sleeping = false
    this.night = false
    this.facing = 'right'
    this.textureFrameBases = new Map()

    const createSprite = typeof scene.add.sprite === 'function'
      ? scene.add.sprite.bind(scene.add)
      : scene.add.image.bind(scene.add)
    this.pixelSprite = createSprite(0, 0, 'pixel.cat.idle.0')
      .setOrigin(0.5, 88 / 96)
    this.add(this.pixelSprite)
    scene.add.existing(this)
    this.setScale(scale)
    this.setSize(96, 96)
    this.setDisplayOrigin(48, 88)
    const hitArea = alignCenteredHitArea(
      new Phaser.Geom.Polygon(CAT_HIT_POLYGON),
      this.displayOriginX,
      this.displayOriginY,
    )
    this.setInteractive(hitArea, Phaser.Geom.Polygon.Contains)
    this.inputShape = hitArea
  }

  setGrowthScale(growthScale = 1) {
    const requested = Number(growthScale)
    const target = this.baseScale * (Number.isFinite(requested) && requested > 0 ? requested : 1)
    this.setScale(target)
    return this
  }

  setSleeping(sleeping) {
    this.sleeping = Boolean(sleeping)
    if (this.sleeping && !this.motionState.startsWith('sleep-')) {
      this.setMotionState('sleep-curl', { elapsedMs: 0, loop: true })
    } else if (!this.sleeping && this.motionState.startsWith('sleep-')) {
      this.setMotionState('idle', { elapsedMs: 0, loop: true })
    }
    return this
  }

  setNightReadable(night) {
    this.night = Boolean(night)
    this.#applyTint()
    return this
  }

  setFacing(direction = 'right') {
    this.facing = direction === 'left' ? 'left' : 'right'
    this.pixelSprite.setFlipX(this.facing === 'left')
    return this
  }

  setWorldPosition(x, y) {
    if (Number.isFinite(Number(x))) this.x = Number(x)
    if (Number.isFinite(Number(y))) this.y = Number(y)
    return this
  }

  /**
   * Stateless manual frame sequencing. The controller supplies elapsed time,
   * keeping queued animations from racing through after a background pause.
   */
  setMotionState(state = 'idle', { elapsedMs = 0, loop } = {}) {
    const motionState = CAT_ANIMATION_SPECS[state] ? state : 'idle'
    const frame = resolveCatAnimationFrame(motionState, elapsedMs, loop)
    this.motionState = motionState
    this.motionFrame = frame
    this.#showPixelFrame(motionState, frame)
    this.#applyTint()
    return this
  }

  getMotionState() {
    return { state: this.motionState, frame: this.motionFrame, facing: this.facing }
  }

  acknowledgePetting(welcome = true) {
    if (welcome && this.#hasPixelFrame('welcome', 0)) this.setMotionState('welcome')

    this.scene.tweens.killTweensOf(this.pixelSprite)
    this.pixelSprite.setY(0)
    this.scene.tweens.add({
      targets: this.pixelSprite,
      y: welcome ? -2 : 1,
      duration: 130,
      yoyo: true,
      ease: 'Sine.Out',
    })
    return this
  }

  #textureBase(state) {
    if (this.textureFrameBases.has(state)) return this.textureFrameBases.get(state)
    const base = this.scene.textures?.exists?.(`pixel.cat.${state}.0`)
      ? 0
      : this.scene.textures?.exists?.(`pixel.cat.${state}.1`) ? 1 : null
    this.textureFrameBases.set(state, base)
    return base
  }

  #hasPixelFrame(state, frame) {
    const base = this.#textureBase(state)
    return base !== null && Boolean(this.scene.textures?.exists?.(`pixel.cat.${state}.${frame + base}`))
  }

  #showPixelFrame(state, frame) {
    const base = this.#textureBase(state)
    if (base === null) return this.#showIdleFallbackFrame(frame)
    const key = `pixel.cat.${state}.${frame + base}`
    if (!this.scene.textures?.exists?.(key)) return this.#showIdleFallbackFrame(frame)
    this.pixelSprite.setTexture(key).setFlipX(this.facing === 'left')
    return true
  }

  #showIdleFallbackFrame(frame) {
    const base = this.#textureBase('idle')
    if (base === null) return false
    const idleFrame = frame % CAT_ANIMATION_SPECS.idle.frames
    const key = `pixel.cat.idle.${idleFrame + base}`
    if (!this.scene.textures?.exists?.(key)) return false
    this.pixelSprite.setTexture(key).setFlipX(this.facing === 'left')
    return true
  }

  #applyTint() {
    const generalTint = this.night ? 0xffeed9 : 0xffffff
    this.pixelSprite.setTint(generalTint)
  }
}

export default Cat
