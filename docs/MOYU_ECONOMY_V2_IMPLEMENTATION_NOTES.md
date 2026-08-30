# Moyu Economy V2 Implementation Notes

> 本文件是给实现助手的迁移审计清单，不是新的玩法设计。权威硬规则见
> [`LOCKED_RULES.md`](./LOCKED_RULES.md) 的 R024–R034；如果本文与其冲突，以
> `LOCKED_RULES.md` 为准。

## 1. V2 目标循环

```text
Enemy carries moyuValue
→ Enemy dies
→ pendingMoyuDrops
→ current-turn Projectiles finish
→ MoyuPickup appears on battlefield
→ any later Projectile intercepts it
→ Moyu Bank increases immediately
→ player actively extracts a power of two
→ Spawn Slot receives one Defender
```

V2 不改变 2×5 防守区、10×5 战场、5 Lane、合法操作耗 Turn、合成规则、敌人移动基础规则或
Defender Value 的伤害含义。

## 2. 必须实现的状态与时序

- 每个有攻击资格的 Defender 每 Turn 只创建一个 Projectile：`damage = value`，
  `remainingDamage = value`。不得按 Value 拆成 4 发。
- Enemy 的 `moyuValue` 为 0 或配置允许的二进制值。死亡时最多产生一个 pending drop，随后清零
  `enemy.moyuValue`，避免重复掉落。
- pending drop 必须等本轮所有 Projectile 的 Enemy 命中、穿透、死亡与结束原因都结算完才生成。
  不能被杀死该 Enemy 的同一颗 Projectile 立即拾取。
- MoyuPickup 没有 HP、攻击或 Game Over 效果；它是 1×1 战场占位实体，随既有敌人移动阶段移动。
- Projectile 与 MoyuPickup 碰撞时无条件回收，不比较伤害、剩余伤害或 pickup value；该 Projectile
  立即结束，剩余伤害归零。
- `moyuBank += pickup.value` 必须在逻辑碰撞时发生，动画只负责飞入 Bank 的视觉反馈。
  `isCollected`/等价幂等标志必须防止重复回调重复入账。
- Pickup 到回收边界时自动入账；清理、Turn 切换或动画中断不能丢失已掉落值。
- Spawn Slot 开始为空；Bank 提取不消耗 Turn。槽非空时禁止再次提取、覆盖、Max Register、自动
  合并或自动替换。把槽内 Defender 放入棋盘或与同值单位合成，才按现有合法操作消耗 Turn。

## 3. 浪费统计边界

必须区分：

- `TotalProjectileDamagePotential`
- `EnemyDamageDealt`
- `OverkillWaste`
- `MoyuInterceptWaste`
- `MoyuCollectedValue`
- `MoyuPickupCount`
- `AutoRecoveredMoyuValue`

Projectile 如果以 Moyu 截弹结束，结束前的 `remainingDamage` 只能进入
`MoyuInterceptWaste`，不得再次计入 `OverkillWaste`。建议至少记录
`ENEMY_ABSORBED`、`MOYU_INTERCEPTED`、`LEFT_BATTLEFIELD / NO_TARGET`、`OTHER` 结束原因。

## 4. 默认生成配置

```ini
moyuCarrierChance = 0.80

Turn 1-15:   1 / 2 / 4
Turn 16-35:  2 / 4 / 8
Turn 36-60:  4 / 8 / 16
Turn 61-100: 8 / 16 / 32
Turn 101+:   16 / 32 / 64

low / mid / high weight = 20% / 55% / 25%
```

以上应配置化；本轮不加入敌人类型必掉、Boss 特殊经济或其他奖励规则。

### 标准预期经济

敌方预算仍只读取标准玩家曲线，不读取玩家实际 PlantPower。V2 的输入已经从旧
RewardBall 概率替换为：`moyuCarrierChance × 当前阶段的加权 MoyuValue`，再按 Turn 累计；
`baselineCaptureRate` 只作用于这条标准曲线。这样旧 RewardBall 的 1/2/4/8 权重不再影响
Moyu Economy V2 的敌人预算。

## 5. 迁移时必须废弃/隔离的旧路径

以下旧路径不能继续作为 V2 实现依据，但可以保留在历史文档中用于追溯：

| 旧路径 | 处理 | 原因 |
|---|---|---|
| `projectileCount = Math.min(value, 4)` | 废弃 | V2 每个 Defender 每 Turn 固定单发 |
| `damagePerProjectile = value / projectileCount` | 废弃 | V2 单发伤害直接等于 Defender Value |
| `fourProjectile` / `multiShot` / `bulletCount` / `shotIndex` | 废弃或仅保留迁移注释 | 不得重新打开旧四发机制 |
| `value / 4` 攻击拆分 | 废弃 | 不能把 32 变成 4×8、512 变成 4×128 |
| `RewardBall → Spawn Slot Max Register` | 停用 | V2 RewardBall 不再直接提供出生槽植物 |
| `reward-spawned → spawn-slot-updated` | 停用 | 生成/掉落/捕获/入账/提取必须分离 |
| `capturedRewards` 直接写槽 | 停用 | 捕获只增加 Moyu Bank；提取才写槽 |
| `enemy.moyuValue` 在死亡回调直接加 Bank | 禁止 | 必须先进入 pending drop，再被后续 Projectile 或边界回收 |
| `damage >= moyuValue` 拾取门槛 | 禁止 | 任意 Projectile 都能截弹回收 |
| 动画到 Bank 后才加值 | 禁止 | 逻辑入账必须早于动画，动画中断不能造成丢失 |

## 6. 现有文档中的历史位置

- `docs/LOCKED_RULES.md` 的 R009、R011、R013–R016、R023 已被 V2 语义更新；R024–R034 是当前
  Moyu 规则入口。
- `docs/RULES.md` 第 4–6 节仍描述旧四发、自然 RewardBall 和 Max Register，只能作为 Legacy
  Reference，不得复制实现。
- `docs/PROJECT_HANDOFF.md` 中约第 13–18、33 节及后续 RewardBall 示例仍是历史技术背景；交接时
  以本说明和 `LOCKED_RULES.md` V2 条款覆盖。
- `docs/DEVLOG.md` 中 2026-08-28 的 RewardBall 条目记录的是旧阶段事实；2026-08-30 的 Moyu
  条目记录 V2 迁移决策。

## 7. 最小验收案例

1. Value 512 每 Turn 只生成一颗 Projectile，伤害 512。
2. 512 命中 100 HP Enemy 后剩余 412 并继续飞行。
3. 1 damage Projectile 命中 MoyuPickup 64，成功回收 64，Projectile 消失。
4. 4096 Projectile 命中 MoyuPickup 1，同样成功回收，不能按伤害门槛拒绝。
5. 512 杀敌后本轮掉落的 Moyu 不能被同一颗 Projectile 立即回收。
6. Pickup 到边界自动回收；同一 Pickup 重复碰撞只能入账一次。
7. Bank=73 提取 64 后为 9；提取不耗 Turn；Spawn Slot 非空禁止提取。
