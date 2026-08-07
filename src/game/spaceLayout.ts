import type { RoomId, RoomSide, SpaceObstacle, SpaceOpening, SpaceRoom, SpaceStairs } from './types'

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

/** Wall cabinets — static colliders (1.0 × 0.5 world footprint) for hide spots. */
export const CABINET_OBSTACLES: SpaceObstacle[] = [
  { id: 'cabinet-n', min: [3.1, -5], max: [4.1, -4.5] },
  { id: 'cabinet-s', min: [-4.1, 4.5], max: [-3.1, 5] },
  { id: 'cabinet-w', min: [-5, -4.1], max: [-4.5, -3.1] },
  { id: 'cabinet-e', min: [4.5, 3.1], max: [5, 4.1] },
]

/** Initial layout plus cabinet colliders (start of every mission). */
export function withFurniture(layout: SpaceLayoutState): SpaceLayoutState {
  return {
    ...layout,
    obstacles: [...CABINET_OBSTACLES],
  }
}

/** First non-cabinet obstacle, or null when only cabinets exist. */
export function firstNonCabinetObstacle(
  obstacles: SpaceObstacle[],
): SpaceObstacle | null {
  return obstacles.find((o) => !o.id.startsWith('cabinet-')) ?? null
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
    lastLatchedAt: 0,
  }

  return {
    rooms: [...layout.rooms, room],
    openings: [...layout.openings, opening],
    obstacles: layout.obstacles,
    stairs: layout.stairs,
  }
}

const SIDE_ORDER: RoomSide[] = ['east', 'west', 'north', 'south']

function roomMid(room: { min: [number, number]; max: [number, number] }): {
  x: number
  z: number
} {
  return {
    x: (room.min[0] + room.max[0]) / 2,
    z: (room.min[1] + room.max[1]) / 2,
  }
}

/** Candidate AABB (min/max as [x,z]) for a w×d room attached to a side of `room`. */
export function sideAabb(
  room: { min: [number, number]; max: [number, number] },
  side: RoomSide,
  w: number,
  d: number,
  gap = 1,
): { min: [number, number]; max: [number, number] } {
  const mid = roomMid(room)
  switch (side) {
    case 'east':
      return {
        min: [room.max[0] + gap, mid.z - d / 2],
        max: [room.max[0] + gap + w, mid.z + d / 2],
      }
    case 'west':
      return {
        min: [room.min[0] - gap - w, mid.z - d / 2],
        max: [room.min[0] - gap, mid.z + d / 2],
      }
    case 'north':
      return {
        min: [mid.x - w / 2, room.min[1] - gap - d],
        max: [mid.x + w / 2, room.min[1] - gap],
      }
    case 'south':
      return {
        min: [mid.x - w / 2, room.max[1] + gap],
        max: [mid.x + w / 2, room.max[1] + gap + d],
      }
  }
}

function aabbOverlap(
  a: { min: [number, number]; max: [number, number] },
  b: { min: [number, number]; max: [number, number] },
): boolean {
  return (
    a.min[0] < b.max[0] &&
    a.max[0] > b.min[0] &&
    a.min[1] < b.max[1] &&
    a.max[1] > b.min[1]
  )
}

/** Sides of `roomId` where a w×d room would not collide with existing rooms or obstacles. */
export function availableSides(
  layout: SpaceLayoutState,
  roomId: RoomId,
  w: number,
  d: number,
  gap = 1,
): RoomSide[] {
  const room = layout.rooms.find((r) => r.id === roomId)
  if (!room) return []
  const taken: { min: [number, number]; max: [number, number] }[] = [
    ...layout.rooms,
    ...layout.obstacles,
  ]
  return SIDE_ORDER.filter((side) => {
    const cand = sideAabb(room, side, w, d, gap)
    return !taken.some((t) => aabbOverlap(cand, t))
  })
}

/** Door center on the shared wall segment for a side attachment. */
export function sideDoorPosition(
  room: { min: [number, number]; max: [number, number] },
  side: RoomSide,
  roomMin: [number, number],
  roomMax: [number, number],
): [number, number, number] {
  const segX = (roomMin[0] + roomMax[0]) / 2
  const segZ = (roomMin[1] + roomMax[1]) / 2
  switch (side) {
    case 'east':
      return [room.max[0], 0, segZ]
    case 'west':
      return [room.min[0], 0, segZ]
    case 'north':
      return [segX, 0, room.min[1]]
    case 'south':
      return [segX, 0, room.max[1]]
  }
}

function doorAabbFor(
  position: [number, number, number],
  side: RoomSide,
): { min: [number, number]; max: [number, number] } {
  const half = 0.7
  const depth = 0.15
  if (side === 'east' || side === 'west') {
    return {
      min: [position[0] - depth, position[2] - half],
      max: [position[0] + depth, position[2] + half],
    }
  }
  return {
    min: [position[0] - half, position[2] - depth],
    max: [position[0] + half, position[2] + depth],
  }
}

/** Connect a new room on a specific side; a cabinet overlapping the door is replaced by it. */
export function addRoomConnectedAt(
  layout: SpaceLayoutState,
  room: SpaceRoom,
  openingId: string,
  fromRoomId: RoomId,
  side: RoomSide,
): SpaceLayoutState {
  const fromRoom = layout.rooms.find((r) => r.id === fromRoomId)
  if (!fromRoom) return layout

  const position = sideDoorPosition(fromRoom, side, room.min, room.max)
  const opening: SpaceOpening = {
    id: openingId,
    fromRoom: fromRoomId,
    toRoom: room.id,
    position,
    latchedUntil: 0,
    lastLatchedAt: 0,
  }

  const doorAabb = doorAabbFor(position, side)
  const obstacles = layout.obstacles.filter(
    (o) => !(o.id.startsWith('cabinet-') && aabbOverlap(doorAabb, o)),
  )

  return {
    rooms: [...layout.rooms, room],
    openings: [...layout.openings, opening],
    obstacles,
    stairs: layout.stairs,
  }
}

export type ConnectionPick = { roomId: RoomId; side: RoomSide }

/** Pick a random available side for a w×d room; prefers r0, then room order; null when none. */
export function pickConnection(
  layout: SpaceLayoutState,
  w: number,
  d: number,
  rng: () => number,
  gap = 1,
): ConnectionPick | null {
  for (const room of layout.rooms) {
    const sides = availableSides(layout, room.id, w, d, gap)
    if (!sides.length) continue
    const side = sides[Math.floor(rng() * sides.length)]!
    return { roomId: room.id, side }
  }
  return null
}

/** World Y offset per floor band (matches Room mesh). */
export const FLOOR_ELEVATION = 1.5

export function floorY(floor: number): number {
  return floor * FLOOR_ELEVATION
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
