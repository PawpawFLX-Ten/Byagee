# Civic Man

网页版第三人称无尽生存小品：在包间里制止 CPU 角色吧唧嘴，噪音过高会掉血。

## 运行

```bash
npm install
npm run dev
```

## 操作

| 按键 | 作用 |
|------|------|
| WASD | 移动 |
| 拖拽 | 旋转镜头 |
| Tab | 切换目标 |
| 1 | 拍 |
| 2 | 胶条 |
| 3 | 喇叭 |
| 4 | 塞嘴 |
| R | 死亡后重开 |

## 文档

- 设计：`docs/superpowers/specs/2026-07-13-civic-man-design.md`
- 计划：`docs/superpowers/plans/2026-07-13-civic-man-prototype.md`

## 测试

```bash
npm test
npm run build
```

## Round 2

- **门系统**：NPC 从北门进出，人口上限 10（含 Boss）。插件随时间解锁（定时 → 威胁驱动 → 座位驱动）。
- **三桌布局**：圆桌、方桌、椭圆桌三角分布，共 10 座位。
- **Boss**：每 3 分钟生成一个（最多 1 个），体型 1.4×，含嘴 HP / 抗性 / 暴怒三模块（按时间叠加）。击败后降为普通食客。
- **拍喊**：slap 命中时播放「操你妈」语音。
