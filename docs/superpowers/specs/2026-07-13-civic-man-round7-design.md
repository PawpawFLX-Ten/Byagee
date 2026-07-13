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
| slap | 抽脸 | Slap Face|
| tape | 胶条 | Taping |
| megaphone | 吼 | Shout|
| gag | 塞嘴 | Mouth Dildoing|
| poop | 泼屎 | PoopWave|
| civility | 素质 | Civility|

### B. Skill Descriptions (`Briefing.tsx` SKILLS array)

#### Slap

| Field | 中文 | English |
|-------|------|---------|
| name | 抽脸 | Slap Face |
| unlock | 初始 | Default |
| pro | 手拍玩具抽脸，冷却最短，救急首选 | Solve the problem immediately|
| con | 沉默极短，治标不治本 | Too instant|
| perks | 2级起回血2 · 6级回血4 | Lv2 recover 2 HP · LV 6 recover 4 HP|

#### Tape

| Field | 中文 | English |
|-------|------|---------|
| name | 胶条 | Taping |
| unlock | 初始 | Default |
| pro | 伸手贴嘴，封得久，性价比体面 | Long mouth-taping, decent price-performance ratio|
| con | 要贴脸，慢半拍就白贴 | Get closed or get slowed |
| perks | 3级起降噪 · 7级降噪增强 | Lv3 · Lv7 De-Noise |

#### Megaphone

| Field | 中文 | English |
|-------|------|---------|
| name | 吼 | Shout |
| unlock | 初始 |Default |
| pro | 怒喝一声，范围静音 | Mute the surroundings using human voice |
| con | 以毒攻毒，文明蒙羞 | Violating silence by thyself|
| perks | 4级起回血2 · 8级回血4 | Lv4 recover 2 HP · LV 8 recover 4 HP|

#### Gag

| Field | 中文 | English |
|-------|------|---------|
| name | 塞嘴 |Mouth Dildoing |
| unlock | 初始 | Default |
| pro | 智能寻址最远嘴巴。入口柔，胰腺瘘 | Lockdown the farthest mouth with AI-Empowered Dildo |
| con | 冷却漫长，莫当普通拍子用 | Year long CD. Do no use it as normal slap |
| perks | 9级起 Boss双倍伤害 · 普通双倍封印 | Lv9 Boss damage doubled|

#### Poop

| Field | 中文 | English |
|-------|------|---------|
| name | 泼屎 |PoopWave |
| unlock | 5级解锁 | Lv 5 Unlock|
| pro | 眼界之内，自由飞翔 | Wave wherever your dream can reach |
| con | 谁也别吃了 | Everything would turn uneatable - but does it matter? |
| perks | 「请您吃顿好的 哈哈！」 | Have fun! |

#### Civility

| Field | 中文 | English |
|-------|------|---------|
| name | 素质 |Civility |
| unlock | 10级解锁 | Lv10 Unlock |
| pro | 搋子盖脸，十分炫酷 | Cover everyone's face with the ultimate literacy. Extremely cool and gentle |
| con | 虽然保险，不能回血 | Although it secures your environment, it - just like health insurance, doesn't cure |
| perks | 「素质，注意你丫的素质！」 | Be cool, man! |

### C. Briefing UI Text (`Briefing.tsx`)

| Key | 中文 | English |
|-----|------|---------|
| h1 | 你是行侠仗义的文明侠 | You are the justest CivicMan |
| donationBtn | ☕ 赞助作者 | Sponsor the Phookn Author|
| lede | 吧唧嘴亵渎了公共秩序，是对人类的终极犯罪。你将在食堂维护正义，用无情铁手让每个人吃饭闭嘴！ | Byagee Mouth greatly supplements cultural diversity and is the ultimate crime to humanity. You are going to shut everyone's lips while they are chewing and maintain the ultimate justice! |
| toolsH2 | 执法工具 请务必读完再丢人  | Toolsets - Please act with no shame after reading|
| nauseaLabel | 降低恶心音效（吧唧更闷、更礼貌） | Wearing headset so you don't hear Byagee|
| goBtn | 出警 · 开始制裁 | Yo yo yo! |
| footHint | WASD 移动 · 空格跳跃 · 拖拽转镜 · Tab 换目标 · 噪音越大掉血越狠 | WASD movement · Space for Jump · Drag with left-click change camera · Tab for Aiming · The noisier, the more destructive this dining hall is |

### D. HUD Text (`Hud.tsx`)

| Key | 中文 | English |
|-----|------|---------|
| hpLabel | HP | |
| noiseLabel | 噪音 | Noise |
| selfNoise | 自噪音 | SelfNoise |
| deathTitle | 吧唧致死 | Byagee to Die |
| deathRestart | 文明侠亦有殉职之日。按 R 再出警 | Civilization can fail. Press R to reincarnate.|
| restartBtn | 重开 | Reincarnate |
| hint | WASD · 拖拽转镜 · Tab 换目标 · 1拍 2胶条 3吼 4塞嘴 | WASD · Drag · Tab to Aim  · 1 Slap · 2 Tape · 3 Shout · 4 Dildo |
| toastCooldown | 技能冷却中 | Warming up is Cooling down|
| toastTooFar | 再靠近一点！ | Get Phooken Closer ya!|
| toastNoTarget | 没有目标 | Target lost |
| toastFail | 无法使用 | Unavailable|
| toastLevelUp | 升级！LV{n} | Level-UP! |

### E. Donation Modal (`DonationModal.tsx`)

| Key | 中文 | English |
|-----|------|---------|
| title | ☕ 吧唧钱包 | Byagee My Wallet|
| p1 | 本作在人类学意义上，冒犯了许多人。 | This work violated some cultural convention in the broadest anthropological sense|
| p2 | 如果您感到被冒犯，先向您下跪磕头，并诚恳请求您吃饭闭嘴 | If you feel violated, please you shut your mouth during chewing and accept my insignificant apology |
| p3 | 愿意支持作者，表示您愿意庄严承诺：咀嚼时把嘴闭上，并献出一点小小爱心支持作者在北京买房的宏图萎夜。 | If you'd like to spare a penny, you are seriously swearing to whoever or whatever you believe that you'd like to shut the lips during chewing and support the author's Mission Impussyble of buying a house. |
| afdianLink | 爱发电（微信/支付宝） | Afdian Support (WeChat/Alipay)|
| closeBtn | 关闭 | Shut the F....|

### F. Guide Tips (`store.ts` guideForElapsed)

| Time | 中文 | English |
|------|------|---------|
| < 3.5s | 靠近绕桌觅食的吧唧者——文明需要距离。 | |
| < 7s | 按 1：挥手拍玩具抽脸。短促有效。 | |
| < 11s | 2 贴胶条 · 3 怒吼「闭嘴」· 4 塞嘴大招。 | |

### G. Prop Toast (`props.ts`)

| Key | 中文 | English |
|-----|------|---------|
| heal | 回血 +{n} | HP + {n}|
| silence | 全场静音 {n}s | Global Muting {n}s and the First Amendament is Crucially violated!|

### H. Titles (`config.ts`)

| minTime | 中文 | English |
|---------|------|---------|
| 0 | 轻度洁癖 | Tiny Minded|
| 30 | 包间保安 | Table Warrior|
| 90 | 咀嚼克星 | Byagee Hunter|
| 180 | 食堂死神 | Death of Chewing|

### I. Scene 3D Text

| File | 中文 | English |
|------|------|---------|
| `Props.tsx` | 静 | Shhhhhh|
| `World.tsx` | (wall art text — TBD) | |
| `World.tsx` | (door couplet — TBD) | |
| `Npcs.tsx` | 吧唧 | Byagee |
| `App.tsx` | 请旋转手机横屏游玩 | Please rotate yer phone|

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
