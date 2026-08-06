import { describe, expect, it } from 'vitest'
import {
  EVENTS,
  canFireSpaceEvent,
  pickSpaceEvent,
  scheduleFirstReward,
} from '../spaceDirector'
import type { SpaceEventId } from '../types'
import { CONFIG } from '../config'

describe('spaceDirector', () => {
  it('first reward only picks inFirstRewardPool ids', () => {
    for (let i = 0; i < 50; i++) {
      const id = pickSpaceEvent(() => Math.random(), { isFirst: true, late: false })
      expect(EVENTS.find((e) => e.id === id)!.inFirstRewardPool).toBe(true)
    }
  })

  it('first reward never picks A3, A4, C4, or C5', () => {
    const forbidden = new Set(['A3', 'A4', 'C4', 'C5'])
    for (let i = 0; i < 100; i++) {
      const id = pickSpaceEvent(() => Math.random(), { isFirst: true, late: false })
      expect(forbidden.has(id)).toBe(false)
    }
  })

  it('respects cooldown', () => {
    expect(
      canFireSpaceEvent({ lastSpaceEventAt: 0, now: 50_000, cooldownSec: 120 }),
    ).toBe(false)
    expect(
      canFireSpaceEvent({ lastSpaceEventAt: 0, now: 130_000, cooldownSec: 120 }),
    ).toBe(true)
  })

  it('cooldown is measured from last fire time', () => {
    expect(
      canFireSpaceEvent({ lastSpaceEventAt: 100_000, now: 200_000, cooldownSec: 120 }),
    ).toBe(false)
    expect(
      canFireSpaceEvent({ lastSpaceEventAt: 100_000, now: 221_000, cooldownSec: 120 }),
    ).toBe(true)
  })

  it('scheduleFirstReward adds configured delay after demote', () => {
    const demotedAt = 10_000
    expect(scheduleFirstReward(demotedAt)).toBe(
      demotedAt + CONFIG.space.firstEventDelayAfterBossDemoteMs,
    )
  })

  it('excludes C5 from late pool when allowMinorMorph is false', () => {
    for (let i = 0; i < 100; i++) {
      const id = pickSpaceEvent(() => Math.random(), {
        isFirst: false,
        late: true,
        allowMinorMorph: false,
      })
      expect(id).not.toBe('C5')
    }
  })

  it('can pick C5 from late pool when allowMinorMorph is true', () => {
    const ids = new Set<SpaceEventId>()
    for (let i = 0; i < 200; i++) {
      ids.add(
        pickSpaceEvent(() => Math.random(), {
          isFirst: false,
          late: true,
          allowMinorMorph: true,
        }),
      )
    }
    expect(ids.has('C5')).toBe(true)
  })
})
