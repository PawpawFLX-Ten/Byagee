import { CONFIG } from '../game/config'

export function DonationModal({ onClose }: { onClose: () => void }) {
  const { afdianUrl, kofiUrl } = CONFIG.donation

  return (
    <div className="donation-modal" onClick={onClose}>
      <div className="donation-card" onClick={(e) => e.stopPropagation()}>
        <h2>☕ 吧唧钱包</h2>
        <div className="donation-lede">
          <p>本作在人类学意义上，冒犯了许多人。</p>
          <p>如果您感到被冒犯，先向您下跪磕头，并诚恳请求您吃饭闭嘴</p>
          <p>愿意支持作者，表示您愿意庄严承诺：咀嚼时把嘴闭上，并献出一点小小爱心支持作者在北京买房的宏图萎夜。</p>
        </div>

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
