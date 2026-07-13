import { CONFIG } from './config'
import type { NpcState } from './types'

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
  const all = CONFIG.seatPositions.map((_, i) => i)
  return all.filter((i) => !occupied.has(i))
}

export function pickExitCandidate(npcs: NpcState[]): NpcState | null {
  const normals = npcs.filter((n) => n.role !== 'boss' && !n.exiting)
  const rank = (n: NpcState) => {
    if (n.status === 'sealed' || n.status === 'silenced') return 0
    if (n.status === 'idle') return 1
    if (n.status === 'walking') return 2
    return 3
  }
  return [...normals].sort((a, b) => rank(a) - rank(b))[0] ?? null
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

  const atCap = npcs.length >= CONFIG.door.maxNpcs
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

  const exit = pickExitCandidate(npcs)
  if (exit && npcs.length > 1) return { type: 'exit', npcId: exit.id }
  return null
}

export function planBossAdmission(npcs: NpcState[]): DoorAction | null {
  if (npcs.some((n) => n.role === 'boss')) return null
  if (npcs.length < CONFIG.door.maxNpcs) return null
  const victim = pickExitCandidate(npcs)
  return victim ? { type: 'evict', npcId: victim.id } : null
}

export function createNormalFromDoor(seatIndex: number, now: number, id: string): NpcState {
  const seat = CONFIG.seatPositions[seatIndex]
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
    foodId: CONFIG.foodSpots[seatIndex % CONFIG.foodSpots.length]?.id ?? null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'normal',
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
  }
}

export function applyDoorAction(
  npcs: NpcState[],
  action: DoorAction,
  now: number,
  nextId: () => string,
): NpcState[] {
  if (action.type === 'enter') {
    return [...npcs, createNormalFromDoor(action.seatIndex, now, nextId())]
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
