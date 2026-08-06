import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'
import { createInitialLayout } from '../spaceLayout'
import {
  beginHold,
  cancelHold,
  canEnterHide,
  createHoldState,
  createHideState,
  isHoldReady,
  isSearchEscalated,
  latchOpening,
  nearestLatchTarget,
  nearFurniture,
  resolveContext,
  resolveHold,
  tickHide,
  tickLatch,
  type ProximityContext,
} from '../hideLatch'

describe('canEnterHide', () => {
  it('rejects hide in face radius', () => {
    expect(
      canEnterHide({ grounded: true, inFaceRadius: true, nearFurniture: true }),
    ).toBe(false)
  })

  it('rejects hide when airborne', () => {
    expect(
      canEnterHide({ grounded: false, inFaceRadius: false, nearFurniture: true }),
    ).toBe(false)
  })

  it('allows hide when grounded near furniture', () => {
    expect(
      canEnterHide({ grounded: true, inFaceRadius: false, nearFurniture: true }),
    ).toBe(true)
  })
})

describe('resolveContext', () => {
  it('prefers furniture over door when both near', () => {
    expect(resolveContext({ nearFurniture: true, nearDoor: true })).toBe('hide')
  })

  it('returns latch when only near door', () => {
    expect(resolveContext({ nearFurniture: false, nearDoor: true })).toBe('latch')
  })

  it('returns null when nothing near', () => {
    expect(resolveContext({ nearFurniture: false, nearDoor: false })).toBeNull()
  })
})

describe('tickHide', () => {
  it('move intent exits hide', () => {
    const s = tickHide(
      { hidden: true, hideStartedAt: 500 },
      { moveIntent: true },
      1000,
    )
    expect(s.hidden).toBe(false)
    expect(s.hideStartedAt).toBeNull()
  })

  it('stays hidden without move intent', () => {
    const s = tickHide(
      { hidden: true, hideStartedAt: 500 },
      { moveIntent: false },
      1000,
    )
    expect(s.hidden).toBe(true)
  })
})

describe('hold state machine', () => {
  const ctx: ProximityContext = {
    grounded: true,
    inFaceRadius: false,
    nearFurniture: true,
    nearDoor: false,
  }

  it('beginHold tracks start time', () => {
    const h = beginHold(createHoldState(), 1000)
    expect(h.holding).toBe(true)
    expect(h.startedAt).toBe(1000)
  })

  it('resolveHold returns hide after holdSec', () => {
    let h: HoldState = beginHold(createHoldState(), 1000)
    const result = resolveHold(h, ctx, 1000 + CONFIG.hideLatch.holdSec * 1000)
    expect(result.action).toBe('hide')
    expect(result.hold.resolved).toBe(true)
  })

  it('resolveHold returns jump when released early', () => {
    const h = beginHold(createHoldState(), 1000)
    const result = resolveHold(h, ctx, 1100, { released: true })
    expect(result.action).toBe('jump')
  })

  it('cancelHold clears holding', () => {
    const h = cancelHold(beginHold(createHoldState(), 1000))
    expect(h.holding).toBe(false)
    expect(h.startedAt).toBeNull()
  })

  it('isHoldReady is false before holdSec', () => {
    const h = beginHold(createHoldState(), 1000)
    expect(isHoldReady(h, 1200)).toBe(false)
    expect(isHoldReady(h, 1000 + CONFIG.hideLatch.holdSec * 1000)).toBe(true)
  })
})

describe('search escalate', () => {
  it('escalates after searchEscalateSec', () => {
    const start = 1000
    expect(isSearchEscalated(start, start + CONFIG.hideLatch.searchEscalateSec * 1000 - 1)).toBe(
      false,
    )
    expect(isSearchEscalated(start, start + CONFIG.hideLatch.searchEscalateSec * 1000)).toBe(true)
  })
})

describe('nearFurniture', () => {
  it('is true within interact radius of a table', () => {
    const tables = CONFIG.tables
    const pos = tables[0].position
    expect(nearFurniture([pos[0], 0, pos[2]], tables)).toBe(true)
  })

  it('is false far from tables', () => {
    expect(nearFurniture([20, 0, 20], CONFIG.tables)).toBe(false)
  })

  it('is true within interact radius of a cabinet', () => {
    // coords mirror Atmosphere CABINET_POSITIONS (avoid scene import cycles)
    const cabinet: [number, number, number] = [-4.15, 0, 3.6]
    expect(nearFurniture([cabinet[0], 0, cabinet[2]], [], [cabinet])).toBe(true)
  })
})

describe('latchOpening', () => {
  it('sets latchedUntil on the target opening', () => {
    const layout = createInitialLayout()
    const withDoor = {
      ...layout,
      openings: [
        {
          id: 'door-0',
          fromRoom: 'r0',
          toRoom: 'r1',
          position: [0, 0, -4] as [number, number, number],
          latchedUntil: 0,
        },
      ],
    }
    const next = latchOpening(withDoor, 'door-0', 5000)
    expect(next.openings[0].latchedUntil).toBe(
      5000 + CONFIG.hideLatch.latchDurationSec * 1000,
    )
  })

  it('tickLatch clears expired latches', () => {
    const layout = {
      ...createInitialLayout(),
      openings: [
        {
          id: 'door-0',
          fromRoom: 'r0',
          toRoom: 'r1',
          position: [0, 0, -4] as [number, number, number],
          latchedUntil: 100,
        },
      ],
    }
    const next = tickLatch(layout, 200)
    expect(next.openings[0].latchedUntil).toBe(0)
  })
})

describe('nearestLatchTarget', () => {
  it('prefers nearest opening over main door', () => {
    const layout = {
      ...createInitialLayout(),
      openings: [
        {
          id: 'door-near',
          fromRoom: 'r0',
          toRoom: 'r1',
          position: [1, 0, 0] as [number, number, number],
          latchedUntil: 0,
        },
      ],
    }
    const target = nearestLatchTarget([1, 0, 0.5], layout, CONFIG.door.position)
    expect(target?.id).toBe('door-near')
  })
})
