import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import {
  createInitialLayout,
  hopDistance,
  addRoomConnected,
  roomIdAt,
  stairAabb,
} from '../spaceLayout'
import { applySpaceEvent, roomIdForSeatIndex } from '../spaceApply'
import { createRuntimeSpaceFromConfig } from '../runtimeSpace'

function baseInput(
  eventId: 'A1' | 'C1' | 'C2' | 'A2' | 'A3' | 'A5' | 'A4' | 'C4',
  rng = () => 0.5,
) {
  const runtime = createRuntimeSpaceFromConfig()
  return {
    layout: createInitialLayout(),
    tables: runtime.tables,
    seatPositions: runtime.seatPositions,
    foodSpots: runtime.foodSpots,
    maxNpcs: runtime.maxNpcs,
    eventId,
    rng,
  }
}

/** rng values that land on east/west/north/south of the SIDE_ORDER pool. */
const SIDE_RNG = [0, 0.3, 0.6, 0.9]

function roomSide(result: ReturnType<typeof applySpaceEvent>, roomId: string): string {
  const r = result.layout.rooms.find((x) => x.id === roomId)!
  const outside = Math.abs(r.min[0]) > 5 || Math.abs(r.max[0]) > 5
  if (r.min[0] > 5) return 'east'
  if (r.max[0] < -5) return 'west'
  if (r.max[1] < -5) return 'north'
  if (r.min[1] > 5) return 'south'
  void outside
  return 'unknown'
}

describe('spaceApply', () => {
  it('A1 adds room, opening, two tables, and 6 seats', () => {
    const result = applySpaceEvent(baseInput('A1', () => 0))
    expect(result.layout.rooms.length).toBeGreaterThan(1)
    expect(result.layout.openings.length).toBe(1)
    expect(result.tables.length).toBe(CONFIG.tables.length + 2)
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBe(6)
    expect(result.maxNpcs).toBe(result.seatPositions.length)
  })

  it('hopDistance is 1 after A1 expansion', () => {
    const result = applySpaceEvent(baseInput('A1'))
    const newRoom = result.layout.rooms.find((r) => r.id !== 'r0')
    expect(newRoom).toBeDefined()
    expect(hopDistance(result.layout, 'r0', newRoom!.id)).toBe(1)
  })

  it('C1 adds a small dining room with one table and 2 seats', () => {
    const before = createInitialLayout().rooms[0]!
    const result = applySpaceEvent(baseInput('C1'))
    const after = result.layout.rooms.find((r) => r.id === 'r0')!
    expect(after.min).toEqual(before.min)
    expect(after.max).toEqual(before.max)
    const newRoom = result.layout.rooms.find((r) => r.id !== 'r0')
    expect(newRoom).toBeDefined()
    expect(result.tables.length).toBe(CONFIG.tables.length + 1)
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBe(2)
  })

  it('C2 adds a cozy side room with one table', () => {
    const before = createInitialLayout().rooms[0]!
    const result = applySpaceEvent({ ...baseInput('C1'), eventId: 'C2' })
    const after = result.layout.rooms.find((r) => r.id === 'r0')!
    expect(after.min).toEqual(before.min)
    expect(result.layout.rooms.length).toBe(2)
    expect(result.layout.openings.length).toBe(1)
    expect(result.seatPositions.length).toBe(CONFIG.seatPositions.length + 2)
    expect(result.tables.length).toBe(CONFIG.tables.length + 1)
  })

  it('C3 adds a pillar room with one table', () => {
    const result = applySpaceEvent({ ...baseInput('C1'), eventId: 'C3' })
    expect(result.layout.rooms.length).toBe(2)
    const pillars = result.layout.obstacles.filter((o) => o.id.startsWith('obs-pillar-'))
    expect(pillars).toHaveLength(2)
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBe(2)
  })

  it('C5 adds a tiny table room', () => {
    const result = applySpaceEvent({ ...baseInput('C1'), eventId: 'C5' })
    expect(result.layout.rooms.length).toBe(2)
    expect(result.layout.openings.length).toBe(1)
    expect(result.seatPositions.length).toBe(CONFIG.seatPositions.length + 2)
    expect(result.tables.length).toBe(CONFIG.tables.length + 1)
  })

  it('C6 adds a screen room with three screens and one table', () => {
    const result = applySpaceEvent({ ...baseInput('C1'), eventId: 'C6' })
    expect(result.layout.rooms.length).toBe(2)
    const screens = result.layout.obstacles.filter((o) => o.id.startsWith('obs-screen-'))
    expect(screens).toHaveLength(3)
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBe(2)
  })

  it('A2 adds corridor and end room with two openings', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A2' })
    expect(result.layout.rooms.length).toBeGreaterThanOrEqual(3)
    expect(result.layout.openings.length).toBeGreaterThanOrEqual(2)
  })

  it('A1 can attach on every side of r0 (not hardcoded east)', () => {
    const expected = ['east', 'west', 'north', 'south']
    SIDE_RNG.forEach((rngVal, i) => {
      const result = applySpaceEvent(baseInput('A1', () => rngVal))
      const newRoom = result.layout.rooms.find((r) => r.id !== 'r0')!
      expect(roomSide(result, newRoom.id)).toBe(expected[i])
      const opening = result.layout.openings.find((o) => o.toRoom === newRoom.id)!
      if (expected[i] === 'east') expect(opening.position[0]).toBeCloseTo(5, 5)
      if (expected[i] === 'west') expect(opening.position[0]).toBeCloseTo(-5, 5)
      if (expected[i] === 'north') expect(opening.position[2]).toBeCloseTo(-5, 5)
      if (expected[i] === 'south') expect(opening.position[2]).toBeCloseTo(5, 5)
    })
  })

  it('A2 corridor and end room stay on one random axis with two doors', () => {
    for (const rngVal of SIDE_RNG) {
      const result = applySpaceEvent(baseInput('A2', () => rngVal))
      const rooms = result.layout.rooms.filter((r) => r.id !== 'r0')
      expect(rooms).toHaveLength(2)
      expect(result.layout.openings).toHaveLength(2)
      const corridor = rooms[0]!
      const end = rooms[1]!
      expect(hopDistance(result.layout, 'r0', corridor.id)).toBe(1)
      expect(hopDistance(result.layout, corridor.id, end.id)).toBe(1)
      const doorMain = result.layout.openings.find((o) => o.toRoom === corridor.id)!
      const doorEnd = result.layout.openings.find((o) => o.toRoom === end.id)!
      if (rngVal === 0) {
        // east axis: corridor and end room both beyond x=5, end further out
        expect(corridor.min[0]).toBeGreaterThan(5)
        expect(end.min[0]).toBeGreaterThan(corridor.max[0])
        expect(doorMain.position[0]).toBeCloseTo(5, 5)
        expect(doorEnd.position[0]).toBeCloseTo(corridor.max[0], 5)
      } else if (rngVal === 0.3) {
        expect(corridor.max[0]).toBeLessThan(-5)
        expect(end.max[0]).toBeLessThan(corridor.min[0])
      } else if (rngVal === 0.6) {
        expect(corridor.max[1]).toBeLessThan(-5)
        expect(end.max[1]).toBeLessThan(corridor.min[1])
      } else {
        expect(corridor.min[1]).toBeGreaterThan(5)
        expect(end.min[1]).toBeGreaterThan(corridor.max[1])
      }
    }
  })

  it('A3 banquet attaches on every side with two tables', () => {
    SIDE_RNG.forEach((rngVal, i) => {
      const result = applySpaceEvent(baseInput('A3', () => rngVal))
      const newRoom = result.layout.rooms.find((r) => r.id !== 'r0')!
      expect(roomSide(result, newRoom.id)).toBe(['east', 'west', 'north', 'south'][i])
      expect(result.tables.length).toBe(CONFIG.tables.length + 3)
      const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
      expect(addedSeats).toBe(12)
    })
  })

  it('A5 bar corner attaches on every side with counter and 6 seats', () => {
    SIDE_RNG.forEach((rngVal) => {
      const result = applySpaceEvent(baseInput('A5', () => rngVal))
      const newRoom = result.layout.rooms.find((r) => r.id !== 'r0')!
      expect(['east', 'west', 'north', 'south']).toContain(roomSide(result, newRoom.id))
      expect(result.tables.length).toBe(CONFIG.tables.length + 2)
      const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
      expect(addedSeats).toBe(6)
      const counter = result.layout.obstacles.find((o) => o.id.startsWith('obs-bar-'))
      expect(counter).toBeDefined()
    })
  })

  it('repeated random expansions never overlap rooms', () => {
    let result = applySpaceEvent({ ...baseInput('A1'), rng: () => Math.random() })
    for (let i = 0; i < 12; i++) {
      const event = (['A1', 'A2', 'A3', 'A5'] as const)[i % 4]
      result = applySpaceEvent({ ...result, eventId: event, rng: () => Math.random() })
      const rooms = result.layout.rooms
      for (let a = 0; a < rooms.length; a++) {
        for (let b = a + 1; b < rooms.length; b++) {
          const ra = rooms[a]!
          const rb = rooms[b]!
          const overlap =
            ra.min[0] < rb.max[0] && ra.max[0] > rb.min[0] && ra.min[1] < rb.max[1] && ra.max[1] > rb.min[1]
          expect(overlap).toBe(false)
        }
      }
    }
  })

  it('A4 adds upstairs room at floor 1', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A4' })
    const upper = result.layout.rooms.find((r) => r.floor === 1)
    expect(upper).toBeDefined()
    expect(result.layout.stairs.length).toBeGreaterThanOrEqual(1)
  })

  it('C4 adds same-room platform and stairs', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'C4' })
    expect(result.layout.rooms.some((r) => r.floor === 1)).toBe(true)
    expect(result.layout.stairs.length).toBeGreaterThanOrEqual(1)
  })

  it('A4 stair sits inside r0 and the upper room, clear of tables', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A4' })
    const upper = result.layout.rooms.find((r) => r.floor === 1)!
    const stairs = result.layout.stairs[0]!
    const aabb = stairAabb(result.layout, stairs)
    const r0 = result.layout.rooms.find((r) => r.id === 'r0')!
    expect(aabb.min[0]).toBeGreaterThanOrEqual(r0.min[0])
    expect(aabb.max[0]).toBeLessThanOrEqual(r0.max[0])
    expect(aabb.min[1]).toBeGreaterThanOrEqual(r0.min[1])
    expect(aabb.max[1]).toBeLessThanOrEqual(r0.max[1])
    expect(aabb.min[0]).toBeGreaterThanOrEqual(upper.min[0])
    expect(aabb.max[0]).toBeLessThanOrEqual(upper.max[0])
    expect(aabb.min[1]).toBeGreaterThanOrEqual(upper.min[1])
    expect(aabb.max[1]).toBeLessThanOrEqual(upper.max[1])
    for (const t of result.tables) {
      const overlap =
        aabb.min[0] < t.position[0] + t.half.x &&
        aabb.max[0] > t.position[0] - t.half.x &&
        aabb.min[1] < t.position[2] + t.half.z &&
        aabb.max[1] > t.position[2] - t.half.z
      expect(overlap).toBe(false)
    }
    for (const o of result.layout.obstacles) {
      const overlap =
        aabb.min[0] < o.max[0] && aabb.max[0] > o.min[0] && aabb.min[1] < o.max[1] && aabb.max[1] > o.min[1]
      expect(overlap).toBe(false)
    }
  })

  it('C4 stair sits inside r0 and the platform, clear of tables and seats', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'C4' })
    const platform = result.layout.rooms.find((r) => r.floor === 1)!
    const stairs = result.layout.stairs[0]!
    const aabb = stairAabb(result.layout, stairs)
    expect(aabb.min[0]).toBeGreaterThanOrEqual(platform.min[0])
    expect(aabb.max[0]).toBeLessThanOrEqual(platform.max[0])
    expect(aabb.min[1]).toBeGreaterThanOrEqual(platform.min[1])
    expect(aabb.max[1]).toBeLessThanOrEqual(platform.max[1])
    const allShapes = [
      ...result.tables,
      ...result.seatPositions.map((s) => ({
        position: s,
        half: { x: 0.3, z: 0.3 },
      })),
    ]
    for (const t of allShapes) {
      const overlap =
        aabb.min[0] < t.position[0] + t.half.x &&
        aabb.max[0] > t.position[0] - t.half.x &&
        aabb.min[1] < t.position[2] + t.half.z &&
        aabb.max[1] > t.position[2] - t.half.z
      expect(overlap).toBe(false)
    }
  })

  it('A4/C4 stairs connect r0 to the upper room', () => {
    for (const id of ['A4', 'C4'] as const) {
      const result = applySpaceEvent({ ...baseInput('A1'), eventId: id })
      const upper = result.layout.rooms.find((r) => r.floor === 1)!
      expect(hopDistance(result.layout, 'r0', upper.id)).toBe(1)
      expect(result.layout.openings.some((o) => o.fromRoom === 'r0' && o.toRoom === upper.id)).toBe(true)
    }
  })

  it('A4/C4 add exactly two seats at floor 1', () => {
    for (const id of ['A4', 'C4'] as const) {
      const result = applySpaceEvent({ ...baseInput('A1'), eventId: id })
      const baseCount = CONFIG.seatPositions.length
      expect(result.seatPositions.length).toBe(baseCount + 2)
      expect(result.maxNpcs).toBe(baseCount + 2)
      const newSeats = result.seatPositions.slice(baseCount)
      for (const s of newSeats) {
        expect(s[1]).toBeGreaterThan(1.2)
      }
    }
  })

  it('A4 upstairs seats resolve to upper room, not r0', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A4' })
    const upper = result.layout.rooms.find((r) => r.floor === 1)!
    const baseSeatCount = CONFIG.seatPositions.length
    const newSeat = result.seatPositions[baseSeatCount]
    expect(newSeat).toBeDefined()
    expect(newSeat![1]).toBeGreaterThan(1.2)
    expect(roomIdAt(result.layout, newSeat![0], newSeat![2], 1)).toBe(upper.id)
    expect(roomIdForSeatIndex(result.layout, result.seatPositions, baseSeatCount)).toBe(upper.id)
    expect(roomIdForSeatIndex(result.layout, result.seatPositions, baseSeatCount)).not.toBe('r0')
  })

  it('C4 upstairs seats resolve to platform room via roomIdAt', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'C4' })
    const upper = result.layout.rooms.find((r) => r.floor === 1)!
    const baseSeatCount = CONFIG.seatPositions.length
    const newSeat = result.seatPositions[baseSeatCount]
    expect(newSeat![1]).toBeGreaterThan(1.2)
    expect(roomIdAt(result.layout, newSeat![0], newSeat![2], 1)).toBe(upper.id)
    expect(roomIdForSeatIndex(result.layout, result.seatPositions, baseSeatCount)).toBe(upper.id)
  })

  it('A3 adds three tables with twelve new seats', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A3', rng: () => 0 })
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBe(12)
    expect(result.tables.length).toBe(CONFIG.tables.length + 3)
  })

  it('C6 screens sit inside the new room', () => {
    const result = applySpaceEvent({ ...baseInput('C1'), eventId: 'C6' })
    const room = result.layout.rooms.find((r) => r.id !== 'r0')!
    for (const s of result.layout.obstacles.filter((o) => o.id.startsWith('obs-screen-'))) {
      expect(s.min[0]).toBeGreaterThanOrEqual(room.min[0])
      expect(s.max[0]).toBeLessThanOrEqual(room.max[0])
      expect(s.min[1]).toBeGreaterThanOrEqual(room.min[1])
      expect(s.max[1]).toBeLessThanOrEqual(room.max[1])
    }
  })

  it('A5 adds bar room, two tables (6 seats) and a counter obstacle', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A5', rng: () => 0 })
    expect(result.layout.rooms.length).toBeGreaterThan(1)
    expect(result.layout.openings.length).toBe(1)
    expect(result.tables.length).toBe(CONFIG.tables.length + 2)
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBe(6)
    expect(result.layout.obstacles.length).toBe(1)
    expect(result.maxNpcs).toBe(result.seatPositions.length)
  })

  it('A5 seats sit inside the new bar room', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A5', rng: () => 0 })
    const barRoom = result.layout.rooms.find((r) => r.id !== 'r0')!
    for (let i = CONFIG.seatPositions.length; i < result.seatPositions.length; i++) {
      const s = result.seatPositions[i]!
      expect(s[0]).toBeGreaterThanOrEqual(barRoom.min[0])
      expect(s[0]).toBeLessThanOrEqual(barRoom.max[0])
      expect(s[2]).toBeGreaterThanOrEqual(barRoom.min[1])
      expect(s[2]).toBeLessThanOrEqual(barRoom.max[1])
    }
  })

  it('C6 adds three screens without touching seats or capacity', () => {
    const result = applySpaceEvent({ ...baseInput('C1'), eventId: 'C6' })
    const screens = result.layout.obstacles.filter((o) => o.id.startsWith('obs-screen-'))
    expect(screens).toHaveLength(3)
    expect(result.seatPositions.length).toBe(CONFIG.seatPositions.length + 2)
    expect(result.maxNpcs).toBe(result.seatPositions.length)
  })
})

describe('spaceLayout addRoomConnected (regression)', () => {
  it('after adding adjacent room, hopDistance is 1', () => {
    const L = addRoomConnected(
      createInitialLayout(),
      { id: 'r1', min: [5, -5], max: [10, 5], floor: 0 },
      'door-0',
    )
    expect(hopDistance(L, 'r0', 'r1')).toBe(1)
  })
})
