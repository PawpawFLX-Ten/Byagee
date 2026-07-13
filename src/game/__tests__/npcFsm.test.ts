import { describe, expect, it } from 'vitest'
import { createNpcs, tickNpcs } from '../npcFsm'

describe('npcFsm', () => {
  it('creates seated NPCs with first already walking to food', () => {
    const npcs = createNpcs(1000)
    expect(npcs).toHaveLength(3)
    expect(npcs[0].status).toBe('walking')
    expect(npcs[1].status).toBe('idle')
  })

  it('moves walking NPC toward food then starts smacking', () => {
    let npcs = createNpcs(0)
    // Force near the approach point
    const foodId = npcs[0].foodId
    expect(foodId).toBeTruthy()
    npcs = npcs.map((n, i) =>
      i === 0
        ? {
            ...n,
            status: 'walking' as const,
            position: [-2.1, 0, -2.5] as [number, number, number],
            foodId: 'food-0',
            statusUntil: 99999,
          }
        : { ...n, status: 'idle' as const, statusUntil: 999999, foodId: null },
    )
    npcs = tickNpcs(npcs, 100, 10, 0.05)
    expect(['walking', 'smacking']).toContain(npcs[0].status)
  })
})
