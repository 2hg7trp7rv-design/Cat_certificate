import Phaser from '../phaser.js'
import InteractiveObject from './InteractiveObject.js'

export class Toy extends InteractiveObject {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, {
      name: 'toy',
      width: 116,
      height: 116,
      hitArea: new Phaser.Geom.Circle(0, 0, 58),
      onActivate,
    })
  }
}

export default Toy
