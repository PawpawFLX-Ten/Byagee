/**
 * Daily seeded challenge.
 *
 * The whole simulation is driven by Math.random (spawns, door/space/props
 * rolls) — the test suite already proves that a seeded LCG in place of
 * Math.random yields a fully deterministic run. A daily run installs the
 * LCG for today's date-derived seed so every player faces the same NPC
 * sequence, boss timings and space events; the seed and result are shown
 * on the briefing/death screens and shareable.
 *
 * Determinism of the THREE/React runtime itself is not affected (visual
 * shake etc. only); only the game-logic calls matter.
 */

const DAILY_KEY_PREFIX = 'civicman.daily.'
let installedSeed: number | null = null
let originalRandom: (() => number) | null = null
let lastDailySeed: number | null = null

/** Days are keyed by local calendar date — same "today" for the whole world. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Deterministic 32-bit hash of the date string (FNV-1a). */
export function seedForDate(key: string = dateKey()): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function todaySeed(): number {
  return seedForDate(dateKey())
}

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Start a daily run: install the seeded RNG for this mission. */
export function installDailyRandom(seed: number): void {
  if (installedSeed !== null) return
  originalRandom = Math.random
  Math.random = lcg(seed)
  installedSeed = seed
  lastDailySeed = seed
}

/** End the daily run (death, new mission, or a fresh boot). */
export function restoreRandom(): void {
  if (installedSeed === null) return
  Math.random = originalRandom ?? Math.random
  originalRandom = null
  installedSeed = null
}

export function isDailyActive(): boolean {
  return installedSeed !== null
}

export function getDailySeed(): number | null {
  return installedSeed
}

/** Seed of the last daily run — survives restore, so death UI can show it. */
export function getLastDailySeed(): number | null {
  return lastDailySeed
}

export function loadDailyBest(key: string = dateKey()): number | null {
  try {
    const raw = localStorage.getItem(DAILY_KEY_PREFIX + key)
    if (raw === null) return null
    const v = Number(raw)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

export function saveDailyBest(score: number, key: string = dateKey()): boolean {
  try {
    const prev = loadDailyBest(key)
    if (prev !== null && prev >= score) return false
    localStorage.setItem(DAILY_KEY_PREFIX + key, String(score))
    return true
  } catch {
    return false
  }
}
