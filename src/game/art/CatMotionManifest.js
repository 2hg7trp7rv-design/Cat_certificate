export const CAT_MOTION_ART_VERSION = '2026-08-20-source-locked-v1'

export const CAT_MOTION_ART_FILE = Object.freeze({
  key: 'motion.cat.micro.v082',
  url: './assets/game/motion/v0.8.2/cat-micro.png',
  width: 1216,
  height: 896,
  sha256: '37a224e222d093a70cd4c776674223a31f434bd7462ac68d249942c949866ef4',
})

export const CAT_MOTION_CELL = Object.freeze({ width: 608, height: 448 })
export const CAT_MOTION_FLOOR_PIVOT = Object.freeze({ x: 256, y: 400 })

const frame = (name, x, y) => Object.freeze({
  frame: name,
  rect: Object.freeze({
    x,
    y,
    width: CAT_MOTION_CELL.width,
    height: CAT_MOTION_CELL.height,
  }),
  pivot: CAT_MOTION_FLOOR_PIVOT,
  canonicalPose: 'seated',
})

/**
 * Supplemental source-locked motion frames. The three approved originals and
 * the eight direct poses remain untouched. Blink edits are confined to the eye
 * masks recorded below; tail frames partition the approved seated pixels.
 */
export const CAT_MOTION_FRAMES = Object.freeze({
  'blink-half': frame('blink-half', 0, 0),
  'blink-closed': frame('blink-closed', 608, 0),
  'tail-body': frame('tail-body', 0, 448),
  'tail-part': frame('tail-part', 608, 448),
})

export const CAT_BLINK_SEQUENCE = Object.freeze([
  'blink-half',
  'blink-closed',
  'blink-closed',
  'blink-half',
])

export const CAT_TAIL_MOTION = Object.freeze({
  bodyFrame: 'tail-body',
  partFrame: 'tail-part',
  partPivot: Object.freeze({ x: 345, y: 353 }),
  angles: Object.freeze([0, -2, -4, 4, 2, 0]),
})

export const CAT_MOTION_PROVENANCE = Object.freeze({
  source: 'direct.cat',
  sourceRect: Object.freeze({ x: 75, y: 116, width: 267, height: 342 }),
  sourcePivot: Object.freeze({ x: 95, y: 333 }),
  generator: 'scripts/build-cat-micro-motion.sh',
  blink: Object.freeze({
    operation: 'source-brow-pixels-plus-bounded-eyelid-raster',
    changedRegion: Object.freeze({ x: 46, y: 74, width: 105, height: 37 }),
  }),
  tail: Object.freeze({
    operation: 'binary-source-pixel-partition',
    neutralCompositePixelDifference: 0,
    sourcePartPivot: Object.freeze({ x: 184, y: 286 }),
    maskPolygon: Object.freeze([
      Object.freeze([184, 270]),
      Object.freeze([194, 242]),
      Object.freeze([205, 215]),
      Object.freeze([225, 187]),
      Object.freeze([260, 184]),
      Object.freeze([266, 194]),
      Object.freeze([266, 341]),
      Object.freeze([184, 341]),
    ]),
  }),
})

export const CAT_MOTION_MANIFEST = Object.freeze({
  version: CAT_MOTION_ART_VERSION,
  source: 'approved-source-locked-supplement',
  file: CAT_MOTION_ART_FILE,
  cell: CAT_MOTION_CELL,
  floorPivot: CAT_MOTION_FLOOR_PIVOT,
  frames: CAT_MOTION_FRAMES,
  blink: CAT_BLINK_SEQUENCE,
  tail: CAT_TAIL_MOTION,
  provenance: CAT_MOTION_PROVENANCE,
})

export default CAT_MOTION_MANIFEST
