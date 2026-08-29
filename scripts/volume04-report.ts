import { DEFAULT_RULES, REWARD_ECONOMY_TEST_CONTROLS, restoreRewardEconomyTestDefaults } from '../src/game/config';
import { TurnManager, emptyState } from '../src/game/TurnManager';

const plant = (value: number) => ({ id: crypto.randomUUID(), value });

function simulate(volume: number, turns: number) {
  restoreRewardEconomyTestDefaults();
  Object.assign(REWARD_ECONOMY_TEST_CONTROLS, { enemyVolumeMultiplier: volume, largeEnemyRateMultiplier: 0 });
  const state = emptyState();
  for (let row = 0; row < 5; row++) { state.plants[row][0] = plant(128); state.plants[row][1] = plant(64); }
  const manager = new TurnManager(state, DEFAULT_RULES, () => 0.999, 'reward-economy');
  let cumulativeEnemyHp = 0, cumulativeRewardValue = 0;
  for (let i = 0; i < turns && !state.gameOver; i++) {
    manager.perform({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });
    cumulativeEnemyHp += state.events.filter(event => event.type === 'enemy-spawned').reduce((sum, event) => sum + (event.value ?? 0), 0);
    cumulativeRewardValue += state.events.filter(event => event.type === 'reward-spawned').reduce((sum, event) => sum + (event.value ?? 0), 0);
  }
  const metric = state.metrics.at(-1)!;
  return {
    turns: state.turn,
    volume,
    finalScore: state.score,
    actualPlantPower: metric.plantPower,
    expectedPlantPower: metric.expectedPlantPower,
    firepowerUtilization: +metric.firepowerUtilization.toFixed(3),
    rewardCaptureRate: +metric.rewardCaptureRate.toFixed(3),
    pressureRatio: +metric.pressureRatio.toFixed(3),
    enemyCount: metric.enemyCount,
    laneSpawns: manager.laneDistributionDiagnostics().recentEnemySpawns,
    cumulativeEnemyHp,
    cumulativeRewardValue,
  };
}

const report = [30, 50].flatMap(turns => [0.4, 0.6, 0.8, 1.0].map(volume => simulate(volume, turns)));
restoreRewardEconomyTestDefaults();
console.log(JSON.stringify(report, null, 2));
