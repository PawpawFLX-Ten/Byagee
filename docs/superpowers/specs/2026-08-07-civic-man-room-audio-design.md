# Civic Man — 房间声学混响（Room Audio）设计稿

**日期:** 2026-08-07  
**状态:** 待审  
**目标:** 让声音与威胁声学规则同源——邻房/远房咀嚼声更闷更轻、闩门后更闷、小房间更「wet」（残响更足）；全程纯 WebAudio 程序化合成，无音频资源。

---

## One-liner

咀嚼声总线接入程序化卷积残响（decaying noise IR），残响发送量随玩家所在房间面积变化（小包间 punchier）；每个咀嚼源的音量与低通截止频率按 acoustics 房间门（roomGate × openingFactor × floorFactor）缩放，追脸追杀客声音全开。

---

## 关系（对现有构建）

| 保留 | 新增 |
|------|------|
| `audio.ts` 程序化 chew loop / threat drone / TTS | `syncChews` 增加房间门缩放（gate）与残响发送量 |
| `acoustics.ts` 纯函数（已测） | 音频侧复用同一组门函数，保证听感与威胁一致 |
| AudioDirector 20Hz 轮询 | 轮询内构造 acoustics ctx（playerRoomId/floor、hop、latched） |
| CONFIG.roomReverb（威胁倍率） | 新增 CONFIG.audio 残响旋钮（不混淆语义） |

## 声学门 → 听感映射

对每个咀嚼源（smacking NPC）：

```
gate = roomGate(playerRoom, npcRoom, hop)      // 同房 1 / 邻房 0.3 / 远房 0.1
     × openingFactor(latchedOnPath)            // 闩门 0.5
     × floorFactor(同房跨层 0.8)
```

| gate 区间 | 听感 |
|-----------|------|
| 1.0（同房） | 现状：亮（cutoff 高）、响 |
| ~0.3（邻房） | 音量 ×0.685、cutoff ×0.82 → 明显更闷 |
| ~0.1（远房） | 音量 ×0.595、cutoff ×0.77 → 深闷 |
| 闩门中间 | 在对应基础上再降 |
| 追脸 chaser | 强制 gate=1（与 threat 的 ignoreRoomGate 一致） |

- 音量缩放：`0.55 + 0.45 × gate`
- cutoff 缩放：`0.75 + 0.25 × gate`

## 残响

- `chewBus → ConvolverNode（程序化 IR，1.2s 指数衰减噪声）→ reverbGain → master`；干声路径不变。
- `reverbGain` 目标值由玩家当前房间面积决定：

```
wet = reverbWetMax - max(0, area - reverbAreaAtMax) × reverbSlope
clamp [reverbMin, reverbWetMax]
```

| 房间 | 面积 | wet |
|------|------|-----|
| A1 小包间 | ~30m² | ~0.27 |
| 主厅 r0 | 100m² | ~0.08（干） |
| 极小 | 16m² | 0.34（上限） |

- 无咀嚼源或死亡时 wet → 0。

## CONFIG.audio（新增）

```ts
audio: {
  reverbWetMax: 0.34,
  reverbAreaAtMax: 16,
  reverbSlope: 0.0024,
  reverbMin: 0.08,
}
```

## 约束

- 无音频资源，无外网请求；IR 一次性生成（~1.2s×2ch 噪声）。
- 不改变威胁数值逻辑；`CONFIG.roomReverb`（threat 倍率）不动。
- 移动端成本：单个 ConvolverNode 极轻，无需质量门控。

## 测试

- `audio.test.ts`：`reverbAmountForArea` 单调递减、上下限 clamp、主厅/小包间具体值。
- 门数学复用 `acoustics.test.ts`（不重复）。

## 超出范围

- per-source 独立卷积（每个 NPC 一个 IR）——成本高收益低，v1 用全局 send。
- 房间回声延迟差、门缝渗声立体声——后续再说。

## 成功标准

1. 进入邻房后咀嚼声明显变闷变轻；闩门后再降一档。
2. 小包间内咀嚼有可闻残响尾音，主厅偏干。
3. 追脸追杀客的声音不被房间门衰减。
4. 测试/lint/build 通过。
