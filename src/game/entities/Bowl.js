import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Bowl extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'bowl',
      texture: 'placeholder.furniture.bowl',
      scale: 0.9,
      hitArea: new Phaser.Geom.Ellipse(0, 0, 108, 76),
      onActivate,
    })
  }
}

export default Bowl
