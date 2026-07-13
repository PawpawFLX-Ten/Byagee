# Civic Man — Round 3 Design Spec

**Date:** 2026-07-13  
**Status:** Development Complete  
**Goal:** Add an XP/level progression system with per-level skill perks, two new unlockable skills (Q/E), proactive NPC pathfinding, continuous threat damage scaling, and gameplay polish — all layered on top of the Round 2 foundation without replacing existing systems.

**Approach:** Pure-logic progression module (`progression.ts`) with config-driven XP tables and perk thresholds. Level multipliers applied at the skill-resolution layer. New skills reuse the existing `tryUseSkill` → `resolveBossHit` pipeline with new tags (`cone`, `global`).

---

## One-liner

Same包间生存循环，但玩家现在通过制裁吧唧者积累经验值升级（1-10 级），每级降低技能 CD、扩大范围；5 级解锁 Q 技能「泼屎」（锥形 AoE），10 级解锁 E 技能「素质」（全场静音 + 马桶搋子）；各技能随等级解锁回血、降噪、双倍伤害等增强效果；NPC 寻路改为前瞻避障；威胁伤害改为连续递增。

---

## Relationship to Round 2

| Keep | Change |
|------|--------|
| Threat meter, soft/hard HP drain | Damage now scales continuously (piecewise-linear, not step) |
| Four cooldown skills (Slap / Tape / Megaphone / Gag) | Slap renamed 抽脸; all 4 gain level-based perks |
| Door population, three tables, boss modules | NPC pathfinding upgraded to proactive steering |
| Difficulty phases early / mid / late | Smacking grace period (1.5s before damage) |
| Titles by survival time | XP/level system with overflow heal at max level |
| — | New Q skill 泼屎 (Level 5, cone AoE) |
| — | New E skill 素质 (Level 10, global AoE + plunger VFX) |

---

## XP & Level System

### XP Sources

| Behavior | XP | Notes |
|----------|-----|-------|
| Skill hit on normal NPC | +10 | Per NPC hit |
| Skill hit on boss | +25 | Per boss hit |
| Boss demoted | +100 | Milestone reward |
| Survival (per second) | +1 | Passive income |

### Level Curve

| Level | Cumulative XP | Approx. Time | Unlock |
|-------|--------------|-------------|-------|
| 1→2 | 80 | ~30s | — |
| 2→3 | 200 | ~1min | Slap heal |
| 3→4 | 380 | ~1.5min | Tape noise reduction |
| 4→5 | 620 | ~2min | Megaphone heal + **Q skill** |
| 5→6 | 920 | ~3min | — |
| 6→7 | 1,280 | ~4min | Slap heal enhanced |
| 7→8 | 1,700 | ~5min | Tape noise enhanced |
| 8→9 | 2,180 | ~6min | Megaphone heal enhanced |
| 9→10 | 2,720 | ~7min | Gag enhanced + **E skill** |

### Per-Level Bonuses (accumulated)

| Attribute | Per Level | At Level 10 | Example (Slap CD 1.3s) |
|-----------|-----------|-------------|----------------------|
| CD reduction | 3% | 27% | 1.3s → 0.95s |
| Range expansion | 2% | 18% | 2.4m → 2.83m |

Formula: `effectiveCD = baseCD * (1 - 0.03 * (level - 1))`, `effectiveRange = baseRange * (1 + 0.02 * (level - 1))`.

### Max Level Overflow

At Level 10, excess XP heals HP at 1 HP per 5 XP (capped at 2 HP/sec).

### Level-Up Visual

- Golden expanding ring at player position (1.5s, 0.8→0 opacity)
- Gold-bordered toast: "升级！LV{n}" (2s)

---

## Level-Based Skill Perks

### Slap (抽脸) — renamed from 拍

| Level | Perk |
|-------|------|
| 1 | — |
| 2-5 | Heal **2 HP** on successful smacker hit |
| 6-10 | Heal **4 HP** on successful smacker hit |

Condition: the hit NPC had `status === 'smacking'` before the skill was applied.

CD changed: 2s → 1.3s. Animation changed: vertical chop → horizontal 扇脸 (yaw sweep).

### Tape (胶条)

| Level | Perk |
|-------|------|
| 1-2 | — |
| 3-6 | Hit NPC's next smacking session: noise **-0.15** |
| 7-10 | Hit NPC's next smacking session: noise **-0.25** |

Implementation: `NpcState.noiseReduction` field set on tape hit. `computeThreat` uses `max(0.05, baseLoudness - noiseReduction)`. Cleared when smacking session ends (smacking→idle transition).

### Megaphone (吼)

| Level | Perk |
|-------|------|
| 1-3 | — |
| 4-7 | Heal **2 HP** on successful smacker hit |
| 8-10 | Heal **4 HP** on successful smacker hit |

Same condition as Slap: hit NPC was smacking before skill applied.

### Gag (塞嘴)

| Level | Perk |
|-------|------|
| 1-8 | — |
| 9-10 | Boss: mouth HP chip **×2** (2 per hit instead of 1) |
| 9-10 | Normal NPC: seal duration **×2** |

Implementation: `resolveBossHit` accepts `hitPower` parameter; `tryUseSkill` passes `hitPower=2` and `effectiveDuration=duration*2` for gag at Level 9+.

---

## Q Skill: 泼屎 (Poop)

**Unlock:** Level 5  
**Key:** Q

| Property | Value |
|----------|-------|
| Shape | Cone AoE (120°, range 5m) |
| Effect | Silences all NPCs in cone for 2s |
| Cooldown | 8s (level-scaled) |
| Windup | 0.15s |
| Self-noise | 0.1 |
| Voice | 「请您吃顿好的 哈哈！」(2× speed) |

**Visuals:**
- Arm: wind-back-then-throw-forward motion + brown sphere prop
- VFX: brown expanding hollow cone from player position
- Shout voice via `playShoutVoice(CONFIG.poopShoutLine, 2.0)`

**Design:** Directional cone — rewards positioning. Shorter CD than megaphone but requires facing targets. Cosmetic cone direction (hit detection is 360° within range; visual is directional).

---

## E Skill: 素质 (Civility)

**Unlock:** Level 10  
**Key:** E

| Property | Value |
|----------|-------|
| Shape | Global (all non-walking NPCs in room) |
| Effect | Silences all NPCs for 3s |
| Cooldown | 30s (level-scaled) |
| Windup | 0.5s |
| Self-noise | 0.4 |
| Voice | 「素质，注意你丫的素质！」(1.5× speed) |

**Visuals:**
- Arm: both arms raised upward + gold capsule props
- VFX: large expanding gold ring from player
- **Toilet plunger (马桶搋子)** drops on every NPC's head: wooden handle cylinder + red rubber cup at ~2.1 units height. Appears on skill hit, disappears when `plungerUntil` expires.
- Shout voice via `playShoutVoice(CONFIG.civilityShoutLine, 1.5)`

**Design:** Emergency button for late-game chaos. High self-noise means it briefly increases threat — a "breathing room" trade-off, not a free pass. 30s CD makes it a decision point.

---

## Threat Damage Scaling

**Before (Round 2):** Step function — 0 below softThreat, flat softDrain between soft/hard, flat hardDrain above hard.

**After (Round 3):** Continuous piecewise-linear:

- Below softThreat (0.45): 0 damage
- Between soft and hard (0.45–0.75): linear from softDrain (8) to hardDrain (28)
- Above hardThreat (0.75+): continues with same slope (66.7 HP/s per threat unit)

| Threat | Old (step) | New (continuous) |
|--------|-----------|-----------------|
| 0.45 | 8 HP/s | 8 HP/s |
| 0.60 | 8 HP/s | ~18 HP/s |
| 0.75 | 28 HP/s | 28 HP/s |
| 1.00 | 28 HP/s | ~45 HP/s |
| 1.50 | 28 HP/s | ~78 HP/s |

**Goal:** Higher threat = proportionally more danger. No safe ceiling at hardThreat.

---

## Smacking Grace Period

NPCs that just started smacking do not contribute to threat for the first **1.5 seconds**. This gives the player reaction time to approach and use a skill before taking damage.

Implementation: `NpcState.smackingSince` timestamp. `computeThreat` skips NPCs where `now - smackingSince < smackDamageDelaySec * 1000`.

---

## NPC Pathfinding Upgrade

### Problem (Round 2)

- NPCs walked in straight lines to food approach points, pushing against tables and sliding reactively
- Oval table (south side) was rarely visited — `pickFood` scored by distance, oval was always farther
- `approachFor` used NPC's `seatIndex` instead of food index, causing incorrect approach offsets for cross-table food selection

### Solution (Round 3)

**1. Proactive steering (`steeredDirection`)**

NPCs look ahead 1.5 units in their movement direction. If the probe point collides with a table, the movement direction is blended (60% original + 40% deflection toward table edge). This produces natural curving around tables instead of straight-line-and-slide.

**2. `approachFor` fix**

Changed parameter from `seatIndex` to `foodIdx` (the food spot's index in `CONFIG.foodSpots`). All call sites updated to pass `foodIndexInConfig(food.id)`.

**3. `pickFood` rebalanced**

- Crowd penalty increased: 2.5× → 3.0×
- New `tableCrowd` term: 2.0× penalty for NPCs within 2.5m of the food's table area
- Random jitter: `Math.random() * 0.4` to break ties and distribute across tables

**4. Stuck reroute threshold reduced**: 40 → 25 ticks (better steering = faster recovery).

---

## Gameplay Polish

### Spacebar Jump

- **Key:** Space
- Duration: 500ms airborne, 800ms cooldown
- While airborne: NPC collision bypassed (tables/walls still collide)
- Y animation: sin arc, peak 0.8 units
- Use case: hop over a blocking NPC to reach a smacking target

### Wall Beautification

| Property | Round 2 | Round 3 |
|----------|---------|---------|
| Base opacity | 1.0 (solid) | 0.3 (semi-transparent) |
| Faded opacity (camera occlusion) | 0.12 | 0.05 |
| Wall colors | Single brown | Warm tones (N/S vs E/W differentiated) |
| Decoration | None | Baseboard strip (accent color) |
| Ceiling opacity | 0.35 | 0.22 |

### Room Dimensions

All dimensions increased by 3% for better edge navigation:
- `ROOM_LIMIT`: 4.35 → 4.48
- Floor: 10×10 → 10.3×10.3
- Walls: ±4.8 → ±4.94
- Door position: [0, 0, -4.35] → [0, 0, -4.48]

### pickTarget Fix

Walking NPCs (in transit from door) excluded from skill targeting. Fixes "距离太远" error when the auto-target selected a door-entered NPC that was still walking to their seat. Store auto-target also changed from `smacking → walking → first NPC → null` to `smacking → non-walking → null`.

### Skill Voices (all 6)

| Skill | Voice Line | Rate |
|-------|-----------|------|
| 抽脸 (1) | 操你妈 | 2.6× |
| 胶条 (2) | 给老子闭嘴！ | 1.4× |
| 吼 (3) | 都他妈把嘴闭上！ | 1.45× |
| 塞嘴 (4) | 吃屎吧你！ | 1.5× |
| 泼屎 (Q) | 请您吃顿好的 哈哈！ | 2.0× |
| 素质 (E) | 素质，注意你丫的素质！ | 1.5× |

### Briefing Update

- 6 skills displayed in 2-column grid (no scroll on standard screens)
- Each skill shows: key, icon, name, unlock level, pro/con, level perks
- Level system explainer section added
- Controls line: `WASD 移动 · 空格跳跃跨人 · 拖拽转镜 · Tab 换目标 · 噪音越大掉血越狠`

---

## Architecture

```
src/game/progression.ts          # NEW — XP/level pure logic, CD/range multipliers
src/game/types.ts                # +noiseReduction, +coneAngle, +levelXpTable, +poopShoutLine, +civilityShoutLine
src/game/config.ts               # +levelXpTable, +poop/civility skill defs, +shout lines, slap rename
src/game/threat.ts               # computeThreat uses noiseReduction; hpDrainPerSec continuous scaling
src/game/skills.ts               # tryUseSkill takes level; cone/global tags; hitPower for gag L9; tape noiseReduction
src/game/bossModules.ts          # resolveBossHit takes hitPower param
src/game/npcFsm.ts               # steeredDirection; approachFor uses foodIdx; pickFood rebalanced; noiseReduction lifecycle
src/game/store.ts                # xp/level/levelUpAt/plungerUntil; XP gain; level-up; healFromSkill; overflow heal
src/game/audio.ts                # poop/civility voices in playSkill
src/game/doorSystem.ts           # createNormalFromDoor: +noiseReduction
src/scene/World.tsx              # Q/E arm animations + props; spacebar jump; wall beautification; room +3%
src/scene/SkillFx.tsx            # poop cone VFX; civility ring + Plungers component; level-up golden ring
src/scene/Npcs.tsx               # boss scale + mouth HP bar (Round 2); noiseReduction color entries
src/ui/Hud.tsx                   # XP bar; level display; Q/E locked buttons; level-up toast class
src/ui/Briefing.tsx              # 6 skills 2-column grid; level system section; updated text
src/ui/SkillIcon.tsx             # accepts all 6 SkillId values
src/index.css                    # .fill.xp, .skill.locked, .toast.levelup, .skill-list grid, briefing compact
```

---

## Out of Scope (Round 3)

- Skill tree / branching upgrades
- Perk selection at level-up
- Multiple save slots / meta-progression across runs
- Achievement system
- Leaderboard
- Custom loadout / skill swapping
- Difficulty selector
- Mobile touch controls

---

## Success Criteria

1. ✅ XP awarded from skill hits and survival; level 1-10 progression works
2. ✅ Per-level CD reduction (3%) and range expansion (2%) applied to all skills
3. ✅ Slap heals 2/4 HP at L2/L6; Megaphone heals 2/4 HP at L4/L8 (on smacker hit)
4. ✅ Tape applies noiseReduction at L3 (0.15) / L7 (0.25); threat reduced for next smacking session
5. ✅ Gag at L9: double boss HP damage + double seal duration for normals
6. ✅ Q skill 泼屎 unlocks at L5: cone AoE, voice, VFX
7. ✅ E skill 素质 unlocks at L10: global AoE, plunger VFX, voice
8. ✅ Level-up visual: golden ring + toast
9. ✅ Max level overflow XP heals HP
10. ✅ Threat damage scales continuously (no step function)
11. ✅ Smacking grace period 1.5s
12. ✅ NPC pathfinding: proactive steering, oval table accessible
13. ✅ Spacebar jump bypasses NPC collision
14. ✅ Walls semi-transparent with baseboard decoration
15. ✅ Briefing shows all 6 skills without scrolling (2-column grid)
16. ✅ Unit tests pass (21/21); tsc clean; vite build succeeds

---

## Open Balance Knobs

| Knob | Current Default |
|------|-----------------|
| XP per normal hit | 10 |
| XP per boss hit | 25 |
| XP per survival sec | 1 |
| XP per boss demote | 100 |
| CD reduction per level | 3% |
| Range expansion per level | 2% |
| Overflow heal rate | 1 HP / 5 XP (cap 2 HP/s) |
| Smacking grace period | 1.5s |
| Slap heal (L2 / L6) | 2 / 4 HP |
| Megaphone heal (L4 / L8) | 2 / 4 HP |
| Tape noise reduction (L3 / L7) | 0.15 / 0.25 |
| Gag enhancement level | 9 |
| Q unlock level | 5 |
| E unlock level | 10 |
| Q cone angle / range | 120° / 5m |
| Q cooldown | 8s |
| E cooldown | 30s |
| E self-noise | 0.4 |
| Jump duration / cooldown | 500ms / 800ms |
| Wall base / faded opacity | 0.3 / 0.05 |
