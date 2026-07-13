import { describe, expect, it } from 'vitest'
import { tryUseSkill } from '../skills'
import { createNpcs } from '../npcFsm'
import type { SkillId } from '../types'

const cds = (): Record<SkillId, number> => ({
  slap: 0,
  tape: 0,
  megaphone: 0,
  gag: 0,
  poop: 0,
  civility: 0,
})

describe('skills', () => {
  it('silences target in range', () => {
    const npcs = createNpcs(0).map((n, i) =>
      i === 0 ? { ...n, status: 'smacking' as const } : n,
    )
    const result = tryUseSkill(
      'slap',
      npcs,
      npcs[0].position,
      npcs[0].id,
      1000,
      5,
      cds(),
      1,
    )
    expect(result.ok).toBe(true)
    expect(result.npcs[0].status).toBe('silenced')
  })

  it('fails when too far', () => {
    const npcs = createNpcs(0)
    const result = tryUseSkill(
      'slap',
      npcs,
      [20, 0, 20],
      npcs[0].id,
      1000,
      5,
      cds(),
      1,
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('too_far')
  })

  it('respects cooldown', () => {
    const npcs = createNpcs(0)
    const first = tryUseSkill(
      'slap',
      npcs,
      npcs[0].position,
      npcs[0].id,
      1000,
      5,
      cds(),
      1,
    )
    const second = tryUseSkill(
      'slap',
      first.npcs,
      npcs[0].position,
      npcs[0].id,
      1100,
      5,
      first.cooldownReadyAt,
      1,
    )
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('cooldown')
  })
})
