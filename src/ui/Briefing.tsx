import { unlockAudio } from '../game/audio'
import { useGameStore } from '../game/store'
import { SkillIcon } from './SkillIcon'

const SKILLS = [
  {
    key: '1',
    id: 'slap' as const,
    name: '拍',
    pro: '手拍玩具抽脸，冷却短，救急首选',
    con: '沉默极短，治标不治本',
  },
  {
    key: '2',
    id: 'tape' as const,
    name: '胶条',
    pro: '伸手贴嘴，封得久，性价比体面',
    con: '要贴脸，慢半拍就白贴',
  },
  {
    key: '3',
    id: 'megaphone' as const,
    name: '吼',
    pro: '怒喝「都他妈把嘴闭上」，范围静音',
    con: '你自己也变噪音——以毒攻毒，文明蒙羞',
  },
  {
    key: '4',
    id: 'gag' as const,
    name: '塞嘴',
    pro: '道具塞入嘴里，超长安静',
    con: '冷却漫长，莫当普通拍子用',
  },
]

export function Briefing() {
  const briefingDone = useGameStore((s) => s.briefingDone)
  const beginMission = useGameStore((s) => s.beginMission)
  const reduceNausea = useGameStore((s) => s.reduceNausea)
  const setReduceNausea = useGameStore((s) => s.setReduceNausea)

  if (briefingDone) return null

  return (
    <div className="briefing">
      <div className="briefing-card">
        <p className="eyebrow">包间静音署 · 特派公文</p>
        <h1>你是行侠仗义的文明侠</h1>
        <p className="lede">
          吧唧嘴是对公共秩序的无情亵渎，是对人类的终极犯罪。你将在餐桌维护正义，用无情铁手告诉每一个人：吃饭时，把嘴闭上！
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
              </div>
              <p>
                <span className="pro">优：{s.pro}</span>
                <span className="con">劣：{s.con}</span>
              </p>
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
          WASD 移动 · 拖拽转镜 · Tab 换目标 · 噪音条变红请尽快文明起来
        </p>
      </div>
    </div>
  )
}
