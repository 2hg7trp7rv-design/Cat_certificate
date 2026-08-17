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
    this.add(this.visual)
    scene.add.existing(this)

    const width = this.visual.displayWidth
    const height = this.visual.displayHeight
    this.setSize(width, height)
    const centeredShape = hitArea || new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height)
    const shape = alignCenteredHitArea(centeredShape, this.displayOriginX, this.displayOriginY)
    this.setInteractive(shape, containsFor(shape))
    this.inputShape = shape

    this.on('pointerover', () => this.visual.setAlpha(0.94))
    this.on('pointerout', () => this.visual.setAlpha(1))
    this.on('pointerup', pointer => onActivate?.(this, pointer))
  }

  setAttention(active) {
    this.visual.setTint(active ? 0xffefc7 : 0xffffff)
    return this
  }
}

export default InteractiveObject
