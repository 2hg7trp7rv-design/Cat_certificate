import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Bed extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'bed',
      texture: 'placeholder.furniture.bed',
      scale: 0.86,
      hitArea: new Phaser.Geom.Ellipse(0, 0, 170, 104),
      onActivate,
    })
  }
}

export default Bed
