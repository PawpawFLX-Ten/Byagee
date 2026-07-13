import { CONFIG } from './config'
import type { NpcState } from './types'

export function distance3(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.hypot(dx, dy, dz)
}

export function distanceAttenuation(dist: number): number {
  return 1 / (1 + dist * 0.35)
}

export function computeThreat(
  npcs: NpcState[],
  playerPos: [number, number, number],
  extraNoise = 0,
  now = 0,
): number {
  let sum = 0
  for (const npc of npcs) {
    if (npc.status !== 'smacking') continue
    if (now > 0 && npc.smackingSince > 0 && now - npc.smackingSince < CONFIG.smackDamageDelaySec * 1000) continue
    const d = distance3(npc.position, playerPos)
    const effectiveLoudness = Math.max(0.05, npc.baseLoudness - npc.noiseReduction)
    sum += effectiveLoudness * distanceAttenuation(d)
  }
  return Math.min(1.5, (sum + extraNoise) * CONFIG.roomReverb)
}

export function hpDrainPerSec(threat: number, damageCoeff: number): number {
  if (threat < CONFIG.softThreat) return 0
  if (threat <= CONFIG.hardThreat) {
    const t = (threat - CONFIG.softThreat) / (CONFIG.hardThreat - CONFIG.softThreat)
    return (CONFIG.softDrainPerSec + t * (CONFIG.hardDrainPerSec - CONFIG.softDrainPerSec)) * damageCoeff
  }
  // Above hardThreat: continue scaling with same slope
  const excess = threat - CONFIG.hardThreat
  const slope = (CONFIG.hardDrainPerSec - CONFIG.softDrainPerSec) / (CONFIG.hardThreat - CONFIG.softThreat)
  return (CONFIG.hardDrainPerSec + excess * slope) * damageCoeff
}
