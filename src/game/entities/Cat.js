import Phaser from '../phaser.js'
import { alignCenteredHitArea } from '../input/HitArea.js'

const CAT_HIT_POLYGON = Object.freeze([
  -112, 80, -108, 8, -88, -72, -62, -126, -8, -138,
  54, -116, 88, -55, 112, 8, 118, 73, 83, 112, 22, 124,
  -46, 119, -91, 103,
])

export class Cat extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { scale = 0.72 } = {}) {
    super(scene, x, y)
    this.baseScale = scale
    this.parts = {}

    this.parts.tail = scene.add.image(77, 55, 'placeholder.cat.tail').setOrigin(0.5)
    this.parts.body = scene.add.image(0, 42, 'placeholder.cat.body')
    this.parts.leftEar = scene.add.image(-52, -84, 'placeholder.cat.ear')
    this.parts.rightEar = scene.add.image(10, -84, 'placeholder.cat.ear').setFlipX(true)
    this.parts.head = scene.add.image(-20, -35, 'placeholder.cat.head')
    this.parts.leftEye = scene.add.image(-41, -39, 'placeholder.cat.eye')
    this.parts.rightEye = scene.add.image(2, -39, 'placeholder.cat.eye').setFlipX(true)
    this.parts.muzzle = scene.add.image(-19, -7, 'placeholder.cat.muzzle')
    this.parts.nose = scene.add.image(-19, -18, 'placeholder.cat.nose')
    this.parts.whiskers = scene.add.image(-19, 0, 'placeholder.cat.whiskers')

    this.add([
      this.parts.tail,
      this.parts.body,
      this.parts.leftEar,
      this.parts.rightEar,
      this.parts.head,
      this.parts.leftEye,
      this.parts.rightEye,
      this.parts.muzzle,
      this.parts.nose,
      this.parts.whiskers,
    ])
    scene.add.existing(this)
    this.setScale(scale)
    this.setSize(240, 275)
    const hitArea = alignCenteredHitArea(
      new Phaser.Geom.Polygon(CAT_HIT_POLYGON),
      this.displayOriginX,
      this.displayOriginY,
    )
    this.setInteractive(hitArea, Phaser.Geom.Polygon.Contains)
    this.inputShape = hitArea
  }

  setGrowthScale(growthScale = 1) {
    const target = this.baseScale * Number(growthScale || 1)
    this.setScale(target)
    return this
  }

  setSleeping(sleeping) {
    this.parts.leftEye.setVisible(!sleeping)
    this.parts.rightEye.setVisible(!sleeping)
    this.parts.head.setTint(sleeping ? 0xe4d8ca : 0xffffff)
    return this
  }

  setNightReadable(night) {
    const tint = night ? 0xffeed9 : 0xffffff
    for (const part of Object.values(this.parts)) part.setTint(tint)
    return this
  }

  acknowledgePetting(welcome = true) {
    this.scene.tweens.killTweensOf(this)
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * (welcome ? 1.025 : 0.985),
      scaleY: this.scaleY * (welcome ? 1.025 : 0.985),
      duration: 130,
      yoyo: true,
      ease: 'Sine.Out',
    })
  }
}

export default Cat
