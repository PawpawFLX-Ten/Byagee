import { describe, expect, it } from 'vitest'
import {
  modulesForElapsed,
  mouthHpForElapsed,
  resolveBossHit,
  demoteBoss,
  tickBossRage,
} from '../bossModules'
import type { NpcState } from '../types'

function boss(partial: Partial<NpcState> = {}): NpcState {
  return {
    id: 'boss',
    status: 'smacking',
    statusUntil: 999999,
    seatIndex: 0,
    position: [0, 0, 0],
    facing: 0,
    baseLoudness: 0.85,
    sealProp: null,
    foodId: null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'boss',
    roomId: 'r0',
    staggerUntil: 0,
    chaseTarget: false,
    scale: 1.4,
    mouthHp: 4,
    mouthHpMax: 4,
    bossModules: { a: true, b: false, c: false },
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

describe('bossModules', () => {
  it('stacks modules by time', () => {
    expect(modulesForElapsed(180)).toEqual({ a: true, b: false, c: false })
    expect(modulesForElapsed(360)).toEqual({ a: true, b: true, c: false })
    expect(modulesForElapsed(540)).toEqual({ a: true, b: true, c: true })
  })

  it('chips mouth HP and only silences at 0', () => {
    const r1 = resolveBossHit(boss({ mouthHp: 2 }), 'silenced', 1.2, 1000, null)
    expect(r1.npc.mouthHp).toBe(1)
    expect(r1.npc.status).toBe('smacking')
    expect(r1.demoted).toBe(false)

    const r2 = resolveBossHit(r1.npc, 'silenced', 1.2, 2000, null)
    expect(r2.npc.mouthHp).toBe(0)
    expect(r2.npc.status).toBe('silenced')
    expect(r2.demoted).toBe(true)
    expect(r2.npc.role).toBe('normal')
  })

  it('rage clears seals on nearby npcs', () => {
    const b = boss({
      mouthHp: 1,
      mouthHpMax: 4,
      bossModules: { a: true, b: true, c: true },
      raging: true,
      position: [0, 0, 0],
    })
    const other: NpcState = {
      ...boss({ id: 'n1', role: 'normal', scale: 1, mouthHp: 0, mouthHpMax: 0 }),
      status: 'sealed',
      sealProp: 'tape',
      position: [1, 0, 0],
      bossModules: { a: false, b: false, c: false },
    }
    const { boss: b2, npcs } = tickBossRage(b, [b, other], 5000)
    expect(b2.raging).toBe(true)
    expect(npcs.find((n) => n.id === 'n1')?.status).not.toBe('sealed')
  })
})
