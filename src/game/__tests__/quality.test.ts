import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import { createChaser } from '../chaser'
import { useGameStore } from '../store'
import { availableSides, hopDistance, roomIdAtY } from '../spaceLayout'

/**
 * Quality gates: smoke, performance, stress, concurrency.
 * Runs the real store singleton (game loop) under controlled clock.
 */

const DT = 1 / 60
const MAX_HP = CONFIG.maxHp

/** Deterministic LCG so long sims are reproducible. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function withSeededRng(seed: number, fn: () => void) {
  const original = Math.random
  Math.random = seededRng(seed)
  try {
    fn()
  } finally {
    Math.random = original
  }
}

function assertSanity(step: number) {
  const s = useGameStore.getState()
  expect(Number.isFinite(s.hp), `hp finite @step ${step}`).toBe(true)
  expect(s.hp).toBeGreaterThanOrEqual(0)
  expect(s.hp).toBeLessThanOrEqual(MAX_HP)
  expect(Number.isFinite(s.elapsedSec)).toBe(true)
  expect(Number.isFinite(s.playerYaw)).toBe(true)
  expect(s.playerPos.every(Number.isFinite)).toBe(true)
  expect(s.npcs.length).toBeLessThanOrEqual(s.maxNpcs)

  const ids = new Set<string>()
  for (const n of s.npcs) {
    expect(n.position.every(Number.isFinite), `npc ${n.id} pos @${step}`).toBe(true)
    expect(Number.isFinite(n.facing)).toBe(true)
    expect(n.statusUntil).toBeGreaterThan(0)
    expect(ids.has(n.id), `unique id ${n.id} @${step}`).toBe(false)
    ids.add(n.id)
    if (n.role === 'boss') {
      expect(Number.isFinite(n.pulseChargeUntil), `boss pulse @${step}`).toBe(true)
      expect(Number.isFinite(n.pulseCooldownUntil), `boss pulse cd @${step}`).toBe(true)
      expect(Number.isFinite(n.pulseFiredAt), `boss pulse fired @${step}`).toBe(true)
    }
  }
  expect(s.props.length).toBeLessThanOrEqual(CONFIG.props.maxOnFloor)
  for (const p of s.props) {
    expect(p.position.every(Number.isFinite)).toBe(true)
  }
  for (const [k, v] of Object.entries(s.cooldownReadyAt)) {
    expect(Number.isFinite(v), `cd ${k} @${step}`).toBe(true)
  }
  if (s.targetId !== null) {
    expect(s.npcs.some((n) => n.id === s.targetId), `target alive @${step}`).toBe(true)
  }
  if (s.npcs.some((n) => n.role === 'boss')) {
    expect(s.bossEtaSec).toBeNull()
  }
}

/** Run `frames` ticks advancing a fake clock; returns the final elapsed. */
function runFrames(frames: number, dt = DT, startNow = 1_000_000): number {
  const store = useGameStore.getState()
  store.beginMission(startNow)
  let now = startNow
  for (let i = 0; i < frames; i++) {
    now += dt * 1000
    useGameStore.getState().tick(dt, now)
  }
  return (now - startNow) / 1000
}

function forceSpaceEvent(
  eventId: 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6',
  now: number,
) {
  useGameStore.setState({
    queuedSpaceEventId: eventId,
    pendingSpaceEventAt: null,
    lastSpaceEventAt: now - CONFIG.space.eventCooldownSec * 1000,
    minorMorphsSinceBoss: 0,
  })
}

describe('smoke: 10s of a normal game', () => {
  it('boots, ticks, and keeps every invariant', () => {
    withSeededRng(7, () => {
      const elapsed = runFrames(600)
      expect(elapsed).toBeCloseTo(10, 0)
      const s = useGameStore.getState()
      expect(s.npcs.length).toBeGreaterThanOrEqual(CONFIG.npcCount)
      expect(s.hp).toBeGreaterThan(0)
      assertSanity(600)
    })
  })

  it('skills, latch, hide and restart all work end to end', () => {
    withSeededRng(3, () => {
      const store = useGameStore.getState()
      store.beginMission(1_000_000)
      let now = 1_000_000
      for (let i = 0; i < 120; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      // Skill spam must not throw and must respect cooldowns.
      const before = useGameStore.getState().cooldownReadyAt.slap
      useGameStore.getState().useSkill('slap', now)
      const after = useGameStore.getState().cooldownReadyAt.slap
      expect(after).toBeGreaterThanOrEqual(before)

      // Re-latch cooldown: first latch ok, immediate second is blocked.
      const layout = useGameStore.getState().layout
      if (layout.openings.length > 0) {
        const first = useGameStore.getState().applyLatch(layout.openings[0].id, now)
        expect(first).toBe(true)
        const second = useGameStore.getState().applyLatch(layout.openings[0].id, now)
        expect(second).toBe(false)
        expect(useGameStore.getState().toast).not.toBeNull()
      }

      // Hide toggle + restart.
      useGameStore.getState().setHideState(true, now)
      expect(useGameStore.getState().playerHidden).toBe(true)
      useGameStore.getState().restart(now + 5000)
      expect(useGameStore.getState().playerHidden).toBe(false)
      expect(useGameStore.getState().alive).toBe(true)
      expect(useGameStore.getState().elapsedSec).toBe(0)
    })
  })
})

describe('performance: tick cost under load', () => {
  it('runs 5k ticks in well under a frame budget per tick', () => {
    withSeededRng(11, () => {
      const store = useGameStore.getState()
      store.beginMission(2_000_000)
      let now = 2_000_000
      // Warm up 30s so NPCs are smacking and door traffic runs.
      for (let i = 0; i < 30 * 60; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const count = 5000
      const t0 = performance.now()
      for (let i = 0; i < count; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const t1 = performance.now()
      const perTick = (t1 - t0) / count
      // Generous gate: full logic tick must stay far below 16ms budget.
      expect(perTick).toBeLessThan(3)
      assertSanity(30 * 60 + count)
    })
  })

  it('stays fast with a full 24+ seat post-expansion hall', () => {
    withSeededRng(13, () => {
      const store = useGameStore.getState()
      store.beginMission(3_000_000)
      let now = 3_000_000
      // Grow the hall repeatedly (A1/A3 add seats) then run the loop.
      for (let i = 0; i < 300; i++) {
        now += DT * 1000
        forceSpaceEvent(i % 2 === 0 ? 'A1' : 'A3', now)
        useGameStore.getState().tick(DT, now)
      }
      const seats = useGameStore.getState().runtimeSeats.length
      expect(seats).toBeGreaterThan(CONFIG.seatPositions.length + 6)
      const t0 = performance.now()
      for (let i = 0; i < 3000; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const perTick = (performance.now() - t0) / 3000
      expect(perTick).toBeLessThan(3)
      assertSanity(3300)
    })
  })

  it('stays fast with upstairs rooms and stair wedges at full population', () => {
    withSeededRng(17, () => {
      const store = useGameStore.getState()
      store.beginMission(6_000_000)
      let now = 6_000_000
      // Expand + upstairs + bar so NPCs walk ramps and cross floors.
      for (const id of ['A4', 'C4', 'A1', 'A5'] as const) {
        forceSpaceEvent(id, now)
        for (let i = 0; i < 60; i++) {
          now += DT * 1000
          useGameStore.getState().tick(DT, now)
        }
      }
      // Long enough for door traffic into the upstairs seats.
      for (let i = 0; i < 60 * 60 * 2; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const s = useGameStore.getState()
      expect(s.layout.stairs.length).toBeGreaterThanOrEqual(2)
      const t0 = performance.now()
      for (let i = 0; i < 3000; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const perTick = (performance.now() - t0) / 3000
      expect(perTick).toBeLessThan(3)
      assertSanity(60 * 60 * 2 + 3000)
    })
  })
})

describe('stress: 20 minute marathon with everything enabled', () => {
  it('survives 20 min of sim: events, door traffic, chasers, bosses, props', () => {
    withSeededRng(21, () => {
      const store = useGameStore.getState()
      store.beginMission(4_000_000)
      let now = 4_000_000
      let bossSeen = false
      let chaserSeen = false
      const totalFrames = Math.round((20 * 60) / (DT * 5)) // ~5x speed
      for (let i = 0; i < totalFrames; i++) {
        const dt = DT * 5
        now += dt * 1000
        // Inject one space event every ~60s of game time.
        const gameSec = (now - 4_000_000) / 1000
        if (gameSec % 60 < 5 && i % 2 === 0) {
          const pick = ['A1', 'A2', 'A3', 'A5', 'C1', 'C2', 'C3', 'C6'][i % 8] as const
          forceSpaceEvent(pick, now)
        }
        const cur = useGameStore.getState()
        // Auto-player: fight the boss, suppress smackers, never die (god mode),
        // so every system (boss demote → events, chasers, door) keeps running.
        if (cur.npcs.some((n) => n.role === 'boss')) {
          if (i % 8 === 0) cur.useSkill('slap', now)
        } else if (cur.threat > 0.3) {
          if (i % 4 === 0) cur.useSkill('slap', now)
          if (i % 17 === 0) cur.useSkill('tape', now)
        }
        if (cur.hp < 45) useGameStore.setState({ hp: 60 })
        useGameStore.getState().tick(dt, now)
        const s = useGameStore.getState()
        if (s.npcs.some((n) => n.role === 'boss')) bossSeen = true
        if (s.npcs.some((n) => n.role === 'chaser')) chaserSeen = true
        if (i % 300 === 0) assertSanity(i)
      }
      // Late phase should have produced both a boss and chasers.
      expect(bossSeen).toBe(true)
      expect(chaserSeen).toBe(true)
      assertSanity(totalFrames)
    })
  }, 120_000)

  it('capped props: never exceeds maxOnFloor even at max level', () => {
    withSeededRng(29, () => {
      const store = useGameStore.getState()
      store.beginMission(5_000_000)
      let now = 5_000_000
      // Force max level so xp overflow healing is active.
      useGameStore.setState({ xp: 10_000, level: 10 })
      for (let i = 0; i < 60 * 60 * 6; i++) {
        now += DT * 1000 * 2
        useGameStore.getState().tick(DT * 2, now)
      }
      expect(useGameStore.getState().props.length).toBeLessThanOrEqual(
        CONFIG.props.maxOnFloor,
      )
    })
  })

  it('stats accumulate and best record persists on death', () => {
    withSeededRng(23, () => {
      const store = useGameStore.getState()
      store.beginMission(8_000_000)
      let now = 8_000_000
      for (let i = 0; i < 60 * 60 * 3; i++) {
        now += DT * 1000 * 2
        const s = useGameStore.getState()
        // Keep fighting so skill/prop/event counters climb.
        if (i % 5 === 0) s.useSkill('slap', now)
        if (s.hp < 50) useGameStore.setState({ hp: 60 })
        useGameStore.getState().tick(DT * 2, now)
      }
      const mid = useGameStore.getState()
      expect(mid.stats.skillHits).toBeGreaterThan(0)
      expect(mid.stats.spaceEvents + mid.stats.propsPicked).toBeGreaterThanOrEqual(0)

      // Force death → score finalizes and best record is written.
      useGameStore.setState({ hp: 0 })
      useGameStore.getState().tick(DT, now + 1000)
      const after = useGameStore.getState()
      expect(after.alive).toBe(false)
      expect(after.lastScore).toBeGreaterThan(0)
      expect(after.best).not.toBeNull()
      expect(after.best!.score).toBe(after.lastScore)
      expect(after.achievementQueue.length).toBeGreaterThanOrEqual(0)
    })
  })

  it('random-side events keep room/door/seat invariants in the long run', () => {
    withSeededRng(31, () => {
      const store = useGameStore.getState()
      store.beginMission(9_000_000)
      let now = 9_000_000
      const ids = ['A1', 'A2', 'A3', 'A5', 'C1', 'C2', 'C3', 'C5', 'C6'] as const
      const total = 60 * 60 * 4
      for (let i = 0; i < total; i++) {
        now += DT * 1000 * 2
        if (i % 60 === 0) forceSpaceEvent(ids[i % ids.length], now)
        useGameStore.getState().tick(DT * 2, now)
      }
      const s = useGameStore.getState()
      expect(s.layout.rooms.length).toBeGreaterThan(4)
      expect(s.layout.openings.length).toBeGreaterThanOrEqual(s.layout.rooms.length - 1)
      const rooms = s.layout.rooms
      for (let a = 0; a < rooms.length; a++) {
        for (let b = a + 1; b < rooms.length; b++) {
          const ra = rooms[a]!
          const rb = rooms[b]!
          const overlap =
            ra.min[0] < rb.max[0] &&
            ra.max[0] > rb.min[0] &&
            ra.min[1] < rb.max[1] &&
            ra.max[1] > rb.min[1]
          expect(overlap, `rooms ${ra.id}/${rb.id} overlap`).toBe(false)
        }
      }
      assertSanity(total)
    })
  }, 120_000)

  it('space event degrades gracefully when no side is free', () => {
    withSeededRng(5, () => {
      const store = useGameStore.getState()
      store.beginMission(9_500_000)
      const layout = useGameStore.getState().layout
      layout.obstacles.push(
        { id: 'block-n', min: [-16, -12], max: [16, -6] },
        { id: 'block-s', min: [-16, 6], max: [16, 16] },
        { id: 'block-e', min: [6, -12], max: [16, 12] },
        { id: 'block-w', min: [-16, -12], max: [-6, 12] },
      )
      useGameStore.setState({ layout })
      forceSpaceEvent('A1', 9_500_000)
      let now = 9_500_000
      for (let i = 0; i < 60; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const s = useGameStore.getState()
      expect(s.layout.rooms.length).toBe(1)
      expect(s.stats.spaceEvents).toBe(1)
      expect(s.queuedSpaceEventId).toBeNull()
      assertSanity(60)
    })
  })

  it('spaceEventAt marks the event moment and resets on restart', () => {
    withSeededRng(61, () => {
      const store = useGameStore.getState()
      store.beginMission(13_000_000)
      expect(useGameStore.getState().spaceEventAt).toBeNull()
      let now = 13_000_000
      forceSpaceEvent('A1', now)
      for (let i = 0; i < 5; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const fired = useGameStore.getState()
      expect(fired.spaceEventAt).toBeGreaterThan(0)
      expect(fired.spaceEventToast).not.toBeNull()
      useGameStore.getState().restart(now)
      expect(useGameStore.getState().spaceEventAt).toBeNull()
      expect(useGameStore.getState().spaceEventToast).toBeNull()
    })
  })
})

describe('concurrency: interleaved player actions during events', () => {
  it('spams skills/latch/hide/restart while space events morph the hall', () => {
    withSeededRng(31, () => {
      const store = useGameStore.getState()
      store.beginMission(6_000_000)
      let now = 6_000_000
      let died = false
      for (let i = 0; i < 4000; i++) {
        now += DT * 1000
        const s = useGameStore.getState()
        // Interleave a mix of player actions every few frames.
        if (i % 3 === 0) s.useSkill('slap', now)
        if (i % 5 === 0) s.useSkill('tape', now)
        if (i % 7 === 0) s.useSkill('megaphone', now)
        if (i % 11 === 0) s.useSkill('gag', now)
        if (i % 13 === 0 && s.level >= 5) s.useSkill('poop', now)
        if (i % 17 === 0) s.cycleTarget()
        if (i % 19 === 0) s.setHideState(i % 38 === 0, now)
        if (i % 23 === 0) {
          const o = s.layout.openings[0]
          if (o) s.applyLatch(o.id, now)
        }
        if (i % 500 === 0 && now % 2 === 0) {
          // Mix ground expansions, morphs and upstairs events in the storm.
          const pick = ['A1', 'A2', 'A3', 'A5', 'C1', 'C2', 'C3', 'C5', 'C6'][i % 9] as const
          forceSpaceEvent(pick, now)
        }
        if (i % 700 === 0 && now % 2 === 1) {
          forceSpaceEvent(i % 1400 === 700 ? 'A4' : 'C4', now)
        }
        useGameStore.getState().tick(DT, now)
        if (i % 400 === 0) assertSanity(i)
        if (useGameStore.getState().alive === false) {
          died = true
          useGameStore.getState().restart(now)
        }
      }
      // Death+restart cycling is part of the storm; final state must be sane.
      assertSanity(4000)
      void died
    })
  })

  it('skill windup resolution racing a space event does not corrupt seats', () => {
    withSeededRng(37, () => {
      const store = useGameStore.getState()
      store.beginMission(7_000_000)
      let now = 7_000_000
      // Start a gag windup (long), then morph the hall mid-windup.
      const s0 = useGameStore.getState()
      s0.useSkill('gag', now)
      for (let i = 0; i < 40; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      forceSpaceEvent('C2', now)
      for (let i = 0; i < 40; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const s = useGameStore.getState()
      assertSanity(80)
      for (const n of s.npcs) {
        expect(Number.isInteger(n.seatIndex)).toBe(true)
      }
      // Seated NPCs must sit inside the current (shrunk) layout.
      for (const n of s.npcs) {
        if (n.seatIndex < 0 || n.exiting) continue
        const seat = s.runtimeSeats[n.seatIndex]
        expect(seat).toBeDefined()
      }
    })
  })
})

describe('upstairs events in long runs', () => {
  it('A4/C4 keep the layout navigable with reachable seats and no Y teleports', () => {
    withSeededRng(53, () => {
      const store = useGameStore.getState()
      store.beginMission(11_000_000)
      let now = 11_000_000

      forceSpaceEvent('A4', now)
      for (let i = 0; i < 60; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const s1 = useGameStore.getState()
      const upper1 = s1.layout.rooms.find((r) => r.floor === 1)
      expect(upper1).toBeDefined()
      expect(s1.layout.stairs.length).toBeGreaterThanOrEqual(1)
      expect(hopDistance(s1.layout, 'r0', upper1!.id)).toBe(1)
      // The floating upstairs room must not eat ground-floor expansion sides.
      expect(availableSides(s1.layout, 'r0', 4, 6)).toHaveLength(4)

      forceSpaceEvent('C4', now)
      for (let i = 0; i < 60; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const s2 = useGameStore.getState()
      expect(s2.layout.rooms.filter((r) => r.floor === 1).length).toBeGreaterThanOrEqual(2)
      expect(s2.layout.stairs.length).toBeGreaterThanOrEqual(2)

      // Every seat resolves to a reachable room.
      for (let i = 0; i < s2.runtimeSeats.length; i++) {
        const seat = s2.runtimeSeats[i]!
        const roomId = roomIdAtY(s2.layout, seat[0], seat[2], seat[1])
        expect(hopDistance(s2.layout, 'r0', roomId), `seat ${i} reachable`).not.toBe(Infinity)
      }

      // Longer run: walking NPCs keep finite positions and never teleport in Y.
      const prevY = new Map<string, number>()
      for (let i = 0; i < 3600; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
        const s = useGameStore.getState()
        if (i % 240 === 0) assertSanity(i)
        for (const n of s.npcs) {
          if (n.status !== 'walking') {
            prevY.delete(n.id)
            continue
          }
          const prev = prevY.get(n.id)
          if (prev !== undefined) {
            expect(
              Math.abs(n.position[1] - prev),
              `npc ${n.id} Y jump @${i}`,
            ).toBeLessThan(0.35)
          }
          prevY.set(n.id, n.position[1])
        }
      }
      assertSanity(3600)
    })
  })
})

describe('chaser lifecycle', () => {
  it('first round spawns at firstAtSec and exhausts after firstExhaustSec', () => {
    withSeededRng(41, () => {
      const store = useGameStore.getState()
      store.beginMission(9_000_000)
      let now = 9_000_000
      // Before the first round there are no chasers.
      for (let i = 0; i < 60; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      expect(useGameStore.getState().npcs.some((n) => n.role === 'chaser')).toBe(false)

      // First round at firstAtSec.
      const firstAt = CONFIG.chaser.firstAtSec
      for (let i = 0; i < Math.round((firstAt - 1) * 60); i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      expect(useGameStore.getState().npcs.some((n) => n.role === 'chaser')).toBe(false)
      for (let i = 0; i < 60 * 2; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const spawned = useGameStore.getState().npcs.find((n) => n.role === 'chaser')
      expect(spawned).toBeDefined()

      // Round 1 pursuit lasts firstExhaustSec, then walks out and despawns.
      const exhaustTicks = Math.round(CONFIG.chaser.firstExhaustSec * 60) + 60 * 40
      for (let i = 0; i < exhaustTicks; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      expect(useGameStore.getState().npcs.some((n) => n.role === 'chaser')).toBe(false)
    })
  })

  it('exhausted chasers stop pursuing and exit the door', () => {
    withSeededRng(41, () => {
      const store = useGameStore.getState()
      store.beginMission(9_000_000)
      // Spawn a chaser 5s ago with the player far away so it must pursue.
      const chaser = createChaser('chaser-x', CONFIG.door.position, 'r0', 9_000_000 - 5000)
      useGameStore.setState({
        npcs: [...useGameStore.getState().npcs, chaser],
        playerPos: [3, 0, 3],
      })
      let now = 9_000_000
      // Chase phase: still pursuing, not exiting.
      for (let i = 0; i < 60; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const chasing = useGameStore.getState().npcs.find((n) => n.id === 'chaser-x')
      expect(chasing).toBeDefined()
      expect(chasing!.exiting).toBe(false)

      // Fast-forward past the round-1 exhaust window → marked exiting.
      const old = useGameStore.getState().npcs.find((n) => n.id === 'chaser-x')!
      useGameStore.setState({
        npcs: useGameStore.getState().npcs.map((n) =>
          n.id === 'chaser-x' ? { ...n, idleSince: now - CONFIG.chaser.firstExhaustSec * 1000 - 1000 } : n,
        ),
      })
      void old
      for (let i = 0; i < 60; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      const exiting = useGameStore.getState().npcs.find((n) => n.id === 'chaser-x')
      expect(exiting).toBeDefined()
      expect(exiting!.exiting).toBe(true)
      expect(exiting!.status).toBe('walking')

      // Walking toward the door → eventually despawns (removed from npcs).
      for (let i = 0; i < 60 * 30; i++) {
        now += DT * 1000
        useGameStore.getState().tick(DT, now)
      }
      expect(useGameStore.getState().npcs.some((n) => n.id === 'chaser-x')).toBe(false)
    })
  })
})
