export const WORLD_WIDTH = 216
export const WORLD_HEIGHT = 472
export const WORLD_ZOOM = 2
export const WORLD_CENTER_X = 108
export const WORLD_CENTER_Y = 236

export function recenterWorldCamera(camera) {
  const visibleWidth = camera.width / WORLD_ZOOM
  const visibleHeight = camera.height / WORLD_ZOOM
  const worldViewX = Math.floor((WORLD_WIDTH - visibleWidth) / 2)
  const worldViewY = Math.floor((WORLD_HEIGHT - visibleHeight) / 2)
  // Phaser zooms around the viewport midpoint. scrollX/Y are therefore not
  // the world-view origin when zoom != 1; offset them so the visible origin,
  // and thus every complete source pixel, lands on an integer art pixel.
  const scrollX = worldViewX - (camera.width - visibleWidth) / 2
  const scrollY = worldViewY - (camera.height - visibleHeight) / 2
  camera.setScroll(scrollX, scrollY)
  return camera
}

export function configureWorldCamera(scene) {
  const camera = scene.cameras.main
  camera.setBackgroundColor('#2a211b')
  camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  camera.setZoom(WORLD_ZOOM)
  camera.setRoundPixels(true)
  const recenter = () => recenterWorldCamera(camera)
  recenter()
  scene.scale.on('resize', recenter)
  scene.events.once('shutdown', () => scene.scale.off('resize', recenter))
  return camera
}

export default configureWorldCamera
