/** Simple AABB / capsule collision for the dining room. */

import type { SpaceLayoutState } from './spaceLayout'

export const ROOM_LIMIT = 4.48
export const CHAR_RADIUS = 0.34
/** Inset from room edges so agents don't clip walls. */
export const LAYOUT_BOUNDS_PADDING = 0.2

export type XZ = { x: number; z: number }

export type TableCollider = {
  shape: 'round' | 'rect' | 'oval'
  position: [number, number, number]
  half: { x: number; z: number }
}

export type LayoutBounds = {
  rooms: { min: [number, number]; max: [number, number] }[]
}

export function layoutBoundsFromLayout(
  layout: SpaceLayoutState,
  floor = 0,
  padding = LAYOUT_BOUNDS_PADDING,
): LayoutBounds {
  const rooms = layout.rooms
    .filter((r) => r.floor === floor)
    .map((r) => ({
      min: [r.min[0] - padding, r.min[1] - padding] as [number, number],
      max: [r.max[0] + padding, r.max[1] + padding] as [number, number],
    }))

  const openingPad = 0.55
  for (const o of layout.openings) {
    const fromRoom = layout.rooms.find((r) => r.id === o.fromRoom)
    const toRoom = layout.rooms.find((r) => r.id === o.toRoom)
    if (!fromRoom || !toRoom) continue
    if (fromRoom.floor !== floor && toRoom.floor !== floor) continue
    const ox = o.position[0]
    const oz = o.position[2]
    rooms.push({
      min: [ox - openingPad, oz - openingPad],
      max: [ox + openingPad, oz + openingPad],
    })
  }

  return { rooms }
}

function containsAabb(
  x: number,
  z: number,
  room: { min: [number, number]; max: [number, number] },
): boolean {
  return x >= room.min[0] && x <= room.max[0] && z >= room.min[1] && z <= room.max[1]
}

function clampToAabb(
  x: number,
  z: number,
  room: { min: [number, number]; max: [number, number] },
): [number, number] {
  return [
    Math.max(room.min[0], Math.min(room.max[0], x)),
    Math.max(room.min[1], Math.min(room.max[1], z)),
  ]
}

function distSqToAabb(
  x: number,
  z: number,
  room: { min: [number, number]; max: [number, number] },
): number {
  const [cx, cz] = clampToAabb(x, z, room)
  const dx = x - cx
  const dz = z - cz
  return dx * dx + dz * dz
}

/** Keep position inside the union of playable room AABBs (nearest room if outside). */
export function clampToLayout(x: number, z: number, bounds: LayoutBounds): [number, number] {
  if (bounds.rooms.length === 0) return [x, z]
  for (const room of bounds.rooms) {
    if (containsAabb(x, z, room)) return [x, z]
  }
  let best = bounds.rooms[0]!
  let bestDist = Infinity
  for (const room of bounds.rooms) {
    const d = distSqToAabb(x, z, room)
    if (d < bestDist) {
      bestDist = d
      best = room
    }
  }
  return clampToAabb(x, z, best)
}

export type ObstacleCollider = {
  min: [number, number]
  max: [number, number]
}

export function resolveTableShapeCollision(
  x: number,
  z: number,
  table: TableCollider,
  radius = CHAR_RADIUS,
): [number, number] {
  const cx = table.position[0]
  const cz = table.position[2]
  const lx = x - cx
  const lz = z - cz
  if (table.shape === 'round') {
    const r = Math.max(table.half.x, table.half.z) + radius
    const d = Math.hypot(lx, lz)
    if (d < r && d > 1e-6) {
      return [cx + (lx / d) * r, cz + (lz / d) * r]
    }
    if (d <= 1e-6) return [cx + r, cz]
    return [x, z]
  }
  const hx = table.half.x + radius
  const hz = table.half.z + radius
  if (Math.abs(lx) <= hx && Math.abs(lz) <= hz) {
    const dx = hx - Math.abs(lx)
    const dz = hz - Math.abs(lz)
    if (dx < dz) return [cx + Math.sign(lx || 1) * hx, z]
    return [x, cz + Math.sign(lz || 1) * hz]
  }
  return [x, z]
}

export function resolveObstacleCollision(
  x: number,
  z: number,
  obs: ObstacleCollider,
  radius = CHAR_RADIUS,
): [number, number] {
  const cx = (obs.min[0] + obs.max[0]) / 2
  const cz = (obs.min[1] + obs.max[1]) / 2
  const hx = (obs.max[0] - obs.min[0]) / 2 + radius
  const hz = (obs.max[1] - obs.min[1]) / 2 + radius
  const lx = x - cx
  const lz = z - cz
  if (Math.abs(lx) <= hx && Math.abs(lz) <= hz) {
    const dx = hx - Math.abs(lx)
    const dz = hz - Math.abs(lz)
    if (dx < dz) return [cx + Math.sign(lx || 1) * hx, z]
    return [x, cz + Math.sign(lz || 1) * hz]
  }
  return [x, z]
}

export function resolveObstaclesCollision(
  x: number,
  z: number,
  obstacles: ObstacleCollider[],
  radius = CHAR_RADIUS,
): [number, number] {
  let nx = x
  let nz = z
  for (const o of obstacles) {
    ;[nx, nz] = resolveObstacleCollision(nx, nz, o, radius)
  }
  return [nx, nz]
}

export function resolveWorldCollision(
  x: number,
  z: number,
  tables: TableCollider[],
  obstacles: ObstacleCollider[] = [],
  radius = CHAR_RADIUS,
): [number, number] {
  let nx = x
  let nz = z
  ;[nx, nz] = resolveTablesCollision(nx, nz, tables, radius)
  ;[nx, nz] = resolveObstaclesCollision(nx, nz, obstacles, radius)
  return [nx, nz]
}

export function resolveTablesCollision(
  x: number,
  z: number,
  tables: TableCollider[],
  radius = CHAR_RADIUS,
): [number, number] {
  let nx = x
  let nz = z
  for (const t of tables) {
    ;[nx, nz] = resolveTableShapeCollision(nx, nz, t, radius)
  }
  return [nx, nz]
}

/** @deprecated Use clampToLayout with layoutBoundsFromLayout instead. */
export function clampRoom(x: number, z: number): [number, number] {
  return [
    Math.max(-ROOM_LIMIT, Math.min(ROOM_LIMIT, x)),
    Math.max(-ROOM_LIMIT, Math.min(ROOM_LIMIT, z)),
  ]
}

function clampPosition(
  x: number,
  z: number,
  bounds?: LayoutBounds,
): [number, number] {
  if (bounds) return clampToLayout(x, z, bounds)
  return clampRoom(x, z)
}

/** Keep agents from overlapping (circle-circle separation). */
export function separateFromOthers(
  x: number,
  z: number,
  others: XZ[],
  tables: TableCollider[],
  radius = CHAR_RADIUS,
  obstacles: ObstacleCollider[] = [],
  bounds?: LayoutBounds,
): [number, number] {
  let nx = x
  let nz = z
  const minDist = radius * 2
  for (const o of others) {
    let dx = nx - o.x
    let dz = nz - o.z
    let d = Math.hypot(dx, dz)
    if (d < 1e-5) {
      dx = 1
      dz = 0
      d = 1
    }
    if (d < minDist) {
      const push = (minDist - d) * 0.55
      nx += (dx / d) * push
      nz += (dz / d) * push
    }
  }
  ;[nx, nz] = resolveWorldCollision(nx, nz, tables, obstacles, radius)
  return clampPosition(nx, nz, bounds)
}

export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  tables: TableCollider[],
  others: XZ[] = [],
  radius = CHAR_RADIUS,
  obstacles: ObstacleCollider[] = [],
  bounds?: LayoutBounds,
): [number, number] {
  let nx = x + dx
  let nz = z
  ;[nx, nz] = resolveWorldCollision(nx, nz, tables, obstacles, radius)
  ;[nx, nz] = clampPosition(nx, nz, bounds)
  ;[nx, nz] = separateFromOthers(nx, nz, others, tables, radius, obstacles, bounds)

  nz = nz + dz
  ;[nx, nz] = resolveWorldCollision(nx, nz, tables, obstacles, radius)
  ;[nx, nz] = clampPosition(nx, nz, bounds)
  ;[nx, nz] = separateFromOthers(nx, nz, others, tables, radius, obstacles, bounds)
  return [nx, nz]
}

/** Nudge target away from attacker (light knockback). */
export function knockbackFrom(
  from: [number, number, number],
  to: [number, number, number],
  strength = 0.45,
  tables: TableCollider[],
  others: XZ[] = [],
  obstacles: ObstacleCollider[] = [],
  bounds?: LayoutBounds,
): [number, number] {
  let dx = to[0] - from[0]
  let dz = to[2] - from[2]
  const len = Math.hypot(dx, dz) || 1
  dx = (dx / len) * strength
  dz = (dz / len) * strength
  return moveWithCollision(to[0], to[2], dx, dz, tables, others, CHAR_RADIUS, obstacles, bounds)
}
