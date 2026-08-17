import Phaser from '../phaser.js'
import PettingInput from '../input/PettingInput.js'
import RoomWorld from '../world/RoomWorld.js'

const petMessage = (name, { zone, pace }) => {
  if (pace === 'fast') return `${name}が指の速さを確かめるように顔を上げました。`
  if (zone === 'head') return `${name}が目を細めました。`
  if (zone === 'tail') return `${name}がしっぽを少し引き寄せました。`
  return `${name}がそのまま近くにいます。`
}

export class RoomScene extends Phaser.Scene {
  constructor() {
    super('RoomScene')
  }

  create() {
    this.store = this.registry.get('store')
    this.ui = this.registry.get('ui')
    this.world = new RoomWorld(this, {
      onFood: () => this.ui.openFood(),
      onBed: () => this.ui.toast(this.store.snapshot().time.sleeping ? `${this.store.getState().petName}は眠そうです。` : '寝床を整えました。'),
      onToy: () => {
        this.store.play()
        this.ui.toast(`${this.store.getState().petName}がおもちゃへ前足を伸ばしました。`)
      },
      onWindow: () => this.ui.toast(`${this.store.getState().petName}と窓の外を眺めました。`),
    })
    this.petting = new PettingInput(this.world.cat, {
      onComplete: result => {
        const welcome = result.zone !== 'tail' && result.pace !== 'fast'
        this.store.pet(result.zone, result.pace)
        this.world.cat.acknowledgePetting(welcome)
        this.ui.toast(petMessage(this.store.getState().petName, result))
      },
    })
    this.unsubscribe = this.store.subscribe(snapshot => this.world.update(snapshot), { immediate: true })
    this.ui.showRoom()
    this.store.refresh()
    window.__TAIL_ROOM_QA__.scene = 'RoomScene'
    window.__TAIL_ROOM_QA__.layers = [...this.world.layerNames]

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.petting?.destroy()
      this.unsubscribe?.()
    })
  }
}

export default RoomScene
