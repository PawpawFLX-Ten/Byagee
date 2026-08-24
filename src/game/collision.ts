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

export type ObstacleCollider = {
  min: [number, number]
  max: [number, number]
  /** Floor band the collider lives on; undefined blocks every floor. */
  floor?: number
  /** Ramp surface height probe; agents off the surface are pushed out. */
  rampHeight?: (x: number, z: number) => number | null
}

/** Agents within this Y distance of a ramp surface are "on the stairs". */
export const RAMP_SURFACE_TOL = 0.35

/** Floor band of a world Y (matches spaceLayout.floorFromPlayerY). */
export function floorOfY(y: number): number {
  return y > 1.2 ? 1 : 0
}

/** Floor band of a table collider from its Y. */
function floorOfTable(table: TableCollider): number {
  return floorOfY(table.position[1])
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
    // Door pad plus a bridge across the roomGap corridor to the far room, so
    // agents can walk through the door instead of being clamped at the wall.
    const onXWall =
      Math.abs(ox - fromRoom.max[0]) < 0.01 || Math.abs(ox - fromRoom.min[0]) < 0.01
    if (onXWall) {
      rooms.push({
        min: [
          Math.min(ox - openingPad, toRoom.min[0] - padding),
          oz - openingPad,
        ] as [number, number],
        max: [
          Math.max(ox + openingPad, toRoom.max[0] + padding),
          oz + openingPad,
        ] as [number, number],
      })
    } else {
      rooms.push({
        min: [
          ox - openingPad,
          Math.min(oz - openingPad, toRoom.min[1] - padding),
        ] as [number, number],
        max: [
          ox + openingPad,
          Math.max(oz + openingPad, toRoom.max[1] + padding),
        ] as [number, number],
      })
    }
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

/** Split [start,end] into segments with gaps (e.g. doors) removed. */
export function splitSegments(
  start: number,
  end: number,
  gaps: number[],
  gapHalf: number,
): [number, number][] {
  const segs: [number, number][] = []
  let cur = start
  for (const g of [...gaps].sort((a, b) => a - b)) {
    if (g - gapHalf > cur) segs.push([cur, g - gapHalf])
    cur = Math.max(cur, g + gapHalf)
  }
  if (cur < end) segs.push([cur, end])
  return segs
}

/** Solid wall segments for every room, minus door gaps and the main door. */
export function wallsFromLayout(
  layout: SpaceLayoutState,
  mainDoorPos: [number, number, number] = [0, 0, -4.9],
): ObstacleCollider[] {
  const walls: ObstacleCollider[] = []
  const half = 0.7
  const thick = 0.1
  // A door sits on the source room's wall; the far room's wall is one
  // roomGap away, so match gaps within the gap distance.
  const gapTol = 1.1
  for (const room of layout.rooms) {
    const { min, max } = room
    const doorGaps: Record<'n' | 's' | 'e' | 'w', number[]> = {
      n: [],
      s: [],
      e: [],
      w: [],
    }
    for (const o of layout.openings) {
      if (o.fromRoom !== room.id && o.toRoom !== room.id) continue
      // Cross-floor openings are stairwells: the ramp passes under the
      // wall band, so no door gap is cut (walls are floor-aware instead).
      const other = layout.rooms.find((r) =>
        r.id === (o.fromRoom === room.id ? o.toRoom : o.fromRoom),
      )
      if (other && other.floor !== room.floor) continue
      if (Math.abs(o.position[2] - min[1]) < gapTol) doorGaps.n.push(o.position[0])
      else if (Math.abs(o.position[2] - max[1]) < gapTol) doorGaps.s.push(o.position[0])
      else if (Math.abs(o.position[0] - min[0]) < gapTol) doorGaps.w.push(o.position[2])
      else if (Math.abs(o.position[0] - max[0]) < gapTol) doorGaps.e.push(o.position[2])
    }
    // Main entrance cuts the r0 north wall (door sits ~0.1 in front of it).
    if (room.id === 'r0' && Math.abs(mainDoorPos[2] - min[1]) < 0.3) {
      doorGaps.n.push(mainDoorPos[0])
    }
    const push = (start: number, end: number, axis: 'x' | 'z', fixed: number) => {
      if (end - start <= 0) return
      if (axis === 'x') {
        walls.push({ min: [start, fixed - thick], max: [end, fixed + thick], floor: room.floor })
      } else {
        walls.push({ min: [fixed - thick, start], max: [fixed + thick, end], floor: room.floor })
      }
    }
    for (const [s, e] of splitSegments(min[0], max[0], doorGaps.n, half)) push(s, e, 'x', min[1])
    for (const [s, e] of splitSegments(min[0], max[0], doorGaps.s, half)) push(s, e, 'x', max[1])
    for (const [s, e] of splitSegments(min[1], max[1], doorGaps.w, half)) push(s, e, 'z', min[0])
    for (const [s, e] of splitSegments(min[1], max[1], doorGaps.e, half)) push(s, e, 'z', max[0])
  }
  return walls
}

/** Cache walls per layout object — layouts are immutable between space events. */
const wallsCache = new WeakMap<SpaceLayoutState, ObstacleCollider[]>()

export function cachedWallsFromLayout(
  layout: SpaceLayoutState,
  mainDoorPos: [number, number, number],
): ObstacleCollider[] {
  let walls = wallsCache.get(layout)
  if (!walls) {
    walls = wallsFromLayout(layout, mainDoorPos)
    wallsCache.set(layout, walls)
  }
  return walls
}

export function resolveTableShapeCollision(
  x: number,
  z: number,
  table: TableCollider,
  radius = CHAR_RADIUS,
  floor = 0,
): [number, number] {
  if (floorOfTable(table) !== floor) return [x, z]
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
  floor = 0,
  agentY = 0,
): [number, number] {
  if (obs.floor !== undefined && obs.floor !== floor) return [x, z]
  const cx = (obs.min[0] + obs.max[0]) / 2
  const cz = (obs.min[1] + obs.max[1]) / 2
  const hx = (obs.max[0] - obs.min[0]) / 2 + radius
  const hz = (obs.max[1] - obs.min[1]) / 2 + radius
  const lx = x - cx
  const lz = z - cz
  if (Math.abs(lx) <= hx && Math.abs(lz) <= hz) {
    // Ramp wedges: agents standing ON the surface pass; anyone off the
    // surface (side/top/foot entries) is pushed out of the stair volume.
    if (obs.rampHeight) {
      const h = obs.rampHeight(x, z)
      if (h !== null && Math.abs(agentY - h) <= RAMP_SURFACE_TOL) return [x, z]
    }
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
  floor = 0,
  agentY = 0,
): [number, number] {
  let nx = x
  let nz = z
  for (const o of obstacles) {
    ;[nx, nz] = resolveObstacleCollision(nx, nz, o, radius, floor, agentY)
  }
  return [nx, nz]
}

export function resolveWorldCollision(
  x: number,
  z: number,
  tables: TableCollider[],
  obstacles: ObstacleCollider[] = [],
  radius = CHAR_RADIUS,
  floor = 0,
  agentY = 0,
): [number, number] {
  let nx = x
  let nz = z
  ;[nx, nz] = resolveTablesCollision(nx, nz, tables, radius, floor)
  ;[nx, nz] = resolveObstaclesCollision(nx, nz, obstacles, radius, floor, agentY)
  return [nx, nz]
}

export function resolveTablesCollision(
  x: number,
  z: number,
  tables: TableCollider[],
  radius = CHAR_RADIUS,
  floor = 0,
): [number, number] {
  let nx = x
  let nz = z
  for (const t of tables) {
    ;[nx, nz] = resolveTableShapeCollision(nx, nz, t, radius, floor)
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
  floor = 0,
  agentY = 0,
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
  ;[nx, nz] = resolveWorldCollision(nx, nz, tables, obstacles, radius, floor, agentY)
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
  floor = 0,
  agentY = 0,
): [number, number] {
  let nx = x + dx
  let nz = z
  ;[nx, nz] = resolveWorldCollision(nx, nz, tables, obstacles, radius, floor, agentY)
  ;[nx, nz] = clampPosition(nx, nz, bounds)
  ;[nx, nz] = separateFromOthers(nx, nz, others, tables, radius, obstacles, bounds, floor, agentY)

  nz = nz + dz
  ;[nx, nz] = resolveWorldCollision(nx, nz, tables, obstacles, radius, floor, agentY)
  ;[nx, nz] = clampPosition(nx, nz, bounds)
  ;[nx, nz] = separateFromOthers(nx, nz, others, tables, radius, obstacles, bounds, floor, agentY)
  return [nx, nz]
}

/**
 * Largest single-step displacement that cannot tunnel past a wall: the
 * resolve pass only catches overlaps, and the effective interception band
 * of a thin wall is ±(wallThickness + CHAR_RADIUS). Steps beyond that can
 * land fully on the far side and slip through.
 */
const MAX_STEP_NO_TUNNEL = 0.3

/** Nudge target away from attacker (light knockback). */
export function knockbackFrom(
  from: [number, number, number],
  to: [number, number, number],
  strength = 0.45,
  tables: TableCollider[],
  others: XZ[] = [],
  obstacles: ObstacleCollider[] = [],
  bounds?: LayoutBounds,
  floor = 0,
  agentY = 0,
): [number, number] {
  let dx = to[0] - from[0]
  let dz = to[2] - from[2]
  const len = Math.hypot(dx, dz) || 1
  dx = (dx / len) * strength
  dz = (dz / len) * strength

  const dist = Math.hypot(dx, dz)
  if (dist <= MAX_STEP_NO_TUNNEL) {
    return moveWithCollision(to[0], to[2], dx, dz, tables, others, CHAR_RADIUS, obstacles, bounds, floor, agentY)
  }

  // Substep long knockbacks along the same absolute direction so each
  // segment stays inside the resolvable band — pressing against a wall
  // instead of teleporting through it.
  const steps = Math.ceil(dist / MAX_STEP_NO_TUNNEL)
  const sdx = dx / steps
  const sdz = dz / steps
  let nx = to[0]
  let nz = to[2]
  for (let i = 0; i < steps; i++) {
    ;[nx, nz] = moveWithCollision(nx, nz, sdx, sdz, tables, others, CHAR_RADIUS, obstacles, bounds, floor, agentY)
  }
  return [nx, nz]
}
