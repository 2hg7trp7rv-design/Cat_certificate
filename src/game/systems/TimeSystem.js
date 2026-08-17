import {
  getDaysTogether,
  getMealStatus,
  getTimePhase,
  getVirtualNow,
  isSleepTime,
} from '../../state.js'

export const resolveNow = (state, actualNow = Date.now()) => getVirtualNow(state, actualNow)

export const getTimeSnapshot = (state, actualNow = Date.now()) => {
  const now = resolveNow(state, actualNow)

  return {
    now,
    phase: getTimePhase(now),
    sleeping: isSleepTime(state?.routine, now, state?.debug?.forceSleep),
    meal: getMealStatus(state, now),
    day: getDaysTogether(state, now),
  }
}

export class TimeSystem {
  now(state, actualNow = Date.now()) {
    return resolveNow(state, actualNow)
  }

  snapshot(state, actualNow = Date.now()) {
    return getTimeSnapshot(state, actualNow)
  }
}

export default TimeSystem
