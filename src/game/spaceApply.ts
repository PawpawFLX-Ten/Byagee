import {
  addRoomConnectedAt,
  availableSides,
  firstNonCabinetObstacle,
  floorFromPlayerY,
  floorY,
  pickConnection,
  roomIdAt,
  sideAabb,
  type SpaceLayoutState,
} from './spaceLayout'
import { CONFIG } from './config'
import type { FoodSpot, RoomSide, SpaceEventId, TableDef } from './types'

export type ApplySpaceEventInput = {
  layout: SpaceLayoutState
  tables: TableDef[]
  seatPositions: [number, number, number][]
  foodSpots?: FoodSpot[]
  maxNpcs: number
  eventId: SpaceEventId
  rng: () => number
}

export type ApplySpaceEventResult = {
  layout: SpaceLayoutState
  tables: TableDef[]
  seatPositions: [number, number, number][]
  foodSpots: FoodSpot[]
  maxNpcs: number
  doorMaxNpcs?: number
  /** Original seat indices removed (C2 shrink). */
  invalidSeatIndices?: number[]
  /** Old seat index → new index after compaction; absent = removed. */
  seatIndexRemap?: Map<number, number>
}

function cloneLayout(layout: SpaceLayoutState): SpaceLayoutState {
  return {
    rooms: layout.rooms.map((r) => ({ ...r, min: [...r.min] as [number, number], max: [...r.max] as [number, number] })),
    openings: layout.openings.map((o) => ({
      ...o,
      position: [...o.position] as [number, number, number],
    })),
    obstacles: layout.obstacles.map((o) => ({
      ...o,
      min: [...o.min] as [number, number],
      max: [...o.max] as [number, number],
    })),
    stairs: layout.stairs.map((s) => ({
      ...s,
      position: [...s.position] as [number, number, number],
    })),
  }
}

function nextRoomId(layout: SpaceLayoutState): string {
  const nums = layout.rooms
    .map((r) => /^r(\d+)$/.exec(r.id))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => parseInt(m[1], 10))
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `r${next}`
}

function nextId(prefix: string, existing: string[]): string {
  let n = existing.length
  let id = `${prefix}-${n}`
  const set = new Set(existing)
  while (set.has(id)) {
    n += 1
    id = `${prefix}-${n}`
  }
  return id
}

function seatsAroundTable(
  tablePos: [number, number, number],
  count: number,
  radius = 1.35,
  seatY = tablePos[1],
): [number, number, number][] {
  const seats: [number, number, number][] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 4
    seats.push([
      tablePos[0] + Math.sin(angle) * radius,
      seatY,
      tablePos[2] + Math.cos(angle) * radius,
    ])
  }
  return seats
}

function foodForSeat(
  seat: [number, number, number],
  tablePos: [number, number, number],
  id: string,
): FoodSpot {
  return {
    id,
    plate: [
      (seat[0] + tablePos[0]) / 2,
      seat[1] + 0.82,
      (seat[2] + tablePos[2]) / 2,
    ],
    approach: [...seat] as [number, number, number],
  }
}

function appendTableBundle(
  tables: TableDef[],
  seatPositions: [number, number, number][],
  foodSpots: FoodSpot[],
  table: TableDef,
  seatCount: number,
  rng: () => number,
): { tables: TableDef[]; seatPositions: [number, number, number][]; foodSpots: FoodSpot[] } {
  const count = Math.max(2, Math.min(4, seatCount))
  const seats = seatsAroundTable(table.position, count + Math.floor(rng() * 0.001))
  const actualCount = Math.min(count, seats.length)
  const newSeats = seats.slice(0, actualCount)
  const newFoods = newSeats.map((s, i) =>
    foodForSeat(s, table.position, `food-${foodSpots.length + i}`),
  )
  return {
    tables: [...tables, table],
    seatPositions: [...seatPositions, ...newSeats],
    foodSpots: [...foodSpots, ...newFoods],
  }
}

function primaryRoom(layout: SpaceLayoutState): SpaceLayoutState['rooms'][0] {
  return layout.rooms.find((r) => r.id === 'r0') ?? layout.rooms[0]!
}

function roomCenter(room: { min: [number, number]; max: [number, number] }): [number, number] {
  return [(room.min[0] + room.max[0]) / 2, (room.min[1] + room.max[1]) / 2]
}

type AttachResult = {
  layout: SpaceLayoutState
  roomId: string
  center: [number, number]
  side: RoomSide
}

/** Attach a w×d room to a random available side; null when every side is taken. */
function attachRoom(
  layout: SpaceLayoutState,
  w: number,
  d: number,
  rng: () => number,
): AttachResult | null {
  const pick = pickConnection(layout, w, d, rng, CONFIG.space.roomGap)
  if (!pick) return null
  const fromRoom = layout.rooms.find((r) => r.id === pick.roomId)!
  const aabb = sideAabb(fromRoom, pick.side, w, d, CONFIG.space.roomGap)
  const roomId = nextRoomId(layout)
  const newLayout = addRoomConnectedAt(
    layout,
    { id: roomId, min: aabb.min, max: aabb.max, floor: 0 },
    `door-${roomId}`,
    pick.roomId,
    pick.side,
  )
  return { layout: newLayout, roomId, center: roomCenter(aabb), side: pick.side }
}

function noOp(input: ApplySpaceEventInput): ApplySpaceEventResult {
  return {
    layout: input.layout,
    tables: input.tables,
    seatPositions: input.seatPositions,
    foodSpots: input.foodSpots ?? [],
    maxNpcs: input.maxNpcs,
  }
}

function expandRoomAabb(
  layout: SpaceLayoutState,
  roomId: string,
  delta: number,
): SpaceLayoutState {
  const L = cloneLayout(layout)
  const room = L.rooms.find((r) => r.id === roomId)
  if (!room) return L
  room.min = [room.min[0] - delta, room.min[1] - delta]
  room.max = [room.max[0] + delta, room.max[1] + delta]
  return L
}

function shrinkRoomAabb(
  layout: SpaceLayoutState,
  roomId: string,
  delta: number,
): SpaceLayoutState {
  return expandRoomAabb(layout, roomId, -delta)
}

function seatInsideRoom(
  seat: [number, number, number],
  room: { min: [number, number]; max: [number, number] },
): boolean {
  return (
    seat[0] >= room.min[0] &&
    seat[0] <= room.max[0] &&
    seat[2] >= room.min[1] &&
    seat[2] <= room.max[1]
  )
}

function compactSeats(
  seatPositions: [number, number, number][],
  invalidIndices: Set<number>,
): {
  seatPositions: [number, number, number][]
  remap: Map<number, number>
} {
  const remap = new Map<number, number>()
  const next: [number, number, number][] = []
  seatPositions.forEach((s, i) => {
    if (invalidIndices.has(i)) return
    remap.set(i, next.length)
    next.push(s)
  })
  return { seatPositions: next, remap }
}

function applyA1(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 4, 6, input.rng)
  if (!attach) return noOp(input)

  const table: TableDef = {
    id: `t-${attach.roomId}`,
    shape: 'round',
    position: [attach.center[0], 0, attach.center[1]],
    half: { x: 0.85, z: 0.85 },
    topY: 0.75,
  }
  const seatCount = 2 + Math.floor(input.rng() * 3)
  const foodSpots = input.foodSpots ?? []
  const bundled = appendTableBundle(
    input.tables,
    input.seatPositions,
    foodSpots,
    table,
    seatCount,
    input.rng,
  )

  return {
    layout: attach.layout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyA2(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const gap = CONFIG.space.roomGap
  const pick = pickConnection(input.layout, 2.5, 2, input.rng, gap)
  if (!pick) return noOp(input)

  const fromRoom = input.layout.rooms.find((r) => r.id === pick.roomId)!
  const corridorAabb = sideAabb(fromRoom, pick.side, 2.5, 2, gap)
  const corridorId = nextRoomId(input.layout)
  let newLayout = addRoomConnectedAt(
    input.layout,
    { id: corridorId, min: corridorAabb.min, max: corridorAabb.max, floor: 0 },
    `door-${corridorId}`,
    pick.roomId,
    pick.side,
  )

  const endAabb = sideAabb(corridorAabb, pick.side, 4.5, 8, gap)
  const sideFree = availableSides(newLayout, corridorId, 4.5, 8, gap).includes(pick.side)
  if (!sideFree) return noOp(input)

  const roomId = nextRoomId(newLayout)
  newLayout = addRoomConnectedAt(
    newLayout,
    { id: roomId, min: endAabb.min, max: endAabb.max, floor: 0 },
    `door-${roomId}`,
    corridorId,
    pick.side,
  )

  const center = roomCenter(endAabb)
  const table: TableDef = {
    id: `t-${roomId}`,
    shape: 'rect',
    position: [center[0] - 0.25, 0, center[1]],
    half: { x: 1.1, z: 0.75 },
    topY: 0.75,
  }
  const foodSpots = input.foodSpots ?? []
  const bundled = appendTableBundle(
    input.tables,
    input.seatPositions,
    foodSpots,
    table,
    3,
    input.rng,
  )

  return {
    layout: newLayout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyA3(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 8, 10, input.rng)
  if (!attach) return noOp(input)

  const tables: TableDef[] = [
    {
      id: `t-${attach.roomId}a`,
      shape: 'oval',
      position: [attach.center[0] - 1, 0, attach.center[1] - 1.5],
      half: { x: 1.4, z: 0.6 },
      topY: 0.75,
    },
    {
      id: `t-${attach.roomId}b`,
      shape: 'rect',
      position: [attach.center[0] + 1.5, 0, attach.center[1] + 2],
      half: { x: 1.2, z: 0.8 },
      topY: 0.75,
    },
  ]

  let seatPositions = [...input.seatPositions]
  let foodSpots = [...(input.foodSpots ?? [])]
  let allTables = [...input.tables]

  for (const table of tables) {
    const bundled = appendTableBundle(allTables, seatPositions, foodSpots, table, 4, input.rng)
    allTables = bundled.tables
    seatPositions = bundled.seatPositions
    foodSpots = bundled.foodSpots
  }

  return {
    layout: attach.layout,
    tables: allTables,
    seatPositions,
    foodSpots,
    maxNpcs: seatPositions.length,
    doorMaxNpcs: seatPositions.length,
  }
}

function applyA4(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const layout = cloneLayout(input.layout)
  const roomId = nextRoomId(layout)
  const upper = {
    id: roomId,
    min: [-3.5, -3.5] as [number, number],
    max: [3.5, 3.5] as [number, number],
    floor: 1,
  }
  const stairsId = `stairs-${roomId}`
  const newLayout: SpaceLayoutState = {
    ...layout,
    rooms: [...layout.rooms, upper],
    openings: [
      ...layout.openings,
      {
        id: `door-${roomId}`,
        fromRoom: 'r0',
        toRoom: roomId,
        position: [2.5, 0, 2.5],
        latchedUntil: 0,
        lastLatchedAt: 0,
      },
    ],
    stairs: [
      ...layout.stairs,
      {
        id: stairsId,
        position: [2.5, 0, 2.5],
        fromRoom: 'r0',
        toRoom: roomId,
      },
    ],
  }

  const upperY = floorY(1)
  const table: TableDef = {
    id: `t-${roomId}`,
    shape: 'round',
    position: [0, upperY, 0],
    half: { x: 0.7, z: 0.7 },
    topY: 0.75,
  }
  const foodSpots = input.foodSpots ?? []
  const bundled = appendTableBundle(
    input.tables,
    input.seatPositions,
    foodSpots,
    table,
    2,
    input.rng,
  )

  return {
    layout: newLayout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyC1(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const newLayout = expandRoomAabb(input.layout, 'r0', 1.5)
  const room = primaryRoom(newLayout)

  let tables = [...input.tables]
  let seatPositions = [...input.seatPositions]
  let foodSpots = [...(input.foodSpots ?? [])]

  const cornerX = room.max[0] - 1.8
  const cornerZ = room.min[1] + 1.8
  const overlapsSeat = seatPositions.some(
    (s) => Math.hypot(s[0] - cornerX, s[2] - cornerZ) < 1.5,
  )
  if (!overlapsSeat) {
    const table: TableDef = {
      id: nextId('t-expand', tables.map((t) => t.id)),
      shape: 'round',
      position: [cornerX, 0, cornerZ],
      half: { x: 0.75, z: 0.75 },
      topY: 0.75,
    }
    const bundled = appendTableBundle(tables, seatPositions, foodSpots, table, 2, input.rng)
    tables = bundled.tables
    seatPositions = bundled.seatPositions
    foodSpots = bundled.foodSpots
  }

  return {
    layout: newLayout,
    tables,
    seatPositions,
    foodSpots,
    maxNpcs: seatPositions.length,
    doorMaxNpcs: seatPositions.length,
  }
}

function applyC2(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const newLayout = shrinkRoomAabb(input.layout, 'r0', 1.5)
  const room = primaryRoom(newLayout)

  const invalidSeatIndices: number[] = []
  input.seatPositions.forEach((s, i) => {
    if (!seatInsideRoom(s, room)) invalidSeatIndices.push(i)
  })
  const invalidSet = new Set(invalidSeatIndices)
  const { seatPositions, remap } = compactSeats(input.seatPositions, invalidSet)

  const foodSpots = (input.foodSpots ?? []).filter((_, i) => !invalidSet.has(i))

  return {
    layout: newLayout,
    tables: input.tables,
    seatPositions,
    foodSpots,
    maxNpcs: seatPositions.length,
    doorMaxNpcs: seatPositions.length,
    invalidSeatIndices,
    seatIndexRemap: remap,
  }
}

function applyC3(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const layout = cloneLayout(input.layout)
  const ids = layout.obstacles.map((o) => o.id)
  const pillarA: SpaceLayoutState['obstacles'][0] = {
    id: nextId('obs', ids),
    min: [-1.5, 0.5],
    max: [-0.5, 1.5],
  }
  const pillarB: SpaceLayoutState['obstacles'][0] = {
    id: nextId('obs', [...ids, pillarA.id]),
    min: [1, -2],
    max: [2, -1],
  }
  layout.obstacles = [...layout.obstacles, pillarA, pillarB]

  return {
    layout,
    tables: input.tables,
    seatPositions: input.seatPositions,
    foodSpots: input.foodSpots ?? [],
    maxNpcs: input.maxNpcs,
  }
}

function applyC4(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const layout = cloneLayout(input.layout)
  const roomId = nextRoomId(layout)
  const platform = {
    id: roomId,
    min: [-2, 1.5] as [number, number],
    max: [2, 4.5] as [number, number],
    floor: 1,
  }
  const stairsId = `stairs-${roomId}`
  layout.rooms = [...layout.rooms, platform]
  layout.stairs = [
    ...layout.stairs,
    {
      id: stairsId,
      position: [-1.5, 0, 3.5],
      fromRoom: 'r0',
      toRoom: roomId,
    },
  ]
  layout.openings = [
    ...layout.openings,
    {
      id: `door-${roomId}`,
      fromRoom: 'r0',
      toRoom: roomId,
      position: [-1.5, 0, 3.5],
      latchedUntil: 0,
      lastLatchedAt: 0,
    },
  ]

  const upperY = floorY(1)
  const table: TableDef = {
    id: `t-${roomId}`,
    shape: 'rect',
    position: [0, upperY, 3],
    half: { x: 0.9, z: 0.55 },
    topY: 0.75,
  }
  const foodSpots = input.foodSpots ?? []
  const bundled = appendTableBundle(
    input.tables,
    input.seatPositions,
    foodSpots,
    table,
    2,
    input.rng,
  )

  return {
    layout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyC5(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const layout = cloneLayout(input.layout)
  const target = firstNonCabinetObstacle(layout.obstacles)
  if (target) {
    const nudge = input.rng() > 0.5 ? 0.4 : -0.4
    target.min = [target.min[0] + nudge, target.min[1] + nudge]
    target.max = [target.max[0] + nudge, target.max[1] + nudge]
  } else {
    const room = primaryRoom(layout)
    room.min = [room.min[0] + 0.3, room.min[1] + 0.3]
    room.max = [room.max[0] - 0.3, room.max[1] - 0.3]
  }

  return {
    layout,
    tables: input.tables,
    seatPositions: input.seatPositions,
    foodSpots: input.foodSpots ?? [],
    maxNpcs: input.maxNpcs,
  }
}

function applyA5(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 3.5, 5, input.rng)
  if (!attach) return noOp(input)

  // Bar counter along the back wall — blocks pathing, not sound.
  const newLayout = {
    ...attach.layout,
    obstacles: [
      ...attach.layout.obstacles,
      {
        id: `obs-bar-${attach.roomId}`,
        min: [attach.center[0] - 0.95, attach.center[1] - 2.3],
        max: [attach.center[0] + 1.05, attach.center[1] - 1.4],
      },
    ],
  }

  const tables: TableDef[] = [
    {
      id: `t-${attach.roomId}a`,
      shape: 'round',
      position: [attach.center[0], 0, attach.center[1] - 0.8],
      half: { x: 0.8, z: 0.8 },
      topY: 0.75,
    },
    {
      id: `t-${attach.roomId}b`,
      shape: 'round',
      position: [attach.center[0], 0, attach.center[1] + 1.2],
      half: { x: 0.7, z: 0.7 },
      topY: 0.75,
    },
  ]
  const foodSpots = input.foodSpots ?? []
  let bundled = appendTableBundle(
    input.tables,
    input.seatPositions,
    foodSpots,
    tables[0],
    4,
    input.rng,
  )
  bundled = appendTableBundle(
    bundled.tables,
    bundled.seatPositions,
    bundled.foodSpots,
    tables[1],
    2,
    input.rng,
  )
  return {
    layout: newLayout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyC6(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const layout = cloneLayout(input.layout)
  const ids = layout.obstacles.map((o) => o.id)
  const mk = (
    min: [number, number],
    max: [number, number],
  ): SpaceLayoutState['obstacles'][0] => {
    const id = nextId('obs', ids)
    ids.push(id)
    return { id, min, max }
  }
  const screens = [
    mk([-2.2, -2.4], [-1, -1.2]),
    mk([0.4, 0.2], [1.6, 1.4]),
    mk([2.2, -0.4], [3.4, 0.8]),
  ]
  layout.obstacles = [...layout.obstacles, ...screens]
  return {
    layout,
    tables: input.tables,
    seatPositions: input.seatPositions,
    foodSpots: input.foodSpots ?? [],
    maxNpcs: input.maxNpcs,
  }
}

export function applySpaceEvent(input: ApplySpaceEventInput): ApplySpaceEventResult {
  switch (input.eventId) {
    case 'A1':
      return applyA1(input)
    case 'A2':
      return applyA2(input)
    case 'A3':
      return applyA3(input)
    case 'A4':
      return applyA4(input)
    case 'A5':
      return applyA5(input)
    case 'C1':
      return applyC1(input)
    case 'C2':
      return applyC2(input)
    case 'C3':
      return applyC3(input)
    case 'C4':
      return applyC4(input)
    case 'C5':
      return applyC5(input)
    case 'C6':
      return applyC6(input)
    default:
      return {
        layout: input.layout,
        tables: input.tables,
        seatPositions: input.seatPositions,
        foodSpots: input.foodSpots ?? [],
        maxNpcs: input.maxNpcs,
      }
  }
}

/** Assign roomId from seat world position. */
export function roomIdForSeatIndex(
  layout: SpaceLayoutState,
  seatPositions: [number, number, number][],
  seatIndex: number,
): string {
  const seat = seatPositions[seatIndex]
  if (!seat) return layout.rooms[0]?.id ?? 'r0'
  const floor = floorFromPlayerY(seat[1])
  return roomIdAt(layout, seat[0], seat[2], floor)
}
