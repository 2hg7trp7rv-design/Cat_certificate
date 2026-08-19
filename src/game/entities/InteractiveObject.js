import Phaser from '../phaser.js'
import { alignCenteredHitArea } from '../input/HitArea.js'

const containsFor = shape => {
  if (shape instanceof Phaser.Geom.Ellipse) return Phaser.Geom.Ellipse.Contains
  if (shape instanceof Phaser.Geom.Circle) return Phaser.Geom.Circle.Contains
  if (shape instanceof Phaser.Geom.Polygon) return Phaser.Geom.Polygon.Contains
  return Phaser.Geom.Rectangle.Contains
}

export class InteractiveObject extends Phaser.GameObjects.Container {
  constructor(scene, x, y, {
    name,
    texture = null,
    width: requestedWidth = null,
    height: requestedHeight = null,
    scale = 1,
    hitArea = null,
    onActivate = null,
  } = {}) {
    super(scene, x, y)
    this.name = name || texture || 'interactive-object'
    this.visual = texture ? scene.add.image(0, 0, texture).setScale(scale) : null
    this.baseVisualY = this.visual?.y ?? 0
    this.hovered = false
    this.attention = false
    if (this.visual) this.add(this.visual)
    scene.add.existing(this)

    const width = Number(requestedWidth) || this.visual?.displayWidth || 1
    const height = Number(requestedHeight) || this.visual?.displayHeight || 1
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
      this.visual?.setY(this.baseVisualY)
      this.applyTint()
    })
    this.on('pointerdown', () => this.visual?.setY(this.baseVisualY + 1))
    this.on('pointerup', pointer => {
      this.visual?.setY(this.baseVisualY)
      onActivate?.(this, pointer)
    })
  }

  setAttention(active) {
    this.attention = Boolean(active)
    this.applyTint()
    return this
  }

  /**
   * Empty Containers have no render bounds in Phaser, even though their
   * Canvas hit geometry is valid. Expose the centered interaction footprint
   * separately so QA and responsive checks inspect the real tappable area.
   */
  getInteractionBounds(output = new Phaser.Geom.Rectangle()) {
    const width = this.width * Math.abs(this.scaleX)
    const height = this.height * Math.abs(this.scaleY)
    return output.setTo(this.x - width / 2, this.y - height / 2, width, height)
  }

  applyTint() {
    this.visual?.setTint(this.attention ? 0xffd77a : this.hovered ? 0xffefc7 : 0xffffff)
  }
}

export default InteractiveObject
