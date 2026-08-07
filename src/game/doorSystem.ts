import { CONFIG } from './config'
import { pickArchetype, pickBuild } from './archetype'
import { getRuntimeSpace } from './runtimeSpace'
import type { NpcState } from './types'
import type { SpaceLayoutState } from './spaceLayout'
import { roomIdForSeatIndex } from './spaceApply'

export function activeDoorPlugins(elapsedSec: number) {
  const p = CONFIG.door.plugins
  return {
    timed: elapsedSec >= p.timedUnlockSec,
    threat: elapsedSec >= p.threatUnlockSec,
    seat: elapsedSec >= p.seatUnlockSec,
  }
}

export type DoorAction =
  | { type: 'enter'; seatIndex: number }
  | { type: 'exit'; npcId: string }
  | { type: 'evict'; npcId: string }

export function freeSeatIndexes(occupied: Set<number>): number[] {
  const seats = getRuntimeSpace().seatPositions
  const all = seats.map((_, i) => i)
  return all.filter((i) => !occupied.has(i))
}

export function pickExitCandidate(npcs: NpcState[], now: number = 0): NpcState | null {
  const normals = npcs.filter((n) => n.role !== 'boss' && n.role !== 'chaser' && !n.exiting)
  const rank = (n: NpcState) => {
    // Force-exit NPCs that have been in the room beyond idleExitSec
    if (now > 0 && now - n.idleSince > CONFIG.door.idleExitSec * 1000) return -1
    if (n.status === 'sealed' || n.status === 'silenced') return 0
    if (n.status === 'idle') return 1
    if (n.status === 'walking') return 2
    return 3
  }
  return [...normals].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff
    // Same rank: oldest entry first (FIFO cycling — ensures no NPC stays forever)
    return a.idleSince - b.idleSince
  })[0] ?? null
}

export function planDoorAction(args: {
  npcs: NpcState[]
  elapsedSec: number
  now: number
  threat: number
  lastDoorEventAt: number
  occupiedSeatIndexes: Set<number>
}): DoorAction | null {
  const { npcs, elapsedSec, now, threat, lastDoorEventAt, occupiedSeatIndexes } = args
  const plugins = activeDoorPlugins(elapsedSec)
  if (!plugins.timed) return null
  if (now - lastDoorEventAt < CONFIG.door.timedIntervalSec * 1000) return null

  const atCap = npcs.length >= getRuntimeSpace().maxNpcs
  const free = freeSeatIndexes(occupiedSeatIndexes)

  let preferEnter = npcs.length < CONFIG.door.startNpcCount + 2
  if (plugins.threat) {
    if (threat >= CONFIG.door.threatEnterBiasAbove) preferEnter = true
    if (threat <= CONFIG.door.threatExitBiasBelow) preferEnter = false
  }

  if (preferEnter && !atCap) {
    if (plugins.seat && free.length === 0) {
      // cannot enter
    } else if (free.length > 0) {
      return { type: 'enter', seatIndex: free[0] }
    } else if (!plugins.seat) {
      if (free.length > 0) return { type: 'enter', seatIndex: free[0] }
    }
  }

  const exit = pickExitCandidate(npcs, now)
  if (exit && npcs.length > 1) return { type: 'exit', npcId: exit.id }
  return null
}

export function planBossAdmission(npcs: NpcState[], now: number = 0): DoorAction | null {
  if (npcs.some((n) => n.role === 'boss')) return null
  if (npcs.length < getRuntimeSpace().maxNpcs) return null
  const victim = pickExitCandidate(npcs, now)
  return victim ? { type: 'evict', npcId: victim.id } : null
}

export function createNormalFromDoor(
  seatIndex: number,
  now: number,
  id: string,
  roomId = 'r0',
): NpcState {
  const runtime = getRuntimeSpace()
  const seat = runtime.seatPositions[seatIndex]
  const door = CONFIG.door.position
  return {
    id,
    status: 'walking',
    statusUntil: now + 9000,
    seatIndex,
    position: [...door] as [number, number, number],
    facing: Math.atan2(seat[0] - door[0], seat[2] - door[2]),
    baseLoudness: 0.4 + (seatIndex % 5) * 0.05,
    sealProp: null,
    foodId: runtime.foodSpots[seatIndex % runtime.foodSpots.length]?.id ?? null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'normal',
    archetype: pickArchetype(),
    build: pickBuild(),
    roomId,
    staggerUntil: 0,
    chaseTarget: false,
    scale: 1,
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

export function applyDoorAction(
  npcs: NpcState[],
  action: DoorAction,
  now: number,
  nextId: () => string,
  layout?: SpaceLayoutState,
): NpcState[] {
  if (action.type === 'enter') {
    const seats = getRuntimeSpace().seatPositions
    const roomId =
      layout !== undefined
        ? roomIdForSeatIndex(layout, seats, action.seatIndex)
        : 'r0'
    return [...npcs, createNormalFromDoor(action.seatIndex, now, nextId(), roomId)]
  }
  if (action.type === 'exit' || action.type === 'evict') {
    return npcs.map((n) =>
      n.id === action.npcId
        ? { ...n, exiting: true, status: 'walking' as const, foodId: null, statusUntil: now + 6000 }
        : n,
    )
  }
  return npcs
}
