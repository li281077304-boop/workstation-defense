import { describe, expect, it } from 'vitest';
import {
  baseEnemyHp, enemyHpFor, threatBudget10, perTurnBudget,
  rewardMaxFor, rewardChanceFor, largeEnemyChanceFor, largeEnemyHpFor, clamp,
  rewardMaxByTurn, rewardValueWeights, rewardWeightAlpha, expectedSingleRewardValue,
  expectedRewardPerTurn, cumulativeExpectedGeneratedReward, expectedPlantPower,
  difficultyFactor, hpIncomeBudget, normalEnemyTargetHp, normalEnemyHp,
  largeEnemyHpV2, enemySpawnCostV2, BASELINE_CAPTURE_RATE,
} from '../src/game/difficulty';
import { BALANCED_V1, REWARD_ECONOMY_CURVE_V2 } from '../src/game/config';

describe('ENDLESS_CURVE_V1 formulas', () => {
  it('baseEnemyHp matches reference curve (HANDOFF: T1≈1, T5≈2, T10≈7, T20≈20, T50≈91, T100≈278, T200≈855)', () => {
    const expected: Array<[number, number]> = [[1, 1], [5, 2], [10, 7], [20, 20], [50, 91], [100, 278], [200, 855]];
    for (const [turn, ref] of expected) {
      const value = baseEnemyHp(turn);
      // ±15% tolerance around the reference (plus rounding)
      const tolerance = Math.max(1, Math.round(ref * 0.15));
      expect(Math.abs(value - ref)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('enemyHpFor applies hpMultiplier and a single ±15% random roll', () => {
    // random()=0 → variance 0.85 (floor); random()=1 → variance 1.15 (ceil)
    const turn10 = baseEnemyHp(10); // ≈7
    const low = enemyHpFor(10, 1.0, () => 0);
    const high = enemyHpFor(10, 1.0, () => 1);
    expect(low).toBeLessThanOrEqual(high);
    expect(low).toBeGreaterThanOrEqual(Math.max(1, Math.round(turn10 * 0.85) - 1));
    expect(high).toBeLessThanOrEqual(Math.round(turn10 * 1.15) + 1);
    // multiplier scales the base
    expect(enemyHpFor(10, 2.0, () => 0.5)).toBeGreaterThanOrEqual(enemyHpFor(10, 1.0, () => 0.5));
  });

  it('threatBudget10 matches reference (T5≈6, T10≈8, T20≈12, T50≈20, T100≈29, T200≈41)', () => {
    const expected: Array<[number, number]> = [[5, 6], [10, 8], [20, 12], [50, 20], [100, 29], [200, 41]];
    for (const [turn, ref] of expected) {
      const value = threatBudget10(turn, 1.0);
      expect(Math.abs(value - ref)).toBeLessThanOrEqual(2);
    }
  });

  it('perTurnBudget accrues one tenth of the 10-turn budget', () => {
    expect(perTurnBudget(10, 1.0)).toBeCloseTo(threatBudget10(10, 1.0) / 10, 5);
  });

  it('rewardMaxFor follows highest plant ÷4, power of two, capped by hard limit', () => {
    const hardLimit = 8;
    const cases: Array<[number, number]> = [[1, 1], [2, 1], [4, 1], [8, 2], [16, 4], [32, 8], [64, 8], [128, 8]]; // capped at 8
    for (const [plant, ref] of cases) expect(rewardMaxFor(plant, hardLimit)).toBe(ref);
    // Without the hard cap the formula is plant/4 → power of two
    expect(rewardMaxFor(64, 64)).toBe(16);
    expect(rewardMaxFor(128, 128)).toBe(32);
    expect(rewardMaxFor(512, 512)).toBe(128);
  });

  it('rewardChanceFor decays from ~85% early to ~65% late', () => {
    expect(rewardChanceFor(1)).toBeCloseTo(0.65 + 0.20 * Math.exp(-1 / 40), 3); // ≈0.845
    expect(rewardChanceFor(40)).toBeCloseTo(0.65 + 0.20 * Math.exp(-1), 3);      // ≈0.724
    expect(rewardChanceFor(200)).toBeCloseTo(0.65 + 0.20 * Math.exp(-5), 3);     // ≈0.651
    expect(rewardChanceFor(1)).toBeGreaterThan(rewardChanceFor(200));
  });

  it('largeEnemyChanceFor: T1→0, T20→0, T60→~12.5%, T100→25%, T200→25%', () => {
    expect(largeEnemyChanceFor(1)).toBe(0);
    expect(largeEnemyChanceFor(20)).toBe(0);
    expect(largeEnemyChanceFor(60)).toBeCloseTo(0.125, 3);
    expect(largeEnemyChanceFor(100)).toBe(0.25);
    expect(largeEnemyChanceFor(200)).toBe(0.25);
  });

  it('largeEnemyHpFor is ~1.10× normal base, same ±15% roll', () => {
    const normal = enemyHpFor(50, 1.0, () => 0.5);
    const large = largeEnemyHpFor(50, 1.0, 1.10, () => 0.5);
    expect(large).toBeGreaterThanOrEqual(normal);
    expect(large).toBeLessThanOrEqual(Math.round(normal * 1.10) + 2);
  });

  it('clamp bounds values', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('REWARD_ECONOMY_CURVE_V2 formulas', () => {
  it('locks the approved BALANCED_V1 reference controls', () => {
    expect(BALANCED_V1).toMatchObject({
      enemyVolumeMultiplier: 0.4, enemyHpMultiplier: 1.0,
      rewardRateMultiplier: 1.0, largeEnemyRateMultiplier: 1.0,
      baselineCaptureRate: 0.45, rewardProgression: 1.0,
      highValueBias: 0.70, enemyCountCap: 10,
    });
  });
  it('rewardMaxByTurn opens 1→2→4→8 in 20-turn steps (hard cap 8)', () => {
    expect(rewardMaxByTurn(1)).toBe(1);
    expect(rewardMaxByTurn(20)).toBe(1);
    expect(rewardMaxByTurn(21)).toBe(2);
    expect(rewardMaxByTurn(40)).toBe(2);
    expect(rewardMaxByTurn(41)).toBe(4);
    expect(rewardMaxByTurn(60)).toBe(4);
    expect(rewardMaxByTurn(61)).toBe(8);
    expect(rewardMaxByTurn(200)).toBe(8);
  });

  it('reward weights obey the four unlock bands, then progressively favor higher allowed values', () => {
    const w1 = rewardValueWeights(1);
    expect([...w1.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect([...w1.keys()]).toEqual([1]);
    expect(w1.get(1)).toBe(1);
    expect([...rewardValueWeights(20).keys()]).toEqual([1]);
    expect([...rewardValueWeights(21).keys()]).toEqual([1, 2]);
    expect([...rewardValueWeights(40).keys()]).toEqual([1, 2]);
    expect([...rewardValueWeights(41).keys()]).toEqual([1, 2, 4]);
    expect([...rewardValueWeights(60).keys()]).toEqual([1, 2, 4]);
    expect([...rewardValueWeights(61).keys()]).toEqual([1, 2, 4, 8]);
    expect([...rewardValueWeights(200).keys()]).toEqual([1, 2, 4, 8]);
    // On the first full-pool turn the dynamic curve already uses its current
    // alpha, while still favoring lower values.
    const w61 = rewardValueWeights(61);
    expect(w61.get(1)!).toBeGreaterThan(w61.get(2)!);
    expect(w61.get(2)!).toBeGreaterThan(w61.get(4)!);
    expect(w61.get(4)!).toBeGreaterThan(w61.get(8)!);
    const late = rewardValueWeights(1000);
    expect(late.get(1)).toBeCloseTo(0.33, 2);
    expect(late.get(2)).toBeCloseTo(0.27, 2);
    expect(late.get(4)).toBeCloseTo(0.22, 2);
    expect(late.get(8)).toBeCloseTo(0.18, 2);
    expect(late.get(1)).toBeGreaterThan(0);
    expect(rewardWeightAlpha(100, { rewardProgression: 2 })).toBeGreaterThan(rewardWeightAlpha(100, { rewardProgression: 1 }));
  });

  it('expectedSingleRewardValue rises as values unlock and later weights mature', () => {
    const early = expectedSingleRewardValue(1);
    const middle = expectedSingleRewardValue(61);
    const late = expectedSingleRewardValue(1000);
    expect(early).toBe(1);
    expect(middle).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(middle);
    expect(late).toBeLessThanOrEqual(8);
  });

  it('expectedPlantPower = 2 + captureRate × cumulative generated reward', () => {
    const cum = cumulativeExpectedGeneratedReward(20, 0.8); // 20 turns × 0.8 chance × ~1 value
    const power = expectedPlantPower(20, cum);
    expect(power).toBeCloseTo(2 + BASELINE_CAPTURE_RATE * cum, 5);
    expect(power).toBeGreaterThan(2);
  });

  it('uses the provisional 45% baseline capture rate consistently for V2', () => {
    expect(BASELINE_CAPTURE_RATE).toBe(0.45);
    expect(REWARD_ECONOMY_CURVE_V2.baselineCaptureRate).toBe(BASELINE_CAPTURE_RATE);
    expect(expectedPlantPower(20, 10)).toBe(6.5);
  });

  it('a configurable baseline changes only standard-player expectations and derived enemy targets', () => {
    const cumulative = 20;
    expect(expectedPlantPower(40, cumulative, 0.50)).toBeGreaterThan(expectedPlantPower(40, cumulative, 0.30));
    expect(hpIncomeBudget(40, cumulative, 0.50)).toBeGreaterThan(hpIncomeBudget(40, cumulative, 0.30));
    expect(normalEnemyTargetHp(40, cumulative, 0.50)).toBeGreaterThan(normalEnemyTargetHp(40, cumulative, 0.30));
  });

  it('difficultyFactor starts ~0.45 and approaches ~0.65 slowly', () => {
    expect(difficultyFactor(1)).toBeCloseTo(0.45 + 0.20 * (1 - Math.exp(-1 / 150)), 3);
    expect(difficultyFactor(150)).toBeCloseTo(0.45 + 0.20 * (1 - Math.exp(-1)), 3); // ≈0.576
    expect(difficultyFactor(600)).toBeCloseTo(0.45 + 0.20 * (1 - Math.exp(-4)), 3); // ≈0.646
    expect(difficultyFactor(1)).toBeLessThan(difficultyFactor(600));
    expect(difficultyFactor(600)).toBeLessThan(0.66);
  });

  it('hpIncomeBudget = expectedPower × difficultyFactor (never reads actual power)', () => {
    const cum = cumulativeExpectedGeneratedReward(50, 0.8);
    const income = hpIncomeBudget(50, cum);
    expect(income).toBeCloseTo(expectedPlantPower(50, cum) * difficultyFactor(50), 5);
    expect(income).toBeGreaterThan(0);
  });

  it('normalEnemyTargetHp ≈ expectedPower × 0.9; rolls stay within ±15%', () => {
    const cum = cumulativeExpectedGeneratedReward(50, 0.8);
    const target = normalEnemyTargetHp(50, cum);
    expect(target).toBeCloseTo(expectedPlantPower(50, cum) * 0.9, 3);
    const low = normalEnemyHp(50, cum, () => 0);
    const high = normalEnemyHp(50, cum, () => 1);
    expect(low).toBeLessThanOrEqual(Math.max(1, Math.round(target * 0.85)) + 1);
    expect(high).toBeGreaterThanOrEqual(Math.round(target * 1.15) - 1);
    expect(high).toBeGreaterThanOrEqual(low);
  });

  it('2×2 HP ≈ normal × 1.1, but spawn cost is 1.8× normal (space/lane pressure)', () => {
    const cum = cumulativeExpectedGeneratedReward(60, 0.8);
    const large = largeEnemyHpV2(60, cum, () => 0.5);
    const normal = normalEnemyHp(60, cum, () => 0.5);
    expect(large).toBeGreaterThanOrEqual(normal);
    expect(large).toBeLessThanOrEqual(Math.round(normal * 1.1) + 2);
    expect(enemySpawnCostV2(1)).toBe(1.0);
    expect(enemySpawnCostV2(2)).toBe(1.8);
  });

  it('economy curve is monotonic: expected power, HP income and target HP all grow with turn', () => {
    const sample = [1, 20, 40, 60, 100, 200];
    let prevPower = 0, prevIncome = 0, prevHp = 0;
    for (const t of sample) {
      const cum = cumulativeExpectedGeneratedReward(t, 0.8);
      const power = expectedPlantPower(t, cum);
      const income = hpIncomeBudget(t, cum);
      const hp = normalEnemyTargetHp(t, cum);
      expect(power).toBeGreaterThan(prevPower);
      expect(income).toBeGreaterThan(prevIncome);
      expect(hp).toBeGreaterThan(prevHp);
      prevPower = power; prevIncome = income; prevHp = hp;
    }
  });
});
