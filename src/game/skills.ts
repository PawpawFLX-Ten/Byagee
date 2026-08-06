import { CONFIG } from './config'
import { applyChaserKnockback, isKnockbackTarget } from './chaser'
import { scaledSilence } from './difficulty'
import { resolveBossHit } from './bossModules'
import { cdMultiplier, rangeMultiplier } from './progression'
import { distance3 } from './threat'
import type { NpcState, SkillId } from './types'

function applySkillKnockback(
  npc: NpcState,
  skillId: SkillId,
  playerPos: [number, number, number],
  now: number,
  others: { x: number; z: number }[],
): NpcState {
  if (skillId === 'tape' || skillId === 'gag' || skillId === 'poop') return npc

  if (skillId === 'megaphone' || skillId === 'civility') {
    if (!isKnockbackTarget(npc)) return npc
    return applyChaserKnockback(npc, playerPos, now, {
      dist: CONFIG.chaser.knockbackDist * 0.5,
      staggerSec: CONFIG.chaser.staggerSec * 0.5,
      others,
    })
  }

  return npc
}

function resolveSkillHit(
  npc: NpcState,
  skillId: SkillId,
  applyStatus: 'silenced' | 'sealed',
  effectiveDuration: number,
  now: number,
  playerPos: [number, number, number],
  others: { x: number; z: number }[],
  hitPower: number,
  sealProp: 'tape' | 'gag' | null = null,
): NpcState {
  if (skillId === 'slap' && npc.role === 'chaser') {
    return applyChaserKnockback(npc, playerPos, now, { others })
  }

  const hit = resolveBossHit(
    npc,
    applyStatus,
    effectiveDuration,
    now,
    sealProp,
    playerPos,
    others,
    hitPower,
  ).npc

  return applySkillKnockback(hit, skillId, playerPos, now, others)
}

export function pickTarget(
  npcs: NpcState[],
  playerPos: [number, number, number],
  preferredId: string | null,
): NpcState | null {
  const smackers = npcs.filter((n) => n.status === 'smacking')
  // Fallback: NPCs at a table (idle/silenced/sealed) — never walking (in transit from door, unreachable)
  const pool = smackers.length
    ? smackers
    : npcs.filter((n) => n.status !== 'walking')
  if (!pool.length) return null
  if (preferredId) {
    const pref = pool.find((n) => n.id === preferredId)
    if (pref) return pref
  }
  return [...pool].sort(
    (a, b) =>
      distance3(a.position, playerPos) - distance3(b.position, playerPos),
  )[0]
}

export function cycleTarget(
  npcs: NpcState[],
  currentId: string | null,
): string | null {
  if (!npcs.length) return null
  const ids = npcs.map((n) => n.id)
  if (!currentId) return ids[0]
  const idx = ids.indexOf(currentId)
  return ids[(idx + 1) % ids.length]
}

/** Pick the farthest smacking NPC from playerPos — used by gag auto-target. */
function pickFarthestSmacker(
  npcs: NpcState[],
  playerPos: [number, number, number],
): NpcState | null {
  const smackers = npcs.filter((n) => n.status === 'smacking')
  if (!smackers.length) return null
  return [...smackers].sort(
    (a, b) => distance3(b.position, playerPos) - distance3(a.position, playerPos),
  )[0]
}

export function tryUseSkill(
  skillId: SkillId,
  npcs: NpcState[],
  playerPos: [number, number, number],
  targetId: string | null,
  now: number,
  elapsedSec: number,
  cooldownReadyAt: Record<SkillId, number>,
  level: number,
): {
  ok: boolean
  npcs: NpcState[]
  cooldownReadyAt: Record<SkillId, number>
  selfNoise: number
  hitIds: string[]
  reason?: string
} {
  const skill = CONFIG.skills[skillId]
  const effectiveRange = skill.range * rangeMultiplier(level)
  const effectiveCd = skill.cooldown * cdMultiplier(level)
  if (now < (cooldownReadyAt[skillId] ?? 0)) {
    return {
      ok: false,
      npcs,
      cooldownReadyAt,
      selfNoise: 0,
      hitIds: [],
      reason: 'cooldown',
    }
  }

  const duration = scaledSilence(skill.silenceDuration, elapsedSec)
  const hitPower = skillId === 'gag' && level >= 9 ? 2 : 1
  const effectiveDuration = skillId === 'gag' && level >= 9 ? duration * 2 : duration
  let next = [...npcs]
  const selfNoise = skill.selfNoise ?? 0
  const hitIds: string[] = []

  if (skill.tags.includes('cone') && skill.coneAngle) {
    let hit = false
    next = next.map((npc) => {
      const d = distance3(npc.position, playerPos)
      if (d > effectiveRange) return npc
      hit = true
      hitIds.push(npc.id)
      const others = npcs.filter((n) => n.id !== npc.id).map((n) => ({ x: n.position[0], z: n.position[2] }))
      return resolveSkillHit(
        npc,
        skillId,
        skill.applyStatus,
        effectiveDuration,
        now,
        playerPos,
        others,
        hitPower,
      )
    })
    if (!hit) {
      return {
        ok: false,
        npcs,
        cooldownReadyAt,
        selfNoise: 0,
        hitIds: [],
        reason: 'no_target',
      }
    }
  } else if (skill.tags.includes('global')) {
    let hit = false
    next = next.map((npc) => {
      if (npc.status === 'walking') {
        if (skillId === 'civility' && isKnockbackTarget(npc)) {
          hit = true
          hitIds.push(npc.id)
          const others = npcs
            .filter((n) => n.id !== npc.id)
            .map((n) => ({ x: n.position[0], z: n.position[2] }))
          return applyChaserKnockback(npc, playerPos, now, {
            dist: CONFIG.chaser.knockbackDist * 0.5,
            staggerSec: CONFIG.chaser.staggerSec * 0.5,
            others,
          })
        }
        return npc
      }
      hit = true
      hitIds.push(npc.id)
      const others = npcs.filter((n) => n.id !== npc.id).map((n) => ({ x: n.position[0], z: n.position[2] }))
      return resolveSkillHit(
        npc,
        skillId,
        skill.applyStatus,
        effectiveDuration,
        now,
        playerPos,
        others,
        hitPower,
      )
    })
    if (!hit) {
      return {
        ok: false,
        npcs,
        cooldownReadyAt,
        selfNoise: 0,
        hitIds: [],
        reason: 'no_target',
      }
    }
  } else if (skill.tags.includes('aoe') && skill.aoeRadius) {
    let hit = false
    next = next.map((npc) => {
      if (distance3(npc.position, playerPos) <= skill.aoeRadius!) {
        hit = true
        hitIds.push(npc.id)
        const others = npcs
          .filter((n) => n.id !== npc.id)
          .map((n) => ({ x: n.position[0], z: n.position[2] }))
        return resolveSkillHit(
          npc,
          skillId,
          skill.applyStatus,
          effectiveDuration,
          now,
          playerPos,
          others,
          hitPower,
        )
      }
      return npc
    })
    if (!hit) {
      return {
        ok: false,
        npcs,
        cooldownReadyAt,
        selfNoise: 0,
        hitIds: [],
        reason: 'no_target',
      }
    }
  } else {
    // Gag auto-targets the farthest smacking NPC; others use nearest/preferred
    const target = skillId === 'gag'
      ? pickFarthestSmacker(npcs, playerPos)
      : pickTarget(npcs, playerPos, targetId)
    if (!target) {
      return {
        ok: false,
        npcs,
        cooldownReadyAt,
        selfNoise: 0,
        hitIds: [],
        reason: 'no_target',
      }
    }
    // Gag has no range limit; other skills check range
    if (skillId !== 'gag' && distance3(target.position, playerPos) > effectiveRange) {
      return {
        ok: false,
        npcs,
        cooldownReadyAt,
        selfNoise: 0,
        hitIds: [],
        reason: 'too_far',
      }
    }
    const sealProp =
      skillId === 'tape' ? 'tape' : skillId === 'gag' ? 'gag' : null
    hitIds.push(target.id)
    const others = npcs
      .filter((n) => n.id !== target.id)
      .map((n) => ({ x: n.position[0], z: n.position[2] }))
    next = next.map((n) =>
      n.id === target.id
        ? resolveSkillHit(
            n,
            skillId,
            skill.applyStatus,
            effectiveDuration,
            now,
            playerPos,
            others,
            hitPower,
            sealProp,
          )
        : n,
    )
  }

  // Tape: apply noise reduction to hit NPCs (Level 3+ perk)
  if (skillId === 'tape' && level >= 3) {
    const reduction = level >= 7 ? 0.25 : 0.15
    const hitSet = new Set(hitIds)
    next = next.map((n) => (hitSet.has(n.id) ? { ...n, noiseReduction: reduction } : n))
  }

  return {
    ok: true,
    npcs: next,
    cooldownReadyAt: {
      ...cooldownReadyAt,
      [skillId]: now + effectiveCd * 1000,
    },
    selfNoise,
    hitIds,
  }
}
