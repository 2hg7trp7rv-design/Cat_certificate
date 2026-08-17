import { addMemory, getVirtualNow } from '../../state.js'

const normalizeLimit = limit => Math.max(0, Math.floor(Number(limit) || 0))

export const appendMemory = (
  state,
  { title = '', body = '', type = 'life', id = null, createdAt } = {},
  actualNow = Date.now(),
) => {
  const fallbackNow = getVirtualNow(state, actualNow)
  const timestamp = Number.isFinite(Number(createdAt)) ? Number(createdAt) : fallbackNow
  return addMemory(state, String(title), String(body), timestamp, type, id)
}

export const listMemories = (state, limit = 60) =>
  [...(Array.isArray(state?.memories) ? state.memories : [])].slice(0, normalizeLimit(limit))

export class MemorySystem {
  add(state, memory, actualNow = Date.now()) {
    return appendMemory(state, memory, actualNow)
  }

  list(state, limit = 60) {
    return listMemories(state, limit)
  }

  has(state, id) {
    return listMemories(state).some(memory => memory.id === id)
  }
}

export default MemorySystem
