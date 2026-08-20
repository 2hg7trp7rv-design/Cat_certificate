import Phaser from '../phaser.js'
import {
  CAT_BLINK_SEQUENCE,
  CAT_MOTION_ART_FILE,
  CAT_MOTION_FRAMES,
  CAT_TAIL_MOTION,
} from '../art/CatMotionManifest.js'
import {
  DIRECT_ART_FILES,
  DIRECT_CAT_POSES,
  resolveDirectCatPose,
} from '../art/DirectArtManifest.js'
import { alignCenteredHitArea } from '../input/HitArea.js'
import { resolveCatKinematicTransform } from '../motion/CatKinematics.js'

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
  // Hold the caught-toy pose long enough for a player to read the success,
  // instead of flashing through the moment between pounce and recovery.
  'play-catch': animation(6, [260, 250, 240, 250, 260, 340]),
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
    this.frameId = 'seated'
    this.textureKey = DIRECT_ART_FILES.cat.key
    this.visualMode = 'direct'
    this.currentFrameSpec = DIRECT_CAT_POSES.seated
    this.tailAngle = 0

    this.reactionRoot = new Phaser.GameObjects.Container(scene, 0, 0)
    this.motionRoot = new Phaser.GameObjects.Container(scene, 0, 0)
    this.reactionRoot.add(this.motionRoot)
    this.add(this.reactionRoot)

    const createSprite = typeof scene.add.sprite === 'function'
      ? scene.add.sprite.bind(scene.add)
      : scene.add.image.bind(scene.add)
    this.pixelSprite = createSprite(0, 0, DIRECT_ART_FILES.cat.key, DIRECT_CAT_POSES.seated.frame)
    this.tailPartSprite = createSprite(0, 0, CAT_MOTION_ART_FILE.key, CAT_TAIL_MOTION.partFrame)
      .setVisible(false)
    this.tailBodySprite = createSprite(0, 0, CAT_MOTION_ART_FILE.key, CAT_TAIL_MOTION.bodyFrame)
      .setVisible(false)
    this.motionRoot.add([this.tailPartSprite, this.tailBodySprite, this.pixelSprite])
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
    this.#applyCurrentVisualTransform()
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
    const kinematic = resolveCatKinematicTransform(motionState, frame)
    this.motionRoot.setPosition(0, kinematic.y).setAngle(kinematic.angle)
    this.#applyTint()
    return this
  }

  getMotionState() {
    return {
      state: this.motionState,
      frame: this.motionFrame,
      frameId: this.frameId,
      textureKey: this.textureKey,
      facing: this.facing,
      pose: this.poseName,
      visualMode: this.visualMode,
      transform: Object.freeze({ y: this.motionRoot.y, angle: this.motionRoot.angle }),
      tailAngle: this.visualMode === 'tail' ? this.tailAngle : 0,
    }
  }

  setDirectPose(poseName = 'seated', facing = this.facing) {
    if (!DIRECT_CAT_POSES[poseName]) throw new RangeError(`Unknown direct cat pose: ${poseName}`)
    this.facing = facing === 'left' ? 'left' : 'right'
    this.motionState = 'direct-pose'
    this.motionFrame = 0
    this.motionRoot.setPosition(0, 0).setAngle(0)
    this.#showDirectPose(poseName)
    this.#applyTint()
    return this
  }

  acknowledgePetting(welcome = true) {
    if (welcome) this.setMotionState('welcome')

    this.scene.tweens.killTweensOf(this.reactionRoot)
    this.reactionRoot.setY(0)
    this.scene.tweens.add({
      targets: this.reactionRoot,
      y: welcome ? -8 : 3,
      duration: 130,
      yoyo: true,
      ease: 'Sine.Out',
    })
    return this
  }

  #showPixelFrame(state, frame) {
    if (state === 'blink') {
      const frameId = CAT_BLINK_SEQUENCE[Math.min(frame, CAT_BLINK_SEQUENCE.length - 1)]
      return this.#showMotionFrame(frameId)
    }
    if (state === 'tail') {
      const angle = CAT_TAIL_MOTION.angles[Math.min(frame, CAT_TAIL_MOTION.angles.length - 1)] ?? 0
      return this.#showTailComposite(angle, frame)
    }
    return this.#showDirectPose(resolveDirectCatPose(state, frame))
  }

  #showMotionFrame(frameId) {
    const frame = CAT_MOTION_FRAMES[frameId]
    if (!frame || !this.scene.textures?.exists?.(CAT_MOTION_ART_FILE.key)) return false
    this.visualMode = 'motion-frame'
    this.poseName = frame.canonicalPose
    this.frameId = frameId
    this.textureKey = CAT_MOTION_ART_FILE.key
    this.currentFrameSpec = frame
    this.tailAngle = 0
    this.pixelSprite
      .setVisible(true)
      .setTexture(CAT_MOTION_ART_FILE.key, frame.frame)
    this.tailBodySprite.setVisible(false)
    this.tailPartSprite.setVisible(false)
    this.#applyCurrentVisualTransform()
    return true
  }

  #showTailComposite(angle, frame) {
    if (!this.scene.textures?.exists?.(CAT_MOTION_ART_FILE.key)) return false
    this.visualMode = 'tail'
    this.poseName = 'seated'
    this.frameId = `tail-composite-${Math.max(0, Math.floor(Number(frame) || 0))}`
    this.textureKey = CAT_MOTION_ART_FILE.key
    this.currentFrameSpec = CAT_MOTION_FRAMES[CAT_TAIL_MOTION.bodyFrame]
    this.tailAngle = Number(angle) || 0
    this.pixelSprite.setVisible(false)
    this.tailPartSprite
      .setVisible(true)
      .setTexture(CAT_MOTION_ART_FILE.key, CAT_TAIL_MOTION.partFrame)
    this.tailBodySprite
      .setVisible(true)
      .setTexture(CAT_MOTION_ART_FILE.key, CAT_TAIL_MOTION.bodyFrame)
    this.#applyCurrentVisualTransform()
    return true
  }

  #showDirectPose(poseName) {
    const pose = DIRECT_CAT_POSES[poseName] ?? DIRECT_CAT_POSES.seated
    if (!this.scene.textures?.exists?.(DIRECT_ART_FILES.cat.key)) return false
    this.visualMode = 'direct'
    this.poseName = DIRECT_CAT_POSES[poseName] ? poseName : 'seated'
    this.frameId = pose.frame
    this.textureKey = DIRECT_ART_FILES.cat.key
    this.currentFrameSpec = pose
    this.tailAngle = 0
    this.pixelSprite
      .setVisible(true)
      .setTexture(DIRECT_ART_FILES.cat.key, pose.frame)
    this.tailBodySprite.setVisible(false)
    this.tailPartSprite.setVisible(false)
    this.#applyCurrentVisualTransform()
    return true
  }

  #applyCurrentVisualTransform() {
    if (this.visualMode === 'tail') {
      this.#applyTailTransform()
      return
    }
    this.#applySpriteTransform(this.currentFrameSpec ?? DIRECT_CAT_POSES.seated)
  }

  #applySpriteTransform(frame) {
    const flip = this.facing === 'right'
    const sourceOriginX = frame.pivot.x / frame.rect.width
    this.pixelSprite
      .setPosition(0, 0)
      .setAngle(0)
      .setOrigin(flip ? 1 - sourceOriginX : sourceOriginX, frame.pivot.y / frame.rect.height)
      .setFlipX(flip)
    this.#updateHitArea(DIRECT_CAT_POSES[this.poseName] ?? DIRECT_CAT_POSES.seated)
  }

  #applyTailTransform() {
    const flip = this.facing === 'right'
    const body = CAT_MOTION_FRAMES[CAT_TAIL_MOTION.bodyFrame]
    const part = CAT_MOTION_FRAMES[CAT_TAIL_MOTION.partFrame]
    const bodyOriginX = body.pivot.x / body.rect.width
    const partOriginX = CAT_TAIL_MOTION.partPivot.x / part.rect.width
    const offsetX = CAT_TAIL_MOTION.partPivot.x - body.pivot.x
    const offsetY = CAT_TAIL_MOTION.partPivot.y - body.pivot.y

    this.tailBodySprite
      .setPosition(0, 0)
      .setAngle(0)
      .setOrigin(flip ? 1 - bodyOriginX : bodyOriginX, body.pivot.y / body.rect.height)
      .setFlipX(flip)
    this.tailPartSprite
      .setPosition(flip ? -offsetX : offsetX, offsetY)
      .setOrigin(flip ? 1 - partOriginX : partOriginX, CAT_TAIL_MOTION.partPivot.y / part.rect.height)
      .setFlipX(flip)
      .setAngle(flip ? -this.tailAngle : this.tailAngle)
    this.#updateHitArea(DIRECT_CAT_POSES.seated)
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
    this.tailBodySprite.setTint(generalTint)
    this.tailPartSprite.setTint(generalTint)
  }
}

export default Cat
