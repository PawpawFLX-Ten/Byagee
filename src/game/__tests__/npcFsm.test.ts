import { describe, expect, it } from 'vitest'
import { createNpcs, tickNpcs } from '../npcFsm'

describe('npcFsm', () => {
  it('creates seated NPCs with first already smacking', () => {
    const npcs = createNpcs(1000)
    expect(npcs).toHaveLength(3)
    expect(npcs[0].status).toBe('smacking')
    expect(npcs[1].status).toBe('idle')
  })

  it('transitions idle to smacking after timer', () => {
    const seeded = createNpcs(0).map((n, i) => ({
      ...n,
      status: 'idle' as const,
      statusUntil: i === 0 ? 100 : 999999,
    }))
    const npcs = tickNpcs(seeded, 200, 10)
    expect(npcs[0].status).toBe('smacking')
  })
})
