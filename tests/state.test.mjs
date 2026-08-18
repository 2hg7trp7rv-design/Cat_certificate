import assert from 'node:assert/strict'
import test from 'node:test'
import BehaviorSystem from '../src/game/systems/BehaviorSystem.js'
import GrowthSystem from '../src/game/systems/GrowthSystem.js'
import HabitSystem from '../src/game/systems/HabitSystem.js'
import MemorySystem from '../src/game/systems/MemorySystem.js'
import NeedSystem from '../src/game/systems/NeedSystem.js'
import OfflineSimulation from '../src/game/systems/OfflineSimulation.js'
import RelationshipSystem from '../src/game/systems/RelationshipSystem.js'
import TimeSystem from '../src/game/systems/TimeSystem.js'
import GameStateStore from '../src/state/GameStateStore.js'
import {
  APP_VERSION,
  DAY,
  HOUR,
  STORAGE_KEY,
  addMemory,
  advanceVirtualTime,
  applyElapsedTime,
  beginLife,
  createInitialState,
  feedPet,
  getDaysTogether,
  getGrowthStage,
  getMealStatus,
  getVirtualNow,
  isSleepTime,
  parseState,
  recordPetting,
  resetVirtualTime,
  serializeState,
} from '../src/state.js'

const at = (year, month, day, hour, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0).getTime()

test('v6 initial state', () => {
  const state = createInitialState(1)
  assert.equal(APP_VERSION, 6)
  assert.equal(STORAGE_KEY, 'tail-room-state-v6')
  assert.equal(state.version, 6)
  assert.equal(state.kind, 'cat')
})

test('begin life', () => {
  const now = at(2026, 8, 15, 10)
  const state = beginLife(
    createInitialState(now),
    {
      petName: 'モカ',
      routine: { breakfast: '08:00', dinner: '20:00', wake: '07:30', bedtime: '00:15' },
    },
    now,
  )
  assert.equal(state.onboarded, true)
  assert.equal(state.petName, 'モカ')
  assert.equal(state.routine.bedtime, '00:15')
  assert.equal(state.memories.length, 1)
})

test('sleep crosses midnight', () => {
  const routine = { wake: '07:00', bedtime: '23:30', breakfast: '07:30', dinner: '19:00' }
  assert.equal(isSleepTime(routine, at(2026, 8, 15, 23, 45)), true)
  assert.equal(isSleepTime(routine, at(2026, 8, 16, 6, 50)), true)
  assert.equal(isSleepTime(routine, at(2026, 8, 16, 12)), false)
})

test('meal overdue', () => {
  const now = at(2026, 8, 15, 8, 5)
  const state = {
    ...createInitialState(now),
    onboarded: true,
    routine: { wake: '07:00', breakfast: '07:30', dinner: '19:00', bedtime: '23:30' },
    lastFedAt: at(2026, 8, 14, 19),
  }
  const meal = getMealStatus(state, now)
  assert.equal(meal.overdue, true)
  assert.equal(meal.dueMeal.label, '朝ごはん')
})

test('feeding', () => {
  const now = at(2026, 8, 15, 8, 30)
  const state = {
    ...createInitialState(now),
    onboarded: true,
    petName: 'モカ',
    fullness: 30,
    debug: { timeOffsetMs: 0, forceHungry: true, forceSleep: false },
  }
  const next = feedPet(state, 'daily', now)
  assert.equal(next.debug.forceHungry, false)
  assert.ok(next.fullness > state.fullness)
  assert.equal(next.preferences.foodCounts.daily, 1)
})

test('elapsed time', () => {
  const start = at(2026, 8, 15, 8)
  const state = {
    ...beginLife(createInitialState(start), { petName: 'モカ' }, start),
    lastSeenAt: start,
    fullness: 90,
  }
  const next = applyElapsedTime(state, start + 7 * HOUR)
  assert.ok(next.fullness < 90)
  assert.ok(next.memories.some(memory => memory.type === 'return'))
})

test('sub-threshold updates accumulate instead of starving elapsed time', () => {
  const start = at(2026, 8, 15, 10)
  let state = {
    ...beginLife(createInitialState(start), { petName: 'モカ' }, start),
    lastSeenAt: start,
    fullness: 90,
  }

  state = applyElapsedTime(state, start + 30_000)
  state = applyElapsedTime(state, start + 60_000)

  assert.ok(state.fullness < 90)
  assert.equal(state.lastSeenAt, start + 60_000)
})

test('growth stages', () => {
  const start = at(2026, 1, 1, 0)
  const state = { ...createInitialState(start), createdAt: start }
  assert.equal(getGrowthStage(state, start).id, 'baby')
  assert.equal(getGrowthStage(state, start + 30 * DAY).id, 'growing')
  assert.equal(getGrowthStage(state, start + 75 * DAY).id, 'young')
  assert.equal(getGrowthStage(state, start + 120 * DAY).id, 'adult')
})

test('touch preference', () => {
  let state = { ...createInitialState(), onboarded: true }
  state = recordPetting(state, 'head', 'slow')
  state = recordPetting(state, 'head', 'slow')
  state = recordPetting(state, 'back', 'slow')
  assert.equal(state.preferences.favoriteTouch, 'head')
  assert.equal(state.preferences.touchCounts.head, 2)
})

test('fast tail contact', () => {
  const state = { ...createInitialState(), onboarded: true, comfort: 70, bond: 10 }
  const next = recordPetting(state, 'tail', 'fast')
  assert.ok(next.comfort <= state.comfort)
  assert.ok(next.bond < state.bond + 1)
})

test('virtual time', () => {
  const actual = 1_000_000
  let state = createInitialState(actual)
  state = advanceVirtualTime(state, DAY)
  assert.equal(getVirtualNow(state, actual), actual + DAY)
  state = resetVirtualTime(state)
  assert.equal(getVirtualNow(state, actual), actual)
})

test('serialization', () => {
  const state = addMemory(createInitialState(), '記録', '本文')
  const parsed = parseState(serializeState(state))
  assert.equal(parsed.version, state.version)
  assert.equal(parsed.memories[0].title, '記録')
})

test('days one', () => {
  const start = at(2026, 8, 15, 10)
  const state = { ...createInitialState(start), createdAt: start }
  assert.equal(getDaysTogether(state, start), 1)
})

test('v0.7 system facades preserve v6 state semantics', () => {
  const actual = at(2026, 8, 15, 10)
  let state = beginLife(createInitialState(actual), { petName: 'モカ' }, actual)

  const time = new TimeSystem()
  const needs = new NeedSystem()
  const relationship = new RelationshipSystem()
  const growth = new GrowthSystem()
  const memories = new MemorySystem()
  const offline = new OfflineSimulation()
  const habits = new HabitSystem()
  const behaviors = new BehaviorSystem()

  assert.equal(time.snapshot(state, actual).now, actual)
  assert.equal(needs.snapshot(state, actual).fullness, 82)

  state = relationship.pet(state, 'head', 'slow', actual + HOUR)
  assert.equal(relationship.snapshot(state).favoriteTouch, 'head')

  state = memories.add(state, { id: 'facade-memory', title: '記録', body: '本文' }, actual)
  assert.equal(memories.has(state, 'facade-memory'), true)

  state = habits.update(state, { ...state.routine, bedtime: '22:45' })
  assert.equal(habits.routine(state).bedtime, '22:45')
  assert.equal(growth.stage(state, actual).id, 'baby')

  const resumed = offline.resume(state, actual + HOUR)
  assert.equal(resumed.version, 6)
  assert.ok(resumed.fullness < state.fullness)
  assert.equal(behaviors.choose(resumed, actual + HOUR).location, 'center')
})

test('room QA state is fresh and independent of saved preview data', () => {
  const now = at(2026, 8, 15, 10)
  const saved = {
    ...beginLife(createInitialState(now), { petName: '残留データ' }, now),
    debug: { timeOffsetMs: DAY, forceHungry: true, forceSleep: true },
  }
  let writes = 0
  const storage = {
    getItem: () => serializeState(saved),
    setItem: () => { writes += 1 },
  }
  const store = new GameStateStore({ storage, now: () => now, qaScene: 'room' })

  assert.equal(store.getState().petName, 'こむぎ')
  assert.equal(store.getState().debug.forceHungry, false)
  assert.equal(store.getState().debug.forceSleep, false)
  assert.equal(store.snapshot().time.phase, 'day')
  assert.equal(store.snapshot().time.sleeping, false)
  assert.equal(store.snapshot().behavior.id, 'idle')
  assert.equal(store.ephemeral, true)
  store.play()
  assert.equal(writes, 0)
})

test('first-meeting QA carries deterministic daytime into the named room', () => {
  const now = at(2026, 8, 15, 2)
  const store = new GameStateStore({ storage: null, now: () => now, qaScene: 'first-meeting' })

  assert.equal(store.snapshot().time.phase, 'day')
  assert.equal(store.snapshot().time.sleeping, false)
  store.begin('こむぎ')
  assert.equal(store.snapshot().time.phase, 'day')
  assert.equal(store.snapshot().time.sleeping, false)
  assert.equal(store.snapshot().behavior.id, 'idle')
})
