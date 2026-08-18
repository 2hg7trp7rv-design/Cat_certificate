import {
  DEFAULT_ROUTINE,
  STORAGE_KEY,
  advanceVirtualTime,
  beginLife,
  parseState,
  resetVirtualTime,
  serializeState,
  setForcedHunger,
  setForcedSleep,
} from '../state.js'
import BehaviorSystem from '../game/systems/BehaviorSystem.js'
import GrowthSystem from '../game/systems/GrowthSystem.js'
import HabitSystem from '../game/systems/HabitSystem.js'
import NeedSystem from '../game/systems/NeedSystem.js'
import OfflineSimulation from '../game/systems/OfflineSimulation.js'
import RelationshipSystem from '../game/systems/RelationshipSystem.js'
import TimeSystem from '../game/systems/TimeSystem.js'

const clone = value => structuredClone(value)

export class GameStateStore {
  constructor({ storage = globalThis.localStorage, now = () => Date.now(), qaScene = null } = {}) {
    this.storage = storage
    this.now = now
    this.qaScene = qaScene
    this.ephemeral = Boolean(qaScene)
    this.listeners = new Set()
    this.saveHealthy = true
    this.time = new TimeSystem()
    this.needs = new NeedSystem()
    this.relationship = new RelationshipSystem()
    this.growth = new GrowthSystem()
    this.habits = new HabitSystem()
    this.behavior = new BehaviorSystem()
    this.offline = new OfflineSimulation()
    this.state = this.load()

    if (qaScene === 'first-meeting') {
      const actualNow = this.now()
      const qaNoon = new Date(actualNow)
      qaNoon.setHours(12, 0, 0, 0)
      const freshQaState = parseState(null, qaNoon.getTime())
      this.state = {
        ...freshQaState,
        debug: {
          ...freshQaState.debug,
          timeOffsetMs: qaNoon.getTime() - actualNow,
        },
      }
    }
    if (qaScene === 'room') {
      const actualNow = this.now()
      const qaNoon = new Date(actualNow)
      qaNoon.setHours(12, 0, 0, 0)
      const freshQaState = parseState(null, qaNoon.getTime())
      const living = beginLife(freshQaState, { petName: 'こむぎ', routine: DEFAULT_ROUTINE }, qaNoon.getTime())
      this.state = {
        ...living,
        debug: {
          ...living.debug,
          timeOffsetMs: qaNoon.getTime() - actualNow,
        },
      }
    }
  }

  load() {
    try {
      return parseState(this.storage?.getItem(STORAGE_KEY), this.now())
    } catch {
      this.saveHealthy = false
      return parseState(null, this.now())
    }
  }

  persist() {
    if (this.ephemeral) return
    try {
      this.storage?.setItem(STORAGE_KEY, serializeState(this.state))
      this.saveHealthy = true
    } catch {
      this.saveHealthy = false
    }
  }

  commit(next, { persist = true } = {}) {
    this.state = next
    if (persist) this.persist()
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
    return snapshot
  }

  subscribe(listener, { immediate = false } = {}) {
    this.listeners.add(listener)
    if (immediate) listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  getState() {
    return this.state
  }

  snapshot() {
    const state = clone(this.state)
    const actualNow = this.now()
    return {
      state,
      time: this.time.snapshot(state, actualNow),
      needs: this.needs.snapshot(state, actualNow),
      growth: this.growth.stage(state, actualNow),
      behavior: this.behavior.choose(state, actualNow),
      saveHealthy: this.saveHealthy,
      ephemeral: this.ephemeral,
    }
  }

  refresh() {
    return this.commit(this.offline.resume(this.state, this.now()))
  }

  begin(petName, routine = DEFAULT_ROUTINE) {
    const actualNow = this.now()
    const lifecycleNow = this.ephemeral ? this.time.now(this.state, actualNow) : actualNow
    return this.commit(beginLife(this.state, { petName, routine }, lifecycleNow))
  }

  pet(zone, pace = 'slow') {
    return this.commit(this.relationship.pet(this.state, zone, pace, this.now()))
  }

  feed(food) {
    return this.commit(this.relationship.feed(this.state, food, this.now()))
  }

  play() {
    return this.commit(this.relationship.play(this.state, this.now()))
  }

  updateRoutine(routine) {
    return this.commit(this.habits.update(this.state, routine))
  }

  advance(ms) {
    return this.commit(this.needs.advance(advanceVirtualTime(this.state, Number(ms)), this.now()))
  }

  toggleHunger() {
    return this.commit(setForcedHunger(this.state, !this.state.debug?.forceHungry))
  }

  toggleSleep() {
    return this.commit(setForcedSleep(this.state, !this.state.debug?.forceSleep))
  }

  useActualTime() {
    return this.commit(resetVirtualTime(this.state))
  }

  markSeen() {
    return this.commit(this.offline.markSeen(this.state, this.now()))
  }

  reset() {
    try {
      if (!this.ephemeral) this.storage?.removeItem(STORAGE_KEY)
      this.saveHealthy = true
    } catch {
      this.saveHealthy = false
    }
    return this.commit(parseState(null, this.now()), { persist: false })
  }
}

export default GameStateStore
