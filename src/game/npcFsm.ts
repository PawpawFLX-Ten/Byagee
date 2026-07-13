import {
  knockbackFrom,
  moveWithCollision,
  separateFromOthers,
  type TableCollider,
  type XZ,
} from './collision'
import { CONFIG } from './config'
import { getPhase } from './difficulty'
import type { DifficultyPhase, FoodSpot, NpcState, SealProp } from './types'

const STUCK_TICKS_BEFORE_REROUTE = 40

function facingToward(
  from: [number, number, number],
  to: [number, number, number],
): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2])
}

function othersXZ(npcs: NpcState[], selfId: string): XZ[] {
  return npcs
    .filter((n) => n.id !== selfId)
    .map((n) => ({ x: n.position[0], z: n.position[2] }))
}

/** Nudge approach sideways so agents don't share the exact same slot. */
function approachFor(food: FoodSpot, seatIndex: number): [number, number, number] {
  const spread = ((seatIndex % 3) - 1) * 0.55
  // Offset along the table edge tangent (perpendicular to radial direction)
  const ax = food.approach[0]
  const az = food.approach[2]
  const len = Math.hypot(ax, az) || 1
  const tx = -az / len
  const tz = ax / len
  return [ax + tx * spread, 0, az + tz * spread]
}

export function createNpcs(now: number): NpcState[] {
  return CONFIG.seatPositions.slice(0, CONFIG.npcCount).map((pos, i) => {
    const food = CONFIG.foodSpots[i % CONFIG.foodSpots.length]
    const approach = approachFor(food, i)
    return {
      id: `npc-${i}`,
      status: i === 0 ? 'walking' : 'idle',
      statusUntil: i === 0 ? now + 8000 : now + 1500 + i * 1200,
      seatIndex: i,
      position: pos,
      facing: facingToward(pos, approach),
      baseLoudness: 0.4 + i * 0.05,
      sealProp: null,
      foodId: i === 0 ? food.id : null,
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
  })
}

export function tickNpcs(
  npcs: NpcState[],
  now: number,
  elapsedSec: number,
  dt: number,
  playerPos?: [number, number, number],
): { npcs: NpcState[]; despawnIds: string[] } {
  const phase = getPhase(elapsedSec)
  const maxSmack = CONFIG.maxOverlappingSmackers[phase]
  let smacking = npcs.filter((n) => n.status === 'smacking').length
  const despawnIds: string[] = []

  // Claim food targets sequentially so later NPCs see earlier claims
  const claimed = new Set(
    npcs.filter((n) => n.foodId && n.status === 'walking').map((n) => n.foodId),
  )

  let nextList = npcs.map((npc) => {
    let next = { ...npc }
    const blockers = [
      ...othersXZ(npcs, npc.id),
      ...(playerPos ? [{ x: playerPos[0], z: playerPos[2] }] : []),
    ]

    if (next.exiting) {
      const door = CONFIG.door.position
      const tx = door[0] - next.position[0]
      const tz = door[2] - next.position[2]
      const dist = Math.hypot(tx, tz)
      next.facing = Math.atan2(tx, tz)
      if (dist < 0.45 || now >= next.statusUntil) {
        despawnIds.push(next.id)
        return next
      }
      const step = CONFIG.npcWalkSpeed * dt
      const mx = (tx / dist) * Math.min(step, dist)
      const mz = (tz / dist) * Math.min(step, dist)
      const [x, z] = moveWithCollision(next.position[0], next.position[2], mx, mz, CONFIG.tables, blockers)
      return { ...next, position: [x, 0, z] as [number, number, number] }
    }

    if (next.status === 'walking' && next.foodId) {
      // Give up if walk timed out
      if (now >= next.statusUntil) {
        return {
          ...next,
          status: 'idle' as const,
          statusUntil: now + 500,
          foodId: null,
          stuckTicks: 0,
        }
      }

      const food = CONFIG.foodSpots.find((f) => f.id === next.foodId)
      if (!food) {
        return {
          ...next,
          status: 'idle' as const,
          statusUntil: now + 400,
          foodId: null,
          stuckTicks: 0,
        }
      }

      const target = approachFor(food, next.seatIndex)
      const tx = target[0] - next.position[0]
      const tz = target[2] - next.position[2]
      const dist = Math.hypot(tx, tz)
      next.facing = Math.atan2(tx, tz)

      if (dist < 0.28) {
        if (smacking < maxSmack) {
          smacking += 1
          const [x, z] = separateFromOthers(target[0], target[2], blockers, CONFIG.tables)
          return {
            ...next,
            status: 'smacking' as const,
            statusUntil: now + smackBurst(phase),
            position: [x, 0, z] as [number, number, number],
            facing: facingToward([x, 0, z], food.plate),
            stuckTicks: 0,
            smackingSince: now,
          }
        }
        return {
          ...next,
          status: 'idle' as const,
          statusUntil: now + 500,
          foodId: null,
          stuckTicks: 0,
        }
      }

      const step = CONFIG.npcWalkSpeed * dt
      let mx = (tx / dist) * Math.min(step, dist)
      let mz = (tz / dist) * Math.min(step, dist)

      // If blocked, slide along table perimeter instead of pushing into the jam
      if (next.stuckTicks > 12) {
        const slide = step * 1.1
        const around = perimeterSlide(next.position[0], next.position[2], slide, next.seatIndex)
        mx = around[0] - next.position[0]
        mz = around[1] - next.position[2]
      }

      const [x, z] = moveWithCollision(
        next.position[0],
        next.position[2],
        mx,
        mz,
        CONFIG.tables,
        blockers,
      )
      const moved = Math.hypot(x - next.position[0], z - next.position[2])
      const stuckTicks =
        moved < step * 0.2 && dist > 0.35 ? next.stuckTicks + 1 : 0

      // Re-route to a free, less crowded food when jammed
      if (stuckTicks >= STUCK_TICKS_BEFORE_REROUTE) {
        claimed.delete(next.foodId)
        const alt = pickFood(npcs, next.id, claimed, next.foodId)
        claimed.add(alt.id)
        const altApproach = approachFor(alt, next.seatIndex)
        return {
          ...next,
          foodId: alt.id,
          stuckTicks: 0,
          statusUntil: now + 8000,
          facing: facingToward(next.position, altApproach),
          position: [x, 0, z] as [number, number, number],
        }
      }

      return {
        ...next,
        position: [x, 0, z] as [number, number, number],
        stuckTicks,
      }
    }

    if (now < next.statusUntil) return next

    if (next.status === 'silenced' || next.status === 'sealed') {
      return {
        ...next,
        status: 'idle' as const,
        statusUntil: now + idleGap(phase),
        sealProp: null,
        foodId: null,
        stuckTicks: 0,
      }
    }

    if (next.status === 'smacking') {
      return {
        ...next,
        status: 'idle' as const,
        statusUntil: now + idleGap(phase),
        foodId: null,
        stuckTicks: 0,
        smackingSince: 0,
      }
    }

    if (next.status === 'idle') {
      if (smacking >= maxSmack) {
        return { ...next, statusUntil: now + 700 }
      }
      const food = pickFood(npcs, next.id, claimed)
      claimed.add(food.id)
      return {
        ...next,
        status: 'walking' as const,
        statusUntil: now + 9000,
        foodId: food.id,
        facing: facingToward(next.position, approachFor(food, next.seatIndex)),
        stuckTicks: 0,
      }
    }

    return next
  })

  // Stronger mutual separation after moves
  nextList = nextList.map((npc, i) => {
    const blockers: XZ[] = nextList
      .filter((_, j) => j !== i)
      .map((n) => ({ x: n.position[0], z: n.position[2] }))
    if (playerPos) blockers.push({ x: playerPos[0], z: playerPos[2] })
    const [x, z] = separateFromOthers(npc.position[0], npc.position[2], blockers, CONFIG.tables)
    if (x === npc.position[0] && z === npc.position[2]) return npc
    return { ...npc, position: [x, 0, z] as [number, number, number] }
  })

  return { npcs: nextList, despawnIds }
}

/** Walk along the outside of the table AABB when path is jammed. */
function perimeterSlide(
  x: number,
  z: number,
  step: number,
  seatIndex: number,
): [number, number] {
  const table = nearestTable(x, z)
  const dir = seatIndex % 2 === 0 ? 1 : -1
  const cx = table.position[0]
  const cz = table.position[2]
  const lx = x - cx
  const lz = z - cz
  const hx = table.half.x + 0.55
  const hz = table.half.z + 0.55
  if (Math.abs(lx) / hx > Math.abs(lz) / hz) {
    return [cx + Math.sign(lx || 1) * hx, z + dir * step]
  }
  return [x + dir * step, cz + Math.sign(lz || 1) * hz]
}

function nearestTable(x: number, z: number): TableCollider {
  let best = CONFIG.tables[0]
  let bestD = Infinity
  for (const t of CONFIG.tables) {
    const d = Math.hypot(x - t.position[0], z - t.position[2])
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return best
}

function pickFood(
  npcs: NpcState[],
  selfId: string,
  claimed: Set<string | null>,
  excludeId?: string | null,
) {
  const self = npcs.find((n) => n.id === selfId)
  const taken = new Set(
    [...claimed].filter(Boolean) as string[],
  )
  for (const n of npcs) {
    if (n.id !== selfId && n.foodId) taken.add(n.foodId)
  }
  if (excludeId) taken.add(excludeId)

  const free = CONFIG.foodSpots.filter((f) => !taken.has(f.id))
  const pool = free.length ? free : CONFIG.foodSpots.filter((f) => f.id !== excludeId)
  const choices = pool.length ? pool : CONFIG.foodSpots

  // Prefer nearest uncrowded approach
  const scored = choices.map((f) => {
    const ap = approachFor(f, self?.seatIndex ?? 0)
    const dist = self
      ? Math.hypot(ap[0] - self.position[0], ap[2] - self.position[2])
      : 0
    const crowd = npcs.reduce((acc, n) => {
      if (n.id === selfId) return acc
      return acc + (Math.hypot(n.position[0] - ap[0], n.position[2] - ap[2]) < 1.2 ? 1 : 0)
    }, 0)
    return { f, score: dist + crowd * 2.5 }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored[0].f
}

function idleGap(phase: DifficultyPhase): number {
  if (phase === 'early') return 2200
  if (phase === 'mid') return 1400
  return 800
}

function smackBurst(phase: DifficultyPhase): number {
  if (phase === 'early') return 3800
  if (phase === 'mid') return 4200
  return 4800
}

export function applySilence(
  npc: NpcState,
  status: 'silenced' | 'sealed',
  durationSec: number,
  now: number,
  sealProp: SealProp = null,
  attackerPos?: [number, number, number],
  others: XZ[] = [],
): NpcState {
  let position = npc.position
  if (attackerPos) {
    const [x, z] = knockbackFrom(attackerPos, npc.position, 0.55, CONFIG.tables, others)
    position = [x, 0, z]
  }
  return {
    ...npc,
    status,
    statusUntil: now + durationSec * 1000,
    sealProp: status === 'sealed' ? sealProp : null,
    foodId: null,
    position,
    wobbleUntil: now + 500,
    stuckTicks: 0,
    facing: attackerPos
      ? facingToward(npc.position, attackerPos)
      : npc.facing,
    smackingSince: 0,
  }
}
