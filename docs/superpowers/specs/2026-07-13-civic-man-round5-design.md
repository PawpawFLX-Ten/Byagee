# Civic Man — Round 5 Design Spec

**Date:** 2026-07-13  
**Status:** Approved  
**Goal:** Add a floor prop system with two pickup types (heal + global silence), spawning every 45 seconds at random floor positions, with HP-aware dynamic type weighting and Boss immunity to the silence effect. Props persist until picked up — multiple can coexist on the floor.

**Approach:** Pure-logic prop module (`props.ts`) with config-driven spawn timing, HP-weighted type selection, and proximity-based auto-pickup. Props are R3F meshes with floating animation. Effects route through existing `applySilence` / HP store fields. Boss NPCs are immune to the silence prop.

---

## One-liner

同一个包间生存循环，但现在每 45 秒地上会刷新一个道具——红色回血药恢复 35 HP，金色静音符让全场普通 NPC 闭嘴 5 秒（Boss 免疫）。血量越低越容易刷出回血药。道具不捡不会消失，多个可同时存在。走过即拾取，无需按键。

---

## Relationship to Round 4

| Keep | Change |
|------|--------|
| All Round 4 features (mobile, donation, wall art, icons, couplet) | + floor prop spawn / pickup system |
| Threat / HP / NPC FSM / Boss / XP systems | Props route through existing status / HP fields — no new core system |
| Toast feedback mechanism | Reused for prop pickup notifications |

Round 5 is **independent of Round 4** — it only depends on the Round 2+3 codebase. Can be developed in parallel or before Round 4.

---

## Prop Types

### Heal Potion (回血药)

| Property | Value |
|----------|-------|
| Effect | Restore HP |
| Amount | +35 HP (capped at `CONFIG.maxHp`) |
| Visual | Red capsule (竖立) + green cross on top |
| Pickup toast | "回血 +35" |

### Silence Talisman (静音符)

| Property | Value |
|----------|-------|
| Effect | Force all **normal** NPCs to `silenced` status |
| Duration | 5 seconds |
| Boss | **Immune** — Boss NPCs are not affected |
| Visual | Gold bell (sphere base + cone top) with blue "静" text above |
| Pickup toast | "全场静音 5s" |

**Why Boss is immune:** Boss has mouth HP / resistance modules (Round 2). A free 5-second silence would bypass the entire mouth-HP mechanic, trivializing boss fights. Props should help with crowd control, not boss mechanics.

---

## Spawn Mechanics

| Property | Value |
|----------|-------|
| Interval | Every 45 seconds (`CONFIG.props.spawnIntervalSec`) |
| Max on floor | Unlimited — props persist until picked up; multiple can coexist |
| Spawn condition | Player alive AND `briefingDone` (existing props do not block spawning) |
| Position | Random floor point, avoiding: table colliders (1.0m margin), walls (0.8m margin), door area (2.0m radius) |
| Position sampling | Rejection sampling: pick random `(x, z)` in room bounds, reject if inside any exclusion zone, retry up to 20 times, fallback to center if all rejected |
| Y position | 0.5 (floating above floor) |

### HP-Aware Type Weighting

When spawning, the prop type is chosen with dynamic probabilities based on current HP:

```
healWeight = 0.5 + (1 - hp / maxHp) * 0.5    // 0.5 at full HP → 1.0 at zero HP
silenceWeight = 1 - healWeight                 // 0.5 at full HP → 0.0 at zero HP
```

| Current HP | Heal Probability | Silence Probability |
|------------|-------------------|---------------------|
| 100 (full) | 50% | 50% |
| 75 | 62.5% | 37.5% |
| 50 | 75% | 25% |
| 25 | 87.5% | 12.5% |
| 10 | 95% | 5% |

**Design intent:** When low on HP, the game tilts toward giving you healing — a "mercy" mechanic that prevents unwinnable death spirals without being too generous.

---

## Pickup Mechanics

| Property | Value |
|----------|-------|
| Trigger | Auto-pickup when player enters `pickupRadius` (0.8m) |
| Key press | None required — walking over the prop picks it up |
| Rationale | Props are rare (1/min), auto-pickup is more satisfying and doesn't add input burden |
| Pickup feedback | Toast notification + prop disappear animation (scale down + fade out, 0.3s) |

---

## Visual Design

### Common Animation

- **Floating:** Y position oscillates with `sin(time * 2) * 0.1` around base height 0.5
- **Rotation:** Slow Y-axis rotation at ~1 rad/s
- **Visibility ring:** `Billboard` with `ringGeometry` at prop base — glowing colored ring visible from any angle and distance
  - Heal: green ring `#5ecf7a`, opacity 0.4
  - Silence: blue ring `#6ec0ff`, opacity 0.4
- **Pickup animation:** Scale from 1.0 → 0 over 0.3s, then removed from scene

### Heal Potion Mesh

```
Red capsule (capsuleGeometry, 0.12 radius, 0.25 length) — vertical orientation
Green cross: two thin boxGeometry intersecting at top
```

### Silence Talisman Mesh

```
Gold bell:
  - Bottom: sphereGeometry (0.15 radius, bottom half)
  - Top: coneGeometry (0.12 radius, 0.1 height)
  - Clapper: small sphereGeometry inside (0.04 radius, dark gold)
Blue "静" Text (drei <Text>) floating 0.3 units above bell
```

---

## Interaction with Existing Systems

| System | Interaction |
|--------|-------------|
| **Threat** | Silence prop sets all normal NPCs to `silenced` → `computeThreat` returns 0 for those NPCs (only counts `smacking`). Threat drops naturally. |
| **Boss** | Silence prop skips Boss NPCs (`role === 'boss'`). Boss continues smacking / raging. |
| **NPC FSM** | Silence prop calls `applySilence(npc, 'silenced', silenceSec, now)` for each normal NPC — same path as skills. `statusUntil` set to `now + 5000`. |
| **HP** | Heal prop: `hp = Math.min(CONFIG.maxHp, hp + healAmount)`. Does not affect XP, level, or threat. |
| **XP** | No XP awarded for prop pickup. XP only from skill hits + survival. |
| **Door system** | Prop spawn position avoids door area (2.0m radius from `CONFIG.door.position`). Does not block NPC pathfinding. |
| **Difficulty** | Prop effects do not scale with difficulty phase. 5s silence is 5s in early and late game. |
| **Spacebar jump** | Player can jump over a prop without picking it up (airborne skip). Pickup only triggers when grounded within radius. Optional — if complex, just always pickup. |

---

## Architecture

```
src/game/types.ts              # +PropType, +PropState, +PropsConfig
src/game/config.ts             # +props config block
src/game/props.ts              # NEW — pure logic: spawn, pickup, effect application
src/game/store.ts              # +props array, +nextPropAt, tick integration
src/scene/Props.tsx            # NEW — R3F rendering: meshes, floating anim, pickup anim
src/ui/Hud.tsx                 # +prop pickup toast (reuse existing toast)
src/game/__tests__/props.test.ts  # NEW — pure logic tests
```

### PropState

```ts
export type PropType = 'heal' | 'silence'

export interface PropState {
  id: string
  type: PropType
  position: [number, number, number]
  spawnedAt: number
  /** Pickup animation: 0 = idle, >0 = fading out (timestamp when fade started) */
  fadingSince: number | null
}
```

### PropsConfig

```ts
export interface PropsConfig {
  spawnIntervalSec: number       // 45
  healAmount: number              // 35
  silenceSec: number              // 5
  pickupRadius: number            // 0.8
  floatHeight: number             // 0.5
  spawnMargin: number             // 0.8 (from walls)
  tableMargin: number             // 1.0 (from table colliders)
  doorExclusionRadius: number     // 2.0
}
```

---

## Out of Scope (Round 5)

- More than 2 prop types (no speed boost, shield, etc.)
- Prop inventory / carrying (instant effect on pickup)
- Manual pickup key
- Prop expiration / despawn timer (props stay until picked up)
- Prop expiration / despawn timer (props persist until picked up — by design)
- Props affecting Boss
- Prop interaction with mobile touch controls (auto-pickup is touch-agnostic)
- Achievement / milestone for prop pickup count

---

## Success Criteria

1. Every 45 seconds (if alive), a prop spawns at a random valid floor position; existing unpicked props do not block new spawns
2. Prop type is HP-weighted: low HP → higher heal probability
3. Walking within 0.8m of a prop auto-picks it up
4. Heal prop restores 35 HP (capped at maxHp); toast "回血 +35"
5. Silence prop silences all normal NPCs for 5s; Boss unaffected; toast "全场静音 5s"
6. Prop disappears with scale-down animation on pickup
7. Props are visible from distance (glow ring + floating animation)
8. Existing systems (threat, boss, door, XP) function unchanged
9. Unit tests cover: spawn timing, HP weighting, pickup detection, heal effect, silence effect (Boss immunity)
10. `npm test` passes; `npm run build` succeeds; tsc clean

---

## Open Balance Knobs

| Knob | Default |
|------|---------|
| Spawn interval | 45s |
| Heal amount | 35 HP |
| Silence duration | 5s |
| Pickup radius | 0.8m |
| Max props on floor | Unlimited (persist until picked up) |
| HP weighting base | 50% heal at full HP → 100% at zero HP |
| Table exclusion margin | 1.0m |
| Wall exclusion margin | 0.8m |
| Door exclusion radius | 2.0m |
| Float height | 0.5m |
