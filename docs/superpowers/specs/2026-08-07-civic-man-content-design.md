# Civic Man — 内容扩充：Boss 狂暴脉冲 + 新空间事件（A5/C6）设计稿

**日期:** 2026-08-07  
**状态:** 待审  
**目标:** 两处纯逻辑增量，丰富晚局节奏与空间变化：① 狂暴 Boss 周期性「噪音脉冲」（可被打断，给玩家反制窗口）；② 两个新空间事件（A5 餐吧角 / C6 屏风阵）。

---

## 一、Boss 狂暴脉冲（module c 强化）

### 现状

`tickBossRage`：狂暴后每 tick 无脑催化半径 5m 内 NPC（解除静默/密封、idle→smacking），无节奏、无反制、无视觉。

### 改为脉冲式

| 阶段 | 行为 |
|------|------|
| 冷却（pulseCooldownUntil） | 狂暴 Boss 每 `pulseIntervalSec`（9s）进入蓄力 |
| 蓄力（pulseChargeUntil） | 持续 `pulseChargeMs`（1.2s），头顶金色蓄力环可见 |
| 释放（pulseFiredAt） | 半径 `pulseRadius`（5m）内：密封/静默者被解除、idle/silenced 转 smacking 2.5s（催化效果一次释放，不再每 tick 刷）；`pulseFiredAt = now` 供场景做冲击（镜头微震 + HUD 红闪） |
| 反制 | 蓄力期任意技能命中 → `interruptBossPulse`：蓄力取消，冷却重置为 `pulseInterruptDelayMs`（4s）——玩家有明确反制窗口 |

### 数据

```ts
// NpcState +=
pulseChargeUntil: number   // 0 = 未蓄力
pulseCooldownUntil: number // 0 = 蓄力就绪
pulseFiredAt: number       // 最近释放时间（0 = 未释放）
```

`CONFIG.boss += { pulseIntervalSec: 9, pulseChargeMs: 1200, pulseRadius: 5, pulseInterruptDelayMs: 4000 }`

### 逻辑（可测）

- `tickBossRage` 重写为状态机：冷却→蓄力→释放→冷却；释放仅一次催化。
- `interruptBossPulse(boss, now)`：蓄力中才生效。
- 降级/杀死清空三字段。

### 场景（只读展示）

- Npcs.tsx：`pulseChargeUntil > now` 时头顶蓄力环（金色 ring 缩放 0→1，Billboard）。
- GameCanvas/World：`pulseFiredAt` 距今 <500ms 时镜头微震（现有 shake 模式）。

## 二、新空间事件 A5 / C6

### A5「餐吧角」（A 类，late pool）

- r0 东侧新房 `[5,-2.5]→[8.5,2.5]`，门 `door-rN`（可闩）。
- 内容：1 张圆桌（4 座，桌位 `[6.75,0,0]`）+ 1 张吧台（圆桌 2 座 `[6.75,0,1.8]`）+ 1 个吧台障碍（沿墙 long box `[5.8,-2]→[7.6,-1]`）。
- 注册：`EVENTS += { id:'A5', kind:'A', inFirstRewardPool:false, weightLate:2 }`。

### C6「屏风阵」（C 类，late pool）

- r0 内 3 块屏风障碍：`[-2.2,-2.4]→[-1,-1.2]`、`[0.4,0.2]→[1.6,1.4]`、`[2.2,-0.4]→[3.4,0.8]`（错落分布，不堵门/桌）。
- 纯障碍，不加座位/房间；`maxNpcs` 不变。
- 注册：`EVENTS += { id:'C6', kind:'C', inFirstRewardPool:false, weightLate:2 }`。

### 类型与接线

- `SpaceEventId` 联合 += `'A5' | 'C6'`（types.ts）。
- `applySpaceEvent` switch += A5/C6 实现（复用 `addRoomConnected`/`appendTableBundle`/obstacles 模式）。
- i18n `spaceEvent_A5/C6` ×3 语。
- README 一行。

## 约束

- 脉冲不改变伤害数值（不直接扣血），只催化吧唧节奏 + 打断窗口。
- A5/C6 不加新桌型（round/rect/oval 已有），不加贴图。
- 所有数值进 CONFIG.boss / EVENTS 表。

## 测试

- `bossModules.test.ts`：蓄力→释放状态机（时间边界）；释放催化仅一次；蓄力期打断（cooldown 重置、charge 清空）；非蓄力打断无效；降级清字段。
- `spaceApply.test.ts`：A5 加房间+3 桌 6 座+障碍；C6 加 3 障碍、座位不变。
- `spaceDirector.test.ts`：A5/C6 出现在 late 池、不在首奖池。
- quality.test：狂暴脉冲在长局模拟中不抛错、不破坏不变量。

## 超出范围

- 新 Boss 形态（第二个 Boss 种类）。
- 事件影响音效/灯光的地图级变化。

## 成功标准

1. 狂暴 Boss 每 9s 一次可读的蓄力→脉冲节奏；蓄力期拍击可打断。
2. A5/C6 在晚局按权重出现，座位/障碍正确，pathing 不堵死。
3. 186+ 测试全过，lint/build 通过。
