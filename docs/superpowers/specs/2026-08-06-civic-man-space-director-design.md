# Civic Man — Space Director & Atmosphere Design Spec

**Date:** 2026-08-06  
**Status:** Approved  
**Goal:** Add a data-driven space expansion/morph system, attenuated multi-room acoustics, chase NPCs that punish hiding, non-skill hide/latch interactions, and Three.js-only visual upgrade (lights, fog tied to smackers, character detail, postprocessing)—without texture packs, tower placement, or auto-fire survivors gameplay.

---

## One-liner

首 Boss 击败后奖励式解锁空间变化（随机连通新房或原地变形）；邻房吧唧衰减计入威胁；追杀客克制躲清静房；长按空格钻藏/闩门；场景用光雾动作后处理美化，雾跟着吧唧走。

---

## Relationship to current build

| Keep | Change / Add |
|------|----------------|
| Threat → HP, soft/hard thresholds | Threat sums **room-gated** contributions (same room full; other rooms attenuated) |
| Door population, seats, Boss every ~3 min | **SpaceDirector**: events after Boss#1 clear, then sparse random A/C events |
| Skills 1–6, XP levels, props heal/silence | Skills stay “quiet mouths”; **body actions** on Space for hide/latch; slap knockback vs chasers |
| Single dining room geometry | Procedural multi-room / morph / obstacles / optional 2F; new tables/seats with expansion |
| Low-poly primitives, no required external assets | Still no new textures; richer lights, fog, geo detail, anim, light postprocessing |
| Jump on Space tap | Space **tap** = jump; **hold** near table/cabinet/door = context action |

---

## Player fantasy (updated)

You keep the room(s) from drowning in chewing noise. When the first VIP Boss falls, the private room **rewards** you with more space—or twists the walls. Fleeing to a quieter room helps a little, but **chasers** follow to smack in your face. You slap them back, crawl under tables, or latch doors—not by spending a skill slot on stealth.

---

## Core systems

### 1. SpaceDirector

**First event:** Defeating Boss #1 triggers `SpaceEvent #1` as a **reward** (readable celebration: door glow, short copy, wall/door tween).

**Later events:**
- Global cooldown `spaceEventCooldown` default **~120s** (clamp band 90–150s).
- Prefer tying major events to **subsequent Boss defeats**.
- Between Bosses: at most **one minor morph** (C5).
- Do not fire every minute; avoid “earthquake spam.”

**Random type each event:** **A** (door-connected expansion) or **C** (in-place morph). Same run can do A then C later. Weights shift toward extreme outcomes over time; #1 pool stays mild and useful.

#### Type A — connected rooms

| ID | Content | In #1 reward pool | Late pool |
|----|---------|-------------------|-----------|
| A1 | Door + small room (1 table, 2–4 seats) | Yes (common) | Yes |
| A2 | Short corridor + room (extra latchable door) | Rare | Yes |
| A3 | Large banquet room (2 tables or one big; more seats) | No | Yes |
| A4 | Stair to upstairs small room | No | Yes (uncommon) |

New rooms bring **new tables and seats**. `maxNpcs` / seat list expand accordingly. Doors are latchable.

#### Type C — in-place morph

| ID | Content | In #1 reward pool | Late pool |
|----|---------|-------------------|-----------|
| C1 | Walls push out; area ↑; may spawn 1 new table | Yes (common) | Yes |
| C2 | Area shrinks; excess NPCs egress via door (FIFO / idleExit spirit) | Rare (not a harsh opener) | Yes |
| C3 | Obstacles (pillars, screens, clutter)—block path, **do not** block sound (v1) | Yes | Yes |
| C4 | Same-room 2F platform + stairs (may hold tables) | No | Yes |
| C5 | Micro morph (nudge obstacles / tiny resize)—“minor” only | — | Fill between majors |

On shrink: prefer remove empty tables and force exit over stacking invalid seats. On grow: may spawn tables.

**High ground rule:** Floors are **pure space** (tables, smackers, pathing). **No** altitude threat/damage buff. Acoustics follow room/floor/opening rules below—not “standing high = quieter.”

---

### 2. Acoustics × geography

**Principle:** Threat comes from who is smacking and what separates you—not from elevation power fantasy.

```
heard = loudness
      × distanceAtten(player, npc)     // existing
      × roomGate(playerRoom, npcRoom)  // same=1; neighbor=base; far=lower
      × openingFactor(path)            // closed door muffles more; open door / stairwell leaks
      × floorFactor                    // same room cross-floor: slight muffling (floor slab), not safe AFK
```

| Situation | Intent |
|-----------|--------|
| Same room | Full contribution (current feel) |
| Neighbor / far room | Still on threat meter, clearly quieter (Rule 1) |
| Closed latch | Stronger muffling across that door |
| Open door / stairwell | More leak between spaces |
| Same room, other floor | Quieter than face-table, louder than true other-room |
| Chaser in face radius | Treat gate as ~1 (ignore door muffling); distance≈0 |

**Obstacles (v1):** path/sight only; no acoustic grid.

**Optional later:** per-room reverb scalars (small room punchier). v1 may share global `roomReverb`.

---

### 3. Chase NPC (`chaser`)

**Role:** Punish “AFK in quiet neighbor room.” Not a mini-Boss.

| | Normal diner | Boss | Chaser |
|--|--------------|------|--------|
| Seat | Yes | Yes | **No** (patrol / pursue) |
| Smack | Seated cycles | Modules | **Face-radius forced smack** |
| Population | Counts to cap | Counts 1 | **Counts to cap** |
| Door / stairs | Enter/exit | Enter | Can pursue across rooms/floors |

**Spawn (OR):**
- **B:** Late era may spawn even in single-room.
- **D:** Second space exists **and** neighbor-room threat share is high (cheese on attenuation).

**Caps:** Max 1 early after unlock; late up to 2. Do not spawn same beat as Boss spawn.

**Population budget:** `maxNpcs` tracks seat capacity after space events. Chasers **consume the same budget** but do not occupy seats → effective seated diners ≤ `maxNpcs - chaserCount`. Expanding rooms must add seats (and raise cap) before the director dumps more walkers.

**Skills vs chaser:**
- Single-target silence/seal work; durations may be slightly shorter than on normals (anti-perma-kite).
- AoE silence/status applies to chasers; self-noise unchanged.
- Silence prop: **immune or ultra-short** interrupt (light Boss-like), so prop is not delete-chaser.
- v1: **no mouth HP** on chaser.

#### Knock-away package (borrowed from survival knockback / horror shove)

| Priority | Action | Effect |
|----------|--------|--------|
| Primary | **Slap** | On **chaser** (or walking non-seated): interrupt + knockback 1.5–3m + ~0.8s stagger (no face-smack). On **seated** diners: silence only—**no chair yeet** |
| Secondary | Megaphone / civility | Weaker AoE **shove applies to chasers / walkers only**; seated targets get silence/status only; self-noise cost unchanged |
| Secondary | Jump | Brief “airborne = not in face radius” |
| Secondary | Tape / gag | No big shove; **forbid smack** for N seconds (cripple, Dead Space–style) |
| Bonus | Knock into wall / down stairs | Longer stagger (chasers) |
| Not used | New shove key; garlic permanent aura; full knockback-immune Stalker as default |

**Rationale:** Full slap/AoE knockback on seated guests would break the dining-table fantasy and seat binding.

---

### 4. Hide & latch (non-skill, Space hold)

**Input:**
| Input | Context | Result |
|-------|---------|--------|
| Space **tap** | Anywhere | Jump (existing) |
| Space **hold** (~0.35–0.45s) | Near table/cabinet | Crawl under / into; **does not** jump; **does not** consume slap CD |
| Space **hold** | Near door | Latch door for N seconds |
| Priority if both near | | **Table/cabinet > door** |
| Exit hide | | **Movement input** (no “hide for 3–5s” primary timer) |

**Enter hide gates:**
- Must be **grounded** (not mid-jump).
- Must **not** be inside an active chaser face-smack radius (slap/stagger first—hide is not an i-frame cancel of face chew).
- Hold charge cancels if Pause starts or context target leaves range.

**While hidden:**
- Chasers lose target or circle furniture; search pressure rises if hiding too long (~8s+ soft escalate).
- Same-room smacker threat **still applies** (hide from chaser, not from noise).
- Movement while hidden: none (or negligible); **any move intent exits hide**.
- No HP regen, no threat zeroing while hidden.

**Latch:**
- Chasers cannot traverse the latched opening (path blocked); player can pass.
- Closed door increases acoustic muffling on that opening.
- **Auto-unlatch** after `latchDurationSec`; hold Space again near door to re-latch (no sticky toggle state machine).
- Standing in the doorway does not “pull” a chaser through a latched door.

**Explicitly not skills:** No stealth skill slot; skills remain mouth control + chaser knockback via slap.

---

### 5. Door / seats / Boss pacing bite

| Time | Existing | Space / chase |
|------|----------|---------------|
| 0–first Boss | Teach move/skills; single room | No SpaceEvent yet |
| Boss #1 defeated | Boss demotes to normal diner | **SpaceEvent #1** starts after demote has a valid seat (~0.5–1s settle), so reward FX does not fight seat rebind |
| Later | Boss ~3 min | Major space events prefer Boss clears + cooldown; minor C5 sparse |
| Late | Damage / overlap up | Chase via B; also D if multi-space cheese |

Shrink events must reconcile population with seats (egress). Expand events add seats/tables before raising soft caps.

---

### 6. Visual systems (Three.js only—no new textures)

**Constraint:** No new texture materials / image maps. Color, `roughness`/`metalness`, lights, fog, procedural geo, animation, postprocessing only.

#### Lighting & post
- Layered lights: ceiling points/spots + warm table points; reduce flat directional dominance.
- Threat-driven grading: higher threat → darker ambient, redder key, harder contrast.
- Light fog for depth; **fog density / local murk scales with active smackers** (and threat); face-chase pulls murk toward camera slightly; prefer **current-room** smackers so other-room AFK does not white-out the frame.
- Fog must not defeat **gameplay readability**: NPC billboards, chew waves, chase markers, and target Outline stay legible (draw order / opacity floors / outline after fog as needed).
- Light Bloom on lamps/props; Vignette; stronger under hard threat—Bloom never obscures skill/hit feedback colors.
- Outline on soft-lock target.
- Mobile: fewer point lights; Bloom optional off.

#### Environment geo (still primitives)
- Door frames, lamp shades, screens, stair rails, cabinets (hide targets), richer baseboards.
- SpaceEvent tweens: walls push, doors swing, stairs grow; light camera shake optional.
- Ambient motion: lamp sway; megaphone rattle dishes.

#### Character detail
| Subject | Detail |
|---------|--------|
| Player | Clearer proportions; walk/jump/slap arm arc; crouch-under-table; short latch mime |
| Normal diners | Body/color variance; sit/stand; stronger chew mouths; sealed struggle |
| Future archetypes | Silhouette props (hat/belly)—geometry only |
| Chaser | Taller/hotter palette; urgent gait; exaggerated face chew; pursuit marker |
| Boss | Keep 1.4×; clearer rage/module flashes |
| Hit FX | Stronger knockback arcs; existing skill tint flashes |

No mocap packs, no textured skins, no photoreal faces.

---

## Config knobs (illustrative—final numbers in `CONFIG`)

```
spaceEventCooldownSec: 120
spaceEventCooldownMinSec: 90
spaceEventCooldownMaxSec: 150
roomGateNeighbor: 0.25–0.4
roomGateFar: 0.05–0.15
floorFactorSameRoom: 0.7–0.85
chaserFaceRadius: ~1.2
chaserMaxCountLate: 2
slapChaserKnockbackDist: 1.5–3
slapChaserStaggerSec: ~0.8
spaceHoldSec: 0.35–0.45
hideSearchEscalateSec: ~8
latchDurationSec: 5–8
```

---

## Out of scope (this design)

- Tower / plant placement, sun/coin economy, VS auto-fire weapons
- Heavy Habby meta (fuse gear, stamina chapters)
- Texture/material pack imports; Mint photoreal kits
- Full acoustic simulation mesh; obstacle sound occlusion grid (v1)
- Altitude combat buffs
- New dedicated shove key
- Permanent stealth / heal-while-hiding
- Multiplayer

---

## Success criteria

1. After first Boss kill, a SpaceEvent plays (A or C from #1 pool) with readable reward feedback.
2. Entering another room lowers heard threat but does not zero it; HUD still reflects distant chew.
3. Chaser can spawn via late era and/or multi-room cheese; slap knockback creates a usable escape window.
4. Hold Space under table hides (grounded, not in face radius); move exits; hold Space at door latches; tap Space still jumps.
5. Fog/lighting respond to smackers/threat; scene reads richer without new textures; mobile remains playable with reduced lights/Bloom.
6. Existing skill/XP/door/Boss loops still function; unit tests cover roomGate math, SpaceDirector cooldown, chaser stagger flags.

---

## Implementation notes (non-binding)

- Prefer pure functions: `roomGate`, `SpaceDirector.pickEvent`, `chaser.ai` tick—testable like `threat.ts` / `doorSystem.ts`.
- Geometry events should rebuild or patch colliders + seat/food registries atomically with the tween end.
- Touch: jump button supports long-press for hide/latch when near context targets.

---

## Spec self-review (2026-08-06)

### Checklist

| Check | Result |
|-------|--------|
| Placeholder / TBD scan | Latch toggle ambiguity → **resolved** (auto-unlatch only). |
| Internal consistency | Acoustics Rule 1 ↔ hide ↔ chase ↔ fog: aligned (hide ≠ silence; fog follows current-room smackers). |
| Scope | Single coherent “Space Director + chase + body interact + visuals” plan; archetype matrix / draft XP left out (not approved this round). |
| Ambiguity | Slap/AoE knockback targets; hide-during-face-smack; population vs chaser seats; SpaceEvent vs Boss demote timing → **resolved below**. |

### Conflicts found and resolutions

1. **Knockback vs seated diners** — Pushing every guest off chairs fights table/seat FSM.  
   **Fix:** Displacement knockback only for **chasers / non-seated**; seated get silence/status only.

2. **Hide as panic i-frame** — Holding Space inside face radius would trivialize chase.  
   **Fix:** Cannot enter hide while in chaser face radius; must slap/stagger first.

3. **Hide duration vs “no 3–5s timer”** — Soft 8s search escalate is OK (not a hard eject timer); primary exit remains **move**.

4. **Chaser vs seat cap** — Chaser without seat still counting as `maxNpcs` would starve tables after expand.  
   **Fix:** Document budget: seated ≤ maxNpcs − chasers; expands add seats before filling.

5. **Fog vs readability** — Smacker-scaled fog could hide waves/outline.  
   **Fix:** Explicit legibility floor for billboards, markers, Outline; Bloom must not wash hit colors.

6. **Boss demote + SpaceEvent #1** — Same-frame seat rebind + wall tween races.  
   **Fix:** Queue SpaceEvent ~0.5–1s after demote seated.

7. **Latch doorway exploit** — Unclear if player in door pulls chaser through.  
   **Fix:** Latched opening blocks chaser path regardless of player overlap.

8. **Jump hold vs hide** — Mid-air hold could awkward-trigger crawl.  
   **Fix:** Hide requires grounded.

9. **Silence prop vs chase fantasy** — Full-room silence deleting chasers undermines chase.  
   **Fix:** Already Boss-like resist; keep.

10. **Original “not a horde”** — Chasers are capped 1–2; door director remains primary population—**no conflict**.

### Non-conflicts (checked OK)

- Neighbor attenuation (Rule 1) + chase spawn D: intentional closed loop.  
- A vs C random: complementary, not exclusive per run.  
- Space tap jump / hold context: single key, disambiguated by duration + proximity.  
- No-texture beautify vs character detail: geometry/light/anim only—aligned.  
- High ground with no altitude buff vs floorFactor muffling: muffling is acoustic geography, not a combat power-up.

### Residual risks (accept for implementation planning)

- Touch long-press jump button vs scroll/camera gesture conflicts—verify on device.  
- Dynamic collider rebuild mid-chase may stuck-path; need nav/unstuck tick.  
- Exact `roomGate` numbers need playtest; formulas are stable.
