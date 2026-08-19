import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DIRECT_ART_FILES,
  DIRECT_ART_MANIFEST,
  DIRECT_ART_VERSION,
  DIRECT_CAT_PROP_ANCHORS,
  DIRECT_CAT_PET_ZONES,
  DIRECT_CAT_POSES,
  DIRECT_CAT_STATE_MAP,
  DIRECT_DERIVED_TEXTURES,
  DIRECT_ROOM_FRAMES,
  resolveDirectCatPose,
} from '../src/game/art/DirectArtManifest.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const EXPECTED_FILES = Object.freeze({
  room: Object.freeze({
    key: 'direct.room',
    url: './assets/game/IMG_3036.png',
    width: 852,
    height: 1846,
    sha256: 'ed17e8f3b5e6774720d3f6587cbee0531b26a9ec985c357a25922e128d0bfb1d',
  }),
  cat: Object.freeze({
    key: 'direct.cat',
    url: './assets/game/IMG_3037.png',
    width: 1536,
    height: 1024,
    sha256: '93daf7f3f669a89a48e1709a9568adc0cef77bedbc21b2be291b9f98840ec90e',
  }),
  brand: Object.freeze({
    key: 'direct.brand',
    url: './assets/game/IMG_3038.png',
    width: 1254,
    height: 1254,
    sha256: 'a1566a67ad07af7f8fc17aabab83dc2b5cf99e4cd8e12b1f481db338ab33ba54',
  }),
})

const EXPECTED_POSES = Object.freeze({
  seated: { frame: 'seated', rect: { x: 75, y: 116, width: 267, height: 342 }, pivot: { x: 95, y: 333 } },
  standing: { frame: 'standing', rect: { x: 346, y: 93, width: 411, height: 363 }, pivot: { x: 214, y: 351 } },
  walking: { frame: 'walking', rect: { x: 763, y: 93, width: 410, height: 365 }, pivot: { x: 217, y: 357 } },
  loaf: { frame: 'loaf', rect: { x: 1224, y: 252, width: 269, height: 222 }, pivot: { x: 136, y: 204 } },
  'side-lie': { frame: 'side-lie', rect: { x: 13, y: 665, width: 471, height: 220 }, pivot: { x: 237, y: 190 } },
  curl: { frame: 'curl', rect: { x: 487, y: 650, width: 287, height: 231 }, pivot: { x: 151, y: 216 } },
  crouch: { frame: 'crouch', rect: { x: 783, y: 506, width: 312, height: 381 }, pivot: { x: 147, y: 366 } },
  pounce: { frame: 'pounce', rect: { x: 1111, y: 500, width: 397, height: 370 }, pivot: { x: 93, y: 356 } },
})

const pngDimensions = bytes => {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'asset is not a PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

test('direct-art manifest pins the three user-approved original PNG files', async () => {
  assert.equal(DIRECT_ART_VERSION, '2026-08-20-direct-v1')
  assert.equal(DIRECT_ART_MANIFEST.source, 'user-approved-original-files')
  assert.deepEqual(DIRECT_ART_FILES, EXPECTED_FILES)
  assert.deepEqual(DIRECT_ART_MANIFEST.room, {
    width: 852,
    height: 1846,
    fit: 'cover',
    frames: {
      'toy-floor-cover': {
        frame: 'toy-floor-cover',
        rect: { x: 271, y: 1457, width: 92, height: 92 },
      },
      'bed-foreground': {
        frame: 'bed-foreground',
        rect: { x: 620, y: 1075, width: 232, height: 145 },
      },
    },
  })
  assert.equal(DIRECT_ART_MANIFEST.cat.sheet, 'direct.cat')
  assert.equal(DIRECT_ART_MANIFEST.cat.poseCount, 8)

  for (const [name, file] of Object.entries(EXPECTED_FILES)) {
    const assetPath = resolve(ROOT, 'public', file.url.replace(/^\.\//, ''))
    const bytes = await readFile(assetPath)
    assert.deepEqual(pngDimensions(bytes), { width: file.width, height: file.height }, `${name}: PNG dimensions changed`)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `${name}: approved PNG bytes changed`)
  }
})

test('direct room helper frames stay bounded inside the unchanged approved room', () => {
  assert.deepEqual(DIRECT_ROOM_FRAMES, DIRECT_ART_MANIFEST.room.frames)
  for (const [name, frame] of Object.entries(DIRECT_ROOM_FRAMES)) {
    const { x, y, width, height } = frame.rect
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, `${name}: invalid source frame`)
    assert.ok(x + width <= DIRECT_ART_FILES.room.width, `${name}: frame exceeds room width`)
    assert.ok(y + height <= DIRECT_ART_FILES.room.height, `${name}: frame exceeds room height`)
  }
})

test('derived prop and occlusion textures use only bounded pixels from the approved room', () => {
  assert.deepEqual(DIRECT_ART_MANIFEST.derived, DIRECT_DERIVED_TEXTURES)
  assert.deepEqual(Object.keys(DIRECT_DERIVED_TEXTURES).sort(), ['bedForeground', 'caughtToy'])

  for (const [name, texture] of Object.entries(DIRECT_DERIVED_TEXTURES)) {
    assert.equal(texture.source, DIRECT_ART_FILES.room.key, `${name}: source must remain the approved room`)
    const { x, y, width, height } = texture.crop
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, `${name}: invalid crop`)
    assert.ok(x + width <= DIRECT_ART_FILES.room.width, `${name}: crop exceeds room width`)
    assert.ok(y + height <= DIRECT_ART_FILES.room.height, `${name}: crop exceeds room height`)
    assert.ok(texture.mask.polygon.length >= 3, `${name}: polygon mask is incomplete`)
    for (const [pointX, pointY] of texture.mask.polygon) {
      assert.ok(pointX >= 0 && pointX <= width, `${name}: mask x exceeds crop`)
      assert.ok(pointY >= 0 && pointY <= height, `${name}: mask y exceeds crop`)
    }
  }
})

test('the direct cat sheet exposes exactly eight bounded source frames', () => {
  assert.deepEqual(DIRECT_CAT_POSES, EXPECTED_POSES)
  assert.equal(Object.keys(DIRECT_CAT_POSES).length, 8)
  assert.equal(new Set(Object.values(DIRECT_CAT_POSES).map(pose => pose.frame)).size, 8)

  const sheet = DIRECT_ART_FILES.cat
  for (const [name, pose] of Object.entries(DIRECT_CAT_POSES)) {
    const { x, y, width, height } = pose.rect
    assert.ok(Number.isInteger(x) && x >= 0, `${name}: invalid frame x`)
    assert.ok(Number.isInteger(y) && y >= 0, `${name}: invalid frame y`)
    assert.ok(Number.isInteger(width) && width > 0, `${name}: invalid frame width`)
    assert.ok(Number.isInteger(height) && height > 0, `${name}: invalid frame height`)
    assert.ok(x + width <= sheet.width, `${name}: frame exceeds cat sheet width`)
    assert.ok(y + height <= sheet.height, `${name}: frame exceeds cat sheet height`)
    assert.ok(pose.pivot.x >= 0 && pose.pivot.x <= width, `${name}: pivot x is outside the frame`)
    assert.ok(pose.pivot.y >= 0 && pose.pivot.y <= height, `${name}: pivot y is outside the frame`)
  }
})

test('every cat behavior state resolves only to one of the eight approved poses', () => {
  const approved = new Set(Object.keys(DIRECT_CAT_POSES))
  assert.equal(Object.keys(DIRECT_CAT_STATE_MAP).length, 21)

  for (const [state, sequence] of Object.entries(DIRECT_CAT_STATE_MAP)) {
    assert.ok(sequence.length > 0, `${state}: pose sequence is empty`)
    assert.ok(sequence.every(pose => approved.has(pose)), `${state}: pose sequence contains a non-approved drawing`)
    for (let index = 0; index < sequence.length * 2; index += 1) {
      assert.equal(resolveDirectCatPose(state, index), sequence[index % sequence.length])
    }
  }

  assert.equal(resolveDirectCatPose('unknown-state', 0), 'seated')
})

test('non-looping source-pose transitions never wrap back after reaching their final pose', () => {
  const expected = {
    sit: ['standing', 'standing', 'seated', 'seated', 'seated', 'seated'],
    turn: ['standing', 'walking', 'walking', 'standing', 'standing'],
    'sleep-curl-transition': ['loaf', 'loaf', 'side-lie', 'side-lie', 'curl', 'curl', 'curl', 'curl'],
    'sleep-side-transition': ['loaf', 'loaf', 'curl', 'curl', 'side-lie', 'side-lie', 'side-lie'],
    'play-notice': ['loaf', 'loaf', 'crouch', 'crouch'],
    'play-recover': ['pounce', 'pounce', 'crouch', 'crouch', 'standing', 'standing'],
    welcome: ['seated', 'standing', 'standing', 'seated', 'seated'],
  }
  for (const [state, sequence] of Object.entries(expected)) {
    assert.deepEqual(DIRECT_CAT_STATE_MAP[state], sequence, `${state}: transition regressed`)
    assert.equal(resolveDirectCatPose(state, sequence.length - 1), sequence.at(-1))
  }
})

test('all eight approved cat drawings define bounded head, back, and tail petting regions', () => {
  assert.deepEqual(Object.keys(DIRECT_CAT_PET_ZONES).sort(), Object.keys(DIRECT_CAT_POSES).sort())
  for (const [name, regions] of Object.entries(DIRECT_CAT_PET_ZONES)) {
    const pose = DIRECT_CAT_POSES[name]
    assert.deepEqual(Object.keys(regions).sort(), ['back', 'head', 'tail'])
    for (const [zone, region] of Object.entries(regions)) {
      assert.ok(region.width > 0 && region.height > 0, `${name}/${zone}: empty region`)
      assert.ok(region.x >= -pose.pivot.x, `${name}/${zone}: region exceeds frame left`)
      assert.ok(region.y >= -pose.pivot.y, `${name}/${zone}: region exceeds frame top`)
      assert.ok(region.x + region.width <= pose.rect.width - pose.pivot.x, `${name}/${zone}: region exceeds frame right`)
      assert.ok(region.y + region.height <= pose.rect.height - pose.pivot.y, `${name}/${zone}: region exceeds frame bottom`)
    }
  }
})

test('the caught toy uses a pose-local paw anchor that mirrors with the cat', () => {
  assert.deepEqual(DIRECT_ART_MANIFEST.cat.propAnchors, DIRECT_CAT_PROP_ANCHORS)
  assert.deepEqual(DIRECT_CAT_PROP_ANCHORS, {
    crouch: { caughtToy: { x: -104, y: -8 } },
  })
  const pose = DIRECT_CAT_POSES.crouch
  const anchor = DIRECT_CAT_PROP_ANCHORS.crouch.caughtToy
  assert.ok(anchor.x >= -pose.pivot.x && anchor.x <= pose.rect.width - pose.pivot.x)
  assert.ok(anchor.y >= -pose.pivot.y && anchor.y <= pose.rect.height - pose.pivot.y)
})
