# Civic Man Round 6 — Implementation Plan

> **Status:** Completed. All tasks implemented and verified.

**Goal:** Polish briefing UI, fix three door-system bugs, rework gag into auto-target ranged skill, implement dynamic smack delay + idleExitSec, add pause system.

**Architecture:** Bug fixes in `doorSystem.ts` + `store.ts`. Gag rework in `skills.ts` + `SkillFx.tsx`. Pause state in store with tick early-return. UI changes in `Briefing.tsx` + `Hud.tsx` + `index.css`.

**Tech Stack:** Vite, React 19, TypeScript, R3F, drei, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-07-13-civic-man-round6-design.md`

**Prerequisite:** Round 5 merged to master.

---

## File structure

```
src/game/types.ts              # smackDelay config, paused on GameStore
src/game/config.ts             # smackDelay block, afdianUrl update
src/game/threat.ts             # smackDamageDelayFor(), computeThreat +elapsedSec
src/game/doorSystem.ts         # pickExitCandidate +now, planBossAdmission +now
src/game/skills.ts             # pickFarthestSmacker(), gag auto-target + range bypass
src/game/store.ts              # +paused, +togglePause, tick guard, faceYaw gag, boss eviction fix
src/scene/SkillFx.tsx          # +projectile ref + arc animation
src/ui/Briefing.tsx            # Layout overhaul
src/ui/DonationModal.tsx       # Three paragraphs, justified
src/ui/Hud.tsx                 # +pause button + Esc handler
src/index.css                  # .pause-btn, .briefing-header, .donation-btn, icon colors
```

---

### Task 1: Briefing UI overhaul

**Files:** `src/ui/Briefing.tsx`, `src/index.css`

- [x] Remove `<p className="eyebrow">` line
- [x] Wrap h1 + donation button in `.briefing-header` (flex, space-between)
- [x] Reword lede: "吧唧嘴亵渎了公共秩序…让每个人吃饭闭嘴！"
- [x] Remove 等级制度 h2 + lede
- [x] Remove standalone donation-trigger button (moved to header)
- [x] CSS: `.briefing` + `.briefing-card` overflow → hidden, max-height → 100%
- [x] CSS: `.briefing-header`, `.donation-btn` styles
- [x] CSS: Increase font sizes (h1 26px, lede 14px, h2 15px)
- [x] CSS: Mobile skill-list stays 2-column
- [x] Change "支持开发者" → "赞助作者"

### Task 2: Donation modal rewrite

**Files:** `src/ui/DonationModal.tsx`, `src/game/config.ts`, `src/index.css`

- [x] Title: "☕ 吧唧钱包"
- [x] Three `<p>` paragraphs inside `<div className="donation-lede">`
- [x] CSS: `.donation-lede p { text-align: justify; margin: 0 0 10px; }`
- [x] `config.ts`: afdianUrl → `https://ifdian.net/a/patatamaster`

### Task 3: Skill icon colors

**Files:** `src/index.css`

- [x] `.skill-icon-slap`: `#ffdd66` → `#1a3a6c`, `color: #fff8f0`
- [x] `.skill-icon-poop`: `#8b6914` → `#1a4d2e`, `color: #fff8f0`

### Task 4: Dynamic smack damage delay

**Files:** `src/game/types.ts`, `src/game/config.ts`, `src/game/threat.ts`, `src/game/store.ts`

- [x] Replace `smackDamageDelaySec: number` with `smackDelay: { initialSec, decayPerEra, minSec }` in types
- [x] Config: `{ initialSec: 3.0, decayPerEra: 0.5, minSec: 1.5 }`
- [x] `threat.ts`: Add `smackDamageDelayFor(elapsedSec)` function
- [x] `computeThreat`: Accept `elapsedSec` parameter, use dynamic delay
- [x] `store.ts`: Pass `elapsedSec` to `computeThreat`

### Task 5: Door system bug fixes

**Files:** `src/game/doorSystem.ts`, `src/game/store.ts`

- [x] **Bug A**: Boss eviction at cap — replace `applyDoorAction` with direct `npcs.filter(n => n.id !== admission.npcId)`
- [x] **Bug B**: Remove `lastDoorEventAt = now` from boss spawn section
- [x] **Bug C**: `pickExitCandidate` accepts `now`, rank -1 for NPCs exceeding `idleExitSec`, `idleSince` tiebreaker (FIFO)
- [x] `planBossAdmission` accepts `now`, passes to `pickExitCandidate`
- [x] `planDoorAction` passes `now` to `pickExitCandidate`

### Task 6: Gag skill rework

**Files:** `src/game/skills.ts`, `src/game/store.ts`, `src/scene/SkillFx.tsx`, `src/ui/Briefing.tsx`

- [x] `skills.ts`: Add `pickFarthestSmacker(npcs, playerPos)` function
- [x] `tryUseSkill`: Gag uses `pickFarthestSmacker` instead of `pickTarget`
- [x] `tryUseSkill`: Skip range check for gag (`skillId !== 'gag'`)
- [x] `store.ts`: `faceYawToTarget` — gag faces farthest smacker
- [x] `SkillFx.tsx`: Add `projectile` ref (Group) with purple capsule mesh
- [x] `SkillFx.tsx`: Animate projectile arc from playerPos to target (sin curve, 500ms)
- [x] `Briefing.tsx`: Gag `pro` → "智能寻址最远嘴巴。入口柔，胰腺瘘"

### Task 7: Pause system

**Files:** `src/game/store.ts`, `src/ui/Hud.tsx`, `src/index.css`

- [x] `GameStore`: Add `paused: boolean` + `togglePause: () => void`
- [x] Initial state: `paused: false`
- [x] `tick()`: Early return if `state.paused`
- [x] `beginMission()`: Reset `paused: false`
- [x] `togglePause`: `set(s => ({ paused: !s.paused }))`
- [x] `Hud.tsx`: Read `paused` + `togglePause` from store
- [x] `Hud.tsx`: Add `<button className="pause-btn">` before HP meter
- [x] `Hud.tsx`: Escape key handler
- [x] CSS: `.pause-btn` style (32×32px, flex center, hover transition)

### Task 8: Final verification

- [x] `npx tsc --noEmit` — zero errors
- [x] `npm test -- --run` — 59/59 passed
- [x] `npm run build` — success

---

## Self-review (plan vs spec)

| Spec criterion | Task |
|----------------|------|
| Briefing: no eyebrow, no 等级制度, donation in header, no scrollbar | 1 |
| Donation modal: three justified paragraphs, new link | 2 |
| Skill icons: slap dark blue, poop dark green | 3 |
| Dynamic smack delay: 3.0→1.5s per boss era | 4 |
| Bug A: Boss spawns at cap | 5 |
| Bug B: No door freeze on boss spawn | 5 |
| Bug C: idleExitSec implemented, FIFO exit | 5 |
| Gag: auto-target farthest, no range, projectile arc | 6 |
| Gag description updated | 6 |
| Pause: button + Esc + tick guard | 7 |
| tsc clean, tests pass, build succeeds | 8 |

No TBD placeholders. All tasks completed.
