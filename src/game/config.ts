/** Intentionally explicit: every unconfirmed battle behaviour lives here. */
export type DifficultyConfig = {
  maxNaturalSpawnValue: number;
  naturalSpawnValues: number[];
  /** Exact cadence and health curve are unconfirmed; the current default is documented in CONFIG_BOUNDARIES.md. */
  automaticEnemySpawning: boolean;
  showMultikillFeedback: boolean;
  /** Per-turn probability of a new enemy spawning (0..1). 1 = every turn. */
  enemySpawnChance: number;
  /** Maximum enemy spawn attempts in one turn. */
  enemiesPerTurn: number;
  /** Base HP for a fresh 1x1 enemy. */
  enemyHpBase: number;
  /** HP added per turn beyond the first (linear growth). */
  enemyHpGrowthPerTurn: number;
  /** Maximum simultaneous enemies. */
  enemyCap: number;
  /** Large-enemy chance ramps from zero at unlock to full chance at fullChanceScore. */
  largeEnemyUnlockScore: number;
  largeEnemyFullChanceScore: number;
  /** Chance for a spawned enemy to be large after it unlocks. */
  largeEnemySpawnChance: number;
  largeEnemyHpMultiplier: number;
  normalEnemyMaxRequiredUtilization: number;
  largeEnemyMaxRequiredUtilization: number;
  targetPressureMin: number;
  targetPressureMax: number;
  softPressureCap: number;
  hardPressureCap: number;
  /** Whether reward balls appear naturally on the battlefield. */
  rewardSpawning: boolean;
  /** Per-turn probability of a reward ball appearing (0..1). */
  rewardSpawnChance: number;
  /** Relative occurrence weights for each permitted reward value. */
  rewardWeights: Record<number, number>;
  startingPlantRows: number[];
  startingPlantValue: number;
  openingEnemy: { row: number; col: number; hp: number };
  openingReward: { row: number; col: number; value: number };
  metricsLogging: boolean;
  metricsWindowTurns: number;
  targetPressureRatio: number;
  /** Score mode: 'damage' = 1 point per actual HP of damage dealt; 'kill' = maxHp at kill. */
  scoreMode: 'damage' | 'kill';
  /** Moyu Economy V2: chance that a legal enemy carries a currency drop. */
  moyuCarrierChance: number;
  /** Three-value pools by turn band. Older reward-ball fields remain only for migration compatibility. */
  moyuValueStages: Array<{ startTurn: number; values: number[]; weights: number[] }>;
};

export const DifficultyConfig: DifficultyConfig = {
  maxNaturalSpawnValue: 8,
  naturalSpawnValues: [1, 2, 4, 8],
  automaticEnemySpawning: true,
  showMultikillFeedback: true,
  enemySpawnChance: 0.45,
  enemiesPerTurn: 1,
  enemyHpBase: 4,
  enemyHpGrowthPerTurn: 0.35,
  enemyCap: 4,
  largeEnemyUnlockScore: 100,
  largeEnemyFullChanceScore: 800,
  largeEnemySpawnChance: 0.08,
  largeEnemyHpMultiplier: 1.15,
  normalEnemyMaxRequiredUtilization: 0.55,
  largeEnemyMaxRequiredUtilization: 0.60,
  targetPressureMin: 0.45,
  targetPressureMax: 0.65,
  softPressureCap: 0.70,
  hardPressureCap: 0.75,
  rewardSpawning: true,
  rewardSpawnChance: 0.4,
  rewardWeights: { 1: 45, 2: 30, 4: 18, 8: 7, 16: 5, 32: 3, 64: 2 },
  startingPlantRows: [1, 3],
  startingPlantValue: 1,
  openingEnemy: { row: 1, col: 9, hp: 4 },
  openingReward: { row: 0, col: 9, value: 1 },
  metricsLogging: false,
  metricsWindowTurns: 10,
  targetPressureRatio: 0.58,
  scoreMode: 'damage',
  moyuCarrierChance: 0.80,
  moyuValueStages: [
    { startTurn: 1, values: [1, 2, 4], weights: [0.20, 0.55, 0.25] },
    { startTurn: 16, values: [2, 4, 8], weights: [0.20, 0.55, 0.25] },
    { startTurn: 36, values: [4, 8, 16], weights: [0.20, 0.55, 0.25] },
    { startTurn: 61, values: [8, 16, 32], weights: [0.20, 0.55, 0.25] },
    { startTurn: 101, values: [16, 32, 64], weights: [0.20, 0.55, 0.25] },
  ],
};

/** The highest defender value currently available to the player. */
export const MAX_DEFENDER_VALUE = 4096;

/** Fixed opening board: four 1-value Defenders, spread across five lanes. */
export const STARTING_DEFENDER_LAYOUT = [
  { row: 0, col: 0, value: 1 },
  { row: 1, col: 0, value: 1 },
  { row: 3, col: 0, value: 1 },
  { row: 4, col: 0, value: 1 },
] as const;

/** Approved playable configuration captured after the 2,510-score playtest. */
export const PLAYABLE_BASELINE_V1: Readonly<DifficultyConfig> = Object.freeze(structuredClone(DifficultyConfig));

/** Restores all live tuning fields after temporary local Debug Panel experiments. */
export function restorePlayableBaselineV1() {
  Object.assign(DifficultyConfig, structuredClone(PLAYABLE_BASELINE_V1));
}

/* ───────────────── ENDLESS_CURVE_V1 ─────────────────
 * Formula-driven difficulty. The ONLY manual tuning knobs are:
 *   hpMultiplier      (怪太硬 → 0.9)
 *   budgetMultiplier  (怪太少 → 1.1)
 *   rewardMultiplier  (球太少 → 1.1)
 * Everything else derives from Turn via formulas in difficulty.ts.
 * There is NO rubber-banding: enemy strength depends only on Turn, never on
 * the player's current plant power. PressureRatio etc. are diagnostics only.
 */
export type EndlessCurveConfig = {
  hpMultiplier: number;
  budgetMultiplier: number;
  rewardMultiplier: number;
  /** Hard cap on natural reward value (already confirmed = 8). */
  maxNaturalSpawnValue: number;
  /** Max enemy cost spent in a single turn (smooths spikes). */
  maxSpendPerTurn: number;
  /** Maximum simultaneous enemies. */
  enemyCap: number;
  /** 2×2 HP = normalBase × this (default 1.10). */
  largeEnemyHpMultiplier: number;
  /** Score mode kept consistent with the rest of the game. */
  scoreMode: 'damage' | 'kill';
  automaticEnemySpawning: boolean;
  rewardSpawning: boolean;
  showMultikillFeedback: boolean;
  metricsLogging: boolean;
  metricsWindowTurns: number;
};

export const ENDLESS_CURVE_V1: Readonly<EndlessCurveConfig> = Object.freeze({
  hpMultiplier: 1.0,
  budgetMultiplier: 1.0,
  rewardMultiplier: 1.0,
  maxNaturalSpawnValue: 8,
  maxSpendPerTurn: 6,
  enemyCap: 10,
  largeEnemyHpMultiplier: 1.10,
  scoreMode: 'damage',
  automaticEnemySpawning: true,
  rewardSpawning: true,
  showMultikillFeedback: true,
  metricsLogging: false,
  metricsWindowTurns: 10,
});

/** Which difficulty system the game engine uses. */
export type DifficultyMode = 'baseline' | 'endless-curve' | 'reward-economy';

/** Live switch — Debug Panel toggles this. Default: the new reward-economy system. */
export const ACTIVE_DIFFICULTY: { mode: DifficultyMode } = { mode: 'reward-economy' };

/* ───────────────── REWARD_ECONOMY_CURVE_V2 ─────────────────
 * Difficulty derived BACKWARD from the reward economy.
 * RewardBall is the player's ONLY source of new power (merging never adds
 * board power), so the enemy curve follows a STANDARD player growth curve:
 *   expectedPower(T) = 2 + 0.45 × cumulativeExpectedGeneratedReward
 *   difficultyFactor(T) = 0.45 + 0.20(1 − exp(−T/150))
 *   enemyHpIncomeBudget(T) = expectedPower(T) × difficultyFactor(T)
 * Spawn director spends hpBudgetBank; individual enemy HP ≈ expectedPower × 0.9.
 * Enemy never reads the player's ACTUAL power — no rubber-banding.
 */
export type RewardEconomyConfig = {
  /** Reward spawn chance per turn (0.80). */
  rewardSpawnChance: number;
  /** Bad-luck protection: force a reward after N dry turns. */
  rewardForceAfterDryTurns: number;
  /** Hard cap on natural reward value (confirmed = 8). */
  maxNaturalSpawnValue: number;
  /** Max enemy HP budget spent in one turn (smooths spikes). */
  maxSpendPerTurn: number;
  /** Maximum simultaneous enemies. */
  enemyCap: number;
  /** Standard-player reward capture rate used by the expected-power curve. */
  baselineCaptureRate: number;
  /** Captured → actually-placed conversion factor (first version = 1.0). */
  rewardRealizationFactor: number;
  /** Score mode kept consistent with the rest of the game. */
  scoreMode: 'damage' | 'kill';
  automaticEnemySpawning: boolean;
  rewardSpawning: boolean;
  showMultikillFeedback: boolean;
  metricsLogging: boolean;
  metricsWindowTurns: number;
  /** Carrier/drop rules are intentionally independent from enemy HP. */
  moyuCarrierChance: number;
  moyuValueStages: Array<{ startTurn: number; values: number[]; weights: number[] }>;
};

export const REWARD_ECONOMY_CURVE_V2: Readonly<RewardEconomyConfig> = Object.freeze({
  rewardSpawnChance: 0.80,
  rewardForceAfterDryTurns: 1,
  maxNaturalSpawnValue: 8,
  maxSpendPerTurn: 8,
  enemyCap: 12,
  baselineCaptureRate: 0.45,
  rewardRealizationFactor: 1.0,
  scoreMode: 'damage',
  automaticEnemySpawning: true,
  rewardSpawning: true,
  showMultikillFeedback: true,
  metricsLogging: false,
  metricsWindowTurns: 10,
  moyuCarrierChance: 0.80,
  moyuValueStages: [
    { startTurn: 1, values: [1, 2, 4], weights: [0.20, 0.55, 0.25] },
    { startTurn: 16, values: [2, 4, 8], weights: [0.20, 0.55, 0.25] },
    { startTurn: 36, values: [4, 8, 16], weights: [0.20, 0.55, 0.25] },
    { startTurn: 61, values: [8, 16, 32], weights: [0.20, 0.55, 0.25] },
    { startTurn: 101, values: [16, 32, 64], weights: [0.20, 0.55, 0.25] },
  ],
});

/**
 * BALANCED_V1 — approved playable reference: score 206,102 / Turn 574 /
 * highest plant 512. This locks the normal V2 output valves without changing
 * the underlying reward-economy formulas.
 */
export type BalancedV1Config = {
  enemyVolumeMultiplier: number;
  enemyHpMultiplier: number;
  rewardRateMultiplier: number;
  largeEnemyRateMultiplier: number;
  enemyCountCap: number;
  baselineCaptureRate: number;
  rewardProgression: number;
  highValueBias: number;
};

export const BALANCED_V1: Readonly<BalancedV1Config> = Object.freeze({
  enemyVolumeMultiplier: 0.4,
  enemyHpMultiplier: 1.0,
  rewardRateMultiplier: 1.0,
  largeEnemyRateMultiplier: 1.0,
  enemyCountCap: 10,
  baselineCaptureRate: 0.45,
  rewardProgression: 1.0,
  highValueBias: 0.70,
});

/**
 * Debug-adjustable output valves for the BALANCED_V1 reward-economy mode.
 *
 * These do not change the standard-player economy formulas above. They only
 * control how much of the resulting pressure is allowed onto the battlefield
 * while the tuning panel is available in a local build.
 */
export type RewardEconomyTestControls = {
  enemyVolumeMultiplier: number;
  enemyHpMultiplier: number;
  rewardRateMultiplier: number;
  largeEnemyRateMultiplier: number;
  enemyCountCap: number;
  /** Standard-player assumption; changes V2 expected power, never real captures. */
  baselineCaptureRate: number;
  /** Higher values make the reward-value distribution mature sooner. */
  rewardProgression: number;
  /** Late-game high-value reward bias (alphaMax). */
  highValueBias: number;
};

/** Compatibility name used by the existing Debug Panel. */
export const REWARD_ECONOMY_TEST_DEFAULTS: Readonly<RewardEconomyTestControls> = BALANCED_V1;

/** Mutable only through the localhost Difficulty Debug panel. */
export const REWARD_ECONOMY_TEST_CONTROLS: RewardEconomyTestControls = { ...REWARD_ECONOMY_TEST_DEFAULTS };

export const REWARD_ECONOMY_VOLUME_PRESETS = Object.freeze({
  EASY_VOLUME: 0.6,
  NORMAL_VOLUME: 0.8,
  HARD_VOLUME: 1.0,
});

export function restoreRewardEconomyTestDefaults() {
  Object.assign(REWARD_ECONOMY_TEST_CONTROLS, BALANCED_V1);
}

/** Explicit restore entry for regression tests and player-facing copy. */
export const restoreBalancedV1 = restoreRewardEconomyTestDefaults;

/** Compatibility alias used by the game engine. Edit DifficultyConfig, not scattered constants. */
export const DEFAULT_RULES = DifficultyConfig;
export type CombatRules = DifficultyConfig;

/** Reward ceiling is two merge tiers below the player's strongest plant. */
export function maxRewardValueFor(highestPlantValue: number): number {
  return Math.max(1, 2 ** Math.max(0, Math.floor(Math.log2(highestPlantValue)) - 2));
}

/** Smoothly ramps large-enemy chance instead of jumping at one score threshold. */
export function largeEnemyChanceFor(score: number, config: Pick<DifficultyConfig, 'largeEnemyUnlockScore' | 'largeEnemyFullChanceScore' | 'largeEnemySpawnChance'> = DifficultyConfig): number {
  if (score < config.largeEnemyUnlockScore) return 0;
  if (score >= config.largeEnemyFullChanceScore) return config.largeEnemySpawnChance;
  return config.largeEnemySpawnChance * (score - config.largeEnemyUnlockScore) / Math.max(1, config.largeEnemyFullChanceScore - config.largeEnemyUnlockScore);
}

export const BOARD = { rows: 5, defenseCols: 2, battlefieldCols: 10 };
