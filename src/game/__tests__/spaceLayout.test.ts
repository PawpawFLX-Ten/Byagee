import { describe, expect, it } from 'vitest'
import {
  addRoomConnected,
  addRoomConnectedAt,
  agentYAt,
  availableSides,
  CABINET_OBSTACLES,
  createInitialLayout,
  firstNonCabinetObstacle,
  hopDistance,
  latchedOnPath,
  openingOrientation,
  pickConnection,
  roomIdAt,
  roomIdAtY,
  floorFromPlayerY,
  floorY,
  sideAabb,
  sideDoorPosition,
  stairAabb,
  stairYAt,
  withFurniture,
  type SpaceLayoutState,
} from '../spaceLayout'
import type { SpaceStairs } from '../types'

describe('spaceLayout', () => {
  it('default layout is single room r0 covering spawn', () => {
    const L = createInitialLayout()
    expect(roomIdAt(L, 0, 0, 0)).toBe('r0')
    expect(L.rooms).toHaveLength(1)
    expect(L.rooms[0].id).toBe('r0')
    expect(L.obstacles).toEqual([])
    expect(L.stairs).toEqual([])
  })

  it('withFurniture adds four wall-cabinet colliders', () => {
    const L = withFurniture(createInitialLayout())
    expect(L.obstacles).toHaveLength(CABINET_OBSTACLES.length)
    for (const o of L.obstacles) {
      expect(o.id.startsWith('cabinet-')).toBe(true)
    }
  })

  it('firstNonCabinetObstacle skips cabinets', () => {
    const L = withFurniture(createInitialLayout())
    expect(firstNonCabinetObstacle(L.obstacles)).toBeNull()
    L.obstacles.push({ id: 'obs-0', min: [0, 0], max: [1, 1] })
    expect(firstNonCabinetObstacle(L.obstacles)?.id).toBe('obs-0')
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

  it('sideAabb extrudes east with a gap from the shared wall', () => {
    const r0 = createInitialLayout().rooms[0]
    const aabb = sideAabb(r0, 'east', 4, 6, 1)
    expect(aabb).toEqual({ min: [6, -3], max: [10, 3] })
  })

  it('sideAabb extrudes west/north/south symmetrically', () => {
    const r0 = createInitialLayout().rooms[0]
    const west = sideAabb(r0, 'west', 4, 6, 1)
    expect(west).toEqual({ min: [-10, -3], max: [-6, 3] })
    const north = sideAabb(r0, 'north', 4, 6, 1)
    expect(north).toEqual({ min: [-2, -12], max: [2, -6] })
    const south = sideAabb(r0, 'south', 4, 6, 1)
    expect(south).toEqual({ min: [-2, 6], max: [2, 12] })
  })

  it('availableSides returns all four for an empty hall', () => {
    const L = createInitialLayout()
    expect(availableSides(L, 'r0', 4, 6)).toEqual(['east', 'west', 'north', 'south'])
  })

  it('availableSides excludes a side already taken by a room', () => {
    const L = addRoomConnectedAt(
      createInitialLayout(),
      { id: 'r1', min: [6, -3], max: [10, 3], floor: 0 },
      'door-1',
      'r0',
      'east',
    )
    expect(availableSides(L, 'r0', 4, 6)).toEqual(['west', 'north', 'south'])
  })

  it('availableSides excludes a side blocked by an obstacle', () => {
    const L = withFurniture(createInitialLayout())
    expect(availableSides(L, 'r0', 4, 6)).toHaveLength(4)
    L.obstacles.push({ id: 'obs-0', min: [6, -3], max: [10, 3] })
    expect(availableSides(L, 'r0', 4, 6)).toEqual(['west', 'north', 'south'])
  })

  it('sideDoorPosition sits on the shared wall midpoint for all sides', () => {
    const r0 = createInitialLayout().rooms[0]
    expect(sideDoorPosition(r0, 'east', [6, -3], [10, 3])).toEqual([5, 0, 0])
    expect(sideDoorPosition(r0, 'west', [-10, -3], [-6, 3])).toEqual([-5, 0, 0])
    expect(sideDoorPosition(r0, 'north', [-2, -12], [2, -6])).toEqual([0, 0, -5])
    expect(sideDoorPosition(r0, 'south', [-2, 6], [2, 12])).toEqual([0, 0, 5])
  })

  it('addRoomConnectedAt places the opening on the shared wall', () => {
    const L = addRoomConnectedAt(
      createInitialLayout(),
      { id: 'r1', min: [6, -3], max: [10, 3], floor: 0 },
      'door-1',
      'r0',
      'east',
    )
    expect(L.openings).toHaveLength(1)
    expect(L.openings[0].position).toEqual([5, 0, 0])
    expect(hopDistance(L, 'r0', 'r1')).toBe(1)
  })

  it('addRoomConnectedAt removes a cabinet overlapping the door', () => {
    const L = addRoomConnectedAt(
      withFurniture(createInitialLayout()),
      { id: 'r1', min: [6, 2.8], max: [10, 4.4], floor: 0 },
      'door-1',
      'r0',
      'east',
    )
    expect(L.obstacles.some((o) => o.id === 'cabinet-e')).toBe(false)
    expect(L.obstacles.filter((o) => o.id.startsWith('cabinet-'))).toHaveLength(3)
  })

  it('addRoomConnectedAt keeps cabinets away from the door', () => {
    const L = addRoomConnectedAt(
      withFurniture(createInitialLayout()),
      { id: 'r1', min: [2.8, -12], max: [4.4, -6], floor: 0 },
      'door-1',
      'r0',
      'north',
    )
    expect(L.obstacles.some((o) => o.id === 'cabinet-n')).toBe(false)
    expect(L.obstacles.some((o) => o.id === 'cabinet-e')).toBe(true)
  })

  it('pickConnection prefers r0 and returns null when no side fits', () => {
    const L = createInitialLayout()
    const pick = pickConnection(L, 4, 6, () => 0.99)
    expect(pick).toEqual({ roomId: 'r0', side: 'south' })
    expect(pickConnection(L, 4, 6, () => 0)).toEqual({ roomId: 'r0', side: 'east' })
  })

  it('pickConnection falls back to later rooms when r0 is saturated', () => {
    let L = createInitialLayout()
    const sizes: [number, number][] = [
      [4, 6],
      [4, 6],
      [4, 6],
      [4, 6],
    ]
    for (const [w, d] of sizes) {
      const pick = pickConnection(L, w, d, () => 0)
      expect(pick).not.toBeNull()
      const room = { id: `r${L.rooms.length}`, ...sideAabb(L.rooms.find((r) => r.id === pick!.roomId)!, pick!.side, w, d) }
      L = addRoomConnectedAt(L, room, `door-${room.id}`, pick!.roomId, pick!.side)
    }
    expect(availableSides(L, 'r0', 4, 6)).toHaveLength(0)
    const fallback = pickConnection(L, 4, 6, () => 0.99)
    expect(fallback).not.toBeNull()
    expect(fallback!.roomId).not.toBe('r0')
  })

  it('openingOrientation is eastwest for x-constant walls and northsouth for z-constant walls', () => {
    const east = addRoomConnectedAt(
      createInitialLayout(),
      { id: 'r1', min: [6, -3], max: [10, 3], floor: 0 },
      'door-1',
      'r0',
      'east',
    )
    expect(openingOrientation(east, east.openings[0]!)).toBe('eastwest')
    const west = addRoomConnectedAt(
      createInitialLayout(),
      { id: 'r1', min: [-10, -3], max: [-6, 3], floor: 0 },
      'door-1',
      'r0',
      'west',
    )
    expect(openingOrientation(west, west.openings[0]!)).toBe('eastwest')
    const north = addRoomConnectedAt(
      createInitialLayout(),
      { id: 'r1', min: [-2, -12], max: [2, -6], floor: 0 },
      'door-1',
      'r0',
      'north',
    )
    expect(openingOrientation(north, north.openings[0]!)).toBe('northsouth')
    const south = addRoomConnectedAt(
      createInitialLayout(),
      { id: 'r1', min: [-2, 6], max: [2, 12], floor: 0 },
      'door-1',
      'r0',
      'south',
    )
    expect(openingOrientation(south, south.openings[0]!)).toBe('northsouth')
  })

  it('pickConnection returns null when every candidate zone is blocked', () => {

    const L = withFurniture(createInitialLayout())
    const zones: [number, number, number, number][] = [
      [6, -12, 16, 12],
      [-16, -12, -6, 12],
      [-16, -12, 16, -6],
      [-16, 6, 16, 16],
    ]
    zones.forEach((z, i) => {
      L.obstacles.push({ id: `block-${i}`, min: [z[0], z[1]], max: [z[2], z[3]] })
    })
    expect(pickConnection(L, 4, 6, () => 0.5)).toBeNull()
  })
})

describe('stairs', () => {
  const stairs: SpaceStairs = {
    id: 'stairs-1',
    position: [3, 0, -3],
    fromRoom: 'r0',
    toRoom: 'r1',
    axis: 'x',
    length: 2.4,
    width: 1.0,
  }

  function layoutWithStairs(): SpaceLayoutState {
    const L = createInitialLayout()
    L.rooms.push({ id: 'r1', min: [-3.5, -3.5], max: [3.5, 3.5], floor: 1 })
    L.stairs.push(stairs)
    return L
  }

  it('stairAabb spans foot-to-top (rising toward the toRoom center)', () => {
    // toRoom center (0,0) is west of the foot x=3 → climb westward
    const L = layoutWithStairs()
    expect(stairAabb(L, stairs)).toEqual({ min: [0.6, -3.5], max: [3, -2.5] })
    // a room east of the foot climbs eastward
    const eastRoom = createInitialLayout()
    eastRoom.rooms.push({ id: 'r2', min: [1, -2], max: [5, 2], floor: 1 })
    const eastStairs: SpaceStairs = { ...stairs, position: [1.2, 0, 0], toRoom: 'r2', axis: 'x', length: 2.4, width: 0.8 }
    expect(stairAabb(eastRoom, eastStairs)).toEqual({ min: [1.2, -0.4], max: [3.6, 0.4] })
  })

  it('stairYAt rises linearly from 0 to floor elevation', () => {
    const L = layoutWithStairs()
    expect(stairYAt(L, 3, -3)).toBe(0)
    expect(stairYAt(L, 1.8, -3)).toBeCloseTo(0.75)
    expect(stairYAt(L, 0.6, -3)).toBe(1.5)
    expect(stairYAt(L, 0.5, -3)).toBeNull()
    expect(stairYAt(L, 1.8, -2.4)).toBeNull()
  })

  it('agentYAt follows the ramp inside and snaps to a floor band outside', () => {
    const L = layoutWithStairs()
    expect(agentYAt(L, 1.8, -3, 0)).toBeCloseTo(0.75)
    expect(agentYAt(L, 0, -3, 0)).toBe(0)
    expect(agentYAt(L, 0, -3, 1.5)).toBe(1.5)
    expect(agentYAt(L, 0, 0, 0.4)).toBe(0)
    expect(agentYAt(L, 0, 0, 1.3)).toBe(1.5)
  })

  it('roomIdAtY infers the floor from height', () => {
    const L = layoutWithStairs()
    expect(roomIdAtY(L, 1, 1, 0)).toBe('r0')
    expect(roomIdAtY(L, 1, 1, 1.5)).toBe('r1')
  })

  it('availableSides ignores upstairs rooms when checking ground sides', () => {
    const L = layoutWithStairs()
    expect(availableSides(L, 'r0', 4, 6)).toEqual(['east', 'west', 'north', 'south'])
  })

  it('floorY maps floor bands', () => {
    expect(floorY(0)).toBe(0)
    expect(floorY(1)).toBe(1.5)
  })
})
