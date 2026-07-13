import { GameCanvas } from './scene/GameCanvas'
import { Briefing } from './ui/Briefing'
import { Hud } from './ui/Hud'
import { TouchControls } from './ui/TouchControls'

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
