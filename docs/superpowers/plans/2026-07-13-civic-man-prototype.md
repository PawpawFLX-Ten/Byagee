# Civic Man Playable Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser-playable endless survival slice: table room, 1–3 chewing NPCs, four cooldown skills, threat HP drain, time + title on death.

**Architecture:** React Three Fiber scene + Zustand game store. Pure logic (NPC FSM, threat, cooldowns, titles, difficulty phases) lives in `src/game/` and is unit-tested. R3F components only render and dispatch input.

**Tech Stack:** Vite, React 19, TypeScript, @react-three/fiber, @react-three/drei, three, zustand, vitest

**Spec:** `docs/superpowers/specs/2026-07-13-civic-man-design.md`

---

## File structure

```
package.json
vite.config.ts
tsconfig.json
index.html
src/main.tsx
src/App.tsx
src/index.css
src/game/types.ts
src/game/config.ts
src/game/npcFsm.ts
src/game/threat.ts
src/game/skills.ts
src/game/difficulty.ts
src/game/titles.ts
src/game/store.ts
src/game/__tests__/npcFsm.test.ts
src/game/__tests__/threat.test.ts
src/game/__tests__/skills.test.ts
src/game/__tests__/difficulty.test.ts
src/game/__tests__/titles.test.ts
src/ui/Hud.tsx
src/ui/DeathScreen.tsx
src/scene/GameCanvas.tsx
src/scene/Room.tsx
src/scene/Table.tsx
src/scene/Player.tsx
src/scene/Npc.tsx
src/scene/CameraRig.tsx
```

---

### Task 1: Scaffold Vite + React + TS project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`

- [ ] **Step 1: Init git and scaffold**

```bash
git init
npm create vite@latest . -- --template react-ts
npm install
npm install three @react-three/fiber @react-three/drei zustand
npm install -D vitest @types/three
```

Configure `vite.config.ts` to include vitest:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

- [ ] **Step 2: Verify**

```bash
npm run build
npm test
```

Expected: build succeeds; vitest runs (0 tests ok or no test files yet).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS with R3F and vitest"
```

---

### Task 2: Game types and config

**Files:**
- Create: `src/game/types.ts`, `src/game/config.ts`

- [ ] **Step 1: Add types**

```ts
// src/game/types.ts
export type NpcStatus = 'idle' | 'smacking' | 'silenced' | 'sealed'

export type SkillId = 'tape' | 'slap' | 'megaphone' | 'gag'

export interface NpcState {
  id: string
  status: NpcStatus
  statusUntil: number // performance.now() ms, 0 = indefinite idle
  seatIndex: number
  position: [number, number, number]
  baseLoudness: number
}

export interface SkillDef {
  id: SkillId
  displayName: string
  cooldown: number
  range: number
  silenceDuration: number
  tags: string[]
  aoeRadius?: number
  selfNoise?: number
  applyStatus: 'silenced' | 'sealed'
}

export type DifficultyPhase = 'early' | 'mid' | 'late'

export interface GameConfig {
  maxHp: number
  softThreat: number
  hardThreat: number
  softDrainPerSec: number
  hardDrainPerSec: number
  roomReverb: number
  playerSpeed: number
  skillRangeDefault: number
  phases: {
    earlyEnd: number
    midEnd: number
  }
  damageCoeff: Record<DifficultyPhase, number>
  silenceScale: Record<DifficultyPhase, number>
  maxOverlappingSmackers: Record<DifficultyPhase, number>
  skills: Record<SkillId, SkillDef>
  titles: { minTime: number; title: string }[]
  npcCount: number
  seatPositions: [number, number, number][]
}
```

- [ ] **Step 2: Add config with design values**

```ts
// src/game/config.ts
import type { GameConfig } from './types'

export const CONFIG: GameConfig = {
  maxHp: 100,
  softThreat: 0.45,
  hardThreat: 0.75,
  softDrainPerSec: 8,
  hardDrainPerSec: 28,
  roomReverb: 1.35,
  playerSpeed: 4.5,
  skillRangeDefault: 2.2,
  phases: { earlyEnd: 60, midEnd: 180 },
  damageCoeff: { early: 1, mid: 1, late: 1.8 },
  silenceScale: { early: 1, mid: 0.7, late: 0.5 },
  maxOverlappingSmackers: { early: 1, mid: 2, late: 3 },
  npcCount: 3,
  seatPositions: [
    [1.4, 0, 0.9],
    [-1.4, 0, 0.9],
    [0, 0, -1.3],
  ],
  skills: {
    slap: {
      id: 'slap',
      displayName: '拍',
      cooldown: 2,
      range: 2.2,
      silenceDuration: 1.2,
      tags: ['instant'],
      applyStatus: 'silenced',
    },
    tape: {
      id: 'tape',
      displayName: '胶条',
      cooldown: 6,
      range: 2.0,
      silenceDuration: 5,
      tags: ['duration'],
      applyStatus: 'sealed',
    },
    megaphone: {
      id: 'megaphone',
      displayName: '喇叭',
      cooldown: 10,
      range: 4,
      silenceDuration: 1.5,
      tags: ['aoe', 'selfNoise'],
      aoeRadius: 4,
      selfNoise: 0.25,
      applyStatus: 'silenced',
    },
    gag: {
      id: 'gag',
      displayName: '塞嘴',
      cooldown: 14,
      range: 2.0,
      silenceDuration: 8,
      tags: ['duration', 'ultimate'],
      applyStatus: 'sealed',
    },
  },
  titles: [
    { minTime: 0, title: '轻度洁癖' },
    { minTime: 30, title: '包间保安' },
    { minTime: 90, title: '咀嚼克星' },
    { minTime: 180, title: '食堂死神' },
  ],
}
```

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts src/game/config.ts
git commit -m "feat: add game types and balance config"
```

---

### Task 3: Pure logic — NPC FSM, threat, skills, difficulty, titles

**Files:**
- Create: `src/game/npcFsm.ts`, `src/game/threat.ts`, `src/game/skills.ts`, `src/game/difficulty.ts`, `src/game/titles.ts`
- Create tests under `src/game/__tests__/`

- [ ] **Step 1: Implement `getPhase(elapsedSec)` and silence scaling**

```ts
// src/game/difficulty.ts
import { CONFIG } from './config'
import type { DifficultyPhase } from './types'

export function getPhase(elapsedSec: number): DifficultyPhase {
  if (elapsedSec < CONFIG.phases.earlyEnd) return 'early'
  if (elapsedSec < CONFIG.phases.midEnd) return 'mid'
  return 'late'
}

export function scaledSilence(baseDuration: number, elapsedSec: number): number {
  const phase = getPhase(elapsedSec)
  return baseDuration * CONFIG.silenceScale[phase]
}
```

- [ ] **Step 2: Implement threat**

```ts
// src/game/threat.ts
import { CONFIG } from './config'
import type { NpcState } from './types'

export function distance3(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.hypot(dx, dy, dz)
}

export function distanceAttenuation(dist: number): number {
  // 1 at contact, ~0.25 at 6m
  return 1 / (1 + dist * 0.35)
}

export function computeThreat(
  npcs: NpcState[],
  playerPos: [number, number, number],
  extraNoise = 0,
): number {
  let sum = 0
  for (const npc of npcs) {
    if (npc.status !== 'smacking') continue
    const d = distance3(npc.position, playerPos)
    sum += npc.baseLoudness * distanceAttenuation(d)
  }
  return Math.min(1.5, (sum + extraNoise) * CONFIG.roomReverb)
}

export function hpDrainPerSec(threat: number, damageCoeff: number): number {
  if (threat >= CONFIG.hardThreat) return CONFIG.hardDrainPerSec * damageCoeff
  if (threat >= CONFIG.softThreat) return CONFIG.softDrainPerSec * damageCoeff
  return 0
}
```

- [ ] **Step 3: Implement NPC tick transitions**

```ts
// src/game/npcFsm.ts
import { CONFIG } from './config'
import { getPhase } from './difficulty'
import type { NpcState } from './types'

export function createNpcs(now: number): NpcState[] {
  return CONFIG.seatPositions.slice(0, CONFIG.npcCount).map((pos, i) => ({
    id: `npc-${i}`,
    status: i === 0 ? 'smacking' : 'idle',
    statusUntil: i === 0 ? now + 4000 : now + 2000 + i * 1500,
    seatIndex: i,
    position: pos,
    baseLoudness: 0.4 + i * 0.05,
  }))
}

export function tickNpcs(
  npcs: NpcState[],
  now: number,
  elapsedSec: number,
): NpcState[] {
  const phase = getPhase(elapsedSec)
  const maxSmack = CONFIG.maxOverlappingSmackers[phase]
  let smacking = npcs.filter((n) => n.status === 'smacking').length

  return npcs.map((npc) => {
    if (now < npc.statusUntil) return npc

    if (npc.status === 'silenced' || npc.status === 'sealed') {
      return { ...npc, status: 'idle', statusUntil: now + idleGap(phase) }
    }

    if (npc.status === 'idle') {
      if (smacking >= maxSmack) {
        return { ...npc, statusUntil: now + 800 }
      }
      smacking += 1
      return {
        ...npc,
        status: 'smacking',
        statusUntil: now + smackBurst(phase),
      }
    }

    // smacking burst ended → brief idle then will smack again via idle timer
    return { ...npc, status: 'idle', statusUntil: now + idleGap(phase) }
  })
}

function idleGap(phase: 'early' | 'mid' | 'late'): number {
  if (phase === 'early') return 2800
  if (phase === 'mid') return 1600
  return 900
}

function smackBurst(phase: 'early' | 'mid' | 'late'): number {
  if (phase === 'early') return 3500
  if (phase === 'mid') return 4000
  return 4500
}

export function applySilence(
  npc: NpcState,
  status: 'silenced' | 'sealed',
  durationSec: number,
  now: number,
): NpcState {
  return {
    ...npc,
    status,
    statusUntil: now + durationSec * 1000,
  }
}
```

- [ ] **Step 4: Implement skills helpers**

```ts
// src/game/skills.ts
import { CONFIG } from './config'
import { scaledSilence } from './difficulty'
import { applySilence } from './npcFsm'
import { distance3 } from './threat'
import type { NpcState, SkillId } from './types'

export function pickTarget(
  npcs: NpcState[],
  playerPos: [number, number, number],
  preferredId: string | null,
): NpcState | null {
  const smackers = npcs.filter((n) => n.status === 'smacking')
  const pool = smackers.length ? smackers : npcs
  if (!pool.length) return null
  if (preferredId) {
    const pref = pool.find((n) => n.id === preferredId)
    if (pref) return pref
  }
  return [...pool].sort(
    (a, b) => distance3(a.position, playerPos) - distance3(b.position, playerPos),
  )[0]
}

export function cycleTarget(
  npcs: NpcState[],
  currentId: string | null,
): string | null {
  if (!npcs.length) return null
  const ids = npcs.map((n) => n.id)
  if (!currentId) return ids[0]
  const idx = ids.indexOf(currentId)
  return ids[(idx + 1) % ids.length]
}

export function tryUseSkill(
  skillId: SkillId,
  npcs: NpcState[],
  playerPos: [number, number, number],
  targetId: string | null,
  now: number,
  elapsedSec: number,
  cooldownReadyAt: Record<SkillId, number>,
): {
  ok: boolean
  npcs: NpcState[]
  cooldownReadyAt: Record<SkillId, number>
  selfNoise: number
  reason?: string
} {
  const skill = CONFIG.skills[skillId]
  if (now < (cooldownReadyAt[skillId] ?? 0)) {
    return { ok: false, npcs, cooldownReadyAt, selfNoise: 0, reason: 'cooldown' }
  }

  const duration = scaledSilence(skill.silenceDuration, elapsedSec)
  let next = [...npcs]
  let selfNoise = skill.selfNoise ?? 0

  if (skill.tags.includes('aoe') && skill.aoeRadius) {
    let hit = false
    next = next.map((npc) => {
      if (distance3(npc.position, playerPos) <= skill.aoeRadius!) {
        hit = true
        return applySilence(npc, skill.applyStatus, duration, now)
      }
      return npc
    })
    if (!hit) {
      return { ok: false, npcs, cooldownReadyAt, selfNoise: 0, reason: 'no_target' }
    }
  } else {
    const target = pickTarget(npcs, playerPos, targetId)
    if (!target) {
      return { ok: false, npcs, cooldownReadyAt, selfNoise: 0, reason: 'no_target' }
    }
    if (distance3(target.position, playerPos) > skill.range) {
      return { ok: false, npcs, cooldownReadyAt, selfNoise: 0, reason: 'too_far' }
    }
    next = next.map((n) =>
      n.id === target.id ? applySilence(n, skill.applyStatus, duration, now) : n,
    )
  }

  return {
    ok: true,
    npcs: next,
    cooldownReadyAt: {
      ...cooldownReadyAt,
      [skillId]: now + skill.cooldown * 1000,
    },
    selfNoise,
  }
}
```

- [ ] **Step 5: Titles**

```ts
// src/game/titles.ts
import { CONFIG } from './config'

export function titleForTime(elapsedSec: number): string {
  let title = CONFIG.titles[0].title
  for (const row of CONFIG.titles) {
    if (elapsedSec >= row.minTime) title = row.title
  }
  return title
}
```

- [ ] **Step 6: Write tests**

Cover: `getPhase` boundaries; `computeThreat` zero when idle; `hpDrainPerSec` bands; `tickNpcs` starts smacking; `tryUseSkill` respects range/CD; `titleForTime` bands.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/game
git commit -m "feat: add pure game logic and unit tests"
```

---

### Task 4: Zustand store + game tick

**Files:**
- Create: `src/game/store.ts`

- [ ] **Step 1: Implement store with `start`, `tick`, `useSkill`, `setPlayerPos`, `cycleTarget`, `restart`**

State fields: `hp`, `alive`, `startedAt`, `elapsedSec`, `npcs`, `playerPos`, `targetId`, `cooldownReadyAt`, `threat`, `selfNoiseUntil`, `phase`.

`tick(dt, now)` updates npcs, threat, HP drain, elapsed, clears expired self-noise.

- [ ] **Step 2: Commit**

```bash
git add src/game/store.ts
git commit -m "feat: add zustand game store and simulation tick"
```

---

### Task 5: R3F scene + HUD

**Files:**
- Create: scene + UI files listed above
- Modify: `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Room, table, capsule player (WASD), capsule NPCs with mouth scale when smacking**
- [ ] **Step 2: Orbit follow camera; soft-lock visual on target**
- [ ] **Step 3: HUD — HP, threat meter, skill CD icons, edge arrow to off-screen target**
- [ ] **Step 4: Death screen — time + title + press R**
- [ ] **Step 5: Wire keyboard 1–4, Tab, R**
- [ ] **Step 6: Manual playtest `npm run dev`**

Expected: can interrupt, die to noise, restart, see title.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: playable R3F slice with HUD and death titles"
```

---

### Task 6: Polish pass for readability

**Files:**
- Modify: `src/scene/Npc.tsx`, `src/ui/Hud.tsx`, `src/index.css`

- [ ] **Step 1: Audio-wave billboard above smacking NPCs**
- [ ] **Step 2: Screen-edge direction cue**
- [ ] **Step 3: Soft/hard threat color states**
- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: add smack readability cues and threat UI states"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Endless survival loop | 4–5 |
| 1–3 NPCs resume smacking | 3 FSM + config |
| Difficulty C curve | 3 `difficulty.ts` |
| 3rd person camera | 5 |
| Approach + key skills | 5 |
| Four modular skills, pure CD | 2–3 |
| Small room + table | 5 |
| Time + titles | 3 + 5 |
| Fake threat / HP drain | 3–4 |
| No external 3D assets | 5 primitives |
| Unit-test pure logic | 3 |

---

## Execution note

User requested immediate execution in-session (inline). Prefer completing Tasks 1–6 in order with commits after each task when git is available.
