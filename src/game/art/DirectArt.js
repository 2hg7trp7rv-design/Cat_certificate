import Phaser from '../phaser.js'
import {
  DIRECT_ART_FILES,
  DIRECT_ART_MANIFEST,
  DIRECT_CAT_POSES,
  DIRECT_DERIVED_TEXTURES,
  DIRECT_ROOM_FRAMES,
} from './DirectArtManifest.js'

const sourceDimensions = texture => {
  const image = texture?.getSourceImage?.() ?? texture?.source?.[0]?.image
  return {
    width: Number(image?.naturalWidth ?? image?.videoWidth ?? image?.width ?? texture?.source?.[0]?.width),
    height: Number(image?.naturalHeight ?? image?.videoHeight ?? image?.height ?? texture?.source?.[0]?.height),
  }
}

const applyClip = (context, mask) => {
  const points = mask?.polygon
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error('Direct-art derivative requires a bounded polygon mask.')
  }
  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  for (const [x, y] of points.slice(1)) context.lineTo(x, y)
  context.closePath()
  context.clip()
}

export function preloadDirectArt(scene) {
  if (!scene?.load?.image) throw new TypeError('preloadDirectArt requires a Phaser Scene loader.')
  for (const file of Object.values(DIRECT_ART_FILES)) scene.load.image(file.key, file.url)
}

export function prepareDirectArt(scene) {
  if (!scene?.textures) throw new TypeError('prepareDirectArt requires an active Phaser Texture Manager.')

  const verifiedFiles = []
  for (const [name, file] of Object.entries(DIRECT_ART_FILES)) {
    if (!scene.textures.exists(file.key)) throw new Error(`Direct art did not load: ${file.url}`)
    const texture = scene.textures.get(file.key)
    const dimensions = sourceDimensions(texture)
    if (dimensions.width !== file.width || dimensions.height !== file.height) {
      throw new Error(
        `Direct art dimensions changed for ${file.url}: ${dimensions.width}x${dimensions.height}`,
      )
    }
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
    verifiedFiles.push(name)
  }

  const catTexture = scene.textures.get(DIRECT_ART_FILES.cat.key)
  const registeredPoses = []
  for (const [name, spec] of Object.entries(DIRECT_CAT_POSES)) {
    const { x, y, width, height } = spec.rect
    if (!catTexture.has(spec.frame)) catTexture.add(spec.frame, 0, x, y, width, height)
    if (!catTexture.has(spec.frame)) throw new Error(`Direct cat pose registration failed: ${name}`)
    registeredPoses.push(name)
  }

  const roomTexture = scene.textures.get(DIRECT_ART_FILES.room.key)
  for (const spec of Object.values(DIRECT_ROOM_FRAMES)) {
    const { x, y, width, height } = spec.rect
    if (!roomTexture.has(spec.frame)) roomTexture.add(spec.frame, 0, x, y, width, height)
    if (!roomTexture.has(spec.frame)) throw new Error(`Direct room frame registration failed: ${spec.frame}`)
  }

  const roomSource = roomTexture.getSourceImage()
  const derivedKeys = []
  for (const spec of Object.values(DIRECT_DERIVED_TEXTURES)) {
    let texture = scene.textures.exists(spec.key) ? scene.textures.get(spec.key) : null
    if (!texture) {
      texture = scene.textures.createCanvas(spec.key, spec.crop.width, spec.crop.height)
      const context = texture.getContext()
      context.clearRect(0, 0, spec.crop.width, spec.crop.height)
      context.save()
      applyClip(context, spec.mask)
      context.drawImage(
        roomSource,
        spec.crop.x,
        spec.crop.y,
        spec.crop.width,
        spec.crop.height,
        0,
        0,
        spec.crop.width,
        spec.crop.height,
      )
      context.restore()
      texture.refresh()
    }
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
    derivedKeys.push(spec.key)
  }

  return {
    manifest: DIRECT_ART_MANIFEST,
    verifiedFiles,
    registeredPoses,
    derivedKeys,
  }
}

export default prepareDirectArt
