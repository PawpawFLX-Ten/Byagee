import { CONFIG } from './config'
import { scaledSilence } from './difficulty'
import { applySilence } from './npcFsm'
import { distance3 } from './threat'
import type { NpcState, SkillId } from './types'

export function pickTarget(
  npcs: NpcState[],
  playerPos: [number, number, number],
  preferredId: string | null,
): NpcState | null {
  const smackers = npcs.filter((n) => n.status === 'smacking')
  const pool = smackers.length ? smackers : npcs
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

export function tryUseSkill(
  skillId: SkillId,
  npcs: NpcState[],
  playerPos: [number, number, number],
  targetId: string | null,
  now: number,
  elapsedSec: number,
  cooldownReadyAt: Record<SkillId, number>,
): {
  ok: boolean
  npcs: NpcState[]
  cooldownReadyAt: Record<SkillId, number>
  selfNoise: number
  hitIds: string[]
  reason?: string
} {
  const skill = CONFIG.skills[skillId]
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
  let next = [...npcs]
  const selfNoise = skill.selfNoise ?? 0
  const hitIds: string[] = []

  if (skill.tags.includes('aoe') && skill.aoeRadius) {
    let hit = false
    next = next.map((npc) => {
      if (distance3(npc.position, playerPos) <= skill.aoeRadius!) {
        hit = true
        hitIds.push(npc.id)
        const others = npcs
          .filter((n) => n.id !== npc.id)
          .map((n) => ({ x: n.position[0], z: n.position[2] }))
        return applySilence(
          npc,
          skill.applyStatus,
          duration,
          now,
          null,
          playerPos,
          others,
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
    const target = pickTarget(npcs, playerPos, targetId)
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
    if (distance3(target.position, playerPos) > skill.range) {
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
        ? applySilence(
            n,
            skill.applyStatus,
            duration,
            now,
            sealProp,
            playerPos,
            others,
          )
        : n,
    )
  }

  return {
    ok: true,
    npcs: next,
    cooldownReadyAt: {
      ...cooldownReadyAt,
      [skillId]: now + skill.cooldown * 1000,
    },
    selfNoise,
    hitIds,
  }
}
