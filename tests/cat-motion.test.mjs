import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CatBehaviorController,
  DEFAULT_CAT_ANCHORS,
  chooseSleepPose,
  createAmbientPlan,
  deterministicUnit,
  selectAutonomousActivity,
  selectAutonomousIntervalMs,
} from '../src/game/behavior/CatBehaviorController.js'
import {
  BEHAVIOR_PRIORITY,
  chooseBehavior,
} from '../src/game/systems/BehaviorSystem.js'
import { beginLife, createInitialState } from '../src/state.js'

const at = (year, month, day, hour, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0).getTime()

const livingState = (now = at(2026, 8, 18, 12)) =>
  beginLife(createInitialState(now), { petName: 'こむぎ' }, now)

const snapshot = (behavior, state = livingState()) => ({
  state,
  time: { now: at(2026, 8, 18, 12), sleeping: behavior.id === 'sleep' },
  needs: { energy: state.energy, fullness: state.fullness, hungry: behavior.id === 'wait-for-meal' },
  behavior,
})

class StubCat {
  constructor(x = DEFAULT_CAT_ANCHORS['center-idle'].x, y = DEFAULT_CAT_ANCHORS['center-idle'].y) {
    this.x = x
    this.y = y
    this.states = []
    this.positions = []
    this.facing = 'right'
  }

  setMotionState(state, options) {
    this.states.push({ state, ...options })
    return this
  }

  setFacing(facing) {
    this.facing = facing
    return this
  }

  setWorldPosition(x, y) {
    this.x = x
    this.y = y
    this.positions.push({ x, y })
    return this
  }
}

test('default anchors match the approved 852x1846 room composition', () => {
  assert.deepEqual(DEFAULT_CAT_ANCHORS, {
    'center-idle': { x: 370, y: 1320 },
    'rug-play': { x: 551, y: 1510 },
    'bed-sleep': { x: 744, y: 1170 },
    'bowl-wait': { x: 280, y: 1450 },
    'window-watch': { x: 430, y: 1000 },
    carrier: { x: 370, y: 1320 },
  })
})

test('life behavior exposes v0.8 anchors while preserving semantic locations', () => {
  const now = at(2026, 8, 18, 12)
  const hungry = {
    ...livingState(now),
    fullness: 20,
    energy: 10,
  }
  const chosen = chooseBehavior(hungry, now)

  assert.equal(chosen.id, 'wait-for-meal')
  assert.equal(chosen.location, 'bowl')
  assert.equal(chosen.anchor, 'bowl-wait')
  assert.equal(chosen.priority, BEHAVIOR_PRIORITY.hunger)
  assert.equal(chosen.interruptible, false)
})

test('sleep outranks simultaneous hunger and low energy', () => {
  const now = at(2026, 8, 18, 12)
  const state = {
    ...livingState(now),
    fullness: 20,
    energy: 10,
    debug: { timeOffsetMs: 0, forceHungry: true, forceSleep: true },
  }
  const chosen = chooseBehavior(state, now)

  assert.equal(chosen.id, 'sleep')
  assert.equal(chosen.anchor, 'bed-sleep')
  assert.equal(chosen.priority, BEHAVIOR_PRIORITY.sleep)
})

test('autonomous choices and intervals are deterministic and bounded', () => {
  const state = { ...livingState(), energy: 76 }
  const idle = snapshot({ id: 'idle', priority: BEHAVIOR_PRIORITY.ambient }, state)

  assert.equal(deterministicUnit('seed', 2), deterministicUnit('seed', 2))
  assert.equal(
    selectAutonomousActivity(idle, 4, 'fixed-seed'),
    selectAutonomousActivity(idle, 4, 'fixed-seed'),
  )

  const interval = selectAutonomousIntervalMs(4, 'fixed-seed')
  assert.ok(interval >= 20_000)
  assert.ok(interval <= 65_000)

  const first = createAmbientPlan(3, 'fixed-seed')
  const second = createAmbientPlan(3, 'fixed-seed')
  assert.deepEqual(first.steps, second.steps)
  assert.ok(first.steps.some(step => step.state === 'blink'))
  assert.ok(first.steps.some(step => step.state === 'ear'))
})

test('side sleep is reserved for a securely bonded cat', () => {
  assert.equal(chooseSleepPose({ state: { bond: 54 } }), 'curl')
  assert.equal(chooseSleepPose({ state: { bond: 55 } }), 'side')
})

test('player play runs as one ordered action instead of overlapping ambient motion', () => {
  const cat = new StubCat()
  const completed = []
  const controller = new CatBehaviorController(cat, {
    seed: 'play-test',
    onActionComplete: event => completed.push(event),
  })
  const idle = snapshot({
    id: 'idle',
    anchor: 'center-idle',
    reason: 'settled',
    priority: BEHAVIOR_PRIORITY.ambient,
  })

  assert.equal(controller.requestPlay(), true)
  controller.update(idle, 0)
  assert.equal(controller.getState().action, 'player-play')
  assert.equal(controller.getState().moving, true)
  assert.equal(controller.requestPlay(), false)

  for (let time = 100; time <= 7_000; time += 100) controller.update(idle, time)

  const rendered = new Set(cat.states.map(entry => entry.state))
  assert.ok(rendered.has('walk'))
  assert.ok(rendered.has('play-notice'))
  assert.ok(rendered.has('play-crouch'))
  assert.ok(rendered.has('play-pounce'))
  assert.ok(rendered.has('play-catch'))
  assert.ok(rendered.has('play-recover'))
  assert.equal(cat.x, DEFAULT_CAT_ANCHORS['rug-play'].x)
  assert.equal(cat.y, DEFAULT_CAT_ANCHORS['rug-play'].y)
  assert.ok(completed.some(event => event.id === 'player-play' && event.reason === 'completed'))
})

test('sleep interrupts play but moves toward bed without teleporting', () => {
  const cat = new StubCat()
  const controller = new CatBehaviorController(cat, { seed: 'sleep-test', maxTickMs: 100 })
  const idle = snapshot({ id: 'idle', priority: BEHAVIOR_PRIORITY.ambient })
  const sleeping = snapshot({
    id: 'sleep',
    anchor: 'bed-sleep',
    reason: 'sleep-time',
    priority: BEHAVIOR_PRIORITY.sleep,
    interruptible: false,
  }, { ...livingState(), bond: 20 })

  controller.requestPlay()
  controller.update(idle, 0)
  controller.update(idle, 100)
  const beforeSleep = { x: cat.x, y: cat.y }
  controller.update(sleeping, 200)

  assert.equal(controller.getState().action, 'sleep')
  assert.equal(controller.getState().anchor, 'bed-sleep')
  assert.deepEqual({ x: cat.x, y: cat.y }, beforeSleep)

  controller.update(sleeping, 3_600_200)
  assert.notEqual(cat.x, DEFAULT_CAT_ANCHORS['bed-sleep'].x)
  assert.notEqual(cat.y, DEFAULT_CAT_ANCHORS['bed-sleep'].y)
  assert.equal(controller.getState().action, 'sleep')
})

test('play requests are rejected while a non-interruptible life need is active', () => {
  const rejected = []
  const cat = new StubCat()
  const controller = new CatBehaviorController(cat, {
    onRequestRejected: event => rejected.push(event),
  })
  const sleeping = snapshot({
    id: 'sleep',
    reason: 'sleep-time',
    priority: BEHAVIOR_PRIORITY.sleep,
    interruptible: false,
  })

  controller.requestPlay()
  controller.update(sleeping, 0)

  assert.equal(rejected.length, 1)
  assert.equal(rejected[0].request, 'play')
  assert.equal(rejected[0].behavior, 'sleep')
  assert.equal(controller.getState().queuedRequest, null)

  assert.equal(controller.requestPlay(), false)
  assert.equal(rejected.length, 2)
})
