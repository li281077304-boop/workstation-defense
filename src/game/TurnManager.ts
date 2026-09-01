import { BOARD, ACTIVE_DIFFICULTY, ENDLESS_CURVE_V1, MAX_DEFENDER_VALUE, REWARD_ECONOMY_CURVE_V2, REWARD_ECONOMY_TEST_CONTROLS, STARTING_DEFENDER_LAYOUT, largeEnemyChanceFor, maxRewardValueFor, type CombatRules } from './config';
import { cumulativeExpectedGeneratedReward, cumulativeExpectedMoyuValue, difficultyFactor, enemyHpFor, expectedMoyuValueForTurn, expectedPlantPower, expectedRewardPerTurn, expectedSingleRewardValue, hpIncomeBudget, largeEnemyChanceFor as curveLargeChance, largeEnemyHpFor, largeEnemyHpV2, normalEnemyHp, normalEnemyTargetHp, perTurnBudget, rewardChanceFor, rewardMaxByTurn, rewardMaxFor, rewardValueWeights, rewardWeightAlpha, type RewardWeightOptions } from './difficulty';
import type { Enemy, GameState, Move, MoyuPickup, Plant, Projectile, RewardBall, SpawnSafetyRecord, TurnEvent, TurnMetrics } from './types';

export const MOYU_DEBT_LIMIT = -4096;

const key = (r: number, c: number) => `${r}:${c}`;
const clone = <T>(v: T): T => structuredClone(v);

/** Logic-only director memory needed to continue the same difficulty curve. */
export type TurnManagerRuntimeState = {
  budgetBank: number;
  rewardDryTurns: number;
  lastSpentBudget: number;
  hpBudgetBankV2: number;
  cumulativeExpectedGeneratedV2: number;
  dryRewardTurnsV2: number;
  lastSpentHpBudgetV2: number;
  lastIncomeHpBudgetV2: number;
  lastEffectiveIncomeHpBudgetV2: number;
  lastAllowedSpendHpBudgetV2: number;
  lastMaxHpBudgetBankV2: number;
  laneSpawnHistory: Array<{ turn: number; row: number; height: 1 | 2; kind: 'enemy' | 'reward' }>;
  recentEnemyLaneAnchors: number[];
};

export type TurnManagerRunSnapshot = { state: GameState; runtime: TurnManagerRuntimeState };

export const isTurnManagerRuntimeState = (value: unknown): value is TurnManagerRuntimeState => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const numbers = ['budgetBank', 'rewardDryTurns', 'lastSpentBudget', 'hpBudgetBankV2', 'cumulativeExpectedGeneratedV2', 'dryRewardTurnsV2', 'lastSpentHpBudgetV2', 'lastIncomeHpBudgetV2', 'lastEffectiveIncomeHpBudgetV2', 'lastAllowedSpendHpBudgetV2', 'lastMaxHpBudgetBankV2'];
  return numbers.every(key => typeof record[key] === 'number' && Number.isFinite(record[key]))
    && Array.isArray(record.laneSpawnHistory)
    && Array.isArray(record.recentEnemyLaneAnchors);
};

export function emptyState(): GameState {
  return {
    plants: Array.from({ length: BOARD.rows }, () => Array<Plant | null>(BOARD.defenseCols).fill(null)),
    enemies: [], rewardBalls: [], moyuPickups: [], moyuBank: 0,
    highestDefenderValue: 1,
    totalMoyuGenerated: 0,
    totalMoyuEarned: 0,
    totalMoyuExtracted: 0,
    totalMoyuDismissalCost: 0,
    totalMoyuOverflow: 0,
    birthSlot: null, score: 0, turn: 0, gameOver: false, lastLog: [], events: [], metrics: [], rewardLedger: [], spawnSafety: [], rewardRealized: [],
  };
}

/** The opening board is explicit and testable; emptyState stays an empty board. */
export function seedStartingDefenders(state: GameState) {
  for (const start of STARTING_DEFENDER_LAYOUT) {
    state.plants[start.row][start.col] = { id: `start-${start.row}-${start.col}`, value: start.value };
  }
}

export class TurnManager {
  private currentMetrics = { theoreticalDamage: 0, effectiveEnemyDamage: 0, rewardSpawnValue: 0, rewardCapturedValue: 0, rewardRealizedValue: 0, overkillWaste: 0, moyuInterceptWaste: 0, moyuCollectedValue: 0, moyuPickupCount: 0, autoRecoveredMoyuValue: 0, projectileCount: 0 };
  /** Drops remain invisible/unhittable until every projectile of this turn finishes. */
  private pendingMoyuDrops: Array<Omit<MoyuPickup, 'id' | 'isCollected' | 'spawnTurn'>> = [];
  // ENDLESS_CURVE_V1 runtime state (formula mode)
  private budgetBank = 0;
  private rewardDryTurns = 0;
  private lastSpentBudget = 0;
  // REWARD_ECONOMY_CURVE_V2 runtime state
  private hpBudgetBankV2 = 0;
  private cumulativeExpectedGeneratedV2 = 0;
  private dryRewardTurnsV2 = 0;
  private lastSpentHpBudgetV2 = 0;
  private lastIncomeHpBudgetV2 = 0;
  private lastEffectiveIncomeHpBudgetV2 = 0;
  private lastAllowedSpendHpBudgetV2 = 0;
  private lastMaxHpBudgetBankV2 = 0;
  /** Recent spawn lanes are presentation-neutral spawn-director memory. */
  private laneSpawnHistory: Array<{ turn: number; row: number; height: 1 | 2; kind: 'enemy' | 'reward' }> = [];
  private recentEnemyLaneAnchors: number[] = [];
  constructor(public state: GameState = emptyState(), public rules: CombatRules, private random: () => number = Math.random, public forcedMode?: 'baseline' | 'endless-curve' | 'reward-economy') {
    this.normalizeMoyuAccount();
  }

  /** Pure capacity rule: the historical maximum Defender, never the live board. */
  static moyuCapacityFor(maxDefenderValue: number): number {
    const safeHighest = Number.isFinite(maxDefenderValue) ? Math.max(1, Math.floor(maxDefenderValue)) : 1;
    return Math.min(32, Math.max(4, Math.floor(safeHighest / 4)));
  }

  static dismissalCostFor(value: number): number {
    return Math.max(0, Math.floor(value)) * 2;
  }

  /** Compatibility-safe single read path for carrier labels, drops, and tests. */
  static enemyMoyuValue(enemy: Pick<Enemy, 'moyuValue'>): number {
    return Math.max(0, Math.floor(enemy.moyuValue ?? 0));
  }

  /** One player-facing extraction rule; UI never recalculates this independently. */
  highestAffordableMoyu(maxValue = MAX_DEFENDER_VALUE): number | null {
    if (!Number.isSafeInteger(maxValue) || maxValue < 1 || this.state.birthSlot !== null || this.state.moyuBank < 1) return null;
    return 2 ** Math.floor(Math.log2(Math.min(this.state.moyuBank, maxValue)));
  }

  /** The public UI/debug value. This also repairs direct test/editor state safely. */
  moyuCapacity(): number {
    this.normalizeMoyuAccount();
    return TurnManager.moyuCapacityFor(this.state.highestDefenderValue);
  }

  private liveHighestDefenderValue(): number {
    return Math.max(1, ...this.state.plants.flatMap(row => row.flatMap(plant => plant ? [plant.value] : [])));
  }

  private noteHighestDefender(value: number) {
    if (Number.isFinite(value) && value >= 1) this.state.highestDefenderValue = Math.max(this.state.highestDefenderValue, value);
  }

  /**
   * Makes old/hand-authored state safe without ever lowering a run's historical
   * high-water mark. Only migration/restore needs this repair path; normal
   * gameplay reaches it through `creditMoyu` and `noteHighestDefender`.
   */
  private normalizeMoyuAccount() {
    const candidate = Number.isFinite(this.state.highestDefenderValue) ? this.state.highestDefenderValue : 1;
    this.state.highestDefenderValue = Math.max(1, Math.floor(candidate), this.liveHighestDefenderValue());
    this.state.totalMoyuGenerated = Math.max(0, Math.floor(this.state.totalMoyuGenerated ?? 0));
    this.state.totalMoyuExtracted = Math.max(0, Math.floor(this.state.totalMoyuExtracted ?? 0));
    this.state.totalMoyuDismissalCost = Math.max(0, Math.floor(this.state.totalMoyuDismissalCost ?? 0));
    this.state.totalMoyuOverflow = Math.max(0, Math.floor(this.state.totalMoyuOverflow ?? 0));
    this.state.moyuBank = Math.max(MOYU_DEBT_LIMIT, Math.floor(this.state.moyuBank ?? 0));
    const capacity = TurnManager.moyuCapacityFor(this.state.highestDefenderValue);
    if (this.state.moyuBank > capacity) {
      this.state.totalMoyuOverflow += this.state.moyuBank - capacity;
      this.state.moyuBank = capacity;
    }
    // Repair stale/debug-edited debt conservatively: an existing negative Bank
    // implies at least enough prior dismissal cost to explain it. Normal runs
    // always write this cost at dismissal time.
    const recordedEarned = Math.max(0, Math.floor(this.state.totalMoyuEarned ?? 0));
    const minimumDismissalCost = Math.max(0, recordedEarned - this.state.totalMoyuExtracted - this.state.moyuBank);
    this.state.totalMoyuDismissalCost = Math.max(this.state.totalMoyuDismissalCost, minimumDismissalCost);
    // Preserve the accounting invariant even for stale/debug-edited saves.
    this.state.totalMoyuEarned = this.state.moyuBank + this.state.totalMoyuExtracted + this.state.totalMoyuDismissalCost;
    this.state.totalMoyuGenerated = Math.max(this.state.totalMoyuGenerated, this.state.totalMoyuEarned + this.state.totalMoyuOverflow);
  }

  /** Effective config for the active difficulty mode. */
  private get cfg() {
    return this.mode === 'endless-curve' ? ENDLESS_CURVE_V1 : this.mode === 'reward-economy' ? REWARD_ECONOMY_CURVE_V2 : this.rules;
  }
  private get mode() {
    return this.forcedMode ?? ACTIVE_DIFFICULTY.mode;
  }
  /** Cosmetic selection is deliberately independent from HP, Turn, and all combat math. */
  private enemySkin(id: string, size: 1 | 2): string {
    const regular = ['enemy-office-01', 'enemy-office-02', 'enemy-office-03', 'enemy-office-04', 'enemy-office-05', 'enemy-office-06', 'enemy-office-07'];
    // Visual-only selection: the 2×2 system core has no distinct gameplay stats.
    const large = ['enemy-system-core-01'];
    const pool = size === 2 ? large : regular;
    // Stable hash: presentation selection must never consume gameplay RNG.
    const hash = [...id].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
    return pool[hash % pool.length];
  }
  private rewardWeightOptions(): RewardWeightOptions {
    return { alphaMax: REWARD_ECONOMY_TEST_CONTROLS.highValueBias, rewardProgression: REWARD_ECONOMY_TEST_CONTROLS.rewardProgression };
  }
  private finalRewardSpawnChance() {
    return Math.min(1, REWARD_ECONOMY_CURVE_V2.rewardSpawnChance * REWARD_ECONOMY_TEST_CONTROLS.rewardRateMultiplier);
  }
  /** Carrier selection is independent from HP, size, skin, and combat power. */
  /** Test controls alter only the standard carrier economy, never actual board power. */
  private moyuCarrierChance(): number {
    const cfg = this.mode === 'reward-economy' ? REWARD_ECONOMY_CURVE_V2 : this.rules;
    return Math.min(1, cfg.moyuCarrierChance * REWARD_ECONOMY_TEST_CONTROLS.rewardRateMultiplier);
  }
  private moyuStages() {
    const cfg = this.mode === 'reward-economy' ? REWARD_ECONOMY_CURVE_V2 : this.rules;
    const progression = Math.max(.1, REWARD_ECONOMY_TEST_CONTROLS.rewardProgression);
    const bias = REWARD_ECONOMY_TEST_CONTROLS.highValueBias - .70;
    return cfg.moyuValueStages.map(stage => ({
      startTurn: Math.max(1, Math.ceil(stage.startTurn / progression)),
      values: [...stage.values],
      // Default bias .70 is neutral; positive values make the higher tier
      // within the active stage more likely without expanding that stage.
      weights: stage.weights.map((weight, index) => weight * Math.pow(stage.values[index], bias)),
    }));
  }
  private moyuValueForNewEnemy(): number {
    const cfg = this.mode === 'reward-economy' ? REWARD_ECONOMY_CURVE_V2 : this.rules;
    if (this.random() >= this.moyuCarrierChance()) return 0;
    const stages = this.moyuStages();
    const stage = [...stages].reverse().find(candidate => this.state.turn >= candidate.startTurn) ?? stages[0];
    const total = stage.weights.reduce((sum, weight) => sum + weight, 0);
    let roll = this.random() * total;
    for (let index = 0; index < stage.values.length; index++) { roll -= stage.weights[index]; if (roll < 0) return stage.values[index]; }
    return stage.values.at(-1)!;
  }

  perform(move: Move): boolean {
    return this.resolveLegalOperation(() => this.applyMove(move));
  }

  /** Remove a stuck Defender, pay its value × 2, and resolve exactly one Turn. */
  dismissDefender(from: { row: number; col: number }): boolean {
    let dismissedValue = 0;
    const accepted = this.resolveLegalOperation(() => {
      const defender = this.state.plants[from.row]?.[from.col];
      if (!defender) return false;
      const cost = TurnManager.dismissalCostFor(defender.value);
      if (this.state.moyuBank - cost < MOYU_DEBT_LIMIT) return false;
      dismissedValue = defender.value;
      this.state.plants[from.row][from.col] = null;
      this.state.moyuBank -= cost;
      this.state.totalMoyuDismissalCost += cost;
      return true;
    });
    if (accepted) this.record({ type: 'defender-dismissed', lane: from.row, col: from.col, value: dismissedValue, message: `Dismissed Defender ${dismissedValue}; spent ${TurnManager.dismissalCostFor(dismissedValue)} Moyu` });
    return accepted;
  }

  private resolveLegalOperation(apply: () => boolean): boolean {
    if (this.state.gameOver || !apply()) return false;
    this.state.turn++;
    this.state.lastLog = [];
    this.state.events = [];
    this.state.spawnSafety = [];
    this.currentMetrics = { theoreticalDamage: 0, effectiveEnemyDamage: 0, rewardSpawnValue: 0, rewardCapturedValue: 0, rewardRealizedValue: 0, overkillWaste: 0, moyuInterceptWaste: 0, moyuCollectedValue: 0, moyuPickupCount: 0, autoRecoveredMoyuValue: 0, projectileCount: 0 };
    this.record({ type: 'turn-start', message: `Turn ${this.state.turn}: firing` });
    this.fireAll();
    this.advanceEnemies();
    this.advanceMoyuPickups();
    if (!this.state.gameOver) {
      if (this.mode === 'reward-economy') {
        this.spawnRewardEconomy();
      } else if (this.mode === 'endless-curve') {
        this.spawnEndlessCurve();
      } else if (this.cfg.automaticEnemySpawning) {
        for (let i = 0; i < this.rules.enemiesPerTurn; i++) this.spawnAutomatic();
      }
    }
    // New drops are visible only after every current projectile and movement
    // phase has settled; like a new enemy, they do not move on their birth turn.
    this.flushPendingMoyuDrops();
    this.recordMetrics();
    return true;
  }

  private applyMove(move: Move): boolean {
    const dst = this.state.plants[move.to.row]?.[move.to.col];
    if (!this.state.plants[move.to.row] || move.to.col < 0 || move.to.col >= BOARD.defenseCols) return false;
    if (move.from === 'birth') {
      if (this.state.birthSlot === null) return false;
      const incoming: Plant = { id: crypto.randomUUID(), value: this.state.birthSlot };
      // REWARD_ECONOMY: realized = the value actually placed onto the board.
      const realizedValue = this.state.birthSlot;
      if (!dst) this.state.plants[move.to.row][move.to.col] = incoming;
      else if (dst.value === incoming.value) this.state.plants[move.to.row][move.to.col] = { id: crypto.randomUUID(), value: dst.value * 2 };
      else return false;
      this.noteHighestDefender(this.state.plants[move.to.row][move.to.col]!.value);
      this.state.birthSlot = null;
      // REWARD_ECONOMY: persist realized value (index = new turn - 1, since turn++ happens after applyMove).
      this.state.rewardRealized.push(realizedValue);
      return true;
    }
    const source = this.state.plants[move.from.row]?.[move.from.col];
    if (!source || (move.from.row === move.to.row && move.from.col === move.to.col)) return false;
    if (!dst) { this.state.plants[move.to.row][move.to.col] = source; this.state.plants[move.from.row][move.from.col] = null; this.noteHighestDefender(source.value); return true; }
    if (source.value === dst.value) { this.state.plants[move.to.row][move.to.col] = { id: crypto.randomUUID(), value: source.value * 2 }; this.state.plants[move.from.row][move.from.col] = null; this.noteHighestDefender(source.value * 2); return true; }
    this.state.plants[move.to.row][move.to.col] = source; this.state.plants[move.from.row][move.from.col] = dst; return true;
  }

  private fireAll() {
    for (let row = 0; row < BOARD.rows; row++) {
      // Resolve the defender nearest the enemy first. This is deterministic
      // and independent of animation / creation order.
      for (const col of Array.from({ length: BOARD.defenseCols }, (_, index) => BOARD.defenseCols - 1 - index)) {
        const plant = this.state.plants[row][col];
        if (!plant) continue;
        this.currentMetrics.theoreticalDamage += plant.value;
        for (const projectile of this.createProjectiles(plant.value, row)) {
          projectile.sourcePlantId = plant.id;
          projectile.sourceDefenderId = plant.id;
          this.currentMetrics.projectileCount++;
          this.resolveProjectile(projectile);
        }
      }
    }
  }

  /** A ball is an opportunity once at least one live plant can fire down its lane. */
  private markReachableRewards() {
    for (const ball of this.state.rewardBalls) {
      if (!this.state.plants[ball.row]?.some(Boolean)) continue;
      const ledger = this.state.rewardLedger.find(entry => entry.id === ball.id);
      if (ledger && ledger.reachableTurn === undefined) ledger.reachableTurn = this.state.turn;
    }
  }

  /** Moyu Economy V2: exactly one shot per defender and its full value is the damage. */
  createProjectiles(value: number, lane: number): Projectile[] {
    return [{ id: crypto.randomUUID(), lane, damage: value, remainingDamage: value, position: 0, isAlive: true }];
  }

  /** Exposed for deterministic rules tests; the scene never calls it directly. */
  resolveProjectile(projectile: Projectile) {
    // Tests and debug tools may pass a minimal legacy-shaped projectile.
    projectile.id ??= crypto.randomUUID();
    projectile.damage ??= projectile.remainingDamage;
    projectile.isAlive ??= true;
    this.record({ type: 'shot', lane: projectile.lane, damage: projectile.damage, sourcePlantId: projectile.sourcePlantId, subjectId: projectile.id, message: `Lane ${projectile.lane + 1} shot ${projectile.damage}` });
    while (projectile.isAlive && projectile.remainingDamage > 0) {
      const ignorePickupId = (projectile as Projectile & { ignorePickupId?: string }).ignorePickupId;
      const target = this.nextTarget(projectile.lane, projectile.position, ignorePickupId);
      if (!target) {
        this.finishProjectile(projectile, 'overkill');
        return;
      }
      projectile.position = target.col;
      if (target.kind === 'moyu') {
        this.collectMoyu(target.pickup, projectile);
        return;
      }
      const hpBefore = target.enemy.hp;
      const damage = Math.min(projectile.remainingDamage, hpBefore);
      this.currentMetrics.effectiveEnemyDamage += damage;
      const hpAfter = hpBefore - damage;
      this.record({ type: 'hit', lane: projectile.lane, col: target.col, subjectId: target.enemy.id, damage, hpBefore, hpAfter, message: `Lane ${projectile.lane + 1} hit ${target.enemy.id} for ${damage}` });
      if (projectile.remainingDamage < hpBefore) {
        target.enemy.hp = hpAfter;
        if (this.rules.scoreMode === 'damage') this.state.score += projectile.remainingDamage;
        projectile.remainingDamage = 0;
        projectile.isAlive = false;
        this.record({ type: 'projectile-ended', subjectId: projectile.id, lane: projectile.lane, reason: 'enemy-absorbed', message: `Projectile ${projectile.id} absorbed by enemy` });
        return;
      }
      projectile.remainingDamage -= hpBefore;
      const dropped = this.kill(target.enemy, target.col);
      if (dropped) (projectile as Projectile & { ignorePickupId?: string }).ignorePickupId = dropped.id;
      this.record({ type: 'pierce', lane: projectile.lane, col: target.col, subjectId: target.enemy.id, remainingDamage: projectile.remainingDamage, message: `Lane ${projectile.lane + 1} pierced ${target.enemy.id}; ${projectile.remainingDamage} remains` });
      if (projectile.remainingDamage === 0) { projectile.isAlive = false; this.record({ type: 'projectile-ended', subjectId: projectile.id, lane: projectile.lane, reason: 'enemy-absorbed', message: `Projectile ${projectile.id} spent on enemy` }); }
    }
  }

  private nextTarget(lane: number, after: number, ignorePickupId?: string): { kind: 'enemy'; enemy: Enemy; col: number } | { kind: 'moyu'; pickup: MoyuPickup; col: number } | null {
    const enemies = this.state.enemies.filter(enemy => lane >= enemy.row && lane < enemy.row + enemy.height && enemy.col >= after)
      .map(enemy => ({ kind: 'enemy' as const, enemy, col: enemy.col }));
    const pickups = this.state.moyuPickups.filter(pickup => pickup.id !== ignorePickupId && !pickup.isCollected && pickup.row === lane && pickup.col >= after)
      .map(pickup => ({ kind: 'moyu' as const, pickup, col: pickup.col }));
    // A pickup at the same cell is intentionally an intercepting blocker.
    return [...enemies, ...pickups].sort((a, b) => a.col - b.col || (a.kind === 'moyu' ? -1 : 1))[0] ?? null;
  }

  private kill(enemy: Enemy, col: number): MoyuPickup | null {
    this.state.enemies = this.state.enemies.filter(e => e.id !== enemy.id);
    if (this.rules.scoreMode === 'kill') this.state.score += enemy.maxHp;
    else if (this.rules.scoreMode === 'damage') this.state.score += enemy.hp; // last hit that killed it
    this.record({ type: 'kill', lane: enemy.row, col, subjectId: enemy.id, value: enemy.maxHp, message: `Defeated ${enemy.id} (+${enemy.maxHp})` });
    const value = TurnManager.enemyMoyuValue(enemy);
    if (value > 0) {
      enemy.moyuValue = 0; // exactly-once guard.
      const pickup: MoyuPickup = { id: crypto.randomUUID(), value, row: enemy.row, col, isCollected: false, spawnTurn: this.state.turn };
      this.state.moyuPickups.push(pickup);
      this.state.totalMoyuGenerated += value;
      this.currentMetrics.moyuPickupCount++;
      this.record({ type: 'moyu-drop-queued', lane: enemy.row, col, subjectId: enemy.id, value, message: `Moyu ${value} drop appeared from ${enemy.id}` });
      this.record({ type: 'moyu-spawned', subjectId: pickup.id, lane: pickup.row, col: pickup.col, value, message: `Moyu ${value} dropped onto battlefield` });
      return pickup;
    }
    return null;
  }

  private advanceEnemies() {
    const occupiedBeforeAdvance = this.state.enemies.map(enemy => ({ ...enemy }));
    for (const enemy of this.state.enemies) {
      const next = { ...enemy, col: enemy.col - 1 };
      const conflicts = occupiedBeforeAdvance.some(other => other.id !== enemy.id && this.footprintsOverlap(next, other)) ||
        this.state.moyuPickups.some(pickup => !pickup.isCollected && pickup.row >= next.row && pickup.row < next.row + next.height && pickup.col >= next.col && pickup.col < next.col + next.width);
      if (conflicts) {
        this.record({ type: 'spawn-blocked', subjectId: enemy.id, message: `${enemy.id} held position: occupied destination` });
        continue;
      }
      enemy.col = next.col;
      this.record({ type: 'advance', subjectId: enemy.id, message: `${enemy.id} advanced to column ${enemy.col}` });
    }
    if (this.state.enemies.some(e => e.col < 0)) { this.state.gameOver = true; this.record({ type: 'game-over', message: 'GAME OVER: enemy entered defense area' }); }
  }

  private advanceMoyuPickups() {
    for (const pickup of [...this.state.moyuPickups]) {
      if (pickup.isCollected) continue;
      if (pickup.col <= 0) { this.autoRecoverMoyu(pickup); continue; }
      if (!this.canPlaceMoyu(pickup.row, pickup.col - 1, pickup.id)) {
        this.record({ type: 'spawn-blocked', subjectId: pickup.id, message: `Moyu ${pickup.id} held position: occupied destination` });
        continue;
      }
      pickup.col--;
      this.record({ type: 'moyu-advance', subjectId: pickup.id, lane: pickup.row, col: pickup.col, message: `Moyu ${pickup.id} advanced to column ${pickup.col}` });
    }
  }

  /** Spawn delayed drops after (and only after) every current-turn projectile settles. */
  private flushPendingMoyuDrops() {
    for (const pending of this.pendingMoyuDrops.splice(0)) {
      const pickup: MoyuPickup = { id: crypto.randomUUID(), ...pending, isCollected: false, spawnTurn: this.state.turn };
      this.state.moyuPickups.push(pickup);
      this.state.totalMoyuGenerated += pickup.value;
      this.currentMetrics.moyuPickupCount++;
      this.record({ type: 'moyu-spawned', subjectId: pickup.id, lane: pickup.row, col: pickup.col, value: pickup.value, message: `Moyu ${pickup.value} dropped onto battlefield` });
    }
  }

  /** Public for deterministic tests and the renderer's visual event reconciliation. */
  finalizeProjectilePhase() { this.flushPendingMoyuDrops(); }

  private creditMoyu(incoming: number, pickup: MoyuPickup, eventType: 'moyu-collected' | 'moyu-auto-recovered', projectile?: Projectile) {
    const capacity = this.moyuCapacity();
    const available = Math.max(0, capacity - this.state.moyuBank);
    const earned = Math.min(incoming, available);
    const overflow = incoming - earned;
    this.state.moyuBank += earned;
    this.state.totalMoyuEarned += earned;
    this.state.totalMoyuOverflow += overflow;
    this.currentMetrics.moyuCollectedValue += earned;
    if (eventType === 'moyu-auto-recovered') this.currentMetrics.autoRecoveredMoyuValue += earned;
    const action = eventType === 'moyu-collected' ? 'Collected' : 'Auto-recovered';
    this.record({
      type: eventType,
      subjectId: pickup.id,
      lane: pickup.row,
      col: pickup.col,
      value: earned,
      incomingValue: incoming,
      earnedValue: earned,
      overflowValue: overflow,
      damage: projectile?.remainingDamage,
      remainingDamage: projectile ? 0 : undefined,
      message: overflow > 0 ? `${action} Moyu ${incoming}; +${earned}, overflow ${overflow}` : `${action} Moyu ${incoming}; +${earned}`,
    });
    if (overflow > 0) {
      this.record({ type: 'moyu-overflow', subjectId: pickup.id, lane: pickup.row, col: pickup.col, value: overflow, incomingValue: incoming, earnedValue: earned, overflowValue: overflow, reason: 'bank-full', message: earned === 0 ? `Moyu Bank full; overflow ${overflow}` : `Moyu overflow ${overflow}` });
    }
    return { earned, overflow };
  }

  private collectMoyu(pickup: MoyuPickup, projectile: Projectile) {
    if (pickup.isCollected) return;
    pickup.isCollected = true;
    this.state.moyuPickups = this.state.moyuPickups.filter(candidate => candidate.id !== pickup.id);
    this.currentMetrics.moyuInterceptWaste += projectile.remainingDamage;
    const waste = projectile.remainingDamage;
    this.creditMoyu(pickup.value, pickup, 'moyu-collected', projectile);
    projectile.remainingDamage = 0;
    projectile.isAlive = false;
    // The credit event above intentionally records the pre-consumption damage.
    void waste;
    this.record({ type: 'projectile-ended', subjectId: projectile.id, lane: projectile.lane, reason: 'moyu-intercepted', message: `Projectile ${projectile.id} consumed by Moyu` });
  }

  private autoRecoverMoyu(pickup: MoyuPickup) {
    if (pickup.isCollected) return;
    pickup.isCollected = true;
    this.state.moyuPickups = this.state.moyuPickups.filter(candidate => candidate.id !== pickup.id);
    this.creditMoyu(pickup.value, pickup, 'moyu-auto-recovered');
  }

  private finishProjectile(projectile: Projectile, reason: 'overkill') {
    const waste = projectile.remainingDamage;
    projectile.remainingDamage = 0;
    projectile.isAlive = false;
    this.currentMetrics.overkillWaste += waste;
    this.record({ type: 'projectile-ended', subjectId: projectile.id, lane: projectile.lane, reason, damage: waste, remainingDamage: 0, message: `Projectile ${projectile.id} left battle with ${waste} unused damage` });
  }

  /** Active extraction is deliberately outside Turn logic; placing the result still consumes a Turn. */
  extractMoyu(value: number): boolean {
    if (!Number.isSafeInteger(value) || value < 1 || (value & (value - 1)) !== 0) return false;
    if (this.state.birthSlot !== null || this.state.moyuBank < value) return false;
    this.state.moyuBank -= value;
    this.state.totalMoyuExtracted += value;
    this.state.birthSlot = value;
    this.record({ type: 'moyu-extracted', value, message: `Extracted Moyu ${value} into Spawn Slot` });
    return true;
  }

  /**
   * The player-facing extraction action: take the greatest affordable defender
   * value in one tap.  It deliberately does not start a Turn.
   */
  extractHighestMoyu(maxValue = MAX_DEFENDER_VALUE): boolean {
    const value = this.highestAffordableMoyu(maxValue);
    return value !== null && this.extractMoyu(value);
  }

  /**
   * Predictable Spawn Slot shortcut. It only deploys into an actually empty
   * cell, so it can never merge, swap, overwrite, or choose a tactical target.
   */
  quickDeployFromBirth(): boolean {
    const targets = [
      ...Array.from({ length: BOARD.rows }, (_, row) => ({ row, col: BOARD.defenseCols - 1 })),
      ...Array.from({ length: BOARD.rows }, (_, row) => ({ row, col: 0 })),
    ];
    const target = targets.find(({ row, col }) => this.state.plants[row][col] === null);
    return target ? this.perform({ from: 'birth', to: target }) : false;
  }

  private footprintsOverlap(a: Enemy, b: Enemy): boolean {
    return a.row < b.row + b.height && a.row + a.height > b.row && a.col < b.col + b.width && a.col + a.width > b.col;
  }
  private canPlaceEnemy(candidate: Enemy): boolean {
    return !this.state.enemies.some(enemy => this.footprintsOverlap(candidate, enemy)) &&
      !this.state.moyuPickups.some(pickup => !pickup.isCollected && pickup.row >= candidate.row && pickup.row < candidate.row + candidate.height && pickup.col >= candidate.col && pickup.col < candidate.col + candidate.width);
  }
  private canPlaceMoyu(row: number, col: number, ignoreId?: string): boolean {
    return !this.state.moyuPickups.some(pickup => pickup.id !== ignoreId && !pickup.isCollected && pickup.row === row && pickup.col === col) &&
      !this.state.enemies.some(enemy => row >= enemy.row && row < enemy.row + enemy.height && col >= enemy.col && col < enemy.col + enemy.width);
  }
  private canPlaceReward(row: number, col: number): boolean {
    return !this.state.rewardBalls.some(ball => ball.row === row && ball.col === col) &&
      !this.state.enemies.some(enemy => row >= enemy.row && row < enemy.row + enemy.height && col >= enemy.col && col < enemy.col + enemy.width);
  }
  private firstAvailableEnemyPlacement(size: 1 | 2): Pick<Enemy, 'row' | 'col'> | null {
    const rows = Array.from({ length: BOARD.rows - size + 1 }, (_, i) => i);
    // This task targets the current V2 spawn director only. Baseline safety
    // intentionally retains its lane-power priority for its own utilization checks.
    if (this.mode !== 'reward-economy') {
      const offset = Math.floor(this.random() * rows.length);
      const orderedRows = rows.map((_, i) => rows[(i + offset) % rows.length]).sort((a, b) => this.plantPowerForRows(b, size) - this.plantPowerForRows(a, size));
      for (const row of orderedRows) {
        const candidate: Enemy = { id: 'candidate', row, col: BOARD.battlefieldCols - size, width: size, height: size, hp: 1, maxHp: 1 };
        if (this.canPlaceEnemy(candidate)) return { row, col: candidate.col };
      }
      return null;
    }
    const available: Array<Pick<Enemy, 'row' | 'col'>> = [];
    for (const row of rows) {
      const candidate: Enemy = { id: 'candidate', row, col: BOARD.battlefieldCols - size, width: size, height: size, hp: 1, maxHp: 1 };
      if (this.canPlaceEnemy(candidate)) available.push({ row, col: candidate.col });
    }
    if (!available.length) return null;
    const chosen = this.weightedPick(available, placement => this.enemyLaneWeight(placement.row, size));
    return chosen ?? null;
  }
  private firstAvailableRewardPlacement(): Pick<RewardBall, 'row' | 'col'> | null {
    const col = BOARD.battlefieldCols - 1;
    if (this.mode !== 'reward-economy') {
      const offset = Math.floor(this.random() * BOARD.rows);
      for (let i = 0; i < BOARD.rows; i++) {
        const row = (i + offset) % BOARD.rows;
        if (this.canPlaceReward(row, col)) return { row, col };
      }
      return null;
    }
    const available = Array.from({ length: BOARD.rows }, (_, row) => ({ row, col })).filter(placement => this.canPlaceReward(placement.row, placement.col));
    return this.weightedPick(available, placement => this.rewardLaneWeight(placement.row)) ?? null;
  }

  private weightedPick<T>(items: T[], weight: (item: T) => number): T | null {
    const weights = items.map(item => Math.max(0.001, weight(item)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = this.random() * total;
    for (let i = 0; i < items.length; i++) { roll -= weights[i]; if (roll < 0) return items[i]; }
    return items.at(-1) ?? null;
  }

  private laneEnemyCount(row: number) {
    return this.state.enemies.filter(enemy => row >= enemy.row && row < enemy.row + enemy.height).length;
  }
  private laneRewardCount(row: number) { return this.state.rewardBalls.filter(ball => ball.row === row).length; }
  private laneHasLargeEnemy(row: number) { return this.state.enemies.some(enemy => enemy.height === 2 && row >= enemy.row && row < enemy.row + enemy.height); }
  private recentLaneSpawnCount(row: number, kind?: 'enemy' | 'reward') {
    const minTurn = Math.max(1, this.state.turn - 2);
    return this.laneSpawnHistory.filter(entry => entry.turn >= minTurn && (!kind || entry.kind === kind) && row >= entry.row && row < entry.row + entry.height).length;
  }
  /** Light balancing only: occupied or recently-hit lanes remain possible, just less likely. */
  private enemyLaneWeight(row: number, size: 1 | 2) {
    const laneWeight = (lane: number) => Math.max(0.20, 1 - this.laneEnemyCount(lane) * 0.20 - this.recentLaneSpawnCount(lane, 'enemy') * 0.15 - (this.laneHasLargeEnemy(lane) ? 0.15 : 0));
    let result = size === 2 ? laneWeight(row) * laneWeight(row + 1) : laneWeight(row);
    // A third identical anchor lane remains possible, but is deliberately rare.
    if (this.recentEnemyLaneAnchors.length >= 2 && this.recentEnemyLaneAnchors.at(-1) === row && this.recentEnemyLaneAnchors.at(-2) === row) result *= 0.25;
    return result;
  }
  /** Rewards use the same spatial signal more gently, preserving visible randomness. */
  private rewardLaneWeight(row: number) {
    return Math.max(0.35, 1 - this.laneEnemyCount(row) * 0.08 - this.laneRewardCount(row) * 0.08 - this.recentLaneSpawnCount(row) * 0.06 - (this.laneHasLargeEnemy(row) ? 0.05 : 0));
  }
  /** Debug-only helper. Generation cadence and difficulty are intentionally not game rules yet. */
  debugSpawnEnemy(size: 1 | 2 = 1) {
    const placement = this.firstAvailableEnemyPlacement(size);
    if (!placement) { this.record({ type: 'spawn-blocked', message: `Debug ${size}×${size} enemy blocked by occupied cells` }); return false; }
    const hp = size === 2 ? 32 : 12;
    const id = crypto.randomUUID().slice(0, 6);
    this.state.enemies.push({ id, ...placement, width: size, height: size, hp, maxHp: hp, moyuValue: this.moyuValueForNewEnemy(), skin: this.enemySkin(id, size) });
    this.record({ type: 'debug-spawn', subjectId: this.state.enemies.at(-1)?.id, message: `Debug spawned ${size}×${size} enemy` });
    return true;
  }
  /** Adds the fixed tutorial batch while keeping its reward in the analytics ledger. */
  seedOpeningBatch(enemy: Enemy, reward: RewardBall) {
    if (this.canPlaceEnemy(enemy)) this.state.enemies.push({ ...enemy, moyuValue: enemy.moyuValue ?? this.moyuValueForNewEnemy(), skin: enemy.skin ?? this.enemySkin(enemy.id, enemy.width) });
    // RewardBall input is retained only so an older scene can bootstrap; V2 no longer spawns it.
    void reward;
  }
  /** Spawn only enemies that pass individual killability and whole-batch pressure checks. */
  private spawnAutomatic() {
    if (this.state.enemies.length >= this.rules.enemyCap) return;
    if (this.random() >= this.rules.enemySpawnChance) return;
    const size: 1 | 2 = this.random() < this.largeEnemyChance() ? 2 : 1;
    if (!this.trySpawn(size) && size === 2) this.trySpawn(1);
  }

  /* ── ENDLESS_CURVE_V1: formula-driven spawning ──
   * Enemy strength depends ONLY on Turn. No rubber-banding to player power.
   * Uses a threat budget bank: budget10(T)/10 accrued per turn, spent on
   * enemies (1×1 cost 1, 2×2 cost 3), capped by maxSpendPerTurn to avoid spikes.
   */
  private spawnEndlessCurve() {
    const cfg = ENDLESS_CURVE_V1;
    if (!cfg.automaticEnemySpawning) return;
    const turn = this.state.turn;
    // 1) Accrue budget for this turn.
    this.budgetBank += perTurnBudget(turn, cfg.budgetMultiplier);
    // 2) Decide how much to spend this turn (smooth, capped).
    const affordable = Math.floor(this.budgetBank);
    const maxSpend = Math.min(cfg.maxSpendPerTurn, affordable);
    this.lastSpentBudget = 0;
    if (maxSpend < 1) { this.spawnEndlessReward(turn); return; }
    // Spend a random fraction of the affordable budget (0..maxSpend) for natural variance.
    const spendTarget = Math.floor(this.random() * (maxSpend + 1));
    // 3) Buy enemies with the budget.
    let remaining = spendTarget;
    let attempts = 0;
    while (remaining >= 1 && this.state.enemies.length < cfg.enemyCap && attempts < 8) {
      attempts++;
      const wantLarge = this.random() < curveLargeChance(turn);
      const size: 1 | 2 = wantLarge && remaining >= 3 ? 2 : 1;
      const cost = size === 2 ? 3 : 1;
      const placement = this.firstAvailableEnemyPlacement(size);
      if (!placement) break;
      const hp = size === 2
        ? largeEnemyHpFor(turn, cfg.hpMultiplier, cfg.largeEnemyHpMultiplier, this.random)
        : enemyHpFor(turn, cfg.hpMultiplier, this.random);
      const id = crypto.randomUUID().slice(0, 6);
      this.state.enemies.push({ id, ...placement, width: size, height: size, hp, maxHp: hp, moyuValue: this.moyuValueForNewEnemy(), skin: this.enemySkin(id, size) });
      remaining -= cost;
      this.budgetBank -= cost;
      this.lastSpentBudget += cost;
      this.record({ type: 'enemy-spawned', subjectId: id, value: hp, message: `Curve spawned ${size}×${size} enemy hp ${hp} (T${turn})` });
    }
    // Currency is carried by enemies in Moyu Economy V2; never spawn RewardBalls.
  }

  /** Formula-driven reward ball: chance decays ~85%→65%; bad-luck protection after 2 dry turns. */
  private spawnEndlessReward(turn: number) {
    const cfg = ENDLESS_CURVE_V1;
    if (!cfg.rewardSpawning) return;
    if (this.state.rewardBalls.length >= 5) return;
    const chance = rewardChanceFor(turn) * cfg.rewardMultiplier;
    const force = this.rewardDryTurns >= 2; // bad-luck protection
    if (!force && this.random() >= chance) { this.rewardDryTurns++; return; }
    this.rewardDryTurns = 0;
    const highestPlant = Math.max(1, ...this.state.plants.flatMap(row => row.filter((plant): plant is Plant => plant !== null).map(plant => plant.value)));
    const maxValue = rewardMaxFor(highestPlant, cfg.maxNaturalSpawnValue);
    const values = [1, 2, 4, 8].filter(v => v <= maxValue);
    if (!values.length) return;
    const placement = this.firstAvailableRewardPlacement();
    if (!placement) return;
    const value = values[Math.min(values.length - 1, Math.floor(this.random() * values.length))];
    const id = crypto.randomUUID().slice(0, 6);
    this.addRewardBall({ id, ...placement, value, spawnTurn: turn });
    this.currentMetrics.rewardSpawnValue += value;
    this.record({ type: 'reward-spawned', subjectId: id, value, col: placement.col, lane: placement.row, message: `Curve reward ${value} at col ${placement.col} (T${turn})` });
  }

  /** Diagnostics for the Debug Panel: current formula values at this turn. */
  formulaDiagnostics() {
    const cfg = ENDLESS_CURVE_V1;
    const turn = Math.max(1, this.state.turn);
    const baseHp = Math.max(1, Math.round(0.16 * Math.pow(turn, 1.62)));
    return {
      turn,
      baseHp,
      hpRange: `${Math.max(1, Math.round(baseHp * cfg.hpMultiplier * 0.85))}–${Math.max(1, Math.round(baseHp * cfg.hpMultiplier * 1.15))}`,
      budget10: +(2.5 * Math.pow(turn, 0.53) * cfg.budgetMultiplier).toFixed(1),
      budgetBank: this.budgetBank.toFixed(2),
      spentThisTurn: this.lastSpentBudget,
      largeChance: curveLargeChance(turn),
      rewardChance: rewardChanceFor(turn) * cfg.rewardMultiplier,
    };
  }

  /* ═══ REWARD_ECONOMY_CURVE_V2 ═══
   * Spawn director: accrues enemy HP budget from the STANDARD player curve
   * (never the real player), then spends the bank across turns to create a
   * natural ebb and flow. Individual enemy HP ≈ expectedPower × 0.9.
   */
  private spawnRewardEconomy() {
    const cfg = REWARD_ECONOMY_CURVE_V2;
    if (!cfg.automaticEnemySpawning) return;
    const turn = this.state.turn;
    // 1) Refresh the standard-player cumulative expected reward (turns 1..T).
    this.cumulativeExpectedGeneratedV2 = cumulativeExpectedMoyuValue(turn, this.moyuCarrierChance(), this.moyuStages());
    // 2) Accrue enemy HP budget for this turn.
    const income = hpIncomeBudget(turn, this.cumulativeExpectedGeneratedV2, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate);
    this.lastIncomeHpBudgetV2 = income;
    // Volume is applied as income, not merely as a slower spending valve.
    // This makes a new 0.4 run truly generate 40% of the V2 budget pressure.
    this.lastEffectiveIncomeHpBudgetV2 = income * REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier;
    // At most two effective-income turns may remain banked. This also clamps
    // an old 1.0 bank immediately after the tester lowers Enemy Volume.
    this.lastMaxHpBudgetBankV2 = this.lastEffectiveIncomeHpBudgetV2 * 2;
    this.hpBudgetBankV2 = Math.min(this.hpBudgetBankV2 + this.lastEffectiveIncomeHpBudgetV2, this.lastMaxHpBudgetBankV2);
    this.lastSpentHpBudgetV2 = 0;
    // 3) Spend a capped, random fraction of the effective bank. The V2
    // spending cap remains unchanged; Volume has already scaled the income.
    const maxSpend = Math.min(cfg.maxSpendPerTurn, this.hpBudgetBankV2);
    this.lastAllowedSpendHpBudgetV2 = maxSpend;
    const spendTarget = maxSpend >= 1 ? Math.floor(this.random() * (Math.floor(maxSpend) + 1)) : 0;
    let remaining = spendTarget;
    let attempts = 0;
    while (remaining >= 1 && this.state.enemies.length < REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap && attempts < 8) {
      attempts++;
      // 2×2 unlocks with the same turn-based ramp as before (0 → 25% by T100).
      const wantLarge = this.random() < curveLargeChance(turn) * REWARD_ECONOMY_TEST_CONTROLS.largeEnemyRateMultiplier;
      let size: 1 | 2 = wantLarge ? 2 : 1;
      let cost = size === 2 ? 1.8 : 1.0;
      // Never let an expensive 2×2 spend past the allowed per-turn budget.
      if (cost > remaining) {
        if (remaining < 1) break;
        size = 1;
        cost = 1;
      }
      const placement = this.firstAvailableEnemyPlacement(size);
      if (!placement) break;
      const rawHp = size === 2
        ? largeEnemyHpV2(turn, this.cumulativeExpectedGeneratedV2, this.random, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate)
        : normalEnemyHp(turn, this.cumulativeExpectedGeneratedV2, this.random, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate);
      const hp = Math.max(1, Math.round(rawHp * REWARD_ECONOMY_TEST_CONTROLS.enemyHpMultiplier));
      const id = crypto.randomUUID().slice(0, 6);
      this.state.enemies.push({ id, ...placement, width: size, height: size, hp, maxHp: hp, moyuValue: this.moyuValueForNewEnemy(), skin: this.enemySkin(id, size) });
      remaining -= cost;
      this.hpBudgetBankV2 -= cost;
      this.lastSpentHpBudgetV2 += cost;
      this.record({ type: 'enemy-spawned', subjectId: id, value: hp, message: `Economy spawned ${size}×${size} enemy hp ${hp} (T${turn})` });
    }
    // Currency is carried by enemies in Moyu Economy V2; never spawn RewardBalls.
  }

  /** V2 reward: ~80% chance per turn, forced after `rewardForceAfterDryTurns` dry turns. */
  private spawnRewardEconomyBall(turn: number) {
    const cfg = REWARD_ECONOMY_CURVE_V2;
    if (!cfg.rewardSpawning) return;
    if (this.state.rewardBalls.length >= 5) return;
    const force = this.dryRewardTurnsV2 >= cfg.rewardForceAfterDryTurns;
    const chance = this.finalRewardSpawnChance();
    if (!force && this.random() >= chance) { this.dryRewardTurnsV2++; return; }
    this.dryRewardTurnsV2 = 0;
    const weights = rewardValueWeights(turn, cfg.maxNaturalSpawnValue, this.rewardWeightOptions());
    const allowedMax = rewardMaxByTurn(turn, cfg.maxNaturalSpawnValue);
    const allowed = [1, 2, 4, 8].filter(v => v <= allowedMax);
    let roll = this.random();
    let value = allowed[0];
    for (const v of allowed) { roll -= weights.get(v) ?? 0; if (roll < 0) { value = v; break; } }
    const placement = this.firstAvailableRewardPlacement();
    if (!placement) return;
    const id = crypto.randomUUID().slice(0, 6);
    this.addRewardBall({ id, ...placement, value, spawnTurn: turn });
    this.currentMetrics.rewardSpawnValue += value;
    this.record({ type: 'reward-spawned', subjectId: id, value, col: placement.col, lane: placement.row, message: `Economy reward ${value} at col ${placement.col} (T${turn})` });
  }

  /** V2 diagnostics for the Debug Panel: the full economy chain. */
  rewardEconomyDiagnostics() {
    const cfg = REWARD_ECONOMY_CURVE_V2;
    const turn = Math.max(1, this.state.turn);
    // Retained solely for legacy diagnostic fields while the panel migrates to
    // Moyu labels; it is not used by the active enemy-budget calculation.
    const options = this.rewardWeightOptions();
    const carrierChance = this.moyuCarrierChance();
    const stages = this.moyuStages();
    const activeMoyuStage = [...stages].reverse().find(stage => turn >= stage.startTurn) ?? stages[0];
    const cumExpected = cumulativeExpectedMoyuValue(turn, carrierChance, stages);
    const expectedPower = expectedPlantPower(turn, cumExpected, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate);
    const factor = difficultyFactor(turn);
    const income = expectedPower * factor;
    return {
      turn,
      rewardMax: rewardMaxByTurn(turn, cfg.maxNaturalSpawnValue),
      rewardWeights: Object.fromEntries(rewardValueWeights(turn, cfg.maxNaturalSpawnValue, options)),
      rewardAlpha: +rewardWeightAlpha(turn, options).toFixed(3),
      singleRewardExpected: +expectedSingleRewardValue(turn, cfg.maxNaturalSpawnValue, options).toFixed(2),
      expectedGeneratedThisTurn: +expectedMoyuValueForTurn(turn, carrierChance, stages).toFixed(2),
      expectedGeneratedCumulative: +cumExpected.toFixed(1),
      expectedPlantPower: +expectedPower.toFixed(1),
      difficultyFactor: +factor.toFixed(3),
      hpIncomeBudget: +income.toFixed(1),
      hpBudgetBank: this.hpBudgetBankV2.toFixed(1),
      spentThisTurn: this.lastSpentHpBudgetV2,
      normalEnemyTargetHp: +(normalEnemyTargetHp(turn, cumExpected, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate) * REWARD_ECONOMY_TEST_CONTROLS.enemyHpMultiplier).toFixed(1),
      enemyVolumeMultiplier: REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier,
      enemyHpMultiplier: REWARD_ECONOMY_TEST_CONTROLS.enemyHpMultiplier,
      rewardRateMultiplier: REWARD_ECONOMY_TEST_CONTROLS.rewardRateMultiplier,
      largeEnemyRateMultiplier: REWARD_ECONOMY_TEST_CONTROLS.largeEnemyRateMultiplier,
      enemyCount: this.state.enemies.length,
      enemyCountCap: REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap,
      theoreticalHpBudget: +this.lastIncomeHpBudgetV2.toFixed(1),
      effectiveHpBudgetIncome: +this.lastEffectiveIncomeHpBudgetV2.toFixed(1),
      allowedSpendBudget: +this.lastAllowedSpendHpBudgetV2.toFixed(1),
      actualSpendBudget: +this.lastSpentHpBudgetV2.toFixed(1),
      maxBudgetBank: +this.lastMaxHpBudgetBankV2.toFixed(1),
      baselineCaptureRate: REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate,
      rewardProgression: REWARD_ECONOMY_TEST_CONTROLS.rewardProgression,
      highValueBias: REWARD_ECONOMY_TEST_CONTROLS.highValueBias,
      finalRewardSpawnChance: +carrierChance.toFixed(2),
      moyuCarrierChance: +carrierChance.toFixed(2),
      moyuStageValues: activeMoyuStage.values,
    };
  }
  /** Immediately discard excess old bank when a tester lowers Enemy Volume. */
  reconcileRewardEconomyBudgetBank() {
    if (this.mode !== 'reward-economy') return;
    const cfg = REWARD_ECONOMY_CURVE_V2;
    const turn = Math.max(1, this.state.turn);
    const expected = cumulativeExpectedMoyuValue(turn, this.moyuCarrierChance(), this.moyuStages());
    const theoretical = hpIncomeBudget(turn, expected, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate);
    this.lastIncomeHpBudgetV2 = theoretical;
    this.lastEffectiveIncomeHpBudgetV2 = theoretical * REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier;
    this.lastMaxHpBudgetBankV2 = this.lastEffectiveIncomeHpBudgetV2 * 2;
    this.hpBudgetBankV2 = Math.min(this.hpBudgetBankV2, this.lastMaxHpBudgetBankV2);
    this.lastAllowedSpendHpBudgetV2 = Math.min(cfg.maxSpendPerTurn, this.hpBudgetBankV2);
  }
  /** Spawn-director visibility for the Debug Panel; 2×2 units count in both covered lanes. */
  laneDistributionDiagnostics() {
    const minTurn = Math.max(1, this.state.turn - 9);
    const recentEnemySpawns = Array.from({ length: BOARD.rows }, (_, row) => this.laneSpawnHistory
      .filter(entry => entry.kind === 'enemy' && entry.turn >= minTurn && row >= entry.row && row < entry.row + entry.height).length);
    return {
      enemyCounts: Array.from({ length: BOARD.rows }, (_, row) => this.laneEnemyCount(row)),
      recentEnemySpawns,
    };
  }
  private largeEnemyChance(): number {
    return largeEnemyChanceFor(this.state.score, this.rules);
  }
  private trySpawn(size: 1 | 2): boolean {
    const placement = this.firstAvailableEnemyPlacement(size);
    const kind = size === 2 ? 'large' : 'normal';
    if (!placement) { this.rejectSpawn({ kind, outcome: 'rejected', reason: 'occupancy', hp: 0, row: 0, col: BOARD.battlefieldCols - size, width: size, height: size, remainingTurns: 0, relevantLanePower: 0, requiredUtilization: Infinity, batchPressure: 0, predictedPressureRatio: Infinity }); return false; }
    const turn = this.state.turn;
    const normalHp = this.rules.enemyHpBase + Math.floor(turn * this.rules.enemyHpGrowthPerTurn);
    const baseHp = Math.max(1, Math.floor(normalHp * (size === 2 ? this.rules.largeEnemyHpMultiplier : 1)));
    const remainingTurns = placement.col + 1;
    const relevantLanePower = this.plantPowerForRows(placement.row, size);
    const maxUtilization = size === 2 ? this.rules.largeEnemyMaxRequiredUtilization : this.rules.normalEnemyMaxRequiredUtilization;
    const currentPressure = this.battlefieldPressure();
    const maxByUtilization = Math.floor(relevantLanePower * remainingTurns * maxUtilization);
    const maxByPressure = Math.floor(Math.max(0, this.rules.hardPressureCap * this.plantPower() - currentPressure) * remainingTurns);
    const hp = Math.min(baseHp, maxByUtilization, maxByPressure);
    const requiredUtilization = relevantLanePower && remainingTurns ? hp / (relevantLanePower * remainingTurns) : Infinity;
    const batchPressure = hp / Math.max(1, remainingTurns);
    const predictedPressureRatio = this.plantPower() ? (currentPressure + batchPressure) / this.plantPower() : Infinity;
    const safety: SpawnSafetyRecord = { kind, outcome: hp >= 1 ? 'spawned' : 'rejected', reason: hp >= 1 ? undefined : (maxByUtilization < 1 ? 'requiredUtilization' : 'hardPressureCap'), hp: Math.max(0, hp), ...placement, width: size, height: size, remainingTurns, relevantLanePower, requiredUtilization, batchPressure, predictedPressureRatio };
    if (hp < 1 || requiredUtilization > maxUtilization || predictedPressureRatio > this.rules.hardPressureCap) { this.rejectSpawn(safety); return false; }
    const id = crypto.randomUUID().slice(0, 6);
    const enemy = { id, ...placement, width: size, height: size, hp, maxHp: hp, moyuValue: this.moyuValueForNewEnemy(), skin: this.enemySkin(id, size) };
    this.state.enemies.push(enemy);
    this.state.spawnSafety.push(safety);
    this.record({ type: 'enemy-spawned', subjectId: id, value: hp, requiredUtilization, predictedPressureRatio, message: `Wave spawned ${size}×${size} enemy hp ${hp}` });
    return true;
  }
  private rejectSpawn(safety: SpawnSafetyRecord) {
    this.state.spawnSafety.push(safety);
    this.record({ type: 'spawn-rejected', reason: safety.reason, requiredUtilization: safety.requiredUtilization, predictedPressureRatio: safety.predictedPressureRatio, message: `SPAWN_REJECTED: ${safety.reason}` });
    if (this.rules.metricsLogging) console.info('SPAWN_REJECTED', safety);
  }

  /** A reward ball belongs to an enemy spawn batch; it is never a direct birth-slot grant. */
  private spawnRewardWithEnemy(enemy: Enemy) {
    if (this.state.rewardBalls.length >= 5) return; // keep the field readable
    if (this.random() >= this.rules.rewardSpawnChance) return;
    const highestPlant = Math.max(1, ...this.state.plants.flatMap(row => row.filter((plant): plant is Plant => plant !== null).map(plant => plant.value)));
    const maxRewardValue = Math.min(this.rules.maxNaturalSpawnValue, maxRewardValueFor(highestPlant));
    const values = this.rules.naturalSpawnValues.filter(v => v > 0 && v <= maxRewardValue);
    if (!values.length) return;
    const placement = this.firstAvailableRewardPlacement();
    if (!placement) return;
    const { row, col } = placement;
    const value = this.pickWeightedReward(values);
    const id = crypto.randomUUID().slice(0, 6);
    this.addRewardBall({ id, row, col, value, spawnTurn: this.state.turn });
    this.currentMetrics.rewardSpawnValue += value;
    this.record({ type: 'reward-spawned', subjectId: id, value, col, lane: row, message: `Reward ${value} spawned with enemy ${enemy.id} at col ${col}` });
  }
  private pickWeightedReward(values: number[]): number {
    const total = values.reduce((sum, value) => sum + (this.rules.rewardWeights[value] ?? 1), 0);
    let roll = this.random() * total;
    for (const value of values) { roll -= this.rules.rewardWeights[value] ?? 1; if (roll < 0) return value; }
    return values.at(-1)!;
  }
  debugSpawnReward(value = 4) {
    const placement = this.firstAvailableRewardPlacement();
    if (!placement) { this.record({ type: 'spawn-blocked', message: 'Debug reward blocked by occupied cells' }); return false; }
    const id = crypto.randomUUID().slice(0, 6);
    this.addRewardBall({ id, ...placement, value, spawnTurn: this.state.turn });
    this.record({ type: 'reward-spawned', subjectId: id, value, message: `Debug spawned reward ${value}` });
    return true;
  }
  private addRewardBall(ball: RewardBall) {
    this.state.rewardBalls.push(ball);
    this.state.rewardLedger.push({ id: ball.id, value: ball.value, spawnTurn: ball.spawnTurn ?? this.state.turn });
  }
  private plantPower() { return this.state.plants.flat().reduce((sum, plant) => sum + (plant?.value ?? 0), 0); }
  private plantPowerForRows(startRow: number, height: number) { return this.state.plants.slice(startRow, startRow + height).flat().reduce((sum, plant) => sum + (plant?.value ?? 0), 0); }
  private battlefieldPressure() { return this.state.enemies.reduce((sum, enemy) => sum + enemy.hp / Math.max(1, enemy.col + 1), 0); }
  private recordMetrics() {
    const plantPower = this.plantPower();
    const highestPlantValue = Math.max(0, ...this.state.plants.flat().map(plant => plant?.value ?? 0));
    const battlefieldPressure = this.battlefieldPressure();
    const windowStart = Math.max(0, this.state.turn - this.cfg.metricsWindowTurns + 1);
    const generatedInWindow = this.state.rewardLedger.filter(entry => entry.spawnTurn >= windowStart && entry.spawnTurn <= this.state.turn);
    const spawned = generatedInWindow.reduce((sum, entry) => sum + entry.value, 0);
    const reachable = generatedInWindow.filter(entry => entry.reachableTurn !== undefined && entry.reachableTurn <= this.state.turn).reduce((sum, entry) => sum + entry.value, 0);
    const captured = generatedInWindow.filter(entry => entry.capturedTurn !== undefined && entry.capturedTurn <= this.state.turn).reduce((sum, entry) => sum + entry.value, 0);
    // REWARD_ECONOMY: realized = value actually placed onto the board in the window.
    // state.rewardRealized[i] corresponds to turn i+1; window covers turns [windowStart, turn].
    const realized = this.state.rewardRealized.slice(windowStart - 1, this.state.turn).reduce((sum, v) => sum + (v ?? 0), 0);
    const turnSafe = Math.max(1, this.state.turn);
    const cumExpected = cumulativeExpectedMoyuValue(turnSafe, this.moyuCarrierChance(), this.moyuStages());
    const expectedPower = expectedPlantPower(turnSafe, cumExpected, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate);
    const factor = difficultyFactor(turnSafe);
    const metric: TurnMetrics = {
      turn: this.state.turn, score: this.state.score, plantPower,
      theoreticalDamage: this.currentMetrics.theoreticalDamage,
      effectiveEnemyDamage: this.currentMetrics.effectiveEnemyDamage,
      firepowerUtilization: this.currentMetrics.theoreticalDamage ? this.currentMetrics.effectiveEnemyDamage / this.currentMetrics.theoreticalDamage : 0,
      rewardSpawnValue: this.currentMetrics.rewardSpawnValue, rewardCapturedValue: this.currentMetrics.rewardCapturedValue, rewardReachableValue: reachable,
      rewardCaptureRate: spawned ? captured / spawned : 0, rewardOpportunityCaptureRate: reachable ? captured / reachable : 0, rollingRewardSpawnValue: spawned, rollingRewardReachableValue: reachable, rollingRewardCapturedValue: captured,
      battlefieldPressure, pressureRatio: plantPower ? battlefieldPressure / plantPower : 0,
      enemyCount: this.state.enemies.length, highestPlantValue,
      pendingSpawnBatchPressure: this.state.spawnSafety.filter(entry => entry.outcome === 'spawned').reduce((sum, entry) => sum + entry.batchPressure, 0),
      predictedSpawnPressureRatio: this.state.spawnSafety.at(-1)?.predictedPressureRatio ?? (plantPower ? battlefieldPressure / plantPower : 0),
      rewardRealizedValue: this.currentMetrics.rewardRealizedValue,
      rollingRewardRealizedValue: realized,
      rewardRealizationRate: captured ? realized / captured : 0,
      expectedPlantPower: +expectedPower.toFixed(1),
      difficultyFactor: +factor.toFixed(3),
      hpIncomeBudget: +(expectedPower * factor).toFixed(1),
      hpBudgetBank: +this.hpBudgetBankV2.toFixed(1),
      normalEnemyTargetHp: +(normalEnemyTargetHp(turnSafe, cumExpected, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate)).toFixed(1),
      totalProjectileDamagePotential: this.currentMetrics.theoreticalDamage,
      enemyDamageDealt: this.currentMetrics.effectiveEnemyDamage,
      overkillWaste: this.currentMetrics.overkillWaste,
      moyuInterceptWaste: this.currentMetrics.moyuInterceptWaste,
      moyuCollectedValue: this.currentMetrics.moyuCollectedValue,
      moyuPickupCount: this.currentMetrics.moyuPickupCount,
      autoRecoveredMoyuValue: this.currentMetrics.autoRecoveredMoyuValue,
      currentMoyu: this.state.moyuBank,
      moyuCapacity: this.moyuCapacity(),
      highestDefenderValue: this.state.highestDefenderValue,
      totalMoyuGenerated: this.state.totalMoyuGenerated,
      totalMoyuEarned: this.state.totalMoyuEarned,
      totalMoyuExtracted: this.state.totalMoyuExtracted,
      totalMoyuDismissalCost: this.state.totalMoyuDismissalCost,
      totalMoyuOverflow: this.state.totalMoyuOverflow,
    };
    this.state.metrics.push(metric);
    if (this.cfg.metricsLogging) console.info('[Difficulty metrics]', metric);
  }
  private record(event: TurnEvent) {
    this.state.events.push(event);
    this.state.lastLog.push(event.message);
    if (event.type !== 'enemy-spawned' && event.type !== 'reward-spawned') return;
    const entity = event.type === 'enemy-spawned'
      ? this.state.enemies.find(enemy => enemy.id === event.subjectId)
      : this.state.rewardBalls.find(ball => ball.id === event.subjectId);
    if (!entity) return;
    const height: 1 | 2 = event.type === 'enemy-spawned' ? (entity as Enemy).height : 1;
    this.laneSpawnHistory.push({ turn: this.state.turn, row: entity.row, height, kind: event.type === 'enemy-spawned' ? 'enemy' : 'reward' });
    this.laneSpawnHistory = this.laneSpawnHistory.filter(entry => entry.turn >= Math.max(1, this.state.turn - 9));
    if (event.type === 'enemy-spawned') this.recentEnemyLaneAnchors = [...this.recentEnemyLaneAnchors, entity.row].slice(-2);
  }
  projectileCount(_value: number) { return 1; }
  snapshot() { return clone(this.state); }
  /** Export only stable logic state; projectiles and animation state are intentionally absent. */
  exportRunSnapshot(): TurnManagerRunSnapshot {
    return clone({
      state: this.state,
      runtime: {
        budgetBank: this.budgetBank,
        rewardDryTurns: this.rewardDryTurns,
        lastSpentBudget: this.lastSpentBudget,
        hpBudgetBankV2: this.hpBudgetBankV2,
        cumulativeExpectedGeneratedV2: this.cumulativeExpectedGeneratedV2,
        dryRewardTurnsV2: this.dryRewardTurnsV2,
        lastSpentHpBudgetV2: this.lastSpentHpBudgetV2,
        lastIncomeHpBudgetV2: this.lastIncomeHpBudgetV2,
        lastEffectiveIncomeHpBudgetV2: this.lastEffectiveIncomeHpBudgetV2,
        lastAllowedSpendHpBudgetV2: this.lastAllowedSpendHpBudgetV2,
        lastMaxHpBudgetBankV2: this.lastMaxHpBudgetBankV2,
        laneSpawnHistory: this.laneSpawnHistory,
        recentEnemyLaneAnchors: this.recentEnemyLaneAnchors,
      },
    });
  }
  /** Restore a previously validated stable snapshot without restoring any visuals. */
  restoreRunSnapshot(snapshot: TurnManagerRunSnapshot) {
    const saved = clone(snapshot);
    this.state = saved.state;
    this.budgetBank = saved.runtime.budgetBank;
    this.rewardDryTurns = saved.runtime.rewardDryTurns;
    this.lastSpentBudget = saved.runtime.lastSpentBudget;
    this.hpBudgetBankV2 = saved.runtime.hpBudgetBankV2;
    this.cumulativeExpectedGeneratedV2 = saved.runtime.cumulativeExpectedGeneratedV2;
    this.dryRewardTurnsV2 = saved.runtime.dryRewardTurnsV2;
    this.lastSpentHpBudgetV2 = saved.runtime.lastSpentHpBudgetV2;
    this.lastIncomeHpBudgetV2 = saved.runtime.lastIncomeHpBudgetV2;
    this.lastEffectiveIncomeHpBudgetV2 = saved.runtime.lastEffectiveIncomeHpBudgetV2;
    this.lastAllowedSpendHpBudgetV2 = saved.runtime.lastAllowedSpendHpBudgetV2;
    this.lastMaxHpBudgetBankV2 = saved.runtime.lastMaxHpBudgetBankV2;
    this.laneSpawnHistory = saved.runtime.laneSpawnHistory;
    this.recentEnemyLaneAnchors = saved.runtime.recentEnemyLaneAnchors;
    this.pendingMoyuDrops = [];
  }
}
