import { describe, expect, it } from 'vitest'
import {
  EVENTS,
  consumePendingSpaceEvent,
  onBossDemotedForSpace,
  scheduleFirstReward,
} from '../spaceDirector'
import { CONFIG } from '../config'

describe('spaceDirector store hooks', () => {
  it('first boss demote schedules first reward', () => {
    const now = 50_000
    const result = onBossDemotedForSpace({
      bossesCleared: 0,
      pendingSpaceEventAt: null,
      lastSpaceEventAt: 0,
      now,
      demotedCount: 1,
      eventCooldownSec: CONFIG.space.eventCooldownSec,
    })

    expect(result).toEqual({
      bossesCleared: 1,
      pendingSpaceEventAt: scheduleFirstReward(now),
      minorMorphsSinceBoss: 0,
    })
  })

  it('due pending with lastSpaceEventAt 0 queues an inFirstRewardPool id', () => {
    const now = 60_000
    const pendingAt = scheduleFirstReward(50_000)
    const result = consumePendingSpaceEvent({
      pendingSpaceEventAt: pendingAt,
      queuedSpaceEventId: null,
      lastSpaceEventAt: 0,
      minorMorphsSinceBoss: 0,
      now,
      phaseLate: false,
      eventCooldownSec: CONFIG.space.eventCooldownSec,
      minorMorphMaxBetweenBosses: CONFIG.space.minorMorphMaxBetweenBosses,
      rng: () => 0,
    })

    expect(result).not.toBeNull()
    expect(EVENTS.find((e) => e.id === result!.queuedSpaceEventId)!.inFirstRewardPool).toBe(
      true,
    )
    expect(result!.pendingSpaceEventAt).toBeNull()
    expect(result!.lastSpaceEventAt).toBe(now)
  })

  it('does not queue C5 when minor morph cap is reached', () => {
    const now = 300_000
    const result = consumePendingSpaceEvent({
      pendingSpaceEventAt: now - 1,
      queuedSpaceEventId: null,
      lastSpaceEventAt: now - 200_000,
      minorMorphsSinceBoss: CONFIG.space.minorMorphMaxBetweenBosses,
      now,
      phaseLate: true,
      eventCooldownSec: CONFIG.space.eventCooldownSec,
      minorMorphMaxBetweenBosses: CONFIG.space.minorMorphMaxBetweenBosses,
      rng: () => Math.random(),
    })

    expect(result).not.toBeNull()
    expect(result!.queuedSpaceEventId).not.toBe('C5')
  })

  it('increments minorMorphsSinceBoss when C5 is queued', () => {
    const now = 300_000
    let roll = 0
    const result = consumePendingSpaceEvent({
      pendingSpaceEventAt: now - 1,
      queuedSpaceEventId: null,
      lastSpaceEventAt: now - 200_000,
      minorMorphsSinceBoss: 0,
      now,
      phaseLate: true,
      eventCooldownSec: CONFIG.space.eventCooldownSec,
      minorMorphMaxBetweenBosses: CONFIG.space.minorMorphMaxBetweenBosses,
      rng: () => {
        roll += 1
        return roll >= 50 ? 0.99 : 0
      },
    })

    expect(result).not.toBeNull()
    if (result!.queuedSpaceEventId === 'C5') {
      expect(result!.minorMorphsSinceBoss).toBe(1)
    }
  })
})
