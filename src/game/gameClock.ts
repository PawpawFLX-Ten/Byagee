import type { NpcState, PropState } from './types'
import type { SpaceLayoutState } from './spaceLayout'

/**
 * Wall-clock continuity for the simulation.
 *
 * The sim stamps most timers in absolute `performance.now()` milliseconds.
 * Pausing (no ticks) or hiding the tab (rAF suspended) would otherwise let
 * those stamps expire while no gameplay ran — free cooldowns after ESC,
 * phase skips after tab-away. Instead of migrating every reader to a
 * separate game clock, tick detects the wall-clock gap and shifts every
 * stored stamp forward by exactly that gap: all relative distances are
 * preserved, so the world resumes precisely where it left off.
 */

/** Real-frame gaps stay well under this; only pauses/tab-away exceed it. */
export const CLOCK_GAP_MS = 200

/** Shift to apply for the current tick — 0 when the clock is continuous. */
export function clockGapShiftMs(lastTickAtMs: number, now: number): number {
  if (lastTickAtMs <= 0) return 0
  const gap = now - lastTickAtMs
  return gap > CLOCK_GAP_MS ? gap : 0
}

/** Shift a stamp that uses 0 as its "inactive" sentinel. */
export function shiftStamp(value: number, ms: number): number {
  return value > 0 ? value + ms : value
}

/** Shift an optional stamp (`null` = inactive). */
function shiftOptionalStamp(value: number | null, ms: number): number | null {
  return value !== null ? value + ms : value
}

export function shiftNpcClock(npc: NpcState, ms: number): NpcState {
  return {
    ...npc,
    statusUntil: shiftStamp(npc.statusUntil, ms),
    wobbleUntil: shiftStamp(npc.wobbleUntil, ms),
    staggerUntil: shiftStamp(npc.staggerUntil, ms),
    idleSince: shiftStamp(npc.idleSince, ms),
    smackingSince: shiftStamp(npc.smackingSince, ms),
    lastHitAt: shiftStamp(npc.lastHitAt, ms),
    pulseChargeUntil: shiftStamp(npc.pulseChargeUntil, ms),
    pulseCooldownUntil: shiftStamp(npc.pulseCooldownUntil, ms),
    pulseFiredAt: shiftStamp(npc.pulseFiredAt, ms),
  }
}

export function shiftPropClock(prop: PropState, ms: number): PropState {
  return {
    ...prop,
    spawnedAt: prop.spawnedAt + ms,
    fadingSince: shiftOptionalStamp(prop.fadingSince, ms),
  }
}

export function shiftLayoutClock(layout: SpaceLayoutState, ms: number): SpaceLayoutState {
  if (layout.openings.length === 0) return layout
  return {
    ...layout,
    openings: layout.openings.map((o) => ({
      ...o,
      latchedUntil: shiftStamp(o.latchedUntil, ms),
      lastLatchedAt: shiftStamp(o.lastLatchedAt, ms),
    })),
  }
}

export function shiftCooldownClock(
  cooldowns: Record<string, number>,
  ms: number,
): Record<string, number> {
  const next: Record<string, number> = {}
  for (const key of Object.keys(cooldowns)) {
    next[key] = shiftStamp(cooldowns[key], ms)
  }
  return next
}
