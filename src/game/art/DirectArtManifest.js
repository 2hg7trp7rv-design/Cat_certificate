export const DIRECT_ART_VERSION = '2026-08-20-direct-v1'

export const DIRECT_ART_FILES = Object.freeze({
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

const pose = (frame, x, y, width, height, pivotX, pivotY) => Object.freeze({
  frame,
  rect: Object.freeze({ x, y, width, height }),
  pivot: Object.freeze({ x: pivotX, y: pivotY }),
})

/**
 * The sheet is divided only through its existing transparent gutters. No cat
 * pixel is redrawn or regenerated. Pivots identify the floor contact point in
 * each original cell so differently shaped poses do not jump vertically.
 */
export const DIRECT_CAT_POSES = Object.freeze({
  seated: pose('seated', 75, 116, 267, 342, 95, 333),
  standing: pose('standing', 346, 93, 411, 363, 214, 351),
  walking: pose('walking', 763, 93, 410, 365, 217, 357),
  loaf: pose('loaf', 1224, 252, 269, 222, 136, 204),
  'side-lie': pose('side-lie', 13, 665, 471, 220, 237, 190),
  curl: pose('curl', 487, 650, 287, 231, 151, 216),
  crouch: pose('crouch', 783, 506, 312, 381, 147, 366),
  pounce: pose('pounce', 1111, 500, 397, 370, 93, 356),
})

export const DIRECT_CAT_STATE_MAP = Object.freeze({
  idle: Object.freeze(['seated']),
  blink: Object.freeze(['seated']),
  ear: Object.freeze(['seated']),
  look: Object.freeze(['seated']),
  tail: Object.freeze(['seated']),
  stand: Object.freeze(['standing']),
  sit: Object.freeze(['standing', 'standing', 'seated', 'seated', 'seated', 'seated']),
  loaf: Object.freeze(['loaf']),
  lie: Object.freeze(['side-lie']),
  walk: Object.freeze(['standing', 'walking']),
  turn: Object.freeze(['standing', 'walking', 'walking', 'standing', 'standing']),
  'sleep-curl-transition': Object.freeze([
    'loaf',
    'loaf',
    'side-lie',
    'side-lie',
    'curl',
    'curl',
    'curl',
    'curl',
  ]),
  'sleep-curl': Object.freeze(['curl']),
  'sleep-side-transition': Object.freeze([
    'loaf',
    'loaf',
    'curl',
    'curl',
    'side-lie',
    'side-lie',
    'side-lie',
  ]),
  'sleep-side': Object.freeze(['side-lie']),
  'play-notice': Object.freeze(['loaf', 'loaf', 'crouch', 'crouch']),
  'play-crouch': Object.freeze(['crouch']),
  'play-pounce': Object.freeze(['pounce']),
  'play-catch': Object.freeze(['crouch']),
  'play-recover': Object.freeze([
    'pounce',
    'pounce',
    'crouch',
    'crouch',
    'standing',
    'standing',
  ]),
  welcome: Object.freeze(['seated', 'standing', 'standing', 'seated', 'seated']),
})

export const DIRECT_ROOM_FRAMES = Object.freeze({
  // A neighboring section of the same floor, shown only while the cat covers
  // the ball during its catch pose. The approved room file itself is unchanged.
  'toy-floor-cover': Object.freeze({
    frame: 'toy-floor-cover',
    rect: Object.freeze({ x: 271, y: 1457, width: 92, height: 92 }),
  }),
  'bed-foreground': Object.freeze({
    frame: 'bed-foreground',
    rect: Object.freeze({ x: 620, y: 1075, width: 232, height: 145 }),
  }),
})

const petRegion = (x, y, width, height) => Object.freeze({ x, y, width, height })

/**
 * Source-oriented regions relative to each pose's floor pivot. Right-facing
 * sprites mirror these x coordinates in PettingInput. Keeping the regions per
 * approved drawing prevents a curled or reclining cat from using the seated
 * cat's head and tail locations.
 */
export const DIRECT_CAT_PET_ZONES = Object.freeze({
  seated: Object.freeze({
    head: petRegion(-80, -333, 165, 190),
    tail: petRegion(55, -140, 117, 145),
    back: petRegion(-64, -205, 144, 110),
  }),
  standing: Object.freeze({
    head: petRegion(-214, -350, 150, 205),
    tail: petRegion(82, -351, 115, 184),
    back: petRegion(-78, -236, 180, 125),
  }),
  walking: Object.freeze({
    head: petRegion(-217, -354, 150, 205),
    tail: petRegion(92, -357, 101, 185),
    back: petRegion(-82, -238, 188, 128),
  }),
  loaf: Object.freeze({
    head: petRegion(-136, -204, 130, 165),
    tail: petRegion(52, -158, 81, 160),
    back: petRegion(-30, -145, 112, 105),
  }),
  'side-lie': Object.freeze({
    head: petRegion(-237, -190, 145, 160),
    tail: petRegion(94, -116, 140, 140),
    back: petRegion(-98, -132, 215, 105),
  }),
  curl: Object.freeze({
    head: petRegion(-151, -204, 130, 160),
    tail: petRegion(20, -174, 116, 175),
    back: petRegion(-42, -132, 112, 105),
  }),
  crouch: Object.freeze({
    head: petRegion(-147, -214, 145, 180),
    tail: petRegion(66, -366, 99, 255),
    back: petRegion(-30, -175, 155, 125),
  }),
  pounce: Object.freeze({
    head: petRegion(-93, -215, 150, 185),
    tail: petRegion(96, -356, 208, 215),
    back: petRegion(48, -180, 185, 120),
  }),
})

export const DIRECT_CAT_PROP_ANCHORS = Object.freeze({
  crouch: Object.freeze({
    caughtToy: Object.freeze({ x: -104, y: -8 }),
  }),
})

export const DIRECT_DERIVED_TEXTURES = Object.freeze({
  caughtToy: Object.freeze({
    key: 'direct.toy-ball',
    source: DIRECT_ART_FILES.room.key,
    crop: Object.freeze({ x: 510, y: 1444, width: 88, height: 94 }),
    mask: Object.freeze({
      polygon: Object.freeze([
        Object.freeze([30, 15]),
        Object.freeze([58, 15]),
        Object.freeze([68, 20]),
        Object.freeze([72, 26]),
        Object.freeze([76, 35]),
        Object.freeze([78, 43]),
        Object.freeze([78, 63]),
        Object.freeze([73, 70]),
        Object.freeze([66, 77]),
        Object.freeze([57, 81]),
        Object.freeze([30, 81]),
        Object.freeze([20, 77]),
        Object.freeze([13, 70]),
        Object.freeze([8, 63]),
        Object.freeze([8, 43]),
        Object.freeze([12, 35]),
        Object.freeze([16, 27]),
        Object.freeze([22, 21]),
      ]),
    }),
  }),
  bedForeground: Object.freeze({
    key: 'direct.bed-foreground',
    source: DIRECT_ART_FILES.room.key,
    crop: DIRECT_ROOM_FRAMES['bed-foreground'].rect,
    mask: Object.freeze({
      polygon: Object.freeze([
        Object.freeze([7, 25]),
        Object.freeze([42, 51]),
        Object.freeze([85, 66]),
        Object.freeze([143, 67]),
        Object.freeze([195, 51]),
        Object.freeze([231, 22]),
        Object.freeze([232, 123]),
        Object.freeze([204, 142]),
        Object.freeze([60, 144]),
        Object.freeze([20, 115]),
      ]),
    }),
  }),
})

export const resolveDirectCatPose = (state = 'idle', frame = 0) => {
  const sequence = DIRECT_CAT_STATE_MAP[state] ?? DIRECT_CAT_STATE_MAP.idle
  const index = Math.max(0, Math.floor(Number(frame) || 0)) % sequence.length
  return sequence[index]
}

export const DIRECT_ART_MANIFEST = Object.freeze({
  version: DIRECT_ART_VERSION,
  source: 'user-approved-original-files',
  files: DIRECT_ART_FILES,
  room: Object.freeze({
    width: DIRECT_ART_FILES.room.width,
    height: DIRECT_ART_FILES.room.height,
    fit: 'cover',
    frames: DIRECT_ROOM_FRAMES,
  }),
  cat: Object.freeze({
    sheet: DIRECT_ART_FILES.cat.key,
    poseCount: Object.keys(DIRECT_CAT_POSES).length,
    poses: DIRECT_CAT_POSES,
    stateMap: DIRECT_CAT_STATE_MAP,
    propAnchors: DIRECT_CAT_PROP_ANCHORS,
  }),
  derived: DIRECT_DERIVED_TEXTURES,
})

export default DIRECT_ART_MANIFEST
