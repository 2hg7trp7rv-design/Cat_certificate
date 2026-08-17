import { getGrowthStage, getVirtualNow } from '../../state.js'

export const resolveGrowthStage = (state, actualNow = Date.now()) =>
  getGrowthStage(state, getVirtualNow(state, actualNow))

export class GrowthSystem {
  stage(state, actualNow = Date.now()) {
    return resolveGrowthStage(state, actualNow)
  }
}

export default GrowthSystem
