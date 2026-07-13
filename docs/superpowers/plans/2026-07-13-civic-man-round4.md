# Civic Man Round 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile landscape touch controls, donation feature, wall decorations, Q/E skill icons, and door couplet on top of the Round 3 codebase.

**Architecture:** Additive-only. New `inputStore.ts` (Zustand) + `TouchControls.tsx` (DOM overlay) run parallel to existing keyboard pipeline. Donation is config-driven external links. Wall art + couplet are pure R3F meshes. Q/E icons are SVG.

**Tech Stack:** Vite, React 19, TypeScript, R3F, drei, Zustand, nipplejs (NEW), Vitest

**Spec:** `docs/superpowers/specs/2026-07-13-civic-man-round4-design.md`

---

## File structure

```
src/game/inputStore.ts           # NEW — touch movement Zustand store
src/game/config.ts               # +donation config block
src/game/types.ts                # +DonationConfig interface
src/ui/TouchControls.tsx         # NEW — nipplejs joystick + touch buttons
src/ui/DonationModal.tsx         # NEW — donation links modal
src/ui/Briefing.tsx              # +donation button
src/ui/Hud.tsx                   # +mobile touch buttons (jump/tab)
src/ui/SkillIcon.tsx             # +poop + civility SVG icons (replace placeholder)
src/scene/World.tsx              # +WallArt component, +DoorCouplet in Door
src/index.css                    # +mobile media queries, touch CSS, orientation overlay
index.html                       # +updated viewport meta, +manifest link
public/manifest.json             # NEW — PWA manifest (landscape orientation)
package.json                     # +nipplejs
```

---

### Task 0: Merge worktree to master

**Goal:** Bring Round 2 + Round 3 code from `feature/civic-man-round2` into `master` so Round 4 builds on the full codebase.

- [ ] **Step 1: Verify worktree is clean and tests pass**

```bash
cd .worktrees/civic-man-round2
npm test
npm run build
```

- [ ] **Step 2: Merge to master**

```bash
cd E:\Development Work\Civic Man
git merge feature/civic-man-round2
```

If conflicts, resolve favoring the worktree branch (it has the complete Round 2+3 implementation).

- [ ] **Step 3: Verify master**

```bash
npm install
npm test
npm run build
```

- [ ] **Step 4: Commit merge**

```bash
git add -A
git commit -m "merge: bring Round 2+3 (door, boss, XP, Q/E skills) into master"
```

---

### Task 1: Install nipplejs + create input store

**Files:**
- Modify: `package.json`
- Create: `src/game/inputStore.ts`

- [ ] **Step 1: Install nipplejs**

```bash
npm install nipplejs
```

- [ ] **Step 2: Create `src/game/inputStore.ts`**

```ts
import { create } from 'zustand'

/**
 * Touch input store — parallel to the keyboard `keys` Set in World.tsx.
 * Desktop pipeline is untouched; Player.useFrame reads both sources.
 */
interface InputState {
  /** Normalized movement vector from virtual joystick, range [-1, 1] */
  moveX: number
  moveY: number
  /** Whether the touch joystick is currently active */
  touchActive: boolean
  setMove: (x: number, y: number) => void
  reset: () => void
}

export const useInputStore = create<InputState>((set) => ({
  moveX: 0,
  moveY: 0,
  touchActive: false,
  setMove: (x, y) => set({ moveX: x, moveY: y, touchActive: x !== 0 || y !== 0 }),
  reset: () => set({ moveX: 0, moveY: 0, touchActive: false }),
}))
```

- [ ] **Step 3: Verify import resolves**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/game/inputStore.ts
git commit -m "feat: add nipplejs dependency and touch input store"
```

---

### Task 2: TouchControls component

**Files:**
- Create: `src/ui/TouchControls.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/ui/TouchControls.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import nipplejs, { type JoystickManager } from 'nipplejs'
import { useInputStore } from '../game/inputStore'
import { useGameStore } from '../game/store'

/** Detects touch device — component renders nothing on desktop. */
function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])
  return isTouch
}

export function TouchControls() {
  const isTouch = useIsTouch()
  const joystickZone = useRef<HTMLDivElement>(null)
  const managerRef = useRef<JoystickManager | null>(null)
  const setMove = useInputStore((s) => s.setMove)
  const reset = useInputStore((s) => s.reset)
  const useSkill = useGameStore((s) => s.useSkill)
  const cycle = useGameStore((s) => s.cycleTarget)
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)

  useEffect(() => {
    if (!isTouch || !joystickZone.current) return

    const manager = nipplejs.create({
      zone: joystickZone.current,
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      size: 130,
      fadeTime: 0,
      restOpacity: 0.5,
    })

    manager.on('move', (_, data) => {
      setMove(data.vector.x, data.vector.y)
    })
    manager.on('end', () => {
      reset()
    })

    managerRef.current = manager
    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [isTouch, setMove, reset])

  if (!isTouch || !briefingDone) return null

  return (
    <div className="touch-controls">
      {/* Left half: joystick zone (transparent, captures touch for nipplejs) */}
      <div ref={joystickZone} className="joystick-zone" />

      {/* Right side: action buttons */}
      <div className="touch-actions">
        <button
          className="touch-btn jump-btn"
          onPointerDown={(e) => {
            e.preventDefault()
            // Simulate spacebar press for jump
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
          }}
          onPointerUp={() => {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
          }}
          disabled={!alive}
        >
          跳
        </button>
        <button
          className="touch-btn tab-btn"
          onPointerDown={(e) => {
            e.preventDefault()
            cycle()
          }}
          disabled={!alive}
        >
          换
        </button>
      </div>
    </div>
  )
}
```

Note: Skill buttons are already in `Hud.tsx` with `onClick` handlers. On mobile they just need CSS enlargement (Task 4). The jump button dispatches a synthetic Space keydown so the existing jump logic in `Player.useFrame` works unchanged.

- [ ] **Step 2: Add to `App.tsx`**

```tsx
import { TouchControls } from './ui/TouchControls'

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <Hud />
      <Briefing />
      <TouchControls />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/TouchControls.tsx src/App.tsx
git commit -m "feat: add TouchControls component with virtual joystick"
```

---

### Task 3: Player movement integration

**Files:**
- Modify: `src/scene/World.tsx` (Player component's `useFrame`)

- [ ] **Step 1: Read touch input in Player.useFrame**

In the `Player` component's `useFrame` callback, after the existing keyboard input reads, add touch input from `useInputStore`:

```tsx
import { useInputStore } from '../game/inputStore'

// Inside Player component:
const touchMoveX = useInputStore((s) => s.moveX)
const touchMoveY = useInputStore((s) => s.moveY)

// In useFrame, replace the input reading section:
if (!acting) {
  let forwardInput = 0
  let strafeInput = 0

  // Keyboard
  if (keys.has('KeyW') || keys.has('ArrowUp')) forwardInput += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) forwardInput -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) strafeInput += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) strafeInput -= 1

  // Touch (joystick y is inverted: up = negative in nipplejs, but we want up = forward = +1)
  forwardInput += touchMoveY
  strafeInput += touchMoveX

  // Clamp to [-1, 1] in case both sources are active
  forwardInput = Math.max(-1, Math.min(1, forwardInput))
  strafeInput = Math.max(-1, Math.min(1, strafeInput))

  if (forwardInput !== 0 || strafeInput !== 0) {
    // ... existing movement code (camera direction, moveWithCollision, etc.)
  }
  // ... rest unchanged
}
```

Key points:
- `touchMoveY` from nipplejs: up = +1 (nipplejs `data.vector.y` is +1 up). Verify sign during testing — if inverted, negate.
- Both sources are summed then clamped. If only keyboard is used, touch values are 0 (no effect). If only touch, keyboard values are 0.
- **No change to the movement math itself** — just the input source.

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Desktop: WASD still works exactly as before. (Touch controls invisible on desktop.)

- [ ] **Step 3: Commit**

```bash
git add src/scene/World.tsx
git commit -m "feat: integrate touch joystick input into Player movement"
```

---

### Task 4: Mobile CSS + orientation + viewport

**Files:**
- Modify: `index.html`
- Create: `public/manifest.json`
- Modify: `src/index.css`

- [ ] **Step 1: Update viewport meta in `index.html`**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="manifest" href="/manifest.json" />
```

- [ ] **Step 2: Create `public/manifest.json`**

```json
{
  "name": "Civic Man",
  "short_name": "Civic Man",
  "display": "fullscreen",
  "orientation": "landscape",
  "start_url": "/",
  "background_color": "#1e1a16",
  "theme_color": "#1e1a16",
  "icons": []
}
```

- [ ] **Step 3: Add mobile CSS to `src/index.css` (append)**

```css
/* === Mobile Touch Controls === */

.touch-controls {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 15;
  display: none;
}

@media (hover: none) and (pointer: coarse) {
  .touch-controls {
    display: block;
  }
}

.joystick-zone {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 45%;
  height: 60%;
  pointer-events: auto;
  touch-action: none;
}

.touch-actions {
  position: absolute;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: auto;
}

.touch-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(30, 24, 18, 0.7);
  color: #fff8f0;
  font-size: 14px;
  font-weight: 600;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  cursor: pointer;
}

.touch-btn:active {
  background: rgba(60, 50, 40, 0.85);
}

.touch-btn:disabled {
  opacity: 0.4;
}

/* === Mobile HUD Adaptation === */

@media (hover: none) and (pointer: coarse) {
  .top-bar {
    padding: max(8px, env(safe-area-inset-top)) 12px 8px;
    gap: 8px;
  }

  .meter {
    min-width: 100px;
  }

  .meter span {
    font-size: 10px;
  }

  .meta {
    gap: 8px;
    font-size: 11px;
  }

  .hud-nausea {
    display: none;
  }

  .skills {
    bottom: max(12px, env(safe-area-inset-bottom));
    gap: 6px;
  }

  .skill {
    min-width: 52px;
    padding: 8px 6px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .skill kbd {
    display: none;
  }

  .hint {
    display: none;
  }

  .briefing-card {
    max-height: 100vh;
    padding: 16px;
  }

  .skill-list {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .briefing h1 {
    font-size: 20px;
  }

  .briefing .lede {
    font-size: 12px;
  }
}

/* === Orientation Overlay === */

.rotate-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 100;
  align-items: center;
  justify-content: center;
  background: #1e1a16;
  color: #fff8f0;
  font-size: 18px;
  text-align: center;
  padding: 40px;
}

@media (hover: none) and (pointer: coarse) and (orientation: portrait) {
  .rotate-overlay {
    display: flex;
  }
}

/* === Global touch prevention === */

@media (hover: none) and (pointer: coarse) {
  html, body {
    touch-action: none;
    overscroll-behavior: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  canvas {
    touch-action: none;
  }
}
```

- [ ] **Step 4: Add rotate overlay to `App.tsx`**

```tsx
export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <Hud />
      <Briefing />
      <TouchControls />
      <div className="rotate-overlay">
        <div>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📱↻</p>
          <p>请旋转手机横屏游玩</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add Canvas DPR cap in `GameCanvas.tsx`**

```tsx
<Canvas
  shadows
  dpr={[1, 1.5]}
  camera={{ position: [5, 4.2, 6.5], fov: 48, near: 0.1, far: 80 }}
  style={{ width: '100%', height: '100%' }}
>
```

- [ ] **Step 6: Commit**

```bash
git add index.html public/manifest.json src/index.css src/App.tsx src/scene/GameCanvas.tsx
git commit -m "feat: mobile CSS, orientation overlay, viewport meta, PWA manifest"
```

---

### Task 5: Donation feature

**Files:**
- Modify: `src/game/types.ts` — add `DonationConfig`
- Modify: `src/game/config.ts` — add `donation` block
- Create: `src/ui/DonationModal.tsx`
- Modify: `src/ui/Briefing.tsx` — add donation button
- Modify: `src/index.css` — modal styles

- [ ] **Step 1: Add DonationConfig type**

In `src/game/types.ts`, append:

```ts
export interface DonationConfig {
  afdianUrl: string
  kofiUrl: string
  label: string
}
```

Add to `GameConfig` interface:

```ts
donation: DonationConfig
```

- [ ] **Step 2: Add donation config**

In `src/game/config.ts`, add to `CONFIG`:

```ts
donation: {
  afdianUrl: 'https://afdian.com/a/your-username',  // Replace with actual URL
  kofiUrl: '',                                        // Empty until Ko-fi is set up
  label: '支持开发者',
},
```

- [ ] **Step 3: Create `src/ui/DonationModal.tsx`**

```tsx
import { CONFIG } from '../game/config'

export function DonationModal({ onClose }: { onClose: () => void }) {
  const { afdianUrl, kofiUrl } = CONFIG.donation

  return (
    <div className="donation-modal" onClick={onClose}>
      <div className="donation-card" onClick={(e) => e.stopPropagation()}>
        <h2>☕ 请作者喝杯咖啡</h2>
        <p className="donation-lede">
          这是一款免费的无盈利游戏。如果你玩得开心，可以支持一下开发者——纯自愿，不影响任何游戏体验。
        </p>

        <a
          className="donation-link afdian"
          href={afdianUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          爱发电（微信/支付宝）
        </a>

        {kofiUrl && (
          <a
            className="donation-link kofi"
            href={kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ko-fi（PayPal / 信用卡）
          </a>
        )}

        <button type="button" className="donation-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add donation button to `Briefing.tsx`**

In `Briefing.tsx`, add state + button:

```tsx
import { useState } from 'react'
import { DonationModal } from './DonationModal'

export function Briefing() {
  // ... existing hooks ...
  const [showDonation, setShowDonation] = useState(false)

  // ... existing JSX, before closing </div> of briefing-card:
  <button
    type="button"
    className="donation-trigger"
    onClick={() => setShowDonation(true)}
  >
    ☕ 支持开发者
  </button>

  {showDonation && <DonationModal onClose={() => setShowDonation(false)} />}
}
```

Place the donation button between the nausea toggle and the "出警" button, or after the briefing-foot.

- [ ] **Step 5: Add modal CSS to `src/index.css`**

```css
/* === Donation === */

.donation-trigger {
  display: block;
  width: 100%;
  margin: 8px 0;
  padding: 8px 16px;
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 8px;
  background: transparent;
  color: #ffd700;
  font-size: 13px;
  cursor: pointer;
}

.donation-trigger:hover {
  background: rgba(255, 215, 0, 0.08);
}

.donation-modal {
  pointer-events: auto;
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(12, 8, 6, 0.8);
}

.donation-card {
  width: min(440px, 100%);
  padding: 24px;
  border-radius: 14px;
  background: linear-gradient(160deg, #2a221c 0%, #1a1510 100%);
  color: #fff8f0;
  text-align: center;
}

.donation-card h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.donation-lede {
  margin: 0 0 20px;
  font-size: 13px;
  opacity: 0.85;
  line-height: 1.5;
}

.donation-link {
  display: block;
  width: 100%;
  margin-bottom: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.donation-link.afdian {
  background: #9468ff;
  color: #fff;
}

.donation-link.kofi {
  background: #ff5e5b;
  color: #fff;
}

.donation-close {
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: transparent;
  color: #fff8f0;
  font-size: 14px;
  cursor: pointer;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts src/game/config.ts src/ui/DonationModal.tsx src/ui/Briefing.tsx src/index.css
git commit -m "feat: add donation feature with 爱发电 link and Ko-fi placeholder"
```

---

### Task 6: Wall decorations

**Files:**
- Modify: `src/scene/World.tsx` — add `WallArt` component, add to `Room`

- [ ] **Step 1: Add WallArt component**

In `src/scene/World.tsx`, add a new component:

```tsx
import { Text } from '@react-three/drei'

const CALIGRAPHY_PIECES = [
  { pos: [-4.7, 1.6, -1.5] as [number, number, number], rotY: Math.PI / 2, char: '静', label: 'calm' },
  { pos: [-4.7, 1.6, 1.5] as [number, number, number], rotY: Math.PI / 2, char: '忍', label: 'endure' },
  { pos: [4.7, 1.6, 0] as [number, number, number], rotY: -Math.PI / 2, char: '食不言', label: 'silence' },
]

export function WallArt() {
  return (
    <group>
      {CALIGRAPHY_PIECES.map((piece, i) => (
        <group key={i} position={piece.pos} rotation={[0, piece.rotY, 0]}>
          {/* Frame */}
          <mesh userData={{ fadeWall: true }} position={[0, 0, -0.02]}>
            <boxGeometry args={[0.9, 1.2, 0.04]} />
            <meshStandardMaterial color="#3d2817" />
          </mesh>
          {/* Canvas backing */}
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.78, 1.08]} />
            <meshStandardMaterial color="#efe6d8" />
          </mesh>
          {/* Calligraphy character(s) */}
          <Text
            position={[0, 0, 0.03]}
            fontSize={piece.char.length > 1 ? 0.28 : 0.5}
            color="#1a1510"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.7}
          >
            {piece.char}
          </Text>
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Add WallArt to Room**

In the `Room` component's JSX, add:

```tsx
<WallArt />
```

After the walls and ceiling, before the lights.

- [ ] **Step 3: Manual smoke — `npm run dev`**

Verify 3 framed calligraphy pieces appear on east/west walls, fade with wall occlusion.

- [ ] **Step 4: Commit**

```bash
git add src/scene/World.tsx
git commit -m "feat: add decorative wall calligraphy on side walls"
```

---

### Task 7: Q/E skill icons

**Files:**
- Modify: `src/ui/SkillIcon.tsx` — replace `default` case with real icons
- Modify: `src/index.css` — add icon background colors

- [ ] **Step 1: Replace placeholder with real SVG icons**

In `src/ui/SkillIcon.tsx`, replace the `default:` case:

```tsx
    case 'poop':
      // Poop swirl — classic shape
      glyph = (
        <>
          {/* Swirl top */}
          <path d="M12 4c0 2-2 2-2 4s2 2 2 4-2 2-2 4" opacity={0.7} />
          {/* Main mound body */}
          <path d="M7 16c0-2 1.5-3 3-3 .3-1.5 1.5-2.5 3-2.5s2.7 1 3 2.5c1.5 0 3 1 3 3 0 2-2 3.5-5 3.5s-5-1.5-5-3.5z" />
          {/* Base shadow line */}
          <path d="M6 19.5h12" opacity={0.3} />
          {/* Small fly dots */}
          <circle cx="7" cy="8" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
        </>
      )
      break
    case 'civility':
      // Toilet plunger — handle + rubber cup
      glyph = (
        <>
          {/* Wooden handle */}
          <line x1="12" y1="3" x2="12" y2="14" />
          {/* Handle grip rings */}
          <line x1="10.5" y1="6" x2="13.5" y2="6" opacity={0.5} />
          <line x1="10.5" y1="8" x2="13.5" y2="8" opacity={0.5} />
          {/* Rubber cup — bell shape */}
          <path d="M8 14c0 3 0 5 4 5s4-2 4-5c0-1-1-2-2-2h-4c-1 0-2 1-2 2z" />
          {/* Cup bottom rim */}
          <ellipse cx="12" cy="19" rx="4" ry="1" opacity={0.6} />
        </>
      )
      break
```

Remove the old `default:` case (or keep it as a true fallback for type safety).

- [ ] **Step 2: Add CSS background colors**

In `src/index.css`, add:

```css
.skill-icon-poop {
  background: #8b6914;
}

.skill-icon-civility {
  background: #ffd700;
}
```

These go alongside the existing `.skill-icon-slap`, `.skill-icon-tape`, etc.

- [ ] **Step 3: Manual smoke — `npm run dev`**

Verify Q and E skill buttons (and Briefing skill list) show distinct icons instead of placeholder circle.

- [ ] **Step 4: Commit**

```bash
git add src/ui/SkillIcon.tsx src/index.css
git commit -m "feat: add SVG icons for poop (Q) and civility (E) skills"
```

---

### Task 8: Door couplet

**Files:**
- Modify: `src/scene/World.tsx` — add couplet to `Door` component

- [ ] **Step 1: Add couplet meshes to Door component**

In the `Door` component, add couplet strips and text after the existing door meshes:

```tsx
export function Door() {
  const p = CONFIG.door.position
  return (
    <group position={[p[0], 0, p[2]]}>
      {/* ... existing door frame, panel, handle ... */}

      {/* Couplet — 上联 (right side, +X): 天道酬勤 */}
      <group position={[0.82, 1.1, -0.35]}>
        <mesh>
          <planeGeometry args={[0.28, 1.8]} />
          <meshStandardMaterial color="#c0392b" roughness={0.7} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.3}
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
          lineHeight={1.3}
        >
          {'天道酬勤'.split('').join('\n')}
        </Text>
      </group>

      {/* Couplet — 下联 (left side, -X): 地道的您 */}
      <group position={[-0.82, 1.1, -0.35]}>
        <mesh>
          <planeGeometry args={[0.28, 1.8]} />
          <meshStandardMaterial color="#c0392b" roughness={0.7} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.3}
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
          lineHeight={1.3}
        >
          {'地道的您'.split('').join('\n')}
        </Text>
      </group>
    </group>
  )
}
```

Key details:
- `Text` from drei is already imported in World.tsx
- Characters are split and joined with `\n` for vertical layout
- `lineHeight={1.3}` for tight vertical spacing
- Red `#c0392b` + gold `#ffd700` — traditional Chinese couplet colors
- Strips are `planeGeometry` (flat), not transparent — always visible
- Positioned at x = ±0.82 (just outside the door pillars at ±0.62)

- [ ] **Step 2: Manual smoke — `npm run dev`**

Verify red couplet strips with gold text appear on both sides of the door, readable from inside the room.

- [ ] **Step 3: Commit**

```bash
git add src/scene/World.tsx
git commit -m "feat: add red-gold door couplet (天道酬勤 / 地道的您)"
```

---

### Task 9: Final verification

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Tests**

```bash
npm test
```

Expected: all existing tests pass (no new tests needed — Round 4 is UI/visual only).

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Desktop regression smoke**

```bash
npm run dev
```

- WASD movement works
- Mouse drag rotates camera
- 1/2/3/4/Q/E skills fire
- Tab cycles target
- Space jumps
- Briefing shows all 6 skills with icons
- Door couplet visible
- Wall calligraphy visible
- Donation button in briefing opens modal
- Touch controls invisible on desktop

- [ ] **Step 5: Mobile smoke (if device available)**

- Open dev server URL on phone (same network)
- Portrait: rotate overlay shows
- Landscape: game visible, joystick bottom-left
- Joystick moves player
- Right-side drag rotates camera
- Skill buttons tappable
- Jump + Tab buttons work

- [ ] **Step 6: Update README**

Add Round 4 notes to `README.md`:
- Mobile touch controls (landscape)
- Donation feature
- Wall decorations
- Q/E icons
- Door couplet

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: add Round 4 notes (mobile, donation, wall art, icons, couplet)"
```

---

## Self-review (plan vs spec)

| Spec criterion | Task |
|----------------|------|
| Mobile joystick controls movement | 1, 2, 3 |
| OrbitControls touch-drag camera | 4 (CSS only — OrbitControls already supports touch) |
| 6 skill buttons + Tab + Jump tappable | 2, 4 |
| Portrait overlay | 4 |
| Viewport + CSS prevents scroll/zoom | 4 |
| Donation button + modal (爱发电 + Ko-fi placeholder) | 5 |
| 3 wall calligraphy decorations | 6 |
| Q/E SVG icons | 7 |
| Red-gold door couplet | 8 |
| Desktop zero regression | 3 (parallel input), 9 (smoke) |
| Tests + build pass | 9 |

No TBD placeholders. All tasks have concrete file paths and code snippets. Dependencies: only `nipplejs` (new). All other work uses existing dependencies (drei Text, Zustand, R3F).

---

## Risk notes

1. **nipplejs SSR:** nipplejs accesses `window` on import. Since this is a Vite SPA (not SSR), this is fine. The `TouchControls` component only initializes nipplejs inside `useEffect`, and only on touch devices.

2. **OrbitControls touch conflict:** OrbitControls captures touch events on the canvas. The joystick zone is a separate DOM element above the canvas with `pointer-events: auto`. These should not conflict. If they do, add `touch-action: none` to the canvas and verify OrbitControls still receives events.

3. **drei Text font loading:** drei `<Text>` uses Troika text which loads fonts asynchronously. On first load, text may pop in after a brief delay. This is acceptable for decorative elements.

4. **爱发电 URL:** The developer needs to replace the placeholder URL `'https://afdian.com/a/your-username'` in config.ts with their actual 爱发电 page URL.

5. **Joystick Y-axis sign:** nipplejs `data.vector.y` is +1 when pushing up. The Player's `forwardInput` uses +1 for forward (W = forward = +1). If testing reveals inverted movement, negate `touchMoveY` in the integration code.
