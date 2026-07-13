export type NpcStatus =
  | 'idle'
  | 'walking'
  | 'smacking'
  | 'silenced'
  | 'sealed'

export type SkillId = 'tape' | 'slap' | 'megaphone' | 'gag'

export type SealProp = 'tape' | 'gag' | null

export interface FoodSpot {
  id: string
  /** On-table visual position */
  plate: [number, number, number]
  /** Floor approach point beside the table */
  approach: [number, number, number]
}

export type NpcRole = 'normal' | 'boss'

export type TableShape = 'round' | 'rect' | 'oval'

export interface TableDef {
  id: string
  shape: TableShape
  /** Center XZ */
  position: [number, number, number]
  /** For round: radius on XZ. For rect/oval: half extents x,z */
  half: { x: number; z: number }
  /** Visual Y top of tabletop */
  topY: number
}

export interface DoorConfig {
  position: [number, number, number]
  maxNpcs: number
  startNpcCount: number
  timedIntervalSec: number
  threatEnterBiasAbove: number
  threatExitBiasBelow: number
  idleExitSec: number
  plugins: {
    timedUnlockSec: number
    threatUnlockSec: number
    seatUnlockSec: number
  }
}

export interface BossConfig {
  intervalSec: number
  scale: number
  baseLoudness: number
  rageRadius: number
  resistanceWindowSec: number
  mouthHpByEra: [number, number, number] // early/mid/late boss windows
  moduleUnlockSec: { a: number; b: number; c: number }
}

export interface NpcState {
  id: string
  status: NpcStatus
  statusUntil: number
  seatIndex: number
  position: [number, number, number]
  /** Radians, Yaw */
  facing: number
  baseLoudness: number
  sealProp: SealProp
  foodId: string | null
  /** Head wobble after being hit */
  wobbleUntil: number
  /** Consecutive low-progress walk ticks — used to unstick jams */
  stuckTicks: number
  role: NpcRole
  scale: number
  mouthHp: number
  mouthHpMax: number
  bossModules: { a: boolean; b: boolean; c: boolean }
  comboHits: number
  lastHitAt: number
  raging: boolean
  exiting: boolean
  idleSince: number
}

export interface SkillDef {
  id: SkillId
  displayName: string
  cooldown: number
  range: number
  silenceDuration: number
  tags: string[]
  aoeRadius?: number
  selfNoise?: number
  applyStatus: 'silenced' | 'sealed'
  windup: number
}

export type DifficultyPhase = 'early' | 'mid' | 'late'

export interface GameConfig {
  maxHp: number
  softThreat: number
  hardThreat: number
  softDrainPerSec: number
  hardDrainPerSec: number
  roomReverb: number
  playerSpeed: number
  skillRangeDefault: number
  phases: {
    earlyEnd: number
    midEnd: number
  }
  damageCoeff: Record<DifficultyPhase, number>
  silenceScale: Record<DifficultyPhase, number>
  maxOverlappingSmackers: Record<DifficultyPhase, number>
  skills: Record<SkillId, SkillDef>
  titles: { minTime: number; title: string }[]
  npcCount: number
  seatPositions: [number, number, number][]
  foodSpots: FoodSpot[]
  npcWalkSpeed: number
  shoutLine: string
  tables: TableDef[]
  door: DoorConfig
  boss: BossConfig
  slapShoutLine: string
}
