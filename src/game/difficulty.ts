import { CONFIG } from './config'
import type { DifficultyPhase } from './types'

export function getPhase(elapsedSec: number): DifficultyPhase {
  if (elapsedSec < CONFIG.phases.earlyEnd) return 'early'
  if (elapsedSec < CONFIG.phases.midEnd) return 'mid'
  return 'late'
}

export function scaledSilence(baseDuration: number, elapsedSec: number): number {
  const phase = getPhase(elapsedSec)
  return baseDuration * CONFIG.silenceScale[phase]
}
