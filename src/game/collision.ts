/** Simple AABB / capsule collision for the dining room. */

export const ROOM_LIMIT = 4.48
export const CHAR_RADIUS = 0.34

export type XZ = { x: number; z: number }

export type TableCollider = {
  shape: 'round' | 'rect' | 'oval'
  position: [number, number, number]
  half: { x: number; z: number }
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

export function clampRoom(x: number, z: number): [number, number] {
  return [
    Math.max(-ROOM_LIMIT, Math.min(ROOM_LIMIT, x)),
    Math.max(-ROOM_LIMIT, Math.min(ROOM_LIMIT, z)),
  ]
}

/** Keep agents from overlapping (circle-circle separation). */
export function separateFromOthers(
  x: number,
  z: number,
  others: XZ[],
  tables: TableCollider[],
  radius = CHAR_RADIUS,
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
  ;[nx, nz] = resolveTablesCollision(nx, nz, tables, radius)
  return clampRoom(nx, nz)
}

export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  tables: TableCollider[],
  others: XZ[] = [],
  radius = CHAR_RADIUS,
): [number, number] {
  let nx = x + dx
  let nz = z
  ;[nx, nz] = resolveTablesCollision(nx, nz, tables, radius)
  ;[nx, nz] = clampRoom(nx, nz)
  ;[nx, nz] = separateFromOthers(nx, nz, others, tables, radius)

  nz = nz + dz
  ;[nx, nz] = resolveTablesCollision(nx, nz, tables, radius)
  ;[nx, nz] = clampRoom(nx, nz)
  ;[nx, nz] = separateFromOthers(nx, nz, others, tables, radius)
  return [nx, nz]
}

/** Nudge target away from attacker (light knockback). */
export function knockbackFrom(
  from: [number, number, number],
  to: [number, number, number],
  strength = 0.45,
  tables: TableCollider[],
  others: XZ[] = [],
): [number, number] {
  let dx = to[0] - from[0]
  let dz = to[2] - from[2]
  const len = Math.hypot(dx, dz) || 1
  dx = (dx / len) * strength
  dz = (dz / len) * strength
  return moveWithCollision(to[0], to[2], dx, dz, tables, others)
}
