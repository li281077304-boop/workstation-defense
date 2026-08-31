# CURRENT_RENDERING_AUDIT.md

> **Historical pre-Placement-V1 audit snapshot.** It records the old `0046a88` baseline and must not be used as a description of current runtime placement. Current product direction is [`ACTIVE_PRODUCT_DIRECTION.md`](./ACTIVE_PRODUCT_DIRECTION.md).

> 工位保卫战 V0.3-lite 渲染审计
> 审计基线: commit `0046a88` (snapshot before sprite placement refactor)
> 审计时间: 2026-08-30 23:15

---

## 2026-08-31 Cleanup clarification: 10×5 logic vs historical `columns: 12`

**Conclusion: the implementation is A — a strict `10×5` logical battlefield.**

- `src/game/config.ts` defines `BOARD.battlefieldCols = 10`; this is the gameplay source for Enemy spawning, movement, footprint checks, projectile coordinates and lane rendering.
- A 1×1 Enemy spawns at logical column `9`; a `2×2` Enemy starts at `8` and occupies `8–9`.
- `GameScene.ts` draws cells only for `c < BOARD.battlefieldCols`; runtime lanes are therefore 10 columns wide.
- The old `layout.ts` field `columns: 12` did not extend gameplay. It was a stale, ambiguous layout value. It has been replaced with `defenseColumns: 2` and `logicalBattlefieldColumns: 10`.
- The brown decorative backdrop extending past the final cell is visual-only; it is not an eleventh or twelfth playable column.

`SpritePlacement.createCellMetrics()` now receives the explicit two layout counts and passes the logical `10` to `CellMetrics`. No entity logic or gameplay rule changed in this cleanup.

---

## 1. 当前 row/col → 屏幕坐标映射

### 布局常量 (`src/ui/layout.ts`)

```
MOBILE_LAYOUT = {
  width: 1920, height: 1080,
  board: {
    defenseLeft: 220,       // 防守区左边界
    battlefieldLeft: 570,   // 战场区左边界
    top: 150,               // 棋盘区顶边界
    defenseCellWidth: 160,  // 防守格宽
    battlefieldCellWidth: 130, // 战场格宽
    rowHeight: 176,         // 行高
    rows: 5,                // 5 条 Lane
    defenseColumns: 2,      // 防守区 2 列
    logicalBattlefieldColumns: 10, // 严格的战场 10 列
  },
  spawnSlot: { left: 45, width: 150, centerY: 590, height: 480 },
}
```

### 坐标计算函数 (`GameScene.ts` L12-16)

```ts
// 防守格左上角 X
const defenseX = (col) => LEFT + col * defenseCellWidth;  // 220 + col*160

// 战场格左上角 X
const fieldX = (col) => battlefieldLeft + col * battlefieldCellWidth; // 570 + col*130

// 列号(从屏幕 X 反算)
const defenseColAt = (x) => floor((x - LEFT) / defenseCellWidth);

// 行号(从屏幕 Y 反算)
const rowAt = (y) => floor((y - TOP) / ROW);  // TOP=150, ROW=176
```

---

## 2. 当前 Defender 定位方式

**位置**: `render()` 方法, L1230-1247

```ts
// Defender 中心点:
cx = defenseX(c) + defenseCellWidth / 2   // = 220 + c*160 + 80 = 300 + c*160
cy = TOP + r * ROW + 82                    // = 150 + r*176 + 82  ← MAGIC NUMBER 82

// 尺寸: fitSprite(sprite, 128, 128)  — 固定 128x128 最大尺寸
// 深度: depth = 20 (固定)
// 呼吸动画: amplitude=3, period=700+r*80+c*45
// 数值标签: cy - 62 (偏上)
```

**问题**:
- `+82` 是硬编码偏移,让植物"站"在格子下半部分而非正中心
- `fitSprite(maxW=128, maxH=128)` 不考虑格子实际大小(160x176)
- 无 pivot 概念,默认 Phaser origin(0.5, 0.5)=中心对齐

---

## 3. 当前 Enemy 定位方式

**位置**: `render()` 方法, L1279-1293

```ts
// Enemy 中心点:
ex = fieldX(e.col + enemyColOffset) + e.width * cellW / 2
    // = 570 + (col+offset)*130 + width*65
ey = TOP + e.row * ROW + (e.height * ROW) / 2
    // = 150 + row*176 + height*88

// 尺寸: fitSprite(sprite, ew*0.82, eh*0.82)  ← 82% 缩放因子
// 其中 ew = width * cellW, eh = height * ROW
// 深度: depth = 30 (固定)
// 呼吸动画: amplitude = width===2 ? 4 : 3
// HP 标签: y = eh * 0.28 (相对容器顶部)
```

**问题**:
- `0.82` 是全局统一缩放,不区分不同 skin 的视觉需求
- 中心点对齐 = 脚底不在地面(尤其 2x2 怪)
- HP 标签用 `eh*0.28` 硬编码偏移

---

## 4. 当前 Hardcoded Scale 汇总

| 位置 | 值 | 用途 |
|------|-----|------|
| L462 | `110, 110` | Drag Ghost (出生槽) |
| L470 | `130, 130` | Drag Ghost (防守区) |
| L515 | `116, 116` | Merge Preview |
| L778 | `76+scale*66, 18+scale*38` | Projectile |
| L812 | `110, 110` | Moyu Impact FX |
| L826 | `120, 120` | Kill Smoke FX |
| L833 | `70, 70` | Hit FX |
| L871 | `110, 110` | Birth Slot |
| L889 | `56, 56` | Moyu Icon |
| L942 | `48, 48` | Moyu Bank HUD icon |
| **L1237** | **`128, 128`** | **Defender (固定!)** |
| **L1272** | **`62, 62`** | **Moyu Pickup** |
| **L1285** | **`ew*0.82, eh*0.82`** | **Enemy (固定比例!)** |

---

## 5. Magic Numbers 汇总

| 位置 | 值 | 含义 | 问题 |
|------|-----|------|------|
| L462 | `-35` | 出生槽图标 Y 偏移 | 让图标在槽内居中 |
| L470 | `+80, +82` | 防守区拖拽 ghost 中心 | 与 render() 中 `+82` 对应 |
| L511 | `+80, +82` | Merge Preview 中心 | 同上 |
| L514 | `-8` | Preview 内 sprite Y 偏移 | 视觉微调 |
| L517 | `+63` | Preview 文字 Y 偏移 | 文字在 sprite 下方 |
| **L1235** | **`+82`** | **Defender Y 偏移(核心!)** | **让脚底落地,但纯经验值** |
| L1240 | `-62` | Defender 数值标签 Y | 标签在头顶 |
| L1254 | `-35` | 出生槽图标 Y | 同 L462 |
| L1256 | `+126` | 出生槽数字 Y | 数字在图标下方 |
| L1271 | `ROW/2` | Moyu Pickup Y | 格子中心 |
| **L1281** | **`e.width * cellW / 2`** | **Enemy X 中心** | **正确但无 Ground Point 抽象** |
| **L1282** | **`e.height * ROW / 2`** | **Enemy Y 中心** | **同上** |
| L1290 | `eh * 0.28` | Enemy HP 标签 Y | 硬编码 |

---

## 6. 当前 Z-Index / Depth 方式

| 层级 | Depth 值 | 内容 |
|------|---------|------|
| 0 | 0 | 背景图 |
| 1 | 1 | 板 overlay tint |
| 2 | 2 | 格子底图 (defense-cell / battlefield-cell) |
| 10 | 10 | UI 文字 (分数/设置/出生槽标签) |
| 20 | 20 | Defender (breathing entity) |
| 21 | 21 | Defender 数值标签 / 出生槽数字 |
| 22 | 22 | (未使用) |
| ... | ... | ... |
| 40 | 40 | Moyu Bank HUD |
| 50 | 50 | Projectile |
| 55 | 55 | Moyu Flight Proxy |
| 60 | 60 | Impact Effects (merge/hit/smoke) |
| 70 | 70 | Drag Ghost / Float Text |
| 80 | 80 | Drag Ghost (active) |
| 200 | 200 | Resume Choice dialog |

**问题**: Defender 全部 depth=20,无前后遮挡排序。Enemy 全部 depth=30,也无排序。
当前 5 Lane 几乎无纵向重叠,所以看不出问题,但 2x2 怪会暴露。

---

## 7. 本轮替换计划

### 必须替换 (P0)
- [x] `+82` Defender Y 偏移 → `getCellGroundPoint(row, col)` 
- [x] `fitSprite(128, 128)` 固定尺寸 → `calculateBaseScale(meta, cellMetrics)`
- [x] `ew*0.82, eh*0.82` Enemy 尺寸 → 统一 baseScale
- [x] Enemy 中心点定位 → Ground Point + Bottom-Center Pivot
- [x] 固定 depth=20/30 → `groundY` based depth sorting

### 暂时保留 (本轮不碰)
- Projectile 定位/缩放 (规范第十条明确排除)
- Moyu Pickup 保持现有实现 (静态 Reward 对象,后续迭代)
- Drag Ghost / Merge Preview (交互临时对象,不走 Placement 系统)
- UI 元素 (Bank HUD / Header / Settings)

---

## 8. 关键文件清单

| 文件 | 职责 | 本轮改动 |
|------|------|---------|
| `src/ui/layout.ts` | 布局常量 | 只读,不改 |
| `src/game/GameScene.ts` | 主渲染场景 | **大改**: 替换 Defender/Enemy 定位逻辑 |
| `src/game/types.ts` | 类型定义 | 可能加 SpriteMeta 类型 |
| `src/game/config.ts` | 游戏配置 | 不改 |

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/game/SpritePlacement.ts` | Placement 引擎 (Ground Point / Pivot / Scale / Depth) |
| `src/game/SpriteMeta.ts` | SpriteMeta V1 定义与注册表 |
