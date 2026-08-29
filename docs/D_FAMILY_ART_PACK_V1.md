# 逗呆呆家族：首批 9 角色与攻击素材包 V1

> 状态：**设计与资源映射已锁定，尚未生成或接入图片。**  
> 范围：3 人 × 初 / 中 / 高三阶段，共 9 个角色主体、9 套攻击视觉包，以及 4 组状态素材。  
> 非范围：13 级完整成长线、敌人 / Reward / 难度 / Turn 流程、第四位角色、技能树。  
> 原创边界：不得使用或保留“豆、豌豆、植物、花盆、叶片、植物嘴炮、植物射手”意象；不得调用或临摹任何既有塔防游戏角色、素材或特效。

## 1. 已有身份参考盘点

| 人物 | 可用参考 | 允许继承 | 必须剥离 |
|---|---|---|---|
| 呆（爸爸） | `public/assets/plants/plant_256.png` | 脸部、发型、眉眼、黑色衣着气质、战斗姿态 | 绿色炮、叶片、枝条、植物主题 |
| 逗（妈妈） | `public/assets/characters/wife_turnaround_v1.png`；`public/assets/plants/plant_512.png` | 帽子、长发、围巾、脸部与成人女性比例；冰蓝氛围可作色彩参考 | 蓝色花形伙伴、植物炮、花瓣 / 植物结构 |
| 小R（Rocky） | `public/assets/plants/plant_128.png` | 儿童脸型、发型、护目镜、儿童身材比例、活泼姿态 | 绿色炮、叶片、小植物伙伴、植物主题 |

**结论：** 9 个角色均有足够的人物外貌参考；本轮不需要补人像。后续生成须把对应参考作为身份锚点，不能使用原图中的植物装备。

## 2. 统一画面规格

### 2.1 角色主体

- 原创卡通科幻塔防风；清晰大轮廓、轻度赛璐璐阴影、柔和体积光。
- 统一 **3/4 朝右的 45° 游戏视角**；攻击方向向右。
- 所有角色以同一脚底基准线锚定；透明 PNG、无文字、无数字、无血条、无背景。
- 主制作尺寸：`1024 × 1024`；游戏导入尺寸：`512 × 512`。主体占画布高度约 82%，四周保留至少 8% 安全边距。
- 光源统一：左上方；描边深蓝灰而非纯黑；金属、布料、能量体均使用同一材质层次。
- 小尺寸优先级：脸 / 头部轮廓、主武器或核心、背部模块、元素色块。禁止把等级差异只藏在纹理里。

### 2.2 家族识别：D-Core

三名角色都拥有抽象、原创的 **D-Core**：一个不闭合的 D 形能量环 + 中央短棱晶，不使用字母标志、既有游戏图标或植物造型。

| 人物 | D-Core 颜色 | 主轮廓差异 |
|---|---|---|
| 呆 / 火 | 橙红 + 白热 | 护臂 / 胸核 / 环形恒星背件；横向、厚重 |
| 逗 / 冰 | 冰蓝 + 白 | 手部冰晶环 / 冰棱 / 领域环；纵向、轻盈 |
| 小R / 雷 | 青 + 黄 + 白 | 电池背包 / 双电极 / 悬浮电磁模块；小巧、灵活 |

### 2.3 特效共通规格

- Projectile：透明 PNG，推荐 `256 × 256`，中心保持可读，尾迹由运行时粒子延展。
- Hit FX：透明 PNG，推荐 `384 × 384`，允许代码缩放 / 着色 / 淡出；不包含满屏爆炸。
- 状态图标：透明 PNG，推荐 `128 × 128`，以敌人头顶或脚下的可叠层形式设计。
- 攻击视觉必须支持实际逻辑：火系可穿透；冰系提供 Frost 累积 / 满层冻结；雷系对 Fire 或 Frost 命中显示 12.5% 共鸣反馈。

## 3. 九个角色最终视觉规格

| ID | 角色 | 阶段 | 最终规格 | 参考基准 | 小尺寸识别点 |
|---|---|---|---|---|---|
| `dad_fire_01` | 呆·I「点火者」 | 初 | 生活化父亲主体；单侧简易机械护臂；护臂内小型橙红 D-Core；无大型枪械 | `plant_256` 的脸、发型、黑色气质 | 单发光护臂 + 橙红核心 |
| `dad_fire_02` | 呆·II「熔火先锋」 | 中 | 半身机械装甲；胸口红橙 D-Core；肩 / 背散热片；升级后的臂部发射结构；轮廓更宽硬 | 同上 | 宽肩、胸核、散热片 |
| `dad_fire_03` | 呆·III「恒星装甲」 | 高 | 完整高级科幻装甲；背后小型环形恒星核心；橙红与白热光；脸与身份保持清楚 | 同上 | 环形背核 + 白热护臂 |
| `dou_ice_01` | 逗·I「霜语者」 | 初 | 蓝白轻装；手部或身边一枚小型冰晶环；极少量雪花；不持普通枪械 | `wife_turnaround_v1` 为主；`plant_512` 仅作冰色参考 | 帽子、长发、冰晶环 |
| `dou_ice_02` | 逗·II「极寒使」 | 中 | 冰晶护肩 / 护腕；2–3 枚漂浮小冰棱；手前冰霜能量环；职业化但轻盈 | 同上 | 漂浮冰棱 + 手前能量环 |
| `dou_ice_03` | 逗·III「永冬领域」 | 高 | 大型冰晶领域环；周身轻霜；脚下小范围冰面；不戴传统皇冠 | 同上 | 领域环 + 冰面基座 |
| `rocky_thunder_01` | 小R·I「电光学徒」 | 初 | 儿童主体；小电池背包、护目镜、两枚小电极；明显是入门装备 | `plant_128` 的脸、发型、护目镜、儿童比例 | 护目镜 + 小电池包 |
| `rocky_thunder_02` | 小R·II「雷虎机兵」 | 中 | 轻型儿童机甲；肩 / 背两个小型悬浮电磁模块；黄青 D-Core；脸和小朋友比例不变 | 同上 | 两枚悬浮模块 + 儿童脸 |
| `rocky_thunder_03` | 小R·III「XY雷域装甲」 | 高 | 完整儿童科幻机甲；多个小型悬浮模块；背部电磁环；小R本人仍是主体，不做巨型机器人 | 同上 | 电磁环 + 轻小机甲比例 |

## 4. 九套攻击视觉包

| 角色 ID | Projectile ID / 规格 | Hit FX ID / 规格 | 命中表现与运行时意图 |
|---|---|---|---|
| `dad_fire_01` | `projectile_dad_fire_01`：小橙红压缩火核、短火尾 | `hitfx_dad_fire_01`：小型火花爆裂 | “火芯弹”；可穿透，命中不做范围爆炸。 |
| `dad_fire_02` | `projectile_dad_fire_02`：较长熔岩穿刺体、亮橙核心 | `hitfx_dad_fire_02`：窄向熔岩擦痕 | “熔岩穿刺”；贯穿后留下极短残迹。 |
| `dad_fire_03` | `projectile_dad_fire_03`：白热中心、橙红日冕外圈 | `hitfx_dad_fire_03`：短向烧灼轨迹 | “日冕贯穿”；高级、快速、绝不满屏爆炸。 |
| `dou_ice_01` | `projectile_dou_ice_01`：透明小霜晶 | `hitfx_dou_ice_01`：轻霜贴花 | “霜晶”；每次命中增加 Frost 可读性。 |
| `dou_ice_02` | `projectile_dou_ice_02`：短冰锥 | `hitfx_dou_ice_02`：脚下 / 身体结霜 | “冰棱束”；Frost 越高，霜层越明显。 |
| `dou_ice_03` | `projectile_dou_ice_03`：近白芯、冰蓝外圈的绝对零晶 | `hitfx_dou_ice_03`：爆开的冰晶冻结层 | 满 Frost 命中时显示明确冻结，不遮挡棋盘。 |
| `rocky_thunder_01` | `projectile_rocky_thunder_01`：小蓝白 / 青黄电光球 | `hitfx_rocky_thunder_01`：小电火花 | “电光球”；命中状态目标时叠加共鸣闪电。 |
| `rocky_thunder_02` | `projectile_rocky_thunder_02`：能量芯 + 跳动电弧 | `hitfx_rocky_thunder_02`：十字 / 环形小电爆 | “脉冲雷击”；状态目标用更亮的环形反馈。 |
| `rocky_thunder_03` | `projectile_rocky_thunder_03`：亮白雷核、青黄电弧 | `hitfx_rocky_thunder_03`：元素共鸣环 | Fire 目标偏橙黄电弧；Frost 目标偏蓝白电弧。 |

## 5. 特殊状态素材清单

| ID | 尺寸 | 用途 |
|---|---:|---|
| `status_fire_mark` | 128² | 火系状态标记；不与 Projectile 混用。 |
| `status_frost_stack` | 128² | Frost 单层 / 累积层；可由代码叠加透明度或数量。 |
| `status_frost_frozen` | 256² | Frost 满值冻结罩层；下一次 Enemy Move Phase 跳过移动的清晰反馈。 |
| `fx_thunder_resonance_fire` | 384² | 小R命中 Fire 状态目标时的橙黄共鸣弧。 |
| `fx_thunder_resonance_frost` | 384² | 小R命中 Frost 状态目标时的蓝白共鸣弧。 |

## 6. 建议目录与资源映射

```text
public/assets/d-family/
├── characters/
│   ├── dad_fire_01.png
│   ├── dad_fire_02.png
│   ├── dad_fire_03.png
│   ├── dou_ice_01.png
│   ├── dou_ice_02.png
│   ├── dou_ice_03.png
│   ├── rocky_thunder_01.png
│   ├── rocky_thunder_02.png
│   └── rocky_thunder_03.png
├── projectiles/
│   └── projectile_{dad_fire|dou_ice|rocky_thunder}_{01|02|03}.png
├── effects/
│   └── hitfx_{dad_fire|dou_ice|rocky_thunder}_{01|02|03}.png
└── status/
    ├── status_fire_mark.png
    ├── status_frost_stack.png
    ├── status_frost_frozen.png
    ├── fx_thunder_resonance_fire.png
    └── fx_thunder_resonance_frost.png
```

### 资源映射表（尚不接入代码）

| 人物阶段 | 元素 | 角色资源 | Projectile | Hit FX | 特殊反馈 |
|---|---|---|---|---|---|
| 呆 I / II / III | Fire / 穿透 | `dad_fire_01..03` | `projectile_dad_fire_01..03` | `hitfx_dad_fire_01..03` | `status_fire_mark` |
| 逗 I / II / III | Frost / 控制 | `dou_ice_01..03` | `projectile_dou_ice_01..03` | `hitfx_dou_ice_01..03` | `status_frost_stack`、`status_frost_frozen` |
| 小R I / II / III | Thunder / 共鸣 | `rocky_thunder_01..03` | `projectile_rocky_thunder_01..03` | `hitfx_rocky_thunder_01..03` | `fx_thunder_resonance_fire`、`fx_thunder_resonance_frost` |

## 7. 接入前验收清单

1. 9 个角色均以对应现有人脸 / 身份参考为基准，且无植物相关部件。
2. 统一为相同视角、脚底基准、透明背景、边距、光源、描边与材质语言。
3. 缩放至约 96–128px 高时，仍能认出角色、元素和阶段。
4. 火 / 冰 / 雷的差别同时来自轮廓、核心、武器 / 模块与运动语言，而不只是颜色。
5. 9 套 Projectile 和 Hit FX 均可拆开供运行时组合；状态素材不直接绑死在角色贴图内。
6. 本文确认后才生成首张“风格锚点图”；首批生成顺序为三名 I 级角色，再审风格后继续 II、III。
