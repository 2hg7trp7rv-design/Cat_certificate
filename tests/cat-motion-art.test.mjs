import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { inflateSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CAT_BLINK_SEQUENCE,
  CAT_MOTION_ART_FILE,
  CAT_MOTION_CELL,
  CAT_MOTION_FRAMES,
  CAT_MOTION_PROVENANCE,
  CAT_TAIL_MOTION,
} from '../src/game/art/CatMotionManifest.js'
import {
  CAT_KINEMATIC_PROFILES,
  resolveCatKinematicTransform,
} from '../src/game/motion/CatKinematics.js'
import { DIRECT_ART_FILES } from '../src/game/art/DirectArtManifest.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

const paeth = (left, up, upperLeft) => {
  const prediction = left + up - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const cornerDistance = Math.abs(prediction - upperLeft)
  if (leftDistance <= upDistance && leftDistance <= cornerDistance) return left
  return upDistance <= cornerDistance ? up : upperLeft
}

const decodeRgbaPng = bytes => {
  assert.equal(bytes.subarray(0, 8).equals(PNG_SIGNATURE), true, 'invalid PNG signature')
  let offset = 8
  let header = null
  const compressed = []
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === 'IDAT') compressed.push(data)
    offset += 12 + length
    if (type === 'IEND') break
  }

  assert.ok(header, 'PNG has no IHDR')
  assert.deepEqual(
    { bitDepth: header.bitDepth, colorType: header.colorType, interlace: header.interlace },
    { bitDepth: 8, colorType: 6, interlace: 0 },
    'motion/source PNG must be non-interlaced 8-bit RGBA',
  )
  const bytesPerPixel = 4
  const stride = header.width * bytesPerPixel
  const filtered = inflateSync(Buffer.concat(compressed))
  assert.equal(filtered.length, header.height * (stride + 1), 'unexpected PNG scanline length')
  const pixels = Buffer.alloc(header.height * stride)

  for (let y = 0; y < header.height; y += 1) {
    const sourceRow = y * (stride + 1)
    const targetRow = y * stride
    const filter = filtered[sourceRow]
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[sourceRow + 1 + x]
      const left = x >= bytesPerPixel ? pixels[targetRow + x - bytesPerPixel] : 0
      const up = y > 0 ? pixels[targetRow - stride + x] : 0
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[targetRow - stride + x - bytesPerPixel]
        : 0
      let value = raw
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += Math.floor((left + up) / 2)
      else if (filter === 4) value += paeth(left, up, upperLeft)
      else assert.equal(filter, 0, `unsupported PNG filter ${filter}`)
      pixels[targetRow + x] = value & 0xff
    }
  }

  return {
    ...header,
    pixels,
    pixel(x, y) {
      const index = (y * header.width + x) * 4
      return pixels.subarray(index, index + 4)
    },
  }
}

const motionPath = resolve(ROOT, 'public', CAT_MOTION_ART_FILE.url.replace(/^\.\//, ''))
const directCatPath = resolve(ROOT, 'public', DIRECT_ART_FILES.cat.url.replace(/^\.\//, ''))

test('the source-locked motion atlas is pinned separately from the three approved originals', async () => {
  const [motionBytes, directBytes] = await Promise.all([readFile(motionPath), readFile(directCatPath)])
  assert.equal(sha256(motionBytes), CAT_MOTION_ART_FILE.sha256)
  assert.equal(sha256(directBytes), DIRECT_ART_FILES.cat.sha256)
  assert.notEqual(CAT_MOTION_ART_FILE.key, DIRECT_ART_FILES.cat.key)
  assert.match(CAT_MOTION_ART_FILE.url, /motion\/v0\.8\.2\/cat-micro\.png$/)

  const files = await readdir(resolve(ROOT, 'public/assets/game/motion/v0.8.2'))
  assert.deepEqual(files.sort(), ['cat-micro.png'])
})

test('every supplemental frame is a bounded fixed cell with a shared floor pivot and transparent guard', async () => {
  const atlas = decodeRgbaPng(await readFile(motionPath))
  assert.deepEqual(
    { width: atlas.width, height: atlas.height },
    { width: CAT_MOTION_ART_FILE.width, height: CAT_MOTION_ART_FILE.height },
  )

  for (const [name, frame] of Object.entries(CAT_MOTION_FRAMES)) {
    const { x, y, width, height } = frame.rect
    assert.deepEqual({ width, height }, CAT_MOTION_CELL, `${name}: cell size changed`)
    assert.ok(x >= 0 && y >= 0 && x + width <= atlas.width && y + height <= atlas.height)
    assert.deepEqual(frame.pivot, { x: 256, y: 400 })
    assert.equal(frame.canonicalPose, 'seated')

    for (let localY = 0; localY < height; localY += 1) {
      for (let localX = 0; localX < width; localX += 1) {
        if (localX >= 16 && localY >= 16 && localX < width - 16 && localY < height - 16) continue
        assert.ok(atlas.pixel(x + localX, y + localY)[3] < 16, `${name}: visible pixel entered 16px guard`)
      }
    }
  }
})

test('blink frames change only the recorded eye region of the approved seated source', async () => {
  const [source, atlas] = await Promise.all([
    readFile(directCatPath).then(decodeRgbaPng),
    readFile(motionPath).then(decodeRgbaPng),
  ])
  const sourceRect = CAT_MOTION_PROVENANCE.sourceRect
  const changed = CAT_MOTION_PROVENANCE.blink.changedRegion
  const framePlacement = { x: 161, y: 67 }

  for (const name of ['blink-half', 'blink-closed']) {
    const frame = CAT_MOTION_FRAMES[name]
    let changedPixels = 0
    for (let y = 0; y < sourceRect.height; y += 1) {
      for (let x = 0; x < sourceRect.width; x += 1) {
        const sourcePixel = source.pixel(sourceRect.x + x, sourceRect.y + y)
        const motionPixel = atlas.pixel(frame.rect.x + framePlacement.x + x, frame.rect.y + framePlacement.y + y)
        const equal = sourcePixel.equals(motionPixel)
        const inside = x >= changed.x && y >= changed.y
          && x < changed.x + changed.width && y < changed.y + changed.height
        if (!inside) assert.equal(equal, true, `${name}: pixel changed outside eye region at ${x},${y}`)
        else if (!equal) changedPixels += 1
      }
    }
    assert.ok(changedPixels >= 300 && changedPixels <= 3_500, `${name}: implausible changed pixel count ${changedPixels}`)
  }

  assert.deepEqual(CAT_BLINK_SEQUENCE, ['blink-half', 'blink-closed', 'blink-closed', 'blink-half'])
})

test('neutral tail body plus part is an exact source-pixel partition', async () => {
  const [source, atlas] = await Promise.all([
    readFile(directCatPath).then(decodeRgbaPng),
    readFile(motionPath).then(decodeRgbaPng),
  ])
  const sourceRect = CAT_MOTION_PROVENANCE.sourceRect
  const placement = { x: 161, y: 67 }
  const body = CAT_MOTION_FRAMES[CAT_TAIL_MOTION.bodyFrame]
  const part = CAT_MOTION_FRAMES[CAT_TAIL_MOTION.partFrame]

  for (let y = 0; y < sourceRect.height; y += 1) {
    for (let x = 0; x < sourceRect.width; x += 1) {
      const sourcePixel = source.pixel(sourceRect.x + x, sourceRect.y + y)
      const bodyPixel = atlas.pixel(body.rect.x + placement.x + x, body.rect.y + placement.y + y)
      const partPixel = atlas.pixel(part.rect.x + placement.x + x, part.rect.y + placement.y + y)
      const visibleComponents = [bodyPixel, partPixel].filter(pixel => pixel[3] > 0)
      if (sourcePixel[3] === 0) {
        assert.equal(visibleComponents.length, 0, `tail partition created alpha at ${x},${y}`)
      } else {
        assert.equal(visibleComponents.length, 1, `tail partition overlap/gap at ${x},${y}`)
        assert.equal(visibleComponents[0].equals(sourcePixel), true, `tail partition changed source RGBA at ${x},${y}`)
      }
    }
  }
  assert.equal(CAT_MOTION_PROVENANCE.tail.neutralCompositePixelDifference, 0)
})

test('tail and root kinematics are bounded, distinct, and never use scale', () => {
  assert.equal(CAT_TAIL_MOTION.angles[0], 0)
  assert.equal(CAT_TAIL_MOTION.angles.at(-1), 0)
  assert.ok(Math.max(...CAT_TAIL_MOTION.angles.map(Math.abs)) <= 6)
  assert.ok(new Set(CAT_TAIL_MOTION.angles).size >= 5)

  for (const [state, frames] of Object.entries(CAT_KINEMATIC_PROFILES)) {
    assert.ok(frames.length >= 4, `${state}: kinematic profile is too short`)
    for (const [index, frame] of frames.entries()) {
      assert.deepEqual(Object.keys(frame).sort(), ['angle', 'y'], `${state}/${index}: scale or unknown transform added`)
      assert.ok(Number.isFinite(frame.y) && Number.isFinite(frame.angle))
      assert.deepEqual(resolveCatKinematicTransform(state, index), frame)
    }
  }
  assert.equal(Math.min(...CAT_KINEMATIC_PROFILES['play-pounce'].map(frame => frame.y)), -24)
  assert.ok(Math.max(...CAT_KINEMATIC_PROFILES.walk.map(frame => Math.abs(frame.y))) <= 2)
  assert.deepEqual(resolveCatKinematicTransform('sleep-curl', 99), { y: 0, angle: 0 })
})
