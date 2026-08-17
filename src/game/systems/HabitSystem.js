import {
  getMealStatus,
  getVirtualNow,
  isSleepTime,
  sanitizeRoutine,
  updateRoutine,
} from '../../state.js'

export const getRoutine = state => sanitizeRoutine(state?.routine)

export const updateHabitRoutine = (state, routine) => updateRoutine(state, routine)

export const getHabitSnapshot = (state, actualNow = Date.now()) => {
  const now = getVirtualNow(state, actualNow)

  return {
    routine: getRoutine(state),
    sleeping: isSleepTime(state?.routine, now, state?.debug?.forceSleep),
    meal: getMealStatus(state, now),
    favoriteTouch: state?.preferences?.favoriteTouch || null,
    favoriteFood: state?.preferences?.favoriteFood || null,
  }
}

export class HabitSystem {
  routine(state) {
    return getRoutine(state)
  }

  update(state, routine) {
    return updateHabitRoutine(state, routine)
  }

  snapshot(state, actualNow = Date.now()) {
    return getHabitSnapshot(state, actualNow)
  }
}

export default HabitSystem
