# Civic Man

网页版第三人称无尽生存小品：在包间里制止 CPU 角色吧唧嘴，噪音过高会掉血。

## 赞助 Sponsor

[爱发电 Afdian](https://ifdian.net/a/patatamaster) · [Ko-fi](https://ko-fi.com/F7U4234I2W)

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

## Round 5

- **道具系统**：每 45 秒在地上刷新一个道具，走过自动拾取。
- **回血药**：红色胶囊 + 绿十字，恢复 35 HP（满血上限）。
- **静音符**：金色铃铛 + 蓝色「静」字，全场普通 NPC 静音 5 秒（Boss 免疫）。
- **HP 权重**：血量越低越容易刷出回血药（满血 50/50，残血 95% 回血）。
- **视觉**：道具悬浮 + 旋转 + 发光光环；拾取时缩小消失；HUD 边缘金色 ✦ 指引方向。
- **持久化**：道具不捡不会消失，多个可同时存在。

## Round 6

- **开屏精简**：删除公文抬头和等级制度说明，赞助按钮移入标题行，字号放大，全设备无滚动条。
- **赞助改版**：三段两端对齐文案，爱发电链接更新，标题改为「吧唧钱包」。
- **技能图标**：抽脸改深蓝色，泼屎改墨绿色。
- **动态噪音延迟**：噪音杀伤延迟按 Boss 区段从 3.0s 线性递减到 1.5s（首个 Boss 前 3s，每过一个 Boss 减 0.5s）。
- **门禁修复**：Boss 满员时正确驱逐并入场；Boss 生成不再冻结普通门禁；实现 idleExitSec — NPC 入场超时后强制优先退出，FIFO 循环确保被击败的 Boss 最终离开。
- **塞嘴重做**：自动锁定最远吧唧者，无射程限制，紫色胶囊弹道飞行动画。
- **暂停系统**：HP 左侧 ⏸/▶ 按钮，Esc 切换，tick 早退冻结游戏状态。

## Round 7

- **i18n 国际化**：`src/game/i18n.ts` 扁平字典 + `t(key)` 函数，~100 个 key 三语翻译（中/英/荷）。
- **语言切换器**：开屏标题栏左侧循环按钮 ZH→EN→NL→ZH，非下拉菜单。
- **TTS 语音**：中文用 zh-CN voice，英文和荷兰语共用 en-US voice（荷兰语不另配 TTS）。
- **全量文案翻译**：技能名/描述、开屏、HUD、赞助弹窗、引导提示、道具 toast、称号、NPC 标签、3D 场景文字（墙画/门联/静音符）全部 `t()` 化。
- **墙画/门联英文**：静→Shhh / 忍→Bear It / 食不言→No Smack；天道酬勤→Chew Quiet / 地道的您→Or Else。英文逐字母竖排。
- **荷兰语**：喊话（Hou je fucking bekken dicht!）、技能（Klap/Plakband/Schreeuw/Mondprop/Strontgolf/Beschaafd）、墙画（Sjh/Volhard/Geen Smak）、门联（Kauw Stil/Of Anders）。
- **暂停时间修复**：`pausedAt` 追踪 + `startedAt` 偏移，恢复后游戏时间不跳跃。
- **跳跃翻桌**：空中跳过桌面碰撞；跳跃参数调整为 650ms/1.1 高度（可翻越全部桌子）。
- **吧唧嘴 → Byageee Mouth**：全语言统一。

## Round 8

- **手机开屏修复**：`briefing-card` 从 `overflow: hidden` 改为 `overflow-y: auto`，内容溢出时可滚动，「出警」按钮不再被裁剪不可达。移动端 padding/字号全面压缩（h1 20→18px、lede 12→11px、技能描述 12→11px、间距收紧），减少滚动需求。
- **赞助弹窗溢出修复**：`donation-card` 加 `max-height: 100%` + `overflow-y: auto`，移动端三段文案 + 二维码不再被裁剪。
- **死亡画面安全**：`justify-content: safe center` + `overflow-y: auto`，窄屏横屏下 h1/称号溢出时顶部不被截断。
- **摇杆移动修复**：`TouchControls` 的 `useEffect` 依赖数组缺少 `briefingDone`，导致 briefing 结束后摇杆永不初始化。加入 `briefingDone` 依赖 + effect 内守卫，修复移动端无法移动的致命 bug。
- **技能卡移动端重做**：6 个方形带文字按钮（底部居中横排）→ 6 个圆形纯图标按钮（底部右侧 2×3 网格），54px 直径，冷却/锁定为右下角徽章。隐藏 `kbd` 和技能名文字，减少视觉杂乱。
- **触摸操作按钮重排**：跳跃/切换从右侧底部纵向堆叠 → 移到技能网格正上方横向排列，所有操作按钮集中在右下角，右拇指自然覆盖。
