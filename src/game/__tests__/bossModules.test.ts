import { describe, expect, it } from 'vitest'
import {
  interruptBossPulse,
  modulesForElapsed,
  resolveBossHit,
  tickBossRage,
} from '../bossModules'
import { CONFIG } from '../config'
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
    archetype: 'tophat',
    build: 'stout',
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
    pulseChargeUntil: 0,
    pulseCooldownUntil: 0,
    pulseFiredAt: 0,
    ...partial,
  }
}

describe('bossModules', () => {
  it('stacks modules by time', () => {
    const u = CONFIG.boss.moduleUnlockSec
    expect(modulesForElapsed(0)).toEqual({ a: true, b: false, c: false })
    expect(modulesForElapsed(u.b)).toEqual({ a: true, b: true, c: false })
    expect(modulesForElapsed(u.c)).toEqual({ a: true, b: true, c: true })
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
      pulseChargeUntil: 5000,
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

describe('rage pulse state machine', () => {
  function ragingBoss(partial: Partial<NpcState> = {}): NpcState {
    return boss({
      mouthHp: 1,
      mouthHpMax: 4,
      bossModules: { a: true, b: true, c: true },
      raging: true,
      ...partial,
    })
  }

  it('starts charging when cooldown is done', () => {
    const b = ragingBoss({ pulseCooldownUntil: 0 })
    const { boss: b2 } = tickBossRage(b, [b], 10_000)
    expect(b2.pulseChargeUntil).toBe(10_000 + CONFIG.boss.pulseChargeMs)
    expect(b2.pulseFiredAt).toBe(0)
  })

  it('does not start charging during cooldown', () => {
    const b = ragingBoss({ pulseCooldownUntil: 99_999 })
    const { boss: b2 } = tickBossRage(b, [b], 10_000)
    expect(b2.pulseChargeUntil).toBe(0)
  })

  it('fires a single burst when the charge completes', () => {
    const b = ragingBoss({ pulseChargeUntil: 10_000 + CONFIG.boss.pulseChargeMs })
    const other: NpcState = {
      ...boss({ id: 'n1', role: 'normal', scale: 1, mouthHp: 0, mouthHpMax: 0 }),
      status: 'idle',
      position: [1, 0, 0],
      bossModules: { a: false, b: false, c: false },
    }
    const { boss: b2, npcs } = tickBossRage(b, [b, other], 10_000 + CONFIG.boss.pulseChargeMs)
    expect(b2.pulseFiredAt).toBe(10_000 + CONFIG.boss.pulseChargeMs)
    expect(b2.pulseChargeUntil).toBe(0)
    expect(b2.pulseCooldownUntil).toBeGreaterThan(b2.pulseFiredAt)
    // Catalyst applied exactly once on the burst.
    expect(npcs.find((n) => n.id === 'n1')?.status).toBe('smacking')
    const again = tickBossRage(b2, npcs, 10_000 + CONFIG.boss.pulseChargeMs + 10)
    expect(again.npcs.find((n) => n.id === 'n1')?.status).toBe('smacking')
    expect(again.boss.pulseFiredAt).toBe(b2.pulseFiredAt)
  })

  it('ignores npcs outside the pulse radius', () => {
    const b = ragingBoss({ pulseChargeUntil: 10_000 + CONFIG.boss.pulseChargeMs })
    const far: NpcState = {
      ...boss({ id: 'n1', role: 'normal', scale: 1, mouthHp: 0, mouthHpMax: 0 }),
      status: 'idle',
      position: [CONFIG.boss.pulseRadius + 1, 0, 0],
      bossModules: { a: false, b: false, c: false },
    }
    const { npcs } = tickBossRage(b, [b, far], 10_000 + CONFIG.boss.pulseChargeMs)
    expect(npcs.find((n) => n.id === 'n1')?.status).toBe('idle')
  })

  it('interrupt cancels a charge and re-enters cooldown', () => {
    const b = ragingBoss({ pulseChargeUntil: 10_000 + CONFIG.boss.pulseChargeMs })
    const interrupted = interruptBossPulse(b, 10_500)
    expect(interrupted.pulseChargeUntil).toBe(0)
    expect(interrupted.pulseCooldownUntil).toBe(10_500 + CONFIG.boss.pulseInterruptDelayMs)
    expect(interrupted.pulseFiredAt).toBe(0)
  })

  it('interrupt outside charging is a no-op', () => {
    const b = ragingBoss({ pulseChargeUntil: 0 })
    const same = interruptBossPulse(b, 10_500)
    expect(same).toBe(b)
  })

  it('demote clears pulse fields', () => {
    const b = ragingBoss({
      pulseChargeUntil: 12_000,
      pulseCooldownUntil: 0,
      pulseFiredAt: 9_000,
    })
    const demoted = tickBossRage(b, [b], 11_000)
    const gone = resolveBossHit(demoted.boss, 'silenced', 1, 13_000, null, undefined, [])
    expect(gone.npc.pulseChargeUntil).toBe(0)
    expect(gone.npc.pulseCooldownUntil).toBe(0)
    expect(gone.npc.pulseFiredAt).toBe(0)
  })
})
