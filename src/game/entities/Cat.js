import Phaser from '../phaser.js'
import {
  DIRECT_ART_FILES,
  DIRECT_CAT_POSES,
  resolveDirectCatPose,
} from '../art/DirectArtManifest.js'
import { alignCenteredHitArea } from '../input/HitArea.js'

const animation = (frames, durations, { loop = false } = {}) => Object.freeze({
  frames,
  durations: Object.freeze([...durations]),
  loop,
  duration: durations.reduce((sum, value) => sum + value, 0),
})

/**
 * Logical motion timing. The approved source sheet contains eight drawings;
 * these timings keep movement and behavior deterministic while those exact
 * drawings are selected for each state.
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

export class Cat extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { scale = 0.75 } = {}) {
    super(scene, x, y)
    this.baseScale = scale
    this.motionState = 'idle'
    this.motionFrame = 0
    this.sleeping = false
    this.night = false
    this.facing = 'right'
    this.poseName = 'seated'

    const createSprite = typeof scene.add.sprite === 'function'
      ? scene.add.sprite.bind(scene.add)
      : scene.add.image.bind(scene.add)
    this.pixelSprite = createSprite(0, 0, DIRECT_ART_FILES.cat.key, DIRECT_CAT_POSES.seated.frame)
    this.add(this.pixelSprite)
    scene.add.existing(this)
    this.#showDirectPose('seated')
    this.setScale(scale)
    this.setSize(500, 400)
    const seated = DIRECT_CAT_POSES.seated
    const hitArea = alignCenteredHitArea(
      new Phaser.Geom.Rectangle(
        -seated.pivot.x,
        -seated.pivot.y,
        seated.rect.width,
        seated.rect.height,
      ),
      this.displayOriginX,
      this.displayOriginY,
    )
    this.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains)
    this.inputShape = hitArea
    this.#updateHitArea(seated)
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
    this.#applyPoseTransform(DIRECT_CAT_POSES[this.poseName] ?? DIRECT_CAT_POSES.seated)
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
    return { state: this.motionState, frame: this.motionFrame, facing: this.facing, pose: this.poseName }
  }

  acknowledgePetting(welcome = true) {
    if (welcome) this.setMotionState('welcome')

    this.scene.tweens.killTweensOf(this.pixelSprite)
    this.pixelSprite.setY(0)
    this.scene.tweens.add({
      targets: this.pixelSprite,
      y: welcome ? -8 : 3,
      duration: 130,
      yoyo: true,
      ease: 'Sine.Out',
    })
    return this
  }

  #showPixelFrame(state, frame) {
    return this.#showDirectPose(resolveDirectCatPose(state, frame))
  }

  #showDirectPose(poseName) {
    const pose = DIRECT_CAT_POSES[poseName] ?? DIRECT_CAT_POSES.seated
    if (!this.scene.textures?.exists?.(DIRECT_ART_FILES.cat.key)) return false
    this.poseName = DIRECT_CAT_POSES[poseName] ? poseName : 'seated'
    this.pixelSprite
      .setTexture(DIRECT_ART_FILES.cat.key, pose.frame)
    this.#applyPoseTransform(pose)
    return true
  }

  #applyPoseTransform(pose) {
    const flip = this.facing === 'right'
    const sourceOriginX = pose.pivot.x / pose.rect.width
    this.pixelSprite
      .setOrigin(flip ? 1 - sourceOriginX : sourceOriginX, pose.pivot.y / pose.rect.height)
      .setFlipX(flip)
    this.#updateHitArea(pose)
  }

  #updateHitArea(pose) {
    if (!this.input) return
    const flip = this.facing === 'right'
    const localX = flip ? -(pose.rect.width - pose.pivot.x) : -pose.pivot.x
    const shape = alignCenteredHitArea(
      new Phaser.Geom.Rectangle(localX, -pose.pivot.y, pose.rect.width, pose.rect.height),
      this.displayOriginX,
      this.displayOriginY,
    )
    this.input.hitArea = shape
    this.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains
    this.inputShape = shape
  }

  #applyTint() {
    const generalTint = this.night ? 0xffeed9 : 0xffffff
    this.pixelSprite.setTint(generalTint)
  }
}

export default Cat
