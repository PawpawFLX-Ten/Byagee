import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import { createInitialLayout, hopDistance, addRoomConnected, roomIdAt } from '../spaceLayout'
import { applySpaceEvent, roomIdForSeatIndex } from '../spaceApply'
import { createRuntimeSpaceFromConfig } from '../runtimeSpace'

function baseInput(eventId: 'A1' | 'C1' | 'C2', rng = () => 0.5) {
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

describe('spaceApply', () => {
  it('A1 adds room, opening, table, and 2–4 seats', () => {
    const result = applySpaceEvent(baseInput('A1', () => 0))
    expect(result.layout.rooms.length).toBeGreaterThan(1)
    expect(result.layout.openings.length).toBe(1)
    expect(result.tables.length).toBe(CONFIG.tables.length + 1)
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBeGreaterThanOrEqual(2)
    expect(addedSeats).toBeLessThanOrEqual(4)
    expect(result.maxNpcs).toBe(result.seatPositions.length)
  })

  it('hopDistance is 1 after A1 expansion', () => {
    const result = applySpaceEvent(baseInput('A1'))
    const newRoom = result.layout.rooms.find((r) => r.id !== 'r0')
    expect(newRoom).toBeDefined()
    expect(hopDistance(result.layout, 'r0', newRoom!.id)).toBe(1)
  })

  it('C1 expands primary room AABB', () => {
    const before = createInitialLayout().rooms[0]!
    const result = applySpaceEvent(baseInput('C1'))
    const after = result.layout.rooms.find((r) => r.id === 'r0')!
    expect(after.max[0]).toBeGreaterThan(before.max[0])
    expect(after.min[0]).toBeLessThan(before.min[0])
  })

  it('C2 shrinks room and removes outside seats', () => {
    const result = applySpaceEvent(baseInput('C2'))
    const room = result.layout.rooms.find((r) => r.id === 'r0')!
    expect(room.max[0]).toBeLessThan(5)
    expect(result.seatPositions.length).toBeLessThan(CONFIG.seatPositions.length)
    expect(result.invalidSeatIndices?.length).toBeGreaterThan(0)
    for (const s of result.seatPositions) {
      expect(s[0]).toBeGreaterThanOrEqual(room.min[0])
      expect(s[0]).toBeLessThanOrEqual(room.max[0])
      expect(s[2]).toBeGreaterThanOrEqual(room.min[1])
      expect(s[2]).toBeLessThanOrEqual(room.max[1])
    }
  })

  it('C3 adds obstacles to layout', () => {
    const result = applySpaceEvent({ ...baseInput('C1'), eventId: 'C3' })
    expect(result.layout.obstacles.length).toBeGreaterThanOrEqual(2)
  })

  it('A2 adds corridor and end room with two openings', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A2' })
    expect(result.layout.rooms.length).toBeGreaterThanOrEqual(3)
    expect(result.layout.openings.length).toBeGreaterThanOrEqual(2)
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

  it('A3 adds two tables with up to eight new seats', () => {
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'A3', rng: () => 0 })
    const addedSeats = result.seatPositions.length - CONFIG.seatPositions.length
    expect(addedSeats).toBeGreaterThanOrEqual(4)
    expect(addedSeats).toBeLessThanOrEqual(8)
    expect(result.tables.length).toBe(CONFIG.tables.length + 2)
  })

  it('C5 nudges first obstacle when present', () => {
    const afterC3 = applySpaceEvent({ ...baseInput('A1'), eventId: 'C3' })
    const obsBefore = afterC3.layout.obstacles[0]!
    const result = applySpaceEvent({ ...afterC3, eventId: 'C5', rng: () => 0.9 })
    const obsAfter = result.layout.obstacles[0]!
    expect(obsAfter.min[0]).not.toBe(obsBefore.min[0])
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
    const result = applySpaceEvent({ ...baseInput('A1'), eventId: 'C6' })
    expect(result.layout.obstacles.length).toBe(3)
    expect(result.seatPositions.length).toBe(CONFIG.seatPositions.length)
    expect(result.maxNpcs).toBe(CONFIG.seatPositions.length)
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
