import { create } from 'zustand'
import { CONFIG, SKILL_ORDER } from './config'
import { getPhase } from './difficulty'
import { createNpcs, tickNpcs } from './npcFsm'
import { cycleTarget, tryUseSkill } from './skills'
import { computeThreat, hpDrainPerSec } from './threat'
import { titleForTime } from './titles'
import type { DifficultyPhase, NpcState, SkillId } from './types'

function emptyCooldowns(): Record<SkillId, number> {
  return {
    slap: 0,
    tape: 0,
    megaphone: 0,
    gag: 0,
  }
}

export interface GameStore {
  hp: number
  alive: boolean
  startedAt: number
  elapsedSec: number
  npcs: NpcState[]
  playerPos: [number, number, number]
  targetId: string | null
  cooldownReadyAt: Record<SkillId, number>
  threat: number
  selfNoise: number
  selfNoiseUntil: number
  phase: DifficultyPhase
  title: string
  start: (now?: number) => void
  restart: (now?: number) => void
  setPlayerPos: (pos: [number, number, number]) => void
  cycleTarget: () => void
  useSkill: (skillId: SkillId, now?: number) => void
  tick: (dt: number, now: number) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  hp: CONFIG.maxHp,
  alive: true,
  startedAt: 0,
  elapsedSec: 0,
  npcs: [],
  playerPos: [0, 0, 2.4],
  targetId: null,
  cooldownReadyAt: emptyCooldowns(),
  threat: 0,
  selfNoise: 0,
  selfNoiseUntil: 0,
  phase: 'early',
  title: titleForTime(0),

  start: (now = performance.now()) => {
    const npcs = createNpcs(now)
    set({
      hp: CONFIG.maxHp,
      alive: true,
      startedAt: now,
      elapsedSec: 0,
      npcs,
      playerPos: [0, 0, 2.4],
      targetId: npcs[0]?.id ?? null,
      cooldownReadyAt: emptyCooldowns(),
      threat: 0,
      selfNoise: 0,
      selfNoiseUntil: 0,
      phase: 'early',
      title: titleForTime(0),
    })
  },

  restart: (now = performance.now()) => {
    get().start(now)
  },

  setPlayerPos: (pos) => set({ playerPos: pos }),

  cycleTarget: () => {
    const { npcs, targetId } = get()
    set({ targetId: cycleTarget(npcs, targetId) })
  },

  useSkill: (skillId, now = performance.now()) => {
    const state = get()
    if (!state.alive) return
    const result = tryUseSkill(
      skillId,
      state.npcs,
      state.playerPos,
      state.targetId,
      now,
      state.elapsedSec,
      state.cooldownReadyAt,
    )
    if (!result.ok) return
    set({
      npcs: result.npcs,
      cooldownReadyAt: result.cooldownReadyAt,
      selfNoise: result.selfNoise,
      selfNoiseUntil: result.selfNoise > 0 ? now + 1200 : state.selfNoiseUntil,
    })
  },

  tick: (dt, now) => {
    const state = get()
    if (!state.alive || !state.startedAt) return

    const elapsedSec = (now - state.startedAt) / 1000
    const phase = getPhase(elapsedSec)
    const npcs = tickNpcs(state.npcs, now, elapsedSec)
    const selfNoise = now < state.selfNoiseUntil ? state.selfNoise : 0
    const threat = computeThreat(npcs, state.playerPos, selfNoise)
    const drain = hpDrainPerSec(threat, CONFIG.damageCoeff[phase])
    const hp = Math.max(0, state.hp - drain * dt)
    const alive = hp > 0

    let targetId = state.targetId
    if (!targetId || !npcs.some((n) => n.id === targetId)) {
      targetId = npcs.find((n) => n.status === 'smacking')?.id ?? npcs[0]?.id ?? null
    }

    set({
      elapsedSec,
      phase,
      npcs,
      threat,
      selfNoise,
      hp,
      alive,
      targetId,
      title: titleForTime(elapsedSec),
    })
  },
}))

export { SKILL_ORDER }
