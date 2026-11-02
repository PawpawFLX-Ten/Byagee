import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { bootCommercial } from './game/commercial'
import { getLang } from './game/i18n'
import { useGameStore } from './game/store'
import App from './App.tsx'

bootCommercial()
useGameStore.setState({ lang: getLang() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: offline-capable runtime cache (public/sw.js). Registration is
// best-effort — the game runs fine when SW is unavailable (dev, old browsers).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support unavailable — non-fatal */
    })
  })
}
