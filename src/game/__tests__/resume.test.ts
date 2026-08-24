import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIG } from '../config'
import { useGameStore } from '../store'

const DT = 1 / 60
const START = 1_000_000

/** Minimal Map-backed localStorage for the node test env. */
const storage = new Map<string, string>()
const localStorageStub: Storage = {
  get length() {
    return storage.size
  },
  clear: () => storage.clear(),
  getItem: (k) => storage.get(k) ?? null,
  key: (i) => [...storage.keys()][i] ?? null,
  removeItem: (k) => {
    storage.delete(k)
  },
  setItem: (k, v) => {
    storage.set(k, String(v))
  },
}

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', localStorageStub)
  useGameStore.getState().start()
  useGameStore.getState().beginMission(START)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('refresh-safe run resume', () => {
  it('saves during live play and hasResumableRun reports it', () => {
    let now = START
    for (let i = 0; i < 30; i++) {
      now += DT * 1000
      useGameStore.getState().tick(DT, now)
    }
    // One >5s gap passes the snapshot throttle (clock shift keeps sim sane).
    now += 6_000
    useGameStore.getState().tick(DT, now)
    expect(useGameStore.getState().hasResumableRun()).toBe(true)
  })

  it('tryResumeRun restores hp/npcs/elapsed with shifted timers', () => {
    let now = START
    for (let i = 0; i < 30; i++) {
      now += DT * 1000
      useGameStore.getState().tick(DT, now)
    }
    // Plant a live cooldown, then push a save window (clock shift keeps it honest).
    useGameStore.setState({
      cooldownReadyAt: { ...useGameStore.getState().cooldownReadyAt, slap: now + 4_000 },
    }) as unknown
    now += 6_000
    useGameStore.getState().tick(DT, now)
    const before = useGameStore.getState()
    const npcCount = before.npcs.length
    const hp = before.hp
    const cd = before.cooldownReadyAt.slap

    // Refresh = boot state (start does not touch the snapshot) + reload restore.
    useGameStore.getState().start()
    expect(useGameStore.getState().elapsedSec).toBe(0)
    expect(useGameStore.getState().hp).toBe(CONFIG.maxHp)

    const ok = useGameStore.getState().tryResumeRun(now + 250)
    expect(ok).toBe(true)
    const after = useGameStore.getState()
    expect(after.alive).toBe(true)
    expect(after.hp).toBe(hp)
    expect(after.npcs.length).toBe(npcCount)
    // Saved elapsed survives the refresh instead of resetting to 0.
    expect(after.elapsedSec).toBeGreaterThan(0.4)
    expect(after.elapsedSec).toBe(before.elapsedSec)
    // Cooldown stamp restored + shifted by exactly the resume gap (+250ms).
    expect(after.cooldownReadyAt.slap).toBeCloseTo(cd + 250, 5)
    // Snapshot consumed — a second refresh must not offer resume.
    expect(useGameStore.getState().hasResumableRun()).toBe(false)
  })

  it('death clears the snapshot so refresh cannot resurrect', () => {
    let now = START
    for (let i = 0; i < 30; i++) {
      now += DT * 1000
      useGameStore.getState().tick(DT, now)
    }
    now += 6_000
    useGameStore.getState().tick(DT, now)
    useGameStore.setState({ hp: 0 })
    useGameStore.getState().tick(DT, now + 16)
    expect(useGameStore.getState().hasResumableRun()).toBe(false)
    expect(useGameStore.getState().tryResumeRun()).toBe(false)
  })

  it('expired snapshots are rejected and purged', () => {
    storage.set(
      'civicman.run',
      JSON.stringify({
        savedAt: performance.now() - 3 * 60 * 60 * 1000,
        state: { alive: true, briefingDone: true },
      }),
    )
    expect(useGameStore.getState().hasResumableRun()).toBe(false)
    expect(useGameStore.getState().tryResumeRun()).toBe(false)
    expect(storage.has('civicman.run')).toBe(false)
  })
})
