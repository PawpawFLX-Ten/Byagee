import { describe, expect, it } from 'vitest'
import { activeDoorPlugins, planDoorAction } from '../doorSystem'
import type { NpcState } from '../types'

function stubNpc(partial: Partial<NpcState> & { id: string }): NpcState {
  return {
    status: 'idle',
    statusUntil: 0,
    seatIndex: 0,
    position: [0, 0, 0],
    facing: 0,
    baseLoudness: 0.4,
    sealProp: null,
    foodId: null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'normal',
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
    ...partial,
  }
}

describe('doorSystem', () => {
  it('unlocks plugins by elapsed time', () => {
    expect(activeDoorPlugins(0).timed).toBe(true)
    expect(activeDoorPlugins(0).threat).toBe(false)
    expect(activeDoorPlugins(60).threat).toBe(true)
    expect(activeDoorPlugins(180).seat).toBe(true)
  })

  it('never plans enter when at cap 10', () => {
    const npcs = Array.from({ length: 10 }, (_, i) => stubNpc({ id: `n${i}`, seatIndex: i }))
    const action = planDoorAction({
      npcs,
      elapsedSec: 10,
      now: 10_000,
      threat: 0.9,
      lastDoorEventAt: 0,
      occupiedSeatIndexes: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    })
    expect(action?.type === 'enter').toBe(false)
  })

  it('boss-inclusive cap: 9 normals + boss blocks enter', () => {
    const npcs = [
      ...Array.from({ length: 9 }, (_, i) => stubNpc({ id: `n${i}`, seatIndex: i })),
      stubNpc({ id: 'boss', role: 'boss', seatIndex: 9 }),
    ]
    const action = planDoorAction({
      npcs,
      elapsedSec: 200,
      now: 200_000,
      threat: 0.1,
      lastDoorEventAt: 0,
      occupiedSeatIndexes: new Set(npcs.map((n) => n.seatIndex)),
    })
    expect(action?.type).not.toBe('enter')
  })
})
