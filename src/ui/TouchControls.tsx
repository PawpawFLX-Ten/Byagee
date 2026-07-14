import { useEffect, useRef } from 'react'
import nipplejs from 'nipplejs'
import { useInputStore } from '../game/inputStore'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'
import { useDeviceProfile } from '../game/deviceDetect'

export function TouchControls() {
  const profile = useDeviceProfile()
  const isTouch = profile.isTouch
  const joystickZone = useRef<HTMLDivElement>(null)
  const managerRef = useRef<ReturnType<typeof nipplejs.create> | null>(null)
  const setMove = useInputStore((s) => s.setMove)
  const reset = useInputStore((s) => s.reset)
  const cycle = useGameStore((s) => s.cycleTarget)
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)
  useGameStore((s) => s.lang) // re-render on language change

  useEffect(() => {
    if (!isTouch || !briefingDone || !joystickZone.current) return

    let manager: ReturnType<typeof nipplejs.create> | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const createJoystick = () => {
      if (manager) {
        manager.destroy()
        manager = null
      }
      if (!joystickZone.current) return
      manager = nipplejs.create({
        zone: joystickZone.current,
        mode: 'static',
        position: {
          left: `${Math.max(70, Math.round(window.innerWidth * 0.18))}px`,
          bottom: `${Math.max(70, Math.round(window.innerHeight * 0.12))}px`,
        },
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
    }

    createJoystick()

    const onResize = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(createJoystick, 200)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    return () => {
      if (timer !== undefined) clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      if (manager) manager.destroy()
      managerRef.current = null
    }
  }, [isTouch, briefingDone, setMove, reset])

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
