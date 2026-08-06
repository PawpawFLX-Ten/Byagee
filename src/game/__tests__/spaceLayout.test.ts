import { describe, expect, it } from 'vitest'
import {
  addRoomConnected,
  createInitialLayout,
  hopDistance,
  latchedOnPath,
  roomIdAt,
  floorFromPlayerY,
} from '../spaceLayout'

describe('spaceLayout', () => {
  it('default layout is single room r0 covering spawn', () => {
    const L = createInitialLayout()
    expect(roomIdAt(L, 0, 0, 0)).toBe('r0')
    expect(L.rooms).toHaveLength(1)
    expect(L.rooms[0].id).toBe('r0')
    expect(L.obstacles).toEqual([])
    expect(L.stairs).toEqual([])
  })

  it('after adding adjacent room, hopDistance is 1', () => {
    const L = addRoomConnected(
      createInitialLayout(),
      { id: 'r1', min: [5, -5], max: [10, 5], floor: 0 },
      'door-0',
    )
    expect(hopDistance(L, 'r0', 'r1')).toBe(1)
    expect(hopDistance(L, 'r1', 'r0')).toBe(1)
  })

  it('same room hopDistance is 0', () => {
    const L = createInitialLayout()
    expect(hopDistance(L, 'r0', 'r0')).toBe(0)
  })

  it('unconnected rooms have infinite hop distance', () => {
    const L = createInitialLayout()
    expect(hopDistance(L, 'r0', 'r99')).toBe(Infinity)
  })

  it('latchedOnPath is true when a shortest-path opening is latched', () => {
    const base = addRoomConnected(
      createInitialLayout(),
      { id: 'r1', min: [5, -5], max: [10, 5], floor: 0 },
      'door-0',
    )
    const latched = {
      ...base,
      openings: base.openings.map((o) =>
        o.id === 'door-0' ? { ...o, latchedUntil: 999_999 } : o,
      ),
    }
    expect(latchedOnPath(latched, 'r0', 'r1', 0)).toBe(true)
    expect(latchedOnPath(latched, 'r0', 'r1', 1_000_000)).toBe(false)
  })

  it('latchedOnPath is false for same room', () => {
    const L = createInitialLayout()
    expect(latchedOnPath(L, 'r0', 'r0', 0)).toBe(false)
  })

  it('floorFromPlayerY infers upstairs from height', () => {
    expect(floorFromPlayerY(0)).toBe(0)
    expect(floorFromPlayerY(1.5)).toBe(1)
  })
})
