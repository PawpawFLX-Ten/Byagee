import { CONFIG } from './config'
import { applySilence } from './npcFsm'
import { distance3 } from './threat'
import type { NpcState, SealProp } from './types'

export function modulesForElapsed(elapsedSec: number) {
  const u = CONFIG.boss.moduleUnlockSec
  return {
    a: elapsedSec >= u.a,
    b: elapsedSec >= u.b,
    c: elapsedSec >= u.c,
  }
}

export function mouthHpForElapsed(elapsedSec: number): number {
  const mods = modulesForElapsed(elapsedSec)
  if (mods.c) return CONFIG.boss.mouthHpByEra[2]
  if (mods.b) return CONFIG.boss.mouthHpByEra[1]
  return CONFIG.boss.mouthHpByEra[0]
}

export function createBossNpc(
  seatIndex: number,
  now: number,
  elapsedSec: number,
  id: string,
): NpcState {
  const mods = modulesForElapsed(elapsedSec)
  const hp = mouthHpForElapsed(elapsedSec)
  return {
    id,
    status: 'walking',
    statusUntil: now + 8000,
    seatIndex,
    position: [...CONFIG.door.position] as [number, number, number],
    facing: 0,
    baseLoudness: CONFIG.boss.baseLoudness,
    sealProp: null,
    foodId: CONFIG.foodSpots[seatIndex % CONFIG.foodSpots.length]?.id ?? null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'boss',
    scale: CONFIG.boss.scale,
    mouthHp: hp,
    mouthHpMax: hp,
    bossModules: mods,
    comboHits: 0,
    lastHitAt: 0,
    raging: false,
    exiting: false,
    idleSince: now,
    smackingSince: 0,
    noiseReduction: 0,
  }
}

export function resolveBossHit(
  npc: NpcState,
  applyStatus: 'silenced' | 'sealed',
  durationSec: number,
  now: number,
  sealProp: SealProp,
  attackerPos?: [number, number, number],
  others: { x: number; z: number }[] = [],
  hitPower: number = 1,
): { npc: NpcState; demoted: boolean } {
  if (npc.role !== 'boss') {
    return {
      npc: applySilence(npc, applyStatus, durationSec, now, sealProp, attackerPos, others),
      demoted: false,
    }
  }

  let next = { ...npc }
  let duration = durationSec

  if (next.bossModules.a && next.mouthHp > 0) {
    next.mouthHp = Math.max(0, next.mouthHp - hitPower)
  }

  if (next.bossModules.b) {
    if (now - next.lastHitAt <= CONFIG.boss.resistanceWindowSec * 1000) {
      next.comboHits += 1
    } else {
      next.comboHits = 1
    }
    next.lastHitAt = now
    if (next.comboHits < 2) duration = Math.min(duration, 0.35)
  }

  if (next.bossModules.a && next.mouthHp > 0) {
      // Chip only — stay smacking / resume
      next.status = 'smacking'
      next.statusUntil = now + 2000
      next.wobbleUntil = now + 400
      next.smackingSince = now
      return { npc: next, demoted: false }
    }

  // HP emptied (or module A off): apply silence and demote
  let silenced = applySilence(next, applyStatus, duration, now, sealProp, attackerPos, others)
  silenced = demoteBoss(silenced)
  return { npc: silenced, demoted: true }
}

export function demoteBoss(npc: NpcState): NpcState {
  if (npc.role !== 'boss') return npc
  return {
    ...npc,
    role: 'normal',
    scale: 1,
    mouthHp: 0,
    mouthHpMax: 0,
    bossModules: { a: false, b: false, c: false },
    comboHits: 0,
    raging: false,
    baseLoudness: 0.4 + (npc.seatIndex % 5) * 0.05,
  }
}

export function tickBossRage(
  bossNpc: NpcState,
  npcs: NpcState[],
  now: number,
): { boss: NpcState; npcs: NpcState[] } {
  if (bossNpc.role !== 'boss' || !bossNpc.bossModules.c) {
    return { boss: bossNpc, npcs }
  }
  const half = bossNpc.mouthHpMax * 0.5
  const raging = bossNpc.mouthHp <= half && bossNpc.mouthHp > 0
  let boss = { ...bossNpc, raging }
  if (!raging) return { boss, npcs }

  const next = npcs.map((n) => {
    if (n.id === boss.id) return n
    if (distance3(n.position, boss.position) > CONFIG.boss.rageRadius) return n
    let o = { ...n }
    if (o.status === 'sealed' || o.sealProp) {
      o.status = 'idle'
      o.sealProp = null
      o.statusUntil = now + 400
    }
    if (o.status === 'idle' || o.status === 'silenced') {
      o.status = 'smacking'
      o.statusUntil = now + 2500
      o.smackingSince = now
    }
    return o
  })
  return { boss, npcs: next.map((n) => (n.id === boss.id ? boss : n)) }
}
