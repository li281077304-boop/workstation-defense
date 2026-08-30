/**
 * ENDLESS_CURVE_V1 — formula-driven difficulty (pure functions, unit-testable).
 *
 * Design contract (see PROJECT_HANDOFF.md / DIFFICULTY.md):
 * - Enemy HP grows only with Turn: base = 0.16 * T^1.62, ±15% random at spawn.
 * - Threat Budget: a 10-turn rolling allowance of 2.5 * T^0.53, spent via a
 *   budget bank with a per-turn spend cap (no rubber-banding to player power).
 * - Reward max follows the player's highest plant (÷4, power of two), capped by
 *   the hard limit; reward chance decays gently from ~85% to ~65%.
 * - 2×2 enemies unlock by Turn linearly 0 → 25% (T 20..100), HP only +10% vs normal.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Base HP for a normal 1×1 enemy at turn T (T >= 1). Reference: T1≈1, T10≈7, T50≈91, T100≈278, T200≈855. */
export function baseEnemyHp(turn: number): number {
  const t = Math.max(1, turn);
  return Math.max(1, Math.round(0.16 * Math.pow(t, 1.62)));
}

/** Actual HP for a spawned enemy, one random roll (0.85..1.15) applied exactly once. */
export function enemyHpFor(turn: number, hpMultiplier: number, random: () => number): number {
  const base = baseEnemyHp(turn) * hpMultiplier;
  const variance = 0.85 + random() * 0.3; // 0.85 .. 1.15
  return Math.max(1, Math.round(base * variance));
}

/** Total enemy cost budget over a 10-turn window at turn T. Reference: T5≈6, T10≈8, T50≈20, T100≈29, T200≈41. */
export function threatBudget10(turn: number, budgetMultiplier: number): number {
  const t = Math.max(1, turn);
  return 2.5 * Math.pow(t, 0.53) * budgetMultiplier;
}

/** Per-turn budget accrual: budget10 / 10 (accumulated in the bank). */
export function perTurnBudget(turn: number, budgetMultiplier: number): number {
  return threatBudget10(turn, budgetMultiplier) / 10;
}

/**
 * Reward value ceiling for a given highest plant, power of two, capped by the
 * hard natural limit. HighestPlant 1→1, 2→1, 4→1, 8→2, 16→4, 32→8, 64→16, 128→32.
 */
export function rewardMaxFor(highestPlantValue: number, maxNaturalSpawnValue: number): number {
  const desired = Math.max(1, highestPlantValue / 4);
  const powerOfTwo = 2 ** Math.floor(Math.log2(desired));
  return Math.min(maxNaturalSpawnValue, Math.max(1, powerOfTwo));
}

/** Probability a reward ball appears on a given turn. ~85% early → ~65% late. */
export function rewardChanceFor(turn: number): number {
  const t = Math.max(1, turn);
  return 0.65 + 0.20 * Math.exp(-t / 40);
}

/** 2×2 large-enemy spawn chance by turn: 0 before T20, ramps to 25% by T100, stays 25%. */
export function largeEnemyChanceFor(turn: number): number {
  const t = Math.max(1, turn);
  return clamp(((t - 20) / 80) * 0.25, 0, 0.25);
}

/** Large-enemy HP: normal base × multiplier (default 1.10), then the same ±15% roll. */
export function largeEnemyHpFor(turn: number, hpMultiplier: number, largeMultiplier: number, random: () => number): number {
  const base = baseEnemyHp(turn) * hpMultiplier * largeMultiplier;
  const variance = 0.85 + random() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

/* ═══════════════ REWARD_ECONOMY_CURVE_V2 ═══════════════
 * Difficulty is derived BACKWARD from the reward economy, because RewardBall
 * is the player's ONLY source of new power (merging never increases board
 * power). Enemy strength never reads the player's actual power — it follows a
 * STANDARD player growth curve. If the real player out-captures the curve they
 * pull ahead; if they miss balls the curve catches up. That is the endless loop.
 */

/** Default fraction of generated reward value a standard player captures. */
export const BASELINE_CAPTURE_RATE = 0.45;

/**
 * V2 unlocks natural rewards in four deliberate bands. Dynamic weights then
 * operate only inside this allowed set; a value can never appear early just
 * because its probability is non-zero in the eventual full pool.
 */
export function rewardMaxByTurn(turn: number, hardCap = 8): number {
  const t = Math.max(1, turn);
  return Math.min(hardCap, 2 ** Math.floor((t - 1) / 20));
}

export type RewardWeightOptions = {
  /** Late-game exponent ceiling. 0.70 yields 33/27/22/18 for 1/2/4/8. */
  alphaMax?: number;
  /** Turns needed to approach the late-game distribution at progression 1. */
  rewardWeightTau?: number;
  /** Higher means higher-value balls arrive sooner; it rescales tau only. */
  rewardProgression?: number;
};

export const DEFAULT_REWARD_WEIGHT_OPTIONS: Required<RewardWeightOptions> = Object.freeze({
  alphaMax: 0.70,
  rewardWeightTau: 100,
  rewardProgression: 1.0,
});

/** alpha(T) = alphaMax × (1 − exp(−T / (tau / progression))). */
export function rewardWeightAlpha(turn: number, options: RewardWeightOptions = {}): number {
  const alphaMax = options.alphaMax ?? DEFAULT_REWARD_WEIGHT_OPTIONS.alphaMax;
  const progression = Math.max(0.01, options.rewardProgression ?? DEFAULT_REWARD_WEIGHT_OPTIONS.rewardProgression);
  const tau = Math.max(1, (options.rewardWeightTau ?? DEFAULT_REWARD_WEIGHT_OPTIONS.rewardWeightTau) / progression);
  return alphaMax * (1 - Math.exp(-Math.max(1, turn) / tau));
}

/**
 * Dynamic natural-reward distribution inside the values unlocked at this turn.
 * value ^ (alpha(T) - 1) starts near 1/value and slowly moves toward higher
 * values without ever removing 1s once it has been unlocked.
 */
export function rewardValueWeights(turn: number, hardCap = 8, options: RewardWeightOptions = {}): Map<number, number> {
  const max = rewardMaxByTurn(turn, hardCap);
  const allowed = [1, 2, 4, 8].filter(v => v <= max);
  const alpha = rewardWeightAlpha(turn, options);
  const raw = new Map<number, number>(allowed.map(v => [v, Math.pow(v, alpha - 1)]));
  const total = [...raw.values()].reduce((sum, w) => sum + w, 0);
  for (const [v, w] of raw) raw.set(v, w / total);
  return raw;
}

/** Expected plant power of a standard player at turn T:
 * 2 (opening) + captureRate × cumulative expected generated reward value. */
export function expectedPlantPower(turn: number, cumulativeExpectedGeneratedReward: number, captureRate = BASELINE_CAPTURE_RATE): number {
  return 2 + captureRate * cumulativeExpectedGeneratedReward;
}

/** Difficulty factor: 0.45 + 0.20 × (1 − exp(−T/150)) → approaches 0.65. */
export function difficultyFactor(turn: number): number {
  const t = Math.max(1, turn);
  return 0.45 + 0.20 * (1 - Math.exp(-t / 150));
}

/** Per-turn enemy HP income budget = expected power × difficulty factor. */
export function hpIncomeBudget(turn: number, cumulativeExpectedGeneratedReward: number, captureRate = BASELINE_CAPTURE_RATE): number {
  return expectedPlantPower(turn, cumulativeExpectedGeneratedReward, captureRate) * difficultyFactor(turn);
}

/** Target HP for a normal 1×1 enemy: expected power × 0.9, then ±15% at spawn. */
export function normalEnemyTargetHp(turn: number, cumulativeExpectedGeneratedReward: number, captureRate = BASELINE_CAPTURE_RATE): number {
  return expectedPlantPower(turn, cumulativeExpectedGeneratedReward, captureRate) * 0.9;
}

/** Actual normal enemy HP with one ±15% roll. */
export function normalEnemyHp(turn: number, cumulativeExpectedGeneratedReward: number, random: () => number, captureRate = BASELINE_CAPTURE_RATE): number {
  const base = normalEnemyTargetHp(turn, cumulativeExpectedGeneratedReward, captureRate);
  const variance = 0.85 + random() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

/** 2×2 enemy HP: normal target × 1.1, same ±15% roll. */
export function largeEnemyHpV2(turn: number, cumulativeExpectedGeneratedReward: number, random: () => number, captureRate = BASELINE_CAPTURE_RATE): number {
  const base = normalEnemyTargetHp(turn, cumulativeExpectedGeneratedReward, captureRate) * 1.1;
  const variance = 0.85 + random() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

/** Spawn budget cost of an enemy: 1×1 = 1, 2×2 = 1.8 (space/lane pressure, not HP). */
export function enemySpawnCostV2(size: 1 | 2): number {
  return size === 2 ? 1.8 : 1.0;
}

/** Expected value of ONE natural reward ball at turn T, using the 1/2^k weights. */
export function expectedSingleRewardValue(turn: number, hardCap = 8, options: RewardWeightOptions = {}): number {
  const weights = rewardValueWeights(turn, hardCap, options);
  let sum = 0;
  for (const [v, w] of weights) sum += v * w;
  return sum;
}

/** Expected generated reward value over one turn = chance × expected single ball value. */
export function expectedRewardPerTurn(turn: number, spawnChance: number, hardCap = 8, options: RewardWeightOptions = {}): number {
  return spawnChance * expectedSingleRewardValue(turn, hardCap, options);
}

/** Cumulative expected generated reward from turn 1..T (standard player assumption). */
export function cumulativeExpectedGeneratedReward(turn: number, spawnChance: number, hardCap = 8, options: RewardWeightOptions = {}): number {
  let acc = 0;
  for (let t = 1; t <= Math.max(1, turn); t++) acc += expectedRewardPerTurn(t, spawnChance, hardCap, options);
  return acc;
}

/**
 * Moyu Economy V2 has no free-floating RewardBall. A standard economy tick is
 * one carrier opportunity: carrier chance × the stage's weighted drop value.
 * Keeping this pure avoids the enemy director reading the player's real board.
 */
export type MoyuValueStage = { startTurn: number; values: number[]; weights: number[] };

export function moyuStageForTurn(turn: number, stages: readonly MoyuValueStage[]): MoyuValueStage {
  if (!stages.length) throw new Error('Moyu economy requires at least one value stage');
  return [...stages].reverse().find(stage => Math.max(1, turn) >= stage.startTurn) ?? stages[0];
}

export function expectedMoyuValueForTurn(turn: number, carrierChance: number, stages: readonly MoyuValueStage[]): number {
  const stage = moyuStageForTurn(turn, stages);
  const weightTotal = stage.weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) return 0;
  const weightedValue = stage.values.reduce((sum, value, index) => sum + value * (stage.weights[index] ?? 0), 0) / weightTotal;
  return Math.max(0, carrierChance) * weightedValue;
}

export function cumulativeExpectedMoyuValue(turn: number, carrierChance: number, stages: readonly MoyuValueStage[]): number {
  let total = 0;
  for (let t = 1; t <= Math.max(1, turn); t++) total += expectedMoyuValueForTurn(t, carrierChance, stages);
  return total;
}
