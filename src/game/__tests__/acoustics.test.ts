import { describe, expect, it } from 'vitest'
import { floorFactor, openingFactor, roomGate } from '../acoustics'
import { CONFIG } from '../config'

describe('acoustics', () => {
  it('same room gate is 1', () => {
    expect(roomGate('r0', 'r0', 0)).toBe(1)
  })

  it('neighbor hop uses neighbor gate', () => {
    expect(roomGate('r0', 'r1', 1)).toBeCloseTo(CONFIG.acoustics.roomGateNeighbor)
  })

  it('far hop uses far gate', () => {
    expect(roomGate('r0', 'r2', 2)).toBeCloseTo(CONFIG.acoustics.roomGateFar)
  })

  it('closed door further mutes', () => {
    expect(openingFactor(true)).toBeLessThan(openingFactor(false))
  })

  it('cross-floor same room muffles slightly', () => {
    expect(floorFactor(true, false)).toBeCloseTo(CONFIG.acoustics.floorFactorSameRoom)
    expect(floorFactor(true, true)).toBe(1)
  })
})
