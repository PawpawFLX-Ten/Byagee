# Civic Man — 成就与分数实施计划

> **For agentic workers:** 按 superpowers:executing-plans 逐任务实施。步骤用 checkbox（`- [ ]`）跟踪。

**目标:** 按 `docs/superpowers/specs/2026-08-07-civic-man-achievements-design.md` 实现计分、成就解锁、持久化与 UI。

**架构:** 纯模块 `achievements.ts`（计分/成就表/存储读写）Vitest 覆盖；store 注入 4 个计数点 + 每 tick 检查 + 死亡结算；HUD/死亡画面/i18n 只读展示。

## 全局约束

- 成就不给玩法加成；不占用现有 toast 槽。
- localStorage 读写全部 try/catch。
- 计数器全在 store 逻辑层。

---

## 文件结构

```
src/game/achievements.ts              # NEW — 类型 + 成就表 + computeScore + checkAchievements + 持久化
src/game/types.ts                     # +RunStats/AchievementId/BestRecord（成就表常量不进 CONFIG）
src/game/store.ts                     # stats/queue/best 字段 + 计数注入 + tick 检查 + 死亡结算 + restart 重置
src/ui/Hud.tsx                        # 成就 toast 队列 + HUD score + 死亡结算明细
src/ui/Briefing.tsx                   # 最佳记录一行（若有）
src/game/i18n.ts                      # 分数标签 + 10 成就名/描述 ×3 语
src/game/__tests__/achievements.test.ts  # NEW
src/game/__tests__/quality.test.ts       # 扩展 stats 增长/最佳保存
src/index.css                         # .achievement-toast 样式
README.md                             # Round 9 或新段落
```

**执行顺序:** Task 1→3。

---

### Task 1: 纯模块 + 测试

- [ ] **Step 1: types** — RunStats / AchievementId / BestRecord；ACHIEVEMENTS 表（条件闭包）在 `achievements.ts` 内。

- [ ] **Step 2: 失败测试** — 计分系数、成就条件边界（299s vs 300s、chaserKnockbacks=0 不弹等）、重复解锁只返回新、localStorage stub 读写（stub 抛错时静默）。

- [ ] **Step 3: 实现** — `computeScore({ elapsedSec, stats, bossesCleared })`；`checkAchievements(ctx, unlocked)`；`loadBestRecord/saveBestRecord/loadUnlockedAchievements/saveUnlockedAchievements`。

- [ ] **Step 4: `npm test` PASS + commit**

```bash
git commit -m "feat(score): achievement table, scoring, persistence"
```

---

### Task 2: store 接线

- [ ] **Step 1: 状态** — `stats`、`unlockedThisRun`、`achievementQueue`、`best`、`isNewBest`、`lastScore`；beginMission/restart 重置（best 与跨局成就保留）。

- [ ] **Step 2: 计数注入** — 蓄力结算 `skillHits += hitIds.length`；结算对比 chaser `staggerUntil` 抬高计数；道具拾取 +1；空间事件生效 +1。

- [ ] **Step 3: tick 检查** — 每 tick `checkAchievements` 去重入队（含 bossesCleared 同步）。

- [ ] **Step 4: 死亡结算** — `lastScore = computeScore(...)`；破纪录则 `saveBestRecord` + `isNewBest = true`。

- [ ] **Step 5: 测试扩展** — quality.test 断言 stats 增长、死亡后 best 持久化。

- [ ] **Step 6: `npm test` PASS + commit**

```bash
git commit -m "feat(score): store wiring for stats, achievements, best record"
```

---

### Task 3: UI + i18n + README

- [ ] **Step 1: i18n** — 分数标签（score/survival/hits/bosses/events/props/chasers/best/new record）+ `ach_<id>` 名与 `ach_<id>_desc` ×3 语。

- [ ] **Step 2: HUD 成就 toast** — 队首展示 2.5s 后 shift；样式 `.achievement-toast`（金色）。HUD meta 加实时 score。

- [ ] **Step 3: 死亡画面** — 分数明细 + 新纪录徽章 + 本次解锁成就列表 + 最佳记录。

- [ ] **Step 4: Briefing 最佳记录行**（若有）。

- [ ] **Step 5: README 段落 + 勾选计划 + `npm test && lint && build` + commit**

```bash
git commit -m "feat(ui): score summary, achievement toasts, best record"
```

---

## 计划自审

### Spec 覆盖

| Spec 区域 | Task |
|-----------|------|
| 计分公式 | 1 |
| 成就表与边界 | 1 |
| 持久化 | 1 |
| store 计数/结算/重置 | 2 |
| toast/HUD/死亡/开屏 | 3 |
| i18n/README | 3 |

### 占位扫描

无 TBD；10 个成就全部实现。

### 类型一致性

- `RunStats` 由 store 持有并传给纯函数；`best` 死亡时保存、beginMission 时加载。
- 成就表条件闭包签名固定 `(ctx) => boolean`，与测试共用同一类型。

---

## 执行交接

计划完成，存至 `docs/superpowers/plans/2026-08-07-civic-man-achievements.md`。
