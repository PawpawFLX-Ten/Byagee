import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'

describe('round2 config', () => {
  it('has three tables and ten seats within door cap', () => {
    expect(CONFIG.tables).toHaveLength(3)
    expect(CONFIG.seatPositions).toHaveLength(10)
    expect(CONFIG.foodSpots.length).toBeGreaterThanOrEqual(10)
    expect(CONFIG.door.maxNpcs).toBe(10)
    expect(CONFIG.npcCount).toBe(CONFIG.door.startNpcCount)
    expect(CONFIG.boss.intervalSec).toBe(180)
    expect(CONFIG.slapShoutLine).toBe('操你妈')
  })
})
