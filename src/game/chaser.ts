import {
  moveWithCollision,
  type ObstacleCollider,
} from './collision'
import { CONFIG } from './config'
import { getRuntimeSpace } from './runtimeSpace'
import { roomIdAt, type SpaceLayoutState } from './spaceLayout'
import { distance3, distanceAttenuation } from './threat'
import type { DifficultyPhase, NpcState, RoomId } from './types'

export type ChaserSpawnCtx = {
  phase: DifficultyPhase
  roomCount: number
  neighborShare: number
  chaserCount: number
  bossPresent: boolean
  bossSpawnThisBeat?: boolean
  totalNpcCount?: number
  maxNpcs?: number
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

  if (
    ctx.totalNpcCount !== undefined &&
    ctx.maxNpcs !== undefined &&
    ctx.totalNpcCount >= ctx.maxNpcs
  ) {
    return false
  }

  const lateSpawn = ctx.phase === 'late'
  const cheeseSpawn =
    ctx.roomCount >= 2 &&
    ctx.neighborShare >= CONFIG.chaser.neighborThreatShareToSpawn

  return lateSpawn || cheeseSpawn
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

  const { tables } = getRuntimeSpace()
  const tx = playerPos[0] - next.position[0]
  const tz = playerPos[2] - next.position[2]
  const dist = Math.hypot(tx, tz)
  const facing = Math.atan2(tx, tz)

  if (dist < 0.15) {
    return { ...next, facing }
  }

  const step = CONFIG.chaser.walkSpeed * dt
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
  )

  return {
    ...next,
    position: [x, 0, z] as [number, number, number],
    facing,
    roomId: roomIdAt(layout, x, z, 0),
  }
}
