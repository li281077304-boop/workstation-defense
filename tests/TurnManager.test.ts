import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, REWARD_ECONOMY_TEST_CONTROLS, restoreRewardEconomyTestDefaults, largeEnemyChanceFor, maxRewardValueFor } from '../src/game/config';
import { TurnManager, emptyState } from '../src/game/TurnManager';

const plant = (value:number) => ({ id: crypto.randomUUID(), value });
describe('confirmed board and turn rules', () => {
  it('merges equal plants and fires the newly created value this turn', () => { const s=emptyState(); s.plants[0][0]=plant(4); s.plants[0][1]=plant(4); s.enemies.push({id:'e',row:0,col:4,width:1,height:1,hp:8,maxHp:8}); const m=new TurnManager(s,DEFAULT_RULES); expect(m.perform({from:{row:0,col:0},to:{row:0,col:1}})).toBe(true); expect(m.state.plants[0][1]?.value).toBe(8); expect(m.state.score).toBe(8); });
  it('birth slot merges equal plant and uses merged value immediately', () => { const s=emptyState(); s.birthSlot=4;s.plants[0][0]=plant(4);s.enemies.push({id:'e',row:0,col:4,width:1,height:1,hp:8,maxHp:8});const m=new TurnManager(s,DEFAULT_RULES);m.perform({from:'birth',to:{row:0,col:0}});expect(m.state.score).toBe(8); });
  it('swaps unequal plants and counts as a turn', () => { const s=emptyState();s.plants[0][0]=plant(2);s.plants[0][1]=plant(8);const m=new TurnManager(s,DEFAULT_RULES);m.perform({from:{row:0,col:0},to:{row:0,col:1}});expect(m.state.plants[0][0]?.value).toBe(8);expect(m.state.turn).toBe(1); });
  it('two-by-two enemy receives fire from either occupied row', () => { const s=emptyState();s.plants[2][0]=plant(4);s.enemies.push({id:'b',row:2,col:5,width:2,height:2,hp:4,maxHp:4});const m=new TurnManager(s,DEFAULT_RULES);m.perform({from:{row:2,col:0},to:{row:2,col:1}});expect(m.state.score).toBe(4); });
  it('ends immediately when an enemy advances into defense', () => { const s=emptyState();s.plants[0][0]=plant(1);s.enemies.push({id:'e',row:1,col:0,width:1,height:1,hp:9,maxHp:9});const m=new TurnManager(s,DEFAULT_RULES);m.perform({from:{row:0,col:0},to:{row:0,col:1}});expect(m.state.gameOver).toBe(true); });
  it('does not spend a turn for an illegal birth-slot drop', () => { const s=emptyState();s.birthSlot=2;s.plants[0][0]=plant(4);const m=new TurnManager(s,DEFAULT_RULES);expect(m.perform({from:'birth',to:{row:0,col:0}})).toBe(false);expect(m.state.turn).toBe(0);expect(m.state.birthSlot).toBe(2); });
  it('pierces an enemy with the unspent damage of one projectile', () => { const s=emptyState();s.enemies.push({id:'first',row:0,col:2,width:1,height:1,hp:5,maxHp:5},{id:'second',row:0,col:3,width:1,height:1,hp:20,maxHp:20});const m=new TurnManager(s,DEFAULT_RULES);m.resolveProjectile({remainingDamage:16,lane:0,position:0});expect(m.state.enemies.find(e=>e.id==='first')).toBeUndefined();expect(m.state.enemies.find(e=>e.id==='second')?.hp).toBe(9);expect(m.state.score).toBe(16); });
  it('score mode kill credits maxHp only at the kill, not per hit', () => { const s=emptyState();s.enemies.push({id:'first',row:0,col:2,width:1,height:1,hp:5,maxHp:5},{id:'second',row:0,col:3,width:1,height:1,hp:20,maxHp:20});const m=new TurnManager(s,{...DEFAULT_RULES,scoreMode:'kill'});m.resolveProjectile({remainingDamage:16,lane:0,position:0});expect(m.state.score).toBe(5); });
  it('R013 starts with an empty birth slot and does not create a plant without a reward capture', () => { const s=emptyState();s.plants[0][0]=plant(1);const m=new TurnManager(s,{...DEFAULT_RULES,automaticEnemySpawning:false,rewardSpawning:false});m.perform({from:{row:0,col:0},to:{row:0,col:1}});expect(emptyState().birthSlot).toBeNull();expect(m.state.birthSlot).toBeNull(); });
  it('ignoring the birth slot keeps its value across turns (HANDOFF 23)', () => { const s=emptyState();s.birthSlot=4;s.plants[0][0]=plant(1);s.plants[0][1]=plant(1);s.enemies.push({id:'e',row:0,col:6,width:1,height:1,hp:50,maxHp:50});const m=new TurnManager(s,{...DEFAULT_RULES,rewardSpawning:false},()=>0);m.perform({from:{row:0,col:0},to:{row:0,col:1}});expect(m.state.birthSlot).toBe(4); });
  it('spawns a debug 2x2 enemy wholly inside the battlefield', () => { const m=new TurnManager(emptyState(),DEFAULT_RULES,()=>0);m.debugSpawnEnemy(2);expect(m.state.enemies[0]).toMatchObject({row:0,col:8,width:2,height:2}); });
  it('R020 never spawns an enemy whose footprint overlaps another enemy', () => { const m=new TurnManager(emptyState(),DEFAULT_RULES,()=>0);m.state.enemies.push({id:'large',row:0,col:8,width:2,height:2,hp:1,maxHp:1});expect(m.debugSpawnEnemy(1)).toBe(true);const small=m.state.enemies.at(-1)!;expect(small.row >= 2 || small.col < 8).toBe(true); });
  it('R020 holds an enemy when its next footprint is occupied', () => { const s=emptyState();s.plants[1][0]=plant(1);s.enemies.push({id:'front',row:0,col:3,width:1,height:1,hp:9,maxHp:9},{id:'rear',row:0,col:4,width:1,height:1,hp:9,maxHp:9});const m=new TurnManager(s,{...DEFAULT_RULES,automaticEnemySpawning:false,rewardSpawning:false});m.perform({from:{row:1,col:0},to:{row:1,col:1}});expect(m.state.enemies.find(e=>e.id==='front')?.col).toBe(2);expect(m.state.enemies.find(e=>e.id==='rear')?.col).toBe(4);expect(m.state.events.some(e=>e.type==='spawn-blocked'&&e.subjectId==='rear')).toBe(true); });
  it('R021 emits hit, HP update, then kill for a fatal projectile', () => { const s=emptyState();s.enemies.push({id:'enemy',row:0,col:2,width:1,height:1,hp:8,maxHp:8});const m=new TurnManager(s,DEFAULT_RULES);m.resolveProjectile({remainingDamage:8,lane:0,position:0});const hit=m.state.events.find(e=>e.type==='hit');expect(hit).toMatchObject({subjectId:'enemy',hpBefore:8,hpAfter:0});expect(m.state.events.findIndex(e=>e.type==='hit')).toBeLessThan(m.state.events.findIndex(e=>e.type==='kill')); });
  it('R016 caps rewards two merge tiers below the strongest plant', () => { expect([1,2,4,8,16,32,64,128,256].map(maxRewardValueFor)).toEqual([1,1,1,2,4,8,16,32,64]); });
  it('records utilization from actual enemy HP damage only', () => { const s=emptyState();s.plants[0][0]=plant(1);s.enemies.push({id:'enemy',row:0,col:2,width:1,height:1,hp:1,maxHp:1});const m=new TurnManager(s,{...DEFAULT_RULES,automaticEnemySpawning:false,rewardSpawning:false});m.perform({from:{row:0,col:0},to:{row:0,col:1}});expect(m.state.metrics.at(-1)).toMatchObject({theoreticalDamage:1,effectiveEnemyDamage:1,firepowerUtilization:1}); });
  it('calculates battlefield pressure from remaining HP divided by turns to defense', () => { const s=emptyState();s.plants[1][0]=plant(1);s.enemies.push({id:'enemy',row:0,col:3,width:1,height:1,hp:8,maxHp:8});const m=new TurnManager(s,{...DEFAULT_RULES,automaticEnemySpawning:false,rewardSpawning:false},undefined,'baseline');m.perform({from:{row:1,col:0},to:{row:1,col:1}});expect(m.state.metrics.at(-1)?.battlefieldPressure).toBeCloseTo(8/3);expect(m.state.metrics.at(-1)?.pressureRatio).toBeCloseTo(8/3); });
  it('clamps a high-HP spawn to the configured required-utilization safety limit', () => { const s=emptyState();s.plants[1][0]=plant(1);const m=new TurnManager(s,{...DEFAULT_RULES,automaticEnemySpawning:true,enemySpawnChance:1,enemyHpBase:144,enemyHpGrowthPerTurn:0,hardPressureCap:1,rewardSpawning:false},()=>0,'baseline');m.perform({from:{row:1,col:0},to:{row:1,col:1}});const spawned=m.state.spawnSafety.find(entry=>entry.outcome==='spawned')!;expect(spawned.hp).toBeLessThan(144);expect(spawned.requiredUtilization).toBeLessThanOrEqual(DEFAULT_RULES.normalEnemyMaxRequiredUtilization);expect(spawned.hp).toBe(5); });
  it('rejects a batch that would exceed the hard pressure cap without changing old enemy HP', () => { const s=emptyState();s.plants[1][0]=plant(1);s.enemies.push({id:'old',row:0,col:5,width:1,height:1,hp:20,maxHp:20});const m=new TurnManager(s,{...DEFAULT_RULES,automaticEnemySpawning:true,enemySpawnChance:1,hardPressureCap:0.75,rewardSpawning:false},()=>0,'baseline');m.perform({from:{row:1,col:0},to:{row:1,col:1}});expect(m.state.enemies.find(enemy=>enemy.id==='old')?.hp).toBe(20);expect(m.state.spawnSafety.some(entry=>entry.outcome==='rejected'&&entry.reason==='hardPressureCap')).toBe(true); });
  it('ramps large-enemy chance smoothly between unlock and full-chance scores', () => { const rules={...DEFAULT_RULES,largeEnemyUnlockScore:100,largeEnemyFullChanceScore:800,largeEnemySpawnChance:.15};expect(largeEnemyChanceFor(99,rules)).toBe(0);expect(largeEnemyChanceFor(450,rules)).toBeCloseTo(.075);expect(largeEnemyChanceFor(800,rules)).toBe(.15); });
  it('V2 output valves cap the bank and never repay reduced volume as a later spike', () => {
    restoreRewardEconomyTestDefaults();
    try {
      REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier = 0.4;
      const s = emptyState(); s.plants[0][0] = plant(1); s.plants[0][1] = plant(2);
      const m = new TurnManager(s, DEFAULT_RULES, () => 0, 'reward-economy');
      for (let turn = 0; turn < 8; turn++) expect(m.perform({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } })).toBe(true);
      const d = m.rewardEconomyDiagnostics();
      expect(d.effectiveHpBudgetIncome).toBeCloseTo(d.theoreticalHpBudget * 0.4, 1);
      expect(Number(d.hpBudgetBank)).toBeLessThanOrEqual(d.maxBudgetBank);
      REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier = 1.0;
      m.reconcileRewardEconomyBudgetBank();
      REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier = 0.4;
      m.reconcileRewardEconomyBudgetBank();
      expect(Number(m.rewardEconomyDiagnostics().hpBudgetBank)).toBeLessThanOrEqual(m.rewardEconomyDiagnostics().maxBudgetBank);
    } finally { restoreRewardEconomyTestDefaults(); }
  });
  it('V2 enemy entity cap blocks new spawns without counting RewardBalls', () => {
    restoreRewardEconomyTestDefaults();
    try {
      REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap = 1;
      const s = emptyState(); s.plants[1][0] = plant(1); s.plants[1][1] = plant(2);
      s.enemies.push({ id: 'existing', row: 4, col: 9, width: 1, height: 1, hp: 99, maxHp: 99 });
      const m = new TurnManager(s, DEFAULT_RULES, () => 0.999, 'reward-economy');
      expect(m.perform({ from: { row: 1, col: 0 }, to: { row: 1, col: 1 } })).toBe(true);
      const d = m.rewardEconomyDiagnostics();
      expect(m.state.enemies).toHaveLength(1);
      expect(d.enemyCount).toBe(1);
      expect(d.actualSpendBudget).toBe(0);
    } finally { restoreRewardEconomyTestDefaults(); }
  });
  it('V2 favors an open lane and reports current plus recent lane spawn counts', () => {
    restoreRewardEconomyTestDefaults();
    try {
      REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier = 1;
      REWARD_ECONOMY_TEST_CONTROLS.largeEnemyRateMultiplier = 0;
      const s = emptyState(); s.plants[4][0] = plant(1); s.plants[4][1] = plant(2);
      for (const [index, col] of [8, 7, 6, 5].entries()) s.enemies.push({ id: `crowded-${index}`, row: 0, col, width: 1, height: 1, hp: 99, maxHp: 99 });
      const rolls = [0.999, 0.999, 0.8, 0.5, 0.999];
      const m = new TurnManager(s, DEFAULT_RULES, () => rolls.shift() ?? 0.999, 'reward-economy');
      expect(m.perform({ from: { row: 4, col: 0 }, to: { row: 4, col: 1 } })).toBe(true);
      const spawned = m.state.enemies.find(enemy => enemy.id.startsWith('crowded-') === false)!;
      expect(spawned.row).toBe(4);
      expect(m.laneDistributionDiagnostics()).toMatchObject({ recentEnemySpawns: [0, 0, 0, 0, 1] });
    } finally { restoreRewardEconomyTestDefaults(); }
  });
  it('V2 starts at Volume 0.4 and fixed-seed cumulative enemy HP grows with volume', () => {
    const simulate = (volume: number, turns: number) => {
      restoreRewardEconomyTestDefaults();
      REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier = volume;
      REWARD_ECONOMY_TEST_CONTROLS.largeEnemyRateMultiplier = 0;
      const s = emptyState();
      for (let row = 0; row < 5; row++) { s.plants[row][0] = plant(128); s.plants[row][1] = plant(64); }
      const m = new TurnManager(s, DEFAULT_RULES, () => 0.999, 'reward-economy');
      let spawnedHp = 0, rewardValue = 0;
      for (let turn = 0; turn < turns && !m.state.gameOver; turn++) {
        m.perform({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });
        spawnedHp += m.state.events.filter(event => event.type === 'enemy-spawned').reduce((sum, event) => sum + (event.value ?? 0), 0);
        rewardValue += m.state.events.filter(event => event.type === 'reward-spawned').reduce((sum, event) => sum + (event.value ?? 0), 0);
      }
      return { spawnedHp, rewardValue, score: m.state.score, metrics: m.state.metrics.at(-1), lanes: m.laneDistributionDiagnostics().recentEnemySpawns };
    };
    try {
      expect(REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier).toBe(0.4);
      const at30 = [0.4, 0.6, 0.8, 1.0].map(volume => simulate(volume, 30));
      const at50 = [0.4, 0.6, 0.8, 1.0].map(volume => simulate(volume, 50));
      for (const report of [at30, at50]) for (let i = 1; i < report.length; i++) expect(report[i].spawnedHp).toBeGreaterThanOrEqual(report[i - 1].spawnedHp);
      expect(at50.at(-1)!.spawnedHp).toBeGreaterThan(at50[0].spawnedHp);
    } finally { restoreRewardEconomyTestDefaults(); }
  });
});
