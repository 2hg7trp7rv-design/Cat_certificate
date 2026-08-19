export const MIN_RENDER_SCALE = 1
export const MAX_RENDER_SCALE = 2

const finiteNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const positivePixels = (value, fallback = 1) => {
  const number = finiteNumber(value, fallback)
  return Math.max(1, Math.round(number))
}

export function getRenderScale(devicePixelRatio = globalThis.devicePixelRatio) {
  const requestedRatio = Number(devicePixelRatio)
  const ratio = Number.isNaN(requestedRatio) ? MIN_RENDER_SCALE : requestedRatio
  return Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, ratio))
}

export function measureHostCssSize(host) {
  if (!host || typeof host.getBoundingClientRect !== 'function') {
    throw new TypeError('A measurable HiDPI host element is required')
  }

  const bounds = host.getBoundingClientRect()
  const width = finiteNumber(bounds?.width, 0) > 0 ? bounds.width : host.clientWidth
  const height = finiteNumber(bounds?.height, 0) > 0 ? bounds.height : host.clientHeight

  return Object.freeze({
    width: positivePixels(width),
    height: positivePixels(height),
  })
}

export function createHiDpiMetrics(cssSize, devicePixelRatio = globalThis.devicePixelRatio) {
  const cssWidth = positivePixels(cssSize?.width)
  const cssHeight = positivePixels(cssSize?.height)
  const renderScale = getRenderScale(devicePixelRatio)

  return Object.freeze({
    cssWidth,
    cssHeight,
    backingWidth: positivePixels(cssWidth * renderScale),
    backingHeight: positivePixels(cssHeight * renderScale),
    renderScale,
    zoom: 1 / renderScale,
  })
}

export function getInitialHiDpiMetrics(host, devicePixelRatio = globalThis.devicePixelRatio) {
  return createHiDpiMetrics(measureHostCssSize(host), devicePixelRatio)
}

const sameNumber = (left, right, tolerance = 1e-9) => (
  Number.isFinite(Number(left))
  && Math.abs(Number(left) - Number(right)) <= tolerance
)

const metricsKey = metrics => [
  metrics.cssWidth,
  metrics.cssHeight,
  metrics.backingWidth,
  metrics.backingHeight,
  metrics.renderScale,
].join(':')

/**
 * Keeps a Phaser Scale.NONE canvas at a capped device-pixel backing size.
 *
 * The controller intentionally uses only the public ScaleManager methods
 * `setZoom` and `resize`. Phaser then owns camera resizing, renderer viewport
 * updates, and pointer coordinate conversion through its normal resize event.
 */
export function installHiDpiScaleSync(scaleManager, host, options = {}) {
  if (!scaleManager || typeof scaleManager.setZoom !== 'function' || typeof scaleManager.resize !== 'function') {
    throw new TypeError('A Phaser ScaleManager with setZoom() and resize() is required')
  }
  if (!host || typeof host.getBoundingClientRect !== 'function') {
    throw new TypeError('A measurable HiDPI host element is required')
  }

  const windowTarget = options.windowTarget ?? globalThis.window ?? null
  const ResizeObserverClass = options.ResizeObserverClass ?? globalThis.ResizeObserver
  const getDevicePixelRatio = options.getDevicePixelRatio
    ?? (() => windowTarget?.devicePixelRatio ?? globalThis.devicePixelRatio)
  const onMetrics = typeof options.onMetrics === 'function' ? options.onMetrics : null

  let observer = null
  let resolutionQuery = null
  let destroyed = false
  let syncing = false
  let pending = false
  let lastAppliedKey = null
  let lastMetrics = null

  const sync = () => {
    if (destroyed) return lastMetrics
    if (syncing) {
      pending = true
      return lastMetrics
    }

    syncing = true
    try {
      const metrics = createHiDpiMetrics(measureHostCssSize(host), getDevicePixelRatio())
      const key = metricsKey(metrics)
      const changed = key !== lastAppliedKey

      if (changed) {
        if (!sameNumber(scaleManager.zoom, metrics.zoom)) {
          scaleManager.setZoom(metrics.zoom)
        }
        if (
          !sameNumber(scaleManager.width, metrics.backingWidth, 0)
          || !sameNumber(scaleManager.height, metrics.backingHeight, 0)
        ) {
          scaleManager.resize(metrics.backingWidth, metrics.backingHeight)
        }
        lastAppliedKey = key
      }

      lastMetrics = metrics
      if (changed) onMetrics?.(metrics)
      return metrics
    } finally {
      syncing = false
      if (pending && !destroyed) {
        pending = false
        queueMicrotask(sync)
      }
    }
  }

  const handleResize = () => sync()
  const removeResolutionListener = () => {
    resolutionQuery?.removeEventListener?.('change', handleResolutionChange)
    resolutionQuery?.removeListener?.(handleResolutionChange)
    resolutionQuery = null
  }
  const watchDevicePixelRatio = () => {
    removeResolutionListener()
    const ratio = Number(getDevicePixelRatio())
    if (!Number.isFinite(ratio) || ratio <= 0 || typeof windowTarget?.matchMedia !== 'function') return
    resolutionQuery = windowTarget.matchMedia(`(resolution: ${ratio}dppx)`)
    if (typeof resolutionQuery?.addEventListener === 'function') {
      resolutionQuery.addEventListener('change', handleResolutionChange)
    } else {
      resolutionQuery?.addListener?.(handleResolutionChange)
    }
  }
  function handleResolutionChange() {
    sync()
    watchDevicePixelRatio()
  }

  if (typeof ResizeObserverClass === 'function') {
    observer = new ResizeObserverClass(handleResize)
    observer.observe(host)
  }
  windowTarget?.addEventListener?.('resize', handleResize, { passive: true })
  windowTarget?.visualViewport?.addEventListener?.('resize', handleResize, { passive: true })

  sync()
  watchDevicePixelRatio()

  return {
    sync,
    getMetrics: () => lastMetrics,
    destroy() {
      if (destroyed) return
      destroyed = true
      pending = false
      observer?.disconnect?.()
      removeResolutionListener()
      windowTarget?.removeEventListener?.('resize', handleResize)
      windowTarget?.visualViewport?.removeEventListener?.('resize', handleResize)
    },
  }
}

export default installHiDpiScaleSync
