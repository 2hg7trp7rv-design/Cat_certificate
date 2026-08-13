const palettes = {
  cream: {
    base: '#DAB995', light: '#F2DDC2', shadow: '#B98763', dark: '#584238', marking: '#C8956B', blush: '#D99187', inner: '#D89C99',
  },
  ginger: {
    base: '#C87949', light: '#E8B27F', shadow: '#9A5636', dark: '#4C352E', marking: '#A85D38', blush: '#DB8275', inner: '#D88D84',
  },
  charcoal: {
    base: '#64686A', light: '#95999A', shadow: '#44484B', dark: '#25292B', marking: '#505457', blush: '#C98282', inner: '#B98282',
  },
}

let sequence = 0

function faceMarkup({ p, id, kind, activity, mood, pupilX, pupilY }) {
  const sleeping = activity === 'sleeping' || mood === 'sleepy'
  const happy = activity === 'petted' || activity === 'greeting' || mood === 'calm'
  const eyeY = kind === 'dog' ? 153 : 155
  const muzzle = kind === 'dog'
    ? `<ellipse cx="188" cy="185" rx="45" ry="31" fill="${p.light}" opacity=".92"/>
       <path d="M176 174c7-6 18-6 25 0-1 9-6 13-13 13-6 0-11-4-12-13Z" fill="${p.dark}"/>
       <ellipse cx="183" cy="175" rx="4" ry="2.2" fill="#fff" opacity=".34"/>
       <path d="M188 187c0 10-9 15-17 9M188 187c0 10 9 15 17 9" fill="none" stroke="${p.dark}" stroke-width="3.5" stroke-linecap="round"/>
       ${activity === 'greeting' ? `<path d="M181 200c4 8 11 8 15 0" fill="#D98582" stroke="${p.dark}" stroke-width="2.2" stroke-linejoin="round"/>` : ''}`
    : `<path d="M181 174c4-3 10-3 14 0-1 6-4 9-7 9s-6-3-7-9Z" fill="#6D4945"/>
       <path d="M188 183c0 9-8 13-15 8M188 183c0 9 8 13 15 8" fill="none" stroke="${p.dark}" stroke-width="3.5" stroke-linecap="round"/>
       ${mood === 'hungry' ? `<path d="M181 198c4 3 10 3 14 0" fill="none" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>` : ''}`

  const eyes = sleeping
    ? `<path d="M141 ${eyeY + 2}c8 7 18 7 27 0M208 ${eyeY + 2}c8 7 18 7 27 0" fill="none" stroke="${p.dark}" stroke-width="5" stroke-linecap="round"/>`
    : happy
      ? `<path d="M141 ${eyeY + 2}c8-7 18-7 27 0M208 ${eyeY + 2}c8-7 18-7 27 0" fill="none" stroke="${p.dark}" stroke-width="5" stroke-linecap="round"/>`
      : `<ellipse cx="155" cy="${eyeY}" rx="16" ry="18" fill="#F9F5EE" stroke="${p.dark}" stroke-width="4"/>
         <ellipse cx="221" cy="${eyeY}" rx="16" ry="18" fill="#F9F5EE" stroke="${p.dark}" stroke-width="4"/>
         <circle class="pet-pupil pet-pupil--left" cx="${155 + pupilX}" cy="${eyeY + pupilY}" r="7.2" fill="${p.dark}"/>
         <circle class="pet-pupil pet-pupil--right" cx="${221 + pupilX}" cy="${eyeY + pupilY}" r="7.2" fill="${p.dark}"/>
         <circle class="pet-glint pet-glint--left" cx="${157 + pupilX}" cy="${eyeY - 3 + pupilY}" r="2.1" fill="#fff"/>
         <circle class="pet-glint pet-glint--right" cx="${223 + pupilX}" cy="${eyeY - 3 + pupilY}" r="2.1" fill="#fff"/>`

  return `<g class="pet-face">${eyes}${muzzle}
    <ellipse cx="134" cy="183" rx="13" ry="7" fill="${p.blush}" opacity=".22"/>
    <ellipse cx="242" cy="183" rx="13" ry="7" fill="${p.blush}" opacity=".22"/>
    ${kind === 'cat' ? `<g class="pet-whiskers" stroke="${p.dark}" stroke-width="2.3" stroke-linecap="round" opacity=".68"><path d="M147 182 102 174M148 190l-47 2M148 198l-42 14M228 182l45-8M228 190l47 2M227 198l42 14"/></g>` : ''}
  </g>`
}

function catMarkup(args) {
  const { p, id, activity } = args
  return `<g class="pet-character" filter="url(#shadow-${id})">
    <g class="pet-tail">
      <path d="M247 244c52-8 71 12 63 42-6 24-33 27-51 11 22 4 31-5 28-15-4-13-21-14-39-8Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M286 265c8 5 13 12 12 19" fill="none" stroke="${p.marking}" stroke-width="8" stroke-linecap="round" opacity=".72"/>
    </g>
    <g class="pet-body">
      <path d="M106 291c-5-45 14-85 55-96 43-12 91 7 102 54 6 26 1 48-10 65H116c-5-8-8-15-10-23Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M150 207c9 16 22 24 39 24 18 0 33-9 43-27 12 30 6 76-8 110h-76c-16-34-18-76 2-107Z" fill="url(#chest-${id})" opacity=".82"/>
      <path d="M137 275c-9 15-11 28-8 39M233 274c8 15 10 28 7 40" fill="none" stroke="${p.marking}" stroke-width="6" stroke-linecap="round" opacity=".65"/>
    </g>
    <g class="pet-paws">
      <path d="M121 288c-13 1-24 14-23 27h65c1-15-10-27-25-27Z" fill="${p.light}" stroke="${p.dark}" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M211 288c-14 0-25 12-24 27h66c1-14-10-27-24-27Z" fill="${p.light}" stroke="${p.dark}" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M121 305v7M139 304v8M211 304v8M231 305v7" stroke="${p.shadow}" stroke-width="2.4" stroke-linecap="round" opacity=".65"/>
    </g>
    <g class="pet-head">
      <path class="pet-ear pet-ear--left" d="M118 121 99 61c-2-7 6-12 12-7l46 38Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path class="pet-ear pet-ear--right" d="m220 93 46-38c6-5 14 0 12 7l-19 62Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="m117 78 10 34 17-15Z" fill="${p.inner}" opacity=".76"/><path d="m260 78-10 34-17-15Z" fill="${p.inner}" opacity=".76"/>
      <path d="M112 152c0-54 31-82 76-82s78 29 78 82c0 52-31 82-78 82-46 0-76-31-76-82Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="5"/>
      <path d="M144 91c12 10 25 14 40 14 17 0 33-6 47-17-2 28-17 48-45 48-26 0-40-18-42-45Z" fill="${p.marking}" opacity=".48"/>
      <path d="m171 104-7 21M193 102l1 22M215 101l8 20" fill="none" stroke="${p.shadow}" stroke-width="6" stroke-linecap="round" opacity=".68"/>
      ${faceMarkup({ ...args, kind: 'cat' })}
    </g>
  </g>
  ${activity === 'petted' ? heartsMarkup() : ''}
  ${activity === 'sleeping' ? sleepMarkup(p) : ''}`
}

function dogMarkup(args) {
  const { p, id, activity } = args
  return `<g class="pet-character" filter="url(#shadow-${id})">
    <g class="pet-tail"><path d="M244 247c42-17 68-5 71 20 2 17-11 30-27 25 9-6 11-15 4-21-9-8-23-4-42 8Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g class="pet-body">
      <path d="M104 290c-2-46 20-84 61-94 44-10 88 12 98 58 5 23 0 44-11 60H113c-5-8-8-16-9-24Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M151 206c9 17 22 25 39 25 18 0 31-9 40-26 13 31 7 75-7 109h-72c-15-35-18-76 0-108Z" fill="url(#chest-${id})" opacity=".84"/>
    </g>
    <g class="pet-paws">
      <path d="M118 287c-14 1-25 14-23 28h67c1-16-11-29-27-28Z" fill="${p.light}" stroke="${p.dark}" stroke-width="4.5"/>
      <path d="M210 287c-15 0-26 13-24 28h68c1-15-11-28-26-28Z" fill="${p.light}" stroke="${p.dark}" stroke-width="4.5"/>
      <path d="M120 304v8M140 304v8M211 304v8M232 304v8" stroke="${p.shadow}" stroke-width="2.4" stroke-linecap="round" opacity=".62"/>
    </g>
    <g class="pet-head">
      <path class="pet-ear pet-ear--left" d="M128 105c-23-28-52-24-54 5-2 32 18 61 43 63 13-23 18-45 11-68Z" fill="${p.shadow}" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path class="pet-ear pet-ear--right" d="M246 105c24-28 53-24 55 5 2 32-19 61-44 63-13-23-18-45-11-68Z" fill="${p.shadow}" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M110 153c0-51 31-82 78-82 48 0 80 31 80 82 0 50-32 82-80 82-47 0-78-32-78-82Z" fill="url(#fur-${id})" stroke="${p.dark}" stroke-width="5"/>
      <path d="M144 91c12 9 26 13 42 13 17 0 32-5 46-15-3 27-18 46-45 46-26 0-40-18-43-44Z" fill="${p.marking}" opacity=".42"/>
      ${faceMarkup({ ...args, kind: 'dog' })}
    </g>
  </g>
  ${activity === 'petted' ? heartsMarkup() : ''}
  ${activity === 'sleeping' ? sleepMarkup(p) : ''}`
}

const heartsMarkup = () => `<g class="pet-hearts" fill="#D78C86"><path d="M93 112c-8-9-23 1-11 13l11 11 11-11c12-12-3-22-11-13Z" opacity=".9"/><path d="M274 88c-6-7-18 1-9 10l9 9 9-9c9-9-3-17-9-10Z" opacity=".72"/><circle cx="76" cy="159" r="5" opacity=".42"/></g>`
const sleepMarkup = (p) => `<g class="pet-sleep-symbols" opacity=".55"><path d="M268 85h24l-19 24h22M295 54h17l-14 17h16" fill="none" stroke="${p.dark}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`

export function petSvg({ kind = 'cat', coat = 'cream', activity = 'idle', mood = 'bright', eyeX = 0, eyeY = 0, className = '' } = {}) {
  const p = palettes[coat] || palettes.cream
  const id = `pet${++sequence}`
  const pupilX = Math.max(-3.2, Math.min(3.2, eyeX * 7))
  const pupilY = Math.max(-2.2, Math.min(2.2, eyeY * 5))
  const args = { p, id, activity, mood, pupilX, pupilY }
  const body = kind === 'dog' ? dogMarkup(args) : catMarkup(args)
  const label = `${coat === 'cream' ? 'クリーム色' : coat === 'ginger' ? '茶色' : 'グレー'}の${kind === 'dog' ? '犬' : '猫'}`
  return `<svg class="pet-svg pet-svg--${kind} pet-svg--${activity} ${className}" viewBox="0 0 360 360" role="img" aria-label="${label}">
    <defs>
      <radialGradient id="fur-${id}" cx="42%" cy="28%" r="72%"><stop offset="0" stop-color="${p.light}"/><stop offset=".58" stop-color="${p.base}"/><stop offset="1" stop-color="${p.shadow}"/></radialGradient>
      <linearGradient id="chest-${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${p.light}"/><stop offset="1" stop-color="${p.base}"/></linearGradient>
      <filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#5B4334" flood-opacity=".18"/></filter>
      <filter id="soft-${id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <ellipse class="pet-ground-shadow" cx="181" cy="318" rx="100" ry="18" fill="#5C483A" opacity=".13" filter="url(#soft-${id})"/>
    ${body}
  </svg>`
}

export function updateEyeTarget(container, kind, x, y) {
  const pupilX = Math.max(-3.2, Math.min(3.2, x * 7))
  const pupilY = Math.max(-2.2, Math.min(2.2, y * 5))
  const baseY = kind === 'dog' ? 153 : 155
  const set = (selector, cx, cy) => {
    const node = container.querySelector(selector)
    if (!node) return
    node.setAttribute('cx', String(cx))
    node.setAttribute('cy', String(cy))
  }
  set('.pet-pupil--left', 155 + pupilX, baseY + pupilY)
  set('.pet-pupil--right', 221 + pupilX, baseY + pupilY)
  set('.pet-glint--left', 157 + pupilX, baseY - 3 + pupilY)
  set('.pet-glint--right', 223 + pupilX, baseY - 3 + pupilY)
}
