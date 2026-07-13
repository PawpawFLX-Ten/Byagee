# Civic Man — Round 6 Design Spec

**Date:** 2026-07-13  
**Status:** Completed  
**Goal:** Polish the briefing UI, fix three door-system bugs that caused NPC entry/exit stalls, rework the gag skill into an auto-targeting ranged ability, implement the dead `idleExitSec` config, add dynamic smack damage delay scaling, and add a pause system.

**Approach:** Surgical fixes to `doorSystem.ts` and `store.ts` for bug resolution. Gag rework adds `pickFarthestSmacker` to `skills.ts` with range bypass. Pause system adds `paused` boolean to the Zustand store with tick early-return. UI changes are CSS + JSX only — no logic changes.

---

## One-liner

开屏画面精简重排，赞助弹窗改版；修复 Boss 满员不入场、门禁冻结、被击败 Boss 不出门三个 bug；塞嘴技能改为自动锁定最远吧唧者并带弹道飞行动画；噪音杀伤延迟按 Boss 区段从 3s 线性递减到 1.5s；新增暂停键。

---

## Relationship to Round 5

| Keep | Change |
|------|--------|
| All Round 5 features (props, heal, silence talisman) | Briefing layout overhauled |
| Door system / NPC FSM / Boss / threat systems | 3 door-system bugs fixed |
| Gag skill (sealed status, 8s duration, 14s CD) | Auto-target farthest smacker, no range limit, projectile animation |
| Static `smackDamageDelaySec: 1.5` | Dynamic: 3.0s → 1.5s per boss era |
| No pause | Pause button + Esc key |

Round 6 depends on Round 2+3 (door system, Boss) and Round 4 (briefing UI, donation).

---

## Feature Areas

### 1. Briefing UI Overhaul

| Property | Before | After |
|----------|--------|-------|
| Eyebrow line | "包间静音署 · 特派公文" | Removed |
| Lede text | "...告诉每一个人：吃饭时，把嘴闭上！" | "...让每个人吃饭闭嘴！" |
| 等级制度 section | Present | Removed |
| Donation button | Full-width trigger at bottom | Compact button in h1 header row (space-between) |
| Scrollbar | `overflow: auto` on card + container | `overflow: hidden` — no scrollbars on any device |
| Font sizes | h1 24px, lede 13px, h2 14px | h1 26px, lede 14px, h2 15px |
| Mobile skill list | 1 column | 2 columns (saves vertical space) |

### 2. Donation Modal

| Property | Value |
|----------|-------|
| Title | "☕ 吧唧钱包" |
| Text | Three paragraphs, `text-align: justify` |
| 爱发电 link | `https://ifdian.net/a/patatamaster` |
| Paragraph 1 | "本作在人类学意义上，冒犯了许多人。" |
| Paragraph 2 | "如果您感到被冒犯，先向您下跪磕头，并诚恳请求您吃饭闭嘴" |
| Paragraph 3 | "愿意支持作者，表示您愿意庄严承诺：咀嚼时把嘴闭上，并献出一点小小爱心支持作者在北京买房的宏图萎夜。" |

### 3. Skill Icon Colors

| Skill | Before | After | Icon Color |
|-------|--------|-------|------------|
| 抽脸 (slap) | `#ffdd66` (yellow) | `#1a3a6c` (dark blue) | `#fff8f0` |
| 泼屎 (poop) | `#8b6914` (dark gold) | `#1a4d2e` (dark green) | `#fff8f0` |

### 4. Dynamic Smack Damage Delay

Old: static `smackDamageDelaySec: 1.5` (never changed).

New: `smackDamageDelayFor(elapsedSec)` computes delay based on boss era:

```
era = floor(elapsedSec / boss.intervalSec)   // boss every 180s
delay = max(minSec, initialSec - decayPerEra * era)
```

| Config | Value |
|--------|-------|
| `smackDelay.initialSec` | 3.0 |
| `smackDelay.decayPerEra` | 0.5 |
| `smackDelay.minSec` | 1.5 |

| Boss era | Time | Delay |
|----------|------|-------|
| 0 (before first boss) | 0–3 min | 3.0s |
| 1 | 3–6 min | 2.5s |
| 2 | 6–9 min | 2.0s |
| 3+ | 9+ min | 1.5s (floor) |

### 5. Door System Bug Fixes

#### Bug A: Boss spawn fails at cap

**Root cause:** `applyDoorAction` for eviction only marks `exiting: true` — doesn't remove NPC from array. `npcs.length` stays at 10, `npcs.length < maxNpcs` fails, boss doesn't spawn. `nextBossAtElapsed` already advanced — boss skipped for 180s.

**Fix:** For boss admission eviction, directly filter out the evicted NPC (`npcs.filter(n => n.id !== admission.npcId)`) instead of using `applyDoorAction`.

#### Bug B: `lastDoorEventAt` shared between boss spawn and normal traffic

**Root cause:** Boss spawn sets `lastDoorEventAt = now`. The immediately-following `planDoorAction` checks `now - lastDoorEventAt < 16000` → returns null. 16-second door freeze every 3 minutes.

**Fix:** Remove `lastDoorEventAt = now` from boss spawn section. Boss spawn no longer consumes the door cooldown.

#### Bug C: `idleExitSec` dead code — defeated bosses never exit

**Root cause:** `CONFIG.door.idleExitSec = 18` defined but never read. Exit purely rank-based (silenced > idle > walking > smacking). Demoted boss quickly becomes smacking (rank 3, lowest priority) and never gets exited.

**Fix:** 
- `pickExitCandidate` now accepts `now` parameter
- NPCs with `now - idleSince > idleExitSec * 1000` get rank -1 (force-exit priority)
- Same-rank NPCs sorted by `idleSince` ascending (oldest entry first = FIFO cycling)

### 6. Gag Skill Rework

| Property | Before | After |
|----------|--------|-------|
| Target | Manual (Tab) or nearest smacker | Auto: farthest smacker |
| Range | 2.1m | Unlimited |
| Projectile | None (instant hit) | Purple capsule arcs from player to target |
| Cooldown | 14s | 14s (unchanged) |
| Duration | 8s sealed | 8s sealed (unchanged) |
| 9-level perk | Double damage/seal | Unchanged |
| Description | "道具塞入嘴里，超长安静" | "智能寻址最远嘴巴。入口柔，胰腺瘘" |

**Design intent:** Gag becomes the "fire-and-forget" ultimate — press 4, the farthest threat is silenced. 14s cooldown is the limiter. Player can't choose which NPC — the skill always hits the farthest smacker, adding strategic uncertainty.

### 7. Pause System

| Property | Value |
|----------|-------|
| Button | ⏸ / ▶ toggle, 32×32px, left of HP bar |
| Keyboard | Escape |
| Store field | `paused: boolean` |
| Tick behavior | Early return if `state.paused` |
| Reset | `paused: false` on `beginMission()` (restart un-pauses) |

---

## Architecture

```
src/game/types.ts              # smackDelay config block, paused field on GameStore
src/game/config.ts             # smackDelay: { initialSec, decayPerEra, minSec }
src/game/threat.ts             # +smackDamageDelayFor(elapsedSec), computeThreat accepts elapsedSec
src/game/doorSystem.ts         # pickExitCandidate(npcs, now), planBossAdmission(npcs, now)
src/game/skills.ts             # +pickFarthestSmacker, gag special-case in tryUseSkill
src/game/store.ts              # +paused, +togglePause, tick guard, faceYawToTarget gag branch
src/scene/SkillFx.tsx          # +projectile ref + arc animation for gag
src/ui/Briefing.tsx            # Layout overhaul: header row, no eyebrow, no 等级制度
src/ui/DonationModal.tsx       # Three paragraphs, justified, new text + link
src/ui/Hud.tsx                 # +pause button, +Esc handler
src/index.css                  # .pause-btn, .briefing-header, .donation-btn, skill icon colors
```

---

## Success Criteria

1. Briefing has no eyebrow, no 等级制度, donation button in header row, no scrollbars on any device
2. Donation modal shows three justified paragraphs with correct text and afdian link
3. Slap icon is dark blue, poop icon is dark green, both with light icon color
4. Smack damage delay starts at 3.0s, decreases by 0.5s per boss era, floors at 1.5s
5. Boss spawns correctly at cap (evicted NPC removed immediately, boss takes the slot)
6. Boss spawn does not delay normal door traffic
7. Demoted bosses eventually exit the room (FIFO cycling via idleSince tiebreaker + idleExitSec)
8. Gag auto-targets the farthest smacking NPC, ignores range, shows projectile arc
9. Pause button freezes game state (tick early-return), Esc toggles, restart un-pauses
10. `npm test` passes; `npm run build` succeeds; tsc clean

---

## Out of Scope

- English localization (next round)
- Additional gag mechanics (chain, AoE, etc.)
- Pause overlay / dim screen
- Configurable pause hotkey
- Mobile-specific pause button styling
