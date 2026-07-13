# Civic Man — Design Spec

**Date:** 2026-07-13  
**Status:** Approved  
**Goal:** Web endless 3rd-person survival: stop NPCs from loud chewing (“吧唧嘴”) before noise threat kills you.

---

## One-liner

Small private dining room, one big table, 1–3 seated CPU diners. Player uses four modular cooldown skills to interrupt chewing. Exceeding a fake acoustic threat threshold drains HP. Survive as long as possible; earn time-based titles.

---

## Player fantasy

You are the only person who cannot stand the wet chewing sounds. The room gets louder; you slap tape, clap, yell, and gag mouths to buy silence. Eventually cooldowns and overlapping smacks outpace you — Tetris top-out, but with mouths.

---

## Core loop

1. NPC cycles: `IdleEat → Smacking → (Interrupted) → Silenced → IdleEat / Smacking`
2. Global **Threat** meter accumulates from active smackers (loudness × count × room reverb factor).
3. Above soft threshold: HP drains; above hard threshold: drain accelerates.
4. Death → show survival time + title → quick restart.

NPCs are **not** a horde. Difficulty is “they keep starting again,” not spawn waves.

---

## Difficulty curve (approved: C)

| Phase | Approx. time | Behavior |
|-------|--------------|----------|
| Early | 0–60s | Shorter silence windows; smack frequency up; damage coeff = 1.0 |
| Mid | 1–3 min | Faster resumes; allow 2 overlapping smackers |
| Late | 3 min+ | Same noise hurts more (damage coeff rises); pressure up to 3 smackers |

---

## Controls & camera (approved)

- **Camera:** Rotatable third-person follow (Human: Fall Flat–like framing, not ragdoll physics).
- **Targeting:** Soft-lock highest-threat smacker in range; key to cycle targets.
- **Skills:** Approach + press skill key (no mouth aiming).
- **Readability (required):** Head audio-wave icon + screen-edge direction cue when target is off-screen.

### Suggested bindings

| Input | Action |
|-------|--------|
| WASD | Move |
| Mouse / drag | Orbit camera |
| 1 | Tape |
| 2 | Slap |
| 3 | Megaphone |
| 4 | Gag |
| Tab / Q/E | Cycle target |
| R | Restart (on death) |

---

## Skills (approved: all four, modular, pure cooldown)

Shared interface (data-driven plugins):

- `id`, `displayName`, `cooldown`, `range`, `tags[]`
- `canUse(ctx) → boolean`
- `execute(ctx) → void` (applies NPC status; may add self-noise)

| Skill | Role | Effect | CD (starting values) | Tags |
|-------|------|--------|----------------------|------|
| Tape | Control | Long `Sealed` (breakable later) | 6s | `duration` |
| Slap | Panic interrupt | Short `Silenced` | 2s | `instant` |
| Megaphone | AoE interrupt | Silence nearby NPCs; adds self noise to threat | 10s | `aoe`, `selfNoise` |
| Gag | Ultimate | Longest silence | 14s | `duration`, `ultimate` |

Balance knobs live in config, not code branches. Core systems only understand NPC statuses (`Smacking`, `Silenced`, `Sealed`) and threat contributions.

---

## Scene (approved: A)

- One small private room + one large dining table.
- Player orbits the table; seats hold 1–3 NPCs.
- High room reverb factor justifies late-game damage scaling narratively.
- Art: procedural low-poly (capsules, boxes). **No required external 3D assets.**

---

## Scoring (approved: C)

- Primary: **survival time**.
- Secondary: time-gated **titles** (examples):

| Time alive | Title |
|------------|-------|
| < 30s | 轻度洁癖 |
| 30s–90s | 包间保安 |
| 90s–180s | 咀嚼克星 |
| 180s+ | 食堂死神 |

Optional later: interrupt count. Not required for v1.

---

## Fake acoustics (threat model)

No real DSP metering required for v1.

```
threat = sum over NPCs(
  isSmacking ? baseLoudness * distanceAttenuation(player, npc) : 0
) * roomReverb
```

- Soft cap: threat > `SOFT` → mild HP/sec drain + UI warning (yellow).
- Hard cap: threat > `HARD` → heavy HP/sec drain (red).
- Continuous integral optional: sustained soft threat also chips HP slowly.

Visual threat meter is mandatory (game is not ear-only).

---

## Out of scope (v1)

- Level progression / multiple rooms unlock
- Pickup resources / stamina
- Full ragdoll / Human: Fall Flat physics
- Multiplayer
- LLM-driven NPC behavior
- Photoreal or downloaded character packs

---

## Tech stack

- **Vite + React + TypeScript**
- **React Three Fiber + drei + Three.js**
- **Rapier** (optional for v1; capsule controller + simple colliders sufficient)
- **Zustand** (or equivalent) for game state
- Unit-test pure logic (threat, NPC FSM, cooldowns, titles) with Vitest

---

## Success criteria (playable slice)

1. Load in browser, move around table in 3rd person.
2. At least one NPC starts smacking with visible mouth + threat rise.
3. All four skills usable via keys with cooldowns.
4. HP drains when threat high; death shows time + title; R restarts.
5. Difficulty escalates frequency then damage over a few minutes.
