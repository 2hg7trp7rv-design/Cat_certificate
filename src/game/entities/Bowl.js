import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Bowl extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'bowl',
      width: 160,
      height: 125,
      hitArea: new Phaser.Geom.Ellipse(0, 0, 160, 125),
      onActivate,
    })
  }
}

export default Bowl
