import { useState } from 'react'
import { unlockAudio } from '../game/audio'
import { useGameStore } from '../game/store'
import { SkillIcon } from './SkillIcon'
import { DonationModal } from './DonationModal'

const SKILLS = [
  {
    key: '1',
    id: 'slap' as const,
    name: '抽脸',
    unlock: '初始',
    pro: '手拍玩具抽脸，冷却最短，救急首选',
    con: '沉默极短，治标不治本',
    perks: '2级起回血2 · 6级回血4',
  },
  {
    key: '2',
    id: 'tape' as const,
    name: '胶条',
    unlock: '初始',
    pro: '伸手贴嘴，封得久，性价比体面',
    con: '要贴脸，慢半拍就白贴',
    perks: '3级起降噪 · 7级降噪增强',
  },
  {
    key: '3',
    id: 'megaphone' as const,
    name: '吼',
    unlock: '初始',
    pro: '怒喝「都他妈把嘴闭上」，范围静音',
    con: '你自己也变噪音——以毒攻毒，文明蒙羞',
    perks: '4级起回血2 · 8级回血4',
  },
  {
    key: '4',
    id: 'gag' as const,
    name: '塞嘴',
    unlock: '初始',
    pro: '智能寻址最远嘴巴。入口柔，胰腺瘘',
    con: '冷却漫长，莫当普通拍子用',
    perks: '9级起 Boss双倍伤害 · 普通双倍封印',
  },
  {
    key: 'Q',
    id: 'poop' as const,
    name: '泼屎',
    unlock: '5级解锁',
    pro: '眼界之内，自由飞翔',
    con: '谁也别吃了',
    perks: '「请您吃顿好的 哈哈！」',
  },
  {
    key: 'E',
    id: 'civility' as const,
    name: '素质',
    unlock: '10级解锁',
    pro: '搋子盖脸，十分炫酷',
    con: '虽然保险，不能回血',
    perks: '「素质，注意你丫的素质！」',
  },
]

export function Briefing() {
  const briefingDone = useGameStore((s) => s.briefingDone)
  const beginMission = useGameStore((s) => s.beginMission)
  const reduceNausea = useGameStore((s) => s.reduceNausea)
  const setReduceNausea = useGameStore((s) => s.setReduceNausea)
  const [showDonation, setShowDonation] = useState(false)

  if (briefingDone) return null

  return (
    <div className="briefing">
      <div className="briefing-card">
        <div className="briefing-header">
          <h1>你是行侠仗义的文明侠</h1>
          <button
            type="button"
            className="donation-btn"
            onClick={() => setShowDonation(true)}
          >
            ☕ 赞助作者
          </button>
        </div>
        <p className="lede">
          吧唧嘴亵渎了公共秩序，是对人类的终极犯罪。你将在食堂维护正义，用无情铁手让每个人吃饭闭嘴！
        </p>

        <h2>执法工具（请务必读完再丢人）</h2>
        <ul className="skill-list">
          {SKILLS.map((s) => (
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
                <span className="pro">优：{s.pro}</span>
                <span className="con">劣：{s.con}</span>
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
          降低恶心音效（吧唧更闷、更礼貌）
        </label>

        <button
          type="button"
          className="briefing-go"
          onClick={() => {
            void unlockAudio()
            beginMission()
          }}
        >
          出警 · 开始制裁
        </button>
        <p className="briefing-foot">
          WASD 移动 · 空格跳跃跨人 · 拖拽转镜 · Tab 换目标 · 噪音越大掉血越狠
        </p>
        {showDonation && <DonationModal onClose={() => setShowDonation(false)} />}
      </div>
    </div>
  )
}
