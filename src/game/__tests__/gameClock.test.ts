import { beforeEach, describe, expect, it } from 'vitest'
import { CLOCK_GAP_MS, clockGapShiftMs, shiftPropClock, shiftStamp } from '../gameClock'
import { useGameStore } from '../store'

const DT = 1 / 60

describe('gameClock pure helpers', () => {
  it('returns 0 before the first tick', () => {
    expect(clockGapShiftMs(0, 1_000_000)).toBe(0)
  })

  it('returns 0 for normal frame gaps', () => {
    expect(clockGapShiftMs(1_000_000, 1_000_016)).toBe(0)
    expect(clockGapShiftMs(1_000_000, 1_000_000 + CLOCK_GAP_MS)).toBe(0)
  })

  it('returns the full gap for pauses and tab-away', () => {
    expect(clockGapShiftMs(1_000_000, 1_000_000 + 60_000)).toBe(60_000)
  })

  it('shiftStamp preserves the zero sentinel', () => {
    expect(shiftStamp(0, 5_000)).toBe(0)
    expect(shiftStamp(1_200, 5_000)).toBe(6_200)
  })

  it('shiftPropClock keeps fadingSince null-ness', () => {
    const prop = {
      id: 'p1',
      type: 'heal' as const,
      position: [0, 0, 0] as [number, number, number],
      spawnedAt: 1_000,
      fadingSince: null,
    }
    expect(shiftPropClock(prop, 500).fadingSince).toBeNull()
    expect(shiftPropClock(prop, 500).spawnedAt).toBe(1_500)
    expect(shiftPropClock({ ...prop, fadingSince: 2_000 }, 500).fadingSince).toBe(2_500)
  })
})

describe('pause and tab-away freeze all wall-clock timers', () => {
  beforeEach(() => {
    useGameStore.getState().start()
    useGameStore.getState().beginMission(1_000_000)
  })

  function runFrames(frames: number, stepMs = DT * 1000): number {
    let now = useGameStore.getState().startedAt
    for (let i = 0; i < frames; i++) {
      now += stepMs
      useGameStore.getState().tick(DT, now)
    }
    return now
  }

  function silencedNpcPatch(id: string, until: number) {
    const { npcs } = useGameStore.getState()
    return {
      npcs: npcs.map((n) =>
        n.id === id ? { ...n, status: 'silenced' as const, statusUntil: until } : n,
      ),
    }
  }

  it('a 60s tab-away does not expire cooldowns or silence', () => {
    let now = runFrames(30)

    // Plant deterministic stamps across domains.
    const npcId = useGameStore.getState().npcs[0]!.id
    useGameStore.setState({
      cooldownReadyAt: {
        tape: 0,
        slap: now + 4_000,
        megaphone: 0,
        gag: 0,
        poop: 0,
        civility: 0,
      },
      selfNoiseUntil: now + 5_000,
      selfNoise: 0.5,
      ...silencedNpcPatch(npcId, now + 6_000),
    })
    const before = useGameStore.getState()

    // Tab away for a minute; rAF resumes with one clamped tick.
    now += 60_000
    useGameStore.getState().tick(DT, now)
    const after = useGameStore.getState()

    // Cooldown still has ~4s left (shifted), not expired.
    expect(after.cooldownReadyAt.slap).toBeGreaterThan(now)
    expect(after.cooldownReadyAt.slap).toBe(before.cooldownReadyAt.slap + 60_000)
    // Self noise still active.
    expect(after.selfNoiseUntil).toBeGreaterThan(now)
    // The silenced NPC is still silenced.
    const silenced = after.npcs.find((n) => n.id === npcId)
    expect(silenced?.status).toBe('silenced')
    expect(silenced!.statusUntil).toBeGreaterThan(now)
  })

  it('elapsed time does not skip ahead after a gap', () => {
    let now = runFrames(60)
    const before = useGameStore.getState()
    now += 120_000
    useGameStore.getState().tick(DT, now)
    const after = useGameStore.getState()
    // Only one simulated frame of gameplay passed — not two minutes.
    expect(after.elapsedSec - before.elapsedSec).toBeLessThan(0.1)
  })

  it('ESC pause freezes timers until resume', () => {
    let now = runFrames(30)
    const store = useGameStore.getState()
    useGameStore.setState({ cooldownReadyAt: { ...store.cooldownReadyAt, slap: now + 8_000 } })

    store.togglePause()
    expect(useGameStore.getState().paused).toBe(true)
    // Ticks during pause are ignored entirely.
    useGameStore.getState().tick(DT, now + 30_000)
    expect(useGameStore.getState().cooldownReadyAt.slap).toBe(now + 8_000)

    store.togglePause()
    now += 30_000
    useGameStore.getState().tick(DT, now)
    const after = useGameStore.getState()
    // Resume shifts stamps by the pause length — cooldown resumes where it froze.
    expect(after.cooldownReadyAt.slap).toBe(now + 8_000)
  })

  it('restart clears the gap tracker', () => {
    runFrames(30)
    useGameStore.getState().restart(5_000_000)
    // A normal first-tick jump right after restart must not shift anything.
    useGameStore.getState().tick(DT, 5_000_000 + DT * 1000)
    const s = useGameStore.getState()
    expect(s.elapsedSec).toBeCloseTo(DT, 1)
  })
})
