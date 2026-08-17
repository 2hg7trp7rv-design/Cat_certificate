export function alignCenteredHitArea(shape, displayOriginX = 0, displayOriginY = 0) {
  if (Array.isArray(shape?.points)) {
    for (const point of shape.points) {
      point.x += displayOriginX
      point.y += displayOriginY
    }
    return shape
  }

  if (shape && Number.isFinite(shape.x) && Number.isFinite(shape.y)) {
    shape.x += displayOriginX
    shape.y += displayOriginY
  }
  return shape
}

export default alignCenteredHitArea
