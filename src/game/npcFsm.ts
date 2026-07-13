import { CONFIG } from './config'
import { getPhase } from './difficulty'
import type { DifficultyPhase, NpcState } from './types'

export function createNpcs(now: number): NpcState[] {
  return CONFIG.seatPositions.slice(0, CONFIG.npcCount).map((pos, i) => ({
    id: `npc-${i}`,
    status: i === 0 ? 'smacking' : 'idle',
    statusUntil: i === 0 ? now + 4000 : now + 2000 + i * 1500,
    seatIndex: i,
    position: pos,
    baseLoudness: 0.4 + i * 0.05,
  }))
}

export function tickNpcs(
  npcs: NpcState[],
  now: number,
  elapsedSec: number,
): NpcState[] {
  const phase = getPhase(elapsedSec)
  const maxSmack = CONFIG.maxOverlappingSmackers[phase]
  let smacking = npcs.filter((n) => n.status === 'smacking').length

  return npcs.map((npc) => {
    if (now < npc.statusUntil) return npc

    if (npc.status === 'silenced' || npc.status === 'sealed') {
      return { ...npc, status: 'idle', statusUntil: now + idleGap(phase) }
    }

    if (npc.status === 'idle') {
      if (smacking >= maxSmack) {
        return { ...npc, statusUntil: now + 800 }
      }
      smacking += 1
      return {
        ...npc,
        status: 'smacking',
        statusUntil: now + smackBurst(phase),
      }
    }

    return { ...npc, status: 'idle', statusUntil: now + idleGap(phase) }
  })
}

function idleGap(phase: DifficultyPhase): number {
  if (phase === 'early') return 2800
  if (phase === 'mid') return 1600
  return 900
}

function smackBurst(phase: DifficultyPhase): number {
  if (phase === 'early') return 3500
  if (phase === 'mid') return 4000
  return 4500
}

export function applySilence(
  npc: NpcState,
  status: 'silenced' | 'sealed',
  durationSec: number,
  now: number,
): NpcState {
  return {
    ...npc,
    status,
    statusUntil: now + durationSec * 1000,
  }
}
