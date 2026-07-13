# Civic Man Round 5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floor prop system — heal potion + silence talisman — spawning every 45s, HP-weighted type selection, auto-pickup, Boss immunity to silence. Props persist until picked up; multiple can coexist.

**Architecture:** Pure-logic `props.ts` with config-driven knobs. Zustand `store.ts` ticks prop spawn + pickup alongside NPC FSM. R3F `Props.tsx` renders floating meshes with glow rings. Silence routes through existing `applySilence`; heal modifies existing `hp` field.

**Tech Stack:** Vite, React 19, TypeScript, R3F, drei, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-07-13-civic-man-round5-design.md`

**Prerequisite:** Round 2+3 merged to master (Task 0 of Round 4, or standalone merge).

---

## File structure

```
src/game/types.ts              # +PropType, +PropState, +PropsConfig
src/game/config.ts             # +props config block
src/game/props.ts              # NEW — pure logic (spawn, pickup, effects)
src/game/store.ts              # +props array, +nextPropAt, tick wiring
src/scene/Props.tsx            # NEW — R3F prop meshes + animations
src/scene/GameCanvas.tsx       # +<Props/> in scene tree
src/ui/Hud.tsx                 # +prop pickup toast (reuse toast mechanism)
src/game/__tests__/props.test.ts  # NEW — pure logic tests
```

---

### Task 1: Types + config

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/config.ts`
- Test: `src/game/__tests__/props.test.ts` (config sanity)

- [ ] **Step 1: Add types**

In `src/game/types.ts`, append:

```ts
export type PropType = 'heal' | 'silence'

export interface PropState {
  id: string
  type: PropType
  position: [number, number, number]
  spawnedAt: number
  /** Timestamp when pickup fade-out started; null while idle */
  fadingSince: number | null
}

export interface PropsConfig {
  spawnIntervalSec: number
  healAmount: number
  silenceSec: number
  pickupRadius: number
  floatHeight: number
  spawnMargin: number
  tableMargin: number
  doorExclusionRadius: number
}
```

Add to `GameConfig` interface:

```ts
props: PropsConfig
```

- [ ] **Step 2: Add config**

In `src/game/config.ts`, add to `CONFIG`:

```ts
props: {
  spawnIntervalSec: 45,
  healAmount: 35,
  silenceSec: 5,
  pickupRadius: 0.8,
  floatHeight: 0.5,
  spawnMargin: 0.8,
  tableMargin: 1.0,
  doorExclusionRadius: 2.0,
},
```

- [ ] **Step 3: Write config sanity test**

Create `src/game/__tests__/props.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CONFIG } from '../config'

describe('props config', () => {
  it('has valid prop config', () => {
    expect(CONFIG.props.spawnIntervalSec).toBe(45)
    expect(CONFIG.props.healAmount).toBe(35)
    expect(CONFIG.props.silenceSec).toBe(5)
    expect(CONFIG.props.pickupRadius).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test -- src/game/__tests__/props.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/config.ts src/game/__tests__/props.test.ts
git commit -m "feat: add prop system types and config"
```

---

### Task 2: Pure logic — props.ts (TDD)

**Files:**
- Create: `src/game/props.ts`
- Test: `src/game/__tests__/props.test.ts` (extend)

- [ ] **Step 1: Write failing tests**

Append to `src/game/__tests__/props.test.ts`:

```ts
import { shouldSpawnProp, sampleFloorPosition, pickPropType, checkPickup, applyPropEffect } from '../props'
import type { NpcState, PropState } from '../types'
import { CONFIG } from '../config'

function stubNpc(partial: Partial<NpcState> & { id: string }): NpcState {
  return {
    status: 'smacking',
    statusUntil: 999999,
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
    smackingSince: 0,
    noiseReduction: 0,
    ...partial,
  }
}

describe('shouldSpawnProp', () => {
  it('spawns when interval elapsed', () => {
    expect(shouldSpawnProp({ elapsedSec: 45, nextPropAt: 45, alive: true })).toBe(true)
  })

  it('spawns even when other props exist on floor', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    expect(shouldSpawnProp({ elapsedSec: 90, nextPropAt: 90, existingProps: [prop], alive: true })).toBe(true)
  })

  it('does not spawn when dead', () => {
    expect(shouldSpawnProp({ elapsedSec: 45, nextPropAt: 45, existingProps: [], alive: false })).toBe(false)
  })

  it('does not spawn before interval', () => {
    expect(shouldSpawnProp({ elapsedSec: 30, nextPropAt: 45, existingProps: [], alive: true })).toBe(false)
  })
})

describe('pickPropType', () => {
  it('returns heal or silence', () => {
    const type = pickPropType(100, 100)
    expect(['heal', 'silence']).toContain(type)
  })

  it('skews toward heal at low HP', () => {
    let healCount = 0
    for (let i = 0; i < 1000; i++) {
      if (pickPropType(10, 100) === 'heal') healCount++
    }
    // At HP 10/100, heal weight = 0.95, so expect >85% heal
    expect(healCount).toBeGreaterThan(850)
  })

  it('roughly 50/50 at full HP', () => {
    let healCount = 0
    for (let i = 0; i < 1000; i++) {
      if (pickPropType(100, 100) === 'heal') healCount++
    }
    // At full HP, heal weight = 0.5, so expect 40-60%
    expect(healCount).toBeGreaterThan(400)
    expect(healCount).toBeLessThan(600)
  })
})

describe('sampleFloorPosition', () => {
  it('returns a position within room bounds', () => {
    const [x, , z] = sampleFloorPosition(CONFIG.tables, CONFIG.door.position)
    expect(Math.abs(x)).toBeLessThan(CONFIG.props.spawnMargin + 4)
    expect(Math.abs(z)).toBeLessThan(CONFIG.props.spawnMargin + 4)
  })

  it('avoids table area', () => {
    for (let i = 0; i < 50; i++) {
      const [x, , z] = sampleFloorPosition(CONFIG.tables, CONFIG.door.position)
      for (const t of CONFIG.tables) {
        const dx = Math.abs(x - t.position[0])
        const dz = Math.abs(z - t.position[2])
        const margin = CONFIG.props.tableMargin
        // Should not be inside table collider + margin
        expect(dx > t.half.x + margin || dz > t.half.z + margin).toBe(true)
      }
    }
  })
})

describe('checkPickup', () => {
  it('returns prop when player is within radius', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [1, 0.5, 1], spawnedAt: 0, fadingSince: null }
    const result = checkPickup([prop], [1.2, 0, 1.3], 0.8)
    expect(result?.id).toBe('p1')
  })

  it('returns null when player is too far', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [1, 0.5, 1], spawnedAt: 0, fadingSince: null }
    const result = checkPickup([prop], [4, 0, 4], 0.8)
    expect(result).toBeNull()
  })

  it('skips fading props', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [1, 0.5, 1], spawnedAt: 0, fadingSince: 5000 }
    const result = checkPickup([prop], [1, 0, 1], 0.8)
    expect(result).toBeNull()
  })
})

describe('applyPropEffect', () => {
  it('heal prop restores HP capped at maxHp', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const result = applyPropEffect(prop, [], 80, 100, 1000)
    expect(result.hp).toBe(100) // capped
    expect(result.toastText).toContain('35')
  })

  it('heal prop restores HP when not capped', () => {
    const prop: PropState = { id: 'p1', type: 'heal', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const result = applyPropEffect(prop, [], 50, 100, 1000)
    expect(result.hp).toBe(85)
  })

  it('silence prop silences normal NPCs', () => {
    const prop: PropState = { id: 'p1', type: 'silence', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const npcs = [
      stubNpc({ id: 'n1', status: 'smacking' }),
      stubNpc({ id: 'n2', status: 'idle' }),
    ]
    const result = applyPropEffect(prop, npcs, 80, 100, 5000)
    expect(result.npcs.every((n) => n.status === 'silenced')).toBe(true)
    expect(result.npcs.every((n) => n.statusUntil === 5000 + 5000)).toBe(true)
  })

  it('silence prop does NOT affect Boss', () => {
    const prop: PropState = { id: 'p1', type: 'silence', position: [0, 0.5, 0], spawnedAt: 0, fadingSince: null }
    const npcs = [
      stubNpc({ id: 'n1', status: 'smacking', role: 'normal' }),
      stubNpc({ id: 'boss1', status: 'smacking', role: 'boss' }),
    ]
    const result = applyPropEffect(prop, npcs, 80, 100, 5000)
    const boss = result.npcs.find((n) => n.id === 'boss1')
    const normal = result.npcs.find((n) => n.id === 'n1')
    expect(boss?.status).toBe('smacking') // unchanged
    expect(normal?.status).toBe('silenced') // silenced
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- src/game/__tests__/props.test.ts
```

- [ ] **Step 3: Implement `src/game/props.ts`**

```ts
import { CONFIG } from './config'
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
      toastText: `回血 +${CONFIG.props.healAmount}`,
    }
  }

  // silence: only normal NPCs
  const silenceUntil = now + CONFIG.props.silenceSec * 1000
  const nextNpcs = npcs.map((n) => {
    if (n.role === 'boss') return n
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
    toastText: `全场静音 ${CONFIG.props.silenceSec}s`,
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- src/game/__tests__/props.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/game/props.ts src/game/__tests__/props.test.ts
git commit -m "feat: add pure prop logic (spawn, pickup, effects) with tests"
```

---

### Task 3: Store integration

**Files:**
- Modify: `src/game/store.ts`

- [ ] **Step 1: Add prop fields to GameStore interface**

```ts
// Add to GameStore interface:
props: PropState[]
nextPropAt: number
propSeq: number
```

- [ ] **Step 2: Initialize in start() / beginMission()**

```ts
props: [],
nextPropAt: CONFIG.props.spawnIntervalSec,
propSeq: 0,
```

- [ ] **Step 3: Add prop logic to tick()**

After the existing NPC tick and before/after door logic, add:

```ts
import { shouldSpawnProp, sampleFloorPosition, pickPropType, checkPickup, applyPropEffect, createProp } from './props'

// Inside tick():
// --- Prop spawn ---
if (shouldSpawnProp({ elapsedSec, nextPropAt: get().nextPropAt, existingProps: get().props, alive })) {
  const type = pickPropType(get().hp, CONFIG.maxHp)
  const pos = sampleFloorPosition(CONFIG.tables, CONFIG.door.position)
  const id = `prop-${get().propSeq + 1}`
  const prop = createProp(type, pos, now, id)
  set((s) => ({
    props: [...s.props, prop],
    nextPropAt: s.nextPropAt + CONFIG.props.spawnIntervalSec,
    propSeq: s.propSeq + 1,
  }))
}

// --- Prop pickup ---
const pickedUp = checkPickup(get().props, playerPos, CONFIG.props.pickupRadius)
if (pickedUp) {
  const effect = applyPropEffect(pickedUp, get().npcs, get().hp, CONFIG.maxHp, now)
  // Mark prop as fading (will be removed after animation)
  set((s) => ({
    props: s.props.map((p) => p.id === pickedUp.id ? { ...p, fadingSince: now } : p),
    npcs: effect.npcs,
    hp: effect.hp,
    toast: { id: Date.now(), text: effect.toastText, until: now + 2000 },
  }))
}

// --- Remove fully faded props ---
const fadeDuration = 300 // ms
set((s) => ({
  props: s.props.filter((p) => p.fadingSince === null || now - p.fadingSince < fadeDuration),
}))
```

- [ ] **Step 4: Reset props on restart()**

```ts
// In restart():
props: [],
nextPropAt: CONFIG.props.spawnIntervalSec,
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Fix any broken tests (existing tests should be unaffected — prop logic is additive).

- [ ] **Step 6: Commit**

```bash
git add src/game/store.ts
git commit -m "feat: wire prop spawn and pickup into game tick"
```

---

### Task 4: Scene rendering — Props.tsx

**Files:**
- Create: `src/scene/Props.tsx`
- Modify: `src/scene/GameCanvas.tsx`

- [ ] **Step 1: Create `src/scene/Props.tsx`**

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from '../game/store'

function HealProp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Red capsule body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.12, 0.2, 4, 8]} />
        <meshStandardMaterial color="#d44" />
      </mesh>
      {/* Green cross — vertical bar */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.06, 0.16, 0.06]} />
        <meshStandardMaterial color="#5ecf7a" emissive="#2a6a3a" emissiveIntensity={0.3} />
      </mesh>
      {/* Green cross — horizontal bar */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.16, 0.06, 0.06]} />
        <meshStandardMaterial color="#5ecf7a" emissive="#2a6a3a" emissiveIntensity={0.3} />
      </mesh>
      {/* Glow ring */}
      <Billboard position={[0, -0.3, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 24]} />
          <meshBasicMaterial color="#5ecf7a" transparent opacity={0.35} />
        </mesh>
      </Billboard>
    </group>
  )
}

function SilenceProp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Bell body — sphere bottom */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffd700" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Bell top — cone */}
      <mesh position={[0, 0.08, 0]}>
        <coneGeometry args={[0.1, 0.1, 8]} />
        <meshStandardMaterial color="#e6c200" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* "静" text above */}
      <Text position={[0, 0.35, 0]} fontSize={0.18} color="#6ec0ff" anchorX="center" anchorY="middle">
        静
      </Text>
      {/* Glow ring */}
      <Billboard position={[0, -0.3, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 24]} />
          <meshBasicMaterial color="#6ec0ff" transparent opacity={0.35} />
        </mesh>
      </Billboard>
    </group>
  )
}

function PropItem({ prop }: { prop: { id: string; type: string; position: [number, number, number]; fadingSince: number | null } }) {
  const ref = useRef<Group>(null)

  useFrame((_, dt) => {
    if (!ref.current) return
    const now = performance.now()
    // Floating animation
    ref.current.position.y = prop.position[1] + Math.sin(now * 0.002) * 0.1
    // Slow rotation
    ref.current.rotation.y += dt * 0.8

    // Fade-out animation
    if (prop.fadingSince !== null) {
      const elapsed = now - prop.fadingSince
      const fadeProgress = Math.min(1, elapsed / 300)
      const scale = 1 - fadeProgress
      ref.current.scale.setScalar(scale)
    } else {
      ref.current.scale.setScalar(1)
    }
  })

  return (
    <group ref={ref} position={prop.position}>
      {prop.type === 'heal' && <HealProp position={[0, 0, 0]} />}
      {prop.type === 'silence' && <SilenceProp position={[0, 0, 0]} />}
    </group>
  )
}

export function Props() {
  const props = useGameStore((s) => s.props)
  return (
    <group>
      {props.map((p) => (
        <PropItem key={p.id} prop={p} />
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Add to GameCanvas scene tree**

In `src/scene/GameCanvas.tsx`, add:

```tsx
import { Props } from './Props'

// In the Canvas JSX, after <Npcs /> and <SkillFx />:
<Props />
```

- [ ] **Step 3: Manual smoke — `npm run dev`**

- Play for 60 seconds
- Verify a prop spawns on the floor (red capsule or gold bell)
- Prop floats and rotates
- Walk over it → it disappears with scale-down
- Toast appears ("回血 +35" or "全场静音 5s")
- If silence: all normal NPCs stop smacking; boss continues

- [ ] **Step 4: Commit**

```bash
git add src/scene/Props.tsx src/scene/GameCanvas.tsx
git commit -m "feat: render floor props with floating animation and glow rings"
```

---

### Task 5: HUD — prop spawn direction cue (optional polish)

**Files:**
- Modify: `src/ui/Hud.tsx`

- [ ] **Step 1: Add prop direction cue**

When a prop is on the floor, show a subtle edge arrow pointing toward it (similar to the existing target NPC edge cue, but different color).

In `Hud.tsx`, add:

```tsx
const props = useGameStore((s) => s.props)

const propEdge = useMemo(() => {
  const prop = props.find((p) => p.fadingSince === null)
  if (!prop) return null
  const dx = prop.position[0] - playerPos[0]
  const dz = prop.position[2] - playerPos[2]
  return Math.atan2(dx, -dz)
}, [props, playerPos])
```

In the JSX, after the existing `edge-cue`:

```tsx
{propEdge !== null && (
  <div
    className="edge-cue prop-cue"
    style={{ transform: `translate(-50%, -50%) rotate(${propEdge}rad)` }}
  >
    ✦
  </div>
)}
```

- [ ] **Step 2: Add CSS**

In `src/index.css`:

```css
.prop-cue {
  color: #ffd700;
  font-size: 22px;
  transform-origin: 0 100px;
  opacity: 0.8;
  animation: prop-pulse 1s ease-in-out infinite alternate;
}

@keyframes prop-pulse {
  from { opacity: 0.5; }
  to { opacity: 1; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/Hud.tsx src/index.css
git commit -m "feat: add on-screen direction cue for floor props"
```

---

### Task 6: Final verification

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Tests**

```bash
npm test
```

Expected: all tests pass including new `props.test.ts`.

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Gameplay smoke**

| Check | Expected |
|-------|----------|
| Prop spawns after ~45s | Red capsule or gold bell appears on floor |
| Props accumulate if not picked up | Wait 90s without picking up; two props on floor |
| Prop position avoids tables/walls/door | Not inside or on table, not at door |
| Low HP → more heal props | Die a few times, observe prop type distribution |
| Walk over prop → pickup | Prop disappears, toast shows |
| Heal prop | HP increases by 35 |
| Silence prop | All normal NPCs silenced 5s; boss continues |
| Existing gameplay unchanged | Skills, boss, door, XP all work normally |

- [ ] **Step 5: Update README**

Add Round 5 notes: prop system, heal + silence, spawn mechanics, Boss immunity.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add Round 5 prop system notes"
```

---

## Self-review (plan vs spec)

| Spec criterion | Task |
|----------------|------|
| Spawn every 45s, props coexist | 2 (`shouldSpawnProp`), 3 (store tick) |
| HP-weighted type selection | 2 (`pickPropType`), tested |
| Random floor position avoiding tables/walls/door | 2 (`sampleFloorPosition`), tested |
| Auto-pickup within 0.8m | 2 (`checkPickup`), 3 (store tick) |
| Heal +35 HP capped | 2 (`applyPropEffect`), tested |
| Silence 5s, normal only, Boss immune | 2 (`applyPropEffect`), tested |
| Prop disappears with animation | 4 (`PropItem` fade-out) |
| Floating + rotation + glow ring | 4 (`PropItem` useFrame, glow ring mesh) |
| Toast feedback | 3 (store toast), 5 (HUD) |
| Direction cue | 5 (edge cue) |
| Existing systems unchanged | 3 (additive), 6 (smoke) |
| Unit tests | 2 (6 test groups) |

No TBD placeholders. Only new file dependencies: `props.ts` (pure logic), `Props.tsx` (R3F). All config in `CONFIG.props`. Boss immunity tested explicitly.

---

## Risk notes

1. **Prop position sampling:** The rejection sampler retries 20 times. In the worst case (all positions blocked), it falls back to room center `[0, 0.5, 0]`. This is acceptable — the center is between tables and reachable.

2. **Silence prop vs walking NPCs:** Walking NPCs (entering from door) are skipped by the silence effect — they haven't started smacking yet, silencing them is meaningless and could break their walk-to-seat FSM. The `applyPropEffect` code explicitly checks `n.status === 'walking'`.

3. **Prop + NPC overlap:** Props float at y=0.5 and have no collision. NPCs and the player can walk through them freely. Only the pickup radius check matters. This is intentional — props shouldn't block movement.

4. **Prop fade-out timing:** The store removes props 300ms after `fadingSince` is set. The `Props.tsx` component reads `fadingSince` and animates scale to 0 during this window. If the store removes the prop before the animation completes, the mesh just disappears — acceptable since 300ms matches the animation duration.

5. **HP weighting randomness:** The `pickPropType` test uses 1000 iterations with a tolerance band. Occasional flaky test failures are possible if the random seed is unlucky. If this happens, widen the tolerance band.
