import { useEffect, useMemo } from 'react'
import { CONFIG, SKILL_ORDER } from '../game/config'
import { useGameStore } from '../game/store'
import type { SkillId } from '../game/types'
import { titleForTime } from '../game/titles'

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
  const cooldownReadyAt = useGameStore((s) => s.cooldownReadyAt)
  const playerPos = useGameStore((s) => s.playerPos)
  const npcs = useGameStore((s) => s.npcs)
  const targetId = useGameStore((s) => s.targetId)
  const useSkill = useGameStore((s) => s.useSkill)
  const cycle = useGameStore((s) => s.cycleTarget)
  const restart = useGameStore((s) => s.restart)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' || e.code === 'Numpad1') useSkill('slap')
      if (e.code === 'Digit2' || e.code === 'Numpad2') useSkill('tape')
      if (e.code === 'Digit3' || e.code === 'Numpad3') useSkill('megaphone')
      if (e.code === 'Digit4' || e.code === 'Numpad4') useSkill('gag')
      if (e.code === 'Tab') {
        e.preventDefault()
        cycle()
      }
      if (e.code === 'KeyR' && !alive) restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [useSkill, cycle, restart, alive])

  const threatPct = Math.min(100, (threat / 1.2) * 100)
  const threatClass =
    threat >= CONFIG.hardThreat
      ? 'hard'
      : threat >= CONFIG.softThreat
        ? 'soft'
        : 'ok'

  const edge = useMemo(() => {
    const target = npcs.find((n) => n.id === targetId)
    if (!target || !alive) return null
    const dx = target.position[0] - playerPos[0]
    const dz = target.position[2] - playerPos[2]
    const ang = Math.atan2(dx, -dz)
    return ang
  }, [npcs, targetId, playerPos, alive])

  const now = performance.now()

  return (
    <div className="hud">
      <div className="top-bar">
        <div className="meter">
          <span>HP</span>
          <div className="bar">
            <div
              className="fill hp"
              style={{ width: `${(hp / CONFIG.maxHp) * 100}%` }}
            />
          </div>
        </div>
        <div className="meter">
          <span>噪音</span>
          <div className={`bar threat-${threatClass}`}>
            <div className="fill threat" style={{ width: `${threatPct}%` }} />
          </div>
        </div>
        <div className="meta">
          <span>{formatTime(elapsedSec)}</span>
          <span className="phase">{phase}</span>
        </div>
      </div>

      <div className="skills">
        {SKILL_ORDER.map((id, i) => {
          const skill = CONFIG.skills[id as SkillId]
          const readyAt = cooldownReadyAt[id as SkillId] ?? 0
          const left = Math.max(0, (readyAt - now) / 1000)
          const ready = left <= 0
          return (
            <button
              key={id}
              type="button"
              className={`skill ${ready ? 'ready' : 'cd'}`}
              onClick={() => useSkill(id as SkillId)}
              disabled={!alive}
            >
              <kbd>{i + 1}</kbd>
              <span>{skill.displayName}</span>
              {!ready && <em>{left.toFixed(1)}s</em>}
            </button>
          )
        })}
      </div>

      <p className="hint">
        WASD 移动 · 拖拽旋转镜头 · Tab 切换目标 · 1拍 2胶条 3喇叭 4塞嘴
      </p>

      {edge !== null && (
        <div
          className="edge-cue"
          style={{ transform: `translate(-50%, -50%) rotate(${edge}rad)` }}
        >
          ▲
        </div>
      )}

      {!alive && (
        <div className="death">
          <h1>吧唧致死</h1>
          <p>
            存活 <strong>{formatTime(elapsedSec)}</strong>
          </p>
          <p className="title-badge">{titleForTime(elapsedSec)}</p>
          <p className="restart">按 R 再来一局</p>
          <button type="button" onClick={() => restart()}>
            重开
          </button>
        </div>
      )}

      {alive && elapsedSec < 2 && (
        <div className="toast">制止吧唧嘴！噪音过高会掉血</div>
      )}
    </div>
  )
}
