import { useEffect, useState } from 'react'
import { unlockAudio, setReduceNausea as applyNauseaAudio } from '../game/audio'
import { CONFIG, SKILL_ORDER } from '../game/config'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'
import { computeScore } from '../game/achievements'
import { SkillIcon } from './SkillIcon'
import type { SkillId } from '../game/types'
import { titleForTime } from '../game/titles'
import { xpForNextLevel, MAX_LEVEL, isQUnlocked, isEUnlocked } from '../game/progression'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Hud() {
  // Rare-changing state only — everything per-frame is polled at 10Hz below.
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)
  const toast = useGameStore((s) => s.toast)
  const lastSkillOk = useGameStore((s) => s.lastSkillOk)
  const spaceEventToast = useGameStore((s) => s.spaceEventToast)
  const clearSpaceEventToast = useGameStore((s) => s.clearSpaceEventToast)
  const paused = useGameStore((s) => s.paused)
  const togglePause = useGameStore((s) => s.togglePause)
  const reduceNausea = useGameStore((s) => s.reduceNausea)
  const setReduceNausea = useGameStore((s) => s.setReduceNausea)
  const fireSkill = useGameStore((s) => s.useSkill)
  const cycle = useGameStore((s) => s.cycleTarget)
  const restart = useGameStore((s) => s.restart)
  const props = useGameStore((s) => s.props)
  const achievementQueue = useGameStore((s) => s.achievementQueue)
  const shiftAchievementToast = useGameStore((s) => s.shiftAchievementToast)
  useGameStore((s) => s.lang) // re-render on language change
  const [, setTick] = useState(0)
  const [achVisible, setAchVisible] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 100)
    return () => window.clearInterval(id)
  }, [])

  // Achievement toasts: show queue head for 2.5s, then shift.
  useEffect(() => {
    if (achievementQueue.length === 0) return
    setAchVisible(true)
    const id = window.setTimeout(() => {
      setAchVisible(false)
      shiftAchievementToast()
    }, 2500)
    return () => window.clearTimeout(id)
  }, [achievementQueue, shiftAchievementToast])

  useEffect(() => {
    if (!spaceEventToast) return
    const id = window.setTimeout(() => clearSpaceEventToast(), 2500)
    return () => window.clearTimeout(id)
  }, [spaceEventToast, clearSpaceEventToast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      void unlockAudio()
      if (!briefingDone) return
      if (e.code === 'Digit1' || e.code === 'Numpad1') fireSkill('slap')
      if (e.code === 'Digit2' || e.code === 'Numpad2') fireSkill('tape')
      if (e.code === 'Digit3' || e.code === 'Numpad3') fireSkill('megaphone')
      if (e.code === 'Digit4' || e.code === 'Numpad4') fireSkill('gag')
      if (e.code === 'KeyQ') fireSkill('poop')
      if (e.code === 'KeyE') fireSkill('civility')
      if (e.code === 'Tab') {
        e.preventDefault()
        cycle()
      }
      if (e.code === 'KeyR' && !alive) restart()
      if (e.code === 'Escape') togglePause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fireSkill, cycle, restart, alive, briefingDone, togglePause])

  // Volatile values snapshotted at render time (10Hz tick + rare-key rerenders).
  const s = useGameStore.getState()
  const hp = s.hp
  const threat = s.threat
  const elapsedSec = s.elapsedSec
  const phase = s.phase
  const cooldownReadyAt = s.cooldownReadyAt
  const npcs = s.npcs
  const playerPos = s.playerPos
  const xp = s.xp
  const level = s.level
  const selfNoise = s.selfNoise
  const bossEtaSec = s.bossEtaSec
  const guideTip = s.guideTip
  const population = npcs.length
  const hasBoss = npcs.some((n) => n.role === 'boss')
  const targetId = s.targetId
  const maxNpcs = s.maxNpcs
  const stats = s.stats
  const bossesCleared = s.bossesCleared
  const best = s.best
  const isNewBest = s.isNewBest
  const lastScore = s.lastScore
  const unlockedThisRun = s.unlockedThisRun

  if (!briefingDone) return null

  const threatPct = Math.min(100, (threat / 1.2) * 100)
  const threatClass =
    threat >= CONFIG.hardThreat
      ? 'hard'
      : threat >= CONFIG.softThreat
        ? 'soft'
        : 'ok'

  const now = performance.now()
  const showToast = toast && now < toast.until

  const SKILL_KEYS = ['1', '2', '3', '4', 'Q', 'E'] as const

  // Edge cue: target direction from player (recomputed each render).
  const target = npcs.find((n) => n.id === targetId)
  let edge: number | null = null
  if (target && alive) {
    const dx = target.position[0] - playerPos[0]
    const dz = target.position[2] - playerPos[2]
    edge = Math.atan2(dx, -dz)
  }

  const prop = props.find((p) => p.fadingSince === null)
  let propEdge: number | null = null
  if (prop) {
    const dx = prop.position[0] - playerPos[0]
    const dz = prop.position[2] - playerPos[2]
    propEdge = Math.atan2(dx, -dz)
  }

  const bossInbound = bossEtaSec !== null && bossEtaSec > 0 && bossEtaSec <= 12
  const liveScore = computeScore({
    elapsedSec,
    skillHits: stats.skillHits,
    bossesCleared,
    propsPicked: stats.propsPicked,
    spaceEvents: stats.spaceEvents,
    chaserKnockbacks: stats.chaserKnockbacks,
    level,
  })

  return (
    <div className={`hud ${threatClass === 'hard' ? 'danger' : ''}`}>
      <div className="top-bar">
        <button
          type="button"
          className="pause-btn"
          onClick={() => togglePause()}
          title={t('hud_pauseTitle')}
        >
          {paused ? '▶' : '⏸'}
        </button>
        <div className="meter">
          <span>{t('hud_hp')}</span>
          <div className="bar">
            <div
              className="fill hp"
              style={{ width: `${(hp / CONFIG.maxHp) * 100}%` }}
            />
          </div>
        </div>
        <div className="meter">
          <span>{t('hud_noise')}</span>
          <div className={`bar threat-${threatClass}`}>
            <div className="fill threat" style={{ width: `${threatPct}%` }} />
          </div>
        </div>
        <div className="meter">
          <span>LV{level}</span>
          <div className="bar">
            {level < MAX_LEVEL ? (
              <div className="fill xp" style={{ width: `${Math.min(100, (xp / (xpForNextLevel(level) ?? 1)) * 100)}%` }} />
            ) : (
              <div className="fill xp" style={{ width: '100%' }} />
            )}
          </div>
        </div>
        <div className="meta">
          <span>{formatTime(elapsedSec)}</span>
          <span className="phase">{phase}</span>
          {selfNoise > 0 && <span className="self-noise">{t('hud_selfNoise')}</span>}
          <span className="population">{population}/{maxNpcs}</span>
          <span className="score-chip" title={t('score_label')}>{liveScore}</span>
          {hasBoss && <span className="boss-cue">BOSS</span>}
          {bossInbound && <span className="boss-eta">{t('hud_bossEta')} {Math.ceil(bossEtaSec!)}s</span>}
        </div>
        <label className="hud-nausea">
          <input
            type="checkbox"
            checked={reduceNausea}
            onChange={(e) => {
              setReduceNausea(e.target.checked)
              applyNauseaAudio(e.target.checked)
            }}
          />
           {t('hud_nauseaShort')}
        </label>
      </div>

      <div className="skills">
        {SKILL_ORDER.map((id, i) => {
          const readyAt = cooldownReadyAt[id as SkillId] ?? 0
          const left = Math.max(0, (readyAt - now) / 1000)
          const ready = left <= 0
          const locked = (id === 'poop' && !isQUnlocked(level)) || (id === 'civility' && !isEUnlocked(level))
          return (
            <button
              key={id}
              type="button"
              className={`skill ${ready ? 'ready' : 'cd'} skill-${id}${locked ? ' locked' : ''}`}
              onClick={() => {
                void unlockAudio()
                fireSkill(id as SkillId)
              }}
              disabled={!alive || locked}
            >
              <span className={`skill-icon-wrap skill-icon-${id}`}>
                <SkillIcon id={id as SkillId} />
              </span>
              <kbd>{SKILL_KEYS[i]}</kbd>
              <span className="skill-label">{t(`skill_${id}`)}</span>
              {locked ? <em>🔒LV{id === 'poop' ? 5 : 10}</em> : !ready && <em>{left.toFixed(1)}s</em>}
            </button>
          )
        })}
      </div>

      <p className="hint">
        {t('hud_hint')}
      </p>

      {edge !== null && (
        <div
          className="edge-cue"
          style={{ transform: `translate(-50%, -50%) rotate(${edge}rad)` }}
        >
          ▲
        </div>
      )}

      {propEdge !== null && (
        <div
          className="edge-cue prop-cue"
          style={{ transform: `translate(-50%, -50%) rotate(${propEdge}rad)` }}
        >
          ✦
        </div>
      )}

      {showToast && (
        <div className={`toast ${toast.text.startsWith(t('toast_levelUp_prefix')) ? 'levelup' : lastSkillOk ? 'ok' : 'fail'}`}>
          {toast.text}
        </div>
      )}

      {spaceEventToast && (
        <div className="toast space-event">{t(`spaceEvent_${spaceEventToast}`)}</div>
      )}

      {!showToast && !spaceEventToast && guideTip && alive && (
        <div className="toast guide">{guideTip}</div>
      )}

      {achVisible && achievementQueue[0] && (
        <div className="achievement-toast">
          <strong>{t(`ach_${achievementQueue[0]}`)}</strong>
          <span>{t(`ach_${achievementQueue[0]}_desc`)}</span>
        </div>
      )}

      {!alive && (
        <div className="death">
          <h1>{t('hud_deathTitle')}</h1>
          <p>
            {t('hud_survived')} <strong>{formatTime(elapsedSec)}</strong>
          </p>
          <p className="title-badge">{titleForTime(elapsedSec)}</p>
          {isNewBest && <p className="new-record">{t('new_record')}</p>}
          <div className="score-box">
            <div className="score-total">
              <strong>{lastScore}</strong>
              <em>{t('score_label')}</em>
            </div>
            <ul className="score-breakdown">
              <li>{t('score_survival')} <span>{Math.floor(elapsedSec)}</span></li>
              <li>{t('score_hits')} <span>{stats.skillHits}×10</span></li>
              <li>{t('score_bosses')} <span>{bossesCleared}×250</span></li>
              <li>{t('score_events')} <span>{stats.spaceEvents}×100</span></li>
              <li>{t('score_props')} <span>{stats.propsPicked}×50</span></li>
              <li>{t('score_chasers')} <span>{stats.chaserKnockbacks}×75</span></li>
            </ul>
            {best && (
              <p className="best-record">
                {t('best_record')} <strong>{best.score}</strong>
              </p>
            )}
          </div>
          {unlockedThisRun.length > 0 && (
            <ul className="run-achievements">
              {unlockedThisRun.map((id) => (
                <li key={id}>
                  <strong>{t(`ach_${id}`)}</strong>
                  <span>{t(`ach_${id}_desc`)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="restart">{t('hud_deathRestart')}</p>
          <button type="button" onClick={() => restart()}>
            {t('hud_restart')}
          </button>
        </div>
      )}
    </div>
  )
}
