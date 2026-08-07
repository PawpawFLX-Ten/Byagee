# Civic Man — 内容扩充实施计划

> **For agentic workers:** 按 superpowers:executing-plans 逐任务实施。步骤用 checkbox（`- [ ]`）跟踪。

**目标:** 按 `docs/superpowers/specs/2026-08-07-civic-man-content-design.md` 实现 Boss 狂暴脉冲与 A5/C6 空间事件。

**架构:** 纯逻辑（bossModules.ts / spaceApply.ts / spaceDirector.ts）Vitest 覆盖；store 接线打断钩子；场景只读展示。

## 全局约束

- 脉冲不改伤害数值；A5/C6 不加新桌型与贴图。

---

## 文件结构

```
src/game/types.ts              # +NpcState 脉冲三字段 + SpaceEventId 'A5'|'C6' + BossConfig 旋钮
src/game/config.ts             # +CONFIG.boss.pulse*
src/game/bossModules.ts        # tickBossRage 状态机 + interruptBossPulse + 降级清字段
src/game/store.ts              # 技能结算后调 interruptBossPulse
src/game/spaceDirector.ts      # EVENTS += A5/C6
src/game/spaceApply.ts         # applyA5 / applyC6 + switch
src/game/i18n.ts               # spaceEvent_A5/C6 ×3
src/scene/Npcs.tsx             # 蓄力环（Billboard）
src/scene/GameCanvas.tsx       # 脉冲镜头微震
src/game/__tests__/bossModules.test.ts   # 扩展
src/game/__tests__/spaceApply.test.ts    # 扩展
src/game/__tests__/spaceDirector.test.ts # 扩展
README.md                      # 一行
```

**执行顺序:** Task 1→4。

---

### Task 1: Boss 脉冲逻辑 + 测试

- [ ] **Step 1: types/config** — NpcState 三字段；`CONFIG.boss.pulse*` 按 spec。

- [ ] **Step 2: 失败测试** — 状态机：冷却结束进入蓄力、蓄力到期释放（催化一次）、释放后冷却；打断：蓄力中命中→charge 清空 + cooldown=now+4s；非蓄力打断无效；降级/杀清字段。

- [ ] **Step 3: tickBossRage 重写** — 催化仅在释放 tick 执行一次；新增 `interruptBossPulse(boss, now)`。

- [ ] **Step 4: store 接线** — 技能结算 ok 后，对命中 Boss 调 `interruptBossPulse`。

- [ ] **Step 5: `npm test` PASS + commit**

```bash
git commit -m "feat(boss): rage pulse state machine with interrupt window"
```

---

### Task 2: 脉冲场景展示

- [ ] **Step 1: Npcs.tsx 蓄力环** — `pulseChargeUntil > now` 时金色 ring 由小变大（useFrame 读 live）。

- [ ] **Step 2: GameCanvas 微震** — `pulseFiredAt` 距今 <500ms 镜头微震。

- [ ] **Step 3: 手测冒烟 + commit**

```bash
git commit -m "feat(scene): boss pulse charge ring and impact shake"
```

---

### Task 3: A5/C6 空间事件

- [ ] **Step 1: types** — `SpaceEventId += 'A5'|'C6'`；`EVENTS` 表 += 两行（late pool, weightLate 2）。

- [ ] **Step 2: 失败测试** — A5：新房间+门、圆桌 4 座 + 吧台桌 2 座、1 障碍、maxNpcs 增 6；C6：3 障碍、座位与 maxNpcs 不变；spaceDirector：A5/C6 不在首奖池、late 池可出。

- [ ] **Step 3: applyA5/applyC6** — 复用 `addRoomConnected`/`appendTableBundle`/obstacles 模式；switch 接入。

- [ ] **Step 4: i18n** — `spaceEvent_A5`「餐吧角」/`spaceEvent_C6`「屏风阵」×3 语。

- [ ] **Step 5: `npm test` PASS + commit**

```bash
git commit -m "feat(space): bar corner A5 and screen array C6 events"
```

---

### Task 4: 收尾

- [ ] **Step 1: quality.test 扩展** — 长局模拟含 A5/C6 注入 + 狂暴脉冲存在时的不变量。

- [ ] **Step 2: README + 计划勾选 + `npm test && lint && build` + commit**

```bash
git commit -m "docs: content pass README and plan complete"
```

---

## 计划自审

### Spec 覆盖

| Spec 区域 | Task |
|-----------|------|
| 脉冲状态机/打断/降级 | 1 |
| 脉冲视觉 | 2 |
| A5/C6 布局与注册 | 3 |
| i18n/README/QA | 3, 4 |

### 占位扫描

无 TBD；A5/C6 全实现（非 stub）。

### 类型一致性

- NpcState 三字段必填 → 更新 4 个创建点与测试 stub（参照 archetype 流程）。
- SpaceEventId 联合扩展 → spaceApply switch、EVENTS、i18n、forceSpaceEvent 测试辅助同步。

---

## 执行交接

计划完成，存至 `docs/superpowers/plans/2026-08-07-civic-man-content.md`。
