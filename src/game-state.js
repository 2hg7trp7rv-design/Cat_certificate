export const STORAGE_KEY = 'tail-room-state-v2'
export const STATE_VERSION = 2

export const HOUR = 3_600_000
export const DAY = 24 * HOUR
const MINUTE = 60_000
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

export const DEFAULT_ROUTINE = Object.freeze({
  wakeTime: '07:00',
  breakfastTime: '07:30',
  dinnerTime: '19:00',
  bedtime: '23:30',
})

const validTime = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? value : fallback

export const sanitizeRoutine = (routine = {}) => ({
  wakeTime: validTime(routine.wakeTime, DEFAULT_ROUTINE.wakeTime),
  breakfastTime: validTime(routine.breakfastTime, DEFAULT_ROUTINE.breakfastTime),
  dinnerTime: validTime(routine.dinnerTime, DEFAULT_ROUTINE.dinnerTime),
  bedtime: validTime(routine.bedtime, DEFAULT_ROUTINE.bedtime),
})

export const createInitialState = () => ({
  version: STATE_VERSION,
  onboarded: false,
  playerName: '',
  pet: null,
  routine: { ...DEFAULT_ROUTINE },
  room: {
    theme: 'linen',
    cushion: 'round',
    plantVisible: true,
  },
  memories: [],
  lastSeenAt: Date.now(),
  sessionCount: 0,
  soundEnabled: true,
  reduceMotion: false,
  notificationEnabled: false,
  debug: {
    timeOffsetMs: 0,
  },
})

export const getVirtualNow = (state, actualNow = Date.now()) => actualNow + Number(state?.debug?.timeOffsetMs || 0)

export const createPet = (kind, name, coat, personality, now = Date.now()) => ({
  kind: kind === 'dog' ? 'dog' : 'cat',
  name: String(name || '').trim() || (kind === 'dog' ? 'むぎ' : 'こむぎ'),
  coat: ['cream', 'ginger', 'charcoal'].includes(coat) ? coat : 'cream',
  personality: ['gentle', 'curious', 'sleepy'].includes(personality) ? personality : 'gentle',
  createdAt: now,
  bond: 12,
  fullness: 86,
  energy: personality === 'sleepy' ? 72 : 84,
  comfort: personality === 'gentle' ? 88 : 80,
  lastFedAt: now,
  lastPlayedAt: null,
  lastPettedAt: null,
  lastRestAt: null,
  totalPets: 0,
  totalMeals: 1,
  totalPlays: 0,
})

export const beginGame = (state, profile, playerName = '', routine = DEFAULT_ROUTINE, now = Date.now()) => {
  const pet = createPet(profile.kind, profile.name, profile.coat, profile.personality, now)
  return {
    ...createInitialState(),
    ...state,
    version: STATE_VERSION,
    onboarded: true,
    playerName: String(playerName || '').trim(),
    pet,
    routine: sanitizeRoutine(routine),
    memories: [{
      id: `welcome-${now}`,
      createdAt: now,
      title: `${pet.name}がやってきた日`,
      body: 'まだ少し緊張しているみたい。急がず、ゆっくり新しい暮らしを始めよう。',
      icon: 'home',
    }],
    lastSeenAt: now,
    sessionCount: 1,
    debug: { timeOffsetMs: Number(state?.debug?.timeOffsetMs || 0) },
  }
}

export const getTimePhase = (date = new Date()) => {
  const hour = date.getHours()
  if (hour >= 5 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 17) return 'day'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

const minutesOfDay = (time) => {
  const [hour, minute] = validTime(time, '00:00').split(':').map(Number)
  return hour * 60 + minute
}

const atLocalMinutes = (date, minutes, dayOffset = 0) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + dayOffset)
  next.setMinutes(minutes)
  return next.getTime()
}

export const isSleepTime = (routine, date = new Date()) => {
  const safe = sanitizeRoutine(routine)
  const current = date.getHours() * 60 + date.getMinutes()
  const bedtime = minutesOfDay(safe.bedtime)
  const wake = minutesOfDay(safe.wakeTime)
  if (bedtime === wake) return false
  return bedtime > wake ? current >= bedtime || current < wake : current >= bedtime && current < wake
}

export const getMealStatus = (state, now = Date.now()) => {
  const safe = sanitizeRoutine(state?.routine)
  const date = new Date(now)
  const breakfastMinutes = minutesOfDay(safe.breakfastTime)
  const dinnerMinutes = minutesOfDay(safe.dinnerTime)
  const schedule = [
    { id: 'yesterday-dinner', label: '夜ごはん', at: atLocalMinutes(date, dinnerMinutes, -1) },
    { id: 'today-breakfast', label: '朝ごはん', at: atLocalMinutes(date, breakfastMinutes, 0) },
    { id: 'today-dinner', label: '夜ごはん', at: atLocalMinutes(date, dinnerMinutes, 0) },
    { id: 'tomorrow-breakfast', label: '朝ごはん', at: atLocalMinutes(date, breakfastMinutes, 1) },
  ].sort((a, b) => a.at - b.at)

  const past = schedule.filter((meal) => meal.at <= now)
  const latestDue = past[past.length - 1]
  const next = schedule.find((meal) => meal.at > now) || schedule[schedule.length - 1]
  const lastFedAt = Number(state?.pet?.lastFedAt || 0)
  const minutesLate = latestDue ? Math.max(0, Math.floor((now - latestDue.at) / MINUTE)) : 0
  const overdue = Boolean(latestDue && minutesLate >= 30 && lastFedAt < latestDue.at)

  return {
    overdue,
    dueMeal: overdue ? latestDue : null,
    next,
    minutesLate,
    nextInMinutes: Math.max(0, Math.ceil((next.at - now) / MINUTE)),
  }
}

const memoryId = (prefix, now) => `${prefix}-${now}-${Math.random().toString(36).slice(2, 7)}`

const prependMemory = (state, memory, now) => [{
  ...memory,
  id: memory.id || memoryId(memory.icon || 'memory', now),
  createdAt: now,
}, ...(Array.isArray(state.memories) ? state.memories : [])].slice(0, 100)

export const applyElapsedTime = (state, now = Date.now()) => {
  if (!state.pet) return { ...state, lastSeenAt: now }
  const elapsedHours = Math.max(0, (now - Number(state.lastSeenAt || now)) / HOUR)
  if (elapsedHours < 0.02) return { ...state, lastSeenAt: now }

  const sleeping = isSleepTime(state.routine, new Date(now))
  const pet = {
    ...state.pet,
    fullness: clamp(state.pet.fullness - elapsedHours * 3.1, 14, 100),
    energy: sleeping
      ? clamp(state.pet.energy + elapsedHours * 4.2, 28, 100)
      : clamp(state.pet.energy - elapsedHours * 0.75, 28, 100),
    comfort: clamp(state.pet.comfort - elapsedHours * 0.55, 38, 100),
  }

  const mealStatus = getMealStatus({ ...state, pet }, now)
  if (mealStatus.overdue) pet.fullness = Math.min(pet.fullness, mealStatus.minutesLate > 150 ? 34 : 48)

  const returnKey = `return-${new Date(now).toISOString().slice(0, 10)}`
  const hasReturnMemory = state.memories?.some((memory) => memory.id === returnKey)
  const shouldRecordReturn = elapsedHours >= 6 && !hasReturnMemory
  const body = pet.kind === 'dog'
    ? `${pet.name}はしばらく休んだあと、玄関の音に気づいて近くまで来てくれた。`
    : `${pet.name}は窓辺や寝床を行き来しながら過ごし、あなたの気配に気づいて顔を上げた。`
  const memories = shouldRecordReturn
    ? [{ id: returnKey, createdAt: now, title: '留守番のあと', body, icon: 'heart' }, ...state.memories].slice(0, 100)
    : state.memories

  return {
    ...state,
    pet,
    memories,
    lastSeenAt: now,
    sessionCount: Number(state.sessionCount || 0) + 1,
  }
}

export const petCompanion = (state, now = Date.now()) => {
  if (!state.pet) return { state, message: '', bondDelta: 0 }
  const cooldown = state.pet.lastPettedAt ? now - state.pet.lastPettedAt : Infinity
  const bondDelta = cooldown > 45_000 ? 2 : 0
  const messages = {
    curious: '手の動きを追いかけて、もう一度触れてほしそうに近づいた。',
    sleepy: '目を細め、安心した顔でゆっくり身体を預けてきた。',
    gentle: '小さく息をついて、そっとあなたの手に寄りかかった。',
  }
  const message = messages[state.pet.personality] || messages.gentle
  const nextPet = {
    ...state.pet,
    bond: clamp(state.pet.bond + bondDelta),
    comfort: clamp(state.pet.comfort + 5),
    lastPettedAt: now,
    totalPets: Number(state.pet.totalPets || 0) + 1,
  }
  const milestone = bondDelta > 0 && Math.floor(nextPet.bond / 10) > Math.floor(state.pet.bond / 10)
  return {
    state: {
      ...state,
      pet: nextPet,
      memories: milestone
        ? prependMemory(state, { title: '少し近くなった距離', body: message, icon: 'heart' }, now)
        : state.memories,
    },
    message,
    bondDelta,
  }
}

export const feedCompanion = (state, food, now = Date.now()) => {
  if (!state.pet) return { state, message: '', bondDelta: 0 }
  const foods = {
    daily: {
      fullness: 58,
      energy: 3,
      bond: 1,
      title: 'いつものごはん',
      body: '匂いを確かめてから食べ始め、最後に満足そうに口元をぺろりとした。',
    },
    fish: {
      fullness: 46,
      energy: 4,
      bond: 3,
      title: '少し特別なごはん',
      body: '香りを何度も確かめてから、うれしそうに食べ始めた。',
    },
    treat: {
      fullness: 14,
      energy: 2,
      bond: 2,
      title: 'ひとくちのおやつ',
      body: '食べ終わったあとも、期待するようにもう一度こちらを見ている。',
    },
  }
  const value = foods[food] || foods.daily
  return {
    state: {
      ...state,
      pet: {
        ...state.pet,
        fullness: clamp(state.pet.fullness + value.fullness),
        energy: clamp(state.pet.energy + value.energy),
        bond: clamp(state.pet.bond + value.bond),
        lastFedAt: now,
        totalMeals: Number(state.pet.totalMeals || 0) + 1,
      },
      memories: prependMemory(state, { title: value.title, body: value.body, icon: 'food' }, now),
    },
    message: value.body,
    bondDelta: value.bond,
  }
}

export const playWithCompanion = (state, now = Date.now()) => {
  if (!state.pet) return { state, message: '', bondDelta: 0 }
  const bondDelta = state.pet.energy >= 18 ? 4 : 1
  const body = state.pet.kind === 'cat'
    ? 'おもちゃを何度も追いかけ、最後は得意そうに前足で押さえた。'
    : 'おもちゃを追いかけるたびに、しっぽが大きく揺れている。'
  return {
    state: {
      ...state,
      pet: {
        ...state.pet,
        energy: clamp(state.pet.energy - 14),
        fullness: clamp(state.pet.fullness - 3, 14, 100),
        comfort: clamp(state.pet.comfort + 4),
        bond: clamp(state.pet.bond + bondDelta),
        lastPlayedAt: now,
        totalPlays: Number(state.pet.totalPlays || 0) + 1,
      },
      memories: prependMemory(state, { title: '夢中で遊んだ', body, icon: 'play' }, now),
    },
    message: body,
    bondDelta,
  }
}

export const restCompanion = (state, now = Date.now()) => {
  if (!state.pet) return { state, message: '', bondDelta: 0 }
  const body = 'お気に入りの場所で丸くなり、安心したようにゆっくり目を閉じた。'
  return {
    state: {
      ...state,
      pet: {
        ...state.pet,
        energy: clamp(state.pet.energy + 20),
        comfort: clamp(state.pet.comfort + 8),
        lastRestAt: now,
      },
      memories: prependMemory(state, { title: '静かなひと休み', body, icon: 'sleep' }, now),
    },
    message: body,
    bondDelta: 0,
  }
}

export const getPetMood = (pet, mealStatus = null, sleeping = false) => {
  if (!pet) return 'calm'
  if (sleeping || pet.energy < 42) return 'sleepy'
  if (mealStatus?.overdue || pet.fullness < 50) return 'hungry'
  if (pet.comfort > 82) return 'calm'
  return 'bright'
}

export const getGreeting = (state, phase, now = Date.now()) => {
  const pet = state.pet
  const mealStatus = getMealStatus(state, now)
  const sleeping = isSleepTime(state.routine, new Date(now))
  const mood = getPetMood(pet, mealStatus, sleeping)
  if (mood === 'hungry') return `${pet.name}は、ごはんのお皿を何度も確認している。`
  if (mood === 'sleepy') return `${pet.name}は、あなたの近くでゆっくり眠る準備をしている。`
  const you = state.playerName ? `${state.playerName}の` : 'あなたの'
  return {
    morning: `${pet.name}と、いつもの朝を始めよう。`,
    day: `${pet.name}は、${you}気配を感じて近くまで来た。`,
    evening: `${pet.name}と過ごす、静かな夕暮れ。`,
    night: `${pet.name}は、今日もあなたのそばにいる。`,
  }[phase] || `${pet.name}は、あなたのそばにいる。`
}

export const getDaysTogether = (pet, now = Date.now()) => {
  if (!pet) return 0
  return Math.max(1, Math.floor((now - pet.createdAt) / DAY) + 1)
}

export const getGrowthStage = (pet, now = Date.now()) => {
  const days = Math.max(0, getDaysTogether(pet, now) - 1)
  if (days < 30) return { id: 'baby', index: 0, label: pet?.kind === 'dog' ? '子犬期' : '子猫期', scale: 0.82, days }
  if (days < 75) return { id: 'growing', index: 1, label: '成長中', scale: 0.89, days }
  if (days < 120) return { id: 'young', index: 2, label: '若い時期', scale: 0.95, days }
  return { id: 'adult', index: 3, label: '成体', scale: 1, days }
}

export const advanceVirtualTime = (state, milliseconds) => ({
  ...state,
  debug: {
    ...(state.debug || {}),
    timeOffsetMs: Number(state?.debug?.timeOffsetMs || 0) + Number(milliseconds || 0),
  },
})

export const resetVirtualTime = (state) => ({
  ...state,
  debug: { ...(state.debug || {}), timeOffsetMs: 0 },
})

export const serializeState = (state) => JSON.stringify(state)

export const parseState = (raw) => {
  if (!raw) return createInitialState()
  try {
    const parsed = JSON.parse(raw)
    const initial = createInitialState()
    const migrated = parsed.version === 1
      ? { ...parsed, version: STATE_VERSION, routine: { ...DEFAULT_ROUTINE }, notificationEnabled: false, debug: { timeOffsetMs: 0 } }
      : parsed
    if (migrated.version !== STATE_VERSION) return initial
    return {
      ...initial,
      ...migrated,
      routine: sanitizeRoutine(migrated.routine),
      room: { ...initial.room, ...(migrated.room || {}) },
      debug: { ...initial.debug, ...(migrated.debug || {}) },
      memories: Array.isArray(migrated.memories) ? migrated.memories : [],
      pet: migrated.pet
        ? { ...createPet(migrated.pet.kind, migrated.pet.name, migrated.pet.coat, migrated.pet.personality, migrated.pet.createdAt), ...migrated.pet }
        : null,
    }
  } catch {
    return createInitialState()
  }
}
