import Phaser from '../phaser.js'
import { alignCenteredHitArea } from '../input/HitArea.js'

const containsFor = shape => {
  if (shape instanceof Phaser.Geom.Ellipse) return Phaser.Geom.Ellipse.Contains
  if (shape instanceof Phaser.Geom.Circle) return Phaser.Geom.Circle.Contains
  if (shape instanceof Phaser.Geom.Polygon) return Phaser.Geom.Polygon.Contains
  return Phaser.Geom.Rectangle.Contains
}

export class InteractiveObject extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { name, texture, scale = 1, hitArea = null, onActivate = null } = {}) {
    super(scene, x, y)
    this.name = name || texture || 'interactive-object'
    this.visual = scene.add.image(0, 0, texture)
    this.visual.setScale(scale)
    this.baseVisualY = this.visual.y
    this.hovered = false
    this.attention = false
    this.add(this.visual)
    scene.add.existing(this)

    const width = this.visual.displayWidth
    const height = this.visual.displayHeight
    this.setSize(width, height)
    const centeredShape = hitArea || new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height)
    const shape = alignCenteredHitArea(centeredShape, this.displayOriginX, this.displayOriginY)
    this.setInteractive(shape, containsFor(shape))
    this.inputShape = shape

    this.on('pointerover', () => {
      this.hovered = true
      this.applyTint()
    })
    this.on('pointerout', () => {
      this.hovered = false
      this.visual.setY(this.baseVisualY)
      this.applyTint()
    })
    this.on('pointerdown', () => this.visual.setY(this.baseVisualY + 1))
    this.on('pointerup', pointer => {
      this.visual.setY(this.baseVisualY)
      onActivate?.(this, pointer)
    })
  }

  setAttention(active) {
    this.attention = Boolean(active)
    this.applyTint()
    return this
  }

  applyTint() {
    this.visual.setTint(this.attention ? 0xffd77a : this.hovered ? 0xffefc7 : 0xffffff)
  }
}

export default InteractiveObject
