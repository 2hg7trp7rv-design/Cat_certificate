import assert from 'node:assert/strict'
import test from 'node:test'
import { PIXEL_TEXTURE_MANIFEST } from '../src/game/art/PixelArt.js'

const allSpecs = manifest => [
  ...Object.values(manifest.room),
  ...Object.values(manifest.furniture),
  ...Object.values(manifest.shadows),
  ...Object.values(manifest.lights),
  ...Object.values(manifest.cat.states).flatMap(state => state.frames),
]

test('v0.8 pixel manifest is complete, local, and deterministic', () => {
  const specs = allSpecs(PIXEL_TEXTURE_MANIFEST)
  const keys = specs.map(spec => spec.key)

  assert.deepEqual(PIXEL_TEXTURE_MANIFEST.world, { width: 216, height: 472, preferredScale: 2 })
  assert.equal(PIXEL_TEXTURE_MANIFEST.grid, 8)
  assert.equal(specs.length, 131)
  assert.equal(new Set(keys).size, specs.length)
  assert.ok(specs.every(spec => spec.temporary === false))
  assert.ok(specs.every(spec => spec.pixelArt === true))
  assert.ok(specs.every(spec => Number.isInteger(spec.width) && spec.width > 0))
  assert.ok(specs.every(spec => Number.isInteger(spec.height) && spec.height > 0))
  assert.ok(keys.every(key => /^pixel\.(?:room|furniture|shadow|light|cat)\./.test(key)))

  const lightMasks = specs.filter(spec => spec.category === 'light-mask')
  assert.equal(lightMasks.length, 3)
  assert.ok(lightMasks.every(spec => spec.smoothingAllowed === true && spec.scaleMode === 'linear'))
  assert.ok(specs.filter(spec => spec.category !== 'light-mask').every(spec => spec.scaleMode === 'nearest'))
})

test('all cat motion states share one foot pivot and sequential frame keys', () => {
  const states = Object.values(PIXEL_TEXTURE_MANIFEST.cat.states)
  const frames = states.flatMap(state => state.frames)

  assert.equal(states.length, 21)
  assert.equal(frames.length, 113)
  assert.deepEqual(PIXEL_TEXTURE_MANIFEST.cat.canvas, { width: 96, height: 96 })
  assert.deepEqual(PIXEL_TEXTURE_MANIFEST.cat.pivot, { x: 48, y: 88 })

  for (const state of states) {
    assert.equal(state.frames.length, state.frameCount)
    assert.deepEqual(state.pivot, { x: 48, y: 88 })
    assert.deepEqual(
      state.frames.map(frame => frame.key),
      Array.from({ length: state.frameCount }, (_, index) => `pixel.cat.${state.state}.${index}`),
    )
  }
})
