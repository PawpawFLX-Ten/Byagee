# Civic Man — 成就与分数（Score & Achievements）设计稿

**日期:** 2026-08-07  
**状态:** 待审  
**目标:** 局内行为计分 + 跨局成就解锁（localStorage 持久化），在死亡结算与 HUD toast 呈现，增强留存与目标感。

---

## One-liner

每次死亡按生存时间与行为算分，突破最佳记录有提示；10 个成就跨局解锁（首杀 Boss、杀 5 Boss、存活 5/10/20 分钟、击退追杀客、首空间事件、拾 10 道具、百次技能命中、满级），解锁瞬间 HUD 弹出成就 toast。

---

## 关系（对现有构建）

| 保留 | 新增 |
|------|------|
| `bossesCleared`（store 既有） | `stats` 运行统计对象 + `achievements` 本次解锁 + 最佳记录 |
| toast 单槽（技能/道具/Boss 提示） | 独立成就 toast 队列（不抢占现有 toast 槽） |
| 死亡画面（时长/称号） | 分数明细 + 最佳记录徽章 + 本次新成就列表 |
| i18n 扁平字典三语 | 分数标签 + 10 成就名/描述 key |
| localStorage（i18n 模式） | 成就集合 + 最佳记录持久化（同 try/catch 保护） |

## 数据

```ts
export interface RunStats {
  skillHits: number
  propsPicked: number
  spaceEvents: number
  chaserKnockbacks: number
}

export type AchievementId =
  | 'first_boss' | 'boss_slayer'
  | 'survivor_5' | 'survivor_10' | 'survivor_20'
  | 'chaser_slapper' | 'quiet_room' | 'prop_hoarder' | 'slap_artist' | 'max_level'

export interface BestRecord {
  score: number
  survivalSec: number
  bossesCleared: number
}
```

store 新增：`stats`、`unlockedThisRun: AchievementId[]`（供死亡画面）、`achievementQueue: AchievementId[]`（toast）、`best: BestRecord | null`、`isNewBest: boolean`、`lastScore: number`。

## 计分（computeScore，纯函数）

```
score = floor(elapsedSec)          × 1
      + skillHits                   × 10
      + bossesCleared               × 250
      + spaceEvents                 × 100
      + propsPicked                 × 50
      + chaserKnockbacks            × 75
```

死亡结算：`score > best.score` → 更新 best 并标 `isNewBest`。

## 成就表（checkAchievements 纯函数）

| id | 条件 |
|----|------|
| first_boss | bossesCleared ≥ 1 |
| boss_slayer | bossesCleared ≥ 5 |
| survivor_5 / 10 / 20 | elapsedSec ≥ 300 / 600 / 1200 |
| chaser_slapper | chaserKnockbacks ≥ 1 |
| quiet_room | spaceEvents ≥ 1 |
| prop_hoarder | propsPicked ≥ 10 |
| slap_artist | skillHits ≥ 100 |
| max_level | level ≥ MAX_LEVEL |

每个 tick 末尾跑一次 `checkAchievements(ctx, unlockedSet)`；新解锁入队（去重，已解锁的永不重复弹）。

## 统计来源（store 注入点）

| 统计 | 注入点 |
|------|--------|
| skillHits | 蓄力结算 `result.ok` 时 `+ result.hitIds.length` |
| chaserKnockbacks | 结算后对比 chaser 的 `staggerUntil` 是否被抬高（击退=打断） |
| propsPicked | 道具拾取分支 `+1` |
| spaceEvents | 空间事件落地（queuedSpaceEventId 生效）`+1` |
| bossesCleared | 沿用现有字段（空间钩子处同步） |

## 持久化

- `localStorage['civicman.achievements']` — `AchievementId[]`
- `localStorage['civicman.best']` — `BestRecord`
- 读写全部 try/catch（私有模式/SSR 安全），失败静默降级为内存态。

## UI

- **成就 toast**：`achievementQueue` 队首显示 2.5s（金色标题 + 描述），逐条 shift；样式独立 `.achievement-toast`，不挤占现有 toast。
- **HUD 顶部 meta**：追加 `score` 显示（当前局分数，实时）。
- **死亡画面**：分数大字 + 明细行（存活/命中/Boss/事件/道具/击退）+「新纪录！」徽章（isNewBest）+ 本次解锁成就列表 + 最佳记录行。
- **开屏**：若有最佳记录，显示一行 `最佳纪录 X`。

## 约束

- 成就纯视觉/记录性质，不提供玩法加成（不加属性、不跳关）。
- 不触碰现有 toast 槽位逻辑。
- 计数全部在 store 逻辑层（可测），HUD 只读展示。

## 测试

- `achievements.test.ts`：computeScore 各项系数；checkAchievements 只返回新解锁、重复不弹、各项条件边界（299s 不触发/300s 触发等）；localStorage 存取（vi.stubGlobal stub）。
- `quality.test.ts` 扩展：长时间模拟后 stats 正确增长、死亡后 best 保存。

## 超出范围

- 成就面板（列表页）——本局先做 toast + 死亡结算展示。
- 分享卡片/排行榜。
- 存档续局（roguelite meta）——纯纪录性质。

## 成功标准

1. 死亡画面显示分数明细与最佳记录；破纪录有明确反馈。
2. 10 个成就跨局解锁，解锁瞬间有 toast，不重复弹。
3. 计分/解锁全部纯函数可测；174+ 测试全过、lint/build 通过。
