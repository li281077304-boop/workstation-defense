/**
 * SpriteMeta V1 — 统一角色/单位视觉元数据
 *
 * 每个 Defender / Enemy / 静态实体都有一条 SpriteMeta 记录。
 * Placement 引擎读取这些数据来计算最终位置、缩放、深度。
 *
 * 设计原则:
 * - pivotY=1.0 表示"底部中心对齐"(脚底站在 Ground Point 上)
 * - artScale 只做 ±10% 微调,极端值说明 PNG 本身有问题
 * - footprint 描述逻辑占用格子数(1×1 默认,2×2 大怪)
 */

export type SpriteMeta = {
  /** 唯一标识,对应 IMAGES 注册表的 key 或 frame 名 */
  id: string;

  /** 逻辑占用宽度(格子数). 默认 1 */
  footprintW: number;
  /** 逻辑占用高度(格子数). 默认 1 */
  footprintH: number;

  /**
   * Pivot 点归一化坐标.
   * 默认 pivotX=0.5(水平居中), pivotY=1.0(底部).
   * Phaser 的 setOrigin(pivotX, pivotY) 直接使用这两个值.
   * pivotY=1.0 意味着:setOrigin(0.5, 1) 后 sprite.y = 脚底 Y 坐标
   */
  pivotX: number;
  pivotY: number;

  /**
   * 美术微调系数(0.90~1.10 正常范围).
   * 只承担"这张图整体偏大/偏小一点"的修正.
   * 如果需要 0.6 或 1.4 才能正常显示,说明 PNG/pivot/footprint 有问题.
   */
  artScale: number;

  /** Ground Point 微调(像素). 正值→右/下移动. 极少使用. */
  groundOffsetX?: number;
  groundOffsetY?: number;

  /** 深度偏移. 正值→画在更上层. 用于同格多实体前后排序. */
  depthBias?: number;

  /** Runtime-only contact-shadow tuning. Defaults work for all 1×1 units. */
  shadowScaleX?: number;
  shadowScaleY?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowAlpha?: number;
};

/** 创建默认 SpriteMeta (1×1 单位,底部中心 pivot) */
export const defaultMeta: Omit<SpriteMeta, 'id'> = {
  footprintW: 1,
  footprintH: 1,
  pivotX: 0.5,
  pivotY: 1.0,
  artScale: 1.0,
  shadowScaleX: 0.72,
  shadowScaleY: 0.20,
  shadowOffsetX: 0,
  shadowOffsetY: -2,
  shadowAlpha: 0.28,
};

/**
 * 格子度量 — 从 layout.ts 常量派生,不直接依赖 DOM/CSS.
 * 所有坐标都是 Phaser 1920×1080 设计空间内的像素坐标.
 */
export type CellMetrics = {
  /** 防守区左边界 X */
  defenseLeft: number;
  /** 防守格宽度 */
  defenseCellWidth: number;
  /** 战场区左边界 X */
  battlefieldLeft: number;
  /** 战场格宽度 */
  battlefieldCellWidth: number;
  /** 棋盘顶边界 Y */
  top: number;
  /** 行高 */
  rowHeight: number;
  /** 行数 */
  rows: number;
  /** 防守区列数 */
  defenseCols: number;
  /** 战场区列数 */
  battlefieldCols: number;
};

// ──── 内置 SpriteMeta 注册表 ────

/** Defender (办公用品/植物) 元数据 */
export const DEFENDER_META: Record<number, SpriteMeta> = {
  1: { id: 'defender-1', ...defaultMeta },
  2: { id: 'defender-2', ...defaultMeta },
  4: { id: 'defender-4', ...defaultMeta },
  8: { id: 'defender-8', ...defaultMeta },
  16: { id: 'defender-16', ...defaultMeta },
  32: { id: 'defender-32', ...defaultMeta },
  64: { id: 'defender-64', ...defaultMeta },
  128: { id: 'defender-128', ...defaultMeta },
  256: { id: 'defender-256', ...defaultMeta },
  512: { id: 'defender-512', ...defaultMeta },
  1024: { id: 'defender-1024', ...defaultMeta },
  2048: { id: 'defender-2048', ...defaultMeta },
  4096: { id: 'defender-4096', ...defaultMeta },
};

/** Enemy 元数据 (按 skin key) */
export const ENEMY_META: Record<string, SpriteMeta> = {
  'enemy-basic-01': { id: 'enemy-basic-01', ...defaultMeta },
  'enemy-basic-02': { id: 'enemy-basic-02', ...defaultMeta },
  'enemy-basic-03': { id: 'enemy-basic-03', ...defaultMeta },
  'enemy-basic-04': { id: 'enemy-basic-04', ...defaultMeta },
  'enemy-basic-05': { id: 'enemy-basic-05', ...defaultMeta },
  'enemy-basic-06': { id: 'enemy-basic-06', ...defaultMeta },
  'enemy-elite-01':  { id: 'enemy-elite-01',  ...defaultMeta, artScale: 1.05 },
  'enemy-large-01':  {
    id: 'enemy-large-01',
    footprintW: 2,
    footprintH: 2,
    pivotX: 0.5,
    pivotY: 1.0,
    artScale: 1.0,
  },
};

/** Moyu Pickup 元数据 */
export const MOYU_PICKUP_META: SpriteMeta = {
  id: 'moyu-icon',
  ...defaultMeta,
  artScale: 0.95,
};

/** 查找 Enemy meta,找不到返回默认 1×1 */
export function getEnemyMeta(skin: string): SpriteMeta {
  return ENEMY_META[skin] ?? { id: skin ?? 'unknown-enemy', ...defaultMeta };
}
