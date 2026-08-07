# Civic Man — 楼上扩展（Upstairs）设计稿

**日期:** 2026-08-07
**状态:** 待审
**目标:** 实现垂直方向空间事件——A4「扩建：楼上小包间」与 C4「改造：阁楼平台」的楼梯、二楼渲染、楼层导航，并启用这两个长期禁用的 `DEFERRED_UPSTAIRS` 事件。

---

## 一、现状（本稿要解决的）

| # | 问题 | 位置 |
|---|------|------|
| 1 | A4/C4 逻辑已存在（floor 1 房间、stairs 数据、座位 Y=1.5），但场景无楼梯几何、无二楼墙、NPC/玩家/镜头 Y 全部写死 0/1.1 | `spaceApply.ts` / `World.tsx:315,353` / `Npcs.tsx:164` / `GameCanvas.tsx:39` |
| 2 | NPC 行走 `position: [x, 0, z]` 强制 Y=0；`roomIdAt(..., 0)` 楼层写死 | `npcFsm.ts:227,336` / `chaser.ts:300` |
| 3 | `wallsFromLayout` 只画 floor 0 房间墙（`room.floor !== 0` 跳过） | `collision.ts:156` |
| 4 | `availableSides` 用 AABB 重叠判定占用——楼上房间与 r0 的 XZ 必然重叠，会误伤地面侧向方向位 | `spaceLayout.ts:232` |
| 5 | A4/C4 桌子/座位与 r0 既有桌子 XZ 重叠（C4 平台桌与椭圆桌重叠）——碰撞是 XZ 判定，跨层桌 XZ 重叠即互相推挤 | `spaceApply.ts:383,553` |
| 6 | 事件调度硬性禁用 A4/C4 | `spaceDirector.ts:20` |
| 7 | A4/C4 的 opening 在房间内（非墙上），`Door` 组件会渲染出一扇悬浮门 | `World.tsx` Door |
| 8 | 道具刷新只采样 floor 0 房间 | `props.ts:46` |

## 二、新机制：楼梯（纯函数，可测）

### 2.1 SpaceStairs 扩展

```ts
export interface SpaceStairs {
  id: string
  /** 梯脚（低端）中心，y 恒为 0 */
  position: [number, number, number]
  fromRoom: RoomId   // 地面房间
  toRoom: RoomId     // 楼上房间
  axis: 'x' | 'z'    // 爬升轴向
  length: number     // 梯脚→梯顶全程（沿 axis）
  width: number      // 垂直方向宽度
}
```

- 爬升方向 = 沿 `axis` 从梯脚指向 `toRoom` 房间中心（投影）。
- 楼梯 AABB = `[position ± width/2（垂直轴）] × [position 沿 axis 到 position+length]`。
- **约束：楼梯 AABB 必须同时落在 `fromRoom` 与 `toRoom` 的 XZ 内**（脚在楼下、顶在楼上），且与任何桌子/障碍/座位的 XZ 不重叠（碰撞为 XZ 判定，跨层桌同样避让）。

### 2.2 纯函数（spaceLayout.ts）

```ts
export function stairAabb(layout, stairs): { min: [number, number]; max: [number, number] } | null
export function stairYAt(layout, x, z): number | null          // 在楼梯内 → 按进度线性 0→1.5
export function agentYAt(layout, x, z, currentY): number        // 楼梯内 → 斜坡；否则吸附 floorY(floorFromPlayerY(currentY))
export function roomIdAtY(layout, x, z, y): RoomId              // roomIdAt + floorFromPlayerY
```

- NPC/玩家每 tick 用 `agentYAt` 求 Y，XZ 移动逻辑完全不变（楼梯是「Y 的纯函数」，不引入新寻路）。
- `availableSides` 改为**仅同楼层房间/障碍参与占用判定**（楼上房间不再堵死地面侧向）。

### 2.3 事件表（启用后）

| ID | 名称 | 内容 | 座位 | 备注 |
|----|------|------|------|------|
| A4 | 扩建：楼上小包间 | floor 1 大房（7×7，叠于 r0 上方）+ 1 圆桌 2 座 + 东侧楼梯 | +2 | `inFirstRewardPool: false, weightLate: 2`（uncommon） |
| C4 | 改造：阁楼平台 | floor 1 平台（5×3.4，南侧）+ 1 方桌 2 座 + 西侧楼梯 | +2 | `inFirstRewardPool: false, weightLate: 2` |

- 两个事件都只连 r0（楼梯直通），不消耗地面侧向方向位。
- A4/C4 的 opening 位置 = 梯脚：**语义 = 楼梯口，渲染不画门、不可闩**（楼梯不可堵），仍参与 `hopDistance`/`latchedOnPath` 邻接（路由层面楼梯口即通道）。

### 2.4 布局模板（避让 r0 既有桌，实测校验）

r0 桌子 XZ（碰撞箱）：
- t-round：x [-3.2,-1.2] × z [-2.2,-0.2]
- t-rect：x [1.2,3.6] × z [-1.7,-0.3]
- t-oval：x [-1.4,1.8] × z [1.35,2.65]

**A4**（房间 x [-3.5,3.5] × z [-3.5,3.5]，floor 1）：
- 楼梯：axis `x`，脚 [3.1, 0, -3.0]，length 2.4，width 1.0 → 顶 [0.7, 0, -3.0]（z ∈ [-3.5,-2.5]，避开 t-rect/t-round 与 cabinet-n）
- 圆桌 [0, 1.5, 0]，2 座（radius 1.35）→ 座位 z ≤ 0.95，避开 t-oval（z ≥ 1.35）
- opening `door-{id}` @ 梯脚 [3.1, 0, -3.0]

**C4**（平台 x [-2.5,2.5] × z [1.5,4.9]，floor 1；南侧半区，椭圆桌上方净空）：
- 楼梯：axis `x`，脚 [-2.5, 0, 4.3]，length 2.4，width 0.8 → 顶 [-0.1, 0, 4.3]（z ∈ [3.9,4.7]，避开椭圆桌 z ≤ 2.65 与平台桌）
- 方桌 [0, 1.5, 3.0]（half 0.6×0.3，z ∈ [2.7,3.3]，避开椭圆桌 z ≤ 2.65）；2 座 radius 0.85 → (±0.6, 3.85)，避开楼梯 z ≥ 3.9
- `seatsAroundTable` 增加可选 `radius` 参数（默认 1.35 不变）
- opening `door-{id}` @ 梯脚 [-2.5, 0, 4.3]

> 以上坐标为**初值**：实现时以测试断言「楼梯/座位/桌子 AABB 两两不相交」为准，若有冲突按「向房间角落挪梯脚、缩小 width」的确定性规则调整。

## 三、楼层联动（逻辑接线）

| 模块 | 改动 |
|------|------|
| `npcFsm.ts` | 行走/退出/到达处 `position: [x, agentYAt(...), z]`；`roomId` 用 `roomIdAtY` |
| `chaser.ts:300` | `roomIdAt(..., 0)` → `opts.playerFloor ?? roomIdAtY(...)`；chaser 移动 Y 同样过 `agentYAt` |
| `hideLatch.ts` | `nearestLatchTarget` 排除 from/to 异层 opening（楼梯口不可闩） |
| `collision.ts` | `wallsFromLayout` 去掉 `floor !== 0` 跳过（全楼层墙，门洞逻辑复用；主门特判仅 r0）；`layoutBoundsFromLayout` 楼梯 AABB 加入两层 bounds（双端均在房间内时天然覆盖，楼梯跨墙处不新增 gap——模板保证楼梯不跨墙） |
| `props.ts` | 采样房间改为全楼层（union 所有房间），Y = `floorY(room.floor)` |
| `store.ts` | 无改动（`playerFloor`/`roomFloor` 已楼层感知）；`roomIdAt` 的 floor 参数由 `floorFromPlayerY` 传入处保持 |
| `spaceDirector.ts` | 删 `DEFERRED_UPSTAIRS`；`isLiveEvent` 恒真；A4/C4 `weightLate: 2`；注释更新 |

## 四、场景展示（只读）

| 组件 | 改动 |
|------|------|
| `World.tsx RoomWalls` | floor 1 房间同样渲染四面墙（沿用门洞断墙逻辑）；r0 天花板/墙画维持仅 r0 |
| `World.tsx Stairs` | 楼梯几何：沿 `axis` 的阶梯（每 0.3m 一级，共 ~8 级）或斜面 + 侧扶手，宽 `width`、升程 1.5，替换占位方盒；楼梯不画门 |
| `World.tsx Door` | 跳过 from/to 异层的 opening（不渲染楼梯口门模型） |
| `World.tsx Player` | 落地态 `position.y = agentYAt(...)`（跳跃弧线/躲藏覆盖其后） |
| `Npcs.tsx` | root Y = `live.position[1]`（逻辑已同步） |
| `GameCanvas.tsx` | 镜头 target Y = `playerPos[1] + 1.1`；`WallOcclusionFader` target Y 同理 |
| `SkillFx.tsx` | NPC 定位环/技能环 Y = `npc.position[1]` |

## 五、测试

- `spaceLayout.test.ts`：`stairYAt` 进度线性（0→1.5）、楼梯外 null、`agentYAt` 吸附、`roomIdAtY`；`availableSides` 忽略异层房间/障碍。
- `spaceApply.test.ts`：A4/C4——楼梯 AABB ⊂ fromRoom ∩ toRoom XZ、与全部桌子/障碍/座位不相交、座位 Y=1.5、`hopDistance(r0→楼上)` 有限、maxNpcs +2。
- `spaceDirector.test.ts`：A4/C4 出现在 late 池（weight 2）、不出现在首奖池；禁用集删除。
- `hideLatch.test.ts`：跨层 opening 不可闩。
- `npcFsm.test.ts`：走楼梯 Y 随斜坡升降、退出路径楼层感知。
- `chaser.test.ts`：playerFloor 传参生效。
- `props.test.ts`：楼上房间可刷道具且 Y 正确。
- `quality.test.ts`：长局注入 A4/C4——座位/房间/门数不变量、每 tick |ΔY| ≤ 速度×dt（无瞬移）、全部座位可达。

## 六、约束

- 不触碰威胁数值、门禁插件、追杀客强度、Boss 逻辑、声学数值（`floorFactor` 已就绪）。
- 不加新桌型/贴图；全纯几何。
- 楼梯为纯函数，不引入寻路网格；XZ 移动与碰撞逻辑不变。

## 七、超出范围（后续）

- 门 3D 动画（开门/关门过渡）。
- 事件音效/灯光的地图级变化。
- 三楼及更高；楼梯动画（NPC 踏步）。

## 八、成功标准

1. 首 Boss 后触发 A4/C4：二楼出现墙、地板、桌子、NPC 正常入座上楼。
2. 玩家走上/走下楼梯 Y 连续（无瞬移），镜头跟随二楼。
3. 楼上座位 NPC 可达、追杀客可上楼追人、威胁按楼层衰减（复用现有 floorFactor）。
4. 楼梯口不可闩、不渲染悬浮门。
5. 楼上房间不堵死 r0 地面侧向方向位。
6. 测试全过、lint/build 通过。
