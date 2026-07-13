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
}
