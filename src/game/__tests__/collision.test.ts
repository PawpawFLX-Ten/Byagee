import { describe, expect, it } from 'vitest'
import {
  CHAR_RADIUS,
  clampToLayout,
  layoutBoundsFromLayout,
  moveWithCollision,
  resolveObstaclesCollision,
  resolveTablesCollision,
  wallsFromLayout,
} from '../collision'
import { CONFIG } from '../config'
import { applySpaceEvent } from '../spaceApply'
import { createInitialLayout } from '../spaceLayout'

describe('resolveTablesCollision', () => {
  it('pushes a point out of the round table AABB/circle', () => {
    const tables = [
      { shape: 'round' as const, position: [-2.2, 0, -1.2] as [number, number, number], half: { x: 1, z: 1 } },
    ]
    const [x, z] = resolveTablesCollision(-2.2, -1.2, tables)
    expect(Math.hypot(x + 2.2, z + 1.2)).toBeGreaterThan(1)
  })

  it('leaves free space unchanged', () => {
    const tables = [
      { shape: 'rect' as const, position: [2.4, 0, -1] as [number, number, number], half: { x: 1.2, z: 0.7 } },
    ]
    const [x, z] = resolveTablesCollision(0, 0, tables)
    expect(x).toBe(0)
    expect(z).toBe(0)
  })
})

describe('resolveObstaclesCollision', () => {
  it('pushes a point out of a pillar AABB', () => {
    const obstacles = [{ min: [-1.5, 0.5] as [number, number], max: [-0.5, 1.5] as [number, number] }]
    const [x, z] = resolveObstaclesCollision(-1.0, 1.0, obstacles)
    expect(x !== -1.0 || z !== 1.0).toBe(true)
  })

  it('leaves free space outside obstacles unchanged', () => {
    const obstacles = [{ min: [-1.5, 0.5] as [number, number], max: [-0.5, 1.5] as [number, number] }]
    const [x, z] = resolveObstaclesCollision(3, 3, obstacles)
    expect(x).toBe(3)
    expect(z).toBe(3)
  })
})

describe('clampToLayout', () => {
  it('allows points inside an A1 expansion room in any direction', () => {
    const base = createInitialLayout()
    const applied = applySpaceEvent({
      layout: base,
      tables: [...CONFIG.tables],
      seatPositions: [...CONFIG.seatPositions],
      foodSpots: [...CONFIG.foodSpots],
      maxNpcs: CONFIG.door.maxNpcs,
      eventId: 'A1',
      rng: () => 0.5,
    })
    const bounds = layoutBoundsFromLayout(applied.layout, 0)
    const newRoom = applied.layout.rooms.find((r) => r.id !== 'r0')
    expect(newRoom).toBeTruthy()
    const cx = (newRoom!.min[0] + newRoom!.max[0]) / 2
    const cz = (newRoom!.min[1] + newRoom!.max[1]) / 2
    expect(
      Math.abs(cx) > 4.48 || Math.abs(cz) > 4.48,
    ).toBe(true)
    const [x, z] = clampToLayout(cx, cz, bounds)
    expect(x).toBeCloseTo(cx, 5)
    expect(z).toBeCloseTo(cz, 5)
  })

  it('clamps far outside points back into the layout union', () => {
    const bounds = layoutBoundsFromLayout(createInitialLayout(), 0)
    const [x, z] = clampToLayout(50, 50, bounds)
    expect(Math.abs(x)).toBeLessThanOrEqual(5.5)
    expect(Math.abs(z)).toBeLessThanOrEqual(5.5)
  })

  it('walks through the door gap and the roomGap corridor into a side room', () => {
    const base = createInitialLayout()
    const applied = applySpaceEvent({
      layout: base,
      tables: [...CONFIG.tables],
      seatPositions: [...CONFIG.seatPositions],
      foodSpots: [...CONFIG.foodSpots],
      maxNpcs: CONFIG.door.maxNpcs,
      eventId: 'A1',
      rng: () => 0, // east
    })
    const bounds = layoutBoundsFromLayout(applied.layout, 0)
    const newRoom = applied.layout.rooms.find((r) => r.id !== 'r0')!
    const opening = applied.layout.openings[0]!
    const doorX = opening.position[0]
    const roomX = newRoom.min[0]
    expect(doorX).toBeLessThan(roomX) // east: wall at x=5, room at x=6
    // Walk straight through the door toward the room center.
    let x = doorX - 1
    let z = 0
    const steps = 20
    for (let i = 0; i < steps; i++) {
      ;[x, z] = clampToLayout(x + 0.2, z, bounds)
    }
    // Should pass the wall, the gap corridor, and arrive inside the room.
    expect(x).toBeGreaterThan(roomX - 0.5)
    const centerX = (newRoom.min[0] + newRoom.max[0]) / 2
    expect(x).toBeLessThanOrEqual(centerX + 0.5)
  })
})

describe('wallsFromLayout', () => {
  it('splits the r0 north wall at the main door and east wall at the side door', () => {
    const applied = applySpaceEvent({
      layout: createInitialLayout(),
      tables: [...CONFIG.tables],
      seatPositions: [...CONFIG.seatPositions],
      foodSpots: [...CONFIG.foodSpots],
      maxNpcs: CONFIG.door.maxNpcs,
      eventId: 'A1',
      rng: () => 0, // east
    })
    const walls = wallsFromLayout(applied.layout, CONFIG.door.position)
    // North wall has a gap at x=0 (main door): two z=-5 segments.
    const northSegs = walls.filter((w) => w.max[1] > -5.5 && w.max[1] < -4.5)
    expect(northSegs.length).toBe(2)
    // East wall of r0 has a gap at z=0 (side door): two x=5 segments.
    const r0East = walls.filter((w) => w.min[0] > 4.5 && w.min[0] < 5.5 && w.max[0] > 4.5)
    expect(r0East.length).toBe(2)
  })

  it('blocks a point that crosses the wall away from the door gap', () => {
    const applied = applySpaceEvent({
      layout: createInitialLayout(),
      tables: [...CONFIG.tables],
      seatPositions: [...CONFIG.seatPositions],
      foodSpots: [...CONFIG.foodSpots],
      maxNpcs: CONFIG.door.maxNpcs,
      eventId: 'A1',
      rng: () => 0, // east, door at z=0
    })
    const bounds = layoutBoundsFromLayout(applied.layout, 0)
    const walls = wallsFromLayout(applied.layout, CONFIG.door.position)
    // Stepping into the east wall at z=2 (no door there) is pushed back to r0.
    const [x1] = moveWithCollision(
      4.7, 2, 0.3, 0,
      [], [], CHAR_RADIUS, walls, bounds,
    )
    expect(x1).toBeLessThanOrEqual(5.21) // clamped back inside r0 bounds
    // Stepping through at z=0 (the door gap) passes the wall line.
    let cx2 = 4.7
    for (let i = 0; i < 8; i++) {
      ;[cx2] = moveWithCollision(cx2, 0, 0.3, 0, [], [], CHAR_RADIUS, walls, bounds)
    }
    expect(cx2).toBeGreaterThan(5.5)
  })

  it('keeps the main door gap passable on the r0 north wall', () => {
    const layout = createInitialLayout()
    const bounds = layoutBoundsFromLayout(layout, 0)
    const walls = wallsFromLayout(layout, CONFIG.door.position)
    // Through the main door gap (x=0) the z push passes the wall line.
    const [x, z] = moveWithCollision(
      0, -4.7, 0, -0.3,
      [], [], CHAR_RADIUS, walls, bounds,
    )
    expect(x).toBeCloseTo(0, 1)
    expect(z).toBeLessThan(-4.95)
    // At x=2 (solid wall) the push is blocked before the wall line.
    const [, bz] = moveWithCollision(
      2, -4.7, 0, -0.3,
      [], [], CHAR_RADIUS, walls, bounds,
    )
    expect(bz).toBeGreaterThan(-4.95)
  })
})

describe('floor-aware collision', () => {
  function upstairsLayout() {
    return applySpaceEvent({
      layout: createInitialLayout(),
      tables: [...CONFIG.tables],
      seatPositions: [...CONFIG.seatPositions],
      foodSpots: [...CONFIG.foodSpots],
      maxNpcs: CONFIG.door.maxNpcs,
      eventId: 'A4',
      rng: () => 0.5,
    })
  }

  it('wallsFromLayout builds floor-1 walls tagged with their floor', () => {
    const applied = upstairsLayout()
    const upper = applied.layout.rooms.find((r) => r.floor === 1)!
    const walls = wallsFromLayout(applied.layout, CONFIG.door.position)
    const upperWalls = walls.filter((w) => w.floor === 1)
    expect(upperWalls.length).toBeGreaterThan(0)
    // The north wall of the upper room exists as a solid segment (the
    // stairwell opening is cross-floor, so no door gap is cut).
    const northWall = upperWalls.find(
      (w) => Math.abs(w.min[1] - upper.min[1]) <= 0.12 && Math.abs(w.max[1] - upper.min[1]) <= 0.12,
    )
    expect(northWall).toBeDefined()
    // Stair foot sits inside the upper room — no wall segment covers it.
    const stairs = applied.layout.stairs[0]!
    const onStairFoot = upperWalls.some(
      (w) =>
        Math.abs(w.max[0] - stairs.position[0]) < 0.4 ||
        Math.abs(w.min[0] - stairs.position[0]) < 0.4,
    )
    expect(onStairFoot).toBe(false)
  })

  it('floor-1 walls block floor-1 agents but not floor-0 agents', () => {
    const applied = upstairsLayout()
    const upper = applied.layout.rooms.find((r) => r.floor === 1)!
    const walls = wallsFromLayout(applied.layout, CONFIG.door.position)
    // Walk north into the upper room's north wall from inside the room.
    const [, z0] = moveWithCollision(0, -3.2, 0, -0.3, [], [], CHAR_RADIUS, walls, undefined, 0)
    expect(z0).toBeLessThanOrEqual(-3.5)
    const [, z1] = moveWithCollision(0, -3.2, 0, -0.3, [], [], CHAR_RADIUS, walls, undefined, 1)
    expect(z1).toBeGreaterThan(-3.4)
    void upper
  })

  it('upstairs tables do not block floor-0 agents', () => {
    const applied = upstairsLayout()
    const [x0, z0] = resolveTablesCollision(0, 0, applied.tables, CHAR_RADIUS, 0)
    expect([x0, z0]).toEqual([0, 0])
    const [x1] = resolveTablesCollision(0, 0, applied.tables, CHAR_RADIUS, 1)
    expect(Math.abs(x1)).toBeGreaterThan(0.01)
  })
})
