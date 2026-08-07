import { CONFIG } from './config'
import type { SpaceEventDef, SpaceEventId } from './types'

/** #1 pool: A1,C1,C3 common; A2/C2 rare; A3/A5/C6 uncommon late; A4/C4 upstairs late; C5 minor-only (late between bosses). */
export const EVENTS: SpaceEventDef[] = [
  { id: 'A1', kind: 'A', inFirstRewardPool: true, weightLate: 3 },
  { id: 'A2', kind: 'A', inFirstRewardPool: true, weightLate: 2 },
  { id: 'A3', kind: 'A', inFirstRewardPool: false, weightLate: 2 },
  { id: 'A4', kind: 'A', inFirstRewardPool: false, weightLate: 2 },
  { id: 'A5', kind: 'A', inFirstRewardPool: false, weightLate: 2 },
  { id: 'C1', kind: 'C', inFirstRewardPool: true, weightLate: 3 },
  { id: 'C2', kind: 'C', inFirstRewardPool: true, weightLate: 1 },
  { id: 'C3', kind: 'C', inFirstRewardPool: true, weightLate: 3 },
  { id: 'C4', kind: 'C', inFirstRewardPool: false, weightLate: 2 },
  { id: 'C5', kind: 'C', inFirstRewardPool: false, weightLate: 1 },
  { id: 'C6', kind: 'C', inFirstRewardPool: false, weightLate: 2 },
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

export type PickSpaceEventOpts = {
  isFirst: boolean
  late: boolean
  /** When false, C5 is excluded (minor morph cap between bosses). Defaults to true. */
  allowMinorMorph?: boolean
  /** When true, only C5 is eligible (inter-boss minor morph). */
  minorOnly?: boolean
}

export function pickSpaceEvent(
  rng: () => number,
  opts: PickSpaceEventOpts,
): SpaceEventId {
  if (opts.minorOnly) return 'C5'

  const allowMinorMorph = opts.allowMinorMorph ?? true
  let pool: { id: SpaceEventId; weight: number }[]

  if (opts.isFirst) {
    pool = EVENTS.filter((e) => e.inFirstRewardPool).map((e) => ({
      id: e.id,
      weight: weightForFirstPool(e.id),
    }))
  } else if (opts.late) {
    pool = EVENTS.filter((e) => (allowMinorMorph || e.id !== 'C5')).map(
      (e) => ({
        id: e.id,
        weight: e.weightLate,
      }),
    )
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

export type BossDemotedForSpaceInput = {
  bossesCleared: number
  pendingSpaceEventAt: number | null
  lastSpaceEventAt: number
  now: number
  demotedCount: number
  eventCooldownSec: number
}

export type BossDemotedForSpaceResult = {
  bossesCleared: number
  pendingSpaceEventAt: number | null
  minorMorphsSinceBoss: number
}

/** Schedule a pending space event after boss demote; resets minor morph counter. */
export function onBossDemotedForSpace(
  input: BossDemotedForSpaceInput,
): BossDemotedForSpaceResult | null {
  if (input.demotedCount <= 0) return null

  const prevCleared = input.bossesCleared
  let pendingSpaceEventAt = input.pendingSpaceEventAt

  if (pendingSpaceEventAt === null) {
    if (prevCleared === 0) {
      pendingSpaceEventAt = scheduleFirstReward(input.now)
    } else if (
      canFireSpaceEvent({
        lastSpaceEventAt: input.lastSpaceEventAt,
        now: input.now,
        cooldownSec: input.eventCooldownSec,
      })
    ) {
      pendingSpaceEventAt = scheduleFirstReward(input.now)
    }
  }

  return {
    bossesCleared: input.bossesCleared + input.demotedCount,
    pendingSpaceEventAt,
    minorMorphsSinceBoss: 0,
  }
}

export type ConsumePendingSpaceEventInput = {
  pendingSpaceEventAt: number | null
  queuedSpaceEventId: SpaceEventId | null
  lastSpaceEventAt: number
  minorMorphsSinceBoss: number
  now: number
  phaseLate: boolean
  eventCooldownSec: number
  minorMorphMaxBetweenBosses: number
  pendingMinorOnly?: boolean
  rng: () => number
}

export type ConsumePendingSpaceEventResult = {
  pendingSpaceEventAt: number | null
  queuedSpaceEventId: SpaceEventId
  lastSpaceEventAt: number
  minorMorphsSinceBoss: number
  pendingMinorOnly: boolean
}

export type MaybeScheduleInterBossMinorMorphInput = {
  bossesCleared: number
  pendingSpaceEventAt: number | null
  queuedSpaceEventId: SpaceEventId | null
  lastSpaceEventAt: number
  minorMorphsSinceBoss: number
  now: number
  eventCooldownSec: number
  minorMorphMaxBetweenBosses: number
  pendingMinorOnly: boolean
}

export type MaybeScheduleInterBossMinorMorphResult = {
  pendingSpaceEventAt: number
  pendingMinorOnly: true
}

/** Schedule a C5-only pick once between bosses when cooldown allows. */
export function maybeScheduleInterBossMinorMorph(
  input: MaybeScheduleInterBossMinorMorphInput,
): MaybeScheduleInterBossMinorMorphResult | null {
  if (input.bossesCleared < 1) return null
  if (input.pendingSpaceEventAt !== null) return null
  if (input.queuedSpaceEventId !== null) return null
  if (input.pendingMinorOnly) return null
  if (input.lastSpaceEventAt === 0) return null
  if (input.minorMorphsSinceBoss >= input.minorMorphMaxBetweenBosses) return null
  if (
    !canFireSpaceEvent({
      lastSpaceEventAt: input.lastSpaceEventAt,
      now: input.now,
      cooldownSec: input.eventCooldownSec,
    })
  ) {
    return null
  }
  return { pendingSpaceEventAt: input.now, pendingMinorOnly: true }
}

/** Pick and queue a due space event; enforces cooldown and C5 morph cap. */
export function consumePendingSpaceEvent(
  input: ConsumePendingSpaceEventInput,
): ConsumePendingSpaceEventResult | null {
  if (input.pendingSpaceEventAt === null) return null
  if (input.now < input.pendingSpaceEventAt) return null
  if (input.queuedSpaceEventId !== null) return null

  const isFirstEvent = input.lastSpaceEventAt === 0
  const cooldownOk =
    isFirstEvent ||
    canFireSpaceEvent({
      lastSpaceEventAt: input.lastSpaceEventAt,
      now: input.now,
      cooldownSec: input.eventCooldownSec,
    })
  if (!cooldownOk) return null

  const allowMinorMorph =
    input.minorMorphsSinceBoss < input.minorMorphMaxBetweenBosses
  const minorOnly = input.pendingMinorOnly === true
  if (minorOnly && !allowMinorMorph) return null

  const queuedSpaceEventId = pickSpaceEvent(input.rng, {
    isFirst: isFirstEvent,
    late: input.phaseLate,
    allowMinorMorph,
    minorOnly,
  })

  let minorMorphsSinceBoss = input.minorMorphsSinceBoss
  if (queuedSpaceEventId === 'C5') {
    minorMorphsSinceBoss += 1
  }

  return {
    pendingSpaceEventAt: null,
    queuedSpaceEventId,
    lastSpaceEventAt: input.now,
    minorMorphsSinceBoss,
    pendingMinorOnly: false,
  }
}
