import { GameCanvas } from './scene/GameCanvas'
import { Briefing } from './ui/Briefing'
import { Hud } from './ui/Hud'
import { TouchControls } from './ui/TouchControls'
import { useGameStore } from './game/store'
import { t } from './game/i18n'

export default function App() {
  useGameStore((s) => s.lang) // re-render on language change
  return (
    <div className="app">
      <GameCanvas />
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
