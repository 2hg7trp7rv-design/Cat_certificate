import { getMealStatus, getTimePhase, getVirtualNow, isSleepTime } from '../../state.js'

export const CAT_ANCHOR_IDS = Object.freeze({
  center: 'center-idle',
  rug: 'rug-play',
  bed: 'bed-sleep',
  bowl: 'bowl-wait',
  window: 'window-watch',
  carrier: 'carrier',
})

export const BEHAVIOR_PRIORITY = Object.freeze({
  ambient: 10,
  autonomous: 30,
  player: 60,
  lowEnergy: 80,
  hunger: 90,
  sleep: 100,
  onboarding: 110,
})

const behavior = (id, location, reason, priority, { interruptible = true } = {}) => Object.freeze({
  id,
  location,
  anchor: CAT_ANCHOR_IDS[location] ?? location,
  reason,
  priority,
  interruptible,
})

export const chooseBehavior = (state, actualNow = Date.now()) => {
  if (!state?.onboarded) {
    return behavior('first-meeting', 'carrier', 'not-onboarded', BEHAVIOR_PRIORITY.onboarding, {
      interruptible: false,
    })
  }

  const now = getVirtualNow(state, actualNow)

  // Life needs intentionally outrank direct player requests. A sleeping or
  // depleted cat may acknowledge input without being forced into play.
  if (isSleepTime(state.routine, now, state.debug?.forceSleep)) {
    return behavior('sleep', 'bed', 'sleep-time', BEHAVIOR_PRIORITY.sleep, {
      interruptible: false,
    })
  }

  const meal = getMealStatus(state, now)
  if (meal.overdue || Number(state.fullness) < 38) {
    return behavior(
      'wait-for-meal',
      'bowl',
      meal.overdue ? 'meal-overdue' : 'low-fullness',
      BEHAVIOR_PRIORITY.hunger,
      { interruptible: false },
    )
  }

  if (Number(state.energy) < 36) {
    return behavior('rest', 'bed', 'low-energy', BEHAVIOR_PRIORITY.lowEnergy, {
      interruptible: false,
    })
  }

  if (getTimePhase(now) === 'morning') {
    return behavior('watch-window', 'window', 'morning', BEHAVIOR_PRIORITY.autonomous)
  }

  return behavior('idle', 'center', 'settled', BEHAVIOR_PRIORITY.ambient)
}

/** Accepts either raw v6 state or the public GameStateStore snapshot. */
export const chooseSnapshotBehavior = (snapshot, actualNow = Date.now()) => {
  if (snapshot?.behavior?.id) return snapshot.behavior
  return chooseBehavior(snapshot?.state ?? snapshot, actualNow)
}

export class BehaviorSystem {
  choose(state, actualNow = Date.now()) {
    return chooseBehavior(state, actualNow)
  }
}

export default BehaviorSystem
