# DEVLOG — 开发日志

> 这是变更历史，不是现行规则来源。现行规则以 `LOCKED_RULES.md` 为准。

> 按时间倒序（最新在上）。每次完成一个阶段就追加一条并 commit。
> 格式：日期 | 做了什么 | 关键决策/坑 | 验证结果

---

## 2026-08-28 — V1 规则与前期循环修复

- 出生槽改为空起步：只有 Projectile 捕获战场奖励球后才按 Max Register 写入。
- 敌人生成与推进加入完整 footprint 占位检查，冲突时保持原位/跳过生成。
- 战斗渲染改为从结算前快照按事件回放：命中反馈、HP 更新、死亡消失依次发生。
- 敌人、植物、奖励球的待机呼吸改为逻辑 Container 内的子 Sprite 偏移，推进只移动 Container。
- 开局改为两株 Value 1、空出生槽、一个远端 RewardBall 1；前 20 回合禁用大怪并降低前期刷怪压力。
- 验证：`npm test`（25 项）与 `npm run build` 通过；本地试玩一回合无控制台错误。

## 2026-08-28 — 战斗同步、奖励生命周期与难度透明化

- 修正结算前敌人快照被重复右移一格的问题；Projectile 与 Enemy 现在使用同一格坐标。
- 奖励球改为随敌人生成批次出现（开局也有一组远端轻量敌人/奖励），并拆分 `reward-spawned`、`reward-hit`、`reward-captured`、`spawn-slot-updated` 事件。
- 奖励球最大值按最高植物值 ÷ 4 限制，另以独立权重控制出现概率。
- 集中 `DifficultyConfig`，并在本地开发页面按 `D` 打开实时调参面板。
- 验证：`npm test`（26 项）与 `npm run build` 通过；本地面板与启动页无控制台错误。

## 2026-08-28 — 表现层阶段队列修复

- 植物、敌人和奖励球的待机呼吸改为基于全局时间的子 Sprite 微偏移，重绘后沿用同一相位，不再因 Tween 重建断裂。
- 回合表现明确为攻击/死亡 → 旧敌人移动完成 → 新敌人和同批奖励淡入 → 回合结束；新生单位不参与本回合推进。
- 奖励球在 Projectile 命中后先飞入出生槽，抵达后才更新出生槽视觉；奖励数字作为球 Container 的子元素一同飞行。
- 验证：27 条规则测试、Production Build 通过；录制本地 15 秒回归试玩视频。

## 2026-08-28 — RewardBall 推进与难度观测指标

- RewardBall 随 Enemy batch 从最后一列出现；旧球与旧敌人一起推进，之后才显示新 batch。
- RewardBall 的生成、捕获和 Max Register 视觉顺序保持分离；球到出生槽后才更新槽。
- 增加每回合理论伤害、实际敌人伤害、火力利用率、奖励 value 生成/捕获、滚动奖励获取率、战场压力与压力比。
- 增加十回合奖励账本，开局奖励也纳入统计；仅供 Debug Panel/可选控制台日志观察，不会自动调难度。
- 验证：31 条规则测试与 Production Build 通过。

## 2026-08-28 — 统一占位与可解性 Spawn Safety Guard

- RewardBall 与 Enemy 共用战场占位检查，禁止球-怪、球-球以及球-2×2 footprint 重叠。
- Enemy 出生前计算相关 Lane 可用伤害、required utilization 与整批预测压力；超过安全范围时压低新怪 HP、由大怪回退普通怪或拒绝本次出生。
- 2×2 HP 改为普通怪曲线的独立倍率；出现概率在解锁/满概率分数间平滑增长。
- Debug Panel 增加待出生批次压力、预测压力比和逐只安全检查明细；不启用自动 Difficulty Director。
- 验证：35 条规则测试与 Production Build 通过。

## 2026-08-28 — PLAYABLE_BASELINE_V1

- 将用户确认可玩的当前 `DifficultyConfig` 冻结为 `PLAYABLE_BASELINE_V1`，Debug Panel 支持一键恢复。

## 2026-08-29 — BALANCED_V1

- 将 REWARD_ECONOMY_CURVE_V2 的已验证可玩参数锁定为 `BALANCED_V1`：206,102 分、574 Turn、最高植物 512；默认启动使用该组数值，旧模式只作为 Debug 对照。

## 2026-08-29 — Original Character Bible V1

- 保存 D Family 三人（火焰 / 冰霜 / 雷电元素共鸣）共 39 个等级的原创角色成长设定；下一步先制作 18 张关键帧，不直接批量出图。
- Debug Panel 在每局结束后保留最终分数、平均火力/奖励利用率、平均压力比、最高植物、死亡压力比和最后十回合敌人数。

## 2026-08-27 — V1 可玩雏形：精灵图接入 + 动画管线

**做了什么**
- 用户提供原创精灵大图（1536×1024 PNG，带透明通道），拆成 34 帧接入 Phaser：
  植物 11 级、奖励球 4 种、子弹 4 色、敌人 6+精英+Boss、特效。
- 帧坐标用**像素级连通域分析**校准（`scripts/strip_white_bg.py`），排除精灵旁的独立数字标签。
- 重写 `GameScene` 渲染层：Graphics 灰盒 → Sprite 精灵，等比缩放（fitSprite）防变形。

**关键决策/坑**
- 精灵图布局是**上下错落**的（非整齐网格），且每个精灵旁有独立数字标签 →
  必须用连通域 BFS 区分主体 vs 标签，手估坐标全废。
- `beginDrag` 里 spawnGhost 后调 `render()` 会把 ghost 删掉（render 内 removeAll）→ 先 render 再 spawn。
- `scene.restart()` 重跑 `create()` 会重复绑定 input 监听 → 先 off 再 on，否则越玩越卡。
- 操作顺序：**先 render 就位 → 落位动画 → 170ms 后齐射**（文档 §46），敌人显示用
  `enemyColOffset=1`（射击前位置），命中后 render(0) + 左滑 200ms。

**验证**：build 通过；17 条单测通过；浏览器实玩截图正常。

---

## 2026-08-27 — 交接文档落地 + 规则对齐

**做了什么**
- 写入 `PROJECT_HANDOFF.md`（52 节完整交接文档）。
- 对照文档修了 5 处不一致：
  1. 分数模型：击杀加分 → **实际伤害计分**（`scoreMode: 'damage'` 默认）
  2. 奖励球从不自然生成 → 新增 `spawnRewardAutomatic`（概率可配）
  3. 四颗子弹同帧重叠 → 70ms 错峰
  4. 敌人推进跳变 → 200ms 左滑动画
  5. 刷怪参数硬编码 → 全部进 `config.ts`

**验证**：测试 15→17 条；build 通过。

---

## 2026-08-27 — 正式美术替换（精灵图拆接）

**做了什么**
- 用户精灵大图接入：`public/assets/spritesheet.png` + `spritesheet-atlas.json`。
- 逐帧 flood-fill 抠白底（保留精灵内部白点高光）+ 像素级 bbox 检测重写坐标。

**坑**：JPG→透明 PNG 需逐帧 flood-fill（整体 flood-fill 会漏掉被精灵隔断的空隙白）。

---

## 2026-08-27 — 让灰盒能玩（子弹飞 + 自动刷怪）

**做了什么**
- `TurnManager`：hit/pierce/capture/kill 事件补 `col` 字段；`spawnAutomatic()` 按回合难度递增刷怪；
  默认开启自动刷怪。
- `GameScene`：操作后子弹沿 Lane 飞行、命中闪光；游戏结束点击重开。
- 修两 bug：背景图图层遮挡（背景垫底）；开局太满（改空棋盘 + 出生槽=1）。

**验证**：测试 14→15；build 通过。
