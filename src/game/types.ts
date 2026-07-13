export type NpcStatus = 'idle' | 'smacking' | 'silenced' | 'sealed'

export type SkillId = 'tape' | 'slap' | 'megaphone' | 'gag'

export interface NpcState {
  id: string
  status: NpcStatus
  statusUntil: number
  seatIndex: number
  position: [number, number, number]
  baseLoudness: number
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
}
