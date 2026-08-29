# 逗呆呆家族大战外星人

独立的原创横屏塔防游戏工程。项目以已经验证的回合制塔防技术框架和 `BALANCED_V1` 难度为起点，逐步演进为逗呆呆家族对抗外星人的原创游戏。

## 当前边界

- 这是新的项目仓库，不与来源工程共用 Git 历史。
- 当前保留运行框架、Android 工程、测试和已验证的可玩难度作为技术基线。
- 后续只在本仓库中演进原创角色、美术、敌人、故事和名称；不使用任何第三方游戏角色、素材或名称。
- 未配置远程仓库；需要时再单独创建并推送 GitHub。

## 世界与核心角色

| 角色 | 属性 | 初 / 中 / 高阶段 |
| --- | --- | --- |
| 呆 | 火焰、穿透 | 点火者 / 熔火先锋 / 恒星装甲 |
| 逗 | 冰霜、控制 | 霜语者 / 极寒使 / 永冬领域 |
| 小R（Rocky） | 雷电、元素共鸣 | 电光学徒 / 雷虎机兵 / XY 雷域装甲 |

三人共享原创的 D-Core 能源识别符。小R攻击带 Fire 或 Frost 状态的敌人时，当前设计为触发 +12.5% 元素增伤；更复杂的双元素机制后续单独设计。

## 技术基线

- 前端：Vite + TypeScript + Phaser 3。
- 移动端：Capacitor + Android，包名 `com.local.dfamilyvsaliens`。
- 玩法：玩家操作触发一个 Turn；攻击、命中、死亡、旧单位移动、新批次出生按事件顺序演出。
- 难度：保留 `REWARD_ECONOMY_CURVE_V2`，默认锁定 `BALANCED_V1`；默认 Enemy Volume 为 `0.4`。

## 常用命令

```bash
npm install
npm run dev
npm test
npm run build
npx cap sync android
```

Android debug 包在同步 Web 构建后，于 `android/` 目录执行 `./gradlew assembleDebug`。

## 文档入口

- [项目交接与现状](docs/PROJECT_HANDOFF.md)
- [现行规则](docs/LOCKED_RULES.md)
- [难度与基线](docs/DIFFICULTY.md)
- [原创角色圣经](docs/ORIGINAL_CHARACTER_BIBLE.md)
- [首批 9 角色素材规范](docs/D_FAMILY_ART_PACK_V1.md)
- [开发日志](docs/DEVLOG.md)

## 接下来做什么

1. 依据九宫格美术基准完成 3 人 × 3 阶段角色主体与攻击素材。
2. 将现有临时角色/敌人视觉替换为原创资源，并保持战斗数值不变。
3. 完成原创外星人敌人阵容与首个可玩主题场景。
