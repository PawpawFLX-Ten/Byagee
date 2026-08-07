import { create } from 'zustand'
import { CONFIG, SKILL_ORDER } from './config'
import { createBossNpc, interruptBossPulse, tickBossRage } from './bossModules'
import {
  chaserExhaustSecForRound,
  createChaser,
  inFaceRadius,
  neighborThreatShare,
  shouldSpawnChaser,
  stepChaser,
  threatPartsFromNpcs,
} from './chaser'
import { getPhase } from './difficulty'
import { applyDoorAction, freeSeatIndexes, planBossAdmission, planDoorAction } from './doorSystem'
import {
  canLatchOpening,
  ensureMainDoorOpening,
  isSearchEscalated,
  latchOpening,
  MAIN_DOOR_OPENING_ID,
  tickLatch,
} from './hideLatch'
import { createNpcs, tickNpcs } from './npcFsm'
import { shouldSpawnProp, sampleFloorPosition, pickPropType, checkPickup, applyPropEffect, createProp } from './props'
import { levelForXp, isMaxLevel, isQUnlocked, isEUnlocked, XP_PER_SKILL_HIT_NORMAL, XP_PER_SKILL_HIT_BOSS, XP_PER_SURVIVAL_SEC, cdMultiplier } from './progression'
import { cycleTarget, tryUseSkill } from './skills'
import {
  createInitialLayout,
  floorFromPlayerY,
  hopDistance,
  latchedOnPath,
  roomIdAt,
  withFurniture,
  type SpaceLayoutState,
} from './spaceLayout'
import { layoutBoundsFromLayout } from './collision'
import {
  consumePendingSpaceEvent,
  maybeScheduleInterBossMinorMorph,
  onBossDemotedForSpace,
} from './spaceDirector'
import { applySpaceEvent, roomIdForSeatIndex } from './spaceApply'
import {
  createRuntimeSpaceFromConfig,
  resetRuntimeSpace,
  setRuntimeSpace,
  type RuntimeSpaceState,
} from './runtimeSpace'
import { computeThreat, hpDrainPerSec } from './threat'
import {
  checkAchievements,
  computeScore,
  loadBestRecord,
  loadUnlockedAchievements,
  saveBestRecord,
  saveUnlockedAchievements,
  type BestRecord,
} from './achievements'
import { titleForTime } from './titles'
import { t, setLang, getLang, type Lang } from './i18n'
import type {
  AchievementId,
  DifficultyPhase,
  FoodSpot,
  NpcState,
  PropState,
  RoomId,
  RunStats,
  SkillId,
  SpaceEventId,
  TableDef,
} from './types'

function syncRuntimeFromStore(
  tables: TableDef[],
  seats: [number, number, number][],
  foodSpots: FoodSpot[],
  maxNpcs: number,
): void {
  setRuntimeSpace({ tables, seatPositions: seats, foodSpots, maxNpcs })
}

function initialRuntime(): RuntimeSpaceState {
  return createRuntimeSpaceFromConfig()
}

function emptyCooldowns(): Record<SkillId, number> {
  return {
    slap: 0,
    tape: 0,
    megaphone: 0,
    gag: 0,
    poop: 0,
    civility: 0,
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

/** Visual hit-FX lifespan per skill (store + scene must agree). */
export const HIT_FX_MS: Record<SkillId, number> = {
  slap: 500,
  tape: 500,
  megaphone: 800,
  gag: 500,
  poop: 500,
  civility: 500,
}

export interface GameStore {
  hp: number
  alive: boolean
  startedAt: number
  elapsedSec: number
  npcs: NpcState[]
  playerPos: [number, number, number]
  playerYaw: number
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
  xp: number
  level: number
  plungerUntil: number
  levelUpAt: number
  props: PropState[]
  nextPropAt: number
  propSeq: number
  paused: boolean
  pausedAt: number
  layout: SpaceLayoutState
  playerRoomId: RoomId
  bossesCleared: number
  stats: RunStats
  unlockedThisRun: AchievementId[]
  achievementQueue: AchievementId[]
  best: BestRecord | null
  isNewBest: boolean
  lastScore: number
  pendingSpaceEventAt: number | null
  pendingMinorOnly: boolean
  queuedSpaceEventId: SpaceEventId | null
  lastSpaceEventAt: number
  minorMorphsSinceBoss: number
  runtimeTables: TableDef[]
  runtimeSeats: [number, number, number][]
  runtimeFoodSpots: FoodSpot[]
  maxNpcs: number
  spaceEventToast: SpaceEventId | null
  playerHidden: boolean
  hideStartedAt: number | null
  bossEtaSec: number | null
  lang: Lang
  setLang: (lang: Lang) => void
  start: (now?: number) => void
  restart: (now?: number) => void
  beginMission: (now?: number) => void
  setPlayerPos: (pos: [number, number, number], yaw?: number) => void
  setHideState: (hidden: boolean, now?: number) => void
  applyLatch: (openingId: string, now?: number) => boolean
  cycleTarget: () => void
  useSkill: (skillId: SkillId, now?: number) => void
  tick: (dt: number, now: number) => void
  clearToast: () => void
  clearSpaceEventToast: () => void
  shiftAchievementToast: () => void
  setReduceNausea: (on: boolean) => void
  togglePause: () => void
}

let fxSeq = 1
let npcSeq = 0
let lastDoorEventAt = 0
let nextBossAtElapsed = CONFIG.boss.intervalSec
let nextChaserAtElapsed = CONFIG.chaser.firstAtSec
let chaserRound = 0

/** Cross-run unlocked achievements — persists across missions. */
const unlockedAchievements = loadUnlockedAchievements()

// Cached layout bounds — layout is immutable and only changes on space events.
let cachedBoundsLayout: SpaceLayoutState | null = null
let cachedLayoutBounds: ReturnType<typeof layoutBoundsFromLayout> | null = null

function boundsForLayout(layout: SpaceLayoutState): ReturnType<typeof layoutBoundsFromLayout> {
  if (cachedBoundsLayout !== layout) {
    cachedBoundsLayout = layout
    cachedLayoutBounds = layoutBoundsFromLayout(layout, 0)
  }
  return cachedLayoutBounds ?? layoutBoundsFromLayout(layout, 0)
}

function failText(reason: string): string {
  switch (reason) {
    case 'cooldown':
      return t('toast_cooldown')
    case 'too_far':
      return t('toast_tooFar')
    case 'no_target':
      return t('toast_noTarget')
    default:
      return t('toast_fail')
  }
}

function demotedBossIds(before: NpcState[], after: NpcState[]): string[] {
  const bossIds = new Set(before.filter((n) => n.role === 'boss').map((n) => n.id))
  return after.filter((n) => bossIds.has(n.id) && n.role !== 'boss').map((n) => n.id)
}

function guideForElapsed(elapsed: number): string | null {
  if (elapsed < 3.5) return t('guide_1')
  if (elapsed < 7) return t('guide_2')
  if (elapsed < 11) return t('guide_3')
  if (elapsed < 15) return t('guide_4')
  return null
}

function faceYawToTarget(
  playerPos: [number, number, number],
  npcs: NpcState[],
  targetId: string | null,
  skillId: SkillId,
): number {
  if (skillId === 'megaphone' || skillId === 'poop' || skillId === 'civility') return 0
  if (skillId === 'gag') {
    // Gag auto-targets the farthest smacker — face that direction
    const smackers = npcs.filter((n) => n.status === 'smacking')
    if (!smackers.length) return 0
    const farthest = [...smackers].sort(
      (a, b) =>
        Math.hypot(b.position[0] - playerPos[0], b.position[2] - playerPos[2]) -
        Math.hypot(a.position[0] - playerPos[0], a.position[2] - playerPos[2]),
    )[0]
    return Math.atan2(farthest.position[0] - playerPos[0], farthest.position[2] - playerPos[2])
  }
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
  playerYaw: 0,
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
  xp: 0,
  level: 1,
  plungerUntil: 0,
  levelUpAt: 0,
  props: [],
  nextPropAt: CONFIG.props.spawnIntervalSec,
  propSeq: 0,
  paused: false,
  pausedAt: 0,
  layout: createInitialLayout(),
  playerRoomId: 'r0',
  bossesCleared: 0,
  stats: { skillHits: 0, propsPicked: 0, spaceEvents: 0, chaserKnockbacks: 0 },
  unlockedThisRun: [],
  achievementQueue: [],
  best: loadBestRecord(),
  isNewBest: false,
  lastScore: 0,
  pendingSpaceEventAt: null,
  pendingMinorOnly: false,
  queuedSpaceEventId: null,
  lastSpaceEventAt: 0,
  minorMorphsSinceBoss: 0,
  runtimeTables: initialRuntime().tables,
  runtimeSeats: initialRuntime().seatPositions,
  runtimeFoodSpots: initialRuntime().foodSpots,
  maxNpcs: initialRuntime().maxNpcs,
  spaceEventToast: null,
  playerHidden: false,
  hideStartedAt: null,
  bossEtaSec: null,
  lang: getLang(),

  setLang: (lang) => {
    setLang(lang)
    set({ lang })
  },

  start: (now = performance.now()) => {
    resetRuntimeSpace()
    const runtime = initialRuntime()
    syncRuntimeFromStore(runtime.tables, runtime.seatPositions, runtime.foodSpots, runtime.maxNpcs)
    const npcs = createNpcs(now)
    npcSeq = CONFIG.npcCount
    lastDoorEventAt = 0
    nextBossAtElapsed = CONFIG.boss.intervalSec
    nextChaserAtElapsed = CONFIG.chaser.firstAtSec
    chaserRound = 0
    set({
      hp: CONFIG.maxHp,
      alive: true,
      startedAt: 0,
      elapsedSec: 0,
      npcs,
      playerPos: [0, 0, 2.4],
      playerYaw: 0,
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
      xp: 0,
      level: 1,
      plungerUntil: 0,
      levelUpAt: 0,
      props: [],
      nextPropAt: CONFIG.props.spawnIntervalSec,
      propSeq: 0,
      paused: false,
      layout: withFurniture(createInitialLayout()),
      playerRoomId: 'r0',
      bossesCleared: 0,
      stats: { skillHits: 0, propsPicked: 0, spaceEvents: 0, chaserKnockbacks: 0 },
      unlockedThisRun: [],
      achievementQueue: [],
      best: loadBestRecord(),
      isNewBest: false,
      lastScore: 0,
      pendingSpaceEventAt: null,
      pendingMinorOnly: false,
      queuedSpaceEventId: null,
      lastSpaceEventAt: 0,
      minorMorphsSinceBoss: 0,
      runtimeTables: runtime.tables,
      runtimeSeats: runtime.seatPositions,
      runtimeFoodSpots: runtime.foodSpots,
      maxNpcs: runtime.maxNpcs,
      spaceEventToast: null,
      playerHidden: false,
      hideStartedAt: null,
      bossEtaSec: null,
    })
  },

  beginMission: (now = performance.now()) => {
    resetRuntimeSpace()
    const runtime = initialRuntime()
    syncRuntimeFromStore(runtime.tables, runtime.seatPositions, runtime.foodSpots, runtime.maxNpcs)
    const npcs = createNpcs(now)
    npcSeq = CONFIG.npcCount
    lastDoorEventAt = 0
    nextBossAtElapsed = CONFIG.boss.intervalSec
    nextChaserAtElapsed = CONFIG.chaser.firstAtSec
    chaserRound = 0
    set({
      briefingDone: true,
      alive: true,
      startedAt: now,
      elapsedSec: 0,
      hp: CONFIG.maxHp,
      npcs,
      playerPos: [0, 0, 2.4],
      playerYaw: 0,
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
      xp: 0,
      level: 1,
      plungerUntil: 0,
      levelUpAt: 0,
      props: [],
      nextPropAt: CONFIG.props.spawnIntervalSec,
      propSeq: 0,
      paused: false,
      layout: withFurniture(createInitialLayout()),
      playerRoomId: 'r0',
      bossesCleared: 0,
      stats: { skillHits: 0, propsPicked: 0, spaceEvents: 0, chaserKnockbacks: 0 },
      unlockedThisRun: [],
      achievementQueue: [],
      best: loadBestRecord(),
      isNewBest: false,
      lastScore: 0,
      pendingSpaceEventAt: null,
      pendingMinorOnly: false,
      queuedSpaceEventId: null,
      lastSpaceEventAt: 0,
      minorMorphsSinceBoss: 0,
      runtimeTables: runtime.tables,
      runtimeSeats: runtime.seatPositions,
      runtimeFoodSpots: runtime.foodSpots,
      maxNpcs: runtime.maxNpcs,
      spaceEventToast: null,
      playerHidden: false,
      hideStartedAt: null,
      bossEtaSec: null,
    })
  },

  restart: (now = performance.now()) => {
    get().beginMission(now)
  },

  setPlayerPos: (pos, yaw) =>
    set(
      yaw !== undefined ? { playerPos: pos, playerYaw: yaw } : { playerPos: pos },
    ),

  setHideState: (hidden, now = performance.now()) =>
    set({
      playerHidden: hidden,
      hideStartedAt: hidden ? now : null,
    }),

  applyLatch: (openingId, now = performance.now()) => {
    const state = get()
    let layout = state.layout
    if (openingId === MAIN_DOOR_OPENING_ID) {
      layout = ensureMainDoorOpening(layout, CONFIG.door.position)
    }
    const opening = layout.openings.find((o) => o.id === openingId)
    if (opening && canLatchOpening(opening, now)) {
      set({ layout: latchOpening(layout, openingId, now, CONFIG.door.position) })
      return true
    }
    set({
      toast: {
        id: fxSeq++,
        text: t('toast_latchCooldown'),
        until: now + 900,
      },
    })
    return false
  },

  cycleTarget: () => {
    const { npcs, targetId } = get()
    set({ targetId: cycleTarget(npcs, targetId) })
  },

  clearToast: () => set({ toast: null }),
  clearSpaceEventToast: () => set({ spaceEventToast: null }),

  shiftAchievementToast: () =>
    set((s) => ({
      achievementQueue: s.achievementQueue.slice(1),
    })),

  setReduceNausea: (on) => set({ reduceNausea: on }),

  togglePause: () => set((s) => {
    if (!s.paused) {
      return { paused: true, pausedAt: performance.now() }
    }
    const pauseDuration = performance.now() - (s.pausedAt || performance.now())
    return { paused: false, startedAt: s.startedAt + pauseDuration, pausedAt: 0 }
  }),

  useSkill: (skillId, now = performance.now()) => {
    const state = get()
    if (!state.alive || !state.briefingDone || state.paused) return
    if (skillId === 'poop' && !isQUnlocked(state.level)) return
    if (skillId === 'civility' && !isEUnlocked(state.level)) return
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
      state.level,
      { facingYaw: state.playerYaw },
    )
    if (!preview.ok) {
      set({
        lastSkillOk: false,
        toast: {
          id: fxSeq++,
          text: failText(preview.reason ?? ''),
          until: now + 900,
        },
      })
      return
    }

    const windup = CONFIG.skills[skillId].windup
    const castYaw =
      skillId === 'poop' ? state.playerYaw : faceYawToTarget(
        state.playerPos,
        state.npcs,
        state.targetId,
        skillId,
      )
    set({
      skillAction: {
        skillId,
        until: now + windup * 1000,
        faceYaw: castYaw,
      },
      // Reserve cooldown at windup start so spam is blocked
      cooldownReadyAt: {
        ...state.cooldownReadyAt,
        [skillId]: now + CONFIG.skills[skillId].cooldown * cdMultiplier(state.level) * 1000,
      },
      lastSkillOk: true,
      toast: {
        id: fxSeq++,
        text:
          skillId === 'megaphone'
            ? t('shoutLine')
            : skillId === 'poop'
            ? t('poopShoutLine')
            : skillId === 'civility'
            ? t('civilityShoutLine')
            : t(`skill_${skillId}`) + '！',
        until: now + Math.max(700, windup * 1000 + 200),
      },
      shoutBannerUntil:
        skillId === 'megaphone' ? now + 1200 : state.shoutBannerUntil,
    })
  },

  tick: (dt, now) => {
    const state = get()
    if (!state.briefingDone || !state.alive || !state.startedAt || state.paused) return

    let npcs = state.npcs
    let cooldownReadyAt = state.cooldownReadyAt
    let selfNoise = now < state.selfNoiseUntil ? state.selfNoise : 0
    let selfNoiseUntil = state.selfNoiseUntil
    let hitFx = state.hitFx && now > state.hitFx.until ? null : state.hitFx
    let skillAction = state.skillAction
    let toast = state.toast && now > state.toast.until ? null : state.toast
    let newXp = state.xp
    let plungerUntil = state.plungerUntil
    let healFromSkill = 0
    let levelUpAt = state.levelUpAt
    let props = state.props
    let nextPropAt = state.nextPropAt
    let propSeq = state.propSeq
    let bossesCleared = state.bossesCleared
    let stats = state.stats
    let pendingSpaceEventAt = state.pendingSpaceEventAt
    let pendingMinorOnly = state.pendingMinorOnly
    let queuedSpaceEventId = state.queuedSpaceEventId
    let lastSpaceEventAt = state.lastSpaceEventAt
    let minorMorphsSinceBoss = state.minorMorphsSinceBoss
    let layout = tickLatch(state.layout, now)
    let runtimeTables = state.runtimeTables
    let runtimeSeats = state.runtimeSeats
    let runtimeFoodSpots = state.runtimeFoodSpots
    let maxNpcs = state.maxNpcs
    let spaceEventToast = state.spaceEventToast
    const layoutBounds = boundsForLayout(layout)

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
        state.level,
        { facingYaw: skillAction.faceYaw },
      )
      if (result.ok) {
        const demoted = demotedBossIds(npcs, result.npcs)
        if (demoted.length > 0) {
          const spaceUpdate = onBossDemotedForSpace({
            bossesCleared,
            pendingSpaceEventAt,
            lastSpaceEventAt,
            now,
            demotedCount: demoted.length,
            eventCooldownSec: CONFIG.space.eventCooldownSec,
          })
          if (spaceUpdate) {
            bossesCleared = spaceUpdate.bossesCleared
            pendingSpaceEventAt = spaceUpdate.pendingSpaceEventAt
            minorMorphsSinceBoss = spaceUpdate.minorMorphsSinceBoss
          }
        }
        // Check if any hit NPC was smacking BEFORE the skill applied
        const resolvedSmacker = result.hitIds.some((id) =>
          npcs.find((n) => n.id === id)?.status === 'smacking',
        )
        const chaserStaggerBefore = new Map<string, number>()
        for (const n of npcs) {
          if (n.role === 'chaser') chaserStaggerBefore.set(n.id, n.staggerUntil)
        }
        npcs = result.npcs
        // Hitting a charging boss cancels its rage pulse (interrupt window).
        if (result.hitIds.length > 0) {
          npcs = npcs.map((n) => {
            if (n.role === 'boss' && result.hitIds.includes(n.id)) {
              return interruptBossPulse(n, now)
            }
            return n
          })
        }
        stats = {
          ...stats,
          skillHits: stats.skillHits + result.hitIds.length,
          chaserKnockbacks:
            stats.chaserKnockbacks +
            result.hitIds.filter((id) => {
              const hit = npcs.find((n) => n.id === id)
              return (
                hit?.role === 'chaser' &&
                hit.staggerUntil > (chaserStaggerBefore.get(id) ?? 0)
              )
            }).length,
        }
        // Keep original reserved cooldown, don't reset from tryUseSkill
        selfNoise = result.selfNoise
        selfNoiseUntil =
          result.selfNoise > 0 ? now + 1200 : selfNoiseUntil
        hitFx = {
          id: fxSeq++,
          npcIds: result.hitIds,
          skillId: skillAction.skillId,
          until: now + HIT_FX_MS[skillAction.skillId],
          playerPos: state.playerPos,
        }
        // Award XP for skill hits
        const xpGained = result.hitIds.reduce((sum, id) => {
          const npc = npcs.find((n) => n.id === id)
          const isBoss = npc?.role === 'boss'
          return sum + (isBoss ? XP_PER_SKILL_HIT_BOSS : XP_PER_SKILL_HIT_NORMAL)
        }, 0)
        newXp += xpGained
        // Civility sets plungerUntil
        if (skillAction.skillId === 'civility') {
          plungerUntil = now + CONFIG.skills.civility.silenceDuration * 1000
        }
        // HP heal from slap (Level 2+) and megaphone (Level 4+)
        if (resolvedSmacker) {
          if (skillAction.skillId === 'slap') {
            healFromSkill = state.level >= 6 ? 4 : state.level >= 2 ? 2 : 0
          } else if (skillAction.skillId === 'megaphone') {
            healFromSkill = state.level >= 8 ? 4 : state.level >= 4 ? 2 : 0
          }
        }
      }
      skillAction = null
    }

    const elapsedSec = (now - state.startedAt) / 1000
    const phase = getPhase(elapsedSec)
    // NPCs are guided through door gaps by waypointToward; only the player
    // gets wall colliders (see World.tsx) to avoid per-tick full-wall cost.
    const worldObstacles = layout.obstacles
    const tickResult = tickNpcs(
      npcs,
      now,
      elapsedSec,
      dt,
      state.playerPos,
      worldObstacles,
      layoutBounds,
      layout,
    )
    npcs = tickResult.npcs.filter((n) => !tickResult.despawnIds.includes(n.id))

    const playerHidden = state.playerHidden
    const hideEscalated = isSearchEscalated(state.hideStartedAt, now)
    const playerFloor = floorFromPlayerY(state.playerPos[1])
    const playerRoomId = roomIdAt(
      layout,
      state.playerPos[0],
      state.playerPos[2],
      playerFloor,
    )

    npcs = npcs.map((n) =>
      n.role === 'chaser' && !n.exiting
        ? stepChaser(n, state.playerPos, layout, worldObstacles, dt, now, {
            playerHidden,
            hideEscalated,
            playerRoomId,
            playerFloor,
            bounds: layoutBounds,
          })
        : n,
    )

    // Chasers exhaust after their round's pursuit time and walk out the door
    // (10s first round, +10s per round, max 60s — never permanent).
    const chaserExhaustSec = chaserExhaustSecForRound(chaserRound)
    npcs = npcs.map((n) =>
      n.role === 'chaser' &&
      !n.exiting &&
      now - n.idleSince >= chaserExhaustSec * 1000
        ? {
            ...n,
            exiting: true,
            status: 'walking' as const,
            foodId: null,
            statusUntil: now + 8000,
            smackingSince: 0,
          }
        : n,
    )

    const roomFloor = (roomId: RoomId) =>
      layout.rooms.find((r) => r.id === roomId)?.floor ?? 0

    const threat = computeThreat(npcs, state.playerPos, selfNoise, now, elapsedSec, {
      playerRoomId,
      npcRoomId: (npc) => npc.roomId,
      npcFloor: (npc) => roomFloor(npc.roomId),
      playerFloor,
      hopDistance: (npcRoom) => hopDistance(layout, playerRoomId, npcRoom),
      latchedOnPath: (npcRoom) => latchedOnPath(layout, playerRoomId, npcRoom, now),
      ignoreRoomGate: (npc) =>
        npc.role === 'chaser' && inFaceRadius(npc, state.playerPos),
    })

    // Boss spawn every intervalSec (max 1 boss at a time)
    let bossSpawnThisBeat = false
    if (elapsedSec >= nextBossAtElapsed) {
      nextBossAtElapsed += CONFIG.boss.intervalSec
      if (!npcs.some((n) => n.role === 'boss')) {
        // If at cap, evict a non-critical NPC first — it walks out, boss takes its seat.
        if (npcs.filter((n) => !n.exiting).length >= maxNpcs) {
          const admission = planBossAdmission(npcs, now)
          if (admission && admission.type === 'evict') {
            npcs = npcs.map((n) =>
              n.id === admission.npcId
                ? {
                    ...n,
                    exiting: true,
                    status: 'walking' as const,
                    foodId: null,
                    statusUntil: now + 6000,
                  }
                : n,
            )
          }
        }
        // Spawn boss into a free seat (evicted NPC's seat frees immediately)
        const occupiedSeats = new Set(
          npcs
            .filter((n) => n.seatIndex >= 0 && !n.exiting)
            .map((n) => n.seatIndex),
        )
        const free = freeSeatIndexes(occupiedSeats)
        if (
          free.length &&
          npcs.filter((n) => !n.exiting).length < maxNpcs
        ) {
          npcs = [...npcs, createBossNpc(free[0], now, elapsedSec, `boss-${++npcSeq}`)]
          bossSpawnThisBeat = true
          toast = { id: fxSeq++, text: t('toast_bossSpawn'), until: now + 2500 }
        }
      }
    }

    const chaserCount = npcs.filter((n) => n.role === 'chaser').length
    const neighborShare = neighborThreatShare(
      playerRoomId,
      threatPartsFromNpcs(npcs, state.playerPos),
    )
    const doorRoomId = roomIdAt(
      layout,
      CONFIG.door.position[0],
      CONFIG.door.position[2],
      0,
    )
    // Chase rounds: first at firstAtSec, then every roundGapSec.
    const roundDue = elapsedSec >= nextChaserAtElapsed
    if (roundDue) {
      nextChaserAtElapsed += CONFIG.chaser.roundGapSec
    }
    if (
      shouldSpawnChaser({
        phase,
        roomCount: layout.rooms.length,
        neighborShare,
        chaserCount,
        bossPresent: npcs.some((n) => n.role === 'boss'),
        bossSpawnThisBeat,
        totalNpcCount: npcs.length,
        maxNpcs,
        roundDue,
      })
    ) {
      npcs = [
        ...npcs,
        createChaser(`chaser-${++npcSeq}`, CONFIG.door.position, doorRoomId, now),
      ]
      if (roundDue) chaserRound += 1
      toast = { id: fxSeq++, text: t('toast_chaserSpawn'), until: now + 2200 }
    }

    // Normal door traffic (timed / threat / seat plugins)
    const occupiedForDoor = new Set(
      npcs.filter((n) => n.seatIndex >= 0).map((n) => n.seatIndex),
    )
    const doorAction = planDoorAction({
      npcs,
      elapsedSec,
      now,
      threat,
      lastDoorEventAt,
      occupiedSeatIndexes: occupiedForDoor,
    })
    if (doorAction) {
      npcs = applyDoorAction(npcs, doorAction, now, () => `npc-${++npcSeq}`, layout)
      lastDoorEventAt = now
    }

    // Boss rage — clear seals + force smacking on nearby NPCs at ≤50% mouth HP
    const boss = npcs.find((n) => n.role === 'boss')
    if (boss) {
      const rageResult = tickBossRage(boss, npcs, now)
      npcs = rageResult.npcs
    }

    const drain = hpDrainPerSec(threat, CONFIG.damageCoeff[phase])
    let hp = Math.max(0, state.hp - drain * dt)
    if (healFromSkill > 0 && !playerHidden) {
      hp = Math.min(CONFIG.maxHp, hp + healFromSkill)
    }

    // Survival XP (1 per second)
    newXp += XP_PER_SURVIVAL_SEC * dt

    // Level up check
    let level = state.level
    const newLevel = levelForXp(newXp)
    if (newLevel > level) {
      level = newLevel
      levelUpAt = now
      toast = { id: fxSeq++, text: `${t('toast_levelUp_prefix')}LV${level}`, until: now + 2000 }
    }

    // Overflow heal at max level
    if (isMaxLevel(level) && !playerHidden) {
      const maxXp = CONFIG.levelXpTable[CONFIG.levelXpTable.length - 1]
      const overflow = Math.max(0, newXp - maxXp)
      const healPerSec = overflow > 0 ? Math.min(2, overflow / 50) : 0
      hp = Math.min(CONFIG.maxHp, hp + healPerSec * dt)
    }

    // --- Prop spawn ---
    if (shouldSpawnProp({ elapsedSec, nextPropAt, existingProps: props, alive: hp > 0 })) {
      const type = pickPropType(hp, CONFIG.maxHp)
      const pos = sampleFloorPosition(runtimeTables, CONFIG.door.position, layout)
      const id = `prop-${propSeq + 1}`
      const prop = createProp(type, pos, now, id)
      props = [...props, prop]
      nextPropAt += CONFIG.props.spawnIntervalSec
      propSeq += 1
    }

    // --- Prop pickup ---
    const pickedUp = checkPickup(props, state.playerPos, CONFIG.props.pickupRadius)
    if (pickedUp) {
      const effect = applyPropEffect(pickedUp, npcs, hp, CONFIG.maxHp, now)
      npcs = effect.npcs
      hp = effect.hp
      toast = { id: fxSeq++, text: effect.toastText, until: now + 2000 }
      props = props.map((p) => (p.id === pickedUp.id ? { ...p, fadingSince: now } : p))
      stats = { ...stats, propsPicked: stats.propsPicked + 1 }
    }

    // --- Remove fully faded props ---
    const fadeDuration = 300 // ms
    props = props.filter((p) => p.fadingSince === null || now - p.fadingSince < fadeDuration)

    const alive = hp > 0
    const bossEtaSec = npcs.some((n) => n.role === 'boss')
      ? null
      : Math.max(0, nextBossAtElapsed - elapsedSec)

    // Inter-boss minor morph (C5) once per cooldown window
    const interBoss = maybeScheduleInterBossMinorMorph({
      bossesCleared,
      pendingSpaceEventAt,
      queuedSpaceEventId,
      lastSpaceEventAt,
      minorMorphsSinceBoss,
      now,
      eventCooldownSec: CONFIG.space.eventCooldownSec,
      minorMorphMaxBetweenBosses: CONFIG.space.minorMorphMaxBetweenBosses,
      pendingMinorOnly,
    })
    if (interBoss) {
      pendingSpaceEventAt = interBoss.pendingSpaceEventAt
      pendingMinorOnly = interBoss.pendingMinorOnly
    }

    // SpaceDirector: pick queued event when due (Task 5 applies geometry)
    const spaceConsumed = consumePendingSpaceEvent({
      pendingSpaceEventAt,
      queuedSpaceEventId,
      lastSpaceEventAt,
      minorMorphsSinceBoss,
      now,
      phaseLate: phase === 'late',
      eventCooldownSec: CONFIG.space.eventCooldownSec,
      minorMorphMaxBetweenBosses: CONFIG.space.minorMorphMaxBetweenBosses,
      pendingMinorOnly,
      rng: () => Math.random(),
    })
    if (spaceConsumed) {
      pendingSpaceEventAt = spaceConsumed.pendingSpaceEventAt
      queuedSpaceEventId = spaceConsumed.queuedSpaceEventId
      lastSpaceEventAt = spaceConsumed.lastSpaceEventAt
      minorMorphsSinceBoss = spaceConsumed.minorMorphsSinceBoss
      pendingMinorOnly = spaceConsumed.pendingMinorOnly
    }

    if (queuedSpaceEventId) {
      const applied = applySpaceEvent({
        layout,
        tables: runtimeTables,
        seatPositions: runtimeSeats,
        foodSpots: runtimeFoodSpots,
        maxNpcs,
        eventId: queuedSpaceEventId,
        rng: () => Math.random(),
      })
      layout = applied.layout
      runtimeTables = applied.tables
      runtimeSeats = applied.seatPositions
      runtimeFoodSpots = applied.foodSpots
      maxNpcs = applied.doorMaxNpcs ?? applied.maxNpcs
      syncRuntimeFromStore(runtimeTables, runtimeSeats, runtimeFoodSpots, maxNpcs)
      spaceEventToast = queuedSpaceEventId
      queuedSpaceEventId = null
      stats = { ...stats, spaceEvents: stats.spaceEvents + 1 }

      const invalidSet = new Set(applied.invalidSeatIndices ?? [])
      const remap = applied.seatIndexRemap
      npcs = npcs.map((n) => {
        if (invalidSet.has(n.seatIndex)) {
          return {
            ...n,
            exiting: true,
            status: 'walking' as const,
            foodId: null,
            statusUntil: now + 6000,
          }
        }
        if (remap && remap.has(n.seatIndex)) {
          const newIdx = remap.get(n.seatIndex)!
          const newSeat = runtimeSeats[newIdx]
          const seated =
            n.status === 'idle' ||
            n.status === 'silenced' ||
            n.status === 'sealed'
          return {
            ...n,
            seatIndex: newIdx,
            roomId: roomIdForSeatIndex(layout, runtimeSeats, newIdx),
            // Seated NPCs teleport to their new seat during the morph;
            // in-transit NPCs keep walking.
            position:
              seated && newSeat
                ? ([...newSeat] as [number, number, number])
                : n.position,
          }
        }
        return {
          ...n,
          roomId: roomIdForSeatIndex(layout, runtimeSeats, n.seatIndex),
        }
      })

      let seatedCount = npcs.filter(
        (n) => !n.exiting && n.role !== 'chaser' && n.seatIndex >= 0,
      ).length
      while (
        seatedCount > maxNpcs - npcs.filter((n) => n.role === 'chaser').length &&
        npcs.some((n) => !n.exiting && n.role !== 'boss' && n.role !== 'chaser')
      ) {
        const victim = npcs.find(
          (n) => !n.exiting && n.role !== 'boss' && n.role !== 'chaser',
        )
        if (!victim) break
        npcs = npcs.map((n) =>
          n.id === victim.id
            ? {
                ...n,
                exiting: true,
                status: 'walking' as const,
                foodId: null,
                statusUntil: now + 6000,
              }
            : n,
        )
        seatedCount = npcs.filter(
          (n) => !n.exiting && n.role !== 'chaser' && n.seatIndex >= 0,
        ).length
      }
    }

    let targetId = state.targetId
    if (!targetId || !npcs.some((n) => n.id === targetId)) {
      targetId =
        npcs.find((n) => n.status === 'smacking')?.id ??
        npcs.find((n) => n.status !== 'walking')?.id ??
        null
    }

    // --- Score + achievements ---
    let lastScore = state.lastScore
    let isNewBest = state.isNewBest
    let best = state.best
    if (!alive && state.alive) {
      lastScore = computeScore({
        elapsedSec,
        skillHits: stats.skillHits,
        bossesCleared,
        propsPicked: stats.propsPicked,
        spaceEvents: stats.spaceEvents,
        chaserKnockbacks: stats.chaserKnockbacks,
        level,
      })
      if (!best || lastScore > best.score) {
        isNewBest = true
        best = { score: lastScore, survivalSec: Math.floor(elapsedSec), bossesCleared }
        saveBestRecord(best)
      }
    }
    let unlockedThisRun = state.unlockedThisRun
    let achievementQueue = state.achievementQueue
    const newly = checkAchievements(
      {
        elapsedSec,
        skillHits: stats.skillHits,
        bossesCleared,
        propsPicked: stats.propsPicked,
        spaceEvents: stats.spaceEvents,
        chaserKnockbacks: stats.chaserKnockbacks,
        level,
      },
      unlockedAchievements,
    )
    if (newly.length > 0) {
      for (const id of newly) unlockedAchievements.add(id)
      saveUnlockedAchievements([...unlockedAchievements])
      unlockedThisRun = [...unlockedThisRun, ...newly]
      achievementQueue = [...achievementQueue, ...newly]
    }

    set({
      elapsedSec,
      phase,
      npcs,
      layout,
      runtimeTables,
      runtimeSeats,
      runtimeFoodSpots,
      maxNpcs,
      spaceEventToast,
      playerRoomId,
      threat,
      selfNoise,
      selfNoiseUntil,
      hp,
      alive,
      bossEtaSec,
      targetId,
      title: titleForTime(elapsedSec),
      toast,
      hitFx,
      skillAction,
      cooldownReadyAt,
      guideTip: guideForElapsed(elapsedSec),
      shoutBannerUntil:
        now > state.shoutBannerUntil ? 0 : state.shoutBannerUntil,
      xp: newXp,
      level,
      plungerUntil,
      levelUpAt,
      props,
      nextPropAt,
      propSeq,
      bossesCleared,
      stats,
      unlockedThisRun,
      achievementQueue,
      best,
      isNewBest,
      lastScore,
      pendingSpaceEventAt,
      pendingMinorOnly,
      queuedSpaceEventId,
      lastSpaceEventAt,
      minorMorphsSinceBoss,
    })
  },
}))

const bootRuntime = initialRuntime()
syncRuntimeFromStore(
  bootRuntime.tables,
  bootRuntime.seatPositions,
  bootRuntime.foodSpots,
  bootRuntime.maxNpcs,
)

export { SKILL_ORDER }
