import {
  knockbackFrom,
  moveWithCollision,
  type LayoutBounds,
  type ObstacleCollider,
  type XZ,
} from './collision'
import { CONFIG } from './config'
import { CHASER_ARCHETYPE, CHASER_BUILD } from './archetype'
import { getRuntimeSpace } from './runtimeSpace'
import { latchedOnPath, roomIdAt, type SpaceLayoutState } from './spaceLayout'
import { distance3, distanceAttenuation } from './threat'
import type { DifficultyPhase, NpcState, RoomId, TableDef } from './types'

export type ChaserStepOpts = {
  playerHidden?: boolean
  hideEscalated?: boolean
  playerRoomId?: RoomId
  bounds?: LayoutBounds
}

export type ChaserSpawnCtx = {
  phase: DifficultyPhase
  roomCount: number
  neighborShare: number
  chaserCount: number
  bossPresent: boolean
  bossSpawnThisBeat?: boolean
  totalNpcCount?: number
  maxNpcs?: number
  /** Threat stayed >= threshold for sustainedThreatSec — early single-room access. */
  sustainedThreat?: boolean
}

export type ThreatPart = {
  roomId: RoomId
  contribution: number
}

export function chaserCap(phase: DifficultyPhase): number {
  return phase === 'late' ? CONFIG.chaser.maxCountLate : 1
}

export function shouldSpawnChaser(ctx: ChaserSpawnCtx): boolean {
  if (ctx.bossPresent) return false
  if (ctx.bossSpawnThisBeat) return false

  const cap = chaserCap(ctx.phase)
  if (ctx.chaserCount >= cap) return false

  // Chasers don't use seats — only seated/traveling diners count toward the
  // population cap. Otherwise a full late-game hall would never see a chaser.
  if (
    ctx.totalNpcCount !== undefined &&
    ctx.maxNpcs !== undefined &&
    ctx.totalNpcCount - ctx.chaserCount >= ctx.maxNpcs
  ) {
    return false
  }

  const lateSpawn = ctx.phase === 'late'
  const cheeseSpawn =
    ctx.roomCount >= 2 &&
    ctx.neighborShare >= CONFIG.chaser.neighborThreatShareToSpawn
  const sustainedSpawn = ctx.sustainedThreat === true

  return lateSpawn || cheeseSpawn || sustainedSpawn
}

export function neighborThreatShare(
  playerRoomId: RoomId,
  parts: ThreatPart[],
): number {
  const total = parts.reduce((s, p) => s + p.contribution, 0)
  if (total <= 0) return 0
  const neighbor = parts
    .filter((p) => p.roomId !== playerRoomId)
    .reduce((s, p) => s + p.contribution, 0)
  return neighbor / total
}

export function createChaser(
  id: string,
  doorPos: [number, number, number],
  roomId: RoomId,
  now: number,
): NpcState {
  return {
    id,
    status: 'walking',
    statusUntil: now + 60_000,
    seatIndex: -1,
    position: [...doorPos] as [number, number, number],
    facing: 0,
    baseLoudness: CONFIG.chaser.baseLoudness,
    sealProp: null,
    foodId: null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'chaser',
    archetype: CHASER_ARCHETYPE,
    build: CHASER_BUILD,
    roomId,
    staggerUntil: 0,
    chaseTarget: true,
    scale: 1.12,
    mouthHp: 0,
    mouthHpMax: 0,
    bossModules: { a: false, b: false, c: false },
    comboHits: 0,
    lastHitAt: 0,
    raging: false,
    exiting: false,
    idleSince: now,
    smackingSince: 0,
    noiseReduction: 0,
    pulseChargeUntil: 0,
    pulseCooldownUntil: 0,
    pulseFiredAt: 0,
  }
}

export function inFaceRadius(
  npc: NpcState,
  playerPos: [number, number, number],
): boolean {
  const dx = npc.position[0] - playerPos[0]
  const dz = npc.position[2] - playerPos[2]
  return Math.hypot(dx, dz) <= CONFIG.chaser.faceRadius
}

function nearestTable(
  pos: [number, number, number],
  tables: TableDef[],
): TableDef {
  let best = tables[0]
  let bestD = Infinity
  for (const t of tables) {
    const d = Math.hypot(pos[0] - t.position[0], pos[2] - t.position[2])
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return best
}

function wanderFurniture(
  npc: NpcState,
  tables: TableDef[],
  obstacles: ObstacleCollider[],
  dt: number,
  bounds?: LayoutBounds,
  layout?: SpaceLayoutState,
): NpcState {
  const table = nearestTable(npc.position, tables)
  const cx = table.position[0]
  const cz = table.position[2]
  const orbitR = Math.max(table.half.x, table.half.z) + 0.75
  const angle = Math.atan2(npc.position[2] - cz, npc.position[0] - cx) + dt * 1.1
  const tx = cx + Math.cos(angle) * orbitR
  const tz = cz + Math.sin(angle) * orbitR
  const dx = tx - npc.position[0]
  const dz = tz - npc.position[2]
  const dist = Math.hypot(dx, dz)
  if (dist < 0.05) return npc
  const step = CONFIG.chaser.walkSpeed * dt * 0.65
  const mx = (dx / dist) * Math.min(step, dist)
  const mz = (dz / dist) * Math.min(step, dist)
  const [x, z] = moveWithCollision(
    npc.position[0],
    npc.position[2],
    mx,
    mz,
    tables,
    [],
    undefined,
    obstacles,
    bounds,
  )
  return {
    ...npc,
    position: [x, 0, z] as [number, number, number],
    facing: Math.atan2(mx, mz),
    status: 'walking',
    smackingSince: 0,
    roomId: layout ? roomIdAt(layout, x, z, 0) : npc.roomId,
  }
}

/** Chasers and in-transit walkers can be shoved; seated diners cannot. */
export function isKnockbackTarget(npc: NpcState): boolean {
  return npc.role === 'chaser' || npc.status === 'walking'
}

export function applyChaserKnockback(
  npc: NpcState,
  fromPos: [number, number, number],
  now: number,
  options?: {
    dist?: number
    staggerSec?: number
    others?: XZ[]
    obstacles?: ObstacleCollider[]
    bounds?: LayoutBounds
  },
): NpcState {
  const dist = options?.dist ?? CONFIG.chaser.knockbackDist
  const staggerSec = options?.staggerSec ?? CONFIG.chaser.staggerSec
  const others = options?.others ?? []
  const obstacles = options?.obstacles ?? []

  const [x, z] = knockbackFrom(
    fromPos,
    npc.position,
    dist,
    getRuntimeSpace().tables,
    others,
    obstacles,
    options?.bounds,
  )

  const moved = Math.hypot(x - npc.position[0], z - npc.position[2])
  const hitObstacle = moved < dist * 0.45
  const effectiveStagger = staggerSec + (hitObstacle ? 0.35 : 0)
  const keepSilence = npc.status === 'silenced' || npc.status === 'sealed'

  return {
    ...npc,
    position: [x, 0, z] as [number, number, number],
    staggerUntil: now + effectiveStagger * 1000,
    status: keepSilence ? npc.status : 'walking',
    statusUntil: keepSilence ? npc.statusUntil : now + 60_000,
    smackingSince: 0,
    wobbleUntil: now + 500,
    facing: Math.atan2(npc.position[0] - fromPos[0], npc.position[2] - fromPos[2]),
  }
}

/** Build per-room threat parts from smacking NPCs (ungated, for spawn cheese detection). */
export function threatPartsFromNpcs(
  npcs: NpcState[],
  playerPos: [number, number, number],
): ThreatPart[] {
  const parts: ThreatPart[] = []
  for (const npc of npcs) {
    if (npc.status !== 'smacking') continue
    const d = distance3(npc.position, playerPos)
    const effectiveLoudness = Math.max(0.05, npc.baseLoudness - npc.noiseReduction)
    parts.push({
      roomId: npc.roomId,
      contribution: effectiveLoudness * distanceAttenuation(d),
    })
  }
  return parts
}

export function stepChaser(
  npc: NpcState,
  playerPos: [number, number, number],
  layout: SpaceLayoutState,
  obstacles: ObstacleCollider[],
  dt: number,
  now: number,
  opts: ChaserStepOpts = {},
): NpcState {
  if (npc.role !== 'chaser') return npc

  let next: NpcState = { ...npc }

  if (
    (next.status === 'silenced' || next.status === 'sealed') &&
    now >= next.statusUntil
  ) {
    next = {
      ...next,
      status: 'walking',
      statusUntil: now + 60_000,
      sealProp: null,
      smackingSince: 0,
    }
  }

  if (next.status === 'silenced' || next.status === 'sealed') {
    return next
  }

  const { tables } = getRuntimeSpace()
  const playerRoomId =
    opts.playerRoomId ??
    roomIdAt(layout, playerPos[0], playerPos[2], 0)
  const pathBlocked =
    next.roomId !== playerRoomId &&
    latchedOnPath(layout, next.roomId, playerRoomId, now)

  if (pathBlocked) {
    return wanderFurniture(next, tables, obstacles, dt, opts.bounds, layout)
  }

  const playerHidden = opts.playerHidden ?? false
  const hideEscalated = opts.hideEscalated ?? false
  if (playerHidden && !hideEscalated) {
    return wanderFurniture(next, tables, obstacles, dt, opts.bounds, layout)
  }

  const face = inFaceRadius(next, playerPos)
  const staggered = now <= next.staggerUntil

  if (face && !staggered) {
    const facing = Math.atan2(
      playerPos[0] - next.position[0],
      playerPos[2] - next.position[2],
    )
    return {
      ...next,
      status: 'smacking',
      smackingSince: next.smackingSince > 0 ? next.smackingSince : now,
      facing,
      baseLoudness: CONFIG.chaser.baseLoudness,
    }
  }

  if (next.status === 'smacking' && !face) {
    next = { ...next, status: 'walking', smackingSince: 0 }
  }

  const tx = playerPos[0] - next.position[0]
  const tz = playerPos[2] - next.position[2]
  const dist = Math.hypot(tx, tz)
  const facing = Math.atan2(tx, tz)

  if (dist < 0.15) {
    return { ...next, facing }
  }

  // Anti-kiting: speed scales up with distance so pure running-in-circles
  // does not trivialize the chaser; close range stays dodgeable.
  const speedScale =
    1 + 0.5 * Math.min(1, Math.max(0, (dist - 2.5) / 6))
  const step = CONFIG.chaser.walkSpeed * speedScale * dt
  const dirX = tx / dist
  const dirZ = tz / dist
  const mx = dirX * Math.min(step, dist)
  const mz = dirZ * Math.min(step, dist)

  const [x, z] = moveWithCollision(
    next.position[0],
    next.position[2],
    mx,
    mz,
    tables,
    [],
    undefined,
    obstacles,
    opts.bounds,
  )

  return {
    ...next,
    position: [x, 0, z] as [number, number, number],
    facing,
    roomId: roomIdAt(layout, x, z, 0),
  }
}
