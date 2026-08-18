const ART_GRID = 8
const WORLD_WIDTH = 216
const WORLD_HEIGHT = 472
const CAT_CANVAS = 96
const CAT_FOOT_Y = 88

export const PIXEL_PALETTE = Object.freeze({
  ink: '#2b211c',
  cocoa: '#49352b',
  walnutDark: '#62422f',
  walnut: '#8c5e3e',
  walnutLight: '#bd8759',
  creamDark: '#c9aa7b',
  cream: '#f5e6c8',
  creamLight: '#fff2d2',
  terracottaDark: '#914a39',
  terracotta: '#c87352',
  terracottaLight: '#e6a078',
  sageDark: '#49675c',
  sage: '#789279',
  sageLight: '#a9b797',
  tealDark: '#31534f',
  teal: '#517a72',
  tealLight: '#8fb0a4',
  amberDark: '#a96e35',
  amber: '#e2b45c',
  amberLight: '#ffe099',
  nightDark: '#172638',
  night: '#26374b',
  nightLight: '#49617a',
  furOutline: '#4b3025',
  furShadow: '#c69462',
  fur: '#f0d5a7',
  furLight: '#ffe9bd',
  gingerDark: '#8e4e32',
  ginger: '#c8753f',
  gingerLight: '#e79b58',
  pinkDark: '#8f5553',
  pink: '#d8877e',
  eyeDark: '#243529',
  eye: '#567a55',
  eyeLight: '#b9cf83',
})

const CAT_STATE_COUNTS = Object.freeze({
  idle: 4,
  blink: 4,
  ear: 3,
  look: 5,
  tail: 6,
  stand: 6,
  sit: 6,
  loaf: 4,
  lie: 8,
  walk: 6,
  turn: 5,
  'sleep-curl-transition': 8,
  'sleep-curl': 4,
  'sleep-side-transition': 7,
  'sleep-side': 4,
  'play-notice': 4,
  'play-crouch': 6,
  'play-pounce': 6,
  'play-catch': 6,
  'play-recover': 6,
  welcome: 5,
})

function textureSpec(key, width, height, category, depthHint, extra = {}) {
  return Object.freeze({
    key,
    width,
    height,
    category,
    depthHint,
    temporary: false,
    pixelArt: true,
    scaleMode: 'nearest',
    ...extra,
  })
}

function catStateSpec(state, frameCount) {
  const frames = Object.freeze(Array.from({ length: frameCount }, (_, frame) => textureSpec(
    `pixel.cat.${state}.${frame}`,
    CAT_CANVAS,
    CAT_CANVAS,
    'cat',
    70,
    {
      state,
      frame,
      pivot: Object.freeze({ x: CAT_CANVAS / 2, y: CAT_FOOT_Y }),
      footY: CAT_FOOT_Y,
    },
  )))

  return Object.freeze({
    state,
    frameCount,
    keyPrefix: `pixel.cat.${state}`,
    canvas: Object.freeze({ width: CAT_CANVAS, height: CAT_CANVAS }),
    pivot: Object.freeze({ x: CAT_CANVAS / 2, y: CAT_FOOT_Y }),
    footY: CAT_FOOT_Y,
    frames,
  })
}

const CAT_STATES = Object.freeze(Object.fromEntries(
  Object.entries(CAT_STATE_COUNTS).map(([state, count]) => [state, catStateSpec(state, count)]),
))

export const PIXEL_TEXTURE_MANIFEST = Object.freeze({
  version: 2,
  temporary: false,
  artDirection: 'warm-retro-pixel',
  grid: ART_GRID,
  world: Object.freeze({ width: WORLD_WIDTH, height: WORLD_HEIGHT, preferredScale: 2 }),
  palette: PIXEL_PALETTE,
  room: Object.freeze({
    backdrop: textureSpec('pixel.room.backdrop', WORLD_WIDTH, WORLD_HEIGHT, 'room', 0, {
      anchor: Object.freeze({ x: 0.5, y: 0.5 }),
    }),
    exterior: textureSpec('pixel.room.exterior', 104, 120, 'room', 5),
    window: textureSpec('pixel.room.window', 112, 136, 'room', 10),
  }),
  furniture: Object.freeze({
    curtain: textureSpec('pixel.furniture.curtain', 48, 144, 'furniture', 20, { mirrorable: true }),
    rug: textureSpec('pixel.furniture.rug', 144, 64, 'furniture', 30),
    sofa: textureSpec('pixel.furniture.sofa', 112, 88, 'furniture', 40),
    tower: textureSpec('pixel.furniture.tower', 56, 152, 'furniture', 45),
    bed: textureSpec('pixel.furniture.bed', 80, 48, 'furniture', 50),
    bowl: textureSpec('pixel.furniture.bowl', 40, 24, 'furniture', 55),
    toy: textureSpec('pixel.furniture.toy', 48, 24, 'furniture', 58),
    lamp: textureSpec('pixel.furniture.lamp', 40, 112, 'furniture', 42),
    plant: textureSpec('pixel.furniture.plant', 48, 72, 'furniture', 43),
    shelf: textureSpec('pixel.furniture.shelf', 88, 80, 'furniture', 35),
  }),
  shadows: Object.freeze({
    catContact: textureSpec('pixel.shadow.cat-contact', 80, 24, 'shadow', 65, {
      blendModeHint: 'multiply',
    }),
    furnitureContact: textureSpec('pixel.shadow.furniture-contact', 144, 24, 'shadow', 25, {
      blendModeHint: 'multiply',
    }),
  }),
  lights: Object.freeze({
    windowDay: textureSpec('pixel.light.window-day', 160, 248, 'light-mask', 90, {
      blendModeHint: 'screen',
      smoothingAllowed: true,
      scaleMode: 'linear',
    }),
    lampGlow: textureSpec('pixel.light.lamp-glow', 128, 128, 'light-mask', 91, {
      blendModeHint: 'screen',
      smoothingAllowed: true,
      scaleMode: 'linear',
    }),
    nightWash: textureSpec('pixel.light.night-wash', WORLD_WIDTH, WORLD_HEIGHT, 'light-mask', 89, {
      blendModeHint: 'multiply',
      smoothingAllowed: true,
      scaleMode: 'linear',
    }),
  }),
  cat: Object.freeze({
    canvas: Object.freeze({ width: CAT_CANVAS, height: CAT_CANVAS }),
    pivot: Object.freeze({ x: CAT_CANVAS / 2, y: CAT_FOOT_Y }),
    footY: CAT_FOOT_Y,
    states: CAT_STATES,
  }),
})

function rect(context, x, y, width, height, color) {
  context.fillStyle = color
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}

function polygon(context, points, color) {
  if (!points.length) return
  context.fillStyle = color
  context.beginPath()
  context.moveTo(Math.round(points[0][0]), Math.round(points[0][1]))
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(Math.round(points[index][0]), Math.round(points[index][1]))
  }
  context.closePath()
  context.fill()
}

function pixelEllipse(context, centerX, centerY, radiusX, radiusY, color, step = 2) {
  const rx = Math.max(step, Math.round(radiusX))
  const ry = Math.max(step, Math.round(radiusY))
  const yStart = -Math.floor(ry / step) * step

  for (let offsetY = yStart; offsetY <= ry; offsetY += step) {
    const normalized = Math.min(1, Math.abs(offsetY) / ry)
    const rawHalf = rx * Math.sqrt(Math.max(0, 1 - normalized * normalized))
    const half = Math.max(step, Math.floor(rawHalf / step) * step)
    rect(context, centerX - half, centerY + offsetY, half * 2, step, color)
  }
}

function pixelLine(context, x0, y0, x1, y1, thickness, color) {
  let x = Math.round(x0)
  let y = Math.round(y0)
  const endX = Math.round(x1)
  const endY = Math.round(y1)
  const deltaX = Math.abs(endX - x)
  const deltaY = Math.abs(endY - y)
  const stepX = x < endX ? 1 : -1
  const stepY = y < endY ? 1 : -1
  let error = deltaX - deltaY
  const size = Math.max(1, Math.round(thickness))

  while (true) {
    rect(context, x - Math.floor(size / 2), y - Math.floor(size / 2), size, size, color)
    if (x === endX && y === endY) break
    const doubled = error * 2
    if (doubled > -deltaY) {
      error -= deltaY
      x += stepX
    }
    if (doubled < deltaX) {
      error += deltaX
      y += stepY
    }
  }
}

function pixelPolyline(context, points, thickness, color) {
  for (let index = 1; index < points.length; index += 1) {
    pixelLine(context, points[index - 1][0], points[index - 1][1], points[index][0], points[index][1], thickness, color)
  }
}

function steppedTriangle(context, centerX, topY, bottomY, halfBase, color, step = 2) {
  const height = Math.max(step, bottomY - topY)
  for (let y = topY; y < bottomY; y += step) {
    const progress = (y - topY + step) / height
    const half = Math.max(step, Math.floor((halfBase * progress) / step) * step)
    rect(context, centerX - half, y, half * 2, step, color)
  }
}

function checker(context, x, y, width, height, cell, first, second) {
  for (let row = 0; row < height / cell; row += 1) {
    for (let column = 0; column < width / cell; column += 1) {
      rect(context, x + column * cell, y + row * cell, cell, cell, (row + column) % 2 ? second : first)
    }
  }
}

function drawRoomBackdrop(context, width, height) {
  const floorY = 304
  rect(context, 0, 0, width, floorY, PIXEL_PALETTE.cream)
  rect(context, 0, 0, 8, floorY, '#dec89f')
  rect(context, width - 8, 0, 8, floorY, '#d7be93')

  for (let y = 24; y < floorY - 24; y += 24) {
    for (let x = 16 + ((y / 24) % 2) * 8; x < width - 12; x += 32) {
      rect(context, x, y, 2, 2, '#dec9a5')
      rect(context, x + 4, y + 4, 2, 2, '#ead7b6')
    }
  }

  rect(context, 0, 288, width, 8, PIXEL_PALETTE.walnutDark)
  rect(context, 0, 296, width, 8, PIXEL_PALETTE.walnutLight)
  rect(context, 0, 304, width, 8, '#5f402e')
  rect(context, 0, 312, width, height - 312, '#9b6946')

  const plankColors = ['#a9734b', '#b47d52', '#9f6b47', '#ad754d']
  for (let row = 0, y = 312; y < height; row += 1, y += 16) {
    rect(context, 0, y, width, 14, plankColors[row % plankColors.length])
    rect(context, 0, y + 14, width, 2, '#704a35')
    const offset = row % 2 ? 24 : 0
    for (let x = offset; x < width; x += 48) {
      rect(context, x, y, 2, 14, '#80563b')
      rect(context, x + 4, y + 3, 12, 2, '#bd8759')
    }
  }

  rect(context, 0, height - 16, width, 16, '#754b35')
  rect(context, 0, height - 16, width, 2, '#c08a5b')
  for (let x = 16; x < width; x += 40) rect(context, x, height - 11, 16, 2, '#85583d')
}

function drawExterior(context, width, height) {
  rect(context, 0, 0, width, height, '#8fb8b3')
  rect(context, 0, 0, width, 24, '#6f9fa4')
  rect(context, 0, 24, width, 24, '#8fb8b3')
  rect(context, 0, 48, width, 24, '#b8cbc0')

  rect(context, 12, 18, 24, 6, '#eef0d7')
  rect(context, 18, 14, 12, 4, '#eef0d7')
  rect(context, 62, 34, 30, 6, '#e8ecd4')
  rect(context, 70, 30, 14, 4, '#e8ecd4')

  polygon(context, [[0, 78], [0, 68], [16, 58], [28, 68], [44, 54], [58, 68], [76, 50], [104, 70], [104, 78]], PIXEL_PALETTE.sage)
  polygon(context, [[0, 88], [0, 74], [18, 66], [34, 78], [52, 62], [70, 78], [86, 66], [104, 74], [104, 88]], PIXEL_PALETTE.sageDark)

  rect(context, 0, 86, width, 34, '#6f806c')
  for (let x = 0; x < width; x += 16) {
    const houseHeight = x % 32 === 0 ? 18 : 14
    rect(context, x + 2, 102 - houseHeight, 14, houseHeight, x % 32 === 0 ? '#c7926a' : '#d4ae7b')
    polygon(context, [[x, 102 - houseHeight], [x + 8, 96 - houseHeight], [x + 18, 102 - houseHeight]], '#704a3c')
    rect(context, x + 6, 94, 4, 8, '#4a625d')
  }
  rect(context, 0, 106, width, 14, '#52695d')
  for (let x = 4; x < width; x += 12) rect(context, x, 110 + (x % 3), 4, 4, '#789279')
}

function drawWindow(context, width, height) {
  context.clearRect(0, 0, width, height)
  rect(context, 4, 4, width - 8, 8, PIXEL_PALETTE.walnutDark)
  rect(context, 0, 12, 8, height - 24, PIXEL_PALETTE.walnutDark)
  rect(context, width - 8, 12, 8, height - 24, PIXEL_PALETTE.walnutDark)
  rect(context, 8, 12, 4, height - 24, PIXEL_PALETTE.walnutLight)
  rect(context, width - 12, 12, 4, height - 24, PIXEL_PALETTE.walnut)
  rect(context, width / 2 - 3, 12, 6, height - 28, '#a8704b')
  rect(context, 8, 70, width - 16, 6, '#a8704b')
  rect(context, 4, height - 16, width - 8, 12, PIXEL_PALETTE.walnutDark)
  rect(context, 0, height - 12, width, 8, PIXEL_PALETTE.walnutLight)
  rect(context, 8, height - 4, width - 16, 4, '#60402e')
  rect(context, 16, 20, 2, 42, 'rgba(255,255,235,0.55)')
  rect(context, 20, 20, 2, 26, 'rgba(255,255,235,0.28)')
}

function drawCurtain(context, width, height) {
  context.clearRect(0, 0, width, height)
  rect(context, 4, 0, width - 8, 6, PIXEL_PALETTE.walnutDark)
  rect(context, 0, 6, width, 6, PIXEL_PALETTE.amber)
  rect(context, 4, 12, width - 8, 120, PIXEL_PALETTE.teal)
  rect(context, 0, 20, 8, 104, PIXEL_PALETTE.tealDark)
  rect(context, 12, 12, 8, 116, PIXEL_PALETTE.tealLight)
  rect(context, 24, 12, 8, 120, PIXEL_PALETTE.sageDark)
  rect(context, 36, 18, 8, 108, PIXEL_PALETTE.tealLight)
  rect(context, 4, 126, 8, 10, PIXEL_PALETTE.tealDark)
  rect(context, 12, 128, 8, 12, PIXEL_PALETTE.teal)
  rect(context, 20, 126, 8, 14, PIXEL_PALETTE.sageDark)
  rect(context, 28, 130, 8, 10, PIXEL_PALETTE.teal)
  rect(context, 36, 126, 8, 10, PIXEL_PALETTE.tealDark)
  for (let y = 32; y < 120; y += 24) {
    rect(context, 14, y, 4, 4, '#bed0b7')
    rect(context, 38, y + 8, 4, 4, '#bed0b7')
  }
}

function drawRug(context, width, height) {
  context.clearRect(0, 0, width, height)
  pixelEllipse(context, width / 2, 34, 68, 28, PIXEL_PALETTE.cocoa, 4)
  pixelEllipse(context, width / 2, 30, 64, 26, PIXEL_PALETTE.terracottaDark, 4)
  pixelEllipse(context, width / 2, 30, 56, 22, PIXEL_PALETTE.terracotta, 4)
  pixelEllipse(context, width / 2, 30, 44, 16, '#d9956d', 4)
  rect(context, 46, 26, 52, 4, PIXEL_PALETTE.cream)
  rect(context, 54, 18, 36, 4, PIXEL_PALETTE.creamDark)
  rect(context, 54, 34, 36, 4, PIXEL_PALETTE.creamDark)
  for (let x = 14; x < width - 14; x += 12) rect(context, x, 56 + (x % 24 ? 0 : 2), 6, 4, PIXEL_PALETTE.creamDark)
}

function drawSofa(context, width, height) {
  context.clearRect(0, 0, width, height)
  rect(context, 12, 14, 88, 54, PIXEL_PALETTE.cocoa)
  rect(context, 16, 10, 80, 50, PIXEL_PALETTE.sageDark)
  rect(context, 20, 14, 72, 40, PIXEL_PALETTE.sage)
  rect(context, 24, 18, 64, 4, PIXEL_PALETTE.sageLight)
  rect(context, 8, 42, 96, 32, PIXEL_PALETTE.tealDark)
  rect(context, 12, 38, 88, 28, PIXEL_PALETTE.teal)
  rect(context, 16, 42, 38, 18, PIXEL_PALETTE.tealLight)
  rect(context, 58, 42, 38, 18, '#73948a')
  rect(context, 8, 34, 12, 34, PIXEL_PALETTE.sageDark)
  rect(context, 92, 34, 12, 34, PIXEL_PALETTE.sageDark)
  rect(context, 16, 66, 12, 14, PIXEL_PALETTE.walnutDark)
  rect(context, 84, 66, 12, 14, PIXEL_PALETTE.walnutDark)
  rect(context, 12, 80, 88, 4, 'rgba(43,33,28,0.35)')
  rect(context, 22, 27, 6, 6, PIXEL_PALETTE.amber)
  rect(context, 84, 27, 6, 6, PIXEL_PALETTE.amber)
}

function drawTower(context, width, height) {
  context.clearRect(0, 0, width, height)
  rect(context, 4, 142, 48, 8, PIXEL_PALETTE.walnutDark)
  rect(context, 8, 136, 40, 8, PIXEL_PALETTE.walnut)
  rect(context, 12, 60, 10, 78, PIXEL_PALETTE.creamDark)
  rect(context, 14, 62, 4, 72, '#ae865f')
  rect(context, 36, 22, 10, 116, PIXEL_PALETTE.creamDark)
  rect(context, 38, 24, 4, 110, '#ae865f')
  for (let y = 68; y < 132; y += 10) {
    rect(context, 12, y, 10, 2, PIXEL_PALETTE.walnut)
    rect(context, 36, y + 4, 10, 2, PIXEL_PALETTE.walnut)
  }
  rect(context, 2, 54, 34, 8, PIXEL_PALETTE.walnutDark)
  rect(context, 0, 48, 38, 8, PIXEL_PALETTE.walnutLight)
  rect(context, 26, 18, 28, 8, PIXEL_PALETTE.walnutDark)
  rect(context, 24, 12, 32, 8, PIXEL_PALETTE.walnutLight)
  rect(context, 22, 94, 34, 8, PIXEL_PALETTE.walnutDark)
  rect(context, 20, 88, 36, 8, PIXEL_PALETTE.walnutLight)
  rect(context, 4, 12, 24, 30, PIXEL_PALETTE.terracottaDark)
  rect(context, 8, 16, 20, 22, PIXEL_PALETTE.terracotta)
  rect(context, 12, 20, 16, 4, PIXEL_PALETTE.terracottaLight)
}

function drawBed(context, width, height) {
  context.clearRect(0, 0, width, height)
  pixelEllipse(context, 40, 29, 38, 17, PIXEL_PALETTE.cocoa, 2)
  pixelEllipse(context, 40, 25, 36, 17, PIXEL_PALETTE.terracottaDark, 2)
  pixelEllipse(context, 40, 23, 30, 12, PIXEL_PALETTE.terracotta, 2)
  pixelEllipse(context, 40, 22, 23, 8, '#e1b394', 2)
  rect(context, 18, 17, 8, 3, PIXEL_PALETTE.creamLight)
  rect(context, 54, 31, 8, 3, PIXEL_PALETTE.creamDark)
  rect(context, 12, 38, 56, 4, '#6d4536')
}

function drawBowl(context, width, height) {
  context.clearRect(0, 0, width, height)
  rect(context, 4, 18, 32, 4, 'rgba(43,33,28,0.35)')
  rect(context, 6, 6, 28, 6, PIXEL_PALETTE.tealLight)
  rect(context, 4, 10, 32, 4, PIXEL_PALETTE.tealDark)
  rect(context, 8, 14, 24, 6, PIXEL_PALETTE.teal)
  rect(context, 12, 16, 16, 4, PIXEL_PALETTE.tealLight)
  rect(context, 10, 7, 20, 3, '#6f4f39')
  rect(context, 15, 7, 3, 3, PIXEL_PALETTE.amber)
  rect(context, 23, 7, 3, 3, PIXEL_PALETTE.amber)
}

function drawToy(context, width, height) {
  context.clearRect(0, 0, width, height)
  pixelLine(context, 3, 5, 18, 8, 2, PIXEL_PALETTE.cocoa)
  pixelLine(context, 18, 8, 29, 16, 2, PIXEL_PALETTE.cocoa)
  pixelEllipse(context, 34, 17, 8, 7, PIXEL_PALETTE.gingerDark, 2)
  pixelEllipse(context, 34, 15, 6, 6, PIXEL_PALETTE.terracotta, 2)
  rect(context, 30, 11, 4, 3, PIXEL_PALETTE.terracottaLight)
  polygon(context, [[39, 13], [47, 9], [44, 18]], PIXEL_PALETTE.amber)
  rect(context, 42, 11, 3, 3, PIXEL_PALETTE.amberLight)
}

function drawLamp(context, width, height) {
  context.clearRect(0, 0, width, height)
  rect(context, 18, 30, 4, 70, PIXEL_PALETTE.walnutDark)
  rect(context, 22, 34, 3, 64, PIXEL_PALETTE.walnutLight)
  rect(context, 8, 100, 24, 6, PIXEL_PALETTE.walnutDark)
  rect(context, 12, 96, 16, 5, PIXEL_PALETTE.walnut)
  polygon(context, [[8, 6], [32, 6], [38, 34], [2, 34]], PIXEL_PALETTE.terracottaDark)
  polygon(context, [[10, 8], [30, 8], [34, 30], [6, 30]], PIXEL_PALETTE.amber)
  rect(context, 10, 10, 4, 16, PIXEL_PALETTE.amberLight)
  rect(context, 8, 32, 24, 4, PIXEL_PALETTE.terracottaLight)
}

function drawPlant(context, width, height) {
  context.clearRect(0, 0, width, height)
  pixelLine(context, 24, 20, 24, 46, 3, PIXEL_PALETTE.sageDark)
  pixelLine(context, 23, 28, 10, 18, 3, PIXEL_PALETTE.sageDark)
  pixelLine(context, 25, 34, 39, 22, 3, PIXEL_PALETTE.sageDark)
  pixelEllipse(context, 10, 16, 9, 6, PIXEL_PALETTE.sageDark, 2)
  pixelEllipse(context, 11, 13, 7, 5, PIXEL_PALETTE.sage, 2)
  pixelEllipse(context, 39, 19, 8, 7, PIXEL_PALETTE.tealDark, 2)
  pixelEllipse(context, 38, 16, 6, 5, PIXEL_PALETTE.sageLight, 2)
  pixelEllipse(context, 24, 8, 8, 8, PIXEL_PALETTE.sageDark, 2)
  pixelEllipse(context, 24, 6, 6, 6, PIXEL_PALETTE.sage, 2)
  rect(context, 10, 44, 28, 6, PIXEL_PALETTE.terracottaDark)
  polygon(context, [[12, 50], [36, 50], [32, 68], [16, 68]], PIXEL_PALETTE.terracotta)
  rect(context, 16, 52, 4, 12, PIXEL_PALETTE.terracottaLight)
  rect(context, 14, 68, 20, 4, PIXEL_PALETTE.cocoa)
}

function drawShelf(context, width, height) {
  context.clearRect(0, 0, width, height)
  rect(context, 4, 8, 80, 6, PIXEL_PALETTE.walnutDark)
  rect(context, 8, 14, 72, 52, PIXEL_PALETTE.walnut)
  rect(context, 12, 18, 64, 20, '#7a5038')
  rect(context, 12, 42, 64, 20, '#7a5038')
  rect(context, 40, 14, 4, 52, PIXEL_PALETTE.walnutLight)
  rect(context, 4, 66, 80, 8, PIXEL_PALETTE.walnutDark)
  rect(context, 8, 74, 6, 6, '#5b3c2d')
  rect(context, 74, 74, 6, 6, '#5b3c2d')
  const bookColors = [PIXEL_PALETTE.teal, PIXEL_PALETTE.terracotta, PIXEL_PALETTE.amber, PIXEL_PALETTE.sage]
  for (let index = 0; index < 4; index += 1) rect(context, 16 + index * 6, 23 - (index % 2) * 3, 5, 14 + (index % 2) * 3, bookColors[index])
  rect(context, 49, 22, 20, 14, PIXEL_PALETTE.creamDark)
  rect(context, 52, 24, 14, 8, '#7ba1a0')
  rect(context, 18, 48, 10, 12, PIXEL_PALETTE.terracotta)
  rect(context, 20, 44, 6, 4, PIXEL_PALETTE.sage)
  rect(context, 48, 50, 18, 8, PIXEL_PALETTE.cream)
  rect(context, 52, 46, 10, 4, PIXEL_PALETTE.amber)
}

function drawContactShadow(context, width, height, alpha) {
  context.clearRect(0, 0, width, height)
  const colorStrong = `rgba(43,33,28,${alpha})`
  const colorMedium = `rgba(43,33,28,${alpha * 0.62})`
  const colorSoft = `rgba(43,33,28,${alpha * 0.3})`
  rect(context, width * 0.2, 8, width * 0.6, 8, colorStrong)
  rect(context, width * 0.12, 10, width * 0.76, 6, colorMedium)
  rect(context, width * 0.04, 12, width * 0.92, 4, colorSoft)
}

function drawWindowLight(context, width, height) {
  context.clearRect(0, 0, width, height)
  const gradient = context.createLinearGradient(width / 2, 0, width / 2, height)
  gradient.addColorStop(0, 'rgba(255,239,188,0.42)')
  gradient.addColorStop(0.55, 'rgba(255,211,139,0.18)')
  gradient.addColorStop(1, 'rgba(255,191,104,0)')
  polygon(context, [[38, 0], [114, 0], [160, 248], [0, 248]], gradient)
}

function drawLampGlow(context, width, height) {
  context.clearRect(0, 0, width, height)
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,222,151,0.58)')
  gradient.addColorStop(0.35, 'rgba(255,188,91,0.25)')
  gradient.addColorStop(1, 'rgba(255,166,75,0)')
  rect(context, 0, 0, width, height, gradient)
}

function drawNightWash(context, width, height) {
  context.clearRect(0, 0, width, height)
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, 'rgba(20,37,58,0.46)')
  gradient.addColorStop(0.58, 'rgba(34,45,68,0.39)')
  gradient.addColorStop(1, 'rgba(12,23,41,0.58)')
  rect(context, 0, 0, width, height, gradient)
}

function drawTail(context, variant = 0, crouched = false, direction = 1) {
  const baseX = direction > 0 ? 64 : 32
  const curlX = direction > 0 ? 86 : 10
  const phase = [0, 2, 4, 2, -2, -3][variant % 6]
  const baseY = crouched ? 74 : 70
  const points = direction > 0
    ? [[baseX, baseY], [74, baseY + 7], [84, baseY + phase], [88, baseY - 12 + phase]]
    : [[baseX, baseY], [22, baseY + 7], [12, baseY + phase], [8, baseY - 12 + phase]]
  pixelPolyline(context, points, 11, PIXEL_PALETTE.furOutline)
  pixelPolyline(context, points, 7, PIXEL_PALETTE.ginger)
  pixelLine(context, curlX, baseY - 7 + phase, curlX, baseY - 13 + phase, 7, PIXEL_PALETTE.gingerDark)
  pixelLine(context, direction > 0 ? 77 : 19, baseY + 3, direction > 0 ? 80 : 16, baseY + phase, 2, PIXEL_PALETTE.gingerLight)
}

function drawEars(context, centerX, headY, { leftLift = 0, rightLift = 0, direction = 0 } = {}) {
  const leftX = centerX - 14 + direction
  const rightX = centerX + 14 + direction
  steppedTriangle(context, leftX, headY - 21 - leftLift, headY - 5, 9, PIXEL_PALETTE.furOutline, 2)
  steppedTriangle(context, rightX, headY - 21 - rightLift, headY - 5, 9, PIXEL_PALETTE.furOutline, 2)
  steppedTriangle(context, leftX, headY - 17 - leftLift, headY - 6, 5, PIXEL_PALETTE.ginger, 2)
  steppedTriangle(context, rightX, headY - 17 - rightLift, headY - 6, 5, PIXEL_PALETTE.fur, 2)
  steppedTriangle(context, leftX, headY - 13 - leftLift, headY - 7, 3, PIXEL_PALETTE.pink, 2)
  steppedTriangle(context, rightX, headY - 13 - rightLift, headY - 7, 3, PIXEL_PALETTE.pink, 2)
}

function drawFace(context, centerX, centerY, { eyeMode = 'open', gaze = 0, direction = 0, happy = false } = {}) {
  const leftEyeX = centerX - 9 + direction
  const rightEyeX = centerX + 9 + direction
  const eyeY = centerY - 2

  if (eyeMode === 'closed') {
    rect(context, leftEyeX - 3, eyeY, 6, 2, PIXEL_PALETTE.eyeDark)
    rect(context, rightEyeX - 3, eyeY, 6, 2, PIXEL_PALETTE.eyeDark)
    rect(context, leftEyeX - 2, eyeY + 2, 4, 1, PIXEL_PALETTE.furShadow)
    rect(context, rightEyeX - 2, eyeY + 2, 4, 1, PIXEL_PALETTE.furShadow)
  } else if (eyeMode === 'half') {
    rect(context, leftEyeX - 3, eyeY - 1, 6, 3, PIXEL_PALETTE.eyeDark)
    rect(context, rightEyeX - 3, eyeY - 1, 6, 3, PIXEL_PALETTE.eyeDark)
    rect(context, leftEyeX - 1 + gaze, eyeY, 2, 2, PIXEL_PALETTE.eyeLight)
    rect(context, rightEyeX - 1 + gaze, eyeY, 2, 2, PIXEL_PALETTE.eyeLight)
  } else {
    rect(context, leftEyeX - 3, eyeY - 3, 6, 7, PIXEL_PALETTE.eyeDark)
    rect(context, rightEyeX - 3, eyeY - 3, 6, 7, PIXEL_PALETTE.eyeDark)
    rect(context, leftEyeX - 1 + gaze, eyeY - 2, 2, 5, PIXEL_PALETTE.eye)
    rect(context, rightEyeX - 1 + gaze, eyeY - 2, 2, 5, PIXEL_PALETTE.eye)
    rect(context, leftEyeX + gaze, eyeY - 2, 1, 2, PIXEL_PALETTE.eyeLight)
    rect(context, rightEyeX + gaze, eyeY - 2, 1, 2, PIXEL_PALETTE.eyeLight)
  }

  rect(context, centerX - 2 + direction, centerY + 7, 4, 3, PIXEL_PALETTE.pinkDark)
  rect(context, centerX - 1 + direction, centerY + 7, 2, 1, PIXEL_PALETTE.pink)
  rect(context, centerX, centerY + 10, 1, 3, PIXEL_PALETTE.cocoa)
  rect(context, centerX - (happy ? 5 : 4), centerY + 12, happy ? 5 : 4, 1, PIXEL_PALETTE.cocoa)
  rect(context, centerX + 1, centerY + 12, happy ? 5 : 4, 1, PIXEL_PALETTE.cocoa)

  pixelLine(context, centerX - 9, centerY + 9, centerX - 21, centerY + 7, 1, PIXEL_PALETTE.creamLight)
  pixelLine(context, centerX - 9, centerY + 12, centerX - 22, centerY + 14, 1, PIXEL_PALETTE.creamLight)
  pixelLine(context, centerX + 9, centerY + 9, centerX + 21, centerY + 7, 1, PIXEL_PALETTE.creamLight)
  pixelLine(context, centerX + 9, centerY + 12, centerX + 22, centerY + 14, 1, PIXEL_PALETTE.creamLight)
}

function drawHead(context, centerX, centerY, options = {}) {
  const headY = centerY
  drawEars(context, centerX, headY, options)
  pixelEllipse(context, centerX, headY + 4, 23, 19, PIXEL_PALETTE.furOutline, 2)
  pixelEllipse(context, centerX, headY + 2, 20, 17, PIXEL_PALETTE.fur, 2)
  pixelEllipse(context, centerX - 9, headY + 7, 9, 8, PIXEL_PALETTE.furLight, 2)
  pixelEllipse(context, centerX + 9, headY + 7, 9, 8, PIXEL_PALETTE.furLight, 2)
  rect(context, centerX - 17, headY - 10, 14, 6, PIXEL_PALETTE.ginger)
  rect(context, centerX - 12, headY - 5, 12, 4, PIXEL_PALETTE.ginger)
  rect(context, centerX - 9, headY - 10, 3, 7, PIXEL_PALETTE.gingerLight)
  rect(context, centerX - 2, headY - 14, 3, 8, PIXEL_PALETTE.gingerDark)
  drawFace(context, centerX, headY + 3, options)
}

function drawSeatedCat(context, {
  bob = 0,
  eyeMode = 'open',
  gaze = 0,
  tailVariant = 0,
  leftEar = 0,
  rightEar = 0,
  lean = 0,
  pawUp = 0,
  loaf = false,
  happy = false,
} = {}) {
  drawTail(context, tailVariant)

  if (loaf) {
    pixelEllipse(context, 48, 70 + bob, 30, 17, PIXEL_PALETTE.furOutline, 2)
    pixelEllipse(context, 48, 68 + bob, 27, 14, PIXEL_PALETTE.fur, 2)
    rect(context, 49, 58 + bob, 18, 12, PIXEL_PALETTE.ginger)
    rect(context, 54, 59 + bob, 4, 10, PIXEL_PALETTE.gingerLight)
    rect(context, 28, 80 + bob, 40, 4, PIXEL_PALETTE.furShadow)
  } else {
    pixelEllipse(context, 48, 68 + bob, 25, 23, PIXEL_PALETTE.furOutline, 2)
    pixelEllipse(context, 48, 66 + bob, 22, 21, PIXEL_PALETTE.fur, 2)
    pixelEllipse(context, 34, 72 + bob, 13, 14, PIXEL_PALETTE.furShadow, 2)
    pixelEllipse(context, 62, 72 + bob, 13, 14, PIXEL_PALETTE.ginger, 2)
    rect(context, 57, 56 + bob, 11, 14, PIXEL_PALETTE.ginger)
    rect(context, 61, 57 + bob, 3, 12, PIXEL_PALETTE.gingerLight)
    rect(context, 43, 50 + bob, 10, 29, PIXEL_PALETTE.furLight)
    rect(context, 41, 80 + bob, 8, 7, PIXEL_PALETTE.furLight)
    rect(context, 53, 80 + bob, 8, 7, PIXEL_PALETTE.furLight)
    rect(context, 39, 86, 12, 2, PIXEL_PALETTE.furOutline)
    rect(context, 51, 86, 12, 2, PIXEL_PALETTE.furOutline)
    if (pawUp > 0) {
      pixelLine(context, 42, 63 + bob, 32 - pawUp, 52 + bob, 8, PIXEL_PALETTE.furOutline)
      pixelLine(context, 42, 62 + bob, 33 - pawUp, 53 + bob, 5, PIXEL_PALETTE.furLight)
      rect(context, 27 - pawUp, 48 + bob, 9, 8, PIXEL_PALETTE.furLight)
    }
  }

  drawHead(context, 47 + lean, 35 + bob, {
    eyeMode,
    gaze,
    leftLift: leftEar,
    rightLift: rightEar,
    direction: lean,
    happy,
  })
}

function drawStandingCat(context, {
  direction = 1,
  gait = 0,
  crouch = 0,
  stretch = 0,
  eyeMode = 'open',
  gaze = 0,
  tailVariant = 0,
} = {}) {
  const facing = direction >= 0 ? 1 : -1
  const bodyCenterX = 49
  const bodyY = 60 + crouch
  const headX = bodyCenterX + facing * (27 + stretch)
  const headY = 49 + crouch
  const gaitPattern = [0, 4, 7, 0, -7, -4][gait % 6]

  drawTail(context, tailVariant, crouch > 4, -facing)
  pixelEllipse(context, bodyCenterX, bodyY, 30 + stretch, 16 - Math.floor(crouch / 3), PIXEL_PALETTE.furOutline, 2)
  pixelEllipse(context, bodyCenterX, bodyY - 2, 27 + stretch, 13 - Math.floor(crouch / 3), PIXEL_PALETTE.fur, 2)
  rect(context, 50, bodyY - 13, 19, 14, PIXEL_PALETTE.ginger)
  rect(context, 54, bodyY - 12, 4, 11, PIXEL_PALETTE.gingerLight)
  rect(context, 64, bodyY - 10, 4, 10, PIXEL_PALETTE.gingerDark)

  const frontX = headX - facing * 12
  const rearX = bodyCenterX - facing * 18
  const frontStep = gaitPattern
  const rearStep = -gaitPattern
  const legTop = bodyY + 7
  const legHeight = Math.max(9, CAT_FOOT_Y - legTop)
  const legs = [
    [frontX - facing * 4, frontStep],
    [frontX + facing * 4, -frontStep],
    [rearX - facing * 4, rearStep],
    [rearX + facing * 4, -rearStep],
  ]
  for (let index = 0; index < legs.length; index += 1) {
    const [baseX, step] = legs[index]
    const legX = baseX + Math.round(step * 0.4)
    const lift = Math.abs(step) > 5 && index % 2 === 0 ? 4 : 0
    rect(context, legX - 3, legTop, 7, legHeight - lift, PIXEL_PALETTE.furOutline)
    rect(context, legX - 1, legTop, 4, legHeight - lift - 2, index > 1 ? PIXEL_PALETTE.ginger : PIXEL_PALETTE.furLight)
    rect(context, legX - 4 + facing * Math.round(step * 0.25), CAT_FOOT_Y - 4 - lift, 9, 4, PIXEL_PALETTE.furLight)
  }

  drawHead(context, headX, headY, {
    eyeMode,
    gaze: gaze * facing,
    direction: facing * 2,
    leftLift: facing > 0 ? 1 : 0,
    rightLift: facing < 0 ? 1 : 0,
  })
}

function drawLyingCat(context, {
  progress = 1,
  eyeMode = 'open',
  sideSleep = false,
  breathe = 0,
  direction = 1,
  interpolateFromSit = false,
  headOffsetX = 0,
} = {}) {
  const t = Math.max(0, Math.min(1, progress))
  if (t < 0.24 && !interpolateFromSit) {
    drawSeatedCat(context, { bob: Math.round(t * 3), eyeMode })
    return
  }

  const bodyY = Math.round(66 + t * 8 + breathe)
  const bodyRx = Math.round(24 + t * 12)
  const bodyRy = Math.round(22 - t * 10)
  const headX = Math.round(47 + direction * t * 22 + headOffsetX)
  const headY = Math.round(38 + t * 31)

  drawTail(context, Math.round(t * 5), true, -direction)
  pixelEllipse(context, 51, bodyY, bodyRx, bodyRy, PIXEL_PALETTE.furOutline, 2)
  pixelEllipse(context, 51, bodyY - 2, bodyRx - 3, Math.max(7, bodyRy - 3), PIXEL_PALETTE.fur, 2)
  rect(context, 50, bodyY - bodyRy + 3, 22, Math.max(7, bodyRy), PIXEL_PALETTE.ginger)
  rect(context, 56, bodyY - bodyRy + 4, 4, Math.max(5, bodyRy - 3), PIXEL_PALETTE.gingerLight)
  rect(context, 64, CAT_FOOT_Y - 8, 19, 6, PIXEL_PALETTE.furLight)
  rect(context, 70, CAT_FOOT_Y - 4, 16, 4, PIXEL_PALETTE.furOutline)
  drawHead(context, headX, headY, {
    eyeMode: sideSleep ? 'closed' : eyeMode,
    direction: direction * 2,
    leftLift: sideSleep ? -1 : 0,
    rightLift: sideSleep ? -1 : 0,
  })
}

function drawCurledCat(context, { progress = 1, breathe = 0, eyeMode = 'closed' } = {}) {
  const t = Math.max(0, Math.min(1, progress))
  if (t === 0) {
    drawSeatedCat(context, { eyeMode: 'open' })
    return
  }
  if (t < 0.52) {
    drawLyingCat(context, {
      progress: Math.pow(t / 0.52, 1.5),
      eyeMode: 'half',
      direction: -1,
      interpolateFromSit: true,
    })
    return
  }

  const radiusX = Math.round(27 + t * 6 + breathe)
  const radiusY = Math.round(17 + t * 3 + breathe)
  pixelEllipse(context, 49, 70, radiusX, radiusY, PIXEL_PALETTE.furOutline, 2)
  pixelEllipse(context, 49, 68, radiusX - 3, radiusY - 3, PIXEL_PALETTE.fur, 2)
  pixelEllipse(context, 57, 65, 17, 13, PIXEL_PALETTE.ginger, 2)
  rect(context, 57, 54, 4, 18, PIXEL_PALETTE.gingerLight)
  pixelPolyline(context, [[73, 78], [67, 84], [52, 86], [36, 82], [29, 73]], 11, PIXEL_PALETTE.furOutline)
  pixelPolyline(context, [[72, 76], [66, 81], [52, 83], [38, 79], [31, 72]], 7, PIXEL_PALETTE.ginger)
  drawHead(context, 33, 65, { eyeMode, direction: -2, leftLift: -1, rightLift: -1 })
  rect(context, 18, 86, 61, 2, PIXEL_PALETTE.furOutline)
}

function drawPlayCat(context, state, frame) {
  if (state === 'play-notice') {
    drawSeatedCat(context, {
      bob: frame === 2 ? -1 : 0,
      gaze: 1,
      leftEar: frame > 0 ? 2 : 0,
      rightEar: frame > 1 ? 2 : 0,
      tailVariant: frame,
    })
    return
  }

  if (state === 'play-crouch') {
    drawStandingCat(context, {
      direction: 1,
      crouch: 6 + Math.floor(frame / 2),
      stretch: frame > 2 ? 4 : 1,
      gaze: 1,
      tailVariant: frame % 2 ? 2 : 4,
    })
    return
  }

  if (state === 'play-pounce') {
    const leap = [0, -5, -10, -11, -6, 0][frame]
    context.save()
    context.translate(Math.min(8, frame * 2), leap)
    drawStandingCat(context, {
      direction: 1,
      crouch: frame > 3 ? 5 : 1,
      stretch: 7,
      gait: frame,
      gaze: 1,
      tailVariant: frame,
    })
    context.restore()
    return
  }

  if (state === 'play-catch') {
    drawLyingCat(context, {
      progress: 1,
      eyeMode: frame === 4 ? 'half' : 'open',
      headOffsetX: -14,
    })
    const reach = [0, 2, 5, 7, 4, 1][frame]
    pixelLine(context, 70, 81, 80 + reach, 84, 8, PIXEL_PALETTE.furOutline)
    pixelLine(context, 70, 80, 80 + reach, 82, 5, PIXEL_PALETTE.furLight)
    pixelEllipse(context, 87, 84, 7, 6, PIXEL_PALETTE.cocoa, 2)
    pixelEllipse(context, 87, 83, 5, 5, PIXEL_PALETTE.terracotta, 2)
    rect(context, 83, 80, 4, 2, PIXEL_PALETTE.terracottaLight)
    rect(context, 88, 84, 4, 2, PIXEL_PALETTE.terracottaDark)
    rect(context, 85, 86, 2, 2, PIXEL_PALETTE.amberLight)
    return
  }

  const recover = frame / 5
  if (recover < 0.5) drawLyingCat(context, { progress: 1 - recover * 0.5, eyeMode: 'half' })
  else drawSeatedCat(context, { bob: 1, eyeMode: frame === 5 ? 'open' : 'half', tailVariant: frame })
}

function drawCatFrame(context, state, frame) {
  context.clearRect(0, 0, CAT_CANVAS, CAT_CANVAS)

  switch (state) {
    case 'idle':
      drawSeatedCat(context, { bob: [0, -1, -1, 0][frame], tailVariant: 0 })
      break
    case 'blink':
      drawSeatedCat(context, { eyeMode: ['open', 'half', 'closed', 'open'][frame], tailVariant: 1 })
      break
    case 'ear':
      drawSeatedCat(context, { leftEar: [0, 3, 0][frame], rightEar: [0, 0, 2][frame], tailVariant: 0 })
      break
    case 'look':
      drawSeatedCat(context, { gaze: [-1, -1, 0, 1, 1][frame], lean: [-2, -1, 0, 1, 2][frame], tailVariant: 2 })
      break
    case 'tail':
      drawSeatedCat(context, { tailVariant: frame })
      break
    case 'stand':
      if (frame < 2) drawSeatedCat(context, { bob: frame + 1, eyeMode: frame ? 'half' : 'open' })
      else drawStandingCat(context, { direction: 1, crouch: Math.max(0, 8 - (frame - 2) * 3), gait: 0, tailVariant: frame })
      break
    case 'sit':
      if (frame < 4) drawStandingCat(context, { direction: 1, crouch: frame * 2, gait: 0, tailVariant: frame })
      else drawSeatedCat(context, { bob: frame === 4 ? 2 : 0, tailVariant: frame })
      break
    case 'loaf':
      drawSeatedCat(context, { loaf: true, bob: [0, -1, -1, 0][frame], eyeMode: frame === 2 ? 'half' : 'open', tailVariant: 0 })
      break
    case 'lie':
      drawLyingCat(context, { progress: frame / 7, eyeMode: frame > 5 ? 'half' : 'open' })
      break
    case 'walk':
      drawStandingCat(context, { direction: 1, gait: frame, tailVariant: frame, bob: frame % 3 === 1 ? -1 : 0 })
      break
    case 'turn':
      if (frame < 2) drawStandingCat(context, { direction: 1, gait: 0, tailVariant: frame })
      else if (frame === 2) drawSeatedCat(context, { lean: 0, tailVariant: 0 })
      else drawStandingCat(context, { direction: -1, gait: 0, tailVariant: frame })
      break
    case 'sleep-curl-transition':
      drawCurledCat(context, { progress: frame / 7, eyeMode: frame > 3 ? 'closed' : 'half' })
      break
    case 'sleep-curl':
      drawCurledCat(context, { progress: 1, breathe: [0, 1, 1, 0][frame], eyeMode: 'closed' })
      break
    case 'sleep-side-transition':
      drawLyingCat(context, { progress: frame / 6, eyeMode: frame > 3 ? 'closed' : 'half', sideSleep: frame > 4 })
      break
    case 'sleep-side':
      drawLyingCat(context, { progress: 1, sideSleep: true, breathe: [0, 1, 1, 0][frame] })
      break
    case 'play-notice':
    case 'play-crouch':
    case 'play-pounce':
    case 'play-catch':
    case 'play-recover':
      drawPlayCat(context, state, frame)
      break
    case 'welcome':
      drawSeatedCat(context, {
        bob: [0, -1, -2, -1, 0][frame],
        eyeMode: frame === 3 ? 'closed' : 'open',
        pawUp: [0, 2, 5, 3, 0][frame],
        happy: true,
        tailVariant: frame,
      })
      break
    default:
      throw new Error(`Unknown pixel cat state: ${state}`)
  }
}

const STATIC_DRAWERS = Object.freeze({
  'pixel.room.backdrop': drawRoomBackdrop,
  'pixel.room.exterior': drawExterior,
  'pixel.room.window': drawWindow,
  'pixel.furniture.curtain': drawCurtain,
  'pixel.furniture.rug': drawRug,
  'pixel.furniture.sofa': drawSofa,
  'pixel.furniture.tower': drawTower,
  'pixel.furniture.bed': drawBed,
  'pixel.furniture.bowl': drawBowl,
  'pixel.furniture.toy': drawToy,
  'pixel.furniture.lamp': drawLamp,
  'pixel.furniture.plant': drawPlant,
  'pixel.furniture.shelf': drawShelf,
  'pixel.shadow.cat-contact': (context, width, height) => drawContactShadow(context, width, height, 0.34),
  'pixel.shadow.furniture-contact': (context, width, height) => drawContactShadow(context, width, height, 0.24),
  'pixel.light.window-day': drawWindowLight,
  'pixel.light.lamp-glow': drawLampGlow,
  'pixel.light.night-wash': drawNightWash,
})

function textureEntries() {
  return [
    ...Object.values(PIXEL_TEXTURE_MANIFEST.room),
    ...Object.values(PIXEL_TEXTURE_MANIFEST.furniture),
    ...Object.values(PIXEL_TEXTURE_MANIFEST.shadows),
    ...Object.values(PIXEL_TEXTURE_MANIFEST.lights),
    ...Object.values(PIXEL_TEXTURE_MANIFEST.cat.states).flatMap((state) => state.frames),
  ]
}

function drawTexture(context, spec) {
  const staticDrawer = STATIC_DRAWERS[spec.key]
  if (staticDrawer) {
    staticDrawer(context, spec.width, spec.height)
    return
  }
  if (spec.category === 'cat' && spec.state !== undefined && spec.frame !== undefined) {
    drawCatFrame(context, spec.state, spec.frame)
    return
  }
  throw new Error(`Missing pixel texture drawer for ${spec.key}.`)
}

function hasVisiblePixel(context, width, height) {
  const pixels = context.getImageData(0, 0, width, height).data
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 0) return true
  }
  return false
}

/**
 * Creates the complete warm pixel-art texture set exactly once. Every texture
 * is authored at logical art resolution and explicitly uses nearest-neighbour
 * sampling; scenes should position and scale images with integer values.
 *
 * @param {import('phaser').Scene} scene
 * @returns {{manifest: typeof PIXEL_TEXTURE_MANIFEST, createdKeys: string[], reusedKeys: string[], verifiedNonEmptyKeys: string[]}}
 */
export function createPixelTextures(scene) {
  if (!scene?.textures) {
    throw new TypeError('createPixelTextures requires a Phaser Scene with an active Texture Manager.')
  }

  const createdKeys = []
  const reusedKeys = []
  const verifiedNonEmptyKeys = []

  for (const spec of textureEntries()) {
    if (scene.textures.exists(spec.key)) {
      reusedKeys.push(spec.key)
      continue
    }

    const texture = scene.textures.createCanvas(spec.key, spec.width, spec.height)
    if (!texture) throw new Error(`Unable to create pixel texture ${spec.key}.`)

    const context = texture.getContext()
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, spec.width, spec.height)
    drawTexture(context, spec)
    if (!hasVisiblePixel(context, spec.width, spec.height)) {
      throw new Error(`Pixel texture ${spec.key} rendered without visible pixels.`)
    }
    texture.refresh()
    // Phaser.ScaleModes: LINEAR = 0, NEAREST = 1. Only the three isolated
    // light masks may interpolate; authored room, furniture, and cat pixels
    // must stay nearest-neighbour at the fixed 2x world zoom.
    const filterMode = spec.scaleMode === 'linear' ? 0 : 1
    texture.setFilter?.(filterMode)
    for (const source of texture.source || []) source.setFilter?.(filterMode)
    createdKeys.push(spec.key)
    verifiedNonEmptyKeys.push(spec.key)
  }

  return {
    manifest: PIXEL_TEXTURE_MANIFEST,
    createdKeys,
    reusedKeys,
    verifiedNonEmptyKeys,
  }
}
