import { useEffect, useRef, useState } from 'react'
import nipplejs from 'nipplejs'
import { useInputStore } from '../game/inputStore'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'

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
  const managerRef = useRef<ReturnType<typeof nipplejs.create> | null>(null)
  const setMove = useInputStore((s) => s.setMove)
  const reset = useInputStore((s) => s.reset)
  const cycle = useGameStore((s) => s.cycleTarget)
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)
  useGameStore((s) => s.lang) // re-render on language change

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

    manager.on('move', (evt) => {
      setMove(evt.data.vector.x, evt.data.vector.y)
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
          {t('touch_jump')}
        </button>
        <button
          className="touch-btn tab-btn"
          onPointerDown={(e) => {
            e.preventDefault()
            cycle()
          }}
          disabled={!alive}
        >
          {t('touch_switch')}
        </button>
      </div>
    </div>
  )
}
