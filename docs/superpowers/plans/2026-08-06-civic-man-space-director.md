# Civic Man Space Director — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multi-room / morph SpaceDirector, room-gated acoustics, chase NPCs with slap knockback, Space-hold hide/latch, and Three.js atmosphere (lights, smacker fog, character polish, light postprocessing) per the approved spec.

**Architecture:** Pure modules (`acoustics.ts`, `spaceDirector.ts`, `chaser.ts`, `hideLatch.ts`) own rules and stay Vitest-covered; `store.ts` ticks them; R3F scene reads layout/hide/chase state for colliders, lights, fog, and animations. No new texture assets; optional `@react-three/postprocessing` for Bloom/Vignette/Outline.

**Tech Stack:** Vite, React 19, TypeScript, R3F, drei, Three.js, Zustand, Vitest; add `@react-three/postprocessing` in Task 10.

**Spec:** `docs/superpowers/specs/2026-08-06-civic-man-space-director-design.md`

## Global Constraints

- No new image textures / material maps — color, roughness/metalness, lights, fog, primitives, animation, postprocessing only.
- No tower placement, coin economy, or auto-fire weapons.
- Knockback displacement applies to **chasers / non-seated only**; seated diners get silence/status only.
- Hide: Space **hold** near table/cabinet; exit on **move**; cannot enter hide in chaser face radius or mid-air.
- Latch: Space **hold** near door; table/cabinet context beats door; auto-unlatch after duration.
- SpaceEvent #1 only after Boss #1 demote has settled (~0.5–1s).
- Chasers count toward `maxNpcs` but do not take seats; `seated ≤ maxNpcs - chaserCount`.
- Fog/outline must keep chew billboards and target Outline readable.
- Match existing patterns in `threat.ts`, `doorSystem.ts`, `npcFsm.ts`, `store.ts` tick.

---

## File structure

```
src/game/types.ts              # +NpcRole 'chaser', roomId, layout/space types, hide state fields
src/game/config.ts             # +acoustics, spaceDirector, chaser, hideLatch knobs
src/game/acoustics.ts          # NEW — roomGate, openingFactor, floorFactor, computeHeardLoudness
src/game/spaceLayout.ts        # NEW — rooms, openings, floors, seats/tables registries, playerRoomId
src/game/spaceDirector.ts      # NEW — pickEvent, cooldown, apply event pure reducers
src/game/chaser.ts             # NEW — spawn gates, pursue AI step, face radius, stagger
src/game/hideLatch.ts          # NEW — hold detect, enter/exit hide, latch timers
src/game/threat.ts             # wire acoustics into computeThreat
src/game/skills.ts             # slap/AoE knockback targeting rules for chasers
src/game/doorSystem.ts         # maxNpcs vs seats after layout change; chaser budget
src/game/store.ts              # tick SpaceDirector, chaser, hide/latch; boss#1 hook
src/game/collision.ts          # optional knockback helpers reuse
src/game/i18n.ts               # space event / hide / chase strings
src/scene/World.tsx            # dynamic walls/doors/stairs; lights; player hide pose
src/scene/Npcs.tsx             # chaser visuals + pursuit marker; richer diner detail
src/scene/GameCanvas.tsx       # fog uniforms / postprocessing composer
src/scene/Atmosphere.tsx       # NEW — threat lights, smacker fog, bloom/vignette/outline
src/scene/SpaceFx.tsx          # NEW — SpaceEvent tweens
src/ui/TouchControls.tsx       # jump button long-press → hide/latch
src/ui/Hud.tsx                 # optional space-event toast
src/game/__tests__/acoustics.test.ts
src/game/__tests__/spaceDirector.test.ts
src/game/__tests__/chaser.test.ts
src/game/__tests__/hideLatch.test.ts
src/game/__tests__/threat.test.ts   # extend for roomGate
```

**Execution order:** Tasks 1→10. Each task ends testable. Visuals (9–10) can start after Task 2 types exist but should not block logic merges.

---

### Task 1: Types + CONFIG knobs

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/config.ts`
- Test: (covered by later module tests importing CONFIG)

**Interfaces:**
- Produces: `NpcRole = 'normal' | 'boss' | 'chaser'`; `RoomId`; `SpaceEventKind`; layout-related types; CONFIG subsections `acoustics`, `space`, `chaser`, `hideLatch`

- [ ] **Step 1: Extend roles and NPC fields**

In `types.ts`, change:

```ts
export type NpcRole = 'normal' | 'boss' | 'chaser'

export type RoomId = string

export interface NpcState {
  // ...existing fields...
  role: NpcRole
  roomId: RoomId
  /** Chaser: cannot face-smack until this time */
  staggerUntil: number
  /** Chaser AI target player pursuit */
  chaseTarget: boolean
}
```

Add layout types:

```ts
export interface SpaceOpening {
  id: string
  fromRoom: RoomId
  toRoom: RoomId
  /** World position of door center */
  position: [number, number, number]
  latchedUntil: number
}

export interface SpaceRoom {
  id: RoomId
  /** AABB-ish bounds for membership tests (y ignored or floor band) */
  min: [number, number]
  max: [number, number]
  floor: number
}

export type SpaceEventId = 'A1' | 'A2' | 'A3' | 'A4' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5'

export interface SpaceEventDef {
  id: SpaceEventId
  kind: 'A' | 'C'
  inFirstRewardPool: boolean
  weightLate: number
}
```

- [ ] **Step 2: Add CONFIG knobs**

In `config.ts` (and `GameConfig` in types if needed):

```ts
acoustics: {
  roomGateNeighbor: 0.3,
  roomGateFar: 0.1,
  floorFactorSameRoom: 0.8,
  closedDoorMute: 0.5, // multiplies neighbor gate further when latched
},
space: {
  eventCooldownSec: 120,
  eventCooldownMinSec: 90,
  firstEventDelayAfterBossDemoteMs: 800,
  minorMorphMaxBetweenBosses: 1,
},
chaser: {
  faceRadius: 1.2,
  maxCountLate: 2,
  knockbackDist: 2.2,
  staggerSec: 0.8,
  baseLoudness: 0.9,
  walkSpeed: 2.4,
  neighborThreatShareToSpawn: 0.45,
},
hideLatch: {
  holdSec: 0.4,
  latchDurationSec: 6,
  searchEscalateSec: 8,
  interactRadius: 1.35,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts src/game/config.ts
git commit -m "feat(space): add types and CONFIG knobs for Space Director"
```

---

### Task 2: Acoustics module + threat wiring

**Files:**
- Create: `src/game/acoustics.ts`
- Modify: `src/game/threat.ts`
- Modify: `src/game/__tests__/threat.test.ts`
- Create: `src/game/__tests__/acoustics.test.ts`

**Interfaces:**
- Consumes: CONFIG.acoustics; `RoomId`; openings latch state
- Produces:
  - `roomGate(playerRoom: RoomId, npcRoom: RoomId, hopDistance: number): number`
  - `openingFactor(latchedOnPath: boolean): number`
  - `floorFactor(sameRoom: boolean, sameFloor: boolean): number`
  - `computeThreat(..., ctx: { playerRoomId, getNpcRoom, openings })` extended

- [ ] **Step 1: Write failing acoustics tests**

```ts
// src/game/__tests__/acoustics.test.ts
import { describe, expect, it } from 'vitest'
import { floorFactor, openingFactor, roomGate } from '../acoustics'
import { CONFIG } from '../config'

describe('acoustics', () => {
  it('same room gate is 1', () => {
    expect(roomGate('r0', 'r0', 0)).toBe(1)
  })

  it('neighbor hop uses neighbor gate', () => {
    expect(roomGate('r0', 'r1', 1)).toBeCloseTo(CONFIG.acoustics.roomGateNeighbor)
  })

  it('far hop uses far gate', () => {
    expect(roomGate('r0', 'r2', 2)).toBeCloseTo(CONFIG.acoustics.roomGateFar)
  })

  it('closed door further mutes', () => {
    expect(openingFactor(true)).toBeLessThan(openingFactor(false))
  })

  it('cross-floor same room muffles slightly', () => {
    expect(floorFactor(true, false)).toBeCloseTo(CONFIG.acoustics.floorFactorSameRoom)
    expect(floorFactor(true, true)).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/game/__tests__/acoustics.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `acoustics.ts`**

```ts
import { CONFIG } from './config'
import type { RoomId } from './types'

export function roomGate(playerRoom: RoomId, npcRoom: RoomId, hopDistance: number): number {
  if (playerRoom === npcRoom) return 1
  if (hopDistance <= 1) return CONFIG.acoustics.roomGateNeighbor
  return CONFIG.acoustics.roomGateFar
}

export function openingFactor(latchedOnPath: boolean): number {
  return latchedOnPath ? CONFIG.acoustics.closedDoorMute : 1
}

export function floorFactor(sameRoom: boolean, sameFloor: boolean): number {
  if (!sameRoom) return 1
  return sameFloor ? 1 : CONFIG.acoustics.floorFactorSameRoom
}
```

- [ ] **Step 4: Extend `computeThreat`**

Add optional context (default keeps old behavior for single room `r0`):

```ts
export type ThreatAcousticsCtx = {
  playerRoomId: RoomId
  npcRoomId: (npc: NpcState) => RoomId
  npcFloor: (npc: NpcState) => number
  playerFloor: number
  /** graph hops player→npc; 0 if same */
  hopDistance: (npcRoom: RoomId) => number
  latchedOnPath: (npcRoom: RoomId) => boolean
  /** chaser in face radius ignores room mute */
  ignoreRoomGate?: (npc: NpcState) => boolean
}

// inside loop, after distanceAttenuation:
let gate = 1
if (ctx) {
  if (ctx.ignoreRoomGate?.(npc)) {
    gate = 1
  } else {
    const nr = ctx.npcRoomId(npc)
    gate =
      roomGate(ctx.playerRoomId, nr, ctx.hopDistance(nr)) *
      openingFactor(ctx.latchedOnPath(nr)) *
      floorFactor(ctx.playerRoomId === nr, ctx.npcFloor(npc) === ctx.playerFloor)
  }
}
sum += effectiveLoudness * distanceAttenuation(d) * gate
```

- [ ] **Step 5: Add threat test — neighbor quieter than same room**

```ts
it('neighbor room contributes less than same room at equal distance', () => {
  // stub two npcs same loudness/dist; assert threat_same > threat_neighbor
})
```

- [ ] **Step 6: Run `npm test` — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add src/game/acoustics.ts src/game/threat.ts src/game/__tests__/acoustics.test.ts src/game/__tests__/threat.test.ts
git commit -m "feat(space): room-gated acoustics for threat"
```

---

### Task 3: Space layout registry + player room membership

**Files:**
- Create: `src/game/spaceLayout.ts`
- Create: `src/game/__tests__/spaceLayout.test.ts`
- Modify: `src/game/store.ts` (init default one-room layout; track `playerRoomId`)

**Interfaces:**
- Produces:
  - `createInitialLayout(): SpaceLayoutState`
  - `roomIdAt(layout, x, z, floor): RoomId`
  - `hopDistance(layout, a, b): number`
  - `latchedOnPath(layout, from, to, now): boolean`

- [ ] **Step 1: Failing tests for membership + hops**

```ts
it('default layout is single room r0 covering spawn', () => {
  const L = createInitialLayout()
  expect(roomIdAt(L, 0, 0, 0)).toBe('r0')
})

it('after adding adjacent room, hopDistance is 1', () => {
  const L = addRoomConnected(createInitialLayout(), { id: 'r1', /* bounds */ }, 'door-0')
  expect(hopDistance(L, 'r0', 'r1')).toBe(1)
})
```

- [ ] **Step 2: Implement minimal `spaceLayout.ts`** — rooms map, openings array, BFS hopDistance, AABB `roomIdAt` (highest floor whose AABB contains xz if overlapping).

- [ ] **Step 3: Store holds `layout` + derives `playerRoomId` each tick from `playerPos`.

- [ ] **Step 4: Wire `computeThreat` ctx from layout.**

- [ ] **Step 5: `npm test` PASS + commit**

```bash
git commit -m "feat(space): layout registry and player room membership"
```

---

### Task 4: SpaceDirector (pick + cooldown + Boss#1 hook)

**Files:**
- Create: `src/game/spaceDirector.ts`
- Create: `src/game/__tests__/spaceDirector.test.ts`
- Modify: `src/game/store.ts` (on first boss demote → schedule event; cooldown)

**Interfaces:**
- Produces:
  - `EVENTS: SpaceEventDef[]`
  - `pickSpaceEvent(rng, opts: { isFirst: boolean; late: boolean }): SpaceEventId`
  - `canFireSpaceEvent(state, now): boolean`
  - `scheduleFirstReward(demotedAtMs): number` // fireAt

- [ ] **Step 1: Failing tests**

```ts
it('first reward only picks inFirstRewardPool ids', () => {
  for (let i = 0; i < 50; i++) {
    const id = pickSpaceEvent(() => Math.random(), { isFirst: true, late: false })
    expect(EVENTS.find(e => e.id === id)!.inFirstRewardPool).toBe(true)
  }
})

it('respects cooldown', () => {
  expect(canFireSpaceEvent({ lastSpaceEventAt: 0, now: 50_000, cooldownSec: 120 }, 50_000)).toBe(false)
  expect(canFireSpaceEvent({ lastSpaceEventAt: 0, now: 130_000, cooldownSec: 120 }, 130_000)).toBe(true)
})
```

- [ ] **Step 2: Implement picker + cooldown helpers**

- [ ] **Step 3: In store, when boss demotes and `bossesCleared === 1` first time, set `pendingSpaceEventAt = now + CONFIG.space.firstEventDelayAfterBossDemoteMs`**

- [ ] **Step 4: Later bosses / cooldown path sets pending major; track `minorMorphsSinceBoss` for C5 cap**

- [ ] **Step 5: Tests PASS + commit**

```bash
git commit -m "feat(space): SpaceDirector pick, cooldown, first Boss reward hook"
```

---

### Task 5: Apply SpaceEvents to layout (A1/C1/C3/C5 first; others stubs OK)

**Files:**
- Modify: `src/game/spaceDirector.ts` or `src/game/spaceApply.ts` (prefer `spaceApply.ts`)
- Create: `src/game/__tests__/spaceApply.test.ts`
- Modify: `src/game/doorSystem.ts` / store seat arrays when tables added
- Modify: `src/scene/World.tsx` + `SpaceFx.tsx` for visual bounds (can be boxes first)

**Interfaces:**
- Produces: `applySpaceEvent(layout, seats, tables, eventId, rng) => { layout, seats, tables, maxNpcs }`

- [ ] **Step 1: Tests — A1 adds room+door+seats; C1 expands AABB; C2 shrinks and marks overflow seats invalid**

- [ ] **Step 2: Implement A1, C1, C3, C5 fully; A2–A4/C2/C4 can no-op with console stub only if time-boxed—prefer implement all listed in spec before marking task done**

- [ ] **Step 3: Store on fire: apply event, bump `maxNpcs` to seat count, toast via i18n**

- [ ] **Step 4: Scene reads layout rooms to render wall segments / door mesh (primitives)

- [ ] **Step 5: Manual smoke: defeat Boss #1 → room changes

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(space): apply A/C space events to layout and seats"
```

---

### Task 6: Chaser spawn + AI + face smack

**Files:**
- Create: `src/game/chaser.ts`
- Create: `src/game/__tests__/chaser.test.ts`
- Modify: `src/game/store.ts`, `src/game/doorSystem.ts`, `src/game/npcFsm.ts` (skip seat FSM for chaser)
- Modify: `src/scene/Npcs.tsx`

**Interfaces:**
- Produces:
  - `shouldSpawnChaser(ctx): boolean` // late OR (multiRoom && neighborShare high)
  - `createChaser(id, doorPos): NpcState`
  - `stepChaser(npc, playerPos, layout, dt, now): NpcState`
  - `inFaceRadius(npc, playerPos): boolean`
  - `neighborThreatShare(threatParts): number`

- [ ] **Step 1: Failing tests for spawn OR gates and face radius**

```ts
it('spawns in late era even with one room', () => {
  expect(shouldSpawnChaser({ phase: 'late', roomCount: 1, neighborShare: 0, chaserCount: 0, bossPresent: false })).toBe(true)
})

it('spawns on cheese when multi-room and high neighbor share', () => {
  expect(shouldSpawnChaser({ phase: 'mid', roomCount: 2, neighborShare: 0.5, chaserCount: 0, bossPresent: false })).toBe(true)
})

it('does not spawn if at cap or boss present', () => {
  expect(shouldSpawnChaser({ phase: 'late', roomCount: 1, neighborShare: 0, chaserCount: 2, bossPresent: false })).toBe(false)
  expect(shouldSpawnChaser({ phase: 'late', roomCount: 1, neighborShare: 0, chaserCount: 0, bossPresent: true })).toBe(false)
})
```

- [ ] **Step 2: Implement spawn + pursue toward player; if `distance < faceRadius` and `now > staggerUntil` → status smacking with high loudness; `ignoreRoomGate` true in threat ctx**

- [ ] **Step 3: Population: `normals.length + bosses + chasers <= maxNpcs`**

- [ ] **Step 4: Npcs.tsx — distinct color/scale/marker for `role === 'chaser'`**

- [ ] **Step 5: Tests PASS + commit**

```bash
git commit -m "feat(space): chase NPC spawn and face-smack AI"
```

---

### Task 7: Slap knockback / stagger (chasers only)

**Files:**
- Modify: `src/game/skills.ts`
- Modify: `src/game/chaser.ts` (`applyChaserKnockback`)
- Modify: `src/game/__tests__/chaser.test.ts` or `skills` tests
- Reuse: `knockbackFrom` in `collision.ts` if present

**Interfaces:**
- Produces: `applyChaserKnockback(npc, fromPos, now): NpcState` sets position nudge + `staggerUntil`

- [ ] **Step 1: Test — slap on chaser sets staggerUntil and moves away; slap on seated does not change seat position**

- [ ] **Step 2: In slap execute path, if target.role === 'chaser' || !seated, apply knockback; megaphone/civility shove only chasers/walkers**

- [ ] **Step 3: Silence prop: skip chasers or 0.3s interrupt only**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(space): chaser knockback and AoE shove rules"
```

---

### Task 8: Hide + latch (Space hold)

**Files:**
- Create: `src/game/hideLatch.ts`
- Create: `src/game/__tests__/hideLatch.test.ts`
- Modify: `src/game/inputStore.ts` / `World.tsx` player loop (Space hold tracking)
- Modify: `src/ui/TouchControls.tsx`
- Modify: `src/game/store.ts`
- Modify: `src/scene/World.tsx` (crouch pose)

**Interfaces:**
- Produces:
  - `beginHold(now) / cancelHold()`
  - `resolveHold(ctx): 'jump' | 'hide' | 'latch' | 'none'` after holdSec
  - `canEnterHide(ctx): boolean` // grounded && !inFaceRadius && near furniture
  - `tickHide(state, moveIntent, now)`
  - `tickLatch(openings, now)`

- [ ] **Step 1: Failing tests**

```ts
it('rejects hide in face radius', () => {
  expect(canEnterHide({ grounded: true, inFaceRadius: true, nearFurniture: true })).toBe(false)
})

it('prefers furniture over door when both near', () => {
  expect(resolveContext({ nearFurniture: true, nearDoor: true })).toBe('hide')
})

it('move intent exits hide', () => {
  const s = tickHide({ hidden: true }, { moveIntent: true }, 1000)
  expect(s.hidden).toBe(false)
})
```

- [ ] **Step 2: Implement hold state machine — tap (< holdSec) still jumps via existing edge detect; hold fires hide/latch once**

- [ ] **Step 3: While hidden, chaser `stepChaser` loses direct seek (wander furniture) until search escalate**

- [ ] **Step 4: Latch sets `opening.latchedUntil`; acoustics `latchedOnPath` true; chaser path treats opening closed**

- [ ] **Step 5: Touch jump button: pointerdown start hold timer; pointerup early = jump**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(space): Space-hold hide under furniture and door latch"
```

---

### Task 9: Atmosphere lights + smacker fog + character polish

**Files:**
- Create: `src/scene/Atmosphere.tsx`
- Modify: `src/scene/World.tsx` (reduce flat lighting; add lamp geo)
- Modify: `src/scene/Npcs.tsx`, player mesh in `World.tsx`
- Modify: `src/scene/GameCanvas.tsx`

**Interfaces:**
- Consumes: store `threat`, `npcs` smacking set, `playerRoomId`
- Produces: reactive lights; fog density

- [ ] **Step 1: Atmosphere component** — point lights at ceiling/table; `threat` drives ambient intensity and key color toward red

- [ ] **Step 2: Fog** — `scene.fog` density base + k * (current-room smacking count) + face-chase bump; clamp max

- [ ] **Step 3: Player** — simple limb group; slap arm swing on hitFx; crouch scale/position when hidden

- [ ] **Step 4: Diners** — slight body variance by seatIndex; stronger chew already exists—tune; chaser gait/marker

- [ ] **Step 5: Lamp sway useFrame; megaphone hit rattles food meshes slightly**

- [ ] **Step 6: Manual visual check desktop + mobile**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(space): layered lights, smacker fog, character polish"
```

---

### Task 10: Postprocessing + Outline + mobile toggles

**Files:**
- Modify: `package.json` — add `@react-three/postprocessing`
- Modify: `src/scene/GameCanvas.tsx` / `Atmosphere.tsx`
- Modify: `src/game/deviceDetect.ts` if present for mobile quality flag

- [ ] **Step 1: `npm install @react-three/postprocessing`**

- [ ] **Step 2: EffectComposer — Bloom (low intensity), Vignette; Outline selected `targetId` mesh**

- [ ] **Step 3: If mobile (`isTouch` / narrow), disable Bloom and halve point lights**

- [ ] **Step 4: Verify billboards still readable with fog+bloom**

- [ ] **Step 5: `npm test && npm run build` PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(space): postprocessing outline bloom with mobile quality gate"
```

---

### Task 11: i18n strings + HUD toasts + README blurb

**Files:**
- Modify: `src/game/i18n.ts` (zh/en/nl)
- Modify: `src/ui/Hud.tsx` / Briefing foot controls line (Space hold hint)
- Modify: `README.md` Round section

- [ ] **Step 1: Add keys** — space event reward, latch, hide hint, chaser label

- [ ] **Step 2: Update briefing foot: long-press Space to hide/latch**

- [ ] **Step 3: README Round 9 (or Space Director) bullet list**

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: i18n and README for Space Director features"
```

---

## Plan self-review

### Spec coverage

| Spec area | Task(s) |
|-----------|---------|
| SpaceDirector A/C, Boss#1 reward, cooldown | 4, 5 |
| Acoustics Rule 1 + openings + floors | 2, 3, 8 |
| Tables/seats on expand; high ground no buff | 5 |
| Chaser B∥D, caps, face smack | 6 |
| Knock-away package | 7 |
| Hide/latch Space hold, move exit, priorities | 8 |
| Visuals lights/fog/post/characters | 9, 10 |
| i18n / controls copy | 11 |
| Out of scope respected | Global Constraints |

### Placeholder scan

No TBD/TODO steps left; event IDs A2–A4/C2/C4 required implemented in Task 5 (not stubs).

### Type consistency

- `NpcRole` includes `'chaser'` from Task 1 onward.
- `RoomId` / layout hop APIs feed threat ctx and chaser path.
- `staggerUntil` used by Tasks 6–7.
- Hide uses `holdSec` from CONFIG.hideLatch.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-06-civic-man-space-director.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans and checkpoints  

Which approach?
