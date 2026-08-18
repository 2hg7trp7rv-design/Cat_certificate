import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Bowl extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'bowl',
      texture: 'pixel.furniture.bowl',
      scale: 1,
      hitArea: new Phaser.Geom.Ellipse(0, 0, 32, 22),
      onActivate,
    })
  }
}

export default Bowl
