import { useEffect, useRef } from 'react'
import {
  isAudioUnlocked,
  playDeath,
  playFail,
  playSkill,
  playSpaceEvent,
  reverbAmountForArea,
  setReduceNausea as applyNauseaAudio,
  setThreatLevel,
  syncChews,
  unlockAudio,
} from '../game/audio'
import { floorFactor, openingFactor, roomGate } from '../game/acoustics'
import { inFaceRadius } from '../game/chaser'
import { CONFIG } from '../game/config'
import { hopDistance, latchedOnPath } from '../game/spaceLayout'
import { useGameStore } from '../game/store'
import type { RoomId } from '../game/types'

/** Bridges game state → procedural audio. */
export function AudioDirector() {
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)
  const hitFx = useGameStore((s) => s.hitFx)
  const toast = useGameStore((s) => s.toast)
  const lastSkillOk = useGameStore((s) => s.lastSkillOk)
  const reduceNausea = useGameStore((s) => s.reduceNausea)
  const spaceEventAt = useGameStore((s) => s.spaceEventAt)
  const wasAlive = useRef(true)
  const lastHitId = useRef(0)
  const lastToastId = useRef(0)
  const lastSpaceEventAt = useRef(0)

  useEffect(() => {
    const unlock = () => {
      void unlockAudio()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    applyNauseaAudio(reduceNausea)
  }, [reduceNausea])

  useEffect(() => {
    if (wasAlive.current && !alive && briefingDone) playDeath()
    wasAlive.current = alive
  }, [alive, briefingDone])

  useEffect(() => {
    if (!hitFx || hitFx.id === lastHitId.current) return
    lastHitId.current = hitFx.id
    playSkill(hitFx.skillId)
  }, [hitFx])

  useEffect(() => {
    if (!toast || toast.id === lastToastId.current) return
    lastToastId.current = toast.id
    if (!lastSkillOk) playFail()
  }, [toast, lastSkillOk])

  useEffect(() => {
    if (!spaceEventAt || spaceEventAt === lastSpaceEventAt.current) return
    lastSpaceEventAt.current = spaceEventAt
    playSpaceEvent()
  }, [spaceEventAt])

  // 20Hz poll of positional chew audio + threat drone — audio pans don't need 60Hz.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = useGameStore.getState()
      if (!s.briefingDone || !s.alive) {
        syncChews([], s.playerPos)
        setThreatLevel(0)
        return
      }
      if (!isAudioUnlocked()) return
      const smackers = s.npcs.filter((n) => n.status === 'smacking')
      const sources = smackers.map((n) => ({ id: n.id, position: n.position }))

      // Same acoustics gates as threat: other rooms quieter + darker,
      // latched doors muffle more, face-smacking chasers are full volume.
      const layout = s.layout
      const playerRoom: RoomId = s.playerRoomId
      const playerRoomDef = layout.rooms.find((r) => r.id === playerRoom)
      const playerFloor = playerRoomDef?.floor ?? 0
      const floorOf = new Map<RoomId, number>(
        layout.rooms.map((r) => [r.id, r.floor]),
      )
      const now = performance.now()
      const gateFor = (id: string): number => {
        const npc = smackers.find((n) => n.id === id)
        if (!npc) return 1
        if (npc.role === 'chaser' && inFaceRadius(npc, s.playerPos)) return 1
        const gate =
          roomGate(playerRoom, npc.roomId, hopDistance(layout, playerRoom, npc.roomId)) *
          openingFactor(latchedOnPath(layout, playerRoom, npc.roomId, now)) *
          floorFactor(playerRoom === npc.roomId, floorOf.get(npc.roomId) === playerFloor)
        return gate
      }
      const area = playerRoomDef
        ? (playerRoomDef.max[0] - playerRoomDef.min[0]) *
          (playerRoomDef.max[1] - playerRoomDef.min[1])
        : 0
      syncChews(sources, s.playerPos, {
        gateFor,
        reverbAmount: reverbAmountForArea(area),
      })
      if (s.threat >= CONFIG.hardThreat) setThreatLevel(2)
      else if (s.threat >= CONFIG.softThreat) setThreatLevel(1)
      else setThreatLevel(0)
    }, 50)
    return () => window.clearInterval(id)
  }, [])

  return null
}
