import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WORLD_CENTER_X,
  WORLD_CENTER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  calculateWorldZoom,
  recenterWorldCamera,
} from '../src/game/world/WorldCamera.js'

const SIZES = [
  [320, 667],
  [393, 852],
  [430, 932],
]

const closeTo = (actual, expected, message, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`)
}

test('the direct room keeps its approved 852x1846 coordinate system', () => {
  assert.equal(WORLD_WIDTH, 852)
  assert.equal(WORLD_HEIGHT, 1846)
  assert.equal(WORLD_CENTER_X, 426)
  assert.equal(WORLD_CENTER_Y, 923)
})

test('dynamic centered cover fills every target viewport without distortion', () => {
  for (const [width, height] of SIZES) {
    const expectedZoom = Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT)
    closeTo(calculateWorldZoom(width, height), expectedZoom, `${width}x${height}: cover zoom`)

    const camera = {
      width,
      height,
      setZoom(value) { this.zoom = value },
      setScroll(x, y) { this.scrollX = x; this.scrollY = y },
    }
    recenterWorldCamera(camera)

    closeTo(camera.zoom, expectedZoom, `${width}x${height}: camera zoom`)
    const visibleWidth = width / camera.zoom
    const visibleHeight = height / camera.zoom
    const worldViewX = camera.scrollX + width / 2 - visibleWidth / 2
    const worldViewY = camera.scrollY + height / 2 - visibleHeight / 2
    const expectedWorldViewX = (WORLD_WIDTH - visibleWidth) / 2
    const expectedWorldViewY = (WORLD_HEIGHT - visibleHeight) / 2

    closeTo(worldViewX, expectedWorldViewX, `${width}x${height}: centered horizontal crop`, 1e-7)
    closeTo(worldViewY, expectedWorldViewY, `${width}x${height}: centered vertical crop`, 1e-7)
    assert.ok(worldViewX >= -1e-7, `${width}x${height}: cover exposed space beside the room`)
    assert.ok(worldViewY >= -1e-7, `${width}x${height}: cover exposed space above or below the room`)
    assert.ok(WORLD_WIDTH * camera.zoom + 1e-7 >= width, `${width}x${height}: room does not cover viewport width`)
    assert.ok(WORLD_HEIGHT * camera.zoom + 1e-7 >= height, `${width}x${height}: room does not cover viewport height`)
    assert.ok(
      Math.abs(WORLD_WIDTH * camera.zoom - width) < 1e-7
        || Math.abs(WORLD_HEIGHT * camera.zoom - height) < 1e-7,
      `${width}x${height}: neither room axis is fitted exactly`,
    )
  }
})

test('cover geometry has only the unavoidable centered crop at each target size', () => {
  const cropInCssPixels = ([width, height]) => {
    const zoom = calculateWorldZoom(width, height)
    return {
      horizontal: WORLD_WIDTH * zoom - width,
      vertical: WORLD_HEIGHT * zoom - height,
    }
  }

  const narrow = cropInCssPixels([393, 852])
  closeTo(narrow.horizontal, 3 / 13, '393x852 horizontal crop', 1e-9)
  closeTo(narrow.vertical, 0, '393x852 vertical crop')

  const large = cropInCssPixels([430, 932])
  closeTo(large.horizontal, 2 / 13, '430x932 horizontal crop', 1e-9)
  closeTo(large.vertical, 0, '430x932 vertical crop')

  const small = cropInCssPixels([320, 667])
  closeTo(small.horizontal, 0, '320x667 horizontal crop')
  closeTo(small.vertical, 79 / 3, '320x667 vertical crop', 1e-9)
})
