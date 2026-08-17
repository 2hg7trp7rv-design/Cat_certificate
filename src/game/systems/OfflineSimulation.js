import { applyElapsedTime, getVirtualNow } from '../../state.js'

export const getOfflineElapsedMs = (state, actualNow = Date.now()) => {
  const now = getVirtualNow(state, actualNow)
  return Math.max(0, now - Number(state?.lastSeenAt || now))
}

export const resumeOfflineState = (state, actualNow = Date.now()) =>
  applyElapsedTime(state, getVirtualNow(state, actualNow))

export const markStateSeen = (state, actualNow = Date.now()) => ({
  ...state,
  lastSeenAt: getVirtualNow(state, actualNow),
})

export class OfflineSimulation {
  elapsedMs(state, actualNow = Date.now()) {
    return getOfflineElapsedMs(state, actualNow)
  }

  resume(state, actualNow = Date.now()) {
    return resumeOfflineState(state, actualNow)
  }

  markSeen(state, actualNow = Date.now()) {
    return markStateSeen(state, actualNow)
  }
}

export default OfflineSimulation
