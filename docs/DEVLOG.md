# DEVLOG — 开发日志

> 这是变更历史，不是现行规则来源。现行规则以 `LOCKED_RULES.md` 为准。 
>
> 2026-08-29 起，本文件归属于《逗呆呆家族大战外星人》。其后“历史基线”章节只记录技术来源，不代表新项目的名称、美术、世界观或最终内容。

> 按时间倒序（最新在上）。每次完成一个阶段就追加一条并 commit。
> 格式：日期 | 做了什么 | 关键决策/坑 | 验证结果

---

## 2026-08-31 — V0.32 Moyu Core Experience Pass

- 新局固定放入四个 Value 1 办公用品 Defender，分布在四条 Lane，开局立即能攻击、移动和做首次 1+1 合成决策。
- 左侧出生槽收口为统一的“摸鱼账户 / 提取口”：直接显示 `当前 / 容量`、空槽时的“可提取”最高档，或槽非空时的“待部署”档位；仍然没有商店或多选菜单。
- 敌人携带值保持 `enemy.moyuValue` 单一事实源，头顶标记、延迟掉落、Pickup、截获入账和容量溢出沿同一数值传递；补入 1 / 8 / 32 与 credit + overflow 守恒测试。
- TEMP EXPERIENCE ONLY 敌人提升轮廓、对比和类型区分，继续不是正式资本怪美术。
- 新增未来美术 TODO：办公用品角色化、资本压力角色化与正式办公室背景；本轮未调整 R026、掉率、容量、敌人 HP 或出生压力。

验证：`npm test` 95/95 通过；`npm run build` 通过；Java 21 下 `npx cap sync android` 与 `./gradlew assembleDebug` 通过，体验 APK 未提交入源码仓库。

---

## 2026-08-31 — Project Cleanup Pass 1: 产品真源与资源审计

- 将仓库 AI 工作契约重命名为《工位保卫战》，并把“用户当前明确任务”提升为最高权威；用户改旧规则时，必须同步更新锁定规则和测试，旧测试不得阻止新决定。
- 新建 `ACTIVE_PRODUCT_DIRECTION.md`：当前 Defender 为办公用品，敌人为资本怪 / KPI / 会议 / 报表 / 加班系统；火冰雷、D Family、外星人方向归档。
- 为 D Family、植物时代美术规范、旧交接与旧状态快照增加 `ARCHIVED / HISTORICAL ONLY` 提示，未删除任何历史资料或素材。
- 审计确认当前 `assets/plants/plant_*.png` 全部仍是旧植物 / 旧角色图，不适合作为当前办公用品 Defender；本轮未替换任何运行时美术。
- 审计确认仓库内没有办公室正式背景：当前 `battlefield_v0.png` 是乡村背景，仅保留并记录。
- 澄清逻辑战场始终为 `10×5`；历史 `layout.columns = 12` 没有扩展玩法，已替换为显式 `defenseColumns = 2` / `logicalBattlefieldColumns = 10`。
- 未修改 Turn、经济、数值、Projectile、容量或 Sprite Placement 核心行为。

验证：`npm test` 92/92 通过；`npm run build` 通过。

---

## 2026-08-30 — 《工位保卫战》V0.2：摸鱼反击版立项

- 玩家可见项目名改为《工位保卫战》；Android 显示名和 Capacitor 应用名同步更新。
- V0.2 锁定的新循环为：资本怪携带摸鱼值 → 敌人死亡后永久入账 Moyu Bank → 玩家主动提取二进制数值 → 进入提取槽 → 部署、交换或合成仍按原 Turn 规则结算。
- 本轮明确不制作美术、不改地图、不改实时性、不改基础伤害，不引入火冰雷、Boss、技能树或局外成长。
- 旧 RewardBall 经济将先安全停用而非立即删除；待新 Moyu 系统完成并回归后，再处理遗留代码。

## 2026-08-30 — Moyu Economy V2 规则锁定（文档）

- 将攻击规则切换为“每个 Defender 每 Turn 单发”：Projectile 数量固定为 1，Projectile
  Damage 等于 Defender Value，取消按 Value 拆分多发的旧解释。
- 将经济循环定义为“资本怪携带摸鱼值 → 死亡后生成 MoyuPickup → 后续 Projectile 截弹回收
  → Moyu Bank → 玩家主动提取 → Spawn Slot”。本轮不改变核心 Turn、合成和数值伤害规则。
- 明确 pending drop 延迟到本轮全部 Projectile 结算后生成；任意 Projectile 均可回收，不设伤害门槛；
  截弹剩余伤害只计入 MoyuInterceptWaste，不与 OverkillWaste 重复统计。
- 明确边界自动回收、动画中断安全、重复碰撞幂等、Bank 提取不耗 Turn、槽非空禁止提取。
- 旧 RewardBall/自然生成/出生槽 Max Register 文档路径保留为历史参考，具体过时项见
  `docs/MOYU_ECONOMY_V2_IMPLEMENTATION_NOTES.md`。

---

## 2026-08-29 — 独立原创游戏仓库建立

**完成内容**

- 建立独立 Git 仓库 `d-family-vs-aliens`，起始提交为 `8cdc187`；与来源工程完全分离 Git 历史。
- 将 Android 应用标识迁移为 `com.local.dfamilyvsaliens`，应用显示名改为“逗呆呆家族大战外星人”。
- 将浏览器本地调参缓存键迁移到 `d-family-vs-aliens:*` 命名空间，避免与旧工程互相读取设置。
- 写入项目 README，明确原创世界、三名主角、D-Core、技术基线、文档入口与下一阶段目标。

**当前技术与玩法基线**

- 采用 Phaser 3 + Vite + TypeScript，移动端采用 Capacitor Android。
- 保留已验证的事件队列表现顺序、奖励球生命周期、格子占位检查、Lane 均衡和 Android 横屏适配作为技术基线。
- 默认难度锁定为 `BALANCED_V1`：REWARD_ECONOMY_CURVE_V2、Enemy Volume `0.4`、Enemy HP `1.0`、Reward Rate `1.0`、Large Enemy Rate `1.0`、Baseline Reward Capture `45%`、Enemy Count Cap `10`。
- 当前仓库尚未配置 GitHub 远程；现有临时美术与旧资源仅作技术占位，后续必须替换为原创资源。

**原创美术方向已锁定**

- 首批制作：呆 / 逗 / 小R各 3 阶段，共 9 个主体角色；以及对应 Projectile、命中特效、Fire/Frost/元素共鸣状态素材。
- 统一基准：用户提供的九宫格火 / 冰 / 雷概念图；保留家人身份特征，但不复制图中人物、文字、标识或任何第三方素材。
- 明确禁止：植物、豆子、豌豆、叶片、花朵、植物炮，以及任何非原创游戏角色联想。

**待办与验收**

1. 生成并人工确认 9 个透明角色主体，统一右向 45°、脚底基线和小尺寸轮廓。
2. 生成 9 套攻击核心与状态特效，并接入可配置资源映射。
3. 设计并替换为原创外星人敌人，随后再改主题场景与叙事。
4. 每一批资源接入后执行 `npm test`、`npm run build` 与 Android debug build。

**后续补充锁定：战场 Sprite 朝向**

- 战斗单位以右侧来敌为唯一朝向基准，禁止把角色绘制为正脸展示、回头看镜头或横版格斗姿势。
- 初级单位统一采用右向、稳站、蓄能待发的格内守线姿态；当前未通过该规范的候选图全部视为废稿。

---

## 历史技术基线（迁入前）

以下记录来自来源工程，用于追溯代码和玩法技术决策；其中旧名称与旧美术描述不属于本项目的对外内容。

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

---

## 2026-08-30 — V0.26：摸鱼容量 + 产品化基础

**做了什么**

- 摸鱼账户改为由本局历史最高办公用品决定容量：`max(highest / 4, 1)`，最高 32；账户满额时新增溢出账本和反馈。
- 新增版本化本地设置、统一音频管理器（BGM 槽位 + 静默降级 SFX）与本地 Top 10 战绩。
- 自动存档升级到 V2，并兼容迁移 V1 存档；继续保存完整逻辑局面与刷怪导演状态。
- 战斗页补入暂停、设置、战绩和结算面板；Debug 入口改为 1.5 秒内连点分数三次。

**验证**：92 条自动测试通过；Production Build 通过。

---

## 2026-08-31 — V0.31 Experience RC：摸鱼 UX + 临时敌人体验视觉

- 以 `6000173` 的伪 2.5D 运行时为体验基线：Ground Point、Y-sort、接触阴影与办公用品 Defender 保持不变。
- 摸鱼系统补齐可读反馈：携带值标识、延迟掉落提示、截弹回收飞向账户、账户容量提升、溢出提示、提取成功与出生槽占用提示。
- 旧僵尸视觉替换为 `TEMP / EXPERIENCE ONLY` 的原创 KPI / 会议 / 审批 / 加班系统占位敌人；不改变 Enemy 类型、HP、占格或出生规则。
- Android 体验版使用已有 `versionCode 6` / `versionName 2.1` 进行打包；APK 结果随本轮构建记录。
