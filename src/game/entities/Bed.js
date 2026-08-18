import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Bed extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'bed',
      texture: 'pixel.furniture.bed',
      scale: 1,
      hitArea: new Phaser.Geom.Ellipse(0, 0, 62, 34),
      onActivate,
    })
  }
}

export default Bed
