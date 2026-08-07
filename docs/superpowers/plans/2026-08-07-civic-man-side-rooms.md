# Civic Man �?随机开门连新房实施计划

> **For agentic workers:** �?superpowers:executing-plans 逐任务实施。步骤用 checkbox（`- [x]`）跟踪�?
**目标:** �?`docs/superpowers/specs/2026-08-07-civic-man-side-rooms-design.md` 实现随机方向开门连新房：逻辑（方�?门纯函数 + A/C 模板化）+ 场景（全房间墙、门洞、openings 门渲染）�?
**架构:** 纯逻辑（spaceLayout/spaceApply）Vitest 覆盖；场景只读展示；调度/权重/禁用集不动�?
## 全局约束

- 不触碰威�?门禁/声学/追杀�?Boss 逻辑；不改桌型贴图�?- A4/C4 保持禁用；A 类内容模板保留（只改方向）�?- 方向选择、门位置为纯函数�?
---

## 文件结构

```
src/game/spaceLayout.ts       # +RoomSide、sideAabb、availableSides、addRoomConnectedAt、橱柜移�?src/game/spaceApply.ts        # A1/A2/A3/A5 方向化；C1/C2/C3/C5/C6 新房版重写；降级兜底
src/game/spaceDirector.ts     # 注释更新（池/权重不变�?src/game/config.ts            # +CONFIG.space.roomGap
src/game/types.ts             # +RoomSide
src/scene/World.tsx           # Room 全房间墙 + 门洞；Door �?openings + 朝向
src/game/i18n.ts              # C 类文�?×3 语更�?src/game/__tests__/spaceLayout.test.ts  # 扩展
src/game/__tests__/spaceApply.test.ts   # 扩展/重写
src/game/__tests__/spaceDirector.test.ts # 断言禁用集不�?src/game/__tests__/quality.test.ts       # 随机方向长局模拟
README.md                     # 一�?```

**执行顺序:** Task 1�?�?
---

### Task 1: 方向/门纯函数 + 测试

- [x] **Step 1: types/config** �?`RoomSide` 联合；`CONFIG.space.roomGap = 1`�?
- [x] **Step 2: 失败测试** �?`spaceLayout.test.ts` 新增：`sideAabb` 四方向外推（�?x∈[max+gap, max+gap+w]、北 z∈[min-gap-d, min-gap] 等）；`availableSides` 无占用时 4 方向、占用一侧被排除（AABB 重叠 + 障碍重叠 + 橱柜重叠）；`addRoomConnectedAt` 门在共享墙段中点（四方向各断言坐标）；门与橱柜重叠时该橱柜被移除�?
- [x] **Step 3: 实现** �?`sideAabb(room, side, w, d)`、`availableSides(layout, roomId)`、`addRoomConnectedAt(layout, room, openingId, fromRoomId, side)`（门位置按方�?+ 橱柜移除）；`pickConnection(layout, rng)`（优�?r0，逐房间找可用侧，全无 �?null）�?
- [x] **Step 4: `npm test` PASS + commit**

```bash
git commit -m "feat(space): side-relative AABB, available sides, directional door math"
```

---

### Task 2: A 类方向化（A1/A2/A3/A5�?
- [x] **Step 1: 失败测试** �?`spaceApply.test.ts`：四方向分别应用 A1/A3/A5 �?房间不重叠、门在共享墙、内容正确（A1 1 �?4 座、A3 2 �?8 座、A5 2 �?6 �?+ 吧台）；A2 走廊方向�?�?走廊 + 端房 + 2 门（走廊门与端房门位置分属不同共享墙）；无可用方向（塞满 4 面）�?A 类降级微调不抛错�?
- [x] **Step 2: 实现** �?`applyA1/A2/A3/A5` 改为：`pickConnection` 取侧 �?`sideAabb` 生成房间坐标 �?`addRoomConnectedAt`；A2 走廊用同方向短走�?+ 端房；吧�?障碍坐标随房间相对化�?
- [x] **Step 3: `npm test` PASS + commit**

```bash
git commit -m "feat(space): random-side expansions for A1/A2/A3/A5"
```

---

### Task 3: C 类新房版重写（C1/C2/C3/C5/C6�?
- [x] **Step 1: 失败测试** �?C1 小雅间（4×3�? �?2 座）；C2 幽静隔间�?×3，无桌，0 座）；C3 立柱包间�?×4�? 立柱 + 1 �?2 座）；C5 壁橱间（2.5×2.5，无桌）；C6 屏风房（5×4�? 屏风 + 1 �?2 座）；全部不再改 r0 AABB；C 类四方向同样可用�?
- [x] **Step 2: 实现** �?删除 `expandRoomAabb/shrinkRoomAabb/applyC1(原地)/applyC2(原地)` 原地版本；重写为房间模板 + `pickConnection` + `addRoomConnectedAt`�?
- [x] **Step 3: 兜底** �?`pickConnection` 返回 null 时事件降级：沿用�?C5 挪障碍逻辑（不新增房间），toast 照常�?
- [x] **Step 4: `npm test` PASS + commit**

```bash
git commit -m "feat(space): rewrite C-class events as interior-flavored side rooms"
```

---

### Task 4: 场景 �?全房间墙 + 门洞 + openings �?
- [x] **Step 1: Room 全房间墙** �?`World.tsx` Room 改为对每个房间渲�?4 面墙（颜色沿�?r0 现有样式）；每面墙若共享边存�?opening，拆两段留门洞（洞宽 ~1.4m，对应门模型宽度）。r0 墙画/天花�?氛围�?r0�?
- [x] **Step 2: Door �?openings** �?渲染 `layout.openings` 每扇门（east/west 旋转 90°，north/south 不旋转），沿用门�?门板/对联模型；保留主厅北门（主门）写死渲染�?
- [x] **Step 3: 手测冒烟** �?`npm run dev`：多次空间事件，四面各出现过新房；墙/门洞/门朝向正确；橱柜被门取代后消失；无遮挡寻路异常�?
- [x] **Step 4: commit**

```bash
git commit -m "feat(scene): room walls with door gaps and openings-driven doors"
```

---

### Task 5: 收尾

- [x] **Step 1: i18n** �?C 类文�?×3 语（小雅�?幽静隔间/立柱包间/壁橱�?屏风房），A 类文案不动�?
- [x] **Step 2: quality.test 扩展** �?长局模拟注入随机侧事件：房间数、门数、座位数不变量；无方向时降级不抛错�?
- [x] **Step 3: README + 计划勾�?+ `npm test && npm run lint && npm run build` PASS + commit**

```bash
git commit -m "docs: side rooms pass README and plan complete"
```

---

## 计划自审

### Spec 覆盖

| Spec 区域 | Task |
|-----------|------|
| sideAabb / availableSides / addRoomConnectedAt / pickConnection | 1 |
| A 类方向化 | 2 |
| C 类新房版 + 降级兜底 | 3 |
| 场景�?门洞/Door 渲染 | 4 |
| i18n / QA / README | 5 |

### 占位扫描

�?TBD；A4/C4 维持既有禁用（非 stub，spec 明确）�?
### 类型一致�?
- `SpaceOpening` 不变；`RoomSide` 新增�?spaceLayout/spaceApply 内部使用�?- `Door` 组件从写死位置改�?openings 驱动 �?主门需特殊处理（保留写死渲染）�?- C2 原地缩小删除 �?检�?`invalidSeatIndices/seatIndexRemap` 是否仍有消费者（store �?applySpaceEvent 返回字段兼容，无消费者则从结果类型移除）�?
---

## 执行交接

计划完成后，存至 `docs/superpowers/plans/2026-08-07-civic-man-side-rooms.md`�?