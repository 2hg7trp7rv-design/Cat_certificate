import Phaser from '../phaser.js'
import {
  CAT_MOTION_ART_FILE,
  CAT_MOTION_FRAMES,
  CAT_MOTION_MANIFEST,
} from './CatMotionManifest.js'

const sourceDimensions = texture => {
  const image = texture?.getSourceImage?.() ?? texture?.source?.[0]?.image
  return {
    width: Number(image?.naturalWidth ?? image?.videoWidth ?? image?.width ?? texture?.source?.[0]?.width),
    height: Number(image?.naturalHeight ?? image?.videoHeight ?? image?.height ?? texture?.source?.[0]?.height),
  }
}

export function preloadCatMotionArt(scene) {
  if (!scene?.load?.image) throw new TypeError('preloadCatMotionArt requires a Phaser Scene loader.')
  scene.load.image(CAT_MOTION_ART_FILE.key, CAT_MOTION_ART_FILE.url)
}

export function prepareCatMotionArt(scene) {
  if (!scene?.textures) throw new TypeError('prepareCatMotionArt requires an active Phaser Texture Manager.')
  if (!scene.textures.exists(CAT_MOTION_ART_FILE.key)) {
    throw new Error(`Cat motion art did not load: ${CAT_MOTION_ART_FILE.url}`)
  }

  const texture = scene.textures.get(CAT_MOTION_ART_FILE.key)
  const dimensions = sourceDimensions(texture)
  if (dimensions.width !== CAT_MOTION_ART_FILE.width || dimensions.height !== CAT_MOTION_ART_FILE.height) {
    throw new Error(
      `Cat motion art dimensions changed for ${CAT_MOTION_ART_FILE.url}: ${dimensions.width}x${dimensions.height}`,
    )
  }

  texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
  const registeredFrames = []
  for (const [name, spec] of Object.entries(CAT_MOTION_FRAMES)) {
    const { x, y, width, height } = spec.rect
    if (!texture.has(spec.frame)) texture.add(spec.frame, 0, x, y, width, height)
    if (!texture.has(spec.frame)) throw new Error(`Cat motion frame registration failed: ${name}`)
    registeredFrames.push(name)
  }

  return { manifest: CAT_MOTION_MANIFEST, registeredFrames }
}

export default prepareCatMotionArt
