import { GameCanvas } from './scene/GameCanvas'
import { Briefing } from './ui/Briefing'
import { Hud } from './ui/Hud'

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <Hud />
      <Briefing />
    </div>
  )
}
