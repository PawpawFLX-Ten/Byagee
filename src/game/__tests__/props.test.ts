import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import { shouldSpawnProp, sampleFloorPosition, pickPropType, checkPickup, applyPropEffect } from '../props'
import type { NpcState, PropState } from '../types'

describe('props config', () => {
  it('has valid prop config', () => {
    expect(CONFIG.props.spawnIntervalSec).toBe(45)
    expect(CONFIG.props.healAmount).toBe(35)
    expect(CONFIG.props.silenceSec).toBe(5)
    expect(CONFIG.props.pickupRadius).toBeGreaterThan(0)
  })
})

function stubNpc(partial: Partial<NpcState> & { id: string }): NpcState {
  return {
    status: 'smacking',
    statusUntil: 999999,
    seatIndex: 0,
    position: [0, 0, 0],
    facing: 0,
    baseLoudness: 0.4,
    sealProp: null,
    foodId: null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'normal',
    roomId: 'r0',
    staggerUntil: 0,
    chaseTarget: false,
    scale: 1,
    mouthHp: 0,
    mouthHpMax: 0,
    bossModules: { a: false, b: false, c: false },
    comboHits: 0,
    lastHitAt: 0,
    raging: false,
    exiting: false,
    idleSince: 0,
    smackingSince: 0,
    noiseReduction: 0,
    ...partial,
  }
}

describe('shouldSpawnProp', () => {
  it('spawns when interval elapsed', () => {
    expect(shouldSpawnProp({ elapsedSec: 45, nextPropAt: 45, existingProps: [], alive: true })).toBe(true)
  })

  it('spawns even when other props exist on floor', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    expect(shouldSpawnProp({ elapsedSec: 90, nextPropAt: 90, existingProps: [prop], alive: true })).toBe(true)
  })

  it('does not spawn beyond the floor cap', () => {
    const props: PropState[] = Array.from({ length: CONFIG.props.maxOnFloor }, (_, i) => ({
      id: `p${i}`,
      type: 'heal',
      position: [i, 0.5, 0],
      spawnedAt: 0,
      fadingSince: null,
    }))
    expect(shouldSpawnProp({ elapsedSec: 90, nextPropAt: 90, existingProps: props, alive: true })).toBe(false)
  })

  it('does not spawn when dead', () => {
    expect(shouldSpawnProp({ elapsedSec: 45, nextPropAt: 45, existingProps: [], alive: false })).toBe(false)
  })

  it('does not spawn before interval', () => {
    expect(shouldSpawnProp({ elapsedSec: 30, nextPropAt: 45, existingProps: [], alive: true })).toBe(false)
  })
})

describe('pickPropType', () => {
  it('returns heal or silence', () => {
    const type = pickPropType(100, 100)
    expect(['heal', 'silence']).toContain(type)
  })

  it('skews toward heal at low HP', () => {
    let healCount = 0
    for (let i = 0; i < 1000; i++) {
      if (pickPropType(10, 100) === 'heal') healCount++
    }
    // At HP 10/100, heal weight = 0.95, so expect >85% heal
    expect(healCount).toBeGreaterThan(850)
  })

  it('roughly 50/50 at full HP', () => {
    let healCount = 0
    for (let i = 0; i < 1000; i++) {
      if (pickPropType(100, 100) === 'heal') healCount++
    }
    // At full HP, heal weight = 0.5, so expect 40-60%
    expect(healCount).toBeGreaterThan(400)
    expect(healCount).toBeLessThan(600)
  })
})

describe('sampleFloorPosition', () => {
  it('returns a position within room bounds', () => {
    const [x, , z] = sampleFloorPosition(CONFIG.tables, CONFIG.door.position)
    expect(Math.abs(x)).toBeLessThan(CONFIG.props.spawnMargin + 4)
    expect(Math.abs(z)).toBeLessThan(CONFIG.props.spawnMargin + 4)
  })

  it('avoids table area', () => {
    for (let i = 0; i < 50; i++) {
      const [x, , z] = sampleFloorPosition(CONFIG.tables, CONFIG.door.position)
      for (const t of CONFIG.tables) {
        const dx = Math.abs(x - t.position[0])
        const dz = Math.abs(z - t.position[2])
        const margin = CONFIG.props.tableMargin
        // Should not be inside table collider + margin
        expect(dx > t.half.x + margin || dz > t.half.z + margin).toBe(true)
      }
    }
  })
})

describe('checkPickup', () => {
  it('returns prop when player is within radius', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [1, 0.5, 1], spawnedAt: 0, fadingSince: null }
    const result = checkPickup([prop], [1.2, 0, 1.3], 0.8)
    expect(result?.id).toBe('p1')
  })

  it('returns null when player is too far', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [1, 0.5, 1], spawnedAt: 0, fadingSince: null }
    const result = checkPickup([prop], [4, 0, 4], 0.8)
    expect(result).toBeNull()
  })

  it('skips fading props', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [1, 0.5, 1], spawnedAt: 0, fadingSince: 5000 }
    const result = checkPickup([prop], [1, 0, 1], 0.8)
    expect(result).toBeNull()
  })
})

describe('applyPropEffect', () => {
  it('heal prop restores HP capped at maxHp', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const result = applyPropEffect(prop, [], 80, 100, 1000)
    expect(result.hp).toBe(100) // capped
    expect(result.toastText).toContain('35')
  })

  it('heal prop restores HP when not capped', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const result = applyPropEffect(prop, [], 50, 100, 1000)
    expect(result.hp).toBe(85)
  })

  it('silence prop silences normal NPCs', () => {
    const prop: PropState = { id: 'p1', type: 'silence', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const npcs = [
      stubNpc({ id: 'n1', status: 'smacking' }),
      stubNpc({ id: 'n2', status: 'idle' }),
    ]
    const result = applyPropEffect(prop, npcs, 80, 100, 5000)
    expect(result.npcs.every((n) => n.status === 'silenced')).toBe(true)
    expect(result.npcs.every((n) => n.statusUntil === 5000 + 5000)).toBe(true)
  })

  it('silence prop does NOT affect Boss', () => {
    const prop: PropState = { id: 'p1', type: 'silence', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const npcs = [
      stubNpc({ id: 'n1', status: 'smacking', role: 'normal' }),
      stubNpc({ id: 'boss1', status: 'smacking', role: 'boss' }),
    ]
    const result = applyPropEffect(prop, npcs, 80, 100, 5000)
    const boss = result.npcs.find((n) => n.id === 'boss1')
    const normal = result.npcs.find((n) => n.id === 'n1')
    expect(boss?.status).toBe('smacking') // unchanged
    expect(normal?.status).toBe('silenced') // silenced
  })
})
