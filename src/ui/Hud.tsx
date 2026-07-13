import { useEffect, useMemo, useState } from 'react'
import { unlockAudio, setReduceNausea as applyNauseaAudio } from '../game/audio'
import { CONFIG, SKILL_ORDER } from '../game/config'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'
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
  const hp = useGameStore((s) => s.hp)
  const threat = useGameStore((s) => s.threat)
  const elapsedSec = useGameStore((s) => s.elapsedSec)
  const phase = useGameStore((s) => s.phase)
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)
  const cooldownReadyAt = useGameStore((s) => s.cooldownReadyAt)
  const playerPos = useGameStore((s) => s.playerPos)
  const npcs = useGameStore((s) => s.npcs)
  const population = npcs.length
  const hasBoss = npcs.some((n) => n.role === 'boss')
  const targetId = useGameStore((s) => s.targetId)
  const useSkill = useGameStore((s) => s.useSkill)
  const cycle = useGameStore((s) => s.cycleTarget)
  const restart = useGameStore((s) => s.restart)
  const toast = useGameStore((s) => s.toast)
  const lastSkillOk = useGameStore((s) => s.lastSkillOk)
  const guideTip = useGameStore((s) => s.guideTip)
  const reduceNausea = useGameStore((s) => s.reduceNausea)
  const setReduceNausea = useGameStore((s) => s.setReduceNausea)
  const selfNoise = useGameStore((s) => s.selfNoise)
  const xp = useGameStore((s) => s.xp)
  const level = useGameStore((s) => s.level)
  const paused = useGameStore((s) => s.paused)
  const togglePause = useGameStore((s) => s.togglePause)
  useGameStore((s) => s.lang) // re-render on language change
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 100)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      void unlockAudio()
      if (!briefingDone) return
      if (e.code === 'Digit1' || e.code === 'Numpad1') useSkill('slap')
      if (e.code === 'Digit2' || e.code === 'Numpad2') useSkill('tape')
      if (e.code === 'Digit3' || e.code === 'Numpad3') useSkill('megaphone')
      if (e.code === 'Digit4' || e.code === 'Numpad4') useSkill('gag')
      if (e.code === 'KeyQ') useSkill('poop')
      if (e.code === 'KeyE') useSkill('civility')
      if (e.code === 'Tab') {
        e.preventDefault()
        cycle()
      }
      if (e.code === 'KeyR' && !alive) restart()
      if (e.code === 'Escape') togglePause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [useSkill, cycle, restart, alive, briefingDone, togglePause])

  // Must stay above any early return — hooks order cannot change after briefing.
  const edge = useMemo(() => {
    const target = npcs.find((n) => n.id === targetId)
    if (!target || !alive) return null
    const dx = target.position[0] - playerPos[0]
    const dz = target.position[2] - playerPos[2]
    return Math.atan2(dx, -dz)
  }, [npcs, targetId, playerPos, alive])

  const props = useGameStore((s) => s.props)

  const propEdge = useMemo(() => {
    const prop = props.find((p) => p.fadingSince === null)
    if (!prop) return null
    const dx = prop.position[0] - playerPos[0]
    const dz = prop.position[2] - playerPos[2]
    return Math.atan2(dx, -dz)
  }, [props, playerPos])

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
          <span className="population">{population}/{CONFIG.door.maxNpcs}</span>
          {hasBoss && <span className="boss-cue">BOSS</span>}
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
                useSkill(id as SkillId)
              }}
              disabled={!alive || locked}
            >
              <span className={`skill-icon-wrap skill-icon-${id}`}>
                <SkillIcon id={id as SkillId} />
              </span>
              <kbd>{SKILL_KEYS[i]}</kbd>
              <span>{t(`skill_${id}`)}</span>
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

      {!showToast && guideTip && alive && (
        <div className="toast guide">{guideTip}</div>
      )}

      {!alive && (
        <div className="death">
          <h1>{t('hud_deathTitle')}</h1>
          <p>
            {t('hud_survived')} <strong>{formatTime(elapsedSec)}</strong>
          </p>
          <p className="title-badge">{titleForTime(elapsedSec)}</p>
          <p className="restart">{t('hud_deathRestart')}</p>
          <button type="button" onClick={() => restart()}>
            {t('hud_restart')}
          </button>
        </div>
      )}
    </div>
  )
}
