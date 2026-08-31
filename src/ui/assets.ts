/** Every playable visual tier. Values above 8192 intentionally use 8192 art as a fallback. */
export const PLANT_VALUES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192] as const;
const DEFENDER_VALUES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096] as const;

/** Stable PNG art contract. Graybox shapes remain until these paths are supplied. */
export const ART = {
  /** Approved Production Defender bodies. 8192+ intentionally reuse 4096 art. */
  defenders: {
    1: 'assets/production/defenders/defender_001_pen.png',
    2: 'assets/production/defenders/defender_002_glue.png',
    4: 'assets/production/defenders/defender_004_fan.png',
    8: 'assets/production/defenders/defender_008_thermos.png',
    16: 'assets/production/defenders/defender_016_energy.png',
    32: 'assets/production/defenders/defender_032_stapler.png',
    64: 'assets/production/defenders/defender_064_spray.png',
    128: 'assets/production/defenders/defender_128_phone_stand.png',
    256: 'assets/production/defenders/defender_256_laptop.png',
    512: 'assets/production/defenders/defender_512_monitor.png',
    1024: 'assets/production/defenders/defender_1024_printer.png',
    2048: 'assets/production/defenders/defender_2048_shredder.png',
    4096: 'assets/production/defenders/defender_4096_workstation_core.png',
  } as Record<(typeof DEFENDER_VALUES)[number], string>,
  /** TEMP / EXPERIENCE ONLY — original office-pressure placeholders, not Production art. */
  tempExperienceEnemies: {
    // PNG runtime copies keep the original SVG source beside them. This avoids
    // Phaser/WebView SVG texture decoding differences during Android trials.
    basic01: 'assets/temp/experience-enemies/enemy_temp_kpi_agent.png',
    basic02: 'assets/temp/experience-enemies/enemy_temp_meeting_proxy.png',
    basic03: 'assets/temp/experience-enemies/enemy_temp_approval_drone.png',
    large01: 'assets/temp/experience-enemies/enemy_temp_overtime_system_large.png',
  },
  enemies: { basic01: 'assets/enemies/enemy_basic_01.png', basic02: 'assets/enemies/enemy_basic_02.png', large01: 'assets/enemies/enemy_large_01.png' },
  rewards: Object.fromEntries([1, 2, 4, 8].map(value => [value, `assets/rewards/reward_${value}.png`])),
  /**
   * Moyu Economy V2 keeps projectile presentation entirely separate from
   * damage/collision rules.  Each defender has one right-facing visual.
   */
  projectiles: {
    1: 'assets/projectiles/moyu-v2/projectile_001_pen.png',
    2: 'assets/projectiles/moyu-v2/projectile_002_glue.png',
    4: 'assets/projectiles/moyu-v2/projectile_004_fan.png',
    8: 'assets/projectiles/moyu-v2/projectile_008_thermos.png',
    16: 'assets/projectiles/moyu-v2/projectile_016_energy.png',
    32: 'assets/projectiles/moyu-v2/projectile_032_staple.png',
    64: 'assets/projectiles/moyu-v2/projectile_064_spray.png',
    128: 'assets/projectiles/moyu-v2/projectile_128_signal.png',
    256: 'assets/projectiles/moyu-v2/projectile_256_data.png',
    512: 'assets/projectiles/moyu-v2/projectile_512_screen.png',
    1024: 'assets/projectiles/moyu-v2/projectile_1024_paper.png',
    2048: 'assets/projectiles/moyu-v2/projectile_2048_shred.png',
    4096: 'assets/projectiles/moyu-v2/projectile_4096_core.png',
  },
  moyuIcon: 'assets/ui/moyu_icon.png',
  backgrounds: { battlefieldV0: 'assets/backgrounds/battlefield_v0.png' },
  tiles: { battlefield: 'assets/tiles/battlefield_cell_v1.png', defense: 'assets/tiles/defense_cell_v1.png', birthSlot: 'assets/ui/birth_slot.png' },
} as const;
