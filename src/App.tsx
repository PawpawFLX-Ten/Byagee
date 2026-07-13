import { GameCanvas } from './scene/GameCanvas'
import { Hud } from './ui/Hud'

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <Hud />
    </div>
  )
}
