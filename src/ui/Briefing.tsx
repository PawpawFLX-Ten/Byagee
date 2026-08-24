import { useState } from 'react'
import {
  unlockAudio,
  getSfxVolume,
  getVoiceVolume,
  setSfxVolume,
  setVoiceVolume,
} from '../game/audio'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'
import type { Lang } from '../game/i18n'
import { SkillIcon } from './SkillIcon'
import { DonationModal } from './DonationModal'

type SkillKey = '1' | '2' | '3' | '4' | 'Q' | 'E'
type SkillIdSlug = 'slap' | 'tape' | 'megaphone' | 'gag' | 'poop' | 'civility'

/** Collapsible SFX/voice sliders — hidden by default to keep mobile layout tight. */
function VolumeControl() {
  const [open, setOpen] = useState(false)
  const [sfx, setSfx] = useState(getSfxVolume)
  const [voice, setVoice] = useState(getVoiceVolume)

  if (!open) {
    return (
      <button
        type="button"
        className="vol-toggle"
        onClick={() => setOpen(true)}
        aria-label={t('vol_sfx')}
      >
        🔊
      </button>
    )
  }
  return (
    <div className="vol-row">
      <label>
        <span>{t('vol_sfx')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={sfx}
          onChange={(e) => {
            const v = Number(e.target.value)
            setSfx(v)
            setSfxVolume(v)
          }}
        />
        <em>{Math.round(sfx * 100)}%</em>
      </label>
      <label>
        <span>{t('vol_voice')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={voice}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVoice(v)
            setVoiceVolume(v)
          }}
        />
        <em>{Math.round(voice * 100)}%</em>
      </label>
    </div>
  )
}

function getSkills(): {
  key: SkillKey
  id: SkillIdSlug
  name: string
  unlock: string
  pro: string
  con: string
  perks: string
}[] {
  return [
    {
      key: '1',
      id: 'slap',
      name: t('skill_slap'),
      unlock: t('unlock_default'),
      pro: t('slap_pro'),
      con: t('slap_con'),
      perks: t('slap_perks'),
    },
    {
      key: '2',
      id: 'tape',
      name: t('skill_tape'),
      unlock: t('unlock_default'),
      pro: t('tape_pro'),
      con: t('tape_con'),
      perks: t('tape_perks'),
    },
    {
      key: '3',
      id: 'megaphone',
      name: t('skill_megaphone'),
      unlock: t('unlock_default'),
      pro: t('megaphone_pro'),
      con: t('megaphone_con'),
      perks: t('megaphone_perks'),
    },
    {
      key: '4',
      id: 'gag',
      name: t('skill_gag'),
      unlock: t('unlock_default'),
      pro: t('gag_pro'),
      con: t('gag_con'),
      perks: t('gag_perks'),
    },
    {
      key: 'Q',
      id: 'poop',
      name: t('skill_poop'),
      unlock: t('unlock_lv5'),
      pro: t('poop_pro'),
      con: t('poop_con'),
      perks: t('poop_perks'),
    },
    {
      key: 'E',
      id: 'civility',
      name: t('skill_civility'),
      unlock: t('unlock_lv10'),
      pro: t('civility_pro'),
      con: t('civility_con'),
      perks: t('civility_perks'),
    },
  ]
}

export function Briefing() {
  const briefingDone = useGameStore((s) => s.briefingDone)
  const beginMission = useGameStore((s) => s.beginMission)
  const reduceNausea = useGameStore((s) => s.reduceNausea)
  const setReduceNausea = useGameStore((s) => s.setReduceNausea)
  const lang = useGameStore((s) => s.lang)
  const setLang = useGameStore((s) => s.setLang)
  const best = useGameStore((s) => s.best)
  const [showDonation, setShowDonation] = useState(false)
  const [resumable] = useState(() => useGameStore.getState().hasResumableRun())

  if (briefingDone) return null

  const skills = getSkills()

  const toggleLang = () => {
    const next: Lang = lang === 'zh' ? 'en' : lang === 'en' ? 'nl' : 'zh'
    setLang(next)
  }

  return (
    <div className="briefing">
      <div className="briefing-card">
        <div className="briefing-header">
          <button
            type="button"
            className="lang-btn"
            onClick={toggleLang}
          >
            {lang === 'zh' ? 'EN' : lang === 'en' ? 'NL' : 'ZH'}
          </button>
          <h1>{t('briefing_h1')}</h1>
          <button
            type="button"
            className="donation-btn"
            onClick={() => setShowDonation(true)}
          >
            {t('briefing_donation')}
          </button>
        </div>
        <p className="lede">
          {t('briefing_lede')}
          {best && (
            <em className="best-line">
              {t('best_record')} {best.score}
            </em>
          )}
        </p>

        <h2>{t('briefing_tools')}</h2>
        <ul className="skill-list">
          {skills.map((s) => (
            <li key={s.key}>
              <div className="skill-name">
                <span className={`skill-icon-wrap skill-icon-${s.id}`}>
                  <SkillIcon id={s.id} />
                </span>
                <kbd>{s.key}</kbd>
                <strong>{s.name}</strong>
                <em className="unlock">{s.unlock}</em>
              </div>
              <p className="skill-desc">
                <span className="pro">{t('pro_prefix')}{s.pro}</span>
                <span className="con">{t('con_prefix')}{s.con}</span>
              </p>
              <p className="perks">{s.perks}</p>
            </li>
          ))}
        </ul>

        <label className="nausea-toggle">
          <input
            type="checkbox"
            checked={reduceNausea}
            onChange={(e) => setReduceNausea(e.target.checked)}
          />
          {t('briefing_nausea')}
        </label>

        <VolumeControl />

        <button
          type="button"
          className="briefing-go"
          onClick={() => {
            void unlockAudio()
            beginMission()
          }}
        >
          {t('briefing_go')}
        </button>
        {resumable && (
          <button
            type="button"
            className="briefing-go briefing-resume"
            onClick={() => {
              void unlockAudio()
              useGameStore.getState().tryResumeRun()
            }}
          >
            {t('resume_run')}
          </button>
        )}
        <p className="briefing-foot">
          {t('briefing_foot')}
        </p>
        {showDonation && <DonationModal onClose={() => setShowDonation(false)} />}
      </div>
    </div>
  )
}
