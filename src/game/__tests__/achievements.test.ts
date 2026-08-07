import { describe, expect, it, vi } from 'vitest'
import {
  ACHIEVEMENTS,
  checkAchievements,
  computeScore,
  loadBestRecord,
  loadUnlockedAchievements,
  saveBestRecord,
  saveUnlockedAchievements,
} from '../achievements'
import type { AchievementCtx } from '../achievements'
import type { AchievementId } from '../types'

function ctx(overrides: Partial<AchievementCtx> = {}): AchievementCtx {
  return {
    elapsedSec: 60,
    skillHits: 0,
    bossesCleared: 0,
    propsPicked: 0,
    spaceEvents: 0,
    chaserKnockbacks: 0,
    level: 1,
    ...overrides,
  }
}

describe('computeScore', () => {
  it('starts at survival seconds', () => {
    expect(computeScore(ctx({ elapsedSec: 120 }))).toBe(120)
  })

  it('applies per-behaviour multipliers', () => {
    expect(
      computeScore(
        ctx({
          elapsedSec: 100,
          skillHits: 2,
          bossesCleared: 1,
          spaceEvents: 1,
          propsPicked: 2,
          chaserKnockbacks: 1,
        }),
      ),
    ).toBe(100 + 20 + 250 + 100 + 100 + 75)
  })

  it('floors survival seconds', () => {
    expect(computeScore(ctx({ elapsedSec: 61.9 }))).toBe(61)
  })
})

describe('checkAchievements', () => {
  it('returns only newly unlocked achievements', () => {
    const unlocked = new Set<AchievementId>(['first_boss'])
    const got = checkAchievements(ctx({ bossesCleared: 5 }), unlocked)
    expect(got).toEqual(['boss_slayer'])
  })

  it('survivor boundaries: 299s no, 300s yes', () => {
    expect(checkAchievements(ctx({ elapsedSec: 299 }), new Set())).toEqual([])
    expect(checkAchievements(ctx({ elapsedSec: 300 }), new Set())).toEqual([
      'survivor_5',
    ])
  })

  it('chaser knockback unlocks only after the first slap-back', () => {
    expect(checkAchievements(ctx({ chaserKnockbacks: 0 }), new Set())).toEqual([])
    expect(checkAchievements(ctx({ chaserKnockbacks: 1 }), new Set())).toEqual([
      'chaser_slapper',
    ])
  })

  it('max level unlocks at the cap', () => {
    expect(checkAchievements(ctx({ level: 9 }), new Set())).toEqual([])
    expect(checkAchievements(ctx({ level: 10 }), new Set())).toEqual([
      'max_level',
    ])
  })

  it('every achievement id has an i18n-shaped def and fires eventually', () => {
    const full = ctx({
      elapsedSec: 9999,
      skillHits: 999,
      bossesCleared: 99,
      propsPicked: 99,
      spaceEvents: 99,
      chaserKnockbacks: 99,
      level: 10,
    })
    const got = checkAchievements(full, new Set())
    expect(got.length).toBe(ACHIEVEMENTS.length)
    expect(new Set(got).size).toBe(ACHIEVEMENTS.length)
  })
})

describe('persistence', () => {
  function memoryStorage(): Storage {
    const map = new Map<string, string>()
    return {
      get length() {
        return map.size
      },
      clear: () => map.clear(),
      getItem: (k) => (map.has(k) ? map.get(k)! : null),
      key: (i) => [...map.keys()][i] ?? null,
      removeItem: (k) => void map.delete(k),
      setItem: (k, v) => void map.set(k, v),
    }
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips best record', () => {
    saveBestRecord({ score: 1234, survivalSec: 300, bossesCleared: 2 })
    expect(loadBestRecord()).toEqual({ score: 1234, survivalSec: 300, bossesCleared: 2 })
  })

  it('round-trips unlocked achievements, dropping unknown ids', () => {
    saveUnlockedAchievements(['first_boss', 'nope' as AchievementId])
    const set = loadUnlockedAchievements()
    expect(set.has('first_boss')).toBe(true)
    expect(set.size).toBe(1)
  })

  it('degrades silently when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => undefined,
      clear: () => undefined,
    })
    expect(loadBestRecord()).toBeNull()
    expect(loadUnlockedAchievements().size).toBe(0)
    expect(() => saveBestRecord({ score: 1, survivalSec: 1, bossesCleared: 0 })).not.toThrow()
    expect(() => saveUnlockedAchievements(['first_boss'])).not.toThrow()
  })
})
