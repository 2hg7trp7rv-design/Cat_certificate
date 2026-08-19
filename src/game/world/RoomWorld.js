import Phaser from '../phaser.js'
import {
  DIRECT_ART_FILES,
  DIRECT_CAT_PROP_ANCHORS,
  DIRECT_CAT_POSES,
  DIRECT_DERIVED_TEXTURES,
} from '../art/DirectArtManifest.js'
import { CatBehaviorController, DEFAULT_CAT_ANCHORS } from '../behavior/CatBehaviorController.js'
import Bed from '../entities/Bed.js'
import Bowl from '../entities/Bowl.js'
import Cat from '../entities/Cat.js'
import InteractiveObject from '../entities/InteractiveObject.js'
import Toy from '../entities/Toy.js'
import AmbientRoomMotion from './AmbientRoomMotion.js'
import { WORLD_CENTER_X, WORLD_CENTER_Y, WORLD_HEIGHT, WORLD_WIDTH } from './WorldCamera.js'

export const ROOM_ANCHORS = DEFAULT_CAT_ANCHORS

const CRITICAL_BEHAVIORS = new Set(['first-meeting', 'sleep', 'wait-for-meal', 'rest'])
const QA_BRIDGE_KEY = '__TAIL_ROOM_QA_BRIDGE__'
const QA_POSE_COMMANDS = Object.freeze({
  seated: Object.freeze({ state: 'idle', elapsedMs: 0, loop: true }),
  standing: Object.freeze({ state: 'walk', elapsedMs: 0, loop: true }),
  walking: Object.freeze({ state: 'walk', elapsedMs: 115, loop: true }),
  loaf: Object.freeze({ state: 'loaf', elapsedMs: 0, loop: true }),
  'side-lie': Object.freeze({ state: 'sleep-side', elapsedMs: 0, loop: true }),
  curl: Object.freeze({ state: 'sleep-curl', elapsedMs: 0, loop: true }),
  crouch: Object.freeze({ state: 'play-crouch', elapsedMs: 0, loop: true }),
  pounce: Object.freeze({ state: 'play-pounce', elapsedMs: 0, loop: true }),
})

const phaseLight = phase => ({
  morning: { window: 0, lamp: 0, night: 0 },
  day: { window: 0, lamp: 0, night: 0 },
  evening: { window: 0.025, lamp: 0.12, night: 0.12 },
  night: { window: 0.015, lamp: 0.2, night: 0.46 },
}[phase] ?? { window: 0, lamp: 0, night: 0 })

const centerOf = object => ({ x: object.x, y: object.y })

const boundsOf = object => {
  const bounds = object?.getInteractionBounds?.() ?? object?.getBounds?.()
  if (!bounds) return null
  const x = Number(bounds.x)
  const y = Number(bounds.y)
  const width = Number(bounds.width)
  const height = Number(bounds.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  return { x, y, width, height, right: x + width, bottom: y + height }
}

const renderStateOf = object => object ? {
  name: object.name || null,
  type: object.type || object.constructor?.name || null,
  texture: object.texture?.key ?? null,
  frame: object.frame?.name ?? null,
  x: Number(object.x),
  y: Number(object.y),
  originX: Number(object.originX ?? 0),
  originY: Number(object.originY ?? 0),
  scaleX: Number(object.scaleX ?? 1),
  scaleY: Number(object.scaleY ?? 1),
  displayWidth: Number(object.displayWidth ?? object.width ?? 0),
  displayHeight: Number(object.displayHeight ?? object.height ?? 0),
  visible: Boolean(object.visible),
  alpha: Number(object.alpha ?? 1),
  flipX: Boolean(object.flipX),
  bounds: boundsOf(object),
} : null

/**
 * The approved room PNG is the visible source of truth. Its furniture, light,
 * material and perspective are never reconstructed with procedural shapes.
 * Separate Phaser layers remain for the cat, its shadow, local lighting and
 * Canvas hit geometry, so state and interaction do not return to DOM overlays.
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
    const initialCatPosition = ROOM_ANCHORS.carrier

    this.backdrop = scene.add.image(WORLD_CENTER_X, WORLD_CENTER_Y, DIRECT_ART_FILES.room.key, '__BASE')
      .setName('approvedRoomImage')
    this.roomLayer.add(this.backdrop)

    this.catContactShadow = scene.add.ellipse(
      initialCatPosition.x,
      initialCatPosition.y + 10,
      210,
      48,
      0x2b160c,
      0.28,
    ).setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.shadowLayer.add(this.catContactShadow)

    // Canvas hit regions over objects already present in the exact room image.
    // They do not draw replacement furniture and never create DOM hotspots.
    this.window = new InteractiveObject(scene, 560, 450, {
      name: 'window',
      width: 420,
      height: 430,
      hitArea: new Phaser.Geom.Rectangle(-210, -215, 420, 430),
      onActivate: () => onWindow?.(),
    })
    this.bed = new Bed(scene, 740, 1120, () => onBed?.())
    this.bowl = new Bowl(scene, 146, 1410, () => onFood?.())
    this.toy = new Toy(scene, 552, 1490, () => onToy?.())
    this.toyFloorCover = scene.add.image(552, 1493, DIRECT_ART_FILES.room.key, 'toy-floor-cover')
      .setName('toyFloorCover')
      .setVisible(false)
    this.furnitureLayer.add([this.toyFloorCover, this.window, this.bed, this.bowl, this.toy])

    this.caughtToy = scene.add.image(
      initialCatPosition.x,
      initialCatPosition.y,
      DIRECT_DERIVED_TEXTURES.caughtToy.key,
    ).setName('caughtToy').setVisible(false)
    this.cat = new Cat(scene, initialCatPosition.x, initialCatPosition.y, { scale: 0.75 })
    this.catLayer.add([this.caughtToy, this.cat])

    this.bedForeground = scene.add.image(
      620,
      1075,
      DIRECT_DERIVED_TEXTURES.bedForeground.key,
    )
      .setName('bedForeground')
      .setOrigin(0)
    this.foregroundLayer.add(this.bedForeground)

    this.nightWash = scene.add.rectangle(
      WORLD_CENTER_X,
      WORLD_CENTER_Y,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      0x26384b,
      0,
    ).setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.windowLight = scene.add.rectangle(560, 520, 430, 560, 0xffdda0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.lampGlow = scene.add.ellipse(218, 720, 330, 380, 0xffb24e, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.lightLayer.add([this.nightWash, this.windowLight, this.lampGlow])

    this.ambientMotion = new AmbientRoomMotion(scene, {
      roomLayer: this.roomLayer,
      lampGlow: this.lampGlow,
      windowLight: this.windowLight,
    })
    this.motionTrace = []
    this.behavior = new CatBehaviorController(this.cat, {
      anchors: ROOM_ANCHORS,
      onPosition: ({ x, y }) => {
        this.catContactShadow.setPosition(x, y + 10)
        this.syncCaughtToy()
      },
      onStateChange: ({ action, state }) => {
        const previous = this.motionTrace.at(-1)
        if (previous?.action !== action || previous?.state !== state) {
          this.motionTrace.push({
            action: action ?? null,
            state: state ?? null,
            pose: this.cat.getMotionState().pose,
            clock: Number(this.behavior?.clock ?? 0),
          })
          if (this.motionTrace.length > 64) this.motionTrace.shift()
        }
        const carryingToy = /play$/.test(action ?? '') && state === 'play-catch'
        this.setToyCaught(carryingToy)
      },
      onActionComplete: ({ id, reason }) => {
        this.setToyCaught(false)
        if (id === 'player-play' && reason === 'completed') onPlayComplete?.()
      },
    })

    if (firstMeeting) {
      for (const object of [this.window, this.bed, this.bowl, this.toy]) object.disableInteractive()
    } else {
      this.behavior.reactToVisit()
    }

    this.installQaBridge()
  }

  installQaBridge() {
    if (typeof window === 'undefined'
      || typeof document === 'undefined'
      || document.documentElement.dataset.qa !== 'true') return this

    const allowedTextureKeys = new Set([
      ...Object.values(DIRECT_ART_FILES).map(file => file.key),
      ...Object.values(DIRECT_DERIVED_TEXTURES).map(texture => texture.key),
    ])
    const bridge = Object.freeze({
      version: 1,
      inspect: () => this.getQaRenderInspection(),
      getTextureSource: key => {
        if (!allowedTextureKeys.has(key) || !this.scene?.textures?.exists?.(key)) return null
        return this.scene.textures.get(key).getSourceImage()
      },
      setPose: (poseName, facing = 'right') => this.setQaPose(poseName, facing),
    })
    this.qaBridge = bridge
    window[QA_BRIDGE_KEY] = bridge
    return this
  }

  setQaPose(poseName, facing = 'right') {
    const command = QA_POSE_COMMANDS[poseName]
    if (!command || !DIRECT_CAT_POSES[poseName]) throw new RangeError(`Unknown QA cat pose: ${poseName}`)
    this.behavior?.stop({ resetPose: false })
    this.setToyCaught(false)
    this.scene?.tweens?.killTweensOf?.(this.cat.pixelSprite)
    this.cat.pixelSprite.setY(0)
    this.cat
      .setWorldPosition(ROOM_ANCHORS['center-idle'].x, ROOM_ANCHORS['center-idle'].y)
      .setFacing(facing)
      .setMotionState(command.state, command)
    this.catContactShadow.setPosition(this.cat.x, this.cat.y + 10)
    this.syncCaughtToy()
    return this.getQaRenderInspection()
  }

  getQaRenderInspection() {
    const camera = this.scene?.cameras?.main
    const displayList = (this.scene?.children?.list ?? []).map((object, index) => ({
      index,
      name: object.name || null,
      type: object.type || object.constructor?.name || null,
    }))
    return {
      camera: camera ? {
        scrollX: Number(camera.scrollX),
        scrollY: Number(camera.scrollY),
        zoom: Number(camera.zoom),
        width: Number(camera.width),
        height: Number(camera.height),
      } : null,
      displayList,
      layerOrder: displayList
        .filter(object => this.layerNames.includes(object.name))
        .map(object => object.name),
      layerChildren: this.layerNames.map(name => {
        const layer = this.scene?.children?.list?.find(object => object.name === name)
        return {
          name,
          children: (layer?.list ?? []).map(object => object.name || object.type || object.constructor?.name || null),
        }
      }),
      cat: {
        pose: this.cat.poseName,
        facing: this.cat.facing,
        container: renderStateOf(this.cat),
        sprite: renderStateOf(this.cat.pixelSprite),
      },
      room: renderStateOf(this.backdrop),
      toy: renderStateOf(this.toy),
      toyFloorCover: renderStateOf(this.toyFloorCover),
      caughtToy: renderStateOf(this.caughtToy),
      bedForeground: renderStateOf(this.bedForeground),
    }
  }

  update(snapshot) {
    this.snapshot = snapshot
    // First contact presents the approved room and cat colors without a
    // time-of-day wash. The real-life clock takes over after naming.
    const phase = this.firstMeeting ? 'day' : snapshot?.time?.phase ?? 'day'
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
    this.catContactShadow.setPosition(this.cat.x, this.cat.y + 10)
    this.syncCaughtToy()
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
    this.toyFloorCover?.setVisible(carryingToy)
    this.caughtToy?.setVisible(carryingToy)
    if (carryingToy) this.syncCaughtToy()
    this.toy?.setVisible(!carryingToy)
    if (this.toy?.input) this.toy.input.enabled = !carryingToy && !this.firstMeeting
    return this
  }

  getInteractiveObjects() {
    return [this.window, this.bed, this.bowl, this.toy, this.cat]
  }

  syncCaughtToy() {
    if (!this.caughtToy || !this.cat) return this
    const sourceAnchor = DIRECT_CAT_PROP_ANCHORS[this.cat.poseName]?.caughtToy
      ?? DIRECT_CAT_PROP_ANCHORS.crouch.caughtToy
    const offsetX = this.cat.facing === 'right' ? -sourceAnchor.x : sourceAnchor.x
    this.caughtToy.setPosition(this.cat.x + offsetX, this.cat.y + sourceAnchor.y)
    return this
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
        toyFloorCover: Boolean(this.toyFloorCover.visible),
        caughtToy: Boolean(this.caughtToy.visible),
      },
      art: {
        roomTexture: this.backdrop.texture?.key ?? null,
        roomFrame: this.backdrop.frame?.name ?? null,
        roomDisplay: {
          width: Number(this.backdrop.displayWidth),
          height: Number(this.backdrop.displayHeight),
        },
        catTexture: this.cat.pixelSprite?.texture?.key ?? null,
        catFrame: this.cat.pixelSprite?.frame?.name ?? null,
        catPose: this.cat.getMotionState().pose,
        bedForeground: this.bedForeground?.texture?.key ?? null,
      },
      behavior: this.behavior.getState(),
      motionTrace: this.motionTrace.map(entry => ({ ...entry })),
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && window[QA_BRIDGE_KEY] === this.qaBridge) {
      delete window[QA_BRIDGE_KEY]
    }
    this.qaBridge = null
    this.setToyCaught(false)
    this.behavior?.destroy()
    this.ambientMotion?.destroy()
    this.motionTrace = []
    this.snapshot = null
  }
}

export default RoomWorld
