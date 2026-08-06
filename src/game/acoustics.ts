import { CONFIG } from './config'
import type { RoomId } from './types'

export function roomGate(playerRoom: RoomId, npcRoom: RoomId, hopDistance: number): number {
  if (playerRoom === npcRoom) return 1
  if (hopDistance <= 1) return CONFIG.acoustics.roomGateNeighbor
  return CONFIG.acoustics.roomGateFar
}

export function openingFactor(latchedOnPath: boolean): number {
  return latchedOnPath ? CONFIG.acoustics.closedDoorMute : 1
}

export function floorFactor(sameRoom: boolean, sameFloor: boolean): number {
  if (!sameRoom) return 1
  return sameFloor ? 1 : CONFIG.acoustics.floorFactorSameRoom
}
