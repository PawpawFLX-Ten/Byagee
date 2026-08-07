# Civic Man — NPC 剪影 Archetype 设计稿

**日期:** 2026-08-07  
**状态:** 待审  
**目标:** 给食客加几何剪影个性（头饰 + 体型），纯 primitives 无贴图，不影响玩法逻辑，提升画面辨识度与「包间众生相」。

---

## One-liner

食客随机戴帽子（礼帽/圆顶帽/厨师帽/鸭舌帽/丸子头）并分瘦/常/胖三种体型；Boss 固定礼帽+壮实，追杀客保持瘦高无帽；全部纯几何，无新贴图、无玩法影响。

---

## 关系（对现有构建）

| 保留 | 新增 |
|------|------|
| NpcState 现有字段与 FSM | `archetype`（头饰）、`build`（体型）两个静态字段 |
| 角色系统（normal/boss/chaser） | 按角色分配剪影：normal 随机、boss/chaser 固定 |
| 现有 chew/密封/seal 动画 | 头饰挂在 head group 下跟随咀嚼点头 |
| 目标 Outline / 名牌可读性 | 头饰小体积、颜色不抢阅读 |

---

## 数据

```ts
export type NpcArchetype = 'none' | 'tophat' | 'bowler' | 'chef' | 'cap' | 'bun'
export type NpcBuild = 'slim' | 'normal' | 'stout'
```

权重（CONFIG.diner 可调）：

| archetype | 权重 | 说明 |
|-----------|------|------|
| tophat | 20 | 黑礼帽（圆柱+帽檐） |
| bowler | 15 | 深棕圆顶帽（半球+帽檐） |
| chef | 15 | 白厨师帽（两层短圆柱） |
| cap | 25 | 彩色鸭舌帽（半球+鸭舌） |
| bun | 15 | 深色丸子头（脑后小球） |
| none | 10 | 无帽 |

| build | 权重 | 视觉 |
|-------|------|------|
| slim | 25 | 躯干宽 ×0.85 |
| normal | 50 | 现状 |
| stout | 25 | 躯干宽 ×1.15 + 前腹球 |

## 角色分配

| 角色 | archetype | build |
|------|-----------|-------|
| normal（开局 + 门禁生成） | 按权重随机 | 按权重随机 |
| boss（含被降级后） | `tophat` 固定 | `stout` 固定 |
| chaser | `none` 固定 | `slim` 固定（保持瘦高火热剪影） |

降级 Boss 保留礼帽+壮实 → 前 Boss 可辨识，接受。

## 渲染（Npcs.tsx）

新增 `DinerSilhouette` 小组件挂入每个 NpcMesh 的 head group 下（`HEAD_Y` 上方）：

- tophat：`cylinder(r=0.11, h=0.22)` 顶在 `y≈0.34` + 帽檐 `cylinder(r=0.2, h=0.03)`；黑色 `#1a1a1a`
- bowler：`sphere(r=0.14, φ 上半)` 深棕 `#4a3322` + 帽檐
- chef：两段短圆柱（`0.13/0.11` 高 0.1）纯白 `#f5f5f0`，错位堆叠
- cap：`sphere(r=0.14, 上半)` 用身体色系（seatIndex 色） + 前伸鸭舌 `box(0.2, 0.02, 0.14)`
- bun：`sphere(r=0.09)` 深色 `#2a2118`，置于头后上侧 `(0, 0.16, -0.2)` 偏移随 facing 转（挂 head 下自动跟随）
- 无帽：不渲染

体型（torso 现有 capsule）：
- slim：`torsoWidth * 0.85`
- stout：`torsoWidth * 1.15` + 腹部 `sphere(r=0.13)` 置于躯干前下 `(0, 0.28, 0.16)` 用 bodyColor

## 约束

- 纯 primitives，无贴图无材质贴图。
- 头饰不遮挡嘴部咀嚼区与名牌（名牌在 1.85 高度，头饰在 ~1.6 以下）。
- 无玩法影响：不碰 threat / skill / door / chase。
- 静态字段：生成时一次性分配，不随时间变（降级 Boss 除外，但其字段不变）。

## 测试

- `archetype.test.ts`：pickArchetype/pickBuild 只产出合法值；权重和=100；种子随机确定性。
- `npcFsm.test.ts` 扩展：createNpcs 全量带 archetype/build 字段。
- `chaser.test.ts`：createChaser 固定 none+slim。
- `bossModules.test.ts`：createBossNpc 固定 tophat+stout；降级后字段保留。
- `doorSystem.test.ts`：createNormalFromDoor 带随机剪影。

## 超出范围

- 剪影不提供游戏机制（无属性加成、无职业差异）。
- 不加新头饰种类（后续可扩权重表）。
- 不做 .pen 设计稿先行（纯几何，直接在场景中调整）。

## 成功标准

1. 开局与门禁生成食客 90% 有可见头饰，身形有胖瘦差异。
2. Boss 一眼可辨（礼帽+壮实），追杀客剪影保持原样。
3. 咀嚼/密封动画不受影响，名牌与目标 Outline 仍可读。
4. 全部单元测试通过，lint/build 通过。
