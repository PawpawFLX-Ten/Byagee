import type { RoomId, SpaceObstacle, SpaceOpening, SpaceRoom, SpaceStairs } from './types'

export interface SpaceLayoutState {
  rooms: SpaceRoom[]
  openings: SpaceOpening[]
  obstacles: SpaceObstacle[]
  stairs: SpaceStairs[]
}

/** Default single-room layout: r0 AABB ~±5 matching playable area. */
export function createInitialLayout(): SpaceLayoutState {
  return {
    rooms: [
      {
        id: 'r0',
        min: [-5, -5],
        max: [5, 5],
        floor: 0,
      },
    ],
    openings: [],
    obstacles: [],
    stairs: [],
  }
}

function containsRoom(room: SpaceRoom, x: number, z: number): boolean {
  return x >= room.min[0] && x <= room.max[0] && z >= room.min[1] && z <= room.max[1]
}

/** Room membership from world XZ; highest floor wins when AABBs overlap. */
export function roomIdAt(
  layout: SpaceLayoutState,
  x: number,
  z: number,
  floor: number,
): RoomId {
  const containing = layout.rooms.filter((r) => containsRoom(r, x, z))
  if (!containing.length) return layout.rooms[0]?.id ?? 'r0'

  const atFloor = containing.filter((r) => r.floor === floor)
  const pool = atFloor.length ? atFloor : containing
  return pool.reduce((best, r) => (r.floor > best.floor ? r : best)).id
}

function buildAdjacency(
  layout: SpaceLayoutState,
): Map<RoomId, { room: RoomId; opening: SpaceOpening }[]> {
  const adj = new Map<RoomId, { room: RoomId; opening: SpaceOpening }[]>()
  const add = (a: RoomId, b: RoomId, opening: SpaceOpening) => {
    if (!adj.has(a)) adj.set(a, [])
    adj.get(a)!.push({ room: b, opening })
  }
  for (const o of layout.openings) {
    add(o.fromRoom, o.toRoom, o)
    add(o.toRoom, o.fromRoom, o)
  }
  return adj
}

/** BFS hop count between rooms; 0 if same, Infinity if unreachable. */
export function hopDistance(layout: SpaceLayoutState, a: RoomId, b: RoomId): number {
  if (a === b) return 0
  const adj = buildAdjacency(layout)
  const dist = new Map<RoomId, number>([[a, 0]])
  const queue: RoomId[] = [a]
  while (queue.length) {
    const cur = queue.shift()!
    const d = dist.get(cur)!
    for (const { room: next } of adj.get(cur) ?? []) {
      if (dist.has(next)) continue
      dist.set(next, d + 1)
      if (next === b) return d + 1
      queue.push(next)
    }
  }
  return Infinity
}

function bfsDistances(layout: SpaceLayoutState, from: RoomId): Map<RoomId, number> {
  const adj = buildAdjacency(layout)
  const dist = new Map<RoomId, number>([[from, 0]])
  const queue: RoomId[] = [from]
  while (queue.length) {
    const cur = queue.shift()!
    const d = dist.get(cur)!
    for (const { room: next } of adj.get(cur) ?? []) {
      if (dist.has(next)) continue
      dist.set(next, d + 1)
      queue.push(next)
    }
  }
  return dist
}

/** True if any opening on a shortest path from→to is latched at `now`. */
export function latchedOnPath(
  layout: SpaceLayoutState,
  from: RoomId,
  to: RoomId,
  now: number,
): boolean {
  if (from === to) return false
  const distFrom = bfsDistances(layout, from)
  const total = distFrom.get(to)
  if (total === undefined) return false

  const distTo = bfsDistances(layout, to)

  for (const o of layout.openings) {
    if (o.latchedUntil <= now) continue
    const a = o.fromRoom
    const b = o.toRoom
    const viaAb = (distFrom.get(a) ?? Infinity) + 1 + (distTo.get(b) ?? Infinity)
    const viaBa = (distFrom.get(b) ?? Infinity) + 1 + (distTo.get(a) ?? Infinity)
    if (viaAb === total || viaBa === total) return true
  }
  return false
}

/** Connect a new room to r0 (or `fromRoomId`) via a door opening. */
export function addRoomConnected(
  layout: SpaceLayoutState,
  room: SpaceRoom,
  openingId: string,
  fromRoomId: RoomId = 'r0',
): SpaceLayoutState {
  const fromRoom = layout.rooms.find((r) => r.id === fromRoomId)
  if (!fromRoom) return layout

  const midX = (fromRoom.max[0] + room.min[0]) / 2
  const midZ = (fromRoom.min[1] + room.max[1]) / 2

  const opening: SpaceOpening = {
    id: openingId,
    fromRoom: fromRoomId,
    toRoom: room.id,
    position: [midX, 0, midZ],
    latchedUntil: 0,
  }

  return {
    rooms: [...layout.rooms, room],
    openings: [...layout.openings, opening],
    obstacles: layout.obstacles,
    stairs: layout.stairs,
  }
}

/** Infer player floor from Y height (stairs land ~1.5m). */
export function floorFromPlayerY(y: number): number {
  return y > 1.2 ? 1 : 0
}

/** Room for a world XZ seat (floor 0 unless upstairs). */
export function roomIdForSeat(
  layout: SpaceLayoutState,
  seat: [number, number, number],
  floor = 0,
): RoomId {
  return roomIdAt(layout, seat[0], seat[2], floor)
}
