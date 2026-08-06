import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import { createInitialLayout, hopDistance, addRoomConnected } from '../spaceLayout'
import { applySpaceEvent } from '../spaceApply'
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
