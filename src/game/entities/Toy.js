import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Toy extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'toy',
      texture: 'placeholder.furniture.toy',
      scale: 0.78,
      hitArea: new Phaser.Geom.Circle(18, 15, 54),
      onActivate,
    })
  }
}

export default Toy
