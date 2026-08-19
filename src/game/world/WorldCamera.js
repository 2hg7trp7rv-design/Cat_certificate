export const WORLD_WIDTH = 852
export const WORLD_HEIGHT = 1846
export const WORLD_CENTER_X = WORLD_WIDTH / 2
export const WORLD_CENTER_Y = WORLD_HEIGHT / 2

export const calculateWorldZoom = (viewportWidth, viewportHeight) => {
  const width = Math.max(1, Number(viewportWidth) || 1)
  const height = Math.max(1, Number(viewportHeight) || 1)
  return Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT)
}

export function recenterWorldCamera(camera) {
  const zoom = calculateWorldZoom(camera.width, camera.height)
  const visibleWidth = camera.width / zoom
  const visibleHeight = camera.height / zoom
  const worldViewX = (WORLD_WIDTH - visibleWidth) / 2
  const worldViewY = (WORLD_HEIGHT - visibleHeight) / 2
  // Phaser applies zoom around the viewport midpoint, so scrollX/Y are offset
  // from the visible world origin. Keep the supplied room image centered and
  // crop only the excess edge required by the device aspect ratio.
  const scrollX = worldViewX - (camera.width - visibleWidth) / 2
  const scrollY = worldViewY - (camera.height - visibleHeight) / 2
  camera.setZoom(zoom)
  camera.setScroll(scrollX, scrollY)
  return camera
}

export function configureWorldCamera(scene) {
  const camera = scene.cameras.main
  camera.setBackgroundColor('#3d2514')
  camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  camera.setRoundPixels(false)
  const recenter = () => recenterWorldCamera(camera)
  recenter()
  scene.scale.on('resize', recenter)
  scene.events.once('shutdown', () => scene.scale.off('resize', recenter))
  return camera
}

export default configureWorldCamera
