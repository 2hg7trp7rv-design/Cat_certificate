import { feedPet, getVirtualNow, recordPetting, recordPlay } from '../../state.js'

export const pet = (state, zone, pace = 'slow', actualNow = Date.now()) =>
  recordPetting(state, zone, pace, getVirtualNow(state, actualNow))

export const feed = (state, food, actualNow = Date.now()) =>
  feedPet(state, food, getVirtualNow(state, actualNow))

export const play = (state, actualNow = Date.now()) =>
  recordPlay(state, getVirtualNow(state, actualNow))

export const getRelationshipSnapshot = state => ({
  bond: Number(state?.bond || 0),
  favoriteTouch: state?.preferences?.favoriteTouch || null,
  favoriteFood: state?.preferences?.favoriteFood || null,
  lastPettedAt: state?.lastPettedAt || null,
  lastPlayedAt: state?.lastPlayedAt || null,
})

export class RelationshipSystem {
  pet(state, zone, pace = 'slow', actualNow = Date.now()) {
    return pet(state, zone, pace, actualNow)
  }

  feed(state, food, actualNow = Date.now()) {
    return feed(state, food, actualNow)
  }

  play(state, actualNow = Date.now()) {
    return play(state, actualNow)
  }

  snapshot(state) {
    return getRelationshipSnapshot(state)
  }
}

export default RelationshipSystem
