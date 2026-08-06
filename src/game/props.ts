import { CONFIG } from './config'
import { t } from './i18n'
import type { NpcState, PropState, PropType, TableDef } from './types'

const ROOM_LIMIT = 4.35

/**
 * Decide whether a new prop should spawn this tick.
 * Props persist until picked up — existing props do NOT block spawning.
 */
export function shouldSpawnProp(args: {
  elapsedSec: number
  nextPropAt: number
  existingProps: PropState[]
  alive: boolean
}): boolean {
  const { elapsedSec, nextPropAt, alive } = args
  if (!alive) return false
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
 * Uses rejection sampling with up to 20 retries.
 */
export function sampleFloorPosition(
  tables: TableDef[],
  doorPos: [number, number, number],
): [number, number, number] {
  const margin = CONFIG.props.spawnMargin
  const tableMargin = CONFIG.props.tableMargin
  const doorR = CONFIG.props.doorExclusionRadius
  const bound = ROOM_LIMIT - margin

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = (Math.random() * 2 - 1) * bound
    const z = (Math.random() * 2 - 1) * bound

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

    return [x, CONFIG.props.floatHeight, z]
  }

  // Fallback: center of room
  return [0, CONFIG.props.floatHeight, 0]
}

/**
 * Check if the player is within pickup radius of any non-fading prop.
 */
export function checkPickup(
  props: PropState[],
  playerPos: [number, number, number],
  pickupRadius: number,
): PropState | null {
  for (const prop of props) {
    if (prop.fadingSince !== null) continue
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
