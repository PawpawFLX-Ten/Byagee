# Civic Man Round 7 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** English localization — i18n dictionary, language switcher, TTS engine switch, all strings translated.

**Architecture:** `i18n.ts` with flat `{ zh: {...}, en: {...} }` dictionary + `t(key)` helper. Store holds `lang: 'zh' | 'en'`. All hardcoded strings replaced with `t()` calls. TTS reads `lang` to set `u.lang` and voice search.

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

- [ ] **Step 1: Create dictionary structure**

```ts
export type Lang = 'zh' | 'en'

export const DICT: Record<Lang, Record<string, string>> = {
  zh: {
    // Shout lines
    shoutLine: '都他妈把嘴闭上！',
    slapShoutLine: '操你妈',
    tapeShoutLine: '给老子闭嘴！',
    gagShoutLine: '吃屎吧你！',
    poopShoutLine: '请您吃顿好的 哈哈！',
    civilityShoutLine: '素质，注意你丫的素质！',
    // Skill names
    skill_slap: '抽脸',
    skill_tape: '胶条',
    skill_megaphone: '吼',
    skill_gag: '塞嘴',
    skill_poop: '泼屎',
    skill_civility: '素质',
    // ... all keys from spec
  },
  en: {
    shoutLine: "Shut the phooken' mouths!",
    slapShoutLine: 'Phook you!',
    tapeShoutLine: 'Weeeeave yer leeeeeeeeeeeeps',
    gagShoutLine: 'Eat this sheeeiiiit',
    poopShoutLine: 'Have fun, boy!',
    civilityShoutLine: 'May byageee be with you',
    // ... all keys — TBD by user
  },
}

let currentLang: Lang = 'zh'

export function setLang(lang: Lang) { currentLang = lang }
export function getLang(): Lang { return currentLang }
export function t(key: string): string { return DICT[currentLang][key] ?? key }
```

- [ ] **Step 2: Wire into store**

Add `lang: Lang` and `setLang` to GameStore. On `setLang`, call `i18n.setLang(lang)`.

---

### Task 2: TTS engine switch

**Files:**
- Modify: `src/game/audio.ts`

- [ ] **Step 1: Read lang in playShoutVoice**

```ts
import { getLang } from './i18n'

export function playShoutVoice(line = t('shoutLine'), rate = 1.45) {
  const lang = getLang()
  u.lang = lang === 'en' ? 'en-US' : 'zh-CN'
  const prefix = lang === 'en' ? 'en' : 'zh'
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix))
  const maleHint = lang === 'en'
    ? /male|david|alex|daniel|fred/i
    : /male|男|kangkang|yunyang|yunjian|yunxi|hanhan|xiaomu|david/i
  // ... rest of voice selection
}
```

---

### Task 3: Config shout lines → t()

**Files:**
- Modify: `src/game/config.ts`
- Modify: `src/game/audio.ts` (callers)

- [ ] Replace `CONFIG.slapShoutLine` etc. with `t('slapShoutLine')` at all call sites
- [ ] Remove shout line fields from config (or keep as fallback)

---

### Task 4: Briefing strings → t()

**Files:**
- Modify: `src/ui/Briefing.tsx`

- [ ] Replace SKILLS array text with `t()` calls
- [ ] Replace h1, lede, h2, button labels, hint, nausea label
- [ ] Add language switcher button (ZH/EN toggle)

---

### Task 5: HUD strings → t()

**Files:**
- Modify: `src/ui/Hud.tsx`

- [ ] Replace meter labels, death screen, toast texts, hint
- [ ] Replace FAIL_TEXT in store.ts with t() calls

---

### Task 6: Donation modal strings → t()

**Files:**
- Modify: `src/ui/DonationModal.tsx`

- [ ] Replace title, three paragraphs, link text, close button

---

### Task 7: Game logic strings → t()

**Files:**
- Modify: `src/game/props.ts` (toast text)
- Modify: `src/game/store.ts` (guideForElapsed, FAIL_TEXT, toast texts)
- Modify: `src/game/config.ts` (titles array → t() or lang-conditional)

---

### Task 8: Scene 3D text → t()

**Files:**
- Modify: `src/scene/Props.tsx` (静 → t('silenceChar'))
- Modify: `src/scene/World.tsx` (wall art, couplet)
- Modify: `src/scene/Npcs.tsx` (吧唧 → t())
- Modify: `src/App.tsx` (rotate overlay)

---

### Task 9: Update tests

**Files:**
- Modify: `src/game/__tests__/titles.test.ts`
- Modify: `src/game/__tests__/slapShout.test.ts`
- Modify: `src/game/__tests__/configRound2.test.ts`

- [ ] Tests use `t()` with explicit lang, or test both languages

---

### Task 10: Final verification

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test -- --run` — all pass
- [ ] `npm run build` — success
- [ ] Manual: switch language, verify all text + TTS changes
- [ ] Manual: 吧唧嘴 → "Byageee Mouth" consistent everywhere

---

## Self-review (plan vs spec)

| Spec criterion | Task |
|----------------|------|
| i18n dictionary + t() helper | 1 |
| lang field in store + switcher | 1 |
| TTS switches u.lang + voice search | 2 |
| Shout lines use confirmed English | 3 |
| Briefing all strings + switcher | 4 |
| HUD all strings | 5 |
| Donation modal all strings | 6 |
| Game logic strings (props, store, config) | 7 |
| 3D scene text | 8 |
| Tests language-aware | 9 |
| tsc + tests + build | 10 |

---

## Risk Notes

1. **TTS voice availability:** English male voices vary by browser/OS. The fallback should pick any English voice if no male match is found.

2. **3D text fonts:** drei `<Text>` uses default fonts that may not render Chinese. Currently working for 静 — English equivalent ("Shh" or similar) should work fine.

3. **String interpolation:** Some strings have dynamic values (e.g., `回血 +${n}`, `升级！LV${n}`). The `t()` function should support simple `{n}` placeholder substitution.

4. **Test breakage:** 3 tests assert Chinese strings directly. These must be updated to either test `t()` with `lang='zh'` or test both languages.

5. **Pending translations:** Skill names, descriptions, UI text, titles, and scene text still need English translations from the user. Implementation is blocked until these are provided.
