import assert from 'node:assert/strict'
import test from 'node:test'
import { DIRECT_CAT_PET_ZONES } from '../src/game/art/DirectArtManifest.js'
import PettingInput, { classifyPettingZone } from '../src/game/input/PettingInput.js'

class FakeCat {
  constructor() {
    this.x = 0
    this.y = 0
    this.scaleX = 1
    this.scaleY = 1
    this.facing = 'right'
    this.poseName = 'seated'
    this.handlers = new Map()
  }

  on(name, handler) {
    this.handlers.set(name, handler)
  }

  off(name, handler) {
    if (this.handlers.get(name) === handler) this.handlers.delete(name)
  }
}

const pointer = (id, worldX, worldY) => ({ id, worldX, worldY })

test('a tap is not accepted as a petting stroke', () => {
  const completed = []
  const input = new PettingInput(new FakeCat(), { onComplete: result => completed.push(result) })
  input.start(pointer(1, 10, 10))
  input.finish(pointer(1, 10, 10))
  assert.equal(completed.length, 0)
})

test('a second pointer cannot replace an active petting stroke', () => {
  const input = new PettingInput(new FakeCat())
  input.start(pointer(1, 0, 0))
  input.start(pointer(2, 50, 50))
  assert.equal(input.active.pointerId, 1)
})

test('a slow stroke reports distance, pace, and local zone', () => {
  const completed = []
  const input = new PettingInput(new FakeCat(), { onComplete: result => completed.push(result) })
  input.start(pointer(1, 0, 0))
  input.move(pointer(1, 0, 60))
  input.active.startedAt = performance.now() - 500
  input.finish(pointer(1, 0, 60))

  assert.equal(completed.length, 1)
  assert.equal(completed[0].pace, 'slow')
  assert.equal(completed[0].zone, 'flank')
  assert.equal(completed[0].distance, 60)
})

test('all direct-art poses mirror their head and tail petting regions with facing', () => {
  for (const [poseName, regions] of Object.entries(DIRECT_CAT_PET_ZONES)) {
    for (const zone of ['head', 'tail']) {
      const region = regions[zone]
      const sourceX = region.x + region.width / 2
      const sourceY = region.y + region.height / 2
      assert.equal(classifyPettingZone(sourceX, sourceY, 'left', poseName), zone, `${poseName}/${zone}/left`)
      assert.equal(classifyPettingZone(-sourceX, sourceY, 'right', poseName), zone, `${poseName}/${zone}/right`)
    }
  }
})

test('the pointer-up segment counts when mobile move events are coarse', () => {
  const completed = []
  const input = new PettingInput(new FakeCat(), { onComplete: result => completed.push(result) })
  input.start(pointer(1, 0, 0))
  input.active.startedAt = performance.now() - 500
  input.finish(pointer(1, 48, 0))

  assert.equal(completed.length, 1)
  assert.equal(completed[0].distance, 48)
})
