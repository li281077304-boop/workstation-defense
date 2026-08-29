// 计算 REWARD_ECONOMY_CURVE_V2 经济曲线闭合表（复用 difficulty.ts 纯函数）
import {
  rewardMaxByTurn, expectedSingleRewardValue, cumulativeExpectedGeneratedReward,
  expectedPlantPower, difficultyFactor, hpIncomeBudget, normalEnemyTargetHp,
  rewardValueWeights,
} from '../src/game/difficulty';

const SPAWN_CHANCE = 0.80;
const HARD_CAP = 8;
const CAPTURE = 0.65;

console.log('Turn | RewardMax | 单球期望值 | ExpectedPower | Factor | HP预算/Turn | 普通怪目标HP');
console.log('-----|-----------|------------|---------------|--------|-------------|--------------');
for (const t of [1, 20, 40, 60, 100, 200]) {
  const cum = cumulativeExpectedGeneratedReward(t, SPAWN_CHANCE, HARD_CAP);
  const power = expectedPlantPower(t, cum, CAPTURE);
  const factor = difficultyFactor(t);
  const income = hpIncomeBudget(t, cum);
  const hp = normalEnemyTargetHp(t, cum);
  const single = expectedSingleRewardValue(t, HARD_CAP);
  console.log(`${String(t).padStart(4)} | ${String(rewardMaxByTurn(t, HARD_CAP)).padStart(8)} | ${single.toFixed(2).padStart(10)} | ${power.toFixed(1).padStart(13)} | ${factor.toFixed(3).padStart(6)} | ${income.toFixed(1).padStart(11)} | ${hp.toFixed(1).padStart(12)}`);
}
