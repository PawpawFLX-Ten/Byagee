export type NpcStatus =
  | 'idle'
  | 'walking'
  | 'smacking'
  | 'silenced'
  | 'sealed'

export type SkillId = 'tape' | 'slap' | 'megaphone' | 'gag' | 'poop' | 'civility'

export type SealProp = 'tape' | 'gag' | null

export interface FoodSpot {
  id: string
  /** On-table visual position */
  plate: [number, number, number]
  /** Floor approach point beside the table */
  approach: [number, number, number]
}

export type NpcRole = 'normal' | 'boss' | 'chaser'

export type RoomId = string

export interface SpaceOpening {
  id: string
  fromRoom: RoomId
  toRoom: RoomId
  /** World position of door center */
  position: [number, number, number]
  latchedUntil: number
}

export interface SpaceRoom {
  id: RoomId
  /** AABB-ish bounds for membership tests (y ignored or floor band) */
  min: [number, number]
  max: [number, number]
  floor: number
}

export type SpaceEventId = 'A1' | 'A2' | 'A3' | 'A4' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5'

export interface SpaceEventDef {
  id: SpaceEventId
  kind: 'A' | 'C'
  inFirstRewardPool: boolean
  weightLate: number
}

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
  roomId: RoomId
  /** Chaser: cannot face-smack until this time */
  staggerUntil: number
  /** Chaser AI target player pursuit */
  chaseTarget: boolean
  scale: number
  mouthHp: number
  mouthHpMax: number
  bossModules: { a: boolean; b: boolean; c: boolean }
  comboHits: number
  lastHitAt: number
  raging: boolean
  exiting: boolean
  idleSince: number
  smackingSince: number
  noiseReduction: number
}

export interface SkillDef {
  id: SkillId
  displayName: string
  cooldown: number
  range: number
  silenceDuration: number
  tags: string[]
  aoeRadius?: number
  coneAngle?: number
  selfNoise?: number
  applyStatus: 'silenced' | 'sealed'
  windup: number
}

export type DifficultyPhase = 'early' | 'mid' | 'late'

export interface DonationConfig {
  afdianUrl: string
  kofiUrl: string
  label: string
}

export type PropType = 'heal' | 'silence'

export interface PropState {
  id: string
  type: PropType
  position: [number, number, number]
  spawnedAt: number
  /** Timestamp when pickup fade-out started; null while idle */
  fadingSince: number | null
}

export interface PropsConfig {
  spawnIntervalSec: number
  healAmount: number
  silenceSec: number
  pickupRadius: number
  floatHeight: number
  spawnMargin: number
  tableMargin: number
  doorExclusionRadius: number
}

export interface AcousticsConfig {
  roomGateNeighbor: number
  roomGateFar: number
  floorFactorSameRoom: number
  closedDoorMute: number
}

export interface SpaceConfig {
  eventCooldownSec: number
  eventCooldownMinSec: number
  firstEventDelayAfterBossDemoteMs: number
  minorMorphMaxBetweenBosses: number
}

export interface ChaserConfig {
  faceRadius: number
  maxCountLate: number
  knockbackDist: number
  staggerSec: number
  baseLoudness: number
  walkSpeed: number
  neighborThreatShareToSpawn: number
}

export interface HideLatchConfig {
  holdSec: number
  latchDurationSec: number
  searchEscalateSec: number
  interactRadius: number
}

export interface GameConfig {
  maxHp: number
  softThreat: number
  hardThreat: number
  softDrainPerSec: number
  hardDrainPerSec: number
  roomReverb: number
  smackDelay: {
    initialSec: number
    decayPerEra: number
    minSec: number
  }
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
  tapeShoutLine: string
  gagShoutLine: string
  levelXpTable: number[]
  poopShoutLine: string
  civilityShoutLine: string
  donation: DonationConfig
  props: PropsConfig
  acoustics: AcousticsConfig
  space: SpaceConfig
  chaser: ChaserConfig
  hideLatch: HideLatchConfig
}
