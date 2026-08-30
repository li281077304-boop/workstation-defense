# 项目阶段性总结

> **项目：** 《逗呆呆家族大战外星人》（仓库名：`d-family-vs-aliens`）  
> **状态日期：** 2026-08-30  
> **用途：** 为后续开发、试玩和美术接入提供一个单页状态入口。现行玩法规则以
> [`LOCKED_RULES.md`](./LOCKED_RULES.md) 为准；本文件不改变规则。

## 1. 当前可玩版本

项目已具备可玩的横屏、单机、无尽、离散回合制原型：Phaser 3 + TypeScript + Vite，
并已配置 Capacitor Android 外壳。游戏的默认难度模式为
`REWARD_ECONOMY_CURVE_V2`，其正常启动参数为 `BALANCED_V1`。

玩家可拖拽、交换或合成防守单位；每次**合法**操作会完整结算一回合。当前有战斗
动画、奖励捕获、合成/命中特效、音效、局后指标和本地调参面板。逻辑与难度测试已在
此前阶段覆盖；本次仅新增文档，未重新修改或验证代码行为。

## 2. 已确认核心玩法与规则

- **棋盘：** 左侧防守区固定 `2 × 5`，右侧战场固定 `10 × 5`；防守单位不得进入战场。
- **无尽回合制：** 合法操作 = 1 Turn；结算顺序为“玩家操作 → 全体单位齐射 →
  Projectile 结算 → 存活敌人向左一格 → 世界静止”。玩家不操作，世界不推进。
- **失败与得分：** 敌人进入防守区立即结束游戏；没有生命值或漏怪伤害。默认按实际
  造成的敌人 HP 伤害计分。
- **数值与攻击（Moyu V2）：** 单位值为 2 的幂；每株每回合发射一枚 Projectile，单发伤害为
  Defender Value。Projectile 使用剩余伤害穿透敌人。
- **大体型敌人：** 敌人为 `1 × 1` 或 `2 × 2`；后者共享 HP，能被所占两条 Lane 同时攻击。
- **占位与表现：** Enemy / RewardBall footprint 不得重叠；无法安全生成或推进时跳过/停留。
  战斗表现严格按“命中 → HP 更新 → 死亡移除”回放，避免视觉提前扣血或消失。

## 3. Reward 经济模型（历史）

RewardBall 是**唯一新增棋盘总战力**的来源；合成只改变分布，不增加总战力。

- 出生槽开局为空；只能由 Projectile 命中 RewardBall 后写入。
- RewardBall 命中后会消耗整颗 Projectile，并以 **Max Register** 更新出生槽：更低或相等
  的值不会清空、降低或自动合成槽内数值；玩家可以跨回合保留出生槽。
- RewardBall 是 `1 × 1` 战场单位，从最右列生成，随敌人移动；没有 HP，也不会直接造成
  Game Over。
- V2 自然 Reward 解锁池：T1–20 `{1}`、T21–40 `{1,2}`、T41–60 `{1,2,4}`、T61+ `{1,2,4,8}`，
  自然生成硬上限为 `8`。`1` 在解锁后不会退出池。
- 正常参数下每回合 Reward 生成率为 `0.80`，连续 1 回合未生成则触发保底。权重会从前期
  约 `53/27/13/7%` 平滑走向后期约 `33/27/22/18%`（1/2/4/8）。
- 经济记录区分四个值：**generated、reachable、captured、realized**；生成、可被射线触达、
  实际捕获和最终放上棋盘不是同一件事。

## 3A. 当前 Moyu Economy V2 规则方向

当前开发目标已从自然 RewardBall/出生槽 Max Register 切换为《工位保卫战》Moyu Economy V2：

- 每个 Defender 每回合只发射一颗 Projectile，伤害等于 Defender Value。
- 资本怪可携带摸鱼值；死亡后在本轮全部 Projectile 结算完成后生成 MoyuPickup。
- 任意 Projectile 命中 MoyuPickup 都会完整截弹并立即入 Moyu Bank，与伤害大小无关。
- 摸鱼值到达回收边界时自动入账，不允许永久丢失；重复碰撞和动画中断不得重复或漏记。
- 玩家从 Moyu Bank 主动提取 Power of Two；提取不耗 Turn，Spawn Slot 非空时禁止提取。

实现细则与旧 RewardBall 路径见 [`MOYU_ECONOMY_V2_IMPLEMENTATION_NOTES.md`](./MOYU_ECONOMY_V2_IMPLEMENTATION_NOTES.md)。

## 4. 难度系统与 `BALANCED_V1`

难度由“标准玩家预期从 Reward 获得的战力”反推，**不读取真实玩家当前战力**，因此不是
运行时橡皮筋。V2 以 `baselineCaptureRate`（45%）计算预期战力，再生成敌方 HP 收入预算。

| 项目 | `BALANCED_V1` 默认值 |
| --- | ---: |
| Enemy Volume | `0.4` |
| Enemy HP | `1.0` |
| Reward Rate | `1.0` |
| Large Enemy Rate | `1.0` |
| Enemy Count Cap | `10` |
| Baseline Reward Capture | `45%` |
| Reward Progression | `1.0` |
| High Value Bias | `0.70` |

关键公式：`ExpectedPlantPower = 2 + 0.45 × cumulativeExpectedGeneratedReward`；
`DifficultyFactor` 从 `0.45` 渐近增长至 `0.65`；普通怪目标 HP 约为预期战力的 `0.9`
（生成时 ±15%），`2 × 2` 敌人 HP 约为普通怪 `1.1×`，但消耗 `1.8×` 出生预算。

Spawn Safety Guard 会限制普通怪所需利用率至 55%、大怪至 60%，并对新批次设 75% 硬压力
上限；必要时只会下调**新怪** HP、把大怪回退为普通怪或拒绝本次生成，不会改写场上怪物。

`BALANCED_V1` 的已记录参考局为：**206,102 分 / Turn 574 / 最高单位 512 / PlantPower 844**，
在持续压力达到 102% 后结束。旧 `PLAYABLE_BASELINE_V1` 与 `ENDLESS_CURVE_V1` 仍保留，
只供 Debug 对照。

## 5. UI 与 Android 适配

- 逻辑画布为 `1920 × 1080`、16:9 横屏；主要布局为左侧防守区、右侧战场、顶部出生槽/分数/设置。
- UI 有本地 Difficulty Debug Panel（按 `D` / 齿轮进入），可观察火力利用率、Reward 捕获率、
  战场压力、出生安全检查和每局摘要；这些指标只用于观察，不会自动调难度。
- Android 使用 Capacitor，应用 ID 为 `com.local.dfamilyvsaliens`，应用名为“逗呆呆家族大战外星人”，
  `MainActivity` 已锁定横屏。当前仓库内有 `v1.0`–`v1.3-volume04` 的 debug APK **迁入前历史产物**，
  不能视为本原创项目的正式发行版本；Android 工程版本号当前是 `2.0`（`versionCode 5`）。
- 尚未做真机兼容性回归或正式签名/发布流程验证；后续每批资源接入后应重新执行 Web 构建与 Android debug build。

## 6. 已确认美术与角色方向

项目对外原创方向为 **D Family / D计划 / 呆呆一家**：爸爸、妈妈、小 R 共享原创 D-Core，
不得使用植物、豆子、豌豆、叶片、花朵、植物炮，或任何会关联到既有游戏角色的命名与视觉语言。

- **爸爸：** 火焰 / 穿透；红橙 D-Core，成长方向为熔炉、喷射能源、轨道炮和重型机械。
- **妈妈：** Frost / 控场；冰蓝 D-Core，成长方向为冰晶、寒霜、领域与冰核。
- **儿子：** 雷电 / 元素共鸣；黄白或青紫 D-Core。命中带 Fire 或 Frost 状态的敌人，各有
  `+12.5%` 伤害的已确认数值草案；双状态的最终处理仍待决定。
- 三条角色线各有 13 个二进制等级，按五阶段成长。实际生产先制作每人
  `1 / 8 / 32 / 128 / 512 / 4096` 六张关键帧（共 18 张），而不是直接批量制作 39 张。
- 战斗角色一律右向守线、约 45°，脚底基线一致，必须清晰表现为面向右侧来敌；透明 PNG、
  身份特征和小尺寸轮廓可读性是验收要求。

**当前资源状态：** 运行时仍存在历史植物/旧敌人占位资源，不能作为对外最终美术。仓库已新增
`public/assets/d-family/characters/` 候选资源；截至本总结，爸爸图有修改、妈妈和小 R 图为
未跟踪文件，均尚未完成正式资源映射和提交确认。

## 7. 敌人行为原型

现已实现的敌人行为是：`1 × 1`、`2 × 2`、共享 HP、占位阻挡、安全生成与逐格推进。
后续行为型敌人仅为设计原型（来自阶段讨论，尚未写入规则或代码）：

- 圆胖慢怪：低速/高阻塞感；
- 细长快怪：更快的推进节奏；
- 分裂怪：死亡后生成小怪；
- 盾怪：正面减伤；
- 跳跃怪：跨过前方因 Frost 停住的单位；
- 吸能怪：吞噬 Reward。

若用户确认进入该阶段，建议按“一个原型一轮”实施；可先验证 `JumpEnemy V1`（跨过前方因
Frost 停住的单位），且不同时改难度、Reward 或 UI。

## 8. 已知问题与未决项

- RewardBall 与 Enemy 同格时的目标优先级、Projectile 在敌人后方命中 Reward 的几何顺序，仍需
  参照试玩/原型确认。
- RewardBall 到最左边界后的行为尚未确定。
- 自然 Reward 值高于 `8` 的需求、`kill` 计分模式是否保留，尚未决定。
- 难度仍需基于用户真实试玩反馈复测，尤其是成长曲线、Reward 出生位置和回合节奏。
- 儿子对同时具有 Fire + Frost 的敌人的机制（简单 `+25%` 或独立共鸣）未确认。
- 对外项目名称、爸爸 256 级最终参考图均待锁定。
- 当前新 D Family 候选图未接入；旧资源、背景、敌人和叙事仍需逐步替换为原创资产。

## 9. 暂缓事项

除非用户明确提出，以下不做：关卡、商店、抽卡、升级树、装备、广告、账号、联网、排行榜、
任务、成就、能量/生命、倍速、自动战斗、AI 策略或大型模拟系统。

同样暂缓：一次性实现完整 39 张角色素材、六种敌人行为一起上线，以及把 Fire/Frost/雷电共鸣
作为未验证的大型规则改造。

## 10. 下一阶段优先级

1. **锁定并接入第一批原创美术：** 三人 3 阶段的 9 个角色主体、对应 Projectile、命中特效与
   Fire/Frost/共鸣状态；逐批人工验收右向姿态、透明度和角色识别。
2. **替换敌人与场景叙事：** 先设计原创外星敌人，再清理旧占位美术的对外呈现。
3. **小范围试玩复测：** 固定 `BALANCED_V1`，记录死亡分数/Turn、最高值、前期 2×2 出现时机、
   Reward 捕获与压力比；只在证据充分后调参。
4. **单一行为敌人原型：** 若核心循环确认稳定，再做 `JumpEnemy V1`，并配套测试与十分钟试玩。
5. **体验收尾：** 评估合成值飘字、开场短提示与回合节奏（目标约 650–900ms）。

## 11. 关键提交、版本与工作树

| 项目 | 信息 |
| --- | --- |
| 当前分支 | `main` |
| 当前 HEAD | `26dbd60` — `art: add right-facing mom and rocky sprite candidates`（2026-08-29） |
| 仓库初始化 | `8cdc187` — `chore: initialize d-family vs aliens game project` |
| 独立原创项目基线 | `d8d6e65` — `docs: document standalone game project baseline` |
| 右向 Sprite 规范 | `b3fb062` — `docs: lock right-facing tower defense sprite orientation` |
| 当前包版本 | `package.json`：`0.1.0`；Android：`2.0` / `versionCode 5` |
| Git 远程 | 当前未配置远程仓库 |

工作树包含未提交美术改动：修改的 `dad_fire_01.png`，以及未跟踪的
`dou_ice_01.png`、`rocky_thunder_01.png`。它们是后续美术确认范围，不属于本次文档变更。

---

## 维护约定

每次阶段性变化后，更新本文件的日期、当前可玩状态、未决项、下一步优先级与关键提交。
玩法规则改动仍必须同步更新 `LOCKED_RULES.md` 和对应测试；本文件只做状态归纳。
