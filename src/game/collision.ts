/** Simple AABB / capsule collision for the dining room. */

export const TABLE_HALF = { x: 1.7, z: 1.2 }
export const TABLE_Y = 0.75
export const ROOM_LIMIT = 4.35
export const CHAR_RADIUS = 0.34

export type XZ = { x: number; z: number }

/** Push a circle out of the table rectangle on XZ. */
export function resolveTableCollision(
  x: number,
  z: number,
  radius = CHAR_RADIUS,
): [number, number] {
  const hx = TABLE_HALF.x + radius
  const hz = TABLE_HALF.z + radius
  if (Math.abs(x) <= hx && Math.abs(z) <= hz) {
    const dx = hx - Math.abs(x)
    const dz = hz - Math.abs(z)
    if (dx < dz) {
      x = Math.sign(x || 1) * hx
    } else {
      z = Math.sign(z || 1) * hz
    }
  }
  return [x, z]
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
  ;[nx, nz] = resolveTableCollision(nx, nz, radius)
  return clampRoom(nx, nz)
}

export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius = CHAR_RADIUS,
  others: XZ[] = [],
): [number, number] {
  let nx = x + dx
  let nz = z
  ;[nx, nz] = resolveTableCollision(nx, nz, radius)
  ;[nx, nz] = clampRoom(nx, nz)
  ;[nx, nz] = separateFromOthers(nx, nz, others, radius)

  nz = nz + dz
  ;[nx, nz] = resolveTableCollision(nx, nz, radius)
  ;[nx, nz] = clampRoom(nx, nz)
  ;[nx, nz] = separateFromOthers(nx, nz, others, radius)
  return [nx, nz]
}

/** Nudge target away from attacker (light knockback). */
export function knockbackFrom(
  from: [number, number, number],
  to: [number, number, number],
  strength = 0.45,
  others: XZ[] = [],
): [number, number] {
  let dx = to[0] - from[0]
  let dz = to[2] - from[2]
  const len = Math.hypot(dx, dz) || 1
  dx = (dx / len) * strength
  dz = (dz / len) * strength
  return moveWithCollision(to[0], to[2], dx, dz, CHAR_RADIUS, others)
}
