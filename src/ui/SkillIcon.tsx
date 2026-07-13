import type { ReactNode } from 'react'
import type { SkillId } from '../game/types'

const svgProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Flat line icons for the four enforcement tools. */
export function SkillIcon({
  id,
  className,
}: {
  id: SkillId
  className?: string
}) {
  let glyph: ReactNode
  switch (id) {
    case 'slap':
      // Open palm / 巴掌
      glyph = (
        <>
          <path d="M8 11.5V7.2a1.2 1.2 0 0 1 2.4 0V11" />
          <path d="M10.4 10.8V5.8a1.2 1.2 0 0 1 2.4 0V11" />
          <path d="M12.8 11V6.5a1.2 1.2 0 0 1 2.4 0V12" />
          <path d="M15.2 12.2v-2.4a1.15 1.15 0 0 1 2.3.2V14" />
          <path d="M7.6 12.5c0 0-.8 1.2-.8 3.2 0 2.4 1.8 4.3 4.4 4.3h2.6c2.2 0 3.8-1.5 3.8-3.4v-2.6" />
        </>
      )
      break
    case 'tape':
      glyph = (
        <>
          <rect x="3" y="9" width="18" height="6" rx="1.5" />
          <circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <path d="M12 9v6M15 9v6" />
        </>
      )
      break
    case 'megaphone':
      glyph = (
        <>
          <path d="M4 10v4h3l6 3V7L7 10H4z" />
          <path d="M18 9c1.2.8 1.8 2 1.8 3s-.6 2.2-1.8 3" />
          <path d="M7 14l-1 4h2" />
        </>
      )
      break
    case 'gag':
      // Same flat style: simplified dildo (shaft + tip + base)
      glyph = (
        <>
          <path d="M12 4.2c1.5 0 2.6 1.2 2.6 2.8v8.2c0 1.4-1.1 2.5-2.6 2.5s-2.6-1.1-2.6-2.5V7c0-1.6 1.1-2.8 2.6-2.8z" />
          <path d="M9.6 17.2h4.8c.9 0 1.6.7 1.6 1.5v.6H8v-.6c0-.8.7-1.5 1.6-1.5z" />
          <path d="M12 4.2c.7-.9 1.9-1.2 2.6-.4" opacity={0.35} />
        </>
      )
      break
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
    default:
      glyph = <circle cx="12" cy="12" r="8" />
      break
  }

  return (
    <svg className={className} {...svgProps}>
      {glyph}
    </svg>
  )
}
