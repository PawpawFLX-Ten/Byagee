# Civic Man — NPC 剪影 Archetype 实施计划

> **For agentic workers:** 按 superpowers:executing-plans 逐任务实施。步骤用 checkbox（`- [x]`）跟踪。

**目标:** 按 `docs/superpowers/specs/2026-08-07-civic-man-archetypes-design.md` 给食客加几何剪影（头饰+体型）。

**架构:** 纯逻辑模块 `archetype.ts`（权重表 + pick 函数）Vitest 覆盖；三个生成点（`npcFsm.createNpcs` / `doorSystem.createNormalFromDoor` / `bossModules.createBossNpc` / `chaser.createChaser`）填字段；`Npcs.tsx` 加 `DinerSilhouette` 渲染。无新贴图、无玩法影响。

## 全局约束

- 纯 primitives；头饰不遮挡咀嚼区/名牌/Outline。
- archetype/build 为静态字段，生成时一次性分配。
- 不改 threat/skill/door/chase 逻辑。

---

## 文件结构

```
src/game/archetype.ts            # NEW — 类型 + 权重表 + pickArchetype/pickBuild
src/game/types.ts                # +NpcArchetype/NpcBuild 类型 + NpcState 字段 + DinerConfig
src/game/config.ts               # +CONFIG.diner 权重
src/game/npcFsm.ts               # createNpcs 分配
src/game/doorSystem.ts           # createNormalFromDoor 分配
src/game/bossModules.ts          # createBossNpc 固定 tophat/stout
src/game/chaser.ts               # createChaser 固定 none/slim
src/scene/Npcs.tsx               # +DinerSilhouette 渲染 + 体型
src/game/__tests__/archetype.test.ts   # NEW
src/game/__tests__/npcFsm.test.ts      # 扩展
src/game/__tests__/chaser.test.ts      # 扩展
src/game/__tests__/bossModules.test.ts # 扩展
src/game/__tests__/doorSystem.test.ts  # 扩展
```

**执行顺序:** Task 1→2，各自可测。

---

### Task 1: 类型 + 权重 + 生成点

**文件:** `archetype.ts`(NEW) / `types.ts` / `config.ts` / `npcFsm.ts` / `doorSystem.ts` / `bossModules.ts` / `chaser.ts` + 4 个测试文件

- [x] **Step 1: 类型与 CONFIG**

`types.ts`:

```ts
export type NpcArchetype = 'none' | 'tophat' | 'bowler' | 'chef' | 'cap' | 'bun'
export type NpcBuild = 'slim' | 'normal' | 'stout'
// NpcState +=
archetype: NpcArchetype
build: NpcBuild
// DinerConfig +=
archetypeWeights: Record<NpcArchetype, number>
buildWeights: Record<NpcBuild, number>
```

`config.ts`: `diner: { archetypeWeights: { tophat: 20, bowler: 15, chef: 15, cap: 25, bun: 15, none: 10 }, buildWeights: { slim: 25, normal: 50, stout: 25 } }`

- [x] **Step 2: 失败测试** — `archetype.test.ts`：pick 只出合法值、权重和=100、种子确定性；`createNpcs` 全量带字段；`createChaser` = none/slim；`createBossNpc` = tophat/stout；`createNormalFromDoor` 带字段。

- [x] **Step 3: `archetype.ts` 实现** — 加权随机（单次 rng * 累计权重），导出 `pickArchetype(rng)` / `pickBuild(rng)` / `BossArchetype` / `ChaserBuild` 常量。

- [x] **Step 4: 接入四个生成点**。

- [x] **Step 5: `npm test` PASS + commit**

```bash
git commit -m "feat(diner): silhouette archetype data and spawn assignment"
```

---

### Task 2: 场景渲染 DinerSilhouette

**文件:** `Npcs.tsx`

- [x] **Step 1: `DinerSilhouette` 组件** — 按 archetype 渲染头饰（tophat/bowler/chef/cap/bun），挂 head group 上方；按 build 调整躯干宽度 + stout 腹部球。`castShadow`。

- [x] **Step 2: 接线** — NpcMesh 内 `archetype`/`build` 读取，头饰 `scale` 跟随根组 scale（Boss 1.4× 自动放大，接受）。

- [x] **Step 3: 可读性自查** — 头饰最大 y 不超过名牌高度；不挡嘴部。

- [x] **Step 4: 手动冒烟**（桌面 dev 即可）— 开局食客带帽率 ~90%，Boss 礼帽壮实，追杀客无帽瘦高。

- [x] **Step 5: `npm test && npm run lint && npm run build` PASS + commit**

```bash
git commit -m "feat(scene): render silhouette hats and builds on diners"
```

---

## 计划自审

### Spec 覆盖

| Spec 区域 | Task |
|-----------|------|
| 数据/权重/角色分配 | 1 |
| 渲染头饰与体型 | 2 |
| 约束（可读性、纯几何） | 1, 2 |
| 测试 | 1, 2 |

### 占位扫描

无 TBD/TODO；六种头饰全部实现（非 stub）。

### 类型一致性

- `NpcState` 两处新字段必填 → 所有创建点（4 个）与测试 stub 需补齐（`types.ts` 增量，测试用 spread 现有 stub 的则安全）。
- `NpcState` 全字段必填，需检查测试内手工构造的 `NpcState` 字面量（threat.test / skills.test / doorSystem.test / props.test / bossModules.test 等）是否需补字段。

---

## 执行交接

计划完成，存至 `docs/superpowers/plans/2026-08-07-civic-man-archetypes.md`。
