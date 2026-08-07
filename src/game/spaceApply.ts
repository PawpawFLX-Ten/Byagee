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
import type { FoodSpot, RoomSide, SpaceEventId, SpaceStairs, TableDef } from './types'

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
  /** Old seat index �?new index after compaction; absent = removed. */
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
  seatRadius = 1.35,
): { tables: TableDef[]; seatPositions: [number, number, number][]; foodSpots: FoodSpot[] } {
  const count = Math.max(2, Math.min(4, seatCount))
  const seats = seatsAroundTable(table.position, count + Math.floor(rng() * 0.001), seatRadius)
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

/** Fallback when no side is free: nudge an obstacle or shrink r0 slightly. */
function microAdjust(input: ApplySpaceEventInput): ApplySpaceEventResult {
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

function applyA1(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 6, 8, input.rng)
  if (!attach) return microAdjust(input)

  const tables: TableDef[] = [
    {
      id: `t-${attach.roomId}a`,
      shape: 'round',
      position: [attach.center[0], 0, attach.center[1]],
      half: { x: 0.85, z: 0.85 },
      topY: 0.75,
    },
    {
      id: `t-${attach.roomId}b`,
      shape: 'rect',
      position: [attach.center[0] + 2.3, 0, attach.center[1] + 2.4],
      half: { x: 1.0, z: 0.6 },
      topY: 0.75,
    },
  ]
  let seatPositions = [...input.seatPositions]
  let foodSpots = [...(input.foodSpots ?? [])]
  let allTables = [...input.tables]
  for (const [table, count] of [
    [tables[0], 4],
    [tables[1], 2],
  ] as const) {
    const bundled = appendTableBundle(allTables, seatPositions, foodSpots, table, count, input.rng)
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

function applyA2(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const gap = CONFIG.space.roomGap
  const pick = pickConnection(input.layout, 2.5, 2, input.rng, gap)
  if (!pick) return microAdjust(input)

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

  const endAabb = sideAabb(corridorAabb, pick.side, 6, 10, gap)
  const sideFree = availableSides(newLayout, corridorId, 6, 10, gap).includes(pick.side)
  if (!sideFree) return microAdjust(input)

  const roomId = nextRoomId(newLayout)
  newLayout = addRoomConnectedAt(
    newLayout,
    { id: roomId, min: endAabb.min, max: endAabb.max, floor: 0 },
    `door-${roomId}`,
    corridorId,
    pick.side,
  )

  const center = roomCenter(endAabb)
  const tables: TableDef[] = [
    {
      id: `t-${roomId}a`,
      shape: 'round',
      position: [center[0] - 1.5, 0, center[1]],
      half: { x: 0.85, z: 0.85 },
      topY: 0.75,
    },
    {
      id: `t-${roomId}b`,
      shape: 'round',
      position: [center[0] + 2, 0, center[1] + 2.8],
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

function applyA3(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 10, 12, input.rng)
  if (!attach) return microAdjust(input)

  const tables: TableDef[] = [
    {
      id: `t-${attach.roomId}a`,
      shape: 'oval',
      position: [attach.center[0] - 2.5, 0, attach.center[1] - 3],
      half: { x: 1.4, z: 0.6 },
      topY: 0.75,
    },
    {
      id: `t-${attach.roomId}b`,
      shape: 'rect',
      position: [attach.center[0] + 2.5, 0, attach.center[1]],
      half: { x: 1.2, z: 0.8 },
      topY: 0.75,
    },
    {
      id: `t-${attach.roomId}c`,
      shape: 'round',
      position: [attach.center[0], 0, attach.center[1] + 3.5],
      half: { x: 0.85, z: 0.85 },
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
  const stairs: SpaceStairs = {
    id: `stairs-${roomId}`,
    // Foot in the north corridor (inside r0), climbing south toward the
    // upper room center; clear of t-round/t-rect/t-oval XZ.
    position: [0.5, 0, -3.2],
    fromRoom: 'r0',
    toRoom: roomId,
    axis: 'z',
    length: 2.4,
    width: CONFIG.space.stairWidth,
  }
  const newLayout: SpaceLayoutState = {
    ...layout,
    rooms: [...layout.rooms, upper],
    openings: [
      ...layout.openings,
      {
        id: `door-${roomId}`,
        fromRoom: 'r0',
        toRoom: roomId,
        position: [...stairs.position] as [number, number, number],
        latchedUntil: 0,
        lastLatchedAt: 0,
      },
    ],
    stairs: [...layout.stairs, stairs],
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
  const attach = attachRoom(input.layout, 5, 4, input.rng)
  if (!attach) return microAdjust(input)

  const table: TableDef = {
    id: `t-${attach.roomId}`,
    shape: 'round',
    position: [attach.center[0], 0, attach.center[1]],
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
    layout: attach.layout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyC2(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 4, 4, input.rng)
  if (!attach) return microAdjust(input)

  const table: TableDef = {
    id: `t-${attach.roomId}`,
    shape: 'round',
    position: [attach.center[0], 0, attach.center[1]],
    half: { x: 0.6, z: 0.6 },
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
    layout: attach.layout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyC3(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 6, 5, input.rng)
  if (!attach) return microAdjust(input)

  const newLayout = {
    ...attach.layout,
    obstacles: [
      ...attach.layout.obstacles,
      {
        id: `obs-pillar-${attach.roomId}-a`,
        min: [attach.center[0] - 1.8, attach.center[1] + 1.2] as [number, number],
        max: [attach.center[0] - 0.8, attach.center[1] + 2.2] as [number, number],
      },
      {
        id: `obs-pillar-${attach.roomId}-b`,
        min: [attach.center[0] + 0.8, attach.center[1] + 1.2] as [number, number],
        max: [attach.center[0] + 1.8, attach.center[1] + 2.2] as [number, number],
      },
    ],
  }

  const table: TableDef = {
    id: `t-${attach.roomId}`,
    shape: 'round',
    position: [attach.center[0], 0, attach.center[1] - 0.8],
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

function applyC4(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const layout = cloneLayout(input.layout)
  const roomId = nextRoomId(layout)
  const platform = {
    id: roomId,
    min: [-2.5, 2.9] as [number, number],
    max: [2.5, 4.9] as [number, number],
    floor: 1,
  }
  // Foot at the platform's west wall line, climbing east to the platform
  // interior; clear of the r0 oval table (z ≤ 2.65) and the loft table.
  const stairs: SpaceStairs = {
    id: `stairs-${roomId}`,
    position: [-2.5, 0, 4.3],
    fromRoom: 'r0',
    toRoom: roomId,
    axis: 'x',
    length: 2.4,
    width: 0.8,
  }
  layout.rooms = [...layout.rooms, platform]
  layout.stairs = [...layout.stairs, stairs]
  layout.openings = [
    ...layout.openings,
    {
      id: `door-${roomId}`,
      fromRoom: 'r0',
      toRoom: roomId,
      position: [...stairs.position] as [number, number, number],
      latchedUntil: 0,
      lastLatchedAt: 0,
    },
  ]

  const upperY = floorY(1)
  const table: TableDef = {
    id: `t-${roomId}`,
    shape: 'rect',
    // East of the stair run (x ≥ 0), south seats clear the oval below.
    position: [0.6, upperY, 3.9],
    half: { x: 0.6, z: 0.3 },
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
    0.85,
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
  const attach = attachRoom(input.layout, 3.5, 3.5, input.rng)
  if (!attach) return microAdjust(input)

  const table: TableDef = {
    id: `t-${attach.roomId}`,
    shape: 'round',
    position: [attach.center[0], 0, attach.center[1]],
    half: { x: 0.6, z: 0.6 },
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
    layout: attach.layout,
    tables: bundled.tables,
    seatPositions: bundled.seatPositions,
    foodSpots: bundled.foodSpots,
    maxNpcs: bundled.seatPositions.length,
    doorMaxNpcs: bundled.seatPositions.length,
  }
}

function applyA5(input: ApplySpaceEventInput): ApplySpaceEventResult {
  const attach = attachRoom(input.layout, 5, 7, input.rng)
  if (!attach) return microAdjust(input)

  // Bar counter along the back wall — blocks pathing, not sound.
  const newLayout = {
    ...attach.layout,
    obstacles: [
      ...attach.layout.obstacles,
      {
        id: `obs-bar-${attach.roomId}`,
        min: [attach.center[0] - 0.95, attach.center[1] - 3.2] as [number, number],
        max: [attach.center[0] + 1.05, attach.center[1] - 2.3] as [number, number],
      },
    ],
  }

  const tables: TableDef[] = [
    {
      id: `t-${attach.roomId}a`,
      shape: 'round',
      position: [attach.center[0], 0, attach.center[1] - 1],
      half: { x: 0.8, z: 0.8 },
      topY: 0.75,
    },
    {
      id: `t-${attach.roomId}b`,
      shape: 'round',
      position: [attach.center[0], 0, attach.center[1] + 1.5],
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
  const attach = attachRoom(input.layout, 6, 5, input.rng)
  if (!attach) return microAdjust(input)

  const screenAt = (dx: number, dz: number) => ({
    id: `obs-screen-${attach.roomId}-${dx >= 0 ? 'p' : 'n'}${dz >= 0 ? 'p' : 'n'}`,
    min: [attach.center[0] + dx - 0.6, attach.center[1] + dz - 0.6] as [number, number],
    max: [attach.center[0] + dx + 0.6, attach.center[1] + dz + 0.6] as [number, number],
  })
  const screens = [screenAt(-2.4, 0), screenAt(0, 1.8), screenAt(2.2, -1.6)]

  const newLayout = {
    ...attach.layout,
    obstacles: [...attach.layout.obstacles, ...screens],
  }

  const table: TableDef = {
    id: `t-${attach.roomId}`,
    shape: 'round',
    position: [attach.center[0], 0, attach.center[1] - 0.6],
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
