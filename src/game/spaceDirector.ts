import { CONFIG } from './config'
import type { SpaceEventDef, SpaceEventId } from './types'

/** #1 pool: A1,C1,C3 common; A2/C2 rare; A3/A4/C4 excluded; C5 minor-only (late between bosses). */
export const EVENTS: SpaceEventDef[] = [
  { id: 'A1', kind: 'A', inFirstRewardPool: true, weightLate: 3 },
  { id: 'A2', kind: 'A', inFirstRewardPool: true, weightLate: 2 },
  { id: 'A3', kind: 'A', inFirstRewardPool: false, weightLate: 2 },
  { id: 'A4', kind: 'A', inFirstRewardPool: false, weightLate: 1 },
  { id: 'C1', kind: 'C', inFirstRewardPool: true, weightLate: 3 },
  { id: 'C2', kind: 'C', inFirstRewardPool: true, weightLate: 1 },
  { id: 'C3', kind: 'C', inFirstRewardPool: true, weightLate: 3 },
  { id: 'C4', kind: 'C', inFirstRewardPool: false, weightLate: 2 },
  { id: 'C5', kind: 'C', inFirstRewardPool: false, weightLate: 1 },
]

const FIRST_POOL_RARE = new Set<SpaceEventId>(['A2', 'C2'])

function weightForFirstPool(id: SpaceEventId): number {
  return FIRST_POOL_RARE.has(id) ? 1 : 3
}

function weightedPick(
  items: { id: SpaceEventId; weight: number }[],
  rng: () => number,
): SpaceEventId {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item.id
  }
  return items[items.length - 1]!.id
}

export function pickSpaceEvent(
  rng: () => number,
  opts: { isFirst: boolean; late: boolean },
): SpaceEventId {
  let pool: { id: SpaceEventId; weight: number }[]

  if (opts.isFirst) {
    pool = EVENTS.filter((e) => e.inFirstRewardPool).map((e) => ({
      id: e.id,
      weight: weightForFirstPool(e.id),
    }))
  } else if (opts.late) {
    pool = EVENTS.map((e) => ({ id: e.id, weight: e.weightLate }))
  } else {
    pool = EVENTS.filter((e) => e.id !== 'C5').map((e) => ({
      id: e.id,
      weight: e.weightLate,
    }))
  }

  return weightedPick(pool, rng)
}

export function canFireSpaceEvent(args: {
  lastSpaceEventAt: number
  now: number
  cooldownSec: number
}): boolean {
  const elapsedMs = args.now - args.lastSpaceEventAt
  return elapsedMs >= args.cooldownSec * 1000
}

export function scheduleFirstReward(demotedAtMs: number): number {
  return demotedAtMs + CONFIG.space.firstEventDelayAfterBossDemoteMs
}
