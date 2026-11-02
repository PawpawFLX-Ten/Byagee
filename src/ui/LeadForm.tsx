import { useState } from 'react'
import { submitLead } from '../game/commercial/lead'
import { displayTitle, getResolvedSkin } from '../game/commercial/runtime'
import { commercialTitle, type CommercialOutcome } from '../game/commercial/session'
import { t } from '../game/i18n'
import { useGameStore } from '../game/store'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LeadForm({
  outcome,
  fedPoints,
  feedTarget,
}: {
  outcome: CommercialOutcome | 'inquiry'
  fedPoints: number
  feedTarget: number
}) {
  const lang = useGameStore((s) => s.lang)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  if (done) {
    return <p className="lead-success">{t('lead_success')}</p>
  }

  return (
    <form
      className="lead-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || !contact.trim() || !privacy) {
          setError(t('lead_need'))
          return
        }
        setError('')
        setPending(true)
        const skin = getResolvedSkin()
        void submitLead({
          name: name.trim(),
          contact: contact.trim(),
          privacy: true,
          skinId: skin.id,
          title: displayTitle(lang),
          lang,
          fedPoints,
          feedTarget,
          outcome,
          page: typeof window !== 'undefined' ? window.location.href : '',
          createdAt: new Date().toISOString(),
        }).then(() => {
          setPending(false)
          setDone(true)
        })
      }}
    >
      <label>
        <span>{t('lead_name')}</span>
        <input
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        <span>{t('lead_contact')}</span>
        <input
          name="contact"
          autoComplete="email"
          inputMode="email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </label>
      <label className="lead-privacy">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
        />
        <span>{t('lead_privacy')}</span>
      </label>
      {error && <p className="lead-error">{error}</p>}
      <button type="submit" className="lead-cta" disabled={pending}>
        {t('lead_cta')}
      </button>
      <p className="lead-note">{t('lead_demo_note')}</p>
    </form>
  )
}

export function CommercialEndScreen({ onRestart }: { onRestart: () => void }) {
  const fedPoints = useGameStore((s) => s.fedPoints)
  const feedTarget = useGameStore((s) => s.feedTarget)
  const outcome = useGameStore((s) => s.commercialOutcome)
  const elapsedSec = useGameStore((s) => s.elapsedSec)
  const lang = useGameStore((s) => s.lang)
  const won = outcome === 'win'
  const title = commercialTitle(fedPoints, feedTarget, outcome === 'playing' ? 'lose' : outcome, lang)

  return (
    <div className="death commercial-end">
      <h1>{won ? t('win_h1') : t('lose_h1')}</h1>
      <p className="title-badge">{title}</p>
      <p className="end-stat">
        {t('hud_fed')} <strong>{fedPoints}/{feedTarget}</strong>
        <span> · {t('hud_survived')} {formatTime(elapsedSec)}</span>
      </p>
      <p className="end-sub">{won ? t('win_sub') : t('lose_sub')}</p>
      <LeadForm outcome={won ? 'win' : 'lose'} fedPoints={fedPoints} feedTarget={feedTarget} />
      <button type="button" className="end-restart" onClick={onRestart}>
        {t('hud_restart')}
      </button>
      <p className="restart">{t('hud_deathRestart')}</p>
    </div>
  )
}
