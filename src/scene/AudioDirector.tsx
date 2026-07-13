import { useEffect, useRef } from 'react'
import {
  isAudioUnlocked,
  playDeath,
  playFail,
  playSkill,
  setReduceNausea as applyNauseaAudio,
  setThreatLevel,
  syncChews,
  unlockAudio,
} from '../game/audio'
import { CONFIG } from '../game/config'
import { useGameStore } from '../game/store'

/** Bridges game state → procedural audio. */
export function AudioDirector() {
  const npcs = useGameStore((s) => s.npcs)
  const playerPos = useGameStore((s) => s.playerPos)
  const threat = useGameStore((s) => s.threat)
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)
  const hitFx = useGameStore((s) => s.hitFx)
  const toast = useGameStore((s) => s.toast)
  const lastSkillOk = useGameStore((s) => s.lastSkillOk)
  const reduceNausea = useGameStore((s) => s.reduceNausea)
  const wasAlive = useRef(true)
  const lastHitId = useRef(0)
  const lastToastId = useRef(0)

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
    if (!briefingDone || !alive) {
      syncChews([], playerPos)
      return
    }
    if (!isAudioUnlocked()) return
    const sources = npcs
      .filter((n) => n.status === 'smacking')
      .map((n) => ({ id: n.id, position: n.position }))
    syncChews(sources, playerPos)
  }, [npcs, alive, playerPos, briefingDone])

  useEffect(() => {
    if (!alive || !briefingDone) {
      setThreatLevel(0)
      return
    }
    if (threat >= CONFIG.hardThreat) setThreatLevel(2)
    else if (threat >= CONFIG.softThreat) setThreatLevel(1)
    else setThreatLevel(0)
  }, [threat, alive, briefingDone])

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

  return null
}
