# Civic Man Round 2 ‚Ä?Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add door population (cap 10 incl. boss), three shaped tables, escalating boss modules, and slap„ÄåÊìç‰Ω†Â¶à„ÄçSFX on the existing Civic Man prototype.

**Architecture:** Keep pure logic in `src/game/` (new `doorSystem.ts`, `bossModules.ts`) with config-driven plugin unlock tables. Zustand `store.ts` ticks door + boss spawn alongside NPC FSM. R3F only renders door/tables/boss scale/mouth HP. Skills wrap silence through boss hit resolution.

**Tech Stack:** Vite, React 19, TypeScript, R3F, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-07-13-civic-man-round2-design.md`

---

## File structure

```
src/game/types.ts              # NpcRole, mouth HP, table defs, door/boss config types
src/game/config.ts             # 3 tables, 10 seats, doorPlugins, boss, slapShoutLine
src/game/collision.ts          # Multi-table colliders
src/game/doorSystem.ts         # NEW ‚Ä?enter/exit intents (pure)
src/game/bossModules.ts        # NEW ‚Ä?mouth HP, resistance, rage, demote (pure)
src/game/npcFsm.ts             # createNpc(count), walking-to-door exit, role fields
src/game/skills.ts             # Route hits through resolveBossHit
src/game/store.ts              # Tick door + boss schedule; slap toast line
src/game/audio.ts              # Slap TTS at high rate
src/game/__tests__/doorSystem.test.ts
src/game/__tests__/bossModules.test.ts
src/scene/World.tsx            # Door + three tables
src/scene/Npcs.tsx             # Boss scale + mouth HP billboard
src/ui/Hud.tsx                 # Optional population / boss cue
README.md                      # Round 2 notes
```

---

### Task 1: Types + Round 2 config skeleton

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/config.ts`
- Test: `src/game/__tests__/configRound2.test.ts` (light sanity)

- [x] **Step 1: Extend types**

Add to `src/game/types.ts` (keep existing exports; append):

```ts
export type NpcRole = 'normal' | 'boss'

export type TableShape = 'round' | 'rect' | 'oval'

export interface TableDef {
  id: string
  shape: TableShape
  /** Center XZ */
  position: [number, number, number]
  /** For round: radius on XZ. For rect/oval: half extents x,z */
  half: { x: number; z: number }
  /** Visual Y top of tabletop */
  topY: number
}

export interface DoorConfig {
  position: [number, number, number]
  maxNpcs: number
  startNpcCount: number
  timedIntervalSec: number
  threatEnterBiasAbove: number
  threatExitBiasBelow: number
  idleExitSec: number
  plugins: {
    timedUnlockSec: number
    threatUnlockSec: number
    seatUnlockSec: number
  }
}

export interface BossConfig {
  intervalSec: number
  scale: number
  baseLoudness: number
  rageRadius: number
  resistanceWindowSec: number
  mouthHpByEra: [number, number, number] // early/mid/late boss windows
  moduleUnlockSec: { a: number; b: number; c: number }
}

// Extend NpcState:
//   role: NpcRole
//   scale: number
//   mouthHp: number
//   mouthHpMax: number
//   bossModules: { a: boolean; b: boolean; c: boolean }
//   comboHits: number
//   lastHitAt: number
//   raging: boolean
//   exiting: boolean  // walking to door to despawn
//   idleSince: number

// Extend GameConfig with:
//   tables: TableDef[]
//   door: DoorConfig
//   boss: BossConfig
//   slapShoutLine: string
// Keep seatPositions / foodSpots / npcCount but set npcCount === door.startNpcCount
// and seatPositions length === 10 aligned to three tables.
```

- [x] **Step 2: Write failing sanity test**

Create `src/game/__tests__/configRound2.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'

describe('round2 config', () => {
  it('has three tables and ten seats within door cap', () => {
    expect(CONFIG.tables).toHaveLength(3)
    expect(CONFIG.seatPositions).toHaveLength(10)
    expect(CONFIG.foodSpots.length).toBeGreaterThanOrEqual(10)
    expect(CONFIG.door.maxNpcs).toBe(10)
    expect(CONFIG.npcCount).toBe(CONFIG.door.startNpcCount)
    expect(CONFIG.boss.intervalSec).toBe(180)
    expect(CONFIG.slapShoutLine).toBe('Êìç‰Ω†Â¶?)
  })
})
```

- [x] **Step 3: Run test ‚Ä?expect FAIL**

Run: `npm test -- src/game/__tests__/configRound2.test.ts`

Expected: FAIL (missing `tables` / `door` / `boss` / `slapShoutLine`)

- [x] **Step 4: Minimal config implementation**

Update `CONFIG` in `src/game/config.ts`:

```ts
// Tables ‚Ä?triangular layout (north door)
tables: [
  { id: 't-round', shape: 'round', position: [-2.2, 0, -1.2], half: { x: 1.0, z: 1.0 }, topY: 0.75 },
  { id: 't-rect', shape: 'rect', position: [2.4, 0, -1.0], half: { x: 1.2, z: 0.7 }, topY: 0.75 },
  { id: 't-oval', shape: 'oval', position: [0.2, 0, 2.0], half: { x: 1.6, z: 0.65 }, topY: 0.75 },
],
door: {
  position: [0, 0, -4.35],
  maxNpcs: 10,
  startNpcCount: 3,
  timedIntervalSec: 16,
  threatEnterBiasAbove: 0.55,
  threatExitBiasBelow: 0.25,
  idleExitSec: 18,
  plugins: { timedUnlockSec: 0, threatUnlockSec: 60, seatUnlockSec: 180 },
},
boss: {
  intervalSec: 180,
  scale: 1.4,
  baseLoudness: 0.85,
  rageRadius: 4,
  resistanceWindowSec: 1.2,
  mouthHpByEra: [4, 6, 8],
  moduleUnlockSec: { a: 180, b: 360, c: 540 },
},
slapShoutLine: 'Êìç‰Ω†Â¶?,
npcCount: 3,
shoutLine: 'ÈÉΩ‰ªñÂ¶àÊääÂò¥Èó≠‰∏äÔºÅ',
// Rebuild seatPositions (10) around the three table centers ‚Ä?approaches outside each collider
// Rebuild foodSpots (10+) with plate positions on each tabletop
```

Also extend every `createNpcs` default field usage later; for this task only config + types.

Update `NpcState` creation sites temporarily: add defaults in `createNpcs` in Task 3/5 if compile breaks ‚Ä?prefer updating `createNpcs` now with:

```ts
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
```

- [x] **Step 5: Run test ‚Ä?expect PASS**

Run: `npm test -- src/game/__tests__/configRound2.test.ts`

- [x] **Step 6: Commit**

```bash
git add src/game/types.ts src/game/config.ts src/game/__tests__/configRound2.test.ts src/game/npcFsm.ts
git commit -m "feat: add Round 2 config for tables, door, and boss"
```

---

### Task 2: Multi-table collision

**Files:**
- Modify: `src/game/collision.ts`
- Modify: `src/game/npcFsm.ts` (perimeterSlide uses multi-table)
- Test: `src/game/__tests__/collision.test.ts`

- [x] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { resolveTablesCollision } from '../collision'

describe('resolveTablesCollision', () => {
  it('pushes a point out of the round table AABB/circle', () => {
    const tables = [
      { shape: 'round' as const, position: [-2.2, 0, -1.2] as [number, number, number], half: { x: 1, z: 1 } },
    ]
    const [x, z] = resolveTablesCollision(-2.2, -1.2, tables)
    expect(Math.hypot(x + 2.2, z + 1.2)).toBeGreaterThan(1)
  })

  it('leaves free space unchanged', () => {
    const tables = [
      { shape: 'rect' as const, position: [2.4, 0, -1] as [number, number, number], half: { x: 1.2, z: 0.7 } },
    ]
    const [x, z] = resolveTablesCollision(0, 0, tables)
    expect(x).toBe(0)
    expect(z).toBe(0)
  })
})
```

- [x] **Step 2: Run ‚Ä?expect FAIL**

Run: `npm test -- src/game/__tests__/collision.test.ts`

- [x] **Step 3: Implement**

In `collision.ts`:

```ts
export type TableCollider = {
  shape: 'round' | 'rect' | 'oval'
  position: [number, number, number]
  half: { x: number; z: number }
}

export function resolveTableShapeCollision(
  x: number,
  z: number,
  table: TableCollider,
  radius = CHAR_RADIUS,
): [number, number] {
  const cx = table.position[0]
  const cz = table.position[2]
  const lx = x - cx
  const lz = z - cz
  if (table.shape === 'round') {
    const r = Math.max(table.half.x, table.half.z) + radius
    const d = Math.hypot(lx, lz)
    if (d < r && d > 1e-6) {
      return [cx + (lx / d) * r, cz + (lz / d) * r]
    }
    if (d <= 1e-6) return [cx + r, cz]
    return [x, z]
  }
  // rect + oval: treat as AABB (oval visually elongated; collision AABB is fine for v2)
  const hx = table.half.x + radius
  const hz = table.half.z + radius
  if (Math.abs(lx) <= hx && Math.abs(lz) <= hz) {
    const dx = hx - Math.abs(lx)
    const dz = hz - Math.abs(lz)
    if (dx < dz) return [cx + Math.sign(lx || 1) * hx, z]
    return [x, cz + Math.sign(lz || 1) * hz]
  }
  return [x, z]
}

export function resolveTablesCollision(
  x: number,
  z: number,
  tables: TableCollider[],
  radius = CHAR_RADIUS,
): [number, number] {
  let nx = x
  let nz = z
  for (const t of tables) {
    ;[nx, nz] = resolveTableShapeCollision(nx, nz, t, radius)
  }
  return [nx, nz]
}
```

Update `moveWithCollision` to use `CONFIG.tables` via `resolveTablesCollision` (import CONFIG or pass tables). Prefer passing tables from callers to keep collision pure ‚Ä?update `moveWithCollision` signature:

```ts
export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  tables: TableCollider[],
): [number, number] {
  let nx = x + dx
  let nz = z + dz
  ;[nx, nz] = resolveTablesCollision(nx, nz, tables)
  return clampRoom(nx, nz)
}
```

Keep deprecated `resolveTableCollision` wrapping a single synthetic rect **or** delete and fix all call sites (`npcFsm`, `World` player move) to pass `CONFIG.tables`.

Update `perimeterSlide` to slide around nearest table center using that table's half extents.

- [x] **Step 4: Run tests PASS + existing suite**

Run: `npm test`

- [x] **Step 5: Commit**

```bash
git add src/game/collision.ts src/game/npcFsm.ts src/scene/World.tsx src/game/__tests__/collision.test.ts
git commit -m "feat: collide against three dining tables"
```

---

### Task 3: Door system (pure) ‚Ä?TDD

**Files:**
- Create: `src/game/doorSystem.ts`
- Create: `src/game/__tests__/doorSystem.test.ts`

- [x] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { activeDoorPlugins, planDoorAction } from '../doorSystem'
import { CONFIG } from '../config'
import type { NpcState } from '../types'

function stubNpc(partial: Partial<NpcState> & { id: string }): NpcState {
  return {
    status: 'idle',
    statusUntil: 0,
    seatIndex: 0,
    position: [0, 0, 0],
    facing: 0,
    baseLoudness: 0.4,
    sealProp: null,
    foodId: null,
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
    idleSince: 0,
    ...partial,
  }
}

describe('doorSystem', () => {
  it('unlocks plugins by elapsed time', () => {
    expect(activeDoorPlugins(0).timed).toBe(true)
    expect(activeDoorPlugins(0).threat).toBe(false)
    expect(activeDoorPlugins(60).threat).toBe(true)
    expect(activeDoorPlugins(180).seat).toBe(true)
  })

  it('never plans enter when at cap 10', () => {
    const npcs = Array.from({ length: 10 }, (_, i) => stubNpc({ id: `n${i}` }))
    const action = planDoorAction({
      npcs,
      elapsedSec: 10,
      now: 10_000,
      threat: 0.9,
      lastDoorEventAt: 0,
      occupiedSeatIndexes: new Set([0,1,2,3,4,5,6,7,8,9]),
    })
    expect(action?.type === 'enter').toBe(false)
  })

  it('boss-inclusive cap: 9 normals + boss blocks enter', () => {
    const npcs = [
      ...Array.from({ length: 9 }, (_, i) => stubNpc({ id: `n${i}` })),
      stubNpc({ id: 'boss', role: 'boss' }),
    ]
    const action = planDoorAction({
      npcs,
      elapsedSec: 200,
      now: 200_000,
      threat: 0.1,
      lastDoorEventAt: 0,
      occupiedSeatIndexes: new Set(npcs.map((n) => n.seatIndex)),
    })
    expect(action?.type).not.toBe('enter')
  })
})
```

- [x] **Step 2: Run ‚Ä?FAIL**

Run: `npm test -- src/game/__tests__/doorSystem.test.ts`

- [x] **Step 3: Implement `doorSystem.ts`**

```ts
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
  | { type: 'evict'; npcId: string } // immediate mark exiting (for boss intake)

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
    return 3 // smacking last
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
      // mid-game without seat plugin: still require a free seat index if any seat unused
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
```

- [x] **Step 4: Tests PASS**

Run: `npm test -- src/game/__tests__/doorSystem.test.ts`

- [x] **Step 5: Commit**

```bash
git add src/game/doorSystem.ts src/game/__tests__/doorSystem.test.ts
git commit -m "feat: add door population planning logic"
```

---

### Task 4: Boss modules (pure) ‚Ä?TDD

**Files:**
- Create: `src/game/bossModules.ts`
- Create: `src/game/__tests__/bossModules.test.ts`

- [x] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  modulesForElapsed,
  mouthHpForElapsed,
  resolveBossHit,
  demoteBoss,
  tickBossRage,
} from '../bossModules'
import type { NpcState } from '../types'

function boss(partial: Partial<NpcState> = {}): NpcState {
  return {
    id: 'boss',
    status: 'smacking',
    statusUntil: 999999,
    seatIndex: 0,
    position: [0, 0, 0],
    facing: 0,
    baseLoudness: 0.85,
    sealProp: null,
    foodId: null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'boss',
    scale: 1.4,
    mouthHp: 4,
    mouthHpMax: 4,
    bossModules: { a: true, b: false, c: false },
    comboHits: 0,
    lastHitAt: 0,
    raging: false,
    exiting: false,
    idleSince: 0,
    ...partial,
  }
}

describe('bossModules', () => {
  it('stacks modules by time', () => {
    expect(modulesForElapsed(180)).toEqual({ a: true, b: false, c: false })
    expect(modulesForElapsed(360)).toEqual({ a: true, b: true, c: false })
    expect(modulesForElapsed(540)).toEqual({ a: true, b: true, c: true })
  })

  it('chips mouth HP and only silences at 0', () => {
    const r1 = resolveBossHit(boss({ mouthHp: 2 }), 'silenced', 1.2, 1000, null)
    expect(r1.npc.mouthHp).toBe(1)
    expect(r1.npc.status).toBe('smacking')
    expect(r1.demoted).toBe(false)

    const r2 = resolveBossHit(r1.npc, 'silenced', 1.2, 2000, null)
    expect(r2.npc.mouthHp).toBe(0)
    expect(r2.npc.status).toBe('silenced')
    expect(r2.demoted).toBe(true)
    expect(r2.npc.role).toBe('normal')
  })

  it('rage clears seals on nearby npcs', () => {
    const b = boss({
      mouthHp: 1,
      mouthHpMax: 4,
      bossModules: { a: true, b: true, c: true },
      raging: true,
      position: [0, 0, 0],
    })
    const other: NpcState = {
      ...boss({ id: 'n1', role: 'normal', scale: 1, mouthHp: 0, mouthHpMax: 0 }),
      status: 'sealed',
      sealProp: 'tape',
      position: [1, 0, 0],
      bossModules: { a: false, b: false, c: false },
    }
    const { boss: b2, npcs } = tickBossRage(b, [b, other], 5000)
    expect(b2.raging).toBe(true)
    expect(npcs.find((n) => n.id === 'n1')?.status).not.toBe('sealed')
  })
})
```

- [x] **Step 2: Run ‚Ä?FAIL**

- [x] **Step 3: Implement `bossModules.ts`**

```ts
import { CONFIG } from './config'
import { applySilence } from './npcFsm'
import { distance3 } from './threat'
import type { NpcState, SealProp } from './types'

export function modulesForElapsed(elapsedSec: number) {
  const u = CONFIG.boss.moduleUnlockSec
  return {
    a: elapsedSec >= u.a,
    b: elapsedSec >= u.b,
    c: elapsedSec >= u.c,
  }
}

export function mouthHpForElapsed(elapsedSec: number): number {
  const mods = modulesForElapsed(elapsedSec)
  if (mods.c) return CONFIG.boss.mouthHpByEra[2]
  if (mods.b) return CONFIG.boss.mouthHpByEra[1]
  return CONFIG.boss.mouthHpByEra[0]
}

export function createBossNpc(
  seatIndex: number,
  now: number,
  elapsedSec: number,
  id: string,
): NpcState {
  const mods = modulesForElapsed(elapsedSec)
  const hp = mouthHpForElapsed(elapsedSec)
  const seat = CONFIG.seatPositions[seatIndex]
  return {
    id,
    status: 'walking',
    statusUntil: now + 8000,
    seatIndex,
    position: [...CONFIG.door.position] as [number, number, number],
    facing: 0,
    baseLoudness: CONFIG.boss.baseLoudness,
    sealProp: null,
    foodId: CONFIG.foodSpots[seatIndex % CONFIG.foodSpots.length]?.id ?? null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'boss',
    scale: CONFIG.boss.scale,
    mouthHp: hp,
    mouthHpMax: hp,
    bossModules: mods,
    comboHits: 0,
    lastHitAt: 0,
    raging: false,
    exiting: false,
    idleSince: now,
  }
}

export function resolveBossHit(
  npc: NpcState,
  applyStatus: 'silenced' | 'sealed',
  durationSec: number,
  now: number,
  sealProp: SealProp,
  attackerPos?: [number, number, number],
  others: { x: number; z: number }[] = [],
): { npc: NpcState; demoted: boolean } {
  if (npc.role !== 'boss') {
    return {
      npc: applySilence(npc, applyStatus, durationSec, now, sealProp, attackerPos, others),
      demoted: false,
    }
  }

  let next = { ...npc }
  let duration = durationSec

  if (next.bossModules.a && next.mouthHp > 0) {
    next.mouthHp = Math.max(0, next.mouthHp - 1)
  }

  if (next.bossModules.b) {
    if (now - next.lastHitAt <= CONFIG.boss.resistanceWindowSec * 1000) {
      next.comboHits += 1
    } else {
      next.comboHits = 1
    }
    next.lastHitAt = now
    if (next.comboHits < 2) duration = Math.min(duration, 0.35)
  }

  if (next.bossModules.a && next.mouthHp > 0) {
    // Chip only ‚Ä?stay smacking / resume
    next.status = 'smacking'
    next.statusUntil = now + 2000
    next.wobbleUntil = now + 400
    return { npc: next, demoted: false }
  }

  // HP emptied (or module A off): apply silence and demote
  let silenced = applySilence(next, applyStatus, duration, now, sealProp, attackerPos, others)
  silenced = demoteBoss(silenced)
  return { npc: silenced, demoted: true }
}

export function demoteBoss(npc: NpcState): NpcState {
  if (npc.role !== 'boss') return npc
  return {
    ...npc,
    role: 'normal',
    scale: 1,
    mouthHp: 0,
    mouthHpMax: 0,
    bossModules: { a: false, b: false, c: false },
    comboHits: 0,
    raging: false,
    baseLoudness: 0.4 + (npc.seatIndex % 5) * 0.05,
  }
}

export function tickBossRage(
  bossNpc: NpcState,
  npcs: NpcState[],
  now: number,
): { boss: NpcState; npcs: NpcState[] } {
  if (bossNpc.role !== 'boss' || !bossNpc.bossModules.c) {
    return { boss: bossNpc, npcs }
  }
  const half = bossNpc.mouthHpMax * 0.5
  const raging = bossNpc.mouthHp <= half && bossNpc.mouthHp > 0
  let boss = { ...bossNpc, raging }
  if (!raging) return { boss, npcs }

  const next = npcs.map((n) => {
    if (n.id === boss.id) return n
    if (distance3(n.position, boss.position) > CONFIG.boss.rageRadius) return n
    let o = { ...n }
    if (o.status === 'sealed' || o.sealProp) {
      o.status = 'idle'
      o.sealProp = null
      o.statusUntil = now + 400
    }
    if (o.status === 'idle' || o.status === 'silenced') {
      o.status = 'smacking'
      o.statusUntil = now + 2500
    }
    return o
  })
  return { boss, npcs: next.map((n) => (n.id === boss.id ? boss : n)) }
}
```

- [x] **Step 4: Tests PASS**

- [x] **Step 5: Commit**

```bash
git add src/game/bossModules.ts src/game/__tests__/bossModules.test.ts
git commit -m "feat: add boss mouth HP, resistance, and rage modules"
```

---

### Task 5: Wire skills through boss hit + slap shout hook

**Files:**
- Modify: `src/game/skills.ts`
- Modify: `src/game/audio.ts`
- Modify: `src/game/__tests__/skills.test.ts`
- Create: `src/game/__tests__/slapShout.test.ts` (pure hook)

- [x] **Step 1: Change `tryUseSkill` to use `resolveBossHit` instead of raw `applySilence`**

In both AoE and single-target branches, replace `applySilence(...)` with:

```ts
import { resolveBossHit } from './bossModules'

const { npc: hitNpc } = resolveBossHit(
  npc,
  skill.applyStatus,
  duration,
  now,
  sealProp,
  playerPos,
  others,
)
return hitNpc
```

For AoE, `sealProp` stays `null` unless you pass tape/gag only on single target (current behavior).

- [x] **Step 2: Slap shout ‚Ä?extend `playSkill`**

```ts
import { CONFIG } from './config'

case 'slap':
  burstNoise(0.06, 0.35, 2200)
  beep(320, 0.06, 'square', 0.16)
  beep(180, 0.1, 'triangle', 0.1)
  playShoutVoice(CONFIG.slapShoutLine, 2.6) // faster rate; windup unchanged
  break
```

Update `playShoutVoice`:

```ts
export function playShoutVoice(line = CONFIG.shoutLine, rate = 1.45) {
  // ... existing ...
  u.rate = rate
  // ...
}
```

Export a tiny pure helper for tests:

```ts
// src/game/slapShout.ts
import { CONFIG } from './config'
export function slapShoutLine(): string {
  return CONFIG.slapShoutLine
}
```

Test:

```ts
import { describe, expect, it } from 'vitest'
import { slapShoutLine } from '../slapShout'
it('uses Êìç‰Ω†Â¶?, () => expect(slapShoutLine()).toBe('Êìç‰Ω†Â¶?))
```

- [x] **Step 3: Run `npm test` ‚Ä?fix skills tests if they assume immediate silence on all NPCs**

- [x] **Step 4: Commit**

```bash
git add src/game/skills.ts src/game/audio.ts src/game/slapShout.ts src/game/__tests__/slapShout.test.ts src/game/__tests__/skills.test.ts
git commit -m "feat: route skill hits through boss modules; slap shouts Êìç‰Ω†Â¶?
```

---

### Task 6: Store ‚Ä?door tick + boss every 180s

**Files:**
- Modify: `src/game/store.ts`
- Modify: `src/game/npcFsm.ts` (`createNpcAtSeat`, exit walking, despawn filter)
- Test: extend door/boss tests or add `src/game/__tests__/storeRound2.test.ts` for spawn helpers only (prefer testing helpers extracted from store)

Extract helpers into `doorSystem.ts` / `bossModules.ts` already done; add:

```ts
// doorSystem.ts
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
        ? { ...n, exiting: true, status: 'walking', foodId: null, statusUntil: now + 6000 }
        : n,
    )
  }
  return npcs
}
```

`createNormalFromDoor`: spawn at `CONFIG.door.position`, assign seat, `role: 'normal'`.

In `tickNpcs`: if `exiting`, walk toward door; when close (`dist < 0.45`), mark with a flag or return id for store to filter out.

Cleaner: `tickNpcs` returns `{ npcs, despawnIds: string[] }` ‚Ä?**breaking change**. Minimal alternative: set `status: 'idle'` and `foodId: '__DESPAWN__'` sentinel ‚Ä?avoid. Prefer return tuple:

```ts
export function tickNpcs(...): { npcs: NpcState[]; despawnIds: string[] }
```

Update all call sites + tests.

Store `tick` additions:

```ts
let lastDoorEventAt = /* store field, reset on beginMission */
let nextBossAtElapsed = CONFIG.boss.intervalSec
let npcSeq = 0

// after tickNpcs:
npcs = npcs.filter((n) => !despawnIds.includes(n.id))

// boss schedule
if (elapsedSec >= nextBossAtElapsed) {
  nextBossAtElapsed += CONFIG.boss.intervalSec
  if (!npcs.some((n) => n.role === 'boss')) {
    const admission = planBossAdmission(npcs)
    if (admission) npcs = applyDoorAction(npcs, admission, now, () => `npc-${++npcSeq}`)
    // after eviction marked, if still at cap wait next ticks; else spawn boss into free seat
    const occupied = new Set(npcs.map((n) => n.seatIndex))
    const free = freeSeatIndexes(occupied)
    if (free.length && npcs.length < CONFIG.door.maxNpcs) {
      npcs = [...npcs, createBossNpc(free[0], now, elapsedSec, `boss-${npcSeq++}`)]
      lastDoorEventAt = now
    }
  }
}

// normal door
const occupied = new Set(npcs.map((n) => n.seatIndex))
const action = planDoorAction({ npcs, elapsedSec, now, threat, lastDoorEventAt, occupiedSeatIndexes: occupied })
if (action) {
  npcs = applyDoorAction(npcs, action, now, () => `npc-${++npcSeq}`)
  lastDoorEventAt = now
}

// rage
const boss = npcs.find((n) => n.role === 'boss')
if (boss) {
  const r = tickBossRage(boss, npcs, now)
  npcs = r.npcs
}
```

Add store fields: `lastDoorEventAt`, `nextBossAtElapsed`, reset in `beginMission` / `start`.

Slap toast on windup start:

```ts
text: skillId === 'slap' ? CONFIG.slapShoutLine : skillId === 'megaphone' ? CONFIG.shoutLine : ...
```

- [x] **Step 1: Update `tickNpcs` signature + tests**

- [x] **Step 2: Wire store**

- [x] **Step 3: `npm test` PASS**

- [x] **Step 4: Commit**

```bash
git add src/game/store.ts src/game/npcFsm.ts src/game/doorSystem.ts src/game/__tests__/npcFsm.test.ts
git commit -m "feat: tick door traffic and periodic boss spawns"
```

---

### Task 7: Scene ‚Ä?three tables + door

**Files:**
- Modify: `src/scene/World.tsx`

- [x] **Step 1: Replace single `Table()` with `Tables()`**

```tsx
export function Tables() {
  return (
    <group>
      {CONFIG.tables.map((t) => (
        <group key={t.id} position={t.position}>
          {t.shape === 'round' && (
            <mesh position={[0, t.topY, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[t.half.x, t.half.x, 0.12, 24]} />
              <meshStandardMaterial color="#5c3d2e" />
            </mesh>
          )}
          {t.shape === 'rect' && (
            <mesh position={[0, t.topY, 0]} castShadow receiveShadow>
              <boxGeometry args={[t.half.x * 2, 0.12, t.half.z * 2]} />
              <meshStandardMaterial color="#4a3728" />
            </mesh>
          )}
          {t.shape === 'oval' && (
            <mesh position={[0, t.topY, 0]} castShadow receiveShadow scale={[1, 1, t.half.z / t.half.x]}>
              <cylinderGeometry args={[t.half.x, t.half.x, 0.12, 24]} />
              <meshStandardMaterial color="#6a4530" />
            </mesh>
          )}
          {/* 4 simple legs per table */}
        </group>
      ))}
      {CONFIG.foodSpots.map(/* existing plate visuals at absolute plate coords */)}
    </group>
  )
}

export function Door() {
  const p = CONFIG.door.position
  return (
    <group position={[p[0], 0, p[2]]}>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[1.2, 2.2, 0.12]} />
        <meshStandardMaterial color="#a67c52" />
      </mesh>
    </group>
  )
}
```

North wall: leave a visual gap or keep wall and put door flush inside (`z ‚â?-4.7`).

Update `Room` / player spawn if needed (`playerPos` near oval table).

- [x] **Step 2: Manual smoke ‚Ä?`npm run dev`** (agent: `npm run build` must pass)

- [x] **Step 3: Commit**

```bash
git add src/scene/World.tsx
git commit -m "feat: render door and three shaped tables"
```

---

### Task 8: NPC visuals ‚Ä?boss scale + mouth HP

**Files:**
- Modify: `src/scene/Npcs.tsx`

- [x] **Step 1: Scale root group by `npc.scale`**

- [x] **Step 2: If `role === 'boss' && bossModules.a`, Billboard HP bar**

```tsx
{npc.role === 'boss' && npc.bossModules.a && (
  <Billboard position={[0, 2.2, 0]}>
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[1.2, 0.12]} />
      <meshBasicMaterial color="#222" />
    </mesh>
    <mesh position={[-(1.2 - 1.2 * (npc.mouthHp / npc.mouthHpMax)) / 2, 0, 0.01]}>
      <planeGeometry args={[1.2 * (npc.mouthHp / Math.max(1, npc.mouthHpMax)), 0.1]} />
      <meshBasicMaterial color={npc.raging ? '#c44' : '#d4a017'} />
    </mesh>
  </Billboard>
)}
```

- [x] **Step 3: Commit**

```bash
git add src/scene/Npcs.tsx
git commit -m "feat: show boss size and mouth HP bar"
```

---

### Task 9: HUD + README polish

**Files:**
- Modify: `src/ui/Hud.tsx` ‚Ä?show `npcs.length / 10`; boss present cue
- Modify: `README.md` ‚Ä?Round 2 bullets + slap line note
- Modify: `docs/superpowers/specs/2026-07-13-civic-man-round2-design.md` ‚Ä?Status: Approved

- [x] **Step 1: Small HUD population text**

- [x] **Step 2: README**

- [x] **Step 3: `npm test` && `npm run build`**

Expected: all tests pass; build succeeds

- [x] **Step 4: Commit**

```bash
git add src/ui/Hud.tsx README.md docs/superpowers/specs/2026-07-13-civic-man-round2-design.md
git commit -m "docs: note Round 2 door, boss, and slap shout"
```

---

### Task 10: Final verification against success criteria

- [x] **Step 1: Checklist (manual / automated)**

| Spec criterion | How verified |
|----------------|--------------|
| Door + 3 table shapes | Visual in dev / World code |
| Cap 10 incl boss | `doorSystem` tests |
| Plugins unlock over time | `activeDoorPlugins` tests |
| Boss every 3 min, max 1, larger, modules, rage | `bossModules` + store wiring |
| Demote to normal | `resolveBossHit` demote test |
| Slap„ÄåÊìç‰Ω†Â¶à„ÄçSFX, no windup change | `slapShout` test + `CONFIG.skills.slap.windup` unchanged |
| Unit tests | `npm test` |

- [x] **Step 2: Commit any fixes**

---

## Self-review (plan vs spec)

| Spec section | Task |
|--------------|------|
| Scene 3 tables + door | 1, 2, 7 |
| Door plugins timed/threat/seat | 3, 6 |
| Cap 10 includes boss | 3, 6 |
| Boss every 180s, max 1, scale 1.4 | 4, 6, 8 |
| Modules A/B/C stack | 4 |
| Rage SyncSmack + UnsealPulse | 4 `tickBossRage` |
| Demote on mouth HP 0 | 4 |
| Slap SFX only | 5 |
| Out of scope (QTE, multi-boss) | Not planned |

No TBD placeholders. Names consistent: `resolveBossHit`, `planDoorAction`, `createBossNpc`, `slapShoutLine`.
