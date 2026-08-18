import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Toy extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'toy',
      texture: 'pixel.furniture.toy',
      scale: 1,
      hitArea: new Phaser.Geom.Circle(0, 0, 12),
      onActivate,
    })
  }
}

export default Toy
