import { describe, expect, it } from 'vitest'
import { computeThreat, hpDrainPerSec } from '../threat'
import type { NpcState } from '../types'

const baseNpc = (overrides: Partial<NpcState> = {}): NpcState => ({
  id: 'npc-0',
  status: 'smacking',
  statusUntil: 99999,
  seatIndex: 0,
  position: [0, 0, 0],
  facing: 0,
  baseLoudness: 0.5,
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
  ...overrides,
})

describe('threat', () => {
  it('is zero when nobody is smacking', () => {
    const threat = computeThreat(
      [baseNpc({ status: 'idle' })],
      [0, 0, 2],
    )
    expect(threat).toBe(0)
  })

  it('rises when smacking nearby', () => {
    const threat = computeThreat([baseNpc()], [0, 0, 1])
    expect(threat).toBeGreaterThan(0.4)
  })

  it('drains HP only above soft/hard thresholds', () => {
    expect(hpDrainPerSec(0.2, 1)).toBe(0)
    expect(hpDrainPerSec(0.5, 1)).toBeCloseTo(11.333, 1)
    expect(hpDrainPerSec(0.9, 1)).toBeCloseTo(38, 1)
    expect(hpDrainPerSec(0.9, 2)).toBeCloseTo(76, 1)
  })
})
