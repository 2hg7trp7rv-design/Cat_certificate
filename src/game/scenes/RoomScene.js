import Phaser from '../phaser.js'
import { configureWorldCamera } from '../world/WorldCamera.js'
import PettingInput from '../input/PettingInput.js'
import RoomWorld from '../world/RoomWorld.js'

const petMessage = (name, { zone, pace }) => {
  if (pace === 'fast') return `${name}が指の速さを確かめるように顔を上げました。`
  if (zone === 'head') return `${name}が目を細めました。`
  if (zone === 'tail') return `${name}がしっぽを少し引き寄せました。`
  return `${name}がそのまま近くにいます。`
}

const unavailablePlayMessage = (name, reason) => {
  if (reason === 'sleep-time') return `${name}は寝床でぐっすり眠っています。`
  if (reason === 'meal-overdue' || reason === 'low-fullness') return `${name}は先にごはんを待っているようです。`
  if (reason === 'low-energy') return `${name}は少し休みたいようです。`
  return `${name}は今の過ごし方を続けたいようです。`
}

export class RoomScene extends Phaser.Scene {
  constructor() {
    super('RoomScene')
  }

  create() {
    configureWorldCamera(this)
    this.store = this.registry.get('store')
    this.ui = this.registry.get('ui')
    this.world = new RoomWorld(this, {
      onFood: () => this.ui.openFood(),
      onBed: () => this.ui.toast(this.store.snapshot().time.sleeping ? `${this.store.getState().petName}は眠そうです。` : '寝床を整えました。'),
      onToy: () => {
        const request = this.world.requestPlay()
        if (!request.accepted) {
          this.ui.toast(unavailablePlayMessage(this.store.getState().petName, request.reason))
          return
        }
        this.ui.toast(`${this.store.getState().petName}がおもちゃへ駆け寄りました。`)
      },
      onPlayComplete: () => this.store.play(),
      onWindow: () => this.ui.toast(`${this.store.getState().petName}と窓の外を眺めました。`),
    })
    this.petting = new PettingInput(this.world.cat, {
      onComplete: result => {
        const sleeping = this.store.snapshot().time.sleeping
        const welcome = !sleeping && result.zone !== 'tail' && result.pace !== 'fast'
        this.store.pet(result.zone, result.pace)
        this.world.reactToPetting(welcome)
        this.ui.toast(petMessage(this.store.getState().petName, result))
      },
    })
    this.unsubscribe = this.store.subscribe(snapshot => this.world.update(snapshot), { immediate: true })
    this.ui.showRoom()
    this.store.refresh()
    window.__TAIL_ROOM_QA__.scene = 'RoomScene'
    window.__TAIL_ROOM_QA__.layers = [...this.world.layerNames]
    window.__TAIL_ROOM_QA__.room = this.world.getQaSnapshot()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.petting?.destroy()
      this.unsubscribe?.()
      this.world?.destroy()
    })
  }

  update(time) {
    this.world?.step(time)
    if (window.__TAIL_ROOM_QA__) window.__TAIL_ROOM_QA__.room = this.world?.getQaSnapshot()
  }
}

export default RoomScene
