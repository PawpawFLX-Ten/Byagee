import {
  floorOfY,
  knockbackFrom,
  moveWithCollision,
  resolveWorldCollision,
  separateFromOthers,
  type LayoutBounds,
  type ObstacleCollider,
  type TableCollider,
  type XZ,
} from './collision'
import { CONFIG } from './config'
import { pickArchetype, pickBuild } from './archetype'
import { getRuntimeSpace } from './runtimeSpace'
import { getPhase } from './difficulty'
import {
  agentYAt,
  roomIdAtY,
  stairEndPos,
  type SpaceLayoutState,
} from './spaceLayout'
import type { DifficultyPhase, FoodSpot, NpcState, SealProp } from './types'

const STUCK_TICKS_BEFORE_REROUTE = 25

/** Point inside the destination room of `opening`, so agents cross the wall gap. */
function doorWaypoint(
  layout: SpaceLayoutState,
  opening: SpaceLayoutState['openings'][0],
  fromRoomId: string,
): [number, number, number] {
  const from = layout.rooms.find((r) => r.id === fromRoomId)
  const toId = opening.fromRoom === fromRoomId ? opening.toRoom : opening.fromRoom
  const to = layout.rooms.find((r) => r.id === toId)
  // Cross-floor openings are stairwells: the waypoint is the stair end on
  // the destination side, so agents climb/descend the full ramp.
  if (from && to && from.floor !== to.floor) {
    const stairs = layout.stairs.find(
      (s) =>
        (s.fromRoom === opening.fromRoom && s.toRoom === opening.toRoom) ||
        (s.fromRoom === opening.toRoom && s.toRoom === opening.fromRoom),
    )
    if (stairs) {
      const end = stairEndPos(layout, stairs, to.floor)
      return [end[0], 0, end[1]]
    }
  }
  const [px, , pz] = opening.position
  if (from) {
    if (Math.abs(px - from.max[0]) < 0.01) return [px + 1.2, 0, pz]
    if (Math.abs(px - from.min[0]) < 0.01) return [px - 1.2, 0, pz]
    if (Math.abs(pz - from.max[1]) < 0.01) return [px, 0, pz + 1.2]
    if (Math.abs(pz - from.min[1]) < 0.01) return [px, 0, pz - 1.2]
  }
  return [px, 0, pz]
}

/**
 * When the food target is in another room, return a door waypoint on the path.
 * Chained rooms (corridor + end room) resolve tick by tick as roomId updates.
 */
export function waypointToward(
  layout: SpaceLayoutState,
  from: [number, number, number],
  target: [number, number, number],
): [number, number, number] | null {
  const fromRoom = roomIdAtY(layout, from[0], from[2], from[1] ?? 0)
  const targetRoom = roomIdAtY(layout, target[0], target[2], target[1] ?? 0)
  if (fromRoom === targetRoom) return null
  const direct = layout.openings.find(
    (o) =>
      (o.fromRoom === fromRoom && o.toRoom === targetRoom) ||
      (o.fromRoom === targetRoom && o.toRoom === fromRoom),
  )
  const gate =
    direct ??
    layout.openings.find((o) => o.fromRoom === fromRoom || o.toRoom === fromRoom)
  if (!gate) return null
  return doorWaypoint(layout, gate, fromRoom)
}

function foodIndexInConfig(foodId: string): number {
  const idx = getRuntimeSpace().foodSpots.findIndex((f) => f.id === foodId)
  return idx >= 0 ? idx : 0
}

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
function approachFor(food: FoodSpot, foodIdx: number): [number, number, number] {
  const spread = ((foodIdx % 3) - 1) * 0.55
  // Offset along the table edge tangent (perpendicular to radial direction)
  const ax = food.approach[0]
  const az = food.approach[2]
  const len = Math.hypot(ax, az) || 1
  const tx = -az / len
  const tz = ax / len
  return [ax + tx * spread, food.approach[1] ?? 0, az + tz * spread]
}

/** Look ahead in the movement direction; if a table blocks the path, steer around it. */
function steeredDirection(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  tables: TableCollider[],
  obstacles: ObstacleCollider[] = [],
  floor = 0,
  agentY = 0,
): [number, number] {
  const dx = toX - fromX
  const dz = toZ - fromZ
  const dist = Math.hypot(dx, dz)
  if (dist < 0.01) return [0, 0]
  const dirX = dx / dist
  const dirZ = dz / dist

  // Probe ahead for table/obstacle collisions
  const lookAhead = Math.min(dist, 1.5)
  const probeX = fromX + dirX * lookAhead
  const probeZ = fromZ + dirZ * lookAhead
  const [resolvedX, resolvedZ] = resolveWorldCollision(probeX, probeZ, tables, obstacles, undefined, floor, agentY)

  if (resolvedX === probeX && resolvedZ === probeZ) {
    return [dirX, dirZ] // path is clear, go straight
  }

  // Path is blocked �?steer toward the collision resolution direction
  const deflectX = resolvedX - probeX
  const deflectZ = resolvedZ - probeZ
  const deflectLen = Math.hypot(deflectX, deflectZ)
  if (deflectLen < 0.01) return [dirX, dirZ]

  // Blend: 60% original direction + 40% deflection (around table edge)
  const blend = 0.6
  let steerX = dirX * blend + (deflectX / deflectLen) * (1 - blend)
  let steerZ = dirZ * blend + (deflectZ / deflectLen) * (1 - blend)
  const steerLen = Math.hypot(steerX, steerZ)
  if (steerLen < 0.001) return [dirX, dirZ]
  return [steerX / steerLen, steerZ / steerLen]
}

export function createNpcs(now: number): NpcState[] {
  const runtime = getRuntimeSpace()
  return runtime.seatPositions.slice(0, CONFIG.npcCount).map((pos, i) => {
    const food = runtime.foodSpots[i % runtime.foodSpots.length]
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
      archetype: pickArchetype(),
      build: pickBuild(),
      roomId: 'r0',
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
  })
}

export function tickNpcs(
  npcs: NpcState[],
  now: number,
  elapsedSec: number,
  dt: number,
  playerPos?: [number, number, number],
  obstacles: ObstacleCollider[] = [],
  bounds?: LayoutBounds,
  layout?: SpaceLayoutState,
): { npcs: NpcState[]; despawnIds: string[] } {
  const phase = getPhase(elapsedSec)
  const maxSmack = CONFIG.maxOverlappingSmackers[phase]
  const { tables, foodSpots } = getRuntimeSpace()
  let smacking = npcs.filter((n) => n.status === 'smacking').length
  const despawnIds: string[] = []

  // Claim food targets sequentially so later NPCs see earlier claims
  const claimed = new Set(
    npcs.filter((n) => n.foodId && n.status === 'walking').map((n) => n.foodId),
  )

  let nextList = npcs.map((npc) => {
    // Exiting chasers walk out via the generic door path; active chasers
    // are driven by stepChaser in the store tick instead.
    if (npc.role === 'chaser' && !npc.exiting) return npc

    let next = { ...npc }
    const blockers = [
      ...othersXZ(npcs, npc.id),
      ...(playerPos ? [{ x: playerPos[0], z: playerPos[2] }] : []),
    ]

    if (next.exiting) {
      const door = CONFIG.door.position
      const doorDist = Math.hypot(
        door[0] - next.position[0],
        door[2] - next.position[2],
      )
      next.facing = Math.atan2(door[0] - next.position[0], door[2] - next.position[2])
      if (doorDist < 0.45 || now >= next.statusUntil) {
        despawnIds.push(next.id)
        return next
      }
      // Route through door/stair waypoints so upstairs NPCs can descend.
      const waypoint = layout ? waypointToward(layout, next.position, door) : null
      const goal = waypoint ?? door
      const goalDist = Math.hypot(goal[0] - next.position[0], goal[2] - next.position[2])
      const step = CONFIG.npcWalkSpeed * dt
      const [dirX, dirZ] = steeredDirection(
        next.position[0], next.position[2],
        goal[0], goal[2],
        tables,
        obstacles,
        floorOfY(next.position[1]),
        next.position[1],
      )
      const mx = dirX * Math.min(step, goalDist)
      const mz = dirZ * Math.min(step, goalDist)
      const [x, z] = moveWithCollision(next.position[0], next.position[2], mx, mz, tables, blockers, undefined, obstacles, bounds, floorOfY(next.position[1]), next.position[1])
      const y = layout ? agentYAt(layout, x, z, next.position[1]) : 0
      return {
        ...next,
        position: [x, y, z] as [number, number, number],
        roomId: layout ? roomIdAtY(layout, x, z, y) : next.roomId,
      }
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

      const food = foodSpots.find((f) => f.id === next.foodId)
      if (!food) {
        return {
          ...next,
          status: 'idle' as const,
          statusUntil: now + 400,
          foodId: null,
          stuckTicks: 0,
        }
      }

      const target = approachFor(food, foodIndexInConfig(food.id))
      const waypoint = layout ? waypointToward(layout, next.position, target) : null
      const goal = waypoint ?? target
      const dist = Math.hypot(goal[0] - next.position[0], goal[2] - next.position[2])
      next.facing = Math.atan2(goal[0] - next.position[0], goal[2] - next.position[2])

      // Arrive only at the final target �?a waypoint just means "keep going".
      if (dist < 0.28 && !waypoint) {
        if (smacking < maxSmack) {
          smacking += 1
          const [x, z] = separateFromOthers(target[0], target[2], blockers, tables, undefined, obstacles, bounds, floorOfY(target[1]), target[1] ?? 0)
          const y = layout ? agentYAt(layout, x, z, target[1] ?? 0) : target[1] ?? 0
          return {
            ...next,
            status: 'smacking' as const,
            statusUntil: now + smackBurst(phase),
            position: [x, y, z] as [number, number, number],
            facing: facingToward([x, y, z], food.plate),
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
      const [dirX, dirZ] = steeredDirection(
        next.position[0], next.position[2],
        goal[0], goal[2],
        tables,
        obstacles,
        floorOfY(next.position[1]),
        next.position[1],
      )
      let mx = dirX * Math.min(step, dist)
      let mz = dirZ * Math.min(step, dist)

      // If blocked, slide along table perimeter instead of pushing into the jam
      if (next.stuckTicks > 12) {
        const slide = step * 1.1
        const around = perimeterSlide(next.position[0], next.position[2], slide, next.seatIndex, floorOfY(next.position[1]))
        mx = around[0] - next.position[0]
        mz = around[1] - next.position[2]
      }

      const [x, z] = moveWithCollision(
        next.position[0],
        next.position[2],
        mx,
        mz,
        tables,
        blockers,
        undefined,
        obstacles,
        bounds,
        floorOfY(next.position[1]),
        next.position[1],
      )
      const moved = Math.hypot(x - next.position[0], z - next.position[2])
      const stuckTicks =
        moved < step * 0.2 && dist > 0.35 ? next.stuckTicks + 1 : 0

      // Re-route to a free, less crowded food when jammed
      if (stuckTicks >= STUCK_TICKS_BEFORE_REROUTE) {
        claimed.delete(next.foodId)
        const alt = pickFood(npcs, next.id, claimed, next.foodId)
        claimed.add(alt.id)
        const altApproach = approachFor(alt, foodIndexInConfig(alt.id))
        const y = layout ? agentYAt(layout, x, z, next.position[1]) : 0
        return {
          ...next,
          foodId: alt.id,
          stuckTicks: 0,
          statusUntil: now + 8000,
          facing: facingToward(next.position, altApproach),
          position: [x, y, z] as [number, number, number],
        }
      }

      const y = layout ? agentYAt(layout, x, z, next.position[1]) : 0
      return {
        ...next,
        position: [x, y, z] as [number, number, number],
        roomId: layout ? roomIdAtY(layout, x, z, y) : next.roomId,
        stuckTicks,
      }
    }

    // Defensive: a 'walking' NPC without a food target would fall through
    // every branch below and freeze permanently while occupying population
    // capacity — route it back into the idle rotation instead.
    if (next.status === 'walking' && !next.foodId) {
      return {
        ...next,
        status: 'idle' as const,
        statusUntil: now + 500,
        stuckTicks: 0,
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
        noiseReduction: 0,
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
        facing: facingToward(next.position, approachFor(food, foodIndexInConfig(food.id))),
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
    const [x, z] = separateFromOthers(npc.position[0], npc.position[2], blockers, tables, undefined, obstacles, bounds, floorOfY(npc.position[1]), npc.position[1])
    if (x === npc.position[0] && z === npc.position[2]) return npc
    const y = layout ? agentYAt(layout, x, z, npc.position[1]) : 0
    return { ...npc, position: [x, y, z] as [number, number, number] }
  })

  return { npcs: nextList, despawnIds }
}

/** Walk along the outside of the table AABB when path is jammed. */
function perimeterSlide(
  x: number,
  z: number,
  step: number,
  seatIndex: number,
  floor = 0,
): [number, number] {
  const table = nearestTable(x, z, floor)
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

function nearestTable(x: number, z: number, floor = 0): TableCollider {
  let best = getRuntimeSpace().tables[0]
  let bestD = Infinity
  for (const t of getRuntimeSpace().tables) {
    if (floorOfY(t.position[1]) !== floor) continue
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

  const foods = getRuntimeSpace().foodSpots
  const free = foods.filter((f) => !taken.has(f.id))
  const pool = free.length ? free : foods.filter((f) => f.id !== excludeId)
  const choices = pool.length ? pool : foods

  // Prefer nearest uncrowded approach
  const scored = choices.map((f) => {
    const ap = approachFor(f, foodIndexInConfig(f.id))
    const dist = self
      ? Math.hypot(ap[0] - self.position[0], ap[2] - self.position[2])
      : 0
    const crowd = npcs.reduce((acc, n) => {
      if (n.id === selfId) return acc
      return acc + (Math.hypot(n.position[0] - ap[0], n.position[2] - ap[2]) < 1.2 ? 1 : 0)
    }, 0)
    // Count how many NPCs are already at the same table as this food spot
    const tableCrowd = npcs.reduce((acc, n) => {
      if (n.id === selfId) return acc
      const foodTableDist = Math.hypot(n.position[0] - f.approach[0], n.position[2] - f.approach[2])
      return acc + (foodTableDist < 2.5 ? 1 : 0)
    }, 0)
    return { f, score: dist + crowd * 3.0 + tableCrowd * 2.0 + Math.random() * 0.4 }
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
  const walkingNonSeated = npc.status === 'walking' && npc.role !== 'chaser'
  if (attackerPos && (walkingNonSeated || npc.role === 'boss')) {
    const [x, z] = knockbackFrom(attackerPos, npc.position, 0.55, getRuntimeSpace().tables, others, undefined, undefined, floorOfY(npc.position[1]), npc.position[1])
    position = [x, npc.position[1], z]
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
    noiseReduction: 0,
  }
}
