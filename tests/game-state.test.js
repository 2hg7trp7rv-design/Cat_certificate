import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DAY,
  HOUR,
  advanceVirtualTime,
  applyElapsedTime,
  beginGame,
  createInitialState,
  feedCompanion,
  getDaysTogether,
  getGrowthStage,
  getMealStatus,
  getPetMood,
  getTimePhase,
  getVirtualNow,
  isSleepTime,
  parseState,
  petCompanion,
  playWithCompanion,
  resetVirtualTime,
  restCompanion,
  serializeState,
} from '../src/game-state.js'

function localTimestamp(year, monthIndex, day, hour, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime()
}

function startedState(now = localTimestamp(2026, 7, 13, 7, 0)) {
  return beginGame(
    createInitialState(),
    { kind: 'cat', name: 'こむぎ', coat: 'cream', personality: 'gentle' },
    'しんや',
    { wakeTime: '06:30', breakfastTime: '07:30', dinnerTime: '19:00', bedtime: '23:30' },
    now,
  )
}

test('onboarding creates a companion, routine, and first memory', () => {
  const now = localTimestamp(2026, 7, 13, 7)
  const state = startedState(now)
  assert.equal(state.onboarded, true)
  assert.equal(state.pet.name, 'こむぎ')
  assert.equal(state.routine.breakfastTime, '07:30')
  assert.equal(state.pet.lastFedAt, now)
  assert.equal(state.memories.length, 1)
})

test('real elapsed time changes needs without death or disappearance', () => {
  const start = localTimestamp(2026, 7, 13, 7)
  const state = startedState(start)
  const returned = applyElapsedTime(state, start + 72 * HOUR)
  assert.ok(returned.pet)
  assert.equal(returned.pet.name, 'こむぎ')
  assert.ok(returned.pet.fullness >= 14)
  assert.ok(returned.pet.energy >= 28)
  assert.ok(returned.pet.comfort >= 38)
})

test('meal becomes overdue 30 minutes after the scheduled time when not fed', () => {
  const start = localTimestamp(2026, 7, 13, 6)
  const state = startedState(start)
  state.pet.lastFedAt = localTimestamp(2026, 7, 12, 19)
  const statusBefore = getMealStatus(state, localTimestamp(2026, 7, 13, 7, 59))
  const statusAfter = getMealStatus(state, localTimestamp(2026, 7, 13, 8, 1))
  assert.equal(statusBefore.overdue, false)
  assert.equal(statusAfter.overdue, true)
  assert.equal(statusAfter.dueMeal.label, '朝ごはん')
})

test('feeding clears the currently overdue meal and records a memory', () => {
  const state = startedState(localTimestamp(2026, 7, 13, 6))
  state.pet.lastFedAt = localTimestamp(2026, 7, 12, 19)
  const now = localTimestamp(2026, 7, 13, 8, 30)
  assert.equal(getMealStatus(state, now).overdue, true)
  const result = feedCompanion(state, 'daily', now)
  assert.equal(getMealStatus(result.state, now).overdue, false)
  assert.equal(result.state.memories[0].icon, 'food')
})

test('sleep window works across midnight', () => {
  const routine = { wakeTime: '06:30', breakfastTime: '07:30', dinnerTime: '19:00', bedtime: '23:30' }
  assert.equal(isSleepTime(routine, new Date(2026, 7, 13, 23, 45)), true)
  assert.equal(isSleepTime(routine, new Date(2026, 7, 14, 5, 45)), true)
  assert.equal(isSleepTime(routine, new Date(2026, 7, 14, 7, 0)), false)
})

test('growth changes through four stages and reaches adult around 120 days', () => {
  const start = localTimestamp(2026, 7, 13, 7)
  const state = startedState(start)
  assert.equal(getGrowthStage(state.pet, start).id, 'baby')
  assert.equal(getGrowthStage(state.pet, start + 45 * DAY).id, 'growing')
  assert.equal(getGrowthStage(state.pet, start + 90 * DAY).id, 'young')
  assert.equal(getGrowthStage(state.pet, start + 120 * DAY).id, 'adult')
})

test('creator time controls advance and reset the virtual clock', () => {
  const actual = localTimestamp(2026, 7, 13, 10)
  const state = startedState(actual)
  const advanced = advanceVirtualTime(state, 30 * DAY)
  assert.equal(getVirtualNow(advanced, actual), actual + 30 * DAY)
  assert.equal(getVirtualNow(resetVirtualTime(advanced), actual), actual)
})

test('petting has a bond cooldown but continues to improve comfort', () => {
  const state = startedState()
  const first = petCompanion(state, state.lastSeenAt + 60_000)
  const second = petCompanion(first.state, state.lastSeenAt + 61_000)
  assert.equal(first.bondDelta, 2)
  assert.equal(second.bondDelta, 0)
  assert.ok(second.state.pet.comfort >= first.state.pet.comfort)
})

test('play consumes energy and rest restores it', () => {
  const state = startedState()
  const played = playWithCompanion(state, state.lastSeenAt + 10_000)
  assert.ok(played.state.pet.energy < state.pet.energy)
  const rested = restCompanion(played.state, state.lastSeenAt + 20_000)
  assert.ok(rested.state.pet.energy > played.state.pet.energy)
})

test('state serialization round-trips and invalid JSON resets safely', () => {
  const state = startedState()
  assert.deepEqual(parseState(serializeState(state)), state)
  assert.deepEqual(parseState('{broken'), createInitialState())
})

test('mood, phase, and days together remain deterministic', () => {
  const state = startedState()
  state.pet.fullness = 40
  assert.equal(getPetMood(state.pet), 'hungry')
  assert.equal(getTimePhase(new Date(2026, 7, 13, 6)), 'morning')
  assert.equal(getTimePhase(new Date(2026, 7, 13, 13)), 'day')
  assert.equal(getTimePhase(new Date(2026, 7, 13, 19)), 'evening')
  assert.equal(getTimePhase(new Date(2026, 7, 13, 23)), 'night')
  assert.equal(getDaysTogether(state.pet, state.pet.createdAt + 3 * DAY), 4)
})
