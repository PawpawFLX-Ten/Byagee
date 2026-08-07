import { CONFIG } from './config'
import { BOSS_ARCHETYPE, BOSS_BUILD } from './archetype'
import { getRuntimeSpace } from './runtimeSpace'
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
    foodId: getRuntimeSpace().foodSpots[seatIndex % getRuntimeSpace().foodSpots.length]?.id ?? null,
    wobbleUntil: 0,
    stuckTicks: 0,
    role: 'boss',
    archetype: BOSS_ARCHETYPE,
    build: BOSS_BUILD,
    roomId: 'r0',
    staggerUntil: 0,
    chaseTarget: false,
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
    pulseChargeUntil: 0,
    pulseCooldownUntil: 0,
    pulseFiredAt: 0,
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
    pulseChargeUntil: 0,
    pulseCooldownUntil: 0,
    pulseFiredAt: 0,
    baseLoudness: 0.4 + (npc.seatIndex % 5) * 0.05,
  }
}

/** Cancel a charging rage pulse; the boss re-enters cooldown. */
export function interruptBossPulse(
  boss: NpcState,
  now: number,
): NpcState {
  if (boss.role !== 'boss' || boss.pulseChargeUntil === 0) return boss
  return {
    ...boss,
    pulseChargeUntil: 0,
    pulseCooldownUntil: now + CONFIG.boss.pulseInterruptDelayMs,
  }
}

/**
 * Rage pulse state machine: cooldown → charging → burst (one-time catalyst).
 * Bursts cancel silences/seals and fire up smackers inside the pulse radius.
 */
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

  const { pulseIntervalSec, pulseChargeMs, pulseRadius } = CONFIG.boss

  // Cooldown done → start charging.
  if (boss.pulseChargeUntil === 0 && now >= boss.pulseCooldownUntil) {
    boss.pulseChargeUntil = now + pulseChargeMs
  }

  // Still charging — no catalyst yet.
  if (boss.pulseChargeUntil > 0 && now < boss.pulseChargeUntil) {
    return { boss, npcs }
  }

  // Charge finished → fire a single burst.
  if (boss.pulseChargeUntil > 0 && now >= boss.pulseChargeUntil) {
    boss = {
      ...boss,
      pulseChargeUntil: 0,
      pulseCooldownUntil: now + pulseIntervalSec * 1000,
      pulseFiredAt: now,
    }
    let changed = false
    const next = npcs.map((n) => {
      if (n.id === boss.id) return n
      if (distance3(n.position, boss.position) > pulseRadius) return n
      let o = { ...n }
      if (o.status === 'sealed' || o.sealProp) {
        o.status = 'idle'
        o.sealProp = null
        o.statusUntil = now + 400
        changed = true
      }
      if (o.status === 'idle' || o.status === 'silenced') {
        o.status = 'smacking'
        o.statusUntil = now + 2500
        o.smackingSince = now
        changed = true
      }
      return o
    })
    if (!changed) return { boss, npcs }
    return { boss, npcs: next.map((n) => (n.id === boss.id ? boss : n)) }
  }

  return { boss, npcs }
}
