import {
  BEHAVIOR_PRIORITY,
  chooseSnapshotBehavior,
} from '../systems/BehaviorSystem.js'

export const DEFAULT_CAT_ANCHORS = Object.freeze({
  'center-idle': Object.freeze({ x: 108, y: 382 }),
  'rug-play': Object.freeze({ x: 108, y: 370 }),
  'bed-sleep': Object.freeze({ x: 68, y: 378 }),
  'bowl-wait': Object.freeze({ x: 132, y: 382 }),
  'window-watch': Object.freeze({ x: 84, y: 350 }),
  carrier: Object.freeze({ x: 108, y: 382 }),
})

export const MOTION_DURATION_MS = Object.freeze({
  idle: 1_600,
  blink: 325,
  ear: 400,
  look: 670,
  tail: 800,
  stand: 640,
  sit: 650,
  loaf: 2_240,
  lie: 920,
  walk: 660,
  turn: 510,
  'sleep-curl-transition': 1_050,
  'sleep-curl': 3_020,
  'sleep-side-transition': 935,
  'sleep-side': 2_960,
  'play-notice': 500,
  'play-crouch': 680,
  'play-pounce': 540,
  'play-catch': 665,
  'play-recover': 710,
  welcome: 590,
})

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

const animationStep = (state, {
  duration = MOTION_DURATION_MS[state] ?? 600,
  loop = false,
} = {}) => ({ type: 'animation', state, duration, loop })

const moveStep = anchor => ({ type: 'move', anchor, state: 'walk' })

const plan = (id, priority, steps, extra = {}) => ({
  id,
  priority,
  interruptible: priority < BEHAVIOR_PRIORITY.lowEnergy,
  steps,
  ...extra,
})

/** Stable FNV-1a hash, avoiding Math.random and non-reproducible QA runs. */
export const deterministicUnit = (...parts) => {
  const input = parts.join('|')
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x1_0000_0000
}

export const getBehaviorSeed = snapshot => {
  const state = snapshot?.state ?? snapshot ?? {}
  return `${finiteNumber(state.createdAt)}:${state.petName ?? 'cat'}:${finiteNumber(state.sessionCount)}`
}

export const chooseSleepPose = snapshot => {
  const state = snapshot?.state ?? snapshot ?? {}
  // Side sleeping exposes the stomach and therefore acts as a later-bond pose.
  return finiteNumber(state.bond) >= 55 ? 'side' : 'curl'
}

export const createAmbientPlan = (cycle = 0, seed = 'cat') => {
  const variants = [
    ['blink', 'ear', 'look', 'tail'],
    ['ear', 'blink', 'tail', 'look'],
    ['look', 'blink', 'ear', 'tail'],
    ['tail', 'look', 'blink', 'ear'],
  ]
  const sequence = variants[Math.floor(deterministicUnit(seed, cycle, 'ambient') * variants.length)]
  const steps = []

  for (let index = 0; index < sequence.length; index += 1) {
    const hold = 900 + Math.floor(deterministicUnit(seed, cycle, index, 'hold') * 1_000)
    steps.push(animationStep('idle', { duration: hold, loop: true }))
    steps.push(animationStep(sequence[index]))
  }
  steps.push(animationStep('idle', { duration: 900, loop: true }))
  return plan('ambient', BEHAVIOR_PRIORITY.ambient, steps, { source: 'ambient' })
}

export const selectAutonomousIntervalMs = (cycle = 0, seed = 'cat') =>
  20_000 + Math.floor(deterministicUnit(seed, cycle, 'interval') * 45_001)

export const selectAutonomousActivity = (snapshot, cycle = 0, seed = getBehaviorSeed(snapshot)) => {
  const state = snapshot?.state ?? snapshot ?? {}
  const behaviorNow = snapshot?.time?.now ?? state.lastSeenAt ?? state.createdAt ?? 0
  const behavior = chooseSnapshotBehavior(snapshot, behaviorNow)
  const energy = finiteNumber(snapshot?.needs?.energy ?? state.energy, 70)

  if (energy < 52) return 'lie'
  if (behavior.id === 'watch-window' && deterministicUnit(seed, cycle, 'morning') < 0.68) {
    return 'window'
  }

  // Two quiet entries reserve 40% of autonomous choices for rest/observation.
  const choices = ['loaf', 'lie', 'window', 'play', 'loaf']
  return choices[Math.floor(deterministicUnit(seed, cycle, 'activity') * choices.length)]
}

export const createBehaviorPlan = (intent, {
  sleepPose = 'curl',
  source = 'state',
} = {}) => {
  const id = typeof intent === 'string' ? intent : intent?.id
  const inferredPriority = {
    'first-meeting': BEHAVIOR_PRIORITY.onboarding,
    sleep: BEHAVIOR_PRIORITY.sleep,
    'wait-for-meal': BEHAVIOR_PRIORITY.hunger,
    rest: BEHAVIOR_PRIORITY.lowEnergy,
    welcome: source === 'player' ? BEHAVIOR_PRIORITY.player : BEHAVIOR_PRIORITY.autonomous,
    play: source === 'player' ? BEHAVIOR_PRIORITY.player : BEHAVIOR_PRIORITY.autonomous,
  }[id] ?? BEHAVIOR_PRIORITY.autonomous
  const priority = finiteNumber(intent?.priority, inferredPriority)

  if (id === 'first-meeting') {
    return plan(id, priority, [
      animationStep('welcome'),
      animationStep('idle', { duration: Number.POSITIVE_INFINITY, loop: true }),
    ], { source, controlKey: id, anchor: 'carrier', sticky: true })
  }

  if (id === 'sleep') {
    const pose = sleepPose === 'side' ? 'side' : 'curl'
    return plan(id, priority, [
      moveStep('bed-sleep'),
      animationStep(`sleep-${pose}-transition`),
      animationStep(`sleep-${pose}`, { duration: Number.POSITIVE_INFINITY, loop: true }),
    ], { source, controlKey: id, anchor: 'bed-sleep', sticky: true, sleepPose: pose })
  }

  if (id === 'wait-for-meal') {
    return plan(id, priority, [
      moveStep('bowl-wait'),
      animationStep('sit'),
      animationStep('idle', { duration: Number.POSITIVE_INFINITY, loop: true }),
    ], { source, controlKey: id, anchor: 'bowl-wait', sticky: true })
  }

  if (id === 'rest') {
    return plan(id, priority, [
      moveStep('bed-sleep'),
      animationStep('lie'),
      animationStep('loaf', { duration: Number.POSITIVE_INFINITY, loop: true }),
    ], { source, controlKey: id, anchor: 'bed-sleep', sticky: true })
  }

  if (id === 'watch-window' || id === 'window') {
    return plan(id === 'window' ? 'autonomous-window' : id, priority, [
      moveStep('window-watch'),
      animationStep('look'),
      animationStep('loaf', { duration: 4_800, loop: true }),
      animationStep('turn'),
    ], { source, anchor: 'window-watch' })
  }

  if (id === 'play') {
    return plan(source === 'player' ? 'player-play' : 'autonomous-play', priority, [
      moveStep('rug-play'),
      animationStep('play-notice'),
      animationStep('play-crouch'),
      animationStep('play-pounce'),
      animationStep('play-catch'),
      animationStep('play-recover'),
      animationStep('sit'),
    ], { source, anchor: 'rug-play' })
  }

  if (id === 'lie') {
    return plan('autonomous-lie', priority, [
      moveStep('rug-play'),
      animationStep('lie'),
      animationStep('loaf', { duration: 5_200, loop: true }),
      animationStep('stand'),
    ], { source, anchor: 'rug-play' })
  }

  if (id === 'loaf') {
    return plan('autonomous-loaf', priority, [
      moveStep('center-idle'),
      animationStep('sit'),
      animationStep('loaf', { duration: 5_600, loop: true }),
      animationStep('stand'),
    ], { source, anchor: 'center-idle' })
  }

  if (id === 'welcome') {
    return plan('player-welcome', priority, [
      animationStep('welcome'),
      animationStep('look'),
      animationStep('idle', { duration: 1_200, loop: true }),
    ], { source })
  }

  return createAmbientPlan(0, 'fallback')
}

const criticalBehavior = snapshot => {
  const state = snapshot?.state ?? snapshot ?? {}
  const behaviorNow = snapshot?.time?.now ?? state.lastSeenAt ?? state.createdAt ?? 0
  const chosen = chooseSnapshotBehavior(snapshot, behaviorNow)
  return ['first-meeting', 'sleep', 'wait-for-meal', 'rest'].includes(chosen.id) ? chosen : null
}

const normalizeAnchor = value => {
  if (!value || typeof value !== 'object') return null
  const x = Number(value.x)
  const y = Number(value.y)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

/**
 * Drives one non-overlapping cat action at a time. It owns neither persistent
 * state nor Phaser tweens: world position is interpolated on render updates,
 * and Cat receives a manual pixel-frame clock.
 */
export class CatBehaviorController {
  constructor(cat, {
    anchors = {},
    walkSpeed = 74,
    maxTickMs = 100,
    seed = null,
    onActionStart,
    onActionComplete,
    onStateChange,
    onMoveStart,
    onMoveComplete,
    onPosition,
    onRequestRejected,
  } = {}) {
    if (!cat) throw new TypeError('CatBehaviorController requires a cat')
    this.cat = cat
    this.anchors = { ...DEFAULT_CAT_ANCHORS, ...anchors }
    this.walkSpeed = clamp(finiteNumber(walkSpeed, 74), 24, 240)
    this.maxTickMs = clamp(finiteNumber(maxTickMs, 100), 16, 250)
    this.seedOverride = seed
    this.callbacks = {
      onActionStart,
      onActionComplete,
      onStateChange,
      onMoveStart,
      onMoveComplete,
      onPosition,
      onRequestRejected,
    }
    this.clock = 0
    this.lastRawTime = null
    this.current = null
    this.pendingRequest = null
    this.lastSnapshot = null
    this.ambientCycle = 0
    this.autonomousCycle = 0
    this.lastAutonomousActivity = null
    this.autonomousRepeatCount = 0
    this.nextAutonomousAt = 20_000
    this.lastRenderedState = null
    this.stopped = false
    this.destroyed = false
  }

  setAnchors(anchors = {}) {
    this.anchors = { ...this.anchors, ...anchors }
    return this
  }

  requestPlay(options = {}) {
    return this.#queueRequest('play', options)
  }

  reactToVisit(options = {}) {
    return this.#queueRequest('welcome', options)
  }

  stop({ resetPose = true } = {}) {
    this.stopped = true
    this.pendingRequest = null
    this.#completeCurrent('stopped')
    if (resetPose) this.cat?.setMotionState?.('idle', { elapsedMs: 0, loop: true })
    return this
  }

  resume() {
    if (!this.destroyed) this.stopped = false
    return this
  }

  destroy() {
    if (this.destroyed) return
    this.stop({ resetPose: false })
    this.destroyed = true
    this.cat = null
    this.anchors = {}
    this.callbacks = {}
  }

  update(snapshot, rawTime = globalThis.performance?.now?.() ?? Date.now()) {
    if (this.destroyed) return this.getState()
    this.#advanceClock(rawTime)
    this.lastSnapshot = snapshot ?? this.lastSnapshot
    if (this.stopped || !this.lastSnapshot) return this.getState()

    const critical = criticalBehavior(this.lastSnapshot)
    if (critical) {
      if (this.pendingRequest) {
        this.callbacks.onRequestRejected?.({
          request: this.pendingRequest.type,
          reason: critical.reason ?? critical.id,
          behavior: critical.id,
        })
        this.pendingRequest = null
      }

      if (this.current?.controlKey !== critical.id) {
        const sleeping = critical.id === 'sleep'
        const criticalPlan = createBehaviorPlan(critical, {
          sleepPose: chooseSleepPose(this.lastSnapshot),
          source: 'state',
        })
        this.#startPlan(criticalPlan, sleeping ? 'sleep-started' : 'life-need')
      }
    } else {
      if (this.current?.controlKey) this.#completeCurrent('life-need-cleared')
      this.#startPendingRequestIfAllowed()
      if (!this.current) this.#startScheduledPlan()
    }

    this.#runCurrentStep()
    return this.getState()
  }

  getState() {
    const step = this.current?.steps?.[this.current.stepIndex]
    return {
      action: this.current?.id ?? null,
      state: step?.state ?? null,
      anchor: step?.anchor ?? this.current?.anchor ?? null,
      moving: step?.type === 'move',
      priority: this.current?.priority ?? 0,
      queuedRequest: this.pendingRequest?.type ?? null,
      clock: this.clock,
      stopped: this.stopped,
      destroyed: this.destroyed,
    }
  }

  #queueRequest(type, options) {
    if (this.destroyed || this.stopped) return false
    const currentRequestAction = type === 'play' ? 'player-play' : 'player-welcome'
    if (this.pendingRequest?.type === type || this.current?.id === currentRequestAction) return false
    const critical = this.lastSnapshot ? criticalBehavior(this.lastSnapshot) : null
    if (critical) {
      this.callbacks.onRequestRejected?.({
        request: type,
        reason: critical.reason ?? critical.id,
        behavior: critical.id,
      })
      return false
    }
    this.pendingRequest = {
      type,
      options,
      priority: BEHAVIOR_PRIORITY.player,
      requestedAt: this.clock,
    }
    return true
  }

  #advanceClock(rawTime) {
    const nextRawTime = finiteNumber(rawTime, this.lastRawTime ?? 0)
    if (this.lastRawTime === null) {
      this.lastRawTime = nextRawTime
      return
    }
    const rawDelta = Math.max(0, nextRawTime - this.lastRawTime)
    this.lastRawTime = nextRawTime
    // A long background pause contributes a single bounded render tick. It
    // never drains a queue of animations or teleports the cat to an anchor.
    this.clock += Math.min(rawDelta, this.maxTickMs)
  }

  #startPendingRequestIfAllowed() {
    if (!this.pendingRequest) return
    if (this.current && this.current.priority >= this.pendingRequest.priority) return

    const request = this.pendingRequest
    this.pendingRequest = null
    const requestIntent = {
      id: request.type,
      priority: request.priority,
    }
    this.#startPlan(createBehaviorPlan(requestIntent, { source: 'player' }), 'player-request')
  }

  #startScheduledPlan() {
    const seed = this.seedOverride ?? getBehaviorSeed(this.lastSnapshot)
    if (this.clock >= this.nextAutonomousAt) {
      let activity = selectAutonomousActivity(this.lastSnapshot, this.autonomousCycle, seed)
      const state = this.lastSnapshot?.state ?? this.lastSnapshot ?? {}
      const energy = finiteNumber(this.lastSnapshot?.needs?.energy ?? state.energy, 70)

      if (energy >= 52 && activity === this.lastAutonomousActivity && this.autonomousRepeatCount >= 2) {
        const alternatives = ['loaf', 'lie', 'window', 'play'].filter(id => id !== activity)
        activity = alternatives[Math.floor(
          deterministicUnit(seed, this.autonomousCycle, 'no-third-repeat') * alternatives.length,
        )]
      }

      if (activity === this.lastAutonomousActivity) this.autonomousRepeatCount += 1
      else {
        this.lastAutonomousActivity = activity
        this.autonomousRepeatCount = 1
      }
      this.autonomousCycle += 1
      this.#startPlan(createBehaviorPlan({
        id: activity,
        priority: BEHAVIOR_PRIORITY.autonomous,
      }, { source: 'autonomous' }), 'autonomous-schedule')
      return
    }

    this.#startPlan(createAmbientPlan(this.ambientCycle, seed), 'ambient-schedule')
    this.ambientCycle += 1
  }

  #startPlan(nextPlan, reason) {
    if (!nextPlan) return
    if (this.current) this.#completeCurrent(`interrupted:${reason}`)
    this.current = {
      ...nextPlan,
      steps: nextPlan.steps.map(step => ({ ...step, runtime: null })),
      stepIndex: 0,
      startedAt: this.clock,
      reason,
    }
    this.lastRenderedState = null
    this.callbacks.onActionStart?.({
      id: this.current.id,
      priority: this.current.priority,
      anchor: this.current.anchor ?? null,
      reason,
    })
  }

  #completeCurrent(reason = 'completed') {
    if (!this.current) return
    const completed = this.current
    this.current = null
    this.lastRenderedState = null

    if (completed.source === 'autonomous') {
      const seed = this.seedOverride ?? getBehaviorSeed(this.lastSnapshot)
      this.nextAutonomousAt = this.clock + selectAutonomousIntervalMs(this.autonomousCycle, seed)
    }

    this.callbacks.onActionComplete?.({ id: completed.id, reason })
  }

  #runCurrentStep() {
    const action = this.current
    const step = action?.steps?.[action.stepIndex]
    if (!action || !step) {
      this.#completeCurrent('completed')
      return
    }

    if (step.type === 'move') this.#runMoveStep(action, step)
    else this.#runAnimationStep(action, step)
  }

  #runMoveStep(action, step) {
    if (!step.runtime) {
      const target = this.#resolveAnchor(step.anchor)
      if (!target) {
        this.#advanceStep(action)
        return
      }

      const from = {
        x: finiteNumber(this.cat?.x),
        y: finiteNumber(this.cat?.y),
      }
      const distance = Math.hypot(target.x - from.x, target.y - from.y)
      const duration = clamp((distance / this.walkSpeed) * 1_000, 480, 4_200)
      step.runtime = { from, target, distance, duration, startedAt: this.clock }
      if (Math.abs(target.x - from.x) > 1) this.cat?.setFacing?.(target.x < from.x ? 'left' : 'right')
      this.callbacks.onMoveStart?.({ action: action.id, anchor: step.anchor, from, target, duration })
    }

    const runtime = step.runtime
    const elapsed = this.clock - runtime.startedAt
    const linear = runtime.distance < 0.5 ? 1 : clamp(elapsed / runtime.duration, 0, 1)
    const eased = linear * linear * (3 - 2 * linear)
    const x = runtime.from.x + (runtime.target.x - runtime.from.x) * eased
    const y = runtime.from.y + (runtime.target.y - runtime.from.y) * eased

    this.cat?.setWorldPosition?.(x, y)
    if (typeof this.cat?.setWorldPosition !== 'function') this.cat?.setPosition?.(x, y)
    this.#renderState(step.state, elapsed, true)
    this.callbacks.onPosition?.({ x, y, anchor: step.anchor, action: action.id })

    if (linear >= 1) {
      this.callbacks.onMoveComplete?.({ action: action.id, anchor: step.anchor, x, y })
      this.#advanceStep(action)
    }
  }

  #runAnimationStep(action, step) {
    if (!step.runtime) {
      step.runtime = { startedAt: this.clock }
      if (step.state === 'play-notice') this.cat?.setFacing?.('right')
    }
    const elapsed = this.clock - step.runtime.startedAt
    this.#renderState(step.state, elapsed, step.loop)
    if (Number.isFinite(step.duration) && elapsed >= step.duration) this.#advanceStep(action)
  }

  #renderState(state, elapsedMs, loop) {
    this.cat?.setMotionState?.(state, { elapsedMs, loop })
    if (state !== this.lastRenderedState) {
      this.lastRenderedState = state
      this.callbacks.onStateChange?.({ state, action: this.current?.id ?? null })
    }
  }

  #advanceStep(action) {
    if (this.current !== action) return
    action.stepIndex += 1
    this.lastRenderedState = null
    if (action.stepIndex >= action.steps.length) this.#completeCurrent('completed')
  }

  #resolveAnchor(anchorId) {
    const source = this.anchors[anchorId]
    const value = typeof source === 'function' ? source(this.lastSnapshot) : source
    return normalizeAnchor(value)
  }
}

export default CatBehaviorController
