import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'

describe('props config', () => {
  it('has valid prop config', () => {
    expect(CONFIG.props.spawnIntervalSec).toBe(45)
    expect(CONFIG.props.healAmount).toBe(35)
    expect(CONFIG.props.silenceSec).toBe(5)
    expect(CONFIG.props.pickupRadius).toBeGreaterThan(0)
  })
})
