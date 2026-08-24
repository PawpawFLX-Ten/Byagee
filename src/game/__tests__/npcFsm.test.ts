import { describe, expect, it } from 'vitest'
import { createNpcs, tickNpcs, waypointToward } from '../npcFsm'
import { applySpaceEvent } from '../spaceApply'
import { createInitialLayout } from '../spaceLayout'
import { wallsFromLayout, layoutBoundsFromLayout } from '../collision'
import { CONFIG } from '../config'
import { resetRuntimeSpace, setRuntimeSpace } from '../runtimeSpace'

function expansion(eventId: 'A1' | 'A2', side: number) {
  return applySpaceEvent({
    layout: createInitialLayout(),
    tables: CONFIG.tables.map((t) => ({ ...t, half: { ...t.half } })),
    seatPositions: CONFIG.seatPositions.map((s) => [...s] as [number, number, number]),
    foodSpots: CONFIG.foodSpots.map((f) => ({
      ...f,
      plate: [...f.plate] as [number, number, number],
      approach: [...f.approach] as [number, number, number],
    })),
    maxNpcs: CONFIG.door.maxNpcs,
    eventId,
    rng: () => side,
  })
}

describe('waypointToward', () => {
  it('is null when food is in the same room', () => {
    const applied = expansion('A1', 0)
    expect(waypointToward(applied.layout, [0, 0, 0], [2, 0, 2])).toBeNull()
  })

  it('points just inside the far side of the shared-wall door (east)', () => {
    const applied = expansion('A1', 0)
    const wp = waypointToward(applied.layout, [0, 0, 0], [8, 0, 0])
    expect(wp).toEqual([6.2, 0, 0])
  })

  it('points south when the room is attached south', () => {
    const applied = expansion('A1', 0.9)
    const wp = waypointToward(applied.layout, [0, 0, 0], [0, 0, 8])
    expect(wp).toEqual([0, 0, 6.2])
  })

  it('chains through the A2 corridor toward the end room', () => {
    const applied = expansion('A2', 0)
    const wp = waypointToward(applied.layout, [0, 0, 0], [12, 0, 0])
    expect(wp).toEqual([6.2, 0, 0])
  })
})

describe('npc cross-room walking with walls', () => {
  it('walks through the door to food inside the new room', () => {
    resetRuntimeSpace()
    const applied = expansion('A1', 0)
    setRuntimeSpace({
      tables: applied.tables,
      seatPositions: applied.seatPositions,
      foodSpots: applied.foodSpots,
      maxNpcs: applied.maxNpcs,
    })
    const foodId = `food-${CONFIG.foodSpots.length}`
    let npcs = createNpcs(0).map((n, i) =>
      i === 0
        ? {
            ...n,
            status: 'walking' as const,
            position: [3, 0, 0] as [number, number, number],
            foodId,
            statusUntil: 999999,
          }
        : { ...n, status: 'idle' as const, statusUntil: 999999, foodId: null },
    )
    const bounds = layoutBoundsFromLayout(applied.layout, 0)
    const walls = wallsFromLayout(applied.layout, CONFIG.door.position)
    const obstacles = [...applied.layout.obstacles, ...walls]
    let now = 0
    let reached = false
    for (let i = 0; i < 600; i++) {
      now += 100
      const result = tickNpcs(
        npcs, now, 30, 0.1,
        [0, 0, 0],
        obstacles,
        bounds,
        applied.layout,
      )
      npcs = result.npcs
      const walker = npcs[0]!
      if (walker.status === 'smacking') {
        reached = true
        break
      }
    }
    expect(reached).toBe(true)
    const walker = npcs[0]!
    expect(walker.position[0]).toBeGreaterThan(6)
  })
})

describe('npc walking without a food target', () => {
  it('falls back to idle instead of freezing forever', () => {
    resetRuntimeSpace()
    let npcs = createNpcs(0).map((n, i) =>
      i === 0
        ? {
            ...n,
            status: 'walking' as const,
            foodId: null,
            statusUntil: 999_999,
          }
        : { ...n, status: 'idle' as const, statusUntil: 999_999, foodId: null },
    )
    const bounds = layoutBoundsFromLayout(createInitialLayout(), 0)
    // One tick must rescue the zombie — not wait out its long statusUntil.
    const result = tickNpcs(
      npcs, 100, 30, 0.1,
      [0, 0, 0],
      [],
      bounds,
      createInitialLayout(),
    )
    npcs = result.npcs
    expect(npcs[0]!.status).toBe('idle')
    expect(npcs[0]!.statusUntil).toBeLessThan(999_999)

    // And it rejoins the rotation: eventually walking toward a food again.
    let now = 100
    for (let i = 0; i < 40; i++) {
      now += 100
      npcs = tickNpcs(
        npcs, now, 30, 0.1,
        [0, 0, 0],
        [],
        bounds,
        createInitialLayout(),
      ).npcs
    }
    expect(['walking', 'smacking']).toContain(npcs[0]!.status)
    expect(npcs[0]!.foodId).not.toBeNull()
  })
})

describe('npc upstairs walking', () => {
  function upstairs() {
    return applySpaceEvent({
      layout: createInitialLayout(),
      tables: CONFIG.tables.map((t) => ({ ...t, half: { ...t.half } })),
      seatPositions: CONFIG.seatPositions.map((s) => [...s] as [number, number, number]),
      foodSpots: CONFIG.foodSpots.map((f) => ({
        ...f,
        plate: [...f.plate] as [number, number, number],
        approach: [...f.approach] as [number, number, number],
      })),
      maxNpcs: CONFIG.door.maxNpcs,
      eventId: 'A4',
      rng: () => 0.5,
    })
  }

  it('climbs the ramp to an upstairs seat without Y teleports', () => {
    resetRuntimeSpace()
    const applied = upstairs()
    setRuntimeSpace({
      tables: applied.tables,
      seatPositions: applied.seatPositions,
      foodSpots: applied.foodSpots,
      maxNpcs: applied.maxNpcs,
    })
    const foodId = `food-${CONFIG.foodSpots.length}`
    let npcs = createNpcs(0).map((n, i) =>
      i === 0
        ? {
            ...n,
            status: 'walking' as const,
            position: [...CONFIG.door.position] as [number, number, number],
            foodId,
            statusUntil: 999999,
          }
        : { ...n, status: 'idle' as const, statusUntil: 999999, foodId: null },
    )
    const bounds = layoutBoundsFromLayout(applied.layout, 0)
    const walls = wallsFromLayout(applied.layout, CONFIG.door.position)
    const obstacles = [...applied.layout.obstacles, ...walls]
    let now = 0
    let reached = false
    let prevY = 0
    let maxRise = 0
    for (let i = 0; i < 900; i++) {
      now += 100
      const result = tickNpcs(
        npcs, now, 30, 0.1,
        [0, 0, 0],
        obstacles,
        bounds,
        applied.layout,
      )
      npcs = result.npcs
      const walker = npcs[0]!
      maxRise = Math.max(maxRise, Math.abs(walker.position[1] - prevY))
      prevY = walker.position[1]
      if (walker.status === 'smacking') {
        reached = true
        break
      }
    }
    expect(reached).toBe(true)
    const walker = npcs[0]!
    expect(walker.position[1]).toBeGreaterThan(1.2)
    expect(maxRise).toBeLessThan(0.4)
  })

  it('waypoint toward an upstairs seat is the stair top', () => {
    const applied = upstairs()
    const wp = waypointToward(applied.layout, [0, 0, -4.5], applied.seatPositions[CONFIG.seatPositions.length]!)
    expect(wp).toEqual([0.5, 0, -0.8])
  })
})
