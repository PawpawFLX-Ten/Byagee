import { useState } from 'react'
import {
  unlockAudio,
  getSfxVolume,
  getVoiceVolume,
  setSfxVolume,
  setVoiceVolume,
} from '../game/audio'
import { todaySeed, installDailyRandom, restoreRandom, loadDailyBest } from '../game/daily'
import { useGameStore } from '../game/store'
import { dishLabel } from '../game/commercial/dishes'
import { getFeaturedDishId, isCommercial, selectSkin } from '../game/commercial/runtime'
import { dishForSkill, feedPowerForSkill } from '../game/commercial/session'
import { getLang, t } from '../game/i18n'
import type { Lang } from '../game/i18n'
import { SkillIcon } from './SkillIcon'
import { DonationModal } from './DonationModal'
import { LeadForm } from './LeadForm'
import { useBrandSkin } from './useBrandSkin'

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

type SkillCard = {
  key: SkillKey
  id: SkillIdSlug
  name: string
  unlock: string
  pro: string
  con: string
  perks: string
}

function getSkills(): SkillCard[] {
  const rows: SkillCard[] = [
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
  if (!isCommercial()) return rows
  const lang = getLang()
  const featured = getFeaturedDishId()
  return rows.map((row) => {
    const dish = dishForSkill(row.id)
    const mark = featured && row.id === 'gag' ? ` · ${t('brand_dish')}` : ''
    return {
      ...row,
      unlock: t('unlock_ready'),
      perks: `${dish.emoji} ${dishLabel(dish, lang)} · +${feedPowerForSkill(row.id, 1)}${mark}`,
    }
  })
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
  const [showLead, setShowLead] = useState(false)
  const [resumable] = useState(() => useGameStore.getState().hasResumableRun())
  const dailyBest = loadDailyBest()
  const skin = useBrandSkin()
  const commercial = isCommercial()

  if (briefingDone) return null

  const skills = getSkills()
  const title = commercial
    ? (skin.titleOverride ?? (lang === 'zh' ? skin.titleZh : skin.titleEn))
    : t('briefing_h1')

  const toggleLang = () => {
    if (commercial) {
      setLang(lang === 'zh' ? 'en' : 'zh')
      return
    }
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
            {commercial
              ? (lang === 'zh' ? 'EN' : 'ZH')
              : (lang === 'zh' ? 'EN' : lang === 'en' ? 'NL' : 'ZH')}
          </button>
          <h1>{title}</h1>
          {commercial ? (
            <button
              type="button"
              className="inquiry-btn"
              onClick={() => setShowLead(true)}
            >
              {t('lead_inquiry')}
            </button>
          ) : (
            <button
              type="button"
              className="donation-btn"
              onClick={() => setShowDonation(true)}
            >
              {t('briefing_donation')}
            </button>
          )}
        </div>
        {commercial && (
          <p className="value-prop">
            {t('value_prop').replace('{sec}', String(skin.roundLimitSec))}
          </p>
        )}
        {commercial && (
          <p className="business-email">
            {t('lead_business')}{' '}
            <a href={`mailto:${skin.mailto}`}>{skin.mailto}</a>
          </p>
        )}
        <p className="lede">
          {t('briefing_lede')}
          {best && (
            <em className="best-line">
              {t('best_record')} {best.score}
            </em>
          )}
        </p>

        {commercial && (
          <div className="skin-switch" role="group" aria-label={t('skin_switch')}>
            <button
              type="button"
              className={skin.id === 'hearth' ? 'on' : ''}
              onClick={() => selectSkin('hearth')}
            >
              {t('skin_hearth')}
            </button>
            <button
              type="button"
              className={skin.id === 'popup' ? 'on' : ''}
              onClick={() => selectSkin('popup')}
            >
              {t('skin_popup')}
            </button>
          </div>
        )}

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
            restoreRandom()
            beginMission()
          }}
        >
          {t('briefing_go')}
        </button>
        {!commercial && (
        <button
          type="button"
          className="briefing-go briefing-daily"
          onClick={() => {
            void unlockAudio()
            installDailyRandom(todaySeed())
            beginMission()
          }}
        >
          {t('daily_title')} #{todaySeed()}
          {dailyBest !== null && (
            <em className="daily-best">{t('daily_best')} {dailyBest}</em>
          )}
        </button>
        )}
        {!commercial && resumable && (
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
        {commercial && (
          <button
            type="button"
            className="sponsor-link"
            onClick={() => setShowDonation(true)}
          >
            {t('briefing_donation')}
          </button>
        )}
        {showDonation && <DonationModal onClose={() => setShowDonation(false)} />}
        {showLead && (
          <div className="donation-modal" onClick={() => setShowLead(false)}>
            <div className="donation-card" onClick={(e) => e.stopPropagation()}>
              <h2>{t('lead_inquiry')}</h2>
              <LeadForm outcome="inquiry" fedPoints={0} feedTarget={skin.feedTarget} />
              <button type="button" className="donation-close" onClick={() => setShowLead(false)}>
                {t('donation_close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
