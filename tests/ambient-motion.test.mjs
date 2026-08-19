import assert from 'node:assert/strict'
import test from 'node:test'
import AmbientRoomMotion from '../src/game/world/AmbientRoomMotion.js'

const makeLight = (baseAlpha, { visible = true } = {}) => ({
  alpha: baseAlpha,
  visible,
  getData(key) {
    return key === 'baseAlpha' ? baseAlpha : undefined
  },
  setAlpha(value) {
    this.alpha = value
    return this
  },
})

const makeMotion = ({ lampGlow, windowLight }) => {
  const timer = { destroyed: false, destroy() { this.destroyed = true } }
  const scene = { time: { addEvent: () => timer } }
  return { motion: new AmbientRoomMotion(scene, { lampGlow, windowLight }), timer }
}

test('approved daytime source colors stay unmodified across ambient ticks', () => {
  const lampGlow = makeLight(0)
  const windowLight = makeLight(0)
  const { motion } = makeMotion({ lampGlow, windowLight })

  for (let index = 0; index < 24; index += 1) motion.tick()

  assert.equal(lampGlow.alpha, 0)
  assert.equal(windowLight.alpha, 0)
})

test('positive evening and night light bases may pulse without changing their baseline contract', () => {
  const lampGlow = makeLight(0.12)
  const windowLight = makeLight(0.025)
  const { motion, timer } = makeMotion({ lampGlow, windowLight })

  for (let index = 0; index < 6; index += 1) motion.tick()

  assert.ok(Math.abs(lampGlow.alpha - 0.138) < 1e-12)
  assert.ok(Math.abs(windowLight.alpha - 0.043) < 1e-12)
  motion.destroy()
  assert.equal(timer.destroyed, true)
})
