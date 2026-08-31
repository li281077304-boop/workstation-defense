# 工位保卫战

《工位保卫战》是一款原创的横屏、单机、无尽回合制塔防游戏：办公用品守卫工位，反抗资本怪、KPI、会议、报表与加班系统，夺回属于自己的摸鱼时间。

> **属于你的时间，一分钟都不能少。**

## 当前产品

- 技术栈：TypeScript、Phaser 3、Vite。
- 移动端：Capacitor Android。
- 棋盘：左侧 `2×5` Defender 区；右侧严格 `10×5` 逻辑战场。
- 回合：一次合法玩家操作结算一个 Turn；玩家不操作，世界不推进。
- 经济：资本怪携带摸鱼值（Moyu）；击杀、截获或边界回收后进入 Moyu Bank，玩家主动提取到 Spawn Slot 并部署或合成。
- 产品功能：自动存档与继续游戏、本地 Top 10、Settings、AudioManager。
- 渲染：Sprite Placement V1 以 Ground Point、bottom-center pivot 与 Y/depth sorting 统一静态单位落位。

当前产品方向、当前 Defender 语义与历史资料边界见 [ACTIVE_PRODUCT_DIRECTION.md](docs/ACTIVE_PRODUCT_DIRECTION.md)。确认过的玩法规则见 [LOCKED_RULES.md](docs/LOCKED_RULES.md)。

## 当前 Defender 语义

`1 → 4096` 对应不同的办公用品：笔、胶棒、小风扇、保温杯、通用能量饮料、订书机、喷雾瓶、手机支架/信号类物件、笔记本/数据类物件、显示器、打印机/纸张类、碎纸机与终极工位核心。具体运行时 PNG 映射以 [DEFENDER_ASSET_AUDIT.md](docs/DEFENDER_ASSET_AUDIT.md) 为准。

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

- [当前产品方向](docs/ACTIVE_PRODUCT_DIRECTION.md)
- [现行规则](docs/LOCKED_RULES.md)
- [Defender 素材审计](docs/DEFENDER_ASSET_AUDIT.md)
- [背景素材审计](docs/BACKGROUND_ASSET_AUDIT.md)
- [渲染审计](docs/CURRENT_RENDERING_AUDIT.md)
- [开放问题](docs/OPEN_QUESTIONS.md)
- [开发日志](docs/DEVLOG.md)

历史火/冰/雷、D Family 与外星人方向仅保留作归档，不得作为当前产品需求。

## GitHub

仓库：[li281077304-boop/workstation-defense](https://github.com/li281077304-boop/workstation-defense)
