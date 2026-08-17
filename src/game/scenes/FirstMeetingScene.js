import Phaser from '../phaser.js'
import PettingInput from '../input/PettingInput.js'
import RoomWorld from '../world/RoomWorld.js'

export class FirstMeetingScene extends Phaser.Scene {
  constructor() {
    super('FirstMeetingScene')
    this.completed = false
  }

  create() {
    const ui = this.registry.get('ui')
    const store = this.registry.get('store')
    this.completed = false
    this.world = new RoomWorld(this, { firstMeeting: true })
    this.world.update(store.snapshot())
    this.petting = new PettingInput(this.world.cat, {
      onComplete: result => {
        if (this.completed) return
        if (result.pace !== 'slow') {
          this.world.cat.acknowledgePetting(false)
          return
        }
        this.completed = true
        this.world.cat.acknowledgePetting(true)
        ui.showNamePanel()
      },
    })
    ui.showFirstMeeting()
    window.__TAIL_ROOM_QA__.scene = 'FirstMeetingScene'
    window.__TAIL_ROOM_QA__.layers = [...this.world.layerNames]
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.petting?.destroy())
  }
}

export default FirstMeetingScene
