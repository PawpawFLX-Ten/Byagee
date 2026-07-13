# Civic Man — Round 2 Design Spec

**Date:** 2026-07-13  
**Status:** Approved  
**Goal:** Extend the v1 prototype with room population flow, a three-table layout, escalating boss mechanics, and slap shout SFX — without replacing the core threat / skill loop.

**Approach:** Config-driven modular plugins (Approach 1). Door behaviors and boss modules are independently toggleable and unlock by survival time.

---

## One-liner

Same private dining survival loop, but the room now has a door (NPCs in/out, hard cap **10 including boss**), three differently shaped tables in a triangular layout, periodic bosses with stacking mouth-fight modules, and the slap skill shouts「操你妈」on hit.

---

## Relationship to v1

| Keep | Change |
|------|--------|
| Threat meter, soft/hard HP drain | Population up to 10 via door |
| Four cooldown skills (Tape / Slap / Megaphone / Gag) | One table → three shaped tables |
| NPC FSM: idle / walk / smack / silenced / sealed | Boss entity + modules A/B/C |
| Difficulty phases early / mid / late | Door plugins escalate with time |
| Titles by survival time | Slap adds shout SFX only |

---

## Scene

- **Door:** North wall. Shared spawn/despawn point for normal NPCs and bosses.
- **Layout:** Triangular spread (approved layout A).
- **Tables (distinct shapes):**
  - Round table — ~3 seats
  - Rectangular table — ~3 seats
  - Long oval table — ~4 seats
  - **Total seat capacity ≈ 10**
- Food spots and approach points are bound per table/seat.
- Art remains procedural low-poly (no required external 3D assets).
- Player moves between tables; soft-lock / skill range rules unchanged in spirit (may need slightly larger room bounds).

---

## Door & population

**Hard rule:** `npcCount ≤ 10` at all times, **including the boss**. While a boss is present, at most 9 normal diners.

**Start:** ~3 NPCs. Population trends upward toward the cap as time progresses.

### Plugins (unlock by survival time)

| Phase | Approx. time | Active plugins |
|-------|--------------|----------------|
| Early | 0–60s | **Timed lottery** — periodically attempt one enter or one exit |
| Mid | 1–3 min | Timed + **Threat-driven** — high threat biases enter; quiet biases exit |
| Late | 3 min+ | Timed + Threat + **Seat-driven** — enter only if empty seat; exit if idle/no food too long |

### Enter / exit rules

- **Enter:** Door → claim empty seat/food spot → walk in. Rejected if at cap 10.
- **Seat plugin active (late):** *all* normal enters (including timed/threat attempts) require an empty seat; no floating stand-in diners.
- **Exit:** Walk to door → despawn. Prefer not to eject active smackers when alternatives exist; sealed/silenced idle NPCs are preferred exit candidates when clearing space.
- **Boss admission:** Triggered by the 3-minute boss event (not the normal lottery). If the room is full, evict one non-critical NPC first (prefer idle / silenced / sealed over active smackers), then spawn boss through the door. Boss counts toward the 10 cap. Boss may temporarily claim a seat like a normal diner after walking in.

All knobs (intervals, threat thresholds, idle timeouts) live in config.

---

## Boss

### Spawn

- Every **3 minutes** of survival time (3:00, 6:00, 9:00, …).
- At most **one** boss on the floor. If one is already present, skip the event.
- Enters through the door; **larger body (~1.4×)** scale.
- Higher `baseLoudness` while smacking than normal NPCs.

### Defeat → demote

**Demote trigger:** the skill hit that reduces mouth HP from >0 to 0 and applies true silence (module A gate). If only B is relevant after HP is already 0, demotion already happened on the HP-zeroing hit.

- Boss **demotes to a normal diner** (scale and modules off; `role: 'normal'`).
- Remains in the room as 1 normal NPC toward the cap.
- Next 3-minute event may spawn a new boss (if none present).

### Modules (stack by survival time at spawn / refresh)

Same pattern as door plugins: start with one module, then two, then all three.

| When | Modules |
|------|---------|
| Early boss window (~3 min) | **A — Mouth HP bar:** each successful skill hit chips layers; only at 0 does true silence apply |
| Mid (~6 min+) | **A + B — Resistance:** silence durations on boss are very short unless consecutive hits land within a window |
| Late (~9 min+) | **A + B + C — Phases:** below half mouth HP, enter rage |

### Rage skills (module C)

- **`SyncSmack`:** Force nearby normal NPCs into smacking (overrides idle; respects cap of overlapping smackers only loosely — rage is meant to spike threat).
- **`UnsealPulse`:** Clear `sealed` / seal props (tape, gag) on nearby NPCs (and optionally weaken seals on self if any).

Boss UI: visible mouth HP bar above the larger character when module A is active.

---

## Slap shout (audio)

- On **successful slap hit**, play shout SFX:「操你妈」.
- **No change** to slap windup, cooldown, range, or silence duration.
- Optional brief floating text for readability; **no** voice recognition, typing QTE, or extra player input.

Implementation: extend existing `audio.ts` / AudioDirector path (synth or short clip). Line string in config (e.g. `slapShoutLine: '操你妈'`).

---

## Architecture (config-driven plugins)

```
config.ts
  seats/foodSpots (3 tables)
  doorPlugins: { timed, threat, seat } unlock times + params
  boss: { intervalSec: 180, scale, modules unlock times, mouthHp, rage skills }

doorSystem.ts (pure)
  tick(state, now, elapsed) → spawns/despawns intents

bossModules.ts (pure)
  applyHit / tickRage / demote

npcFsm.ts / store.ts
  role: 'normal' | 'boss'
  mouthHp, mouthHpMax, bossModules flags

World.tsx / Npcs.tsx / Hud.tsx
  door mesh, 3 table meshes, boss scale, mouth HP bar
```

Core systems still only speak statuses (`smacking`, `silenced`, `sealed`) plus boss overlays (mouth HP, rage). Skills stay data-driven; boss hit resolution wraps `applySilence`.

---

## Difficulty / threat

- Existing early/mid/late damage and silence scaling remain.
- Population growth and boss loudness are the main Round 2 pressure adds.
- Soft/hard threat thresholds stay; tune in playtest if 10 mouths + boss overshoots.

---

## Out of scope (Round 2)

- Speech recognition / typing QTE for slap
- Multiple bosses at once
- Multiple rooms / meta progression
- Pickup resources / stamina
- Full ragdoll / photoreal assets
- Multiplayer

---

## Success criteria

1. Room shows door + three distinct table shapes in triangular layout.
2. NPCs enter/exit through the door; count never exceeds 10 (boss included).
3. Door plugins unlock over time (timed → +threat → +seat).
4. Boss spawns every 3 minutes (max one); larger; mouth HP / stacked modules by time; rage can sync-smack and unseal.
5. Defeated boss becomes a normal diner.
6. Slap hit plays「操你妈」SFX without changing slap timing numbers.
7. Unit tests cover door cap, plugin unlock gating, boss hit/demote, and slap shout trigger hook.

---

## Open balance knobs (defaults for implementation plan)

| Knob | Starter default |
|------|-----------------|
| Boss interval | 180s |
| Boss scale | 1.4 |
| Mouth HP layers (A) | 4 / 6 / 8 by era |
| Resistance window (B) | 1.2s between hits |
| Rage radius | ~4m |
| Timed enter/exit interval | 12–20s |
| Start NPC count | 3 |
