import { CONFIG } from './config'

export const MAX_LEVEL = 10
export const XP_PER_SKILL_HIT_NORMAL = 10
export const XP_PER_SKILL_HIT_BOSS = 25
export const XP_PER_BOSS_DEMOTE = 100
export const XP_PER_SURVIVAL_SEC = 1

export function levelForXp(xp: number): number {
  let level = 1
  for (const threshold of CONFIG.levelXpTable) {
    if (xp >= threshold) level++
    else break
  }
  return Math.min(level, MAX_LEVEL)
}

export function xpForNextLevel(level: number): number | null {
  if (level >= MAX_LEVEL) return null
  return CONFIG.levelXpTable[level - 1]
}

export function cdMultiplier(level: number): number {
  return Math.max(0.5, 1 - 0.03 * (level - 1))
}

export function rangeMultiplier(level: number): number {
  return 1 + 0.02 * (level - 1)
}

export function isMaxLevel(level: number): boolean {
  return level >= MAX_LEVEL
}

/** At max level, overflow XP heals HP: 1 HP per 5 XP. */
export function overflowHeal(xpGained: number): number {
  return Math.floor(xpGained / 5)
}

/** Q skill unlocks at level 5, E skill unlocks at level 10. */
export function isQUnlocked(level: number): boolean {
  return level >= 5
}
export function isEUnlocked(level: number): boolean {
  return level >= 10
}
