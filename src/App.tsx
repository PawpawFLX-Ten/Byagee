import { lazy, Suspense } from 'react'
import { Briefing } from './ui/Briefing'
import { Hud } from './ui/Hud'
import { TouchControls } from './ui/TouchControls'
import { useGameStore } from './game/store'
import { t } from './game/i18n'

// The whole three.js stack (fiber/drei/postprocessing) rides in this async
// chunk, so first paint only waits for the DOM shell — the briefing screen
// doubles as the natural loading state.
const GameCanvas = lazy(() =>
  import('./scene/GameCanvas').then((m) => ({ default: m.GameCanvas })),
)

export default function App() {
  useGameStore((s) => s.lang) // re-render on language change
  return (
    <div className="app">
      <Suspense fallback={null}>
        <GameCanvas />
      </Suspense>
      <Hud />
      <Briefing />
      <TouchControls />
      <div className="rotate-overlay">
        <div>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📱↻</p>
          <p>{t('rotateOverlay')}</p>
        </div>
      </div>
    </div>
  )
}
