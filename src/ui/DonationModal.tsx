import { CONFIG } from '../game/config'
import { t } from '../game/i18n'

export function DonationModal({ onClose }: { onClose: () => void }) {
  const { afdianUrl, kofiUrl } = CONFIG.donation

  return (
    <div className="donation-modal" onClick={onClose}>
      <div className="donation-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t('donation_title')}</h2>
        <div className="donation-lede">
          <p>{t('donation_p1')}</p>
          <p>{t('donation_p2')}</p>
          <p>{t('donation_p3')}</p>
        </div>

        <a
          className="donation-link afdian"
          href={afdianUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('donation_afdian')}
        </a>

        {kofiUrl && (
          <a
            className="donation-link kofi"
            href={kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('donation_kofi')}
          </a>
        )}

        <button type="button" className="donation-close" onClick={onClose}>
          {t('donation_close')}
        </button>
      </div>
    </div>
  )
}
