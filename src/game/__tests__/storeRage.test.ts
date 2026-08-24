import { beforeEach, describe, expect, it } from 'vitest'
import { createBossNpc } from '../bossModules'
import { CONFIG } from '../config'
import { useGameStore } from '../store'
import type { NpcState } from '../types'

const DT = 1 / 60
const START = 1_000_000

/** Stationary normal NPC stub for pulse-radius tests. */
function victim(partial: Partial<NpcState>): NpcState {
  return {
    id: 'victim',
    status: 'sealed',
    statusUntil: START + 999_999,
    seatIndex: 1,
    position: [1, 0, 0],
    facing: 0,
    baseLoudness: 0.4,
    sealProp: 'tape',
    foodId: null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'normal',
    archetype: 'none',
    build: 'normal',
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
    idleSince: START,
    smackingSince: 0,
    noiseReduction: 0,
    pulseChargeUntil: 0,
    pulseCooldownUntil: 0,
    pulseFiredAt: 0,
    ...partial,
  }
}

describe('store integration: boss rage pulse through tick', () => {
  beforeEach(() => {
    useGameStore.getState().start()
    useGameStore.getState().beginMission(START)
  })

  function plantRagingBoss() {
    // elapsedSec far beyond moduleUnlockSec.c → all modules incl. rage (c).
    const boss = createBossNpc(0, START, 1_000, 'boss-it')
    boss.status = 'smacking'
    boss.statusUntil = START + 999_999
    boss.position = [0, 0, 0]
    boss.mouthHp = Math.max(1, Math.floor(boss.mouthHpMax * 0.4)) // ≤50% → raging
    const sealed = victim({})
    useGameStore.setState({ npcs: [boss, sealed] })
    return { boss, sealed }
  }

  function runTicks(maxMs: number) {
    let now = START
    const end = now + maxMs
    while (now < end) {
      now += DT * 1000
      useGameStore.getState().tick(DT, now)
      const boss = useGameStore.getState().npcs.find((n) => n.id === 'boss-it')
      if (boss?.pulseFiredAt) return { now, boss }
    }
    const boss = useGameStore.getState().npcs.find((n) => n.id === 'boss-it')
    return { now, boss }
  }

  it('charges, holds progress across frames, and fires', () => {
    plantRagingBoss()

    // First tick starts charging; next tick must NOT reset the charge.
    let now = START
    now += DT * 1000
    useGameStore.getState().tick(DT, now)
    const afterStart = useGameStore
      .getState()
      .npcs.find((n) => n.id === 'boss-it')!
    expect(afterStart.pulseChargeUntil).toBeGreaterThan(0)

    now += DT * 1000
    useGameStore.getState().tick(DT, now)
    const afterHold = useGameStore
      .getState()
      .npcs.find((n) => n.id === 'boss-it')!
    expect(afterHold.pulseChargeUntil).toBe(afterStart.pulseChargeUntil)

    // Charge completes within pulseChargeMs (+frame slack) and fires once.
    const { boss } = runTicks(CONFIG.boss.pulseChargeMs + 500)
    expect(boss!.pulseFiredAt).toBeGreaterThan(0)
    expect(boss!.pulseChargeUntil).toBe(0)
    expect(boss!.pulseCooldownUntil).toBeGreaterThan(boss!.pulseFiredAt)
    expect(boss!.raging).toBe(true)
  })

  it('the burst unseals nearby victims — visible in store state', () => {
    plantRagingBoss()
    runTicks(CONFIG.boss.pulseChargeMs + 500)
    const freed = useGameStore.getState().npcs.find((n) => n.id === 'victim')!
    expect(freed.sealProp).toBeNull()
    expect(freed.status).toBe('smacking')
    expect(freed.smackingSince).toBeGreaterThan(0)
  })

  it('a non-raging boss never charges', () => {
    const boss = createBossNpc(0, START, 1_000, 'boss-it')
    boss.mouthHp = boss.mouthHpMax // full HP → not raging
    useGameStore.setState({ npcs: [boss] })
    const { boss: after } = runTicks(CONFIG.boss.pulseChargeMs + 500)
    expect(after!.pulseFiredAt).toBe(0)
    expect(after!.pulseChargeUntil).toBe(0)
  })
})
