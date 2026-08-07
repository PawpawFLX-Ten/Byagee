import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import { createChaser } from '../chaser'
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

  it('slap on chaser knocks back and staggers without silencing', () => {
    const chaser = {
      ...createChaser('chaser-0', [0, 0, 0], 'r0', 0),
      status: 'smacking' as const,
      smackingSince: 900,
    }
    const result = tryUseSkill(
      'slap',
      [chaser],
      [-2, 0, 0],
      chaser.id,
      1000,
      5,
      cds(),
      1,
    )
    expect(result.ok).toBe(true)
    const hit = result.npcs[0]
    expect(hit.staggerUntil).toBe(1000 + CONFIG.chaser.staggerSec * 1000)
    expect(Math.hypot(hit.position[0], hit.position[2])).toBeGreaterThan(1)
    expect(hit.status).toBe('walking')
    expect(hit.smackingSince).toBe(0)
  })

  it('slap on seated diner does not move seat position', () => {
    const npcs = createNpcs(0).map((n, i) =>
      i === 0 ? { ...n, status: 'smacking' as const } : n,
    )
    const seatPos = [...npcs[0].position] as [number, number, number]
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
    expect(result.npcs[0].position).toEqual(seatPos)
    expect(result.npcs[0].status).toBe('silenced')
  })

  it('megaphone shoves chasers but not seated diners', () => {
    const chaser = {
      ...createChaser('chaser-0', [1, 0, 0], 'r0', 0),
      status: 'smacking' as const,
    }
    const seated = createNpcs(0).map((n, i) =>
      i === 0 ? { ...n, status: 'smacking' as const } : n,
    )[0]
    const seatedPos = [...seated.position] as [number, number, number]
    const result = tryUseSkill(
      'megaphone',
      [chaser, seated],
      [0, 0, 0],
      null,
      1000,
      5,
      cds(),
      1,
    )
    expect(result.ok).toBe(true)
    const hitChaser = result.npcs.find((n) => n.id === chaser.id)!
    const hitSeated = result.npcs.find((n) => n.id === seated.id)!
    expect(Math.hypot(hitChaser.position[0], hitChaser.position[2])).toBeGreaterThan(1.2)
    expect(hitChaser.staggerUntil).toBeGreaterThan(1000)
    expect(hitSeated.position).toEqual(seatedPos)
    expect(hitSeated.status).toBe('silenced')
  })

  it('civility shoves walking chasers like megaphone', () => {
    const chaser = {
      ...createChaser('chaser-0', [1, 0, 0], 'r0', 0),
      status: 'walking' as const,
    }
    const result = tryUseSkill(
      'civility',
      [chaser],
      [0, 0, 0],
      null,
      1000,
      5,
      cds(),
      10,
    )
    expect(result.ok).toBe(true)
    const hit = result.npcs[0]
    expect(Math.hypot(hit.position[0], hit.position[2])).toBeGreaterThan(0.8)
    expect(hit.staggerUntil).toBeGreaterThan(1000)
  })

  it('poop cone hits only NPCs within the facing cone', () => {
    const mk = (x: number, z: number, id: string) => ({
      ...createNpcs(0)[0],
      id,
      status: 'smacking' as const,
      position: [x, 0, z] as [number, number, number],
    })
    // Facing +Z (yaw 0): targets in front (z>0) hit, behind (z<0) not.
    const front = mk(0.5, 4, 'front')
    const behind = mk(0.5, -4, 'behind')
    const wide = mk(4, 0.5, 'wide') // ~83° off axis → outside 120° cone (60° half)
    const result = tryUseSkill(
      'poop',
      [front, behind, wide],
      [0, 0, 0],
      null,
      1000,
      5,
      cds(),
      5,
      { facingYaw: 0 },
    )
    expect(result.ok).toBe(true)
    expect(result.hitIds).toContain('front')
    expect(result.hitIds).not.toContain('behind')
    expect(result.hitIds).not.toContain('wide')
  })

  it('poop cone fails when no NPC inside the cone', () => {
    const mk = (x: number, z: number, id: string) => ({
      ...createNpcs(0)[0],
      id,
      status: 'smacking' as const,
      position: [x, 0, z] as [number, number, number],
    })
    const result = tryUseSkill(
      'poop',
      [mk(0.5, -4, 'behind')],
      [0, 0, 0],
      null,
      1000,
      5,
      cds(),
      5,
      { facingYaw: 0 },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_target')
  })
})
