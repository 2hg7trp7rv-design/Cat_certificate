const textureSpec = (key, width, height, category, depthHint, extra = {}) => Object.freeze({
  key,
  width,
  height,
  category,
  depthHint,
  temporary: true,
  ...extra,
});

/**
 * Temporary, code-generated raster assets used to prove the v0.7 rendering
 * architecture. Every entry is intentionally addressable as a separate
 * texture so the room, cat, furniture, shadows, and light remain independent.
 */
export const PLACEHOLDER_TEXTURE_MANIFEST = Object.freeze({
  version: 1,
  temporary: true,
  room: Object.freeze({
    backdrop: textureSpec('placeholder.room.backdrop', 393, 852, 'room', 0, {
      anchor: Object.freeze({ x: 0.5, y: 0.5 }),
    }),
    exterior: textureSpec('placeholder.room.exterior', 236, 286, 'room', 5),
    window: textureSpec('placeholder.room.window', 252, 316, 'room', 10),
  }),
  furniture: Object.freeze({
    curtain: textureSpec('placeholder.furniture.curtain', 142, 342, 'furniture', 20, {
      mirrorable: true,
    }),
    rug: textureSpec('placeholder.furniture.rug', 344, 170, 'furniture', 30),
    sofa: textureSpec('placeholder.furniture.sofa', 278, 222, 'furniture', 40),
    tower: textureSpec('placeholder.furniture.tower', 130, 330, 'furniture', 45),
    bed: textureSpec('placeholder.furniture.bed', 178, 104, 'furniture', 50),
    bowl: textureSpec('placeholder.furniture.bowl', 94, 58, 'furniture', 55),
    toy: textureSpec('placeholder.furniture.toy', 106, 78, 'furniture', 58),
  }),
  cat: Object.freeze({
    body: textureSpec('placeholder.cat.body', 206, 142, 'cat', 70),
    head: textureSpec('placeholder.cat.head', 126, 116, 'cat', 74),
    ear: textureSpec('placeholder.cat.ear', 48, 58, 'cat', 73, {
      mirrorable: true,
    }),
    tail: textureSpec('placeholder.cat.tail', 172, 108, 'cat', 69, {
      mirrorable: true,
    }),
    eye: textureSpec('placeholder.cat.eye', 30, 22, 'cat-detail', 78, {
      mirrorable: true,
    }),
    muzzle: textureSpec('placeholder.cat.muzzle', 70, 40, 'cat-detail', 77),
    nose: textureSpec('placeholder.cat.nose', 22, 16, 'cat-detail', 79),
    whiskers: textureSpec('placeholder.cat.whiskers', 98, 42, 'cat-detail', 80),
  }),
  shadows: Object.freeze({
    catContact: textureSpec('placeholder.shadow.cat-contact', 220, 64, 'shadow', 65, {
      blendModeHint: 'multiply',
    }),
    furnitureContact: textureSpec('placeholder.shadow.furniture-contact', 292, 78, 'shadow', 25, {
      blendModeHint: 'multiply',
    }),
  }),
  lights: Object.freeze({
    windowDay: textureSpec('placeholder.light.window-day', 304, 430, 'light-mask', 90, {
      blendModeHint: 'screen',
    }),
    lampGlow: textureSpec('placeholder.light.lamp-glow', 300, 300, 'light-mask', 91, {
      blendModeHint: 'screen',
    }),
    nightWash: textureSpec('placeholder.light.night-wash', 393, 852, 'light-mask', 89, {
      blendModeHint: 'multiply',
    }),
  }),
});

const TAU = Math.PI * 2;

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function fillRoundedRect(context, x, y, width, height, radius, fillStyle) {
  roundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function strokeRoundedRect(context, x, y, width, height, radius, strokeStyle, lineWidth = 1) {
  roundedRectPath(context, x, y, width, height, radius);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

function ellipse(context, x, y, radiusX, radiusY, fillStyle, rotation = 0) {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, rotation, 0, TAU);
  context.fillStyle = fillStyle;
  context.fill();
}

function mulberry32(seed) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function addSoftGrain(context, width, height, seed, color, count, maxRadius = 1.4) {
  const random = mulberry32(seed);
  context.save();
  context.fillStyle = color;

  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = 0.25 + random() * maxRadius;
    context.globalAlpha = 0.12 + random() * 0.3;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }

  context.restore();
}

function drawRoomBackdrop(context, width, height) {
  const wallEnd = Math.round(height * 0.72);
  const wall = context.createLinearGradient(0, 0, width, wallEnd);
  wall.addColorStop(0, '#eee9df');
  wall.addColorStop(0.48, '#f6f1e8');
  wall.addColorStop(1, '#e5ded2');
  context.fillStyle = wall;
  context.fillRect(0, 0, width, wallEnd);

  const cornerShade = context.createLinearGradient(0, 0, width, 0);
  cornerShade.addColorStop(0, 'rgba(93, 82, 73, 0.13)');
  cornerShade.addColorStop(0.18, 'rgba(93, 82, 73, 0)');
  cornerShade.addColorStop(0.8, 'rgba(93, 82, 73, 0)');
  cornerShade.addColorStop(1, 'rgba(93, 82, 73, 0.1)');
  context.fillStyle = cornerShade;
  context.fillRect(0, 0, width, wallEnd);

  const floor = context.createLinearGradient(0, wallEnd, 0, height);
  floor.addColorStop(0, '#c8ab88');
  floor.addColorStop(1, '#9b7657');
  context.fillStyle = floor;
  context.fillRect(0, wallEnd, width, height - wallEnd);

  context.fillStyle = '#e0d5c7';
  context.fillRect(0, wallEnd - 9, width, 12);
  context.fillStyle = 'rgba(76, 54, 39, 0.15)';
  context.fillRect(0, wallEnd + 3, width, 4);

  context.save();
  context.strokeStyle = 'rgba(83, 56, 37, 0.16)';
  context.lineWidth = 1;
  for (let y = wallEnd + 34; y < height; y += 38) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y + 10);
    context.stroke();
  }
  for (let x = 36; x < width; x += 72) {
    context.beginPath();
    context.moveTo(x, wallEnd + 2);
    context.lineTo(x + 28, height);
    context.stroke();
  }
  context.restore();

  const floorLight = context.createRadialGradient(width * 0.58, wallEnd + 28, 8, width * 0.58, wallEnd + 28, width * 0.72);
  floorLight.addColorStop(0, 'rgba(255, 235, 194, 0.29)');
  floorLight.addColorStop(1, 'rgba(255, 235, 194, 0)');
  context.fillStyle = floorLight;
  context.fillRect(0, wallEnd, width, height - wallEnd);

  addSoftGrain(context, width, wallEnd, 1709, '#8f8175', 210, 0.85);
}

function drawExterior(context, width, height) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#8fb9c3');
  sky.addColorStop(0.55, '#cadbd8');
  sky.addColorStop(1, '#e7d9bd');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.42;
  ellipse(context, 48, 66, 48, 14, '#f5f3e9', -0.05);
  ellipse(context, 84, 61, 40, 18, '#f5f3e9', 0.04);
  ellipse(context, 184, 100, 58, 16, '#f0eee4', -0.03);
  context.restore();

  context.fillStyle = '#7f9a91';
  context.beginPath();
  context.moveTo(0, height * 0.64);
  context.bezierCurveTo(width * 0.18, height * 0.52, width * 0.33, height * 0.68, width * 0.5, height * 0.57);
  context.bezierCurveTo(width * 0.68, height * 0.48, width * 0.79, height * 0.63, width, height * 0.53);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.fillStyle = '#657f79';
  context.beginPath();
  context.moveTo(0, height * 0.75);
  context.bezierCurveTo(width * 0.22, height * 0.61, width * 0.4, height * 0.8, width * 0.61, height * 0.65);
  context.bezierCurveTo(width * 0.78, height * 0.56, width * 0.9, height * 0.72, width, height * 0.64);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.fillStyle = 'rgba(73, 75, 70, 0.46)';
  for (let index = 0; index < 8; index += 1) {
    const buildingWidth = 18 + (index % 3) * 8;
    const buildingHeight = 28 + (index % 4) * 12;
    const x = index * 32 - 8;
    context.fillRect(x, height - 70 - buildingHeight, buildingWidth, buildingHeight);
  }

  const haze = context.createLinearGradient(0, height * 0.52, 0, height);
  haze.addColorStop(0, 'rgba(244, 231, 208, 0)');
  haze.addColorStop(1, 'rgba(244, 231, 208, 0.34)');
  context.fillStyle = haze;
  context.fillRect(0, height * 0.5, width, height * 0.5);
  addSoftGrain(context, width, height, 9217, '#ffffff', 100, 0.75);
}

function drawWindow(context, width, height) {
  context.clearRect(0, 0, width, height);

  const glass = context.createLinearGradient(0, 16, 0, height - 26);
  glass.addColorStop(0, 'rgba(216, 234, 235, 0.22)');
  glass.addColorStop(1, 'rgba(255, 236, 204, 0.1)');
  fillRoundedRect(context, 20, 18, width - 40, height - 56, 7, glass);

  context.save();
  context.shadowColor = 'rgba(45, 38, 34, 0.22)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 3;
  strokeRoundedRect(context, 12, 10, width - 24, height - 42, 10, '#d3c4b2', 12);
  context.restore();

  const frame = context.createLinearGradient(0, 0, width, 0);
  frame.addColorStop(0, '#bdab96');
  frame.addColorStop(0.5, '#eee3d5');
  frame.addColorStop(1, '#b8a58f');
  context.fillStyle = frame;
  context.fillRect(width / 2 - 5, 16, 10, height - 50);
  context.fillRect(18, height * 0.48, width - 36, 9);

  const sill = context.createLinearGradient(0, 0, 0, 34);
  sill.addColorStop(0, '#eee3d6');
  sill.addColorStop(1, '#bda78f');
  fillRoundedRect(context, 2, height - 35, width - 4, 28, 8, sill);
  context.fillStyle = 'rgba(66, 49, 37, 0.16)';
  context.fillRect(14, height - 10, width - 28, 4);

  context.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(38, 34);
  context.lineTo(88, height - 70);
  context.stroke();
}

function drawCurtain(context, width, height) {
  context.clearRect(0, 0, width, height);
  const fabric = context.createLinearGradient(8, 0, width - 8, 0);
  fabric.addColorStop(0, '#677f7c');
  fabric.addColorStop(0.25, '#a8bbb2');
  fabric.addColorStop(0.52, '#718b86');
  fabric.addColorStop(0.78, '#b9c8bd');
  fabric.addColorStop(1, '#5b736f');

  context.save();
  context.shadowColor = 'rgba(34, 43, 42, 0.2)';
  context.shadowBlur = 9;
  context.shadowOffsetX = 3;
  context.beginPath();
  context.moveTo(15, 8);
  context.bezierCurveTo(32, 22, 42, 4, 56, 14);
  context.bezierCurveTo(74, 2, 90, 22, 108, 10);
  context.bezierCurveTo(126, 30, 132, height * 0.64, 122, height - 23);
  context.bezierCurveTo(102, height - 6, 86, height - 25, 68, height - 11);
  context.bezierCurveTo(48, height - 29, 29, height - 8, 11, height - 26);
  context.bezierCurveTo(23, height * 0.7, 4, height * 0.26, 15, 8);
  context.closePath();
  context.fillStyle = fabric;
  context.fill();
  context.restore();

  context.strokeStyle = 'rgba(45, 64, 61, 0.2)';
  context.lineWidth = 2;
  for (let x = 30; x < width - 14; x += 23) {
    context.beginPath();
    context.moveTo(x, 22);
    context.bezierCurveTo(x - 10, height * 0.36, x + 11, height * 0.65, x - 3, height - 28);
    context.stroke();
  }

  context.fillStyle = '#d2b58b';
  context.fillRect(7, 14, width - 12, 10);
}

function drawRug(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.shadowColor = 'rgba(63, 45, 34, 0.28)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 7;
  const rug = context.createRadialGradient(width * 0.47, height * 0.34, 12, width * 0.5, height * 0.5, width * 0.55);
  rug.addColorStop(0, '#d8c4aa');
  rug.addColorStop(0.7, '#b99575');
  rug.addColorStop(1, '#927158');
  ellipse(context, width / 2, height / 2 - 4, width / 2 - 15, height / 2 - 20, rug, -0.015);
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(247, 233, 211, 0.42)';
  context.lineCap = 'round';
  for (let index = 0; index < 54; index += 1) {
    const angle = (index / 54) * TAU;
    const x = width / 2 + Math.cos(angle) * (width / 2 - 18);
    const y = height / 2 - 4 + Math.sin(angle) * (height / 2 - 23);
    context.lineWidth = 1 + (index % 3) * 0.4;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * 6, y + Math.sin(angle) * 5);
    context.stroke();
  }
  context.restore();
}

function drawSofa(context, width, height) {
  context.clearRect(0, 0, width, height);

  context.save();
  context.shadowColor = 'rgba(57, 42, 33, 0.26)';
  context.shadowBlur = 11;
  context.shadowOffsetY = 7;
  const back = context.createLinearGradient(0, 24, 0, 152);
  back.addColorStop(0, '#c9ae99');
  back.addColorStop(1, '#9f7e69');
  fillRoundedRect(context, 23, 28, width - 46, 130, 30, back);
  context.restore();

  const base = context.createLinearGradient(0, 122, 0, 194);
  base.addColorStop(0, '#b79580');
  base.addColorStop(1, '#856452');
  fillRoundedRect(context, 16, 119, width - 32, 72, 22, base);
  fillRoundedRect(context, 4, 92, 43, 91, 19, '#9b7864');
  fillRoundedRect(context, width - 47, 92, 43, 91, 19, '#9b7864');

  const cushion = context.createLinearGradient(0, 0, 0, 66);
  cushion.addColorStop(0, '#dbc5b2');
  cushion.addColorStop(1, '#af8e79');
  fillRoundedRect(context, 45, 112, 91, 58, 17, cushion);
  fillRoundedRect(context, 142, 112, 91, 58, 17, cushion);
  strokeRoundedRect(context, 45, 112, 91, 58, 17, 'rgba(89, 65, 52, 0.2)', 2);
  strokeRoundedRect(context, 142, 112, 91, 58, 17, 'rgba(89, 65, 52, 0.2)', 2);

  context.fillStyle = '#634d40';
  fillRoundedRect(context, 30, 183, 20, 29, 4, '#634d40');
  fillRoundedRect(context, width - 50, 183, 20, 29, 4, '#634d40');
}

function drawTower(context, width, height) {
  context.clearRect(0, 0, width, height);
  const wood = context.createLinearGradient(0, 0, width, 0);
  wood.addColorStop(0, '#8e7359');
  wood.addColorStop(0.48, '#b59877');
  wood.addColorStop(1, '#765c47');

  context.save();
  context.shadowColor = 'rgba(53, 39, 29, 0.25)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 5;
  fillRoundedRect(context, 10, height - 39, width - 20, 25, 10, '#80634c');
  context.restore();

  fillRoundedRect(context, 27, 75, 24, height - 113, 10, wood);
  fillRoundedRect(context, 82, 30, 22, height - 68, 10, wood);
  fillRoundedRect(context, 9, 135, 104, 24, 11, '#a98b6a');
  fillRoundedRect(context, 60, 74, 66, 22, 10, '#b19574');
  fillRoundedRect(context, 3, 25, 78, 25, 11, '#aa8c6b');

  const basket = context.createLinearGradient(0, 0, 0, 54);
  basket.addColorStop(0, '#c5a988');
  basket.addColorStop(1, '#8e7155');
  context.beginPath();
  context.moveTo(16, 50);
  context.quadraticCurveTo(42, 67, 72, 49);
  context.lineTo(66, 90);
  context.quadraticCurveTo(43, 105, 21, 89);
  context.closePath();
  context.fillStyle = basket;
  context.fill();
  context.strokeStyle = 'rgba(84, 61, 44, 0.35)';
  context.lineWidth = 2;
  context.stroke();

  context.strokeStyle = 'rgba(80, 59, 44, 0.28)';
  context.lineWidth = 1;
  for (let y = 91; y < height - 43; y += 9) {
    context.beginPath();
    context.moveTo(28, y);
    context.lineTo(50, y - 3);
    context.moveTo(83, y + 2);
    context.lineTo(103, y - 1);
    context.stroke();
  }
}

function drawBed(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.shadowColor = 'rgba(54, 42, 35, 0.25)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 5;
  ellipse(context, width / 2, height * 0.59, width * 0.46, height * 0.37, '#8d6f65');
  context.restore();

  const cushion = context.createRadialGradient(width * 0.43, height * 0.38, 3, width * 0.5, height * 0.54, width * 0.48);
  cushion.addColorStop(0, '#e3d3c6');
  cushion.addColorStop(0.72, '#bca294');
  cushion.addColorStop(1, '#907268');
  ellipse(context, width / 2, height * 0.5, width * 0.42, height * 0.32, cushion);
  ellipse(context, width / 2, height * 0.51, width * 0.28, height * 0.18, 'rgba(116, 85, 75, 0.16)');
  context.strokeStyle = 'rgba(255, 244, 231, 0.44)';
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(width / 2, height * 0.49, width * 0.37, height * 0.27, 0, 0, TAU);
  context.stroke();
}

function drawBowl(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.shadowColor = 'rgba(42, 44, 40, 0.28)';
  context.shadowBlur = 6;
  context.shadowOffsetY = 4;
  ellipse(context, width / 2, height - 11, width * 0.39, 8, 'rgba(55, 48, 41, 0.25)');
  context.restore();

  const ceramic = context.createLinearGradient(0, 14, 0, height - 4);
  ceramic.addColorStop(0, '#90b0aa');
  ceramic.addColorStop(0.45, '#557d78');
  ceramic.addColorStop(1, '#315c58');
  context.beginPath();
  context.moveTo(13, 18);
  context.quadraticCurveTo(16, height - 3, width / 2, height - 4);
  context.quadraticCurveTo(width - 16, height - 3, width - 13, 18);
  context.closePath();
  context.fillStyle = ceramic;
  context.fill();
  ellipse(context, width / 2, 18, width * 0.38, 11, '#b9d0c9');
  ellipse(context, width / 2, 19, width * 0.3, 7, '#4f625a');
  context.strokeStyle = 'rgba(237, 255, 249, 0.55)';
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(width / 2, 17, width * 0.36, 10, 0, Math.PI * 1.08, Math.PI * 1.82);
  context.stroke();
}

function drawToy(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.strokeStyle = '#6a574b';
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(10, 16);
  context.bezierCurveTo(38, 3, 52, 36, 71, 43);
  context.stroke();
  context.restore();

  const ball = context.createRadialGradient(71, 45, 2, 76, 51, 22);
  ball.addColorStop(0, '#e8b69e');
  ball.addColorStop(0.65, '#c76f62');
  ball.addColorStop(1, '#85413f');
  ellipse(context, 76, 52, 20, 19, ball, 0.1);
  context.strokeStyle = 'rgba(99, 43, 42, 0.36)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(75, 52, 12, -0.4, 2.2);
  context.stroke();

  context.fillStyle = '#d6c57d';
  context.beginPath();
  context.moveTo(91, 44);
  context.quadraticCurveTo(105, 35, 101, 57);
  context.quadraticCurveTo(93, 65, 86, 56);
  context.closePath();
  context.fill();
}

function drawCatBody(context, width, height) {
  context.clearRect(0, 0, width, height);
  const fur = context.createRadialGradient(width * 0.42, height * 0.32, 6, width * 0.5, height * 0.55, width * 0.53);
  fur.addColorStop(0, '#c3ad98');
  fur.addColorStop(0.62, '#9d826d');
  fur.addColorStop(1, '#6f594b');

  context.save();
  context.shadowColor = 'rgba(50, 37, 29, 0.24)';
  context.shadowBlur = 9;
  context.shadowOffsetY = 5;
  context.beginPath();
  context.moveTo(26, height * 0.67);
  context.bezierCurveTo(17, height * 0.36, 47, 18, width * 0.48, 18);
  context.bezierCurveTo(width * 0.78, 12, width - 20, height * 0.32, width - 16, height * 0.61);
  context.bezierCurveTo(width - 9, height * 0.86, width * 0.76, height - 8, width * 0.58, height - 17);
  context.bezierCurveTo(width * 0.44, height - 5, width * 0.29, height - 15, width * 0.22, height - 19);
  context.bezierCurveTo(14, height - 12, 17, height * 0.82, 26, height * 0.67);
  context.closePath();
  context.fillStyle = fur;
  context.fill();
  context.restore();

  const chest = context.createRadialGradient(54, 79, 2, 54, 79, 43);
  chest.addColorStop(0, 'rgba(221, 208, 192, 0.66)');
  chest.addColorStop(1, 'rgba(221, 208, 192, 0)');
  ellipse(context, 58, 83, 42, 48, chest, -0.2);

  context.strokeStyle = 'rgba(74, 57, 46, 0.28)';
  context.lineCap = 'round';
  for (let index = 0; index < 17; index += 1) {
    const x = 42 + index * 8.2;
    const y = 29 + (index % 4) * 7;
    context.lineWidth = 1 + (index % 2) * 0.5;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + 4, y + 8, x + 9, y + 4);
    context.stroke();
  }
}

function drawCatHead(context, width, height) {
  context.clearRect(0, 0, width, height);
  const fur = context.createRadialGradient(width * 0.41, height * 0.31, 4, width * 0.5, height * 0.52, width * 0.56);
  fur.addColorStop(0, '#cdbba8');
  fur.addColorStop(0.64, '#a18670');
  fur.addColorStop(1, '#6c5547');

  context.save();
  context.shadowColor = 'rgba(49, 35, 27, 0.21)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.moveTo(18, 45);
  context.bezierCurveTo(20, 22, 39, 10, 62, 11);
  context.bezierCurveTo(88, 8, 109, 23, 111, 49);
  context.bezierCurveTo(122, 76, 104, 105, 72, 109);
  context.bezierCurveTo(46, 116, 17, 100, 13, 73);
  context.bezierCurveTo(8, 60, 11, 51, 18, 45);
  context.closePath();
  context.fillStyle = fur;
  context.fill();
  context.restore();

  const cheekLight = context.createRadialGradient(63, 72, 1, 63, 72, 49);
  cheekLight.addColorStop(0, 'rgba(229, 217, 202, 0.46)');
  cheekLight.addColorStop(1, 'rgba(229, 217, 202, 0)');
  ellipse(context, 63, 74, 47, 31, cheekLight);

  context.strokeStyle = 'rgba(70, 51, 41, 0.25)';
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(46, 20);
  context.quadraticCurveTo(49, 37, 52, 43);
  context.moveTo(63, 17);
  context.quadraticCurveTo(64, 34, 64, 42);
  context.moveTo(80, 20);
  context.quadraticCurveTo(76, 35, 74, 43);
  context.stroke();
}

function drawCatEar(context, width, height) {
  context.clearRect(0, 0, width, height);
  const outer = context.createLinearGradient(0, 0, width, height);
  outer.addColorStop(0, '#bca48f');
  outer.addColorStop(1, '#71594a');
  context.beginPath();
  context.moveTo(7, height - 7);
  context.quadraticCurveTo(8, 26, 17, 5);
  context.quadraticCurveTo(39, 26, width - 6, height - 8);
  context.quadraticCurveTo(25, height - 1, 7, height - 7);
  context.closePath();
  context.fillStyle = outer;
  context.fill();

  const inner = context.createLinearGradient(0, 11, width, height);
  inner.addColorStop(0, '#c48e87');
  inner.addColorStop(1, '#765c59');
  context.beginPath();
  context.moveTo(13, height - 12);
  context.quadraticCurveTo(15, 30, 19, 14);
  context.quadraticCurveTo(33, 30, width - 11, height - 13);
  context.closePath();
  context.fillStyle = inner;
  context.fill();

  context.strokeStyle = 'rgba(240, 225, 207, 0.48)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(11, height - 10);
  context.quadraticCurveTo(11, 25, 18, 7);
  context.stroke();
}

function drawCatTail(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = 'rgba(44, 32, 25, 0.25)';
  context.shadowBlur = 7;
  context.shadowOffsetY = 4;
  context.strokeStyle = '#705749';
  context.lineWidth = 34;
  context.beginPath();
  context.moveTo(20, height - 22);
  context.bezierCurveTo(57, height - 15, 70, 30, 111, 28);
  context.bezierCurveTo(141, 25, 151, 46, 151, 66);
  context.stroke();
  context.restore();

  context.save();
  context.lineCap = 'round';
  context.strokeStyle = '#9d826e';
  context.lineWidth = 24;
  context.beginPath();
  context.moveTo(22, height - 24);
  context.bezierCurveTo(58, height - 17, 72, 34, 112, 33);
  context.bezierCurveTo(137, 31, 144, 46, 144, 64);
  context.stroke();
  context.strokeStyle = 'rgba(226, 211, 196, 0.29)';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(27, height - 31);
  context.bezierCurveTo(64, height - 23, 80, 40, 116, 39);
  context.stroke();
  context.restore();
}

function drawCatEye(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2);
  context.beginPath();
  context.ellipse(0, 0, 13, 8, -0.08, 0, TAU);
  const iris = context.createRadialGradient(-3, -2, 1, 0, 0, 13);
  iris.addColorStop(0, '#d8c475');
  iris.addColorStop(0.68, '#8d743b');
  iris.addColorStop(1, '#3d3327');
  context.fillStyle = iris;
  context.fill();
  ellipse(context, 0.5, 0, 2.6, 7, '#211c18');
  ellipse(context, -4.2, -3.1, 2.1, 1.6, 'rgba(255, 255, 246, 0.86)');
  context.strokeStyle = 'rgba(39, 31, 25, 0.72)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(0, 0, 13, 8, -0.08, 0, TAU);
  context.stroke();
  context.restore();
}

function drawCatMuzzle(context, width, height) {
  context.clearRect(0, 0, width, height);
  const muzzle = context.createRadialGradient(width / 2, height * 0.44, 2, width / 2, height * 0.54, width * 0.42);
  muzzle.addColorStop(0, 'rgba(237, 226, 211, 0.88)');
  muzzle.addColorStop(1, 'rgba(194, 173, 151, 0.38)');
  ellipse(context, width * 0.34, height * 0.48, 22, 15, muzzle, -0.07);
  ellipse(context, width * 0.66, height * 0.48, 22, 15, muzzle, 0.07);
  context.strokeStyle = 'rgba(64, 47, 39, 0.62)';
  context.lineWidth = 1.5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(width / 2, height * 0.52);
  context.quadraticCurveTo(width / 2 - 3, height * 0.73, width * 0.39, height * 0.76);
  context.moveTo(width / 2, height * 0.52);
  context.quadraticCurveTo(width / 2 + 3, height * 0.73, width * 0.61, height * 0.76);
  context.stroke();
}

function drawCatNose(context, width, height) {
  context.clearRect(0, 0, width, height);
  const nose = context.createLinearGradient(0, 2, 0, height - 2);
  nose.addColorStop(0, '#9f6f6e');
  nose.addColorStop(1, '#5d3b3d');
  context.beginPath();
  context.moveTo(3, 5);
  context.quadraticCurveTo(width / 2, -1, width - 3, 5);
  context.quadraticCurveTo(width - 5, 12, width / 2, height - 2);
  context.quadraticCurveTo(5, 12, 3, 5);
  context.closePath();
  context.fillStyle = nose;
  context.fill();
  ellipse(context, 8, 5, 2.4, 1.5, 'rgba(255, 225, 220, 0.52)', -0.2);
}

function drawWhiskers(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.strokeStyle = 'rgba(245, 239, 228, 0.82)';
  context.lineWidth = 1.2;
  context.lineCap = 'round';

  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 3; index += 1) {
      const startX = width / 2 + side * 16;
      const startY = 15 + index * 5;
      const endX = width / 2 + side * (42 + index * 2);
      const endY = 8 + index * 10;
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(width / 2 + side * 31, startY - 3, endX, endY);
      context.stroke();
    }
  }

  context.restore();
}

function drawContactShadow(context, width, height, strength) {
  context.clearRect(0, 0, width, height);
  const shadow = context.createRadialGradient(width / 2, height / 2, 4, width / 2, height / 2, width * 0.48);
  shadow.addColorStop(0, `rgba(46, 36, 31, ${strength})`);
  shadow.addColorStop(0.48, `rgba(46, 36, 31, ${strength * 0.62})`);
  shadow.addColorStop(1, 'rgba(46, 36, 31, 0)');
  ellipse(context, width / 2, height / 2, width * 0.48, height * 0.39, shadow);
}

function drawWindowDayLight(context, width, height) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.beginPath();
  context.moveTo(width * 0.28, 0);
  context.lineTo(width * 0.78, 0);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.clip();
  const light = context.createLinearGradient(width * 0.55, 0, width * 0.45, height);
  light.addColorStop(0, 'rgba(255, 245, 216, 0.34)');
  light.addColorStop(0.55, 'rgba(255, 221, 166, 0.2)');
  light.addColorStop(1, 'rgba(255, 210, 142, 0)');
  context.fillStyle = light;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function drawLampGlow(context, width, height) {
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(width / 2, height / 2, 4, width / 2, height / 2, width / 2);
  glow.addColorStop(0, 'rgba(255, 224, 166, 0.62)');
  glow.addColorStop(0.32, 'rgba(255, 197, 112, 0.26)');
  glow.addColorStop(1, 'rgba(255, 176, 88, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function drawNightWash(context, width, height) {
  context.clearRect(0, 0, width, height);
  const wash = context.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, 'rgba(30, 48, 76, 0.42)');
  wash.addColorStop(0.48, 'rgba(43, 53, 76, 0.33)');
  wash.addColorStop(1, 'rgba(18, 29, 49, 0.5)');
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  const moon = context.createRadialGradient(width * 0.2, height * 0.25, 8, width * 0.2, height * 0.25, width * 0.7);
  moon.addColorStop(0, 'rgba(147, 185, 219, 0.18)');
  moon.addColorStop(1, 'rgba(147, 185, 219, 0)');
  context.fillStyle = moon;
  context.fillRect(0, 0, width, height);
}

const DRAWERS = Object.freeze({
  'placeholder.room.backdrop': drawRoomBackdrop,
  'placeholder.room.exterior': drawExterior,
  'placeholder.room.window': drawWindow,
  'placeholder.furniture.curtain': drawCurtain,
  'placeholder.furniture.rug': drawRug,
  'placeholder.furniture.sofa': drawSofa,
  'placeholder.furniture.tower': drawTower,
  'placeholder.furniture.bed': drawBed,
  'placeholder.furniture.bowl': drawBowl,
  'placeholder.furniture.toy': drawToy,
  'placeholder.cat.body': drawCatBody,
  'placeholder.cat.head': drawCatHead,
  'placeholder.cat.ear': drawCatEar,
  'placeholder.cat.tail': drawCatTail,
  'placeholder.cat.eye': drawCatEye,
  'placeholder.cat.muzzle': drawCatMuzzle,
  'placeholder.cat.nose': drawCatNose,
  'placeholder.cat.whiskers': drawWhiskers,
  'placeholder.shadow.cat-contact': (context, width, height) => drawContactShadow(context, width, height, 0.3),
  'placeholder.shadow.furniture-contact': (context, width, height) => drawContactShadow(context, width, height, 0.22),
  'placeholder.light.window-day': drawWindowDayLight,
  'placeholder.light.lamp-glow': drawLampGlow,
  'placeholder.light.night-wash': drawNightWash,
});

function textureEntries() {
  return [
    ...Object.values(PLACEHOLDER_TEXTURE_MANIFEST.room),
    ...Object.values(PLACEHOLDER_TEXTURE_MANIFEST.furniture),
    ...Object.values(PLACEHOLDER_TEXTURE_MANIFEST.cat),
    ...Object.values(PLACEHOLDER_TEXTURE_MANIFEST.shadows),
    ...Object.values(PLACEHOLDER_TEXTURE_MANIFEST.lights),
  ];
}

/**
 * Creates all temporary textures exactly once in Phaser's Texture Manager.
 * The browser Canvas 2D work happens only during scene creation; subsequent
 * frames reuse the uploaded textures through the active Phaser renderer.
 *
 * @param {import('phaser').Scene} scene
 * @returns {{manifest: typeof PLACEHOLDER_TEXTURE_MANIFEST, createdKeys: string[], reusedKeys: string[]}}
 */
export function createPlaceholderTextures(scene) {
  if (!scene?.textures) {
    throw new TypeError('createPlaceholderTextures requires a Phaser Scene with an active Texture Manager.');
  }

  const createdKeys = [];
  const reusedKeys = [];

  for (const spec of textureEntries()) {
    if (scene.textures.exists(spec.key)) {
      reusedKeys.push(spec.key);
      continue;
    }

    const draw = DRAWERS[spec.key];
    if (!draw) {
      throw new Error(`Missing placeholder texture drawer for ${spec.key}.`);
    }

    const texture = scene.textures.createCanvas(spec.key, spec.width, spec.height);
    if (!texture) {
      throw new Error(`Unable to create placeholder texture ${spec.key}.`);
    }

    const context = texture.getContext();
    context.clearRect(0, 0, spec.width, spec.height);
    draw(context, spec.width, spec.height);
    texture.refresh();
    createdKeys.push(spec.key);
  }

  return {
    manifest: PLACEHOLDER_TEXTURE_MANIFEST,
    createdKeys,
    reusedKeys,
  };
}
