import { CONFIG } from './config'
import type { NpcArchetype, NpcBuild } from './types'

/** Boss always wears the top hat; chasers stay hatless and lean. */
export const BOSS_ARCHETYPE: NpcArchetype = 'tophat'
export const BOSS_BUILD: NpcBuild = 'stout'
export const CHASER_ARCHETYPE: NpcArchetype = 'none'
export const CHASER_BUILD: NpcBuild = 'slim'

/** Weighted pick from a Record of weights using a single rng draw. */
function weightedPick<T extends string>(
  weights: Record<T, number>,
  rng: () => number,
): T {
  const entries = Object.entries(weights) as [T, number][]
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [key, w] of entries) {
    roll -= w
    if (roll < 0) return key
  }
  return entries[entries.length - 1][0]
}

export function pickArchetype(rng: () => number = Math.random): NpcArchetype {
  return weightedPick(CONFIG.diner.archetypeWeights, rng)
}

export function pickBuild(rng: () => number = Math.random): NpcBuild {
  return weightedPick(CONFIG.diner.buildWeights, rng)
}
