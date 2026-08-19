import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_RENDER_SCALE,
  MIN_RENDER_SCALE,
  createHiDpiMetrics,
  getInitialHiDpiMetrics,
  getRenderScale,
  installHiDpiScaleSync,
  measureHostCssSize,
} from '../src/game/render/HiDpiScale.js'

class FakeEventTarget {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type })
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0
  }
}

class FakeResizeObserver {
  static instances = []

  constructor(callback) {
    this.callback = callback
    this.observed = new Set()
    this.disconnected = false
    FakeResizeObserver.instances.push(this)
  }

  observe(target) {
    this.observed.add(target)
  }

  disconnect() {
    this.disconnected = true
    this.observed.clear()
  }

  notify() {
    if (!this.disconnected) this.callback([], this)
  }
}

const makeHost = (width, height) => ({
  width,
  height,
  clientWidth: width,
  clientHeight: height,
  getBoundingClientRect() {
    return { width: this.width, height: this.height }
  },
})

const makeScaleManager = ({ width, height, zoom = 1, onMutation = null }) => ({
  width,
  height,
  zoom,
  calls: [],
  setZoom(value) {
    this.calls.push(['setZoom', value])
    this.zoom = value
    onMutation?.('setZoom')
    return this
  },
  resize(nextWidth, nextHeight) {
    this.calls.push(['resize', nextWidth, nextHeight])
    this.width = nextWidth
    this.height = nextHeight
    onMutation?.('resize')
    return this
  },
})

test('render scale is finite, never below one, and capped at two', () => {
  assert.equal(MIN_RENDER_SCALE, 1)
  assert.equal(MAX_RENDER_SCALE, 2)
  assert.equal(getRenderScale(undefined), 1)
  assert.equal(getRenderScale(Number.NaN), 1)
  assert.equal(getRenderScale(-4), 1)
  assert.equal(getRenderScale(0), 1)
  assert.equal(getRenderScale(1), 1)
  assert.equal(getRenderScale(1.5), 1.5)
  assert.equal(getRenderScale(2), 2)
  assert.equal(getRenderScale(3), 2)
  assert.equal(getRenderScale(Number.POSITIVE_INFINITY), 2)
})

test('CSS host dimensions produce capped backing dimensions and inverse Scale.NONE zoom', () => {
  const expected = [
    { css: [320, 667], dpr: 1, backing: [320, 667], zoom: 1 },
    { css: [393, 852], dpr: 2, backing: [786, 1704], zoom: 0.5 },
    { css: [430, 932], dpr: 3, backing: [860, 1864], zoom: 0.5 },
  ]

  for (const sample of expected) {
    const metrics = createHiDpiMetrics({ width: sample.css[0], height: sample.css[1] }, sample.dpr)
    assert.deepEqual(
      [metrics.cssWidth, metrics.cssHeight],
      sample.css,
      `${sample.css.join('x')}@${sample.dpr}: CSS size changed`,
    )
    assert.deepEqual(
      [metrics.backingWidth, metrics.backingHeight],
      sample.backing,
      `${sample.css.join('x')}@${sample.dpr}: backing size is wrong`,
    )
    assert.equal(metrics.renderScale, Math.min(Math.max(sample.dpr, 1), 2))
    assert.equal(metrics.zoom, sample.zoom)
  }
})

test('initial metrics are measured from the host and have a client-size fallback', () => {
  assert.deepEqual(getInitialHiDpiMetrics(makeHost(393, 852), 2), {
    cssWidth: 393,
    cssHeight: 852,
    backingWidth: 786,
    backingHeight: 1704,
    renderScale: 2,
    zoom: 0.5,
  })

  const fallbackHost = makeHost(0, 0)
  fallbackHost.clientWidth = 320
  fallbackHost.clientHeight = 667
  assert.deepEqual(measureHostCssSize(fallbackHost), { width: 320, height: 667 })
})

test('sync uses only public setZoom and resize and ignores repeat observer delivery', async () => {
  FakeResizeObserver.instances.length = 0
  const host = makeHost(393, 852)
  let observer = null
  const scale = makeScaleManager({
    width: 393,
    height: 852,
    onMutation: () => observer?.notify(),
  })
  const windowTarget = new FakeEventTarget()
  windowTarget.devicePixelRatio = 2
  windowTarget.visualViewport = new FakeEventTarget()
  const observedMetrics = []

  const controller = installHiDpiScaleSync(scale, host, {
    windowTarget,
    ResizeObserverClass: FakeResizeObserver,
    onMetrics: metrics => observedMetrics.push(metrics),
  })
  observer = FakeResizeObserver.instances.at(-1)

  assert.deepEqual(scale.calls, [
    ['setZoom', 0.5],
    ['resize', 786, 1704],
  ])
  assert.deepEqual(controller.getMetrics(), getInitialHiDpiMetrics(host, 2))

  observer.notify()
  windowTarget.dispatch('resize')
  await Promise.resolve()
  assert.equal(scale.calls.length, 2, 'unchanged ResizeObserver delivery caused a resize loop')
  assert.equal(observedMetrics.length, 1, 'unchanged metrics must not emit duplicate diagnostics')
  assert.deepEqual(observedMetrics[0], getInitialHiDpiMetrics(host, 2))

  controller.destroy()
})

test('host and DPR changes resync backing size without redundant public calls', () => {
  FakeResizeObserver.instances.length = 0
  const host = makeHost(393, 852)
  const scale = makeScaleManager({ width: 393, height: 852 })
  const windowTarget = new FakeEventTarget()
  windowTarget.devicePixelRatio = 1
  windowTarget.visualViewport = new FakeEventTarget()

  const controller = installHiDpiScaleSync(scale, host, {
    windowTarget,
    ResizeObserverClass: FakeResizeObserver,
  })
  const observer = FakeResizeObserver.instances.at(-1)
  assert.deepEqual(scale.calls, [], 'already-correct DPR 1 dimensions should not be rewritten')

  windowTarget.devicePixelRatio = 2
  windowTarget.dispatch('resize')
  assert.deepEqual(scale.calls, [
    ['setZoom', 0.5],
    ['resize', 786, 1704],
  ])

  host.width = 430
  host.height = 932
  observer.notify()
  assert.deepEqual(scale.calls.at(-1), ['resize', 860, 1864])
  assert.equal(scale.calls.filter(([method]) => method === 'setZoom').length, 1)

  windowTarget.devicePixelRatio = 3
  windowTarget.visualViewport.dispatch('resize')
  assert.equal(scale.calls.length, 3, 'DPR above the cap should not rewrite identical metrics')

  controller.destroy()
})

test('a resolution media query catches a DPR-only change and is re-armed', () => {
  FakeResizeObserver.instances.length = 0
  const host = makeHost(393, 852)
  const scale = makeScaleManager({ width: 393, height: 852 })
  const windowTarget = new FakeEventTarget()
  windowTarget.devicePixelRatio = 1
  windowTarget.mediaQueries = []
  windowTarget.matchMedia = query => {
    const mediaQuery = new FakeEventTarget()
    mediaQuery.media = query
    windowTarget.mediaQueries.push(mediaQuery)
    return mediaQuery
  }

  const controller = installHiDpiScaleSync(scale, host, {
    windowTarget,
    ResizeObserverClass: FakeResizeObserver,
  })
  const initialQuery = windowTarget.mediaQueries.at(-1)
  assert.equal(initialQuery.media, '(resolution: 1dppx)')

  windowTarget.devicePixelRatio = 2
  initialQuery.dispatch('change')
  assert.deepEqual(scale.calls, [
    ['setZoom', 0.5],
    ['resize', 786, 1704],
  ])
  assert.equal(initialQuery.listenerCount('change'), 0)
  assert.equal(windowTarget.mediaQueries.at(-1).media, '(resolution: 2dppx)')
  assert.equal(windowTarget.mediaQueries.at(-1).listenerCount('change'), 1)

  const activeQuery = windowTarget.mediaQueries.at(-1)
  controller.destroy()
  assert.equal(activeQuery.listenerCount('change'), 0)
})

test('a synchronous observer callback from a resize cannot create a sync loop', async () => {
  FakeResizeObserver.instances.length = 0
  const host = makeHost(393, 852)
  let notifyMutation = () => {}
  const scale = makeScaleManager({
    width: 393,
    height: 852,
    onMutation: () => notifyMutation(),
  })
  const windowTarget = new FakeEventTarget()
  windowTarget.devicePixelRatio = 1

  const controller = installHiDpiScaleSync(scale, host, {
    windowTarget,
    ResizeObserverClass: FakeResizeObserver,
  })
  const observer = FakeResizeObserver.instances.at(-1)
  notifyMutation = () => observer.notify()

  host.width = 430
  host.height = 932
  observer.notify()
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(scale.calls, [['resize', 430, 932]])
  controller.destroy()
})

test('destroy disconnects every observer/listener and makes sync inert', () => {
  FakeResizeObserver.instances.length = 0
  const host = makeHost(393, 852)
  const scale = makeScaleManager({ width: 393, height: 852 })
  const windowTarget = new FakeEventTarget()
  windowTarget.devicePixelRatio = 2
  windowTarget.visualViewport = new FakeEventTarget()

  const controller = installHiDpiScaleSync(scale, host, {
    windowTarget,
    ResizeObserverClass: FakeResizeObserver,
  })
  const observer = FakeResizeObserver.instances.at(-1)
  const callsAtDestroy = scale.calls.length

  assert.equal(windowTarget.listenerCount('resize'), 1)
  assert.equal(windowTarget.visualViewport.listenerCount('resize'), 1)
  assert.equal(observer.observed.has(host), true)

  controller.destroy()
  controller.destroy()
  assert.equal(observer.disconnected, true)
  assert.equal(windowTarget.listenerCount('resize'), 0)
  assert.equal(windowTarget.visualViewport.listenerCount('resize'), 0)

  host.width = 430
  observer.notify()
  windowTarget.dispatch('resize')
  controller.sync()
  assert.equal(scale.calls.length, callsAtDestroy)
})

test('invalid stubs fail before observers are installed', () => {
  const host = makeHost(393, 852)
  assert.throws(() => installHiDpiScaleSync(null, host), /ScaleManager/)
  assert.throws(() => installHiDpiScaleSync({ setZoom() {}, resize: null }, host), /ScaleManager/)
  assert.throws(() => installHiDpiScaleSync(makeScaleManager({ width: 1, height: 1 }), null), /host element/)
})
