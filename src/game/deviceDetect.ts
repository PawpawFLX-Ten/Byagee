import { useEffect, useState } from 'react'

export interface DeviceProfile {
  readonly isTouch: boolean
  readonly needsMobileHudFallback: boolean
}

const defaultProfile: DeviceProfile = {
  isTouch: false,
  needsMobileHudFallback: false,
}

export function detectDevice(): DeviceProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined')
    return defaultProfile

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  let canHover = false
  try {
    canHover = matchMedia('(hover: hover)').matches
  } catch {
    // matchMedia unavailable (SSR)
  }

  return {
    isTouch,
    needsMobileHudFallback: isTouch && canHover,
  }
}

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(defaultProfile)

  useEffect(() => {
    const run = () => {
      const p = detectDevice()
      setProfile(p)
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle(
          'force-mobile-hud',
          p.needsMobileHudFallback,
        )
      }
    }

    run()

    let hoverMql: MediaQueryList | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const debouncedRun = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(run, 150)
    }

    if (typeof window !== 'undefined') {
      try {
        hoverMql = matchMedia('(hover: hover)')
        hoverMql.addEventListener('change', debouncedRun)
      } catch {
        // matchMedia unavailable
      }
      window.addEventListener('resize', debouncedRun)
      window.addEventListener('orientationchange', debouncedRun)
    }

    return () => {
      if (timer !== undefined) clearTimeout(timer)
      if (hoverMql) hoverMql.removeEventListener('change', debouncedRun)
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', debouncedRun)
        window.removeEventListener('orientationchange', debouncedRun)
      }
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('force-mobile-hud')
      }
    }
  }, [])

  return profile
}
