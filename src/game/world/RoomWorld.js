import Phaser from '../phaser.js'
import Bed from '../entities/Bed.js'
import Bowl from '../entities/Bowl.js'
import Cat from '../entities/Cat.js'
import InteractiveObject from '../entities/InteractiveObject.js'
import Toy from '../entities/Toy.js'

export class RoomWorld {
  constructor(scene, { firstMeeting = false, onFood, onBed, onToy, onWindow } = {}) {
    this.scene = scene
    this.firstMeeting = firstMeeting
    this.roomLayer = scene.add.layer().setName('roomLayer')
    this.shadowLayer = scene.add.layer().setName('shadowLayer')
    this.furnitureLayer = scene.add.layer().setName('furnitureLayer')
    this.catLayer = scene.add.layer().setName('catLayer')
    this.foregroundLayer = scene.add.layer().setName('foregroundLayer')
    this.lightLayer = scene.add.layer().setName('lightLayer')
    this.layerNames = ['roomLayer', 'shadowLayer', 'furnitureLayer', 'catLayer', 'foregroundLayer', 'lightLayer']

    this.backdrop = scene.add.image(196.5, 426, 'placeholder.room.backdrop')
    this.exterior = scene.add.image(106, 224, 'placeholder.room.exterior').setScale(0.84)
    this.roomLayer.add([this.backdrop, this.exterior])

    this.furnitureContactShadow = scene.add.image(258, 592, 'placeholder.shadow.furniture-contact').setScale(0.86)
    this.catContactShadow = scene.add.image(firstMeeting ? 197 : 210, firstMeeting ? 697 : 696, 'placeholder.shadow.cat-contact').setScale(firstMeeting ? 0.92 : 0.78)
    this.shadowLayer.add([this.furnitureContactShadow, this.catContactShadow])

    this.window = new InteractiveObject(scene, 106, 226, {
      name: 'window',
      texture: 'placeholder.room.window',
      scale: 0.86,
      hitArea: new Phaser.Geom.Rectangle(-112, -142, 224, 284),
      onActivate: () => onWindow?.(),
    })
    this.leftCurtain = scene.add.image(27, 236, 'placeholder.furniture.curtain').setScale(0.86)
    this.rightCurtain = scene.add.image(186, 236, 'placeholder.furniture.curtain').setScale(0.86).setFlipX(true)
    this.rug = scene.add.image(207, 733, 'placeholder.furniture.rug').setScale(0.94)
    this.sofa = scene.add.image(271, 512, 'placeholder.furniture.sofa').setScale(0.83)
    this.tower = scene.add.image(342, 401, 'placeholder.furniture.tower').setScale(0.82)
    this.bed = new Bed(scene, 84, 711, () => onBed?.())
    this.bowl = new Bowl(scene, 333, 775, () => onFood?.())
    this.toy = new Toy(scene, 122, 785, () => onToy?.())
    this.furnitureLayer.add([
      this.window,
      this.leftCurtain,
      this.rightCurtain,
      this.rug,
      this.sofa,
      this.tower,
      this.bed,
      this.bowl,
      this.toy,
    ])

    this.cat = new Cat(scene, firstMeeting ? 198 : 210, firstMeeting ? 618 : 626, { scale: firstMeeting ? 0.82 : 0.72 })
    this.catLayer.add(this.cat)

    this.foregroundShade = scene.add.rectangle(0, 769, 393, 83, 0x251a13, 0.14).setOrigin(0)
    this.foregroundLayer.add(this.foregroundShade)

    this.windowLight = scene.add.image(157, 430, 'placeholder.light.window-day').setBlendMode(Phaser.BlendModes.ADD)
    this.nightWash = scene.add.image(196.5, 426, 'placeholder.light.night-wash').setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.lampGlow = scene.add.image(302, 462, 'placeholder.light.lamp-glow').setBlendMode(Phaser.BlendModes.ADD)
    this.lightLayer.add([this.nightWash, this.windowLight, this.lampGlow])

    if (firstMeeting) {
      for (const object of [this.window, this.bed, this.bowl, this.toy]) object.disableInteractive()
    }
  }

  update(snapshot) {
    const { phase, sleeping } = snapshot.time
    const phaseLight = {
      morning: { window: 0.72, lamp: 0.08, night: 0 },
      day: { window: 0.52, lamp: 0.02, night: 0 },
      evening: { window: 0.18, lamp: 0.33, night: 0.14 },
      night: { window: 0.03, lamp: 0.68, night: 0.48 },
    }[phase]

    this.windowLight.setAlpha(phaseLight.window)
    this.lampGlow.setAlpha(phaseLight.lamp)
    this.nightWash.setAlpha(phaseLight.night)
    this.cat.setGrowthScale(snapshot.growth.scale)
    this.cat.setNightReadable(phase === 'night')
    this.cat.setSleeping(sleeping)
    this.bowl.setAttention(snapshot.needs.hungry)
    this.bed.setAttention(sleeping)
  }

  getInteractiveObjects() {
    return [this.window, this.bed, this.bowl, this.toy, this.cat]
  }
}

export default RoomWorld
