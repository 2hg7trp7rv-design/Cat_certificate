import Phaser from '../phaser.js'
import { CatBehaviorController, DEFAULT_CAT_ANCHORS } from '../behavior/CatBehaviorController.js'
import Bed from '../entities/Bed.js'
import Bowl from '../entities/Bowl.js'
import Cat from '../entities/Cat.js'
import InteractiveObject from '../entities/InteractiveObject.js'
import Toy from '../entities/Toy.js'
import AmbientRoomMotion from './AmbientRoomMotion.js'

export const ROOM_ANCHORS = DEFAULT_CAT_ANCHORS

const CRITICAL_BEHAVIORS = new Set(['first-meeting', 'sleep', 'wait-for-meal', 'rest'])

const phaseLight = phase => ({
  morning: { window: 0.68, lamp: 0.06, night: 0 },
  day: { window: 0.48, lamp: 0.02, night: 0 },
  evening: { window: 0.16, lamp: 0.3, night: 0.14 },
  night: { window: 0.02, lamp: 0.58, night: 0.43 },
}[phase] ?? { window: 0.48, lamp: 0.02, night: 0 })

const centerOf = object => ({ x: object.x, y: object.y })

// Keep Phaser Rectangle instances out of the browser-smoke/report boundary.
const boundsOf = object => {
  const bounds = object?.getBounds?.()
  if (!bounds) return null
  const x = Number(bounds.x)
  const y = Number(bounds.y)
  const width = Number(bounds.width)
  const height = Number(bounds.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  return {
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  }
}

/**
 * The v0.8 room is composed at low art resolution. Every visible concern is a
 * separate texture and layer; the camera is responsible for the fixed 2x
 * presentation scale.
 */
export class RoomWorld {
  constructor(scene, {
    firstMeeting = false,
    onFood,
    onBed,
    onToy,
    onWindow,
    onPlayComplete,
  } = {}) {
    this.scene = scene
    this.firstMeeting = firstMeeting
    this.snapshot = null
    this.roomLayer = scene.add.layer().setName('roomLayer')
    this.shadowLayer = scene.add.layer().setName('shadowLayer')
    this.furnitureLayer = scene.add.layer().setName('furnitureLayer')
    this.catLayer = scene.add.layer().setName('catLayer')
    this.foregroundLayer = scene.add.layer().setName('foregroundLayer')
    this.lightLayer = scene.add.layer().setName('lightLayer')
    this.layerNames = ['roomLayer', 'shadowLayer', 'furnitureLayer', 'catLayer', 'foregroundLayer', 'lightLayer']
    const initialCatPosition = firstMeeting ? { x: 108, y: 350 } : ROOM_ANCHORS.carrier

    this.backdrop = scene.add.image(108, 236, 'pixel.room.backdrop')
    this.exterior = scene.add.image(82, 136, 'pixel.room.exterior')
    this.roomLayer.add([this.backdrop, this.exterior])

    this.furnitureContactShadow = scene.add.image(132, 338, 'pixel.shadow.furniture-contact')
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.catContactShadow = scene.add.image(initialCatPosition.x, initialCatPosition.y + 1, 'pixel.shadow.cat-contact')
      .setScale(0.72)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.shadowLayer.add([this.furnitureContactShadow, this.catContactShadow])

    this.window = new InteractiveObject(scene, 82, 136, {
      name: 'window',
      texture: 'pixel.room.window',
      hitArea: new Phaser.Geom.Rectangle(-52, -64, 104, 124),
      onActivate: () => onWindow?.(),
    })
    this.leftCurtain = scene.add.image(30, 136, 'pixel.furniture.curtain')
    this.rightCurtain = scene.add.image(134, 136, 'pixel.furniture.curtain').setFlipX(true)
    this.shelf = scene.add.image(72, 264, 'pixel.furniture.shelf')
    this.sofa = scene.add.image(136, 300, 'pixel.furniture.sofa')
    this.tower = scene.add.image(168, 232, 'pixel.furniture.tower').setScale(0.62)
    this.lamp = scene.add.image(38, 300, 'pixel.furniture.lamp')
    this.rug = scene.add.image(108, 367, 'pixel.furniture.rug')
    this.bed = new Bed(scene, 68, 376, () => onBed?.())
    this.bowl = new Bowl(scene, 166, 388, () => onFood?.())
    this.toy = new Toy(scene, 126, 388, () => onToy?.())
    this.furnitureLayer.add([
      this.window,
      this.leftCurtain,
      this.rightCurtain,
      this.shelf,
      this.sofa,
      this.tower,
      this.lamp,
      this.rug,
      this.bed,
      this.bowl,
      this.toy,
    ])

    this.cat = new Cat(scene, initialCatPosition.x, initialCatPosition.y, { scale: 0.8 })
    this.catLayer.add(this.cat)

    this.plant = scene.add.image(164, 304, 'pixel.furniture.plant')
    this.foregroundLayer.add(this.plant)

    this.windowLight = scene.add.image(96, 244, 'pixel.light.window-day')
      .setBlendMode(Phaser.BlendModes.ADD)
    this.nightWash = scene.add.image(108, 236, 'pixel.light.night-wash')
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.lampGlow = scene.add.image(46, 292, 'pixel.light.lamp-glow')
      .setBlendMode(Phaser.BlendModes.ADD)
    this.lightLayer.add([this.nightWash, this.windowLight, this.lampGlow])

    this.ambientMotion = new AmbientRoomMotion(scene, {
      roomLayer: this.roomLayer,
      curtains: [this.leftCurtain, this.rightCurtain],
      lampGlow: this.lampGlow,
      windowLight: this.windowLight,
    })
    this.motionTrace = []
    this.behavior = new CatBehaviorController(this.cat, {
      anchors: ROOM_ANCHORS,
      onPosition: ({ x, y }) => this.catContactShadow.setPosition(x, y + 1),
      onStateChange: ({ action, state }) => {
        const previous = this.motionTrace.at(-1)
        if (previous?.action !== action || previous?.state !== state) {
          this.motionTrace.push({
            action: action ?? null,
            state: state ?? null,
            clock: Number(this.behavior?.clock ?? 0),
          })
          if (this.motionTrace.length > 64) this.motionTrace.shift()
        }
        const carryingToy = /play$/.test(action ?? '') && state === 'play-catch'
        this.setToyCaught(carryingToy)
      },
      onActionComplete: ({ id, reason }) => {
        // Completion also covers interruption and stop paths. Never leave the
        // room prop hidden after a caught-toy frame is replaced.
        this.setToyCaught(false)
        if (id === 'player-play' && reason === 'completed') onPlayComplete?.()
      },
    })

    if (firstMeeting) {
      for (const object of [this.window, this.bed, this.bowl, this.toy]) object.disableInteractive()
    } else {
      this.behavior.reactToVisit()
    }
  }

  update(snapshot) {
    this.snapshot = snapshot
    const phase = snapshot?.time?.phase ?? 'day'
    const sleeping = Boolean(snapshot?.time?.sleeping)
    const lighting = phaseLight(phase)

    this.windowLight.setData('baseAlpha', lighting.window).setAlpha(lighting.window)
    this.lampGlow.setData('baseAlpha', lighting.lamp).setAlpha(lighting.lamp)
    this.nightWash.setAlpha(lighting.night)
    this.ambientMotion.setPhase(phase)
    this.cat.setGrowthScale(snapshot?.growth?.scale ?? 1)
    this.cat.setNightReadable(phase === 'night')
    this.bowl.setAttention(Boolean(snapshot?.needs?.hungry))
    this.bed.setAttention(sleeping)
    return this
  }

  step(time) {
    if (!this.snapshot) return this
    this.behavior.update(this.snapshot, time)
    this.catContactShadow.setPosition(this.cat.x, this.cat.y + 1)
    return this
  }

  requestPlay() {
    const current = this.snapshot?.behavior
    if (current && CRITICAL_BEHAVIORS.has(current.id)) {
      return { accepted: false, reason: current.reason ?? current.id }
    }
    return { accepted: this.behavior.requestPlay(), reason: null }
  }

  reactToPetting(welcome) {
    if (!welcome) {
      this.cat.acknowledgePetting(false)
      return false
    }
    return this.behavior.reactToVisit()
  }

  setToyCaught(caught) {
    const carryingToy = Boolean(caught)
    this.toy?.setVisible(!carryingToy)
    if (this.toy?.input) this.toy.input.enabled = !carryingToy && !this.firstMeeting
    return this
  }

  getInteractiveObjects() {
    return [this.window, this.bed, this.bowl, this.toy, this.cat]
  }

  getQaSnapshot() {
    const camera = this.scene.cameras.main
    return {
      anchors: ROOM_ANCHORS,
      camera: {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom,
        width: camera.width,
        height: camera.height,
      },
      centers: {
        cat: centerOf(this.cat),
        bed: centerOf(this.bed),
        bowl: centerOf(this.bowl),
        toy: centerOf(this.toy),
        window: centerOf(this.window),
      },
      bounds: {
        cat: boundsOf(this.cat),
        objects: {
          bed: boundsOf(this.bed),
          bowl: boundsOf(this.bowl),
          toy: boundsOf(this.toy),
          window: boundsOf(this.window),
        },
      },
      visibility: {
        toy: Boolean(this.toy.visible),
      },
      behavior: this.behavior.getState(),
      motionTrace: this.motionTrace.map(entry => ({ ...entry })),
    }
  }

  destroy() {
    this.setToyCaught(false)
    this.behavior?.destroy()
    this.ambientMotion?.destroy()
    this.motionTrace = []
    this.snapshot = null
  }
}

export default RoomWorld
