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

export interface HitFx {
  id: number
  npcIds: string[]
  skillId: SkillId
  until: number
  playerPos: [number, number, number]
}

export interface FeedbackToast {
  id: number
  text: string
  until: number
}

export interface SkillAction {
  skillId: SkillId
  until: number
  faceYaw: number
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
  hitFx: HitFx | null
  toast: FeedbackToast | null
  lastSkillOk: boolean
  briefingDone: boolean
  reduceNausea: boolean
  guideTip: string | null
  skillAction: SkillAction | null
  shoutBannerUntil: number
  start: (now?: number) => void
  restart: (now?: number) => void
  beginMission: (now?: number) => void
  setPlayerPos: (pos: [number, number, number]) => void
  cycleTarget: () => void
  useSkill: (skillId: SkillId, now?: number) => void
  tick: (dt: number, now: number) => void
  clearToast: () => void
  setReduceNausea: (on: boolean) => void
}

let fxSeq = 1

const FAIL_TEXT: Record<string, string> = {
  cooldown: '技能冷却中',
  too_far: '再靠近一点！',
  no_target: '没有目标',
}

function guideForElapsed(elapsed: number): string | null {
  if (elapsed < 3.5) return '靠近绕桌觅食的吧唧者——文明需要距离。'
  if (elapsed < 7) return '按 1：挥手拍玩具抽脸。短促有效。'
  if (elapsed < 11) return '2 贴胶条 · 3 怒吼「闭嘴」· 4 塞嘴大招。'
  return null
}

function faceYawToTarget(
  playerPos: [number, number, number],
  npcs: NpcState[],
  targetId: string | null,
  skillId: SkillId,
): number {
  if (skillId === 'megaphone') return 0 // Player mesh handles facing separately
  const t =
    npcs.find((n) => n.id === targetId) ??
    npcs.find((n) => n.status === 'smacking') ??
    npcs[0]
  if (!t) return 0
  return Math.atan2(t.position[0] - playerPos[0], t.position[2] - playerPos[2])
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
  hitFx: null,
  toast: null,
  lastSkillOk: false,
  briefingDone: false,
  reduceNausea: false,
  guideTip: null,
  skillAction: null,
  shoutBannerUntil: 0,

  start: (now = performance.now()) => {
    const npcs = createNpcs(now)
    set({
      hp: CONFIG.maxHp,
      alive: true,
      startedAt: 0,
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
      hitFx: null,
      toast: null,
      lastSkillOk: false,
      briefingDone: false,
      guideTip: null,
      skillAction: null,
      shoutBannerUntil: 0,
    })
  },

  beginMission: (now = performance.now()) => {
    const npcs = createNpcs(now)
    set({
      briefingDone: true,
      alive: true,
      startedAt: now,
      elapsedSec: 0,
      hp: CONFIG.maxHp,
      npcs,
      playerPos: [0, 0, 2.4],
      targetId: npcs[0]?.id ?? null,
      cooldownReadyAt: emptyCooldowns(),
      threat: 0,
      selfNoise: 0,
      selfNoiseUntil: 0,
      phase: 'early',
      title: titleForTime(0),
      hitFx: null,
      toast: null,
      guideTip: guideForElapsed(0),
      skillAction: null,
      shoutBannerUntil: 0,
    })
  },

  restart: (now = performance.now()) => {
    get().beginMission(now)
  },

  setPlayerPos: (pos) => set({ playerPos: pos }),

  cycleTarget: () => {
    const { npcs, targetId } = get()
    set({ targetId: cycleTarget(npcs, targetId) })
  },

  clearToast: () => set({ toast: null }),

  setReduceNausea: (on) => set({ reduceNausea: on }),

  useSkill: (skillId, now = performance.now()) => {
    const state = get()
    if (!state.alive || !state.briefingDone) return
    if (state.skillAction) return

    // Pre-check without applying — lock windup then apply at end
    const preview = tryUseSkill(
      skillId,
      state.npcs,
      state.playerPos,
      state.targetId,
      now,
      state.elapsedSec,
      state.cooldownReadyAt,
    )
    if (!preview.ok) {
      set({
        lastSkillOk: false,
        toast: {
          id: fxSeq++,
          text: FAIL_TEXT[preview.reason ?? ''] ?? '无法使用',
          until: now + 900,
        },
      })
      return
    }

    const windup = CONFIG.skills[skillId].windup
    set({
      skillAction: {
        skillId,
        until: now + windup * 1000,
        faceYaw: faceYawToTarget(
          state.playerPos,
          state.npcs,
          state.targetId,
          skillId,
        ),
      },
      // Reserve cooldown at windup start so spam is blocked
      cooldownReadyAt: {
        ...state.cooldownReadyAt,
        [skillId]: now + CONFIG.skills[skillId].cooldown * 1000,
      },
      lastSkillOk: true,
      toast: {
        id: fxSeq++,
        text:
          skillId === 'megaphone'
            ? CONFIG.shoutLine
            : CONFIG.skills[skillId].displayName + '！',
        until: now + Math.max(700, windup * 1000 + 200),
      },
      shoutBannerUntil:
        skillId === 'megaphone' ? now + 1200 : state.shoutBannerUntil,
    })
  },

  tick: (dt, now) => {
    const state = get()
    if (!state.briefingDone || !state.alive || !state.startedAt) return

    let npcs = state.npcs
    let cooldownReadyAt = state.cooldownReadyAt
    let selfNoise = now < state.selfNoiseUntil ? state.selfNoise : 0
    let selfNoiseUntil = state.selfNoiseUntil
    let hitFx = state.hitFx && now > state.hitFx.until ? null : state.hitFx
    let skillAction = state.skillAction
    let toast = state.toast && now > state.toast.until ? null : state.toast

    // Resolve windup → apply skill with knockback
    if (skillAction && now >= skillAction.until) {
      // Cooldown already reserved; pass a ready-past map for this skill so tryUseSkill applies
      const cds = { ...cooldownReadyAt, [skillAction.skillId]: 0 }
      const result = tryUseSkill(
        skillAction.skillId,
        npcs,
        state.playerPos,
        state.targetId,
        now,
        state.elapsedSec,
        cds,
      )
      if (result.ok) {
        npcs = result.npcs
        // Keep original reserved cooldown, don't reset from tryUseSkill
        selfNoise = result.selfNoise
        selfNoiseUntil =
          result.selfNoise > 0 ? now + 1200 : selfNoiseUntil
        hitFx = {
          id: fxSeq++,
          npcIds: result.hitIds,
          skillId: skillAction.skillId,
          until: now + (skillAction.skillId === 'megaphone' ? 800 : 500),
          playerPos: state.playerPos,
        }
      }
      skillAction = null
    }

    const elapsedSec = (now - state.startedAt) / 1000
    const phase = getPhase(elapsedSec)
    npcs = tickNpcs(npcs, now, elapsedSec, dt, state.playerPos)
    const threat = computeThreat(npcs, state.playerPos, selfNoise)
    const drain = hpDrainPerSec(threat, CONFIG.damageCoeff[phase])
    const hp = Math.max(0, state.hp - drain * dt)
    const alive = hp > 0

    let targetId = state.targetId
    if (!targetId || !npcs.some((n) => n.id === targetId)) {
      targetId =
        npcs.find((n) => n.status === 'smacking')?.id ??
        npcs.find((n) => n.status === 'walking')?.id ??
        npcs[0]?.id ??
        null
    }

    set({
      elapsedSec,
      phase,
      npcs,
      threat,
      selfNoise,
      selfNoiseUntil,
      hp,
      alive,
      targetId,
      title: titleForTime(elapsedSec),
      toast,
      hitFx,
      skillAction,
      cooldownReadyAt,
      guideTip: guideForElapsed(elapsedSec),
      shoutBannerUntil:
        now > state.shoutBannerUntil ? 0 : state.shoutBannerUntil,
    })
  },
}))

export { SKILL_ORDER }
