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
      const sources = s.npcs
        .filter((n) => n.status === 'smacking')
        .map((n) => ({ id: n.id, position: n.position }))
      syncChews(sources, s.playerPos)
      if (s.threat >= CONFIG.hardThreat) setThreatLevel(2)
      else if (s.threat >= CONFIG.softThreat) setThreatLevel(1)
      else setThreatLevel(0)
    }, 50)
    return () => window.clearInterval(id)
  }, [])

  return null
}
