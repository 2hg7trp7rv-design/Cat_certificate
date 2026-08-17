import { getMealStatus, getTimePhase, getVirtualNow, isSleepTime } from '../../state.js'

const behavior = (id, location, reason) => ({ id, location, reason })

export const chooseBehavior = (state, actualNow = Date.now()) => {
  if (!state?.onboarded) return behavior('first-meeting', 'carrier', 'not-onboarded')

  const now = getVirtualNow(state, actualNow)
  if (isSleepTime(state.routine, now, state.debug?.forceSleep)) {
    return behavior('sleep', 'bed', 'sleep-time')
  }

  const meal = getMealStatus(state, now)
  if (meal.overdue || Number(state.fullness) < 38) {
    return behavior('wait-for-meal', 'bowl', meal.overdue ? 'meal-overdue' : 'low-fullness')
  }

  if (Number(state.energy) < 36) return behavior('rest', 'bed', 'low-energy')
  if (getTimePhase(now) === 'morning') return behavior('watch-window', 'window', 'morning')
  return behavior('idle', 'center', 'settled')
}

export class BehaviorSystem {
  choose(state, actualNow = Date.now()) {
    return chooseBehavior(state, actualNow)
  }
}

export default BehaviorSystem
