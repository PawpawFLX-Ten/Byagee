# Civic Man — 房间声学混响实施计划

> **For agentic workers:** 按 superpowers:executing-plans 逐任务实施。步骤用 checkbox（`- [x]`）跟踪。

**目标:** 按 `docs/superpowers/specs/2026-08-07-civic-man-room-audio-design.md` 接入房间门音频缩放与程序化残响。

**架构:** `audio.ts` 保持 DOM 惰性加载（vitest 可安全 import 纯函数）；门数学复用已测 `acoustics.ts`；AudioDirector 20Hz 轮询构造 ctx；`syncChews` 接受 `gateFor` 与 `reverbAmount` 可选参数。

## 全局约束

- 无音频资源；IR 程序化生成一次。
- 不触碰威胁数值与 CONFIG.roomReverb。
- 追脸 chaser gate=1。

---

## 文件结构

```
src/game/audio.ts                  # syncChews 扩展 + 残响总线 + reverbAmountForArea
src/game/config.ts                 # +CONFIG.audio
src/game/types.ts                  # +AudioConfig
src/scene/AudioDirector.tsx        # 构造 acoustics ctx 传入 syncChews
src/game/__tests__/audio.test.ts   # NEW — reverbAmountForArea 纯函数
```

**执行顺序:** Task 1→2。

---

### Task 1: CONFIG + 纯函数 + 测试

- [x] **Step 1: types/config** — `AudioConfig { reverbWetMax, reverbAreaAtMax, reverbSlope, reverbMin }`，`CONFIG.audio` 按 spec 数值。

- [x] **Step 2: 失败测试** — `audio.test.ts`：单调递减；clamp 上下限；主厅 100m² → reverbMin；16m² → reverbWetMax；30m² ≈ 0.267。

- [x] **Step 3: `reverbAmountForArea(area)` 实现**（audio.ts 顶部纯函数）。

- [x] **Step 4: `npm test` PASS + commit**

```bash
git commit -m "feat(audio): room reverb amount from room area"
```

---

### Task 2: syncChews 门缩放 + 残响总线 + AudioDirector ctx

- [x] **Step 1: 残响总线** — `ac()` 内建 IR（1.2s 指数衰减噪声，buildImpulse）+ `chewBus → convolver → reverbGain → master`；`setChewReverb(amount)` 线性 ramp。

- [x] **Step 2: syncChews 扩展** — 可选 `opts: { gateFor?: (id: string) => number; reverbAmount?: number }`；per-source 音量 ×(0.55+0.45×gate)、cutoff ×(0.75+0.25×gate)；末尾 `setChewReverb(reverbAmount ?? 0)`。

- [x] **Step 3: AudioDirector ctx** — 20Hz 轮询内：playerRoom/floor、npcRoom/floor、`hopDistance`、`latchedOnPath`；`gateFor = id ⇒ roomGate × openingFactor × floorFactor`（chaser 追脸 → 1）；`reverbAmount = reverbAmountForArea(playerRoomArea)`；无源/死亡 → 0。

- [x] **Step 4: `npm test && npm run lint && npm run build` PASS + commit**

```bash
git commit -m "feat(audio): room-gated chew mix and procedural reverb"
```

---

## 计划自审

### Spec 覆盖

| Spec 区域 | Task |
|-----------|------|
| 门→听感映射（gain/cutoff） | 2 |
| 残响总线 + 面积映射 | 1, 2 |
| 追脸 chaser gate=1 | 2 |
| CONFIG.audio | 1 |

### 占位扫描

无 TBD；IR 一次性生成，无 stub。

### 类型一致性

- `syncChews` 签名扩展为可选参数 → 现有调用（AudioDirector）不破坏。
- AudioDirector 需在轮询内读取 `s.playerRoomId`、`s.layout`、`npc.roomId`（均已存在于 store）。

---

## 执行交接

计划完成，存至 `docs/superpowers/plans/2026-08-07-civic-man-room-audio.md`。
