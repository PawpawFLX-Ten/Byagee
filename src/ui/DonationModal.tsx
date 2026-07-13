import { CONFIG } from '../game/config'

export function DonationModal({ onClose }: { onClose: () => void }) {
  const { afdianUrl, kofiUrl } = CONFIG.donation

  return (
    <div className="donation-modal" onClick={onClose}>
      <div className="donation-card" onClick={(e) => e.stopPropagation()}>
        <h2>☕ 请作者喝杯咖啡</h2>
        <p className="donation-lede">
          这是一款免费的无盈利游戏。如果你玩得开心，可以支持一下开发者——纯自愿，不影响任何游戏体验。
        </p>

        <a
          className="donation-link afdian"
          href={afdianUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          爱发电（微信/支付宝）
        </a>

        {kofiUrl && (
          <a
            className="donation-link kofi"
            href={kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ko-fi（PayPal / 信用卡）
          </a>
        )}

        <button type="button" className="donation-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
