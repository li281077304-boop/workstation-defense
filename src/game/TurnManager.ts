import { BOARD, ACTIVE_DIFFICULTY, ENDLESS_CURVE_V1, REWARD_ECONOMY_CURVE_V2, REWARD_ECONOMY_TEST_CONTROLS, largeEnemyChanceFor, maxRewardValueFor, type CombatRules } from './config';
import { cumulativeExpectedGeneratedReward, difficultyFactor, enemyHpFor, expectedPlantPower, expectedRewardPerTurn, expectedSingleRewardValue, hpIncomeBudget, largeEnemyChanceFor as curveLargeChance, largeEnemyHpFor, largeEnemyHpV2, normalEnemyHp, normalEnemyTargetHp, perTurnBudget, rewardChanceFor, rewardMaxByTurn, rewardMaxFor, rewardValueWeights, rewardWeightAlpha, type RewardWeightOptions } from './difficulty';
import type { Enemy, GameState, Move, Plant, Projectile, RewardBall, SpawnSafetyRecord, TurnEvent, TurnMetrics } from './types';

const key = (r: number, c: number) => `${r}:${c}`;
const clone = <T>(v: T): T => structuredClone(v);

export function emptyState(): GameState {
  return { plants: Array.from({ length: BOARD.rows }, () => Array<Plant | null>(BOARD.defenseCols).fill(null)), enemies: [], rewardBalls: [], birthSlot: null, score: 0, turn: 0, gameOver: false, lastLog: [], events: [], metrics: [], rewardLedger: [], spawnSafety: [], rewardRealized: [] };
}

export class TurnManager {
  private currentMetrics = { theoreticalDamage: 0, effectiveEnemyDamage: 0, rewardSpawnValue: 0, rewardCapturedValue: 0, rewardRealizedValue: 0 };
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
  constructor(public state: GameState = emptyState(), public rules: CombatRules, private random: () => number = Math.random, public forcedMode?: 'baseline' | 'endless-curve' | 'reward-economy') {}

  /** Effective config for the active difficulty mode. */
  private get cfg() {
    return this.mode === 'endless-curve' ? ENDLESS_CURVE_V1 : this.mode === 'reward-economy' ? REWARD_ECONOMY_CURVE_V2 : this.rules;
  }
  private get mode() {
    return this.forcedMode ?? ACTIVE_DIFFICULTY.mode;
  }
  /** Cosmetic selection is deliberately independent from HP, Turn, and all combat math. */
  private enemySkin(id: string, size: 1 | 2): string {
    const regular = ['enemy-basic-01', 'enemy-basic-02', 'enemy-basic-03', 'enemy-basic-04', 'enemy-basic-05', 'enemy-basic-06'];
    // Current art has one large base; the three cosmetic IDs let the renderer
    // apply distinct visual treatments without implying different armor/HP.
    const large = ['enemy-large-moss', 'enemy-large-rust', 'enemy-large-violet'];
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

  perform(move: Move): boolean {
    if (this.state.gameOver || !this.applyMove(move)) return false;
    this.state.turn++;
    this.state.lastLog = [];
    this.state.events = [];
    this.state.spawnSafety = [];
    this.currentMetrics = { theoreticalDamage: 0, effectiveEnemyDamage: 0, rewardSpawnValue: 0, rewardCapturedValue: 0, rewardRealizedValue: 0 };
    this.record({ type: 'turn-start', message: `Turn ${this.state.turn}: firing` });
    this.fireAll();
    this.advanceEnemies();
    this.advanceRewardBalls();
    if (!this.state.gameOver) {
      if (this.mode === 'reward-economy') {
        this.spawnRewardEconomy();
      } else if (this.mode === 'endless-curve') {
        this.spawnEndlessCurve();
      } else if (this.cfg.automaticEnemySpawning) {
        for (let i = 0; i < this.rules.enemiesPerTurn; i++) this.spawnAutomatic();
      }
    }
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
      this.state.birthSlot = null;
      // REWARD_ECONOMY: persist realized value (index = new turn - 1, since turn++ happens after applyMove).
      this.state.rewardRealized.push(realizedValue);
      return true;
    }
    const source = this.state.plants[move.from.row]?.[move.from.col];
    if (!source || (move.from.row === move.to.row && move.from.col === move.to.col)) return false;
    if (!dst) { this.state.plants[move.to.row][move.to.col] = source; this.state.plants[move.from.row][move.from.col] = null; return true; }
    if (source.value === dst.value) { this.state.plants[move.to.row][move.to.col] = { id: crypto.randomUUID(), value: source.value * 2 }; this.state.plants[move.from.row][move.from.col] = null; return true; }
    this.state.plants[move.to.row][move.to.col] = source; this.state.plants[move.from.row][move.from.col] = dst; return true;
  }

  private fireAll() {
    this.markReachableRewards();
    for (let row = 0; row < BOARD.rows; row++) {
      for (const plant of this.state.plants[row]) if (plant) {
        this.currentMetrics.theoreticalDamage += plant.value;
        for (const projectile of this.createProjectiles(plant.value, row)) {
          projectile.sourcePlantId = plant.id;
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

  /** Confirmed Android rule: min(value, 4) separate shots, each with divisible damage. */
  createProjectiles(value: number, lane: number): Projectile[] {
    const projectileCount = Math.min(value, 4);
    return Array.from({ length: projectileCount }, () => ({ remainingDamage: value / projectileCount, lane, position: 0 }));
  }

  /** Exposed for deterministic rules tests; the scene never calls it directly. */
  resolveProjectile(projectile: Projectile) {
    this.record({ type: 'shot', lane: projectile.lane, damage: projectile.remainingDamage, sourcePlantId: projectile.sourcePlantId, message: `Lane ${projectile.lane + 1} shot ${projectile.remainingDamage}` });
    while (projectile.remainingDamage > 0) {
      const target = this.nextTarget(projectile.lane, projectile.position);
      if (!target) return;
      projectile.position = target.col;
      if (target.kind === 'reward') {
        this.record({ type: 'reward-hit', lane: projectile.lane, col: target.col, subjectId: target.ball.id, value: target.ball.value, damage: projectile.remainingDamage, message: `Lane ${projectile.lane + 1} hit reward ${target.ball.value}` });
        const previousSlot = this.state.birthSlot;
        this.state.rewardBalls = this.state.rewardBalls.filter(ball => ball.id !== target.ball.id);
        const ledger = this.state.rewardLedger.find(entry => entry.id === target.ball.id);
        if (ledger) ledger.capturedTurn = this.state.turn;
        this.currentMetrics.rewardCapturedValue += target.ball.value;
        this.record({ type: 'reward-captured', lane: projectile.lane, col: target.col, subjectId: target.ball.id, value: target.ball.value, damage: projectile.remainingDamage, message: `Lane ${projectile.lane + 1} captured reward ${target.ball.value}; projectile blocked` });
        this.replaceBirthIfHigher(target.ball.value);
        if (this.state.birthSlot !== previousSlot) this.record({ type: 'spawn-slot-updated', value: this.state.birthSlot!, message: `Birth slot updated to ${this.state.birthSlot}` });
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
        return;
      }
      projectile.remainingDamage -= hpBefore;
      this.kill(target.enemy, target.col);
      this.record({ type: 'pierce', lane: projectile.lane, col: target.col, subjectId: target.enemy.id, remainingDamage: projectile.remainingDamage, message: `Lane ${projectile.lane + 1} pierced ${target.enemy.id}; ${projectile.remainingDamage} remains` });
    }
  }

  private nextTarget(lane: number, after: number): { kind: 'enemy'; enemy: Enemy; col: number } | { kind: 'reward'; ball: RewardBall; col: number } | null {
    const enemies = this.state.enemies.filter(enemy => lane >= enemy.row && lane < enemy.row + enemy.height && enemy.col >= after)
      .map(enemy => ({ kind: 'enemy' as const, enemy, col: enemy.col }));
    const rewards = this.state.rewardBalls.filter(ball => ball.row === lane && ball.col >= after)
      .map(ball => ({ kind: 'reward' as const, ball, col: ball.col }));
    // Same-cell enemy/reward ordering has not been observed; reward first is a conservative blocker.
    return [...enemies, ...rewards].sort((a, b) => a.col - b.col || (a.kind === 'reward' ? -1 : 1))[0] ?? null;
  }

  private kill(enemy: Enemy, col: number) {
    this.state.enemies = this.state.enemies.filter(e => e.id !== enemy.id);
    if (this.rules.scoreMode === 'kill') this.state.score += enemy.maxHp;
    else if (this.rules.scoreMode === 'damage') this.state.score += enemy.hp; // last hit that killed it
    this.record({ type: 'kill', lane: enemy.row, col, subjectId: enemy.id, value: enemy.maxHp, message: `Defeated ${enemy.id} (+${enemy.maxHp})` });
  }

  private advanceEnemies() {
    const occupiedBeforeAdvance = this.state.enemies.map(enemy => ({ ...enemy }));
    for (const enemy of this.state.enemies) {
      const next = { ...enemy, col: enemy.col - 1 };
      const conflicts = occupiedBeforeAdvance.some(other => other.id !== enemy.id && this.footprintsOverlap(next, other)) ||
        this.state.rewardBalls.some(ball => ball.row >= next.row && ball.row < next.row + next.height && ball.col >= next.col && ball.col < next.col + next.width);
      if (conflicts) {
        this.record({ type: 'spawn-blocked', subjectId: enemy.id, message: `${enemy.id} held position: occupied destination` });
        continue;
      }
      enemy.col = next.col;
      this.record({ type: 'advance', subjectId: enemy.id, message: `${enemy.id} advanced to column ${enemy.col}` });
    }
    if (this.state.enemies.some(e => e.col < 0)) { this.state.gameOver = true; this.record({ type: 'game-over', message: 'GAME OVER: enemy entered defense area' }); }
  }

  private advanceRewardBalls() {
    for (const ball of this.state.rewardBalls) {
      if (ball.col <= 0) continue; // left-edge handling remains deliberately undecided; see OPEN_QUESTIONS.
      if (!this.canPlaceReward(ball.row, ball.col - 1)) {
        this.record({ type: 'spawn-blocked', subjectId: ball.id, message: `Reward ${ball.id} held position: occupied destination` });
        continue;
      }
      ball.col--;
      this.record({ type: 'reward-advance', subjectId: ball.id, lane: ball.row, col: ball.col, message: `Reward ${ball.id} advanced to column ${ball.col}` });
    }
  }

  private replaceBirthIfHigher(value: number) { if (this.state.birthSlot === null || value > this.state.birthSlot) this.state.birthSlot = value; }
  private footprintsOverlap(a: Enemy, b: Enemy): boolean {
    return a.row < b.row + b.height && a.row + a.height > b.row && a.col < b.col + b.width && a.col + a.width > b.col;
  }
  private canPlaceEnemy(candidate: Enemy): boolean {
    return !this.state.enemies.some(enemy => this.footprintsOverlap(candidate, enemy)) &&
      !this.state.rewardBalls.some(ball => ball.row >= candidate.row && ball.row < candidate.row + candidate.height && ball.col >= candidate.col && ball.col < candidate.col + candidate.width);
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
    this.state.enemies.push({ id, ...placement, width: size, height: size, hp, maxHp: hp, skin: this.enemySkin(id, size) });
    this.record({ type: 'debug-spawn', subjectId: this.state.enemies.at(-1)?.id, message: `Debug spawned ${size}×${size} enemy` });
    return true;
  }
  /** Adds the fixed tutorial batch while keeping its reward in the analytics ledger. */
  seedOpeningBatch(enemy: Enemy, reward: RewardBall) {
    if (this.canPlaceEnemy(enemy)) this.state.enemies.push({ ...enemy, skin: enemy.skin ?? this.enemySkin(enemy.id, enemy.width) });
    if (this.canPlaceReward(reward.row, reward.col)) this.addRewardBall({ ...reward, spawnTurn: 0 });
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
      this.state.enemies.push({ id, ...placement, width: size, height: size, hp, maxHp: hp, skin: this.enemySkin(id, size) });
      remaining -= cost;
      this.budgetBank -= cost;
      this.lastSpentBudget += cost;
      this.record({ type: 'enemy-spawned', subjectId: id, value: hp, message: `Curve spawned ${size}×${size} enemy hp ${hp} (T${turn})` });
    }
    // 4) Rewards spawn independently of enemy budget.
    this.spawnEndlessReward(turn);
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
    this.cumulativeExpectedGeneratedV2 = cumulativeExpectedGeneratedReward(turn, this.finalRewardSpawnChance(), cfg.maxNaturalSpawnValue, this.rewardWeightOptions());
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
      this.state.enemies.push({ id, ...placement, width: size, height: size, hp, maxHp: hp, skin: this.enemySkin(id, size) });
      remaining -= cost;
      this.hpBudgetBankV2 -= cost;
      this.lastSpentHpBudgetV2 += cost;
      this.record({ type: 'enemy-spawned', subjectId: id, value: hp, message: `Economy spawned ${size}×${size} enemy hp ${hp} (T${turn})` });
    }
    // 4) Rewards: high frequency + bad-luck protection.
    this.spawnRewardEconomyBall(turn);
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
    const finalRewardSpawnChance = this.finalRewardSpawnChance();
    const options = this.rewardWeightOptions();
    const cumExpected = cumulativeExpectedGeneratedReward(turn, finalRewardSpawnChance, cfg.maxNaturalSpawnValue, options);
    const expectedPower = expectedPlantPower(turn, cumExpected, REWARD_ECONOMY_TEST_CONTROLS.baselineCaptureRate);
    const factor = difficultyFactor(turn);
    const income = expectedPower * factor;
    return {
      turn,
      rewardMax: rewardMaxByTurn(turn, cfg.maxNaturalSpawnValue),
      rewardWeights: Object.fromEntries(rewardValueWeights(turn, cfg.maxNaturalSpawnValue, options)),
      rewardAlpha: +rewardWeightAlpha(turn, options).toFixed(3),
      singleRewardExpected: +expectedSingleRewardValue(turn, cfg.maxNaturalSpawnValue, options).toFixed(2),
      expectedGeneratedThisTurn: +expectedRewardPerTurn(turn, finalRewardSpawnChance, cfg.maxNaturalSpawnValue, options).toFixed(2),
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
      finalRewardSpawnChance: +finalRewardSpawnChance.toFixed(2),
    };
  }
  /** Immediately discard excess old bank when a tester lowers Enemy Volume. */
  reconcileRewardEconomyBudgetBank() {
    if (this.mode !== 'reward-economy') return;
    const cfg = REWARD_ECONOMY_CURVE_V2;
    const turn = Math.max(1, this.state.turn);
    const expected = cumulativeExpectedGeneratedReward(turn, this.finalRewardSpawnChance(), cfg.maxNaturalSpawnValue, this.rewardWeightOptions());
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
    const enemy = { id, ...placement, width: size, height: size, hp, maxHp: hp, skin: this.enemySkin(id, size) };
    this.state.enemies.push(enemy);
    this.state.spawnSafety.push(safety);
    this.record({ type: 'enemy-spawned', subjectId: id, value: hp, requiredUtilization, predictedPressureRatio, message: `Wave spawned ${size}×${size} enemy hp ${hp}` });
    if (this.rules.rewardSpawning) this.spawnRewardWithEnemy(enemy);
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
    const cumExpected = cumulativeExpectedGeneratedReward(turnSafe, this.finalRewardSpawnChance(), REWARD_ECONOMY_CURVE_V2.maxNaturalSpawnValue, this.rewardWeightOptions());
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
  projectileCount(value: number) { return Math.min(value, 4); }
  snapshot() { return clone(this.state); }
}
