/** Every playable visual tier. Values above 8192 intentionally use 8192 art as a fallback. */
export const PLANT_VALUES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192] as const;

/** Stable PNG art contract. Graybox shapes remain until these paths are supplied. */
export const ART = {
  plants: Object.fromEntries(PLANT_VALUES.map(value => [value, `assets/plants/plant_${String(value).padStart(3, '0')}.png`])),
  enemies: { basic01: 'assets/enemies/enemy_basic_01.png', basic02: 'assets/enemies/enemy_basic_02.png', large01: 'assets/enemies/enemy_large_01.png' },
  rewards: Object.fromEntries([1, 2, 4, 8].map(value => [value, `assets/rewards/reward_${value}.png`])),
  projectile: 'assets/projectiles/projectile.png',
  backgrounds: { battlefieldV0: 'assets/backgrounds/battlefield_v0.png' },
  tiles: { battlefield: 'assets/tiles/battlefield_cell_v1.png', defense: 'assets/tiles/defense_cell_v1.png', birthSlot: 'assets/ui/birth_slot.png' },
} as const;
