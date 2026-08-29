export type Plant = { id: string; value: number };
export type Enemy = { id: string; row: number; col: number; width: 1 | 2; height: 1 | 2; hp: number; maxHp: number; /** Cosmetic only: never changes combat. */ skin?: string };
export type RewardBall = { id: string; row: number; col: number; value: number; spawnTurn?: number };
export type RewardLedgerEntry = { id: string; value: number; spawnTurn: number; /** Turn where a plant had a real lane opportunity to shoot it. */ reachableTurn?: number; capturedTurn?: number };
export type SpawnSafetyRecord = {
  kind: 'normal' | 'large'; outcome: 'spawned' | 'rejected'; reason?: 'requiredUtilization' | 'hardPressureCap' | 'occupancy';
  hp: number; row: number; col: number; width: 1 | 2; height: 1 | 2;
  remainingTurns: number; relevantLanePower: number; requiredUtilization: number;
  batchPressure: number; predictedPressureRatio: number;
};
export type TurnMetrics = {
  turn: number;
  score: number;
  plantPower: number;
  theoreticalDamage: number;
  effectiveEnemyDamage: number;
  firepowerUtilization: number;
  rewardSpawnValue: number;
  rewardCapturedValue: number;
  rewardReachableValue: number;
  rewardCaptureRate: number;
  rewardOpportunityCaptureRate: number;
  rollingRewardSpawnValue: number;
  rollingRewardReachableValue: number;
  rollingRewardCapturedValue: number;
  battlefieldPressure: number;
  pressureRatio: number;
  enemyCount: number;
  highestPlantValue: number;
  pendingSpawnBatchPressure: number;
  predictedSpawnPressureRatio: number;
  // REWARD_ECONOMY_CURVE_V2 economy metrics
  /** Value actually placed onto the Defense Board from the Spawn Slot this turn. */
  rewardRealizedValue: number;
  rollingRewardRealizedValue: number;
  /** realized / captured over the rolling window. */
  rewardRealizationRate: number;
  /** Formula-driven expected power of a standard player at this turn. */
  expectedPlantPower: number;
  /** Current difficulty factor (0.45 → 0.65). */
  difficultyFactor: number;
  /** Enemy HP budget accrued this turn. */
  hpIncomeBudget: number;
  /** Accumulated unspent enemy HP budget. */
  hpBudgetBank: number;
  /** Target HP for a normal 1×1 enemy this turn. */
  normalEnemyTargetHp: number;
};
/** A concrete shot: unlike a lane damage pool it owns its remaining damage. */
export type Projectile = { remainingDamage: number; lane: number; position: number; sourcePlantId?: string };
export type TurnEvent = {
  type: 'turn-start' | 'shot' | 'hit' | 'pierce' | 'enemy-spawned' | 'reward-spawned' | 'reward-advance' | 'reward-hit' | 'reward-captured' | 'spawn-slot-updated' | 'kill' | 'advance' | 'game-over' | 'debug-spawn' | 'spawn-blocked' | 'spawn-rejected';
  lane?: number;
  col?: number;
  subjectId?: string;
  sourcePlantId?: string;
  value?: number;
  damage?: number;
  remainingDamage?: number;
  hpBefore?: number;
  hpAfter?: number;
  reason?: string;
  requiredUtilization?: number;
  predictedPressureRatio?: number;
  message: string;
};
export type GameState = {
  plants: (Plant | null)[][];
  enemies: Enemy[];
  rewardBalls: RewardBall[];
  birthSlot: number | null;
  score: number;
  turn: number;
  gameOver: boolean;
  lastLog: string[];
  events: TurnEvent[];
  metrics: TurnMetrics[];
  rewardLedger: RewardLedgerEntry[];
  spawnSafety: SpawnSafetyRecord[];
  /** REWARD_ECONOMY: realized value per turn (index = turn-1) — value placed onto the board. */
  rewardRealized: number[];
};
export type Move = { from: { row: number; col: number } | 'birth'; to: { row: number; col: number } };
