# ARCHIVED / HISTORICAL ONLY

> **DO NOT USE AS CURRENT PRODUCT REQUIREMENTS.** This plant-era art brief is retained only for history. The current product direction is [`ACTIVE_PRODUCT_DIRECTION.md`](./ACTIVE_PRODUCT_DIRECTION.md).

# ART_DIRECTION — 美术规范

> 目标：让任何 AI（Codex / WorkBuddy / ChatGPT）不靠聊天记忆，只读本文件就能接美术活。
> 状态：V1 精灵图已锁定（2026-08-27），来源见下。

---

## 1. 当前已锁定的美术资产

### 主精灵图（唯一事实源）

- 文件：`public/assets/spritesheet.png`（1536×1024，RGBA，带透明通道）
- 帧定义：`public/assets/spritesheet-atlas.json`（34 帧，像素级校准，排除数字标签）
- 帧命名：`plant-1/2/4/8/16/32/64/128/256/512/1024/2048/4096/8192`、`reward-1/2/4/8`、
  `bullet-green/blue/orange/purple`、`zombie-1x1-0~5`、`zombie-elite-1x1`、`boss-2x2`、
  `effect-merge`、`effect-hit-green/blue/orange/purple`、`effect-smoke-1/2`

### 背景图

- `public/assets/backgrounds/battlefield_v0.png`：卡通田园风森林村庄，石板路空地作棋盘，
  左右树/花/栅栏、红顶小屋、风车青山。风格统一，无第三方造型，可长期沿用。
- `public/assets/tiles/defense_cell_v1.png`：从当前正式场景图截取的植物格；
  `public/assets/tiles/battlefield_cell_v1.png`：同图截取的战场土路格。两者均已接入运行时棋盘。

---

## 2. 风格基调

| 维度 | 规范 |
|---|---|
| 整体 | 明亮、卡通、高饱和、可爱、轻度奇幻 |
| 植物 | 每级**轮廓明显不同**（不是换色花），白字+深色描边数字悬浮头顶，数字不印身体中央 |
| 敌人 | 原创卡通怪物/僵尸；**避免复刻 PVZ 标志性组合**（路障/铁桶/橄榄球） |
| 植物 vs 敌人 | 必须一眼可区分 |
| UI | 只保留：出生槽（植物区左侧中部的大竖槽）、分数（顶部居中）、设置（右上）；不要 Turn/Debug/能量/倍速/波次/生命/卡牌栏 |

### 植物等级造型方向（建议，对应 1~8192）

豌豆 → 南瓜 → 向日葵 → 仙人掌 → 冰晶 → 火焰辣椒 → 紫色毒蘑菇 → 儿子豌豆炮（128） → 爸爸豌豆炮（256） → 妈妈豌豆炮（512） → 食人花（1024） → 太阳王花（2048） → 太阳王花暂用外观（4096/8192，待后续专属美术）

用户应能**不看数字大致认出等级**。

---

## 3. 敌人 HP 显示

- 暗红色背景（`#7a3131`）+ 白色数字，与植物等级样式明确区分。

---

## 4. 素材替换规则（重要）

1. **定稿即入库**：某张图一旦被用户确认"这版行"，立即放入对应目录并 commit
   （如 `art: lock plant set v1`），从此它是项目资产，不是聊天里的一张图。
2. **版本化**：同一元素多次迭代时按版本保留：
   `assets/plants/v1/`、`v2/`、`v3/`……用户选定版本后锁定，绝不覆盖删除。
3. 替换主精灵图时：重跑 `scripts/strip_white_bg.py`（连通域校准帧坐标），
   并校验 `spritesheet-atlas.json` 与 PNG 像素边界同步。
4. 建议资源拆分目录（未来独立 PNG 化时用）：
   `plants/`、`enemies/`、`rewards/`、`projectiles/`、`effects/`、`ui/`、`battlefield/`
   （当前已建目录骨架 + `.gitkeep`，实际帧集中在主精灵图内）。
# 原创角色总纲

角色、关键帧和元素视觉的唯一总纲见 [ORIGINAL_CHARACTER_BIBLE.md](ORIGINAL_CHARACTER_BIBLE.md)。
任何新资产须优先符合该文档的原创命名、D-Core 家族识别和五阶段成长规则。

首批实际生产范围、现有人物参考和资源映射见 [D_FAMILY_ART_PACK_V1.md](D_FAMILY_ART_PACK_V1.md)。该素材包只包含逗呆呆家族 3 人 × 3 阶段与对应攻击特效，不授权扩大到完整 13 级线。
# D Family 人物身份锁定

- 角色素材必须为真透明 PNG（Alpha 通道），不可出现棋盘格或任何背景。
- 爸爸、妈妈、小R分别保留自己的日常衣服；科技内容仅作为可拆卸外挂。
- 爸爸裤子固定为米色，不能绘制为黑色战术裤。
- 不得出现额外眼睛、天眼、额头核心或异形五官。

## 战场朝向

所有塔防单位固定右向守线：头、眼、躯干、肩、攻击手和脚尖皆朝右；严禁正脸看镜头、回头看玩家或为了展示脸扭身。攻击核心位于右侧攻击方向前方，非攻击手收近身体。图片若不能明确表达“盯右侧来敌、马上攻击”，即为不合格素材。
