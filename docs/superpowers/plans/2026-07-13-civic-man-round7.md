# Civic Man Round 7 — Implementation Plan

> **Status:** Completed. All tasks implemented and verified.

**Goal:** English + Dutch localization — i18n dictionary, language switcher, TTS engine switch, all strings translated.

**Architecture:** `i18n.ts` with flat `{ zh: {...}, en: {...}, nl: {...} }` dictionary + `t(key)` helper. Store holds `lang: Lang`. All hardcoded strings replaced with `t()` calls. TTS reads `getLang()` to set `u.lang` and voice search. Dutch uses English TTS voice.

**Tech Stack:** Vite, React 19, TypeScript, R3F, drei, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-07-13-civic-man-round7-design.md`

**Prerequisite:** Round 6 merged to master.

---

## Confirmed Translations

### TTS Shout Lines

| Key | 中文 | English |
|-----|------|---------|
| shoutLine | 都他妈把嘴闭上！ | Shut the phooken' mouths! |
| slapShoutLine | 操你妈 | Phook you! |
| tapeShoutLine | 给老子闭嘴！ | Weeeeave yer leeeeeeeeeeeeps |
| gagShoutLine | 吃屎吧你！ | Eat this sheeeiiiit |
| poopShoutLine | 请您吃顿好的 哈哈！ | Have fun, boy! |
| civilityShoutLine | 素质，注意你丫的素质！ | May byageee be with you |

### Key Terms

| 中文 | English |
|------|---------|
| 吧唧嘴 | Byageee Mouth |
| 吧唧者 | Byageee Mouth-er |
| 吧唧 | Byageee |

### Pending Translations

All remaining strings (skill names, descriptions, UI text, titles, guide tips, donation text, scene 3D text) are listed in the spec with empty English columns. These must be filled in before implementation begins.

---

## File structure

```
src/game/i18n.ts              # NEW — dictionary + t() helper
src/game/store.ts             # +lang, +setLang
src/game/config.ts            # shout lines → t() or lang-conditional
src/game/audio.ts             # TTS lang switch
src/game/props.ts             # toast text → t()
src/ui/Briefing.tsx           # all strings → t()
src/ui/Hud.tsx                # all strings → t()
src/ui/DonationModal.tsx      # all strings → t()
src/scene/Props.tsx           # 静 → t()
src/scene/World.tsx           # wall art / couplet → t()
src/scene/Npcs.tsx            # 吧唧 → t()
src/App.tsx                   # rotate overlay → t()
src/ui/TouchControls.tsx      # any Chinese → t()
src/game/__tests__/titles.test.ts    # language-aware
src/game/__tests__/slapShout.test.ts # language-aware
src/game/__tests__/configRound2.test.ts # language-aware
```

---

### Task 1: Create i18n module

**Files:**
- Create: `src/game/i18n.ts`

- [x] **Step 1: Create dictionary structure** — `zh` + `en` + `nl` dictionaries with ~100 keys each

- [x] **Step 2: Wire into store** — `lang: Lang`, `setLang()` calls `i18n.setLang()` + `set({ lang })`

---

### Task 2: TTS engine switch

**Files:**
- Modify: `src/game/audio.ts`

- [x] **Step 1: Read lang in playShoutVoice** — `getLang()` → `u.lang` (`zh`→`zh-CN`, `en`/`nl`→`en-US`), voice search, maleHint per language

---

### Task 3: Config shout lines → t()

**Files:**
- Modify: `src/game/audio.ts` (callers), `src/game/slapShout.ts`

- [x] Replace `CONFIG.slapShoutLine` etc. with `t('slapShoutLine')` at all call sites
- [x] Config fields kept as Chinese fallback (not removed)

---

### Task 4: Briefing strings → t()

**Files:**
- Modify: `src/ui/Briefing.tsx`

- [x] SKILLS array moved into `getSkills()` function using `t()` calls
- [x] Replace h1, lede, h2, button labels, hint, nausea label
- [x] Language switcher: cycling button (ZH→EN→NL→ZH), styled `.lang-btn` in header far-left

---

### Task 5: HUD strings → t()

**Files:**
- Modify: `src/ui/Hud.tsx`, `src/game/store.ts`

- [x] Replace meter labels, death screen, toast texts, hint
- [x] FAIL_TEXT → `failText()` function using `t()`
- [x] Skill names: `CONFIG.skills[id].displayName` → `t('skill_${id}')`

---

### Task 6: Donation modal strings → t()

**Files:**
- Modify: `src/ui/DonationModal.tsx`

- [x] Replace title, three paragraphs, link text, close button

---

### Task 7: Game logic strings → t()

**Files:**
- Modify: `src/game/props.ts`, `src/game/store.ts`, `src/game/titles.ts`

- [x] `props.ts`: heal/silence toast → `t()`
- [x] `store.ts`: `guideForElapsed` → `t()`, toast level-up → `t()`, skill toast → `t()`
- [x] `titles.ts`: `titleForTime` → `t()` with config minTime thresholds

---

### Task 8: Scene 3D text → t()

**Files:**
- Modify: `src/scene/Props.tsx`, `src/scene/World.tsx`, `src/scene/Npcs.tsx`, `src/App.tsx`

- [x] `Props.tsx`: 静 → `t('silenceChar')`
- [x] `World.tsx`: wall art (静/忍/食不言), couplet (天道酬勤/地道的您), shout banner → `t()`
- [x] `World.tsx`: language-aware `fontSize` for wall art (EN scales down for longer latin)
- [x] `World.tsx`: couplet EN per-character vertical (spaces removed, `split('').join('\n')`)
- [x] `Npcs.tsx`: status labels → `t()`
- [x] `App.tsx`: rotate overlay → `t()`
- [x] `TouchControls.tsx`: 跳/换 → `t()`

---

### Task 9: Update tests

**Files:**
- Modify: `src/game/__tests__/titles.test.ts`, `slapShout.test.ts`, `configRound2.test.ts`

- [x] `setLang('zh')` added before assertions in all 3 test files

---

### Task 10: Dutch (NL) localization

**Files:**
- Modify: `src/game/i18n.ts`, `src/game/audio.ts`, `src/ui/Briefing.tsx`

- [x] `Lang` type extended: `'zh' | 'en' | 'nl'`
- [x] Full `nl` dictionary (~100 keys) — all text translated to Dutch
- [x] TTS: `nl` uses English voice (`lang === 'zh' ? 'zh-CN' : 'en-US'`)
- [x] Toggle cycles: ZH→EN→NL→ZH (button shows next language code)

---

### Task 11: Post-implementation fixes

- [x] Wall art font sizing: EN dynamic `fontSize` scaling
- [x] Couplet EN: per-character vertical (not per-word)
- [x] HUD skill names: `t('skill_${id}')` instead of `CONFIG.skills[id].displayName`
- [x] Pause time jump: `pausedAt` tracking + `startedAt` shift on unpause
- [x] Jump over tables: skip table collision when airborne
- [x] Jump parameters: 500→650ms duration, 0.8→1.1 height, 800→900ms cooldown

---

### Task 12: Final verification

- [x] `npx tsc --noEmit` — zero errors
- [x] `npm test -- --run` — 59/59 passed
- [x] `npm run build` — success
- [x] Manual: ZH/EN/NL all switch correctly, TTS speaks EN voice for EN+NL

---

## Self-review (plan vs spec)

| Spec criterion | Task |
|----------------|------|
| i18n dictionary + t() helper (zh/en/nl) | 1, 10 |
| lang field in store + cycling switcher | 1, 4 |
| TTS switches u.lang + voice search (nl→en) | 2, 10 |
| Shout lines use confirmed English | 3 |
| Briefing all strings + switcher | 4 |
| HUD all strings + skill names | 5 |
| Donation modal all strings | 6 |
| Game logic strings (props, store, titles) | 7 |
| 3D scene text + font sizing | 8 |
| Tests language-aware | 9 |
| Dutch translations | 10 |
| Post-fix: pause, jump, wall art | 11 |
| tsc + tests + build | 12 |
