import { describe, expect, it } from 'vitest'
import { reverbAmountForArea } from '../audio'
import { CONFIG } from '../config'

const { reverbMin, reverbWetMax, reverbAreaAtMax, reverbSlope } = CONFIG.audio

describe('reverbAmountForArea', () => {
  it('is clamped to the wet max at tiny rooms', () => {
    expect(reverbAmountForArea(4)).toBe(reverbWetMax)
    expect(reverbAmountForArea(reverbAreaAtMax)).toBe(reverbWetMax)
  })

  it('is clamped to the dry floor for the main hall', () => {
    expect(reverbAmountForArea(100)).toBe(reverbMin)
  })

  it('decreases monotonically with area', () => {
    let prev = reverbAmountForArea(5)
    for (let area = 6; area <= 120; area += 1) {
      const cur = reverbAmountForArea(area)
      expect(cur).toBeLessThanOrEqual(prev)
      prev = cur
    }
  })

  it('side-room scale: 30m² sits between wet max and dry floor', () => {
    const wet = reverbAmountForArea(30)
    expect(wet).toBeGreaterThan(reverbMin)
    expect(wet).toBeLessThan(reverbWetMax)
    // 0.34 - 14 * 0.0031 = 0.2966
    expect(wet).toBeCloseTo(reverbWetMax - (30 - reverbAreaAtMax) * reverbSlope, 5)
  })
})
