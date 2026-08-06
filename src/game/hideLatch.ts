import { CONFIG } from './config'
import type { SpaceLayoutState } from './spaceLayout'
import type { TableDef } from './types'

export const MAIN_DOOR_OPENING_ID = 'main-door'

export type ProximityFlags = {
  nearFurniture: boolean
  nearDoor: boolean
}

export type ProximityContext = ProximityFlags & {
  grounded: boolean
  inFaceRadius: boolean
  openingId?: string | null
  paused?: boolean
}

export type HoldState = {
  holding: boolean
  startedAt: number | null
  resolved: boolean
}

export type HideState = {
  hidden: boolean
  hideStartedAt: number | null
}

export type HideTickInput = {
  moveIntent: boolean
}

export type LatchTarget = {
  id: string
  position: [number, number, number]
}

export function createHoldState(): HoldState {
  return { holding: false, startedAt: null, resolved: false }
}

export function createHideState(): HideState {
  return { hidden: false, hideStartedAt: null }
}

export function resolveContext(flags: ProximityFlags): 'hide' | 'latch' | null {
  if (flags.nearFurniture) return 'hide'
  if (flags.nearDoor) return 'latch'
  return null
}

export function canEnterHide(ctx: Pick<ProximityContext, 'grounded' | 'inFaceRadius' | 'nearFurniture'>): boolean {
  return ctx.grounded && !ctx.inFaceRadius && ctx.nearFurniture
}

export function beginHold(_state: HoldState, now: number): HoldState {
  return { holding: true, startedAt: now, resolved: false }
}

export function cancelHold(state: HoldState): HoldState {
  return { holding: false, startedAt: null, resolved: state.resolved }
}

export function isHoldReady(state: HoldState, now: number): boolean {
  if (!state.holding || state.startedAt === null || state.resolved) return false
  return now - state.startedAt >= CONFIG.hideLatch.holdSec * 1000
}

export function resolveHold(
  state: HoldState,
  ctx: ProximityContext,
  now: number,
  opts?: { released?: boolean },
): { hold: HoldState; action: 'jump' | 'hide' | 'latch' | 'none' } {
  if (state.resolved) {
    return { hold: state, action: 'none' }
  }

  if (opts?.released) {
    const elapsed = state.startedAt !== null ? now - state.startedAt : 0
    if (elapsed < CONFIG.hideLatch.holdSec * 1000) {
      return { hold: cancelHold(state), action: 'jump' }
    }
    return { hold: cancelHold(state), action: 'none' }
  }

  if (!isHoldReady(state, now)) {
    return { hold: state, action: 'none' }
  }

  const context = resolveContext(ctx)
  if (context === 'hide' && canEnterHide(ctx)) {
    return {
      hold: { ...state, resolved: true },
      action: 'hide',
    }
  }
  if (context === 'latch' && ctx.openingId) {
    return {
      hold: { ...state, resolved: true },
      action: 'latch',
    }
  }

  return { hold: { ...state, resolved: true }, action: 'none' }
}

export function tickHide(state: HideState, input: HideTickInput, _now: number): HideState {
  if (!state.hidden) return state
  if (input.moveIntent) {
    return { hidden: false, hideStartedAt: null }
  }
  return state
}

export function isSearchEscalated(hideStartedAt: number | null, now: number): boolean {
  if (hideStartedAt === null) return false
  return now - hideStartedAt >= CONFIG.hideLatch.searchEscalateSec * 1000
}

export function nearPoint(
  playerPos: [number, number, number],
  target: [number, number, number],
  radius = CONFIG.hideLatch.interactRadius,
): boolean {
  const dx = playerPos[0] - target[0]
  const dz = playerPos[2] - target[2]
  return Math.hypot(dx, dz) <= radius
}

export function nearFurniture(
  playerPos: [number, number, number],
  tables: TableDef[],
  cabinets: [number, number, number][] = [],
): boolean {
  const radius = CONFIG.hideLatch.interactRadius
  for (const table of tables) {
    if (nearPoint(playerPos, table.position, radius)) return true
  }
  for (const cabinet of cabinets) {
    if (nearPoint(playerPos, cabinet, radius)) return true
  }
  return false
}

export function nearestLatchTarget(
  playerPos: [number, number, number],
  layout: SpaceLayoutState,
  mainDoorPos: [number, number, number],
): LatchTarget | null {
  const radius = CONFIG.hideLatch.interactRadius
  let best: LatchTarget | null = null
  let bestDist = Infinity

  for (const opening of layout.openings) {
    const d = Math.hypot(
      playerPos[0] - opening.position[0],
      playerPos[2] - opening.position[2],
    )
    if (d <= radius && d < bestDist) {
      bestDist = d
      best = { id: opening.id, position: opening.position }
    }
  }

  const doorDist = Math.hypot(
    playerPos[0] - mainDoorPos[0],
    playerPos[2] - mainDoorPos[2],
  )
  if (doorDist <= radius && doorDist < bestDist) {
    best = { id: MAIN_DOOR_OPENING_ID, position: mainDoorPos }
  }

  return best
}

export function ensureMainDoorOpening(
  layout: SpaceLayoutState,
  mainDoorPos: [number, number, number],
): SpaceLayoutState {
  if (layout.openings.some((o) => o.id === MAIN_DOOR_OPENING_ID)) return layout
  return {
    ...layout,
    openings: [
      ...layout.openings,
      {
        id: MAIN_DOOR_OPENING_ID,
        fromRoom: layout.rooms[0]?.id ?? 'r0',
        toRoom: 'outside',
        position: mainDoorPos,
        latchedUntil: 0,
      },
    ],
  }
}

export function latchOpening(
  layout: SpaceLayoutState,
  openingId: string,
  now: number,
  mainDoorPos?: [number, number, number],
): SpaceLayoutState {
  let next = layout
  if (openingId === MAIN_DOOR_OPENING_ID && mainDoorPos) {
    next = ensureMainDoorOpening(layout, mainDoorPos)
  }
  const until = now + CONFIG.hideLatch.latchDurationSec * 1000
  return {
    ...next,
    openings: next.openings.map((o) =>
      o.id === openingId ? { ...o, latchedUntil: until } : o,
    ),
  }
}

export function tickLatch(layout: SpaceLayoutState, now: number): SpaceLayoutState {
  let changed = false
  const openings = layout.openings.map((o) => {
    if (o.latchedUntil > 0 && o.latchedUntil <= now) {
      changed = true
      return { ...o, latchedUntil: 0 }
    }
    return o
  })
  return changed ? { ...layout, openings } : layout
}

export function buildProximityContext(
  playerPos: [number, number, number],
  tables: TableDef[],
  layout: SpaceLayoutState,
  mainDoorPos: [number, number, number],
  grounded: boolean,
  inFaceRadius: boolean,
  cabinets: [number, number, number][] = [],
  paused = false,
): ProximityContext {
  const nearFurn = nearFurniture(playerPos, tables, cabinets)
  const latch = nearestLatchTarget(playerPos, layout, mainDoorPos)
  return {
    grounded,
    inFaceRadius,
    nearFurniture: nearFurn,
    nearDoor: latch !== null,
    openingId: latch?.id ?? null,
    paused,
  }
}

export function shouldCancelHold(ctx: ProximityContext, contextAtStart: ProximityFlags | null): boolean {
  if (ctx.paused) return true
  if (!contextAtStart) return false
  const current = resolveContext(ctx)
  const started = resolveContext(contextAtStart)
  return current !== started
}
