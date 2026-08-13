const paths = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.3l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  sparkles: '<path d="m12 3-1.2 3.6a2 2 0 0 1-1.2 1.2L6 9l3.6 1.2a2 2 0 0 1 1.2 1.2L12 15l1.2-3.6a2 2 0 0 1 1.2-1.2L18 9l-3.6-1.2a2 2 0 0 1-1.2-1.2L12 3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.65V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.5 15a1.8 1.8 0 0 0-1.65-1.1H2.8a2 2 0 1 1 0-4h.09a1.8 1.8 0 0 0 1.65-1.1 1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 10 2.7V2.6a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.1h.09a2 2 0 1 1 0 4h-.09a1.8 1.8 0 0 0-1.8 1.1Z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M12 7c1.5-2 4.5-.8 4.5 1.4 0 2-2.3 3.5-4.5 5.2-2.2-1.7-4.5-3.2-4.5-5.2C7.5 6.2 10.5 5 12 7Z"/>',
  soup: '<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M6 20h12M8 7c0-1 1-1.5 1-2.5S8 3 8 2M12 7c0-1 1-1.5 1-2.5S12 3 12 2M16 7c0-1 1-1.5 1-2.5S16 3 16 2"/>',
  toy: '<circle cx="9" cy="14" r="5"/><path d="M12.5 10.5c2.5-3.5 5-3 5.8-1.2 1.1 2.5-2.8 3.2-1.2 5.5 1 1.5 3.3.8 3.7-.6"/><path d="m6 11 6 6M5 15l7-5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/><path d="M16 3v4M14 5h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  hand: '<path d="M7 11V5a2 2 0 0 1 4 0v5M11 10V3.5a2 2 0 0 1 4 0V10M15 10V5a2 2 0 0 1 4 0v8c0 5-3 8-8 8-3.5 0-5.5-1.8-7-4l-2-3a2 2 0 0 1 3-2l2 2"/>',
  pointer: '<path d="m4 3 7.2 17 2.1-6.6L20 11 4 3Z"/><path d="m13.2 13.4 4.3 4.3"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  forward: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cat: '<path d="M4 5 2.5 2.5 2 8a9.5 9.5 0 1 0 20 0l-.5-5.5L19 5"/><path d="M8 13h.01M16 13h.01M9 17c2 1.5 4 1.5 6 0"/>',
  dog: '<path d="M8 5 5 2C2 5 2 11 5 14M16 5l3-3c3 3 3 9 0 12"/><path d="M7 6a7 7 0 1 1 10 0M9 13h.01M15 13h.01M10 17c1.4 1 2.6 1 4 0"/>',
  fish: '<path d="M6.5 7c4.5-3 9.5-2 12.5 3-3 5-8 6-12.5 3L2 16l1.5-4L2 8l4.5 3Z"/><circle cx="16" cy="10" r=".8" fill="currentColor"/>',
  utensils: '<path d="M7 2v8M4 2v5a3 3 0 0 0 6 0V2M7 10v12M16 2v20M16 2c3 2 4 5 4 8h-4"/>',
  battery: '<rect x="2" y="6" width="18" height="12" rx="2"/><path d="M22 10v4M6 10h8"/>',
  home: '<path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 1 0 0 20h1.7a1.8 1.8 0 0 0 1.3-3.1 1.8 1.8 0 0 1 1.3-3h2A3.7 3.7 0 0 0 22 12 10 10 0 0 0 12 2Z"/>',
  flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9c-4-2-4-7 0-7s4 5 0 7ZM15 12c2-4 7-4 7 0s-5 4-7 0ZM12 15c4 2 4 7 0 7s-4-5 0-7ZM9 12c-2 4-7 4-7 0s5-4 7 0Z"/>',
  sofa: '<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 11a2 2 0 0 0-2 2v5h22v-5a2 2 0 0 0-4 0v1H5v-1a2 2 0 0 0-2-2ZM4 18v3M20 18v3"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 18h6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  coffee: '<path d="M3 8h13v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2M7 2v3M11 2v3"/>',
  bone: '<path d="M17 10c1.5 0 3-1 3-2.5S18.5 5 17 5c0-1.5-1-3-2.5-3S12 3.5 12 5L5 12c-1.5 0-3 1-3 2.5S3.5 17 5 17c0 1.5 1 3 2.5 3s2.5-1.5 2.5-3Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 18 2 21 2c0 6-1.3 15-10 16"/><path d="M2 21c4-7 8-10 14-13"/>',
}

export function icon(name, size = 20, className = '') {
  const body = paths[name] || paths.heart
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
}

export function brandMark(compact = false) {
  return `<div class="brand-mark ${compact ? 'brand-mark--compact' : ''}" aria-label="Tail Room">
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <path d="M13.3 23.8C7.5 17.1 9.8 8.2 17.9 7.2c4.3-.5 7.2 2 8.3 5.8 2-3 5.1-4.3 8.4-2.8 6.4 2.9 5.9 11.4.8 16.5L24.2 37.9a2.8 2.8 0 0 1-4 0L13.3 31c-2.2-2.2-2.2-5.1 0-7.2Z" fill="currentColor" opacity=".16"/>
      <path d="M11.8 22.8c-4.3-4.7-2.1-12 4.3-12.6 4.6-.5 7.4 3 7.5 7.1.9-3.3 3.7-5.9 7.6-5.5 6.6.7 8.5 8.9 3.6 13.4L24.7 35.7a2.5 2.5 0 0 1-3.6 0L12 26.3a2.6 2.6 0 0 1-.2-3.5Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18.2 23.5c1.1 1.1 2.4 1.7 3.9 1.7 1.6 0 3-.7 4.1-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="18.2" cy="19.1" r="1.25" fill="currentColor"/><circle cx="26.1" cy="19.1" r="1.25" fill="currentColor"/>
    </svg>
    <div><strong>TAIL ROOM</strong><span>しっぽのいる暮らし</span></div>
  </div>`
}
