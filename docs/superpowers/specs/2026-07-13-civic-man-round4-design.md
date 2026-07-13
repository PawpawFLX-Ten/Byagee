# Civic Man — Round 4 Design Spec

**Date:** 2026-07-13  
**Status:** Approved  
**Goal:** Add mobile landscape touch controls, a donation feature on the briefing screen, decorative wall art, Q/E skill icons, and a door couplet — all layered on top of the Round 3 foundation without replacing existing systems.

**Approach:** Additive-only mobile input layer (nipplejs + Zustand store) that runs parallel to the existing keyboard pipeline. Donation is config-driven external links (爱发电 + Ko-fi placeholder). Wall art and couplet are pure cosmetic R3F meshes. Q/E icons are SVG.

---

## One-liner

同一个包间生存循环，但现在手机横屏可以触屏游玩（虚拟摇杆+触摸转镜+技能按钮），开屏可以打赏作者（爱发电/Ko-fi），墙上挂着书法装饰，门框挂着红底金字对联，Q/E 技能终于有了真正的图标。

---

## Relationship to Round 3

| Keep | Change |
|------|--------|
| Keyboard + mouse input pipeline | Add parallel touch input pipeline (zero disruption to desktop) |
| Briefing start screen | Add "支持开发者" button + donation modal |
| Bare walls (semi-transparent) | Add decorative framed calligraphy on side walls |
| Placeholder circle for Q/E icons | Real SVG icons (poop swirl + plunger) |
| Bare door frame | Red-gold couplet on door flanks |

---

## 1. Mobile Landscape Adaptation

### Input Architecture

```
Desktop:                          Mobile:
  keys Set (keydown/keyup)          nipplejs static joystick (left)
       ↓                                  ↓
  Player.useFrame               inputStore (Zustand)
       ↑                              ↓
       └──────────── both sources merge ──→ Player.useFrame
```

- **Movement:** nipplejs `static` mode joystick, bottom-left of screen. Outputs normalized `(x, y)` vector to `inputStore`. Player's `useFrame` reads `inputStore.moveX / moveY` alongside existing `keys` Set — both sources are summed, desktop pipeline unchanged.
- **Camera:** OrbitControls already supports one-finger touch rotate natively. Right half of screen is the camera drag zone. No code change needed for camera — only CSS to ensure touch events reach OrbitControls.
- **Skills:** Existing 6 skill buttons in HUD already have `onClick`. Mobile CSS enlarges touch targets, adjusts spacing, and adds `touch-action: manipulation` to kill 300ms tap delay.
- **Tab (cycle target):** Add a dedicated touch button next to skill bar.
- **Jump (Space):** Add a dedicated touch button.

### TouchControls Component

New DOM overlay (`src/ui/TouchControls.tsx`), rendered above Canvas:
- `pointer-events: none` on container; `pointer-events: auto` only on interactive children
- Only visible on touch devices: CSS `@media (hover: none) and (pointer: coarse)` or JS `'ontouchstart' in window`
- Left joystick: nipplejs `static` mode, 130px, position `{ left: '70px', bottom: '70px' }`
- Skill buttons: reuse existing HUD skill buttons (already tappable), just CSS-adapted
- Jump button: circular, right side
- Tab button: small, near skill bar

### Orientation Handling

- **Cannot lock orientation** on iOS Safari (`screen.orientation.lock()` unsupported)
- **Strategy:** CSS `@media (orientation: portrait)` shows a full-screen overlay: "请旋转手机横屏游玩 📱↻"
- `manifest.json` with `"orientation": "landscape"` for PWA installs
- `screen.orientation` change event listener to auto-dismiss overlay when rotated

### CSS Changes

| Property | Value | Purpose |
|----------|-------|---------|
| `touch-action: none` | on `body`, `canvas` | Kill all browser gestures |
| `overscroll-behavior: none` | on `body` | Kill pull-to-refresh |
| `viewport-fit=cover` | meta tag | Full-bleed on notched devices |
| `env(safe-area-inset-*)` | HUD padding | Avoid notch/Dynamic Island |
| `dpr={[1, 1.5]}` | Canvas prop | Cap mobile GPU load |
| `user-scalable=no` | meta tag | Prevent pinch-zoom |

### Viewport Meta (updated)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

### Out of Scope

- iOS PWA full-screen standalone mode optimization (future round)
- Haptic feedback (vibration API)
- Mobile-specific difficulty rebalancing

---

## 2. Donation Feature

### Legal Context (researched)

| Risk | Mitigation |
|------|------------|
| Personal WeChat/Alipay QR on webpage = violation (PBOC 2022) | Do NOT embed personal QR codes directly |
| ICP license required for commercial activity in China | Host on GitHub Pages (US servers, no ICP needed) |
| "捐助" implies charitable donation (requires qualification) | Use "支持/打赏" wording, not "捐助" |
| Tax on tip income | Developer declares via 个税APP; platforms (爱发电) report to tax authority |

### Implementation

**Config-driven external links — no payment processing on the game site.**

```ts
// config.ts addition
donation: {
  afdianUrl: 'https://afdian.com/a/...',   // 爱发电 (domestic)
  kofiUrl: '',                              // Ko-fi (overseas) — empty until set up
  label: '支持开发者',
}
```

**UI flow:**
1. Briefing card bottom: small "☕ 支持开发者" link button
2. Click → DonationModal opens
3. Modal content:
   - "如果玩得开心，可以请作者喝杯咖啡"
   - 爱发电 button (primary, always visible) → opens `afdianUrl` in new tab
   - Ko-fi button (secondary, only if `kofiUrl` non-empty) → opens `kofiUrl` in new tab
   - Close button
4. Modal is a DOM overlay with `pointer-events: auto`, semi-transparent backdrop

**Wording:** Use "支持" / "请喝咖啡" — never "捐助" or "Donate" (avoid charitable donation implications).

### Out of Scope

- In-game payment / microtransactions
- Personal QR code images (legal risk)
- Donation perks / cosmetics

---

## 3. Wall Decorations

Replace the abandoned "wall ads" idea with **purely decorative wall art** — framed calligraphy and paintings, no real ads, no revenue.

### Design

- 2 framed pieces on the east wall, 1 on the west wall (3 total)
- Each frame: dark wood border (boxGeometry) + lighter canvas backing
- Canvas content options (mix and match):
  - **Calligraphy:** Single large character rendered via drei `<Text>` — "静", "忍", "食不言寝不语"
  - **Painting:** Simple geometric pattern (colored shapes on canvas backing) — procedural low-poly
- Frames hang at ~1.6m height, flush against semi-transparent walls
- `userData: { fadeWall: true }` so they fade with the wall occlusion system
- No interaction, no collision, purely visual

### Style Alignment

- Frame color: `#3d2817` (matching existing table leg wood)
- Canvas backing: `#efe6d8` (matching existing plate color)
- Calligraphy text color: `#1a1510` (ink black)
- Calligraphy font: default drei Text font, large size (~0.5 units)

---

## 4. Q/E Skill Icons

### Current State

`SkillIcon.tsx` has real SVG icons for slap/tape/megaphone/gag. Q (poop) and E (civility) use a **placeholder circle** — the code comment says "placeholder until visual agent adds icons".

### New Icons

| Skill | Icon Design | Visual Elements |
|-------|-------------|-----------------|
| **Q — 泼屎 (poop)** | Poop swirl | Classic poop emoji shape: rounded mound with swirl on top, 2-3 small flies nearby |
| **E — 素质 (civility)** | Toilet plunger | Wooden handle (vertical line) + rubber cup (semicircle at bottom) — matches the in-game plunger VFX |

Both icons follow the existing style: 22×22 viewBox, `strokeWidth: 1.8`, `strokeLinecap: round`, `currentColor` stroke.

### CSS

```css
.skill-icon-poop { background: #8b6914; }     /* brown */
.skill-icon-civility { background: #ffd700; }  /* gold */
```

---

## 5. Door Couplet

### Design

Traditional Chinese couplet (对联) on the door flanks:

| Position | Text | Placement |
|----------|------|-----------|
| 上联 (right side, +X) | 天道酬勤 | Red vertical strip, gold text |
| 下联 (left side, −X) | 地道的您 | Red vertical strip, gold text |

### Visual Specification

- **Strip:** `boxGeometry` thin plane, ~0.28 wide × 1.8 tall, positioned flanking the door frame
- **Color:** Red `#c0392b` (traditional spring festival red, aligned with warm earthy game palette)
- **Text:** drei `<Text>` component, gold `#ffd700`, vertical layout (characters stacked top-to-bottom)
- **Font size:** ~0.28 units per character
- **Position:** x = ±0.82 (just outside door pillars at ±0.62), y = 1.1 (centered on door height), z = −0.35 (flush with door frame)
- **No 横批** (user did not request one)

### Style Alignment

- Red/gold matches traditional Chinese aesthetic while the warm tones (`#c0392b` / `#ffd700`) complement the existing brown/gold room palette
- Strip material: `meshStandardMaterial` with slight roughness, not transparent (couplet should always be visible, unlike semi-transparent walls)

---

## Architecture

```
src/game/inputStore.ts           # NEW — Zustand store for touch movement vector
src/game/config.ts                # +donation config
src/ui/TouchControls.tsx          # NEW — nipplejs joystick + touch buttons (DOM overlay)
src/ui/DonationModal.tsx          # NEW — donation links modal
src/ui/Briefing.tsx               # +donation button
src/ui/Hud.tsx                    # +mobile CSS classes (jump/tab touch buttons)
src/ui/SkillIcon.tsx              # +poop and civility SVG icons
src/scene/World.tsx               # +WallArt component, +DoorCouplet in Door
src/index.css                     # +mobile media queries, touch-action, orientation overlay
index.html                        # +updated viewport meta, +manifest link
public/manifest.json              # NEW — PWA manifest with landscape orientation
package.json                      # +nipplejs dependency
```

Core game systems (store, skills, boss, door, threat, progression) — **zero changes**.

---

## Out of Scope (Round 4)

- PWA offline support / service worker
- Haptic feedback (vibration API)
- Mobile-specific difficulty balancing
- In-game payment / microtransactions
- Real ad networks
- Custom domain setup
- Ko-fi registration (developer will do separately; config placeholder ready)
- 横批 for the couplet

---

## Success Criteria

1. Mobile: virtual joystick appears on touch devices, controls player movement without breaking desktop keyboard input
2. Mobile: OrbitControls touch-drag rotates camera on right half of screen
3. Mobile: 6 skill buttons + Tab + Jump are comfortably tappable on phone landscape
4. Mobile: portrait orientation shows "请旋转手机" overlay; landscape shows game
5. Mobile: viewport meta + CSS prevents scroll/zoom/pull-to-refresh on touch devices
6. Donation: Briefing has "支持开发者" button → modal with 爱发电 link (Ko-fi placeholder hidden until configured)
7. Wall art: 3 framed calligraphy/painting decorations visible on side walls, fading with wall occlusion
8. Q/E icons: poop and civility have distinct SVG icons (no more placeholder circle)
9. Couplet: red-gold 天道酬勤 / 地道的您 visible on door flanks
10. Desktop experience: zero regression — keyboard, mouse, all existing features unchanged
11. `npm test` passes; `npm run build` succeeds; tsc clean
