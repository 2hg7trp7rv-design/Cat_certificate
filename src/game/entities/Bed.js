import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Bed extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'bed',
      width: 224,
      height: 180,
      hitArea: new Phaser.Geom.Ellipse(0, 0, 224, 180),
      onActivate,
    })
  }
}

export default Bed
