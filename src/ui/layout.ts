/** Android landscape V1 design space. Phaser scales this 1920 × 1080 layout to the device. */
export const MOBILE_LAYOUT = {
  width: 1920, height: 1080,
  // The 2×5 defense grid keeps its original cell size. Extra left-side space
  // is deliberately reserved for the tall Spawn Slot, not empty letterboxing.
  board: {
    defenseLeft: 220,
    battlefieldLeft: 570,
    top: 150,
    defenseCellWidth: 160,
    battlefieldCellWidth: 130,
    rows: 5,
    defenseColumns: 2,
    logicalBattlefieldColumns: 10,
    rowHeight: 176,
  },
  spawnSlot: { left: 45, width: 150, centerY: 590, height: 480 },
  /** Separate disposal control; it is UI, never a logical Board cell. */
  dismissSlot: { left: 45, top: 858, width: 150, height: 150 },
  header: { scoreY: 36, settingsX: 1834 },
} as const;
