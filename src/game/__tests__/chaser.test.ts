import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import { createInitialLayout } from '../spaceLayout'
import {
  applyChaserKnockback,
  chaserCap,
  createChaser,
  inFaceRadius,
  neighborThreatShare,
  shouldSpawnChaser,
  stepChaser,
} from '../chaser'
import type { NpcState } from '../types'

function stubChaser(overrides: Partial<NpcState> = {}): NpcState {
  return {
    ...createChaser('chaser-0', CONFIG.door.position, 'r0', 0),
    ...overrides,
  }
}

describe('shouldSpawnChaser', () => {
  it('spawns in late era even with one room', () => {
    expect(
      shouldSpawnChaser({
        phase: 'late',
        roomCount: 1,
        neighborShare: 0,
        chaserCount: 0,
        bossPresent: false,
      }),
    ).toBe(true)
  })

  it('spawns on cheese when multi-room and high neighbor share', () => {
    expect(
      shouldSpawnChaser({
        phase: 'mid',
        roomCount: 2,
        neighborShare: 0.5,
        chaserCount: 0,
        bossPresent: false,
      }),
    ).toBe(true)
  })

  it('does not spawn if at cap or boss present', () => {
    expect(
      shouldSpawnChaser({
        phase: 'late',
        roomCount: 1,
        neighborShare: 0,
        chaserCount: 2,
        bossPresent: false,
      }),
    ).toBe(false)
    expect(
      shouldSpawnChaser({
        phase: 'late',
        roomCount: 1,
        neighborShare: 0,
        chaserCount: 0,
        bossPresent: true,
      }),
    ).toBe(false)
  })

  it('does not spawn on same beat as boss', () => {
    expect(
      shouldSpawnChaser({
        phase: 'late',
        roomCount: 1,
        neighborShare: 0,
        chaserCount: 0,
        bossPresent: false,
        bossSpawnThisBeat: true,
      }),
    ).toBe(false)
  })

  it('does not spawn early single-room without cheese', () => {
    expect(
      shouldSpawnChaser({
        phase: 'early',
        roomCount: 1,
        neighborShare: 0,
        chaserCount: 0,
        bossPresent: false,
      }),
    ).toBe(false)
  })

  it('respects pre-late cap of 1', () => {
    expect(chaserCap('mid')).toBe(1)
    expect(
      shouldSpawnChaser({
        phase: 'mid',
        roomCount: 2,
        neighborShare: 0.6,
        chaserCount: 1,
        bossPresent: false,
      }),
    ).toBe(false)
  })

  it('respects population cap', () => {
    expect(
      shouldSpawnChaser({
        phase: 'late',
        roomCount: 1,
        neighborShare: 0,
        chaserCount: 0,
        bossPresent: false,
        totalNpcCount: 10,
        maxNpcs: 10,
      }),
    ).toBe(false)
  })
})

describe('neighborThreatShare', () => {
  it('returns 0 when no threat', () => {
    expect(neighborThreatShare('r0', [])).toBe(0)
  })

  it('returns share from non-player rooms', () => {
    const share = neighborThreatShare('r0', [
      { roomId: 'r0', contribution: 0.3 },
      { roomId: 'r1', contribution: 0.7 },
    ])
    expect(share).toBeCloseTo(0.7)
  })
})

describe('createChaser', () => {
  it('creates a walking chaser at the door', () => {
    const c = createChaser('c1', [0, 0, -4], 'r1', 1000)
    expect(c.role).toBe('chaser')
    expect(c.chaseTarget).toBe(true)
    expect(c.seatIndex).toBe(-1)
    expect(c.status).toBe('walking')
    expect(c.baseLoudness).toBe(CONFIG.chaser.baseLoudness)
    expect(c.roomId).toBe('r1')
    expect(c.position).toEqual([0, 0, -4])
  })
})

describe('inFaceRadius', () => {
  it('is true when player is close', () => {
    const c = stubChaser({ position: [0, 0, 0] })
    expect(inFaceRadius(c, [0.5, 0, 0])).toBe(true)
  })

  it('is false when player is far', () => {
    const c = stubChaser({ position: [0, 0, 0] })
    expect(inFaceRadius(c, [5, 0, 5])).toBe(false)
  })
})

describe('stepChaser', () => {
  const layout = createInitialLayout()

  it('enters smacking when in face radius and not staggered', () => {
    const c = stubChaser({ position: [0, 0, 0], status: 'walking' })
    const next = stepChaser(c, [0.3, 0, 0.3], layout, [], 0.016, 5000)
    expect(next.status).toBe('smacking')
    expect(next.smackingSince).toBe(5000)
  })

  it('does not smack while staggered', () => {
    const c = stubChaser({
      position: [0, 0, 0],
      status: 'walking',
      staggerUntil: 6000,
    })
    const next = stepChaser(c, [0.3, 0, 0.3], layout, [], 0.016, 5000)
    expect(next.status).not.toBe('smacking')
  })

  it('moves toward player when outside face radius', () => {
    const c = stubChaser({ position: [0, 0, 0], status: 'walking' })
    const next = stepChaser(c, [4, 0, 0], layout, [], 0.1, 5000)
    expect(next.position[0]).toBeGreaterThan(0)
    expect(next.status).toBe('walking')
  })

  it('wanders furniture when player is hidden and search not escalated', () => {
    const c = stubChaser({ position: [0, 0, 0], status: 'walking' })
    const before = [...c.position] as [number, number, number]
    const next = stepChaser(c, [4, 0, 0], layout, [], 0.1, 5000, {
      playerHidden: true,
      hideEscalated: false,
      playerRoomId: 'r0',
    })
    expect(next.status).toBe('walking')
    expect(next.position).not.toEqual(before)
    expect(Math.abs(next.position[0] - 4)).toBeGreaterThan(2)
  })

  it('resumes pursuit after hide search escalates', () => {
    const c = stubChaser({ position: [0, 0, 0], status: 'walking' })
    const next = stepChaser(c, [4, 0, 0], layout, [], 0.1, 5000, {
      playerHidden: true,
      hideEscalated: true,
      playerRoomId: 'r0',
    })
    expect(next.position[0]).toBeGreaterThan(0)
  })
})

describe('applyChaserKnockback', () => {
  const now = 10_000
  const playerPos: [number, number, number] = [-2, 0, 0]

  it('moves chaser away from attacker and sets staggerUntil', () => {
    const c = stubChaser({
      position: [0, 0, 0],
      status: 'smacking',
      smackingSince: now - 500,
    })
    const next = applyChaserKnockback(c, playerPos, now)
    const moved = Math.hypot(next.position[0], next.position[2])
    expect(moved).toBeGreaterThan(1)
    expect(next.staggerUntil).toBe(now + CONFIG.chaser.staggerSec * 1000)
    expect(next.status).toBe('walking')
    expect(next.smackingSince).toBe(0)
  })

  it('preserves silenced status when shoved during AoE silence', () => {
    const c = stubChaser({
      position: [0, 0, 0],
      status: 'silenced',
      statusUntil: now + 1500,
    })
    const next = applyChaserKnockback(c, playerPos, now, { dist: 1.1, staggerSec: 0.4 })
    expect(next.status).toBe('silenced')
    expect(next.statusUntil).toBe(now + 1500)
    expect(next.staggerUntil).toBe(now + 400)
  })
})
