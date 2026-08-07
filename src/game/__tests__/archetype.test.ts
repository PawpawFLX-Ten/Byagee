import { describe, expect, it } from 'vitest'
import {
  BOSS_ARCHETYPE,
  BOSS_BUILD,
  CHASER_ARCHETYPE,
  CHASER_BUILD,
  pickArchetype,
  pickBuild,
} from '../archetype'
import { CONFIG } from '../config'
import { createChaser } from '../chaser'
import { createBossNpc } from '../bossModules'
import { createNpcs } from '../npcFsm'
import type { NpcArchetype, NpcBuild } from '../types'

const ARCHETYPES = Object.keys(CONFIG.diner.archetypeWeights) as NpcArchetype[]
const BUILDS = Object.keys(CONFIG.diner.buildWeights) as NpcBuild[]

/** Deterministic LCG so weight math is reproducible. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('pickArchetype', () => {
  it('only returns valid archetypes', () => {
    const rng = seededRng(1)
    for (let i = 0; i < 200; i++) {
      expect(ARCHETYPES).toContain(pickArchetype(rng))
    }
  })

  it('weight table sums to 100', () => {
    const total = Object.values(CONFIG.diner.archetypeWeights).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('is deterministic for a given seed', () => {
    const a = Array.from({ length: 10 }, () => pickArchetype(seededRng(42)))
    const b = Array.from({ length: 10 }, () => pickArchetype(seededRng(42)))
    expect(a).toEqual(b)
  })
})

describe('pickBuild', () => {
  it('only returns valid builds', () => {
    const rng = seededRng(2)
    for (let i = 0; i < 200; i++) {
      expect(BUILDS).toContain(pickBuild(rng))
    }
  })

  it('weight table sums to 100', () => {
    const total = Object.values(CONFIG.diner.buildWeights).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })
})

describe('role silhouettes', () => {
  it('createNpcs assigns archetype and build to every diner', () => {
    const npcs = createNpcs(0)
    expect(npcs.length).toBeGreaterThan(0)
    for (const n of npcs) {
      expect(ARCHETYPES).toContain(n.archetype)
      expect(BUILDS).toContain(n.build)
    }
  })

  it('createChaser is hatless and slim', () => {
    const c = createChaser('c1', [0, 0, -4], 'r1', 1000)
    expect(c.archetype).toBe(CHASER_ARCHETYPE)
    expect(c.build).toBe(CHASER_BUILD)
  })

  it('createBossNpc wears top hat and is stout', () => {
    const b = createBossNpc(0, 1000, 0, 'boss-1')
    expect(b.archetype).toBe(BOSS_ARCHETYPE)
    expect(b.build).toBe(BOSS_BUILD)
  })
})
