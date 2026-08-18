import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WORLD_ZOOM,
  recenterWorldCamera,
} from '../src/game/world/WorldCamera.js'

const SIZES = [
  [320, 667],
  [393, 852],
  [430, 932],
]

test('fixed 2x camera exposes an integer world-view origin at every target size', () => {
  for (const [width, height] of SIZES) {
    const camera = {
      width,
      height,
      setScroll(x, y) {
        this.scrollX = x
        this.scrollY = y
      },
    }
    recenterWorldCamera(camera)

    const visibleWidth = width / WORLD_ZOOM
    const visibleHeight = height / WORLD_ZOOM
    const worldViewX = camera.scrollX + width / 2 - visibleWidth / 2
    const worldViewY = camera.scrollY + height / 2 - visibleHeight / 2

    assert.equal(worldViewX, Math.floor((WORLD_WIDTH - visibleWidth) / 2))
    assert.equal(worldViewY, Math.floor((WORLD_HEIGHT - visibleHeight) / 2))
    assert.equal(Number.isInteger(worldViewX), true)
    assert.equal(Number.isInteger(worldViewY), true)
    assert.equal((worldViewX + 1 - worldViewX) * WORLD_ZOOM, 2)
  }
})
