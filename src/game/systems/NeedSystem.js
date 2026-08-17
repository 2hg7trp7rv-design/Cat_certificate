import { applyElapsedTime, getMealStatus, getVirtualNow } from '../../state.js'

const numberOr = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const advanceNeeds = (state, actualNow = Date.now()) =>
  applyElapsedTime(state, getVirtualNow(state, actualNow))

export const getNeedSnapshot = (state, actualNow = Date.now()) => {
  const now = getVirtualNow(state, actualNow)
  const fullness = numberOr(state?.fullness)
  const energy = numberOr(state?.energy)
  const comfort = numberOr(state?.comfort)
  const meal = getMealStatus(state, now)

  return {
    fullness,
    energy,
    comfort,
    hungry: meal.overdue || fullness < 38,
    tired: energy < 36,
    meal,
  }
}

export class NeedSystem {
  advance(state, actualNow = Date.now()) {
    return advanceNeeds(state, actualNow)
  }

  snapshot(state, actualNow = Date.now()) {
    return getNeedSnapshot(state, actualNow)
  }
}

export default NeedSystem
