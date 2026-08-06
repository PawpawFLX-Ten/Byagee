import { create } from 'zustand'
import { CONFIG, SKILL_ORDER } from './config'
import { createBossNpc, tickBossRage } from './bossModules'
import {
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
  isSearchEscalated,
  latchOpening,
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
  type SpaceLayoutState,
} from './spaceLayout'
import {
  consumePendingSpaceEvent,
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
import { titleForTime } from './titles'
import { t, setLang, getLang, type Lang } from './i18n'
import type {
  DifficultyPhase,
  FoodSpot,
  NpcState,
  PropState,
  RoomId,
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
  pendingSpaceEventAt: number | null
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
  lang: Lang
  setLang: (lang: Lang) => void
  start: (now?: number) => void
  restart: (now?: number) => void
  beginMission: (now?: number) => void
  setPlayerPos: (pos: [number, number, number]) => void
  setHideState: (hidden: boolean, now?: number) => void
  applyLatch: (openingId: string, now?: number) => void
  cycleTarget: () => void
  useSkill: (skillId: SkillId, now?: number) => void
  tick: (dt: number, now: number) => void
  clearToast: () => void
  clearSpaceEventToast: () => void
  setReduceNausea: (on: boolean) => void
  togglePause: () => void
}

let fxSeq = 1
let npcSeq = 0
let lastDoorEventAt = 0
let nextBossAtElapsed = CONFIG.boss.intervalSec

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
  pendingSpaceEventAt: null,
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
      xp: 0,
      level: 1,
      plungerUntil: 0,
      levelUpAt: 0,
      props: [],
      nextPropAt: CONFIG.props.spawnIntervalSec,
      propSeq: 0,
      paused: false,
      layout: createInitialLayout(),
      playerRoomId: 'r0',
      bossesCleared: 0,
      pendingSpaceEventAt: null,
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
      xp: 0,
      level: 1,
      plungerUntil: 0,
      levelUpAt: 0,
      props: [],
      nextPropAt: CONFIG.props.spawnIntervalSec,
      propSeq: 0,
      paused: false,
      layout: createInitialLayout(),
      playerRoomId: 'r0',
      bossesCleared: 0,
      pendingSpaceEventAt: null,
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
    })
  },

  restart: (now = performance.now()) => {
    get().beginMission(now)
  },

  setPlayerPos: (pos) => set({ playerPos: pos }),

  setHideState: (hidden, now = performance.now()) =>
    set({
      playerHidden: hidden,
      hideStartedAt: hidden ? now : null,
    }),

  applyLatch: (openingId, now = performance.now()) =>
    set((s) => ({
      layout: latchOpening(s.layout, openingId, now, CONFIG.door.position),
    })),

  cycleTarget: () => {
    const { npcs, targetId } = get()
    set({ targetId: cycleTarget(npcs, targetId) })
  },

  clearToast: () => set({ toast: null }),
  clearSpaceEventToast: () => set({ spaceEventToast: null }),

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
    if (!state.alive || !state.briefingDone) return
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
    let pendingSpaceEventAt = state.pendingSpaceEventAt
    let queuedSpaceEventId = state.queuedSpaceEventId
    let lastSpaceEventAt = state.lastSpaceEventAt
    let minorMorphsSinceBoss = state.minorMorphsSinceBoss
    let layout = tickLatch(state.layout, now)
    let runtimeTables = state.runtimeTables
    let runtimeSeats = state.runtimeSeats
    let runtimeFoodSpots = state.runtimeFoodSpots
    let maxNpcs = state.maxNpcs
    let spaceEventToast = state.spaceEventToast

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
    const tickResult = tickNpcs(npcs, now, elapsedSec, dt, state.playerPos, layout.obstacles)
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
      n.role === 'chaser'
        ? stepChaser(n, state.playerPos, layout, layout.obstacles, dt, now, {
            playerHidden,
            hideEscalated,
            playerRoomId,
          })
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
        // If at cap, evict a non-critical NPC first
        if (npcs.length >= maxNpcs) {
          const admission = planBossAdmission(npcs, now)
          if (admission && admission.type === 'evict') {
            // Directly remove the evicted NPC — boss needs the slot immediately
            npcs = npcs.filter((n) => n.id !== admission.npcId)
          }
        }
        // Spawn boss into a free seat
        const occupiedSeats = new Set(
          npcs.filter((n) => n.seatIndex >= 0).map((n) => n.seatIndex),
        )
        const free = freeSeatIndexes(occupiedSeats)
        if (free.length && npcs.length < maxNpcs) {
          npcs = [...npcs, createBossNpc(free[0], now, elapsedSec, `boss-${++npcSeq}`)]
          bossSpawnThisBeat = true
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
      })
    ) {
      npcs = [
        ...npcs,
        createChaser(`chaser-${++npcSeq}`, CONFIG.door.position, doorRoomId, now),
      ]
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
      const pos = sampleFloorPosition(runtimeTables, CONFIG.door.position)
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
    }

    // --- Remove fully faded props ---
    const fadeDuration = 300 // ms
    props = props.filter((p) => p.fadingSince === null || now - p.fadingSince < fadeDuration)

    const alive = hp > 0

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
      rng: () => Math.random(),
    })
    if (spaceConsumed) {
      pendingSpaceEventAt = spaceConsumed.pendingSpaceEventAt
      queuedSpaceEventId = spaceConsumed.queuedSpaceEventId
      lastSpaceEventAt = spaceConsumed.lastSpaceEventAt
      minorMorphsSinceBoss = spaceConsumed.minorMorphsSinceBoss
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
          return {
            ...n,
            seatIndex: newIdx,
            roomId: roomIdForSeatIndex(layout, runtimeSeats, newIdx),
          }
        }
        return {
          ...n,
          roomId: roomIdForSeatIndex(layout, runtimeSeats, n.seatIndex),
        }
      })

      let seatedCount = npcs.filter((n) => !n.exiting).length
      while (seatedCount > maxNpcs && npcs.some((n) => !n.exiting && n.role !== 'boss')) {
        const victim = npcs.find((n) => !n.exiting && n.role !== 'boss')
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
        seatedCount = npcs.filter((n) => !n.exiting).length
      }
    }

    let targetId = state.targetId
    if (!targetId || !npcs.some((n) => n.id === targetId)) {
      targetId =
        npcs.find((n) => n.status === 'smacking')?.id ??
        npcs.find((n) => n.status !== 'walking')?.id ??
        null
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
      pendingSpaceEventAt,
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
