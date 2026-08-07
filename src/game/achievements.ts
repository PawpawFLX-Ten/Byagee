import { MAX_LEVEL } from './progression'
import type { AchievementId } from './types'

/** Cross-run progression: run score, achievement unlock, best record. */

export interface AchievementCtx {
  elapsedSec: number
  skillHits: number
  bossesCleared: number
  propsPicked: number
  spaceEvents: number
  chaserKnockbacks: number
  level: number
}

export interface AchievementDef {
  id: AchievementId
  check: (ctx: AchievementCtx) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_boss', check: (c) => c.bossesCleared >= 1 },
  { id: 'boss_slayer', check: (c) => c.bossesCleared >= 5 },
  { id: 'survivor_5', check: (c) => c.elapsedSec >= 300 },
  { id: 'survivor_10', check: (c) => c.elapsedSec >= 600 },
  { id: 'survivor_20', check: (c) => c.elapsedSec >= 1200 },
  { id: 'chaser_slapper', check: (c) => c.chaserKnockbacks >= 1 },
  { id: 'quiet_room', check: (c) => c.spaceEvents >= 1 },
  { id: 'prop_hoarder', check: (c) => c.propsPicked >= 10 },
  { id: 'slap_artist', check: (c) => c.skillHits >= 100 },
  { id: 'max_level', check: (c) => c.level >= MAX_LEVEL },
]

/** Run score: survival + behaviour breakdown. */
export function computeScore(ctx: AchievementCtx): number {
  return (
    Math.floor(ctx.elapsedSec) * 1 +
    ctx.skillHits * 10 +
    ctx.bossesCleared * 250 +
    ctx.spaceEvents * 100 +
    ctx.propsPicked * 50 +
    ctx.chaserKnockbacks * 75
  )
}

/** Newly satisfied achievements not already unlocked (set order stable). */
export function checkAchievements(
  ctx: AchievementCtx,
  unlocked: ReadonlySet<AchievementId>,
): AchievementId[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(ctx)).map(
    (a) => a.id,
  )
}

const BEST_KEY = 'civicman.best'
const ACH_KEY = 'civicman.achievements'

export interface BestRecord {
  score: number
  survivalSec: number
  bossesCleared: number
}

export function loadBestRecord(): BestRecord | null {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BestRecord
    if (typeof parsed.score !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function saveBestRecord(record: BestRecord): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(record))
  } catch {
    /* private mode / SSR — best record stays in memory only */
  }
}

export function loadUnlockedAchievements(): Set<AchievementId> {
  try {
    const raw = localStorage.getItem(ACH_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as AchievementId[]
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)))
  } catch {
    return new Set()
  }
}

export function saveUnlockedAchievements(ids: AchievementId[]): void {
  try {
    localStorage.setItem(ACH_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}
