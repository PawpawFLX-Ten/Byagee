import { CONFIG } from './config'
import { t } from './i18n'
import { floorY } from './spaceLayout'
import type { NpcState, PropState, PropType, TableDef } from './types'
import type { SpaceLayoutState } from './spaceLayout'

/**
 * Decide whether a new prop should spawn this tick.
 * Capped at CONFIG.props.maxOnFloor so long runs do not grow the scene unbounded.
 */
export function shouldSpawnProp(args: {
  elapsedSec: number
  nextPropAt: number
  existingProps: PropState[]
  alive: boolean
}): boolean {
  const { elapsedSec, nextPropAt, existingProps, alive } = args
  if (!alive) return false
  if (existingProps.length >= CONFIG.props.maxOnFloor) return false
  return elapsedSec >= nextPropAt
}

/**
 * HP-aware prop type selection.
 * healWeight = 0.5 + (1 - hp/maxHp) * 0.5
 * At full HP: 50/50. At zero HP: 100% heal.
 */
export function pickPropType(hp: number, maxHp: number): PropType {
  const healWeight = 0.5 + (1 - hp / maxHp) * 0.5
  return Math.random() < healWeight ? 'heal' : 'silence'
}

/**
 * Sample a random floor position, avoiding tables, walls, and door.
 * Samples inside the union of all rooms (any floor) when a layout is
 * provided, so expanded halls and upstairs nooks get props too.
 * Rejection sampling with up to 20 retries.
 */
export function sampleFloorPosition(
  tables: TableDef[],
  doorPos: [number, number, number],
  layout?: SpaceLayoutState,
): [number, number, number] {
  const margin = CONFIG.props.spawnMargin
  const tableMargin = CONFIG.props.tableMargin
  const doorR = CONFIG.props.doorExclusionRadius

  const rooms = layout?.rooms ?? []
  let minX = -4.35 + margin
  let maxX = 4.35 - margin
  let minZ = -4.35 + margin
  let maxZ = 4.35 - margin
  if (rooms.length > 0) {
    minX = Math.min(...rooms.map((r) => r.min[0])) + margin
    maxX = Math.max(...rooms.map((r) => r.max[0])) - margin
    minZ = Math.min(...rooms.map((r) => r.min[1])) + margin
    maxZ = Math.max(...rooms.map((r) => r.max[1])) - margin
  }
  const insideAnyRoom = (x: number, z: number) => {
    if (rooms.length === 0) return true
    return rooms.some((r) => x >= r.min[0] + 0.2 && x <= r.max[0] - 0.2 && z >= r.min[1] + 0.2 && z <= r.max[1] - 0.2)
  }
  /** Highest floor band covering (x, z) — upstairs rooms win over r0. */
  const floorAt = (x: number, z: number): number => {
    let floor = 0
    for (const r of rooms) {
      if (
        x >= r.min[0] + 0.2 && x <= r.max[0] - 0.2 &&
        z >= r.min[1] + 0.2 && z <= r.max[1] - 0.2
      ) {
        floor = Math.max(floor, r.floor)
      }
    }
    return floor
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = minX + Math.random() * (maxX - minX)
    const z = minZ + Math.random() * (maxZ - minZ)

    if (!insideAnyRoom(x, z)) continue

    // Check door exclusion
    const distToDoor = Math.hypot(x - doorPos[0], z - doorPos[2])
    if (distToDoor < doorR) continue

    // Check table exclusion
    let blocked = false
    for (const t of tables) {
      const dx = Math.abs(x - t.position[0])
      const dz = Math.abs(z - t.position[2])
      if (dx < t.half.x + tableMargin && dz < t.half.z + tableMargin) {
        blocked = true
        break
      }
    }
    if (blocked) continue

    const floor = floorAt(x, z)
    return [x, floorY(floor) + CONFIG.props.floatHeight, z]
  }

  // Fallback: center of primary room
  const cx = rooms.length ? (rooms[0].min[0] + rooms[0].max[0]) / 2 : 0
  const cz = rooms.length ? (rooms[0].min[1] + rooms[0].max[1]) / 2 : 0
  return [cx, floorY(floorAt(cx, cz)) + CONFIG.props.floatHeight, cz]
}

/**
 * Check if the player is within pickup radius of any non-fading prop.
 * Pickup is floor-aware: a prop hovering over a different floor band
 * cannot be collected by walking underneath it.
 */
export function checkPickup(
  props: PropState[],
  playerPos: [number, number, number],
  pickupRadius: number,
): PropState | null {
  for (const prop of props) {
    if (prop.fadingSince !== null) continue
    if (floorY(prop.position[1] > 1.2 ? 1 : 0) !== floorY(playerPos[1] > 1.2 ? 1 : 0)) continue
    const dx = prop.position[0] - playerPos[0]
    const dz = prop.position[2] - playerPos[2]
    if (Math.hypot(dx, dz) <= pickupRadius) {
      return prop
    }
  }
  return null
}

/**
 * Apply a prop's effect. Returns updated NPCs, HP, and toast text.
 */
export function applyPropEffect(
  prop: PropState,
  npcs: NpcState[],
  hp: number,
  maxHp: number,
  now: number,
): { npcs: NpcState[]; hp: number; toastText: string } {
  if (prop.type === 'heal') {
    return {
      npcs,
      hp: Math.min(maxHp, hp + CONFIG.props.healAmount),
      toastText: `${t('prop_heal')}${CONFIG.props.healAmount}`,
    }
  }

  // silence: only normal NPCs
  const silenceUntil = now + CONFIG.props.silenceSec * 1000
  const chaserSilenceMs = 300
  const nextNpcs = npcs.map((n) => {
    if (n.role === 'boss') return n
    if (n.role === 'chaser') {
      if (n.status === 'walking') return n
      return {
        ...n,
        status: 'silenced' as const,
        statusUntil: now + chaserSilenceMs,
        sealProp: null,
        smackingSince: 0,
      }
    }
    if (n.status === 'walking') return n // don't silence walking NPCs
    return {
      ...n,
      status: 'silenced' as const,
      statusUntil: silenceUntil,
      sealProp: null,
    }
  })

  return {
    npcs: nextNpcs,
    hp,
    toastText: `${t('prop_silence_prefix')}${CONFIG.props.silenceSec}${t('prop_silence_suffix')}`,
  }
}

/**
 * Create a new prop state.
 */
export function createProp(
  type: PropType,
  position: [number, number, number],
  now: number,
  id: string,
): PropState {
  return {
    id,
    type,
    position,
    spawnedAt: now,
    fadingSince: null,
  }
}
