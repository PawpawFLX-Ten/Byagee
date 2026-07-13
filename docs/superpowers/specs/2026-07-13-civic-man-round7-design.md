# Civic Man — Round 7 Design Spec

**Date:** 2026-07-13  
**Status:** Draft  
**Goal:** English localization of all user-facing text and TTS voice lines. Add a `lang` field to the store with a language switcher. All strings extracted into an i18n dictionary.

**Approach:** Lightweight `src/game/i18n.ts` with a flat key→value dictionary per language. A `t(key)` helper reads `lang` from the store. TTS engine switches `u.lang` and voice search based on language. 3D text in scene uses `t()` for conditional rendering.

---

## One-liner

将全游戏中文文案和 TTS 语音切换为英文版，新增语言切换器。吧唧嘴 → "Byageee Mouth"，喊话台词全部替换为英文俚语版。

---

## Relationship to Round 6

| Keep | Change |
|------|--------|
| All Round 6 features (UI polish, bug fixes, gag rework, pause) | All hardcoded strings → `t()` dictionary lookups |
| TTS engine (browser SpeechSynthesis) | `u.lang` + voice search switches `zh-CN` → `en-US` |
| Skill names / descriptions / shout lines | Translated to English |
| 3D text (静, wall art, couplet) | Conditional rendering per language |

---

## TTS Shout Lines (Confirmed)

| Key | Skill | 中文 | English |
|-----|-------|------|---------|
| `shoutLine` | 吼 (megaphone) | 都他妈把嘴闭上！ | Shut the phooken' mouths! |
| `slapShoutLine` | 抽脸 (slap) | 操你妈 | Phook you! |
| `tapeShoutLine` | 胶条 (tape) | 给老子闭嘴！ | Weeeeave yer leeeeeeeeeeeeps |
| `gagShoutLine` | 塞嘴 (gag) | 吃屎吧你！ | Eat this sheeeiiiit |
| `poopShoutLine` | 泼屎 (poop) | 请您吃顿好的 哈哈！ | Have fun, boy! |
| `civilityShoutLine` | 素质 (civility) | 素质，注意你丫的素质！ | May byageee be with you |

## Key Term Mapping

| 中文 | English |
|------|---------|
| 吧唧嘴 | Byageee Mouth |
| 吧唧者 | Byageee Mouth-er |
| 吧唧 | Byageee |

---

## String Inventory (To Translate)

### A. Skill Display Names (`config.ts`)

| Key | 中文 | English |
|-----|------|---------|
| slap | 抽脸 | |
| tape | 胶条 | |
| megaphone | 吼 | |
| gag | 塞嘴 | |
| poop | 泼屎 | |
| civility | 素质 | |

### B. Skill Descriptions (`Briefing.tsx` SKILLS array)

#### Slap

| Field | 中文 | English |
|-------|------|---------|
| name | 抽脸 | |
| unlock | 初始 | |
| pro | 手拍玩具抽脸，冷却最短，救急首选 | |
| con | 沉默极短，治标不治本 | |
| perks | 2级起回血2 · 6级回血4 | |

#### Tape

| Field | 中文 | English |
|-------|------|---------|
| name | 胶条 | |
| unlock | 初始 | |
| pro | 伸手贴嘴，封得久，性价比体面 | |
| con | 要贴脸，慢半拍就白贴 | |
| perks | 3级起降噪 · 7级降噪增强 | |

#### Megaphone

| Field | 中文 | English |
|-------|------|---------|
| name | 吼 | |
| unlock | 初始 | |
| pro | 怒喝「都他妈把嘴闭上」，范围静音 | |
| con | 你自己也变噪音——以毒攻毒，文明蒙羞 | |
| perks | 4级起回血2 · 8级回血4 | |

#### Gag

| Field | 中文 | English |
|-------|------|---------|
| name | 塞嘴 | |
| unlock | 初始 | |
| pro | 智能寻址最远嘴巴。入口柔，胰腺瘘 | |
| con | 冷却漫长，莫当普通拍子用 | |
| perks | 9级起 Boss双倍伤害 · 普通双倍封印 | |

#### Poop

| Field | 中文 | English |
|-------|------|---------|
| name | 泼屎 | |
| unlock | 5级解锁 | |
| pro | 眼界之内，自由飞翔 | |
| con | 谁也别吃了 | |
| perks | 「请您吃顿好的 哈哈！」 | |

#### Civility

| Field | 中文 | English |
|-------|------|---------|
| name | 素质 | |
| unlock | 10级解锁 | |
| pro | 搋子盖脸，十分炫酷 | |
| con | 虽然保险，不能回血 | |
| perks | 「素质，注意你丫的素质！」 | |

### C. Briefing UI Text (`Briefing.tsx`)

| Key | 中文 | English |
|-----|------|---------|
| h1 | 你是行侠仗义的文明侠 | |
| donationBtn | ☕ 赞助作者 | |
| lede | 吧唧嘴亵渎了公共秩序，是对人类的终极犯罪。你将在食堂维护正义，用无情铁手让每个人吃饭闭嘴！ | |
| toolsH2 | 执法工具（请务必读完再丢人） | |
| nauseaLabel | 降低恶心音效（吧唧更闷、更礼貌） | |
| goBtn | 出警 · 开始制裁 | |
| footHint | WASD 移动 · 空格跳跃跨人 · 拖拽转镜 · Tab 换目标 · 噪音越大掉血越狠 | |

### D. HUD Text (`Hud.tsx`)

| Key | 中文 | English |
|-----|------|---------|
| hpLabel | HP | |
| noiseLabel | 噪音 | |
| selfNoise | 自噪音 | |
| deathTitle | 吧唧致死 | |
| deathRestart | 文明侠亦有殉职之日。按 R 再出警 | |
| restartBtn | 重开 | |
| hint | WASD · 拖拽转镜 · Tab 换目标 · 1拍 2胶条 3吼 4塞嘴 | |
| toastCooldown | 技能冷却中 | |
| toastTooFar | 再靠近一点！ | |
| toastNoTarget | 没有目标 | |
| toastFail | 无法使用 | |
| toastLevelUp | 升级！LV{n} | |

### E. Donation Modal (`DonationModal.tsx`)

| Key | 中文 | English |
|-----|------|---------|
| title | ☕ 吧唧钱包 | |
| p1 | 本作在人类学意义上，冒犯了许多人。 | |
| p2 | 如果您感到被冒犯，先向您下跪磕头，并诚恳请求您吃饭闭嘴 | |
| p3 | 愿意支持作者，表示您愿意庄严承诺：咀嚼时把嘴闭上，并献出一点小小爱心支持作者在北京买房的宏图萎夜。 | |
| afdianLink | 爱发电（微信/支付宝） | |
| closeBtn | 关闭 | |

### F. Guide Tips (`store.ts` guideForElapsed)

| Time | 中文 | English |
|------|------|---------|
| < 3.5s | 靠近绕桌觅食的吧唧者——文明需要距离。 | |
| < 7s | 按 1：挥手拍玩具抽脸。短促有效。 | |
| < 11s | 2 贴胶条 · 3 怒吼「闭嘴」· 4 塞嘴大招。 | |

### G. Prop Toast (`props.ts`)

| Key | 中文 | English |
|-----|------|---------|
| heal | 回血 +{n} | |
| silence | 全场静音 {n}s | |

### H. Titles (`config.ts`)

| minTime | 中文 | English |
|---------|------|---------|
| 0 | 轻度洁癖 | |
| 30 | 包间保安 | |
| 90 | 咀嚼克星 | |
| 180 | 食堂死神 | |

### I. Scene 3D Text

| File | 中文 | English |
|------|------|---------|
| `Props.tsx` | 静 | |
| `World.tsx` | (wall art text — TBD) | |
| `World.tsx` | (door couplet — TBD) | |
| `Npcs.tsx` | 吧唧 | |
| `App.tsx` | 请旋转手机横屏游玩 | |

---

## Architecture

```
src/game/i18n.ts              # NEW — flat dictionary { zh: {...}, en: {...} } + t(key, lang)
src/game/store.ts             # +lang: 'zh' | 'en', +setLang()
src/game/config.ts            # shout lines → t() references
src/game/audio.ts             # playShoutVoice reads lang → u.lang + voice search
src/game/props.ts             # toast text → t()
src/ui/Briefing.tsx           # all strings → t()
src/ui/Hud.tsx                # all strings → t()
src/ui/DonationModal.tsx      # all strings → t()
src/scene/Props.tsx           # 静 → t('silenceChar')
src/scene/World.tsx           # wall art / couplet → t()
src/scene/Npcs.tsx            # 吧唧 → t()
src/App.tsx                   # rotate overlay → t()
src/ui/TouchControls.tsx      # any Chinese → t()
```

---

## TTS Engine Changes (`audio.ts`)

```ts
// Before:
u.lang = 'zh-CN'
const zhVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('zh'))
const maleHint = /male|男|kangkang|yunyang|.../i

// After:
const lang = useGameStore.getState().lang  // 'zh' | 'en'
u.lang = lang === 'en' ? 'en-US' : 'zh-CN'
const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'zh'))
const maleHint = lang === 'en'
  ? /male|david|alex|daniel|fred/i
  : /male|男|kangkang|yunyang|.../i
```

---

## Success Criteria

1. Language switcher (ZH/EN) accessible from briefing or HUD
2. All user-facing text switches language instantly
3. TTS uses English voice and pronunciation for shout lines
4. 3D text in scene renders language-appropriate characters
5. 吧唧嘴 → "Byageee Mouth" consistently across all text
6. All 6 shout lines use confirmed English translations
7. Tests updated to be language-aware
8. `npm test` passes; `npm run build` succeeds; tsc clean

---

## Out of Scope

- Third language support
- Pre-recorded audio files (TTS only)
- RTL language support
- Dynamic font loading per language
- Localization of error messages / console logs
