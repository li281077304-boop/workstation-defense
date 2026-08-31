/**
 * Sprite Placement Engine V1 — 统一定位/缩放/深度系统
 *
 * 核心原则(来自 2.5D/等距游戏成熟实践):
 *   1. Grid Cell — 每个逻辑格子有明确边界
 *   2. Ground Point — 格子提供一个"地面落点"(脚底站的位置)
 *   3. Bottom-Center Pivot — 默认 pivotY=1.0,脚底对齐 Ground Point
 *   4. Y/Depth Sorting — 越靠下(depth 值越大)画在上层
 *
 * 本模块是纯函数,不依赖 Phaser Scene 实例.
 * 输入:逻辑坐标(row, col) + SpriteMeta + CellMetrics
 * 输出:PlacementResult (x, y, scale, depth, origin)
 */

import type { SpriteMeta, CellMetrics } from './SpriteMeta';

// ──── 常量 ────

/** Defender can be visually substantial without changing its logical 1×1 cell. */
const DEFENDER_UNIT_WIDTH_RATIO = 0.90;
/** Human-sized enemies deliberately read larger than the office-item defenders. */
const BATTLEFIELD_UNIT_WIDTH_RATIO = 1.15;

/** 允许超出格子高度的最大比例(人物可以向上伸出) */
const MAX_HEIGHT_OVERFLOW_RATIO = 1.6;

/** Stable bands: background/floor < world rows < projectiles/FX < HUD/debug. */
export const RENDER_DEPTH = {
  FLOOR: 100,
  WORLD_BASE: 1000,
  PROJECTILE: 20000,
  FX: 21000,
  UI: 30000,
  DEBUG: 40000,
} as const;

/** Bottom Ground Y is the only normal world sort key; creation order is irrelevant. */
export function worldDepthForGround(groundY: number, depthBias: number = 0): number {
  return RENDER_DEPTH.WORLD_BASE + Math.round(groundY * 10) + depthBias;
}

// ──── 类型 ────

export type GridType = 'defense' | 'battlefield';

export type PlacementResult = {
  /** 容器/精灵的最终 X 坐标 (Phaser 设计空间) */
  x: number;
  /** 容器/精灵的最终 Y 坐标 (Phaser 设计空间) */
  y: number;
  /** 最终统一缩放系数 (已含 artScale) */
  scale: number;
  /** Phaser depth/zIndex 值 (越大越上层) */
  depth: number;
  /** Phaser setOrigin 参数 */
  originX: number;
  originY: number;
  /** 占据的像素宽度 (用于 fitSprite 的 maxW) */
  displayWidth: number;
  /** 占据的像素高度 (用于 fitSprite 的 maxH) */
  displayHeight: number;
  /** Ground Point 坐标(调试用) */
  groundX: number;
  groundY: number;
};

// ──── CellMetrics 工厂 ────

/** 从 layout.ts 的 MOBILE_LAYOUT 常量创建 CellMetrics */
export function createCellMetrics(layout: {
  defenseLeft: number; defenseCellWidth: number;
  battlefieldLeft: number; battlefieldCellWidth: number;
  top: number; rowHeight: number;
  rows: number;
  defenseColumns: number;
  logicalBattlefieldColumns: number;
}): CellMetrics {
  return {
    defenseLeft: layout.defenseLeft,
    defenseCellWidth: layout.defenseCellWidth,
    battlefieldLeft: layout.battlefieldLeft,
    battlefieldCellWidth: layout.battlefieldCellWidth,
    top: layout.top,
    rowHeight: layout.rowHeight,
    rows: layout.rows,
    defenseCols: layout.defenseColumns,
    battlefieldCols: layout.logicalBattlefieldColumns,
  };
}

// ──── 核心 1: Ground Point ────

/**
 * 获取格子的"地面落点"坐标.
 *
 * Ground Point 不是格子几何中心.
 * 它表示:单位脚底 / 物体底座应该站的位置.
 *
 * 对于 1x1 格子:Ground Point 在格子底部中心偏上一点(留出脚底空间).
 * 对于 2x2 格子:Ground Point 在占据区域的底部中心.
 */
export function getCellGroundPoint(
  row: number,
  col: number,
  gridType: GridType,
  metrics: CellMetrics,
  footprintW: number = 1,
  footprintH: number = 1,
): { x: number; y: number } {
  const cellW = gridType === 'defense' ? metrics.defenseCellWidth : metrics.battlefieldCellWidth;
  const left = gridType === 'defense' ? metrics.defenseLeft : metrics.battlefieldLeft;

  const areaLeft = left + col * cellW;
  const areaTop = metrics.top + row * metrics.rowHeight;
  const areaW = footprintW * cellW;
  const areaH = footprintH * metrics.rowHeight;

  // Ground Point = 占据区域底部中心,往上偏移 4px(脚底嵌入地面)
  const groundY = areaTop + areaH - 4;
  const groundX = areaLeft + areaW / 2;

  return { x: groundX, y: groundY };
}

// ──── 核心 2: 自动基础缩放 ────

/**
 * 计算基础缩放系数.
 * 目标宽度 ≈ cellWidth × 0.76
 * 高度允许超出格子(人物向上伸出),但有上限保护
 */
export function calculateBaseScale(
  spriteWidth: number,
  spriteHeight: number,
  cellW: number,
  cellH: number,
): number {
  if (spriteWidth <= 0 || spriteHeight <= 0) return 1.0;

  const targetW = cellW * DEFENDER_UNIT_WIDTH_RATIO;
  const targetH = cellH * MAX_HEIGHT_OVERFLOW_RATIO;

  const scaleX = targetW / spriteWidth;
  const scaleY = targetH / spriteHeight;

  return Math.max(0.3, Math.min(scaleX, scaleY));
}

// ──── 核心 3: 统一 Placement 函数 ────

/**
 * 统一入口:计算一个精灵在棋盘上的最终位置/缩放/深度.
 *
 * 执行流程:
 *   1. getCellGroundPoint() → 地面落点
 *   2. calculateBaseScale() → 基础缩放
 *   3. × meta.artScale → 最终缩放
 *   4. 应用 bottom-center pivot
 *   5. 应用 groundOffset 微调
 *   6. 计算 depth (基于 groundY)
 */
export function placeSprite(params: {
  row: number;
  col: number;
  gridType: GridType;
  meta: SpriteMeta;
  metrics: CellMetrics;
  spriteWidth?: number;
  spriteHeight?: number;
}): PlacementResult {
  const { row, col, gridType, meta, metrics, spriteWidth, spriteHeight } = params;

  const cellW = gridType === 'defense' ? metrics.defenseCellWidth : metrics.battlefieldCellWidth;
  const cellH = metrics.rowHeight;
  const widthRatio = gridType === 'defense' ? DEFENDER_UNIT_WIDTH_RATIO : BATTLEFIELD_UNIT_WIDTH_RATIO;

  // Step 1: Ground Point
  const ground = getCellGroundPoint(row, col, gridType, metrics, meta.footprintW, meta.footprintH);

  // Step 2-3: Scale
  const sw = spriteWidth ?? cellW * 0.8;
  const sh = spriteHeight ?? cellH * 0.9;
  const baseScale = calculateBaseScale(sw, sh, cellW, cellH);
  const finalScale = baseScale * meta.artScale;

  // Step 4-5: Position with pivot & offset
  const finalX = ground.x + (meta.groundOffsetX ?? 0);
  const finalY = ground.y + (meta.groundOffsetY ?? 0);

  // Step 6: Depth (越靠下=越大=画在上层)
  const depth = worldDepthForGround(ground.y, meta.depthBias ?? 0);

  // Display size for fitSprite
  const displayWidth = cellW * meta.footprintW * widthRatio * meta.artScale;
  const displayHeight = cellH * meta.footprintH * MAX_HEIGHT_OVERFLOW_RATIO * meta.artScale;

  return {
    x: finalX,
    y: finalY,
    scale: finalScale,
    depth,
    originX: meta.pivotX,
    originY: meta.pivotY,
    displayWidth,
    displayHeight,
    groundX: ground.x,
    groundY: ground.y,
  };
}

// ──── 快捷方法 ────

/** Defender 专用:防守区,总是 1x1 */
export function placeDefender(row: number, col: number, metrics: CellMetrics, meta?: SpriteMeta): PlacementResult {
  return placeSprite({
    row, col,
    gridType: 'defense',
    meta: meta ?? { id: 'defender-default', footprintW: 1, footprintH: 1, pivotX: 0.5, pivotY: 1.0, artScale: 1.0 },
    metrics,
  });
}

/** Enemy 专用:战场区,支持 1x1 和 2x2 */
export function placeEnemy(
  row: number, col: number, width: number, height: number,
  metrics: CellMetrics, meta?: SpriteMeta,
): PlacementResult {
  const effectiveMeta = meta ?? {
    id: 'enemy-default',
    footprintW: width,
    footprintH: height,
    pivotX: 0.5,
    pivotY: 1.0,
    artScale: 1.0,
  };
  return placeSprite({
    row, col,
    gridType: 'battlefield',
    meta: { ...effectiveMeta, footprintW: width, footprintH: height },
    metrics,
  });
}
