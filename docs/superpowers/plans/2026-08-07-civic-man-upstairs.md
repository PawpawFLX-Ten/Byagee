# Civic Man — 楼上扩展实施计划

> **For agentic workers:** 按 superpowers:executing-plans 逐任务实施。步骤用 checkbox（`- [x]`）跟踪。

**目标:** 按 `docs/superpowers/specs/2026-08-07-civic-man-upstairs-design.md` 实现垂直方向空间事件：楼梯纯函数 + A4/C4 布局重写 + 启用调度 + 全楼层碰撞/导航接线 + 场景二楼渲染。

**架构:** 纯逻辑（spaceLayout/spaceApply）Vitest 覆盖；NPC/玩家 Y 由 `agentYAt` 纯函数驱动，XZ 移动不变；场景只读展示。

## 全局约束

- 不触碰威胁数值、门禁插件、追杀客强度、Boss 逻辑、声学数值。
- 不改已有桌型/贴图；全纯几何。
- A4/C4 只连 r0（不消耗地面侧向方向位）；availableSides 同层过滤。
- 楼梯口 opening 不渲染门、不可闩。

---

## 文件结构

```
src/game/types.ts              # +SpaceStairs axis/length/width
src/game/config.ts             # +CONFIG.space.stairWidth
src/game/spaceLayout.ts        # +stairAabb/stairYAt/agentYAt/roomIdAtY；availableSides 同层过滤
src/game/spaceApply.ts         # A4/C4 布局模板重写；seatsAroundTable 加 radius 参数
src/game/collision.ts          # wallsFromLayout 全楼层；bounds 含楼梯 AABB
src/game/npcFsm.ts             # 行走 Y=agentYAt；roomIdAtY
src/game/chaser.ts             # playerFloor 楼层感知
src/game/hideLatch.ts          # 跨层 opening 不可闩
src/game/props.ts              # 道具刷新全楼层
src/game/spaceDirector.ts      # 移除 DEFERRED_UPSTAIRS；A4/C4 weightLate=2
src/scene/World.tsx            # floor1 墙 + 楼梯阶梯几何 + Door 跳过跨层 + Player Y + Fader target Y
src/scene/GameCanvas.tsx       # camera target Y = playerPos[1]+1.1
src/scene/Npcs.tsx             # root Y = live.position[1]
src/scene/SkillFx.tsx          # 环 Y = npc.position[1]
src/game/__tests__/*           # spaceLayout/spaceApply/spaceDirector/hideLatch/npcFsm/chaser/props/quality
README.md                      # 一段
```

**执行顺序:** Task 1→6。

---

### Task 1: 楼梯纯函数 + 同层过滤 + 测试

- [x] **Step 1: types/config** — `SpaceStairs` 增 `axis: 'x' | 'z'`、`length`、`width`；`CONFIG.space.stairWidth = 1.0`。
- [x] **Step 2: 失败测试** — `spaceLayout.test.ts` 新增：
  - `stairYAt`：楼梯内按进度线性（脚 0、顶 1.5、中点 0.75），楼梯外 null；
  - `agentYAt`：楼梯内斜坡值；楼梯外吸附 `floorY(floorFromPlayerY(currentY))`；
  - `roomIdAtY`：楼层由 Y 推断；
  - `availableSides`：r0 上方挂 floor 1 房间后，地面四方向仍全部可用（异层不占用）。
- [x] **Step 3: 实现** — `stairAabb`（脚→顶沿 axis 外推 width）、`stairYAt`、`agentYAt`、`roomIdAtY`；`availableSides` 的 `taken` 过滤为与目标房间同楼层。
- [x] **Step 4: `npm test` PASS + commit**

```bash
git commit -m "feat(space): stair ramp helpers and same-floor side availability"
```

---

### Task 2: A4/C4 布局模板重写 + 测试

- [x] **Step 1: 失败测试** — `spaceApply.test.ts`：A4/C4 各断言：
  - 楼梯 AABB ⊂ `fromRoom` ∩ `toRoom` 的 XZ（脚在 r0、顶在楼上）；
  - 楼梯 AABB 与全部桌子/障碍/座位两两不相交（含 r0 既有桌：t-round/t-rect/t-oval）；
  - 楼上座位 Y = 1.5、`hopDistance(layout, 'r0', 楼上)` 有限；
  - maxNpcs +2；A4 圆桌 2 座 / C4 方桌 2 座 + 楼梯 width 0.8。
- [x] **Step 2: 实现** — 按设计稿 2.3/2.4 模板重写 `applyA4`/`applyC4`：楼梯 `axis/length/width`、桌子避让（C4 平台 x [-2.5,2.5]×z [1.5,4.9]、方桌 [0,1.5,3.0] half 0.6×0.3、座位 radius 0.85）；`seatsAroundTable` 加可选 `radius`（默认 1.35 不变）；opening 位置 = 梯脚。
- [x] **Step 3: `npm test` PASS + commit**

```bash
git commit -m "feat(space): upstairs templates for A4 nook and C4 loft"
```

---

### Task 3: 启用调度 + 测试

- [x] **Step 1: 失败测试** — `spaceDirector.test.ts`：A4/C4 进入 late 池（weightLate 2、可被抽中）；仍不在首奖池；`never picks deferred upstairs events` 用例改为「不再禁用」。
- [x] **Step 2: 实现** — `spaceDirector.ts`：删 `DEFERRED_UPSTAIRS` 与 `isLiveEvent` 过滤（或恒真）；A4/C4 `weightLate: 2`；注释更新。
- [x] **Step 3: `npm test` PASS + commit**

```bash
git commit -m "feat(space): enable A4/C4 upstairs events in late pool"
```

---

### Task 4: 楼层导航接线 + 测试

- [x] **Step 1: 失败测试** —
  - `npcFsm.test.ts`：NPC 沿楼梯行走 Y 随斜坡升降（构造含楼梯的 layout，断言 walk 后 position[1] 连续）；退出路径 `roomId` 楼层感知；
  - `chaser.test.ts`：`playerFloor` 传入时用其推房间（而非写死 0）；
  - `hideLatch.test.ts`：跨层 opening 不出现在闩门目标；
  - `props.test.ts`：楼上房间可刷出道具且 Y=1.5；
  - `collision.test.ts`：`wallsFromLayout` 对 floor 1 房间生成墙段（含门洞断墙）；`layoutBoundsFromLayout(layout, 1)` 含楼上房间。
- [x] **Step 2: 实现** —
  - `npcFsm.ts`：行走/退出/到达/空闲分离处 `position: [x, agentYAt(layout, x, z, 0), z]`（无 layout 时保持 Y=0）；`roomId` 改 `roomIdAtY`；
  - `chaser.ts`：`playerRoomId` 用 `opts.playerFloor ?? floorFromPlayerY(playerPos[1])` + `roomIdAtY`；步进 Y 过 `agentYAt`；
  - `hideLatch.ts`：`nearestLatchTarget` 跳过 from/to 异层 opening；
  - `props.ts`：采样所有楼层房间（Y = `floorY(room.floor)`），避开桌子/障碍逻辑不变；
  - `collision.ts`：`wallsFromLayout` 去掉 `floor !== 0` 跳过；`layoutBoundsFromLayout` 将楼梯 AABB 并入两层 bounds。
- [x] **Step 3: `npm test` PASS + commit**

```bash
git commit -m "feat(space): floor-aware NPC/chaser navigation, latch exclusion, full-floor walls"
```

---

### Task 5: 场景二楼渲染 + 测试无关改动

- [x] **Step 1: World.tsx** —
  - `RoomWalls` 对 floor 1 房间同样渲染四面墙（门洞断墙逻辑复用）；r0 天花板/墙画维持仅 r0；
  - 楼梯几何：沿 `axis` 的阶梯（~8 级，每级升 1.5/8）替代占位方盒（World.tsx:353），色 `#7a6a58`；
  - `Door` 跳过 from/to 异层 opening（楼梯口不渲染门）；
  - `Player` 落地态 `position.y = agentYAt(...)`（跳跃弧/躲藏覆盖逻辑保持在其后）；
  - `WallOcclusionFader` target Y = `playerPos[1] + 1.2`。
- [x] **Step 2: GameCanvas/Npcs/SkillFx** — camera target Y = `playerPos[1] + 1.1`；Npcs root Y = `live.position[1]`（Npcs.tsx:164）；SkillFx 环 Y = `npc.position[1]`（SkillFx.tsx:241）。
- [x] **Step 3: 手测冒烟** — `npm run dev`：多局触发 A4/C4（可临时调大权重验证）：走上/走下楼梯无瞬移、二楼桌/墙/门正确、NPC 上楼入座、追杀客上楼、镜头跟二楼、楼梯口无悬浮门、闩门列表无楼梯口。
- [x] **Step 4: commit**

```bash
git commit -m "feat(scene): upstairs walls, stair geometry, floor-aware camera and actor Y"
```

---

### Task 6: 收尾

- [x] **Step 1: quality.test 扩展** — 长局模拟注入 A4/C4：座位/房间/门数不变量；每 tick |ΔY| ≤ 移速×dt（无瞬移）；全部楼上座位可达（hopDistance 有限）；availableSides 不因楼上房间收缩。
- [x] **Step 2: README + 计划勾选 + `npm test && npm run lint && npm run build` PASS + commit**

```bash
git commit -m "docs: upstairs pass README and plan complete"
```

---

## 计划自审

### Spec 覆盖

| Spec 区域 | Task |
|-----------|------|
| 楼梯纯函数 / 同层过滤 | 1 |
| A4/C4 布局模板 | 2 |
| 启用调度 | 3 |
| 楼层导航接线（npcFsm/chaser/hideLatch/props/collision） | 4 |
| 场景二楼渲染 | 5 |
| QA / README | 6 |

### 占位扫描

A4/C4 现实现为完整模板（非 stub）；`DEFERRED_UPSTAIRS` 删除后无残留禁用集。

### 类型一致性

- `SpaceStairs` 加字段 → 更新 `cloneLayout`（spaceApply.ts:50）、既有测试 stub、`createInitialLayout`（空数组无碍）。
- `seatsAroundTable` 加可选参 → 既有调用不破坏。
- `roomIdAt` 保持签名不变（新增 `roomIdAtY` 封装），避免波及 store/threat 调用点。
- 跨层 opening：`wallsFromLayout` 门洞匹配按 gapTol 天然跳过（opening 不在墙上）；`Door`/`hideLatch` 显式排除。

---

## 执行交接

计划完成后，存至 `docs/superpowers/plans/2026-08-07-civic-man-upstairs.md`。
