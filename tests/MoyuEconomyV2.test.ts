import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, MAX_DEFENDER_VALUE, STARTING_DEFENDER_LAYOUT } from '../src/game/config';
import { cumulativeExpectedMoyuValue, expectedMoyuValueForTurn } from '../src/game/difficulty';
import { emptyState, seedStartingDefenders, TurnManager } from '../src/game/TurnManager';
import type { Enemy, Projectile } from '../src/game/types';

const plant = (value: number) => ({ id: `plant-${value}-${crypto.randomUUID()}`, value });
const enemy = (id: string, hp: number, col: number, moyuValue = 0): Enemy => ({ id, row: 0, col, width: 1, height: 1, hp, maxHp: hp, moyuValue });
const shot = (damage: number, lane = 0): Projectile => ({ id: crypto.randomUUID(), lane, damage, remainingDamage: damage, position: 0, isAlive: true });
const quietRules = { ...DEFAULT_RULES, automaticEnemySpawning: false, rewardSpawning: false };
const withHighest = (state: ReturnType<typeof emptyState>, highest: number) => {
  state.highestDefenderValue = highest;
  return state;
};

describe('Moyu Economy V2', () => {
  it('1 Value=512 defender generates exactly one projectile', () => {
    expect(new TurnManager(emptyState(), quietRules).createProjectiles(512, 0)).toHaveLength(1);
  });
  it('2 Projectile Damage equals defender value', () => {
    expect(new TurnManager(emptyState(), quietRules).createProjectiles(512, 0)[0]).toMatchObject({ damage: 512, remainingDamage: 512 });
  });
  it('3 512 kills 100HP and continues with 412', () => {
    const s = emptyState(); s.enemies.push(enemy('a', 100, 2)); const m = new TurnManager(s, quietRules); const p = shot(512); m.resolveProjectile(p);
    expect(s.enemies).toEqual([]); expect(p.remainingDamage).toBe(0); expect(m.state.metrics).toEqual([]); expect(m.state.events.find(e => e.type === 'pierce')?.remainingDamage).toBe(412);
  });
  it('4 an intercepted pickup credits only the available Bank capacity', () => {
    const s = withHighest(emptyState(), 128); s.moyuPickups.push({ id: 'm', value: 64, row: 0, col: 2, isCollected: false, spawnTurn: 0 }); const p = shot(1); const m = new TurnManager(s, quietRules); m.resolveProjectile(p);
    expect(s).toMatchObject({ moyuBank: 32, totalMoyuEarned: 32, totalMoyuOverflow: 32 }); expect(p.isAlive).toBe(false);
  });
  it('5 a 4096-damage shot collects Moyu 1', () => {
    const s = emptyState(); s.moyuPickups.push({ id: 'm', value: 1, row: 0, col: 2, isCollected: false, spawnTurn: 0 }); const p = shot(4096); const m = new TurnManager(s, quietRules); m.resolveProjectile(p);
    expect(s.moyuBank).toBe(1); expect(p.remainingDamage).toBe(0);
  });
  it('6 collection ignores projectile damage and pickup value', () => {
    for (const [damage, value, expected] of [[1, 4096, 32], [4096, 1, 1]]) { const s = withHighest(emptyState(), 128); s.moyuPickups.push({ id: `m-${damage}`, value, row: 0, col: 2, isCollected: false, spawnTurn: 0 }); const m = new TurnManager(s, quietRules); m.resolveProjectile(shot(damage)); expect(s.moyuBank).toBe(expected); }
  });
  it('7 interception zeros remaining damage', () => {
    const s = emptyState(); s.moyuPickups.push({ id: 'm', value: 8, row: 0, col: 3, isCollected: false, spawnTurn: 0 }); const m = new TurnManager(s, quietRules); const p = shot(512); m.resolveProjectile(p); expect(p.remainingDamage).toBe(0);
  });
  it('8 interception classifies all remaining damage as Moyu waste', () => {
    const s = emptyState(); s.enemies.push(enemy('e', 100, 2)); s.moyuPickups.push({ id: 'm', value: 8, row: 0, col: 3, isCollected: false, spawnTurn: 0 }); const m = new TurnManager(s, quietRules); m.resolveProjectile(shot(512));
    expect(m.state.events.find(e => e.type === 'moyu-collected')?.damage).toBe(412);
  });
  it('9 a dropped Moyu is visible immediately and is not collected by its killing projectile', () => {
    const s = emptyState(); s.plants[0][0] = plant(8); s.plants[0][1] = plant(1); s.enemies.push(enemy('e', 4, 2, 16)); const m = new TurnManager(s, quietRules); m.perform({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });
    // The rear (left) Defender is allowed to capture the front kill's drop
    // in the same Turn; only the killing projectile itself is excluded.
    expect(s.moyuBank).toBe(4); expect(s.moyuPickups).toHaveLength(0);
  });
  it('9b the killing projectile cannot capture its own immediate drop', () => {
    const s = emptyState(); s.enemies.push(enemy('e', 1, 2, 8)); const m = new TurnManager(s, quietRules);
    m.resolveProjectile(shot(1));
    expect(s.moyuBank).toBe(0); expect(s.moyuPickups).toHaveLength(1); expect(s.moyuPickups[0].value).toBe(8);
  });
  it('10 a killed carrier emits its pickup during the projectile phase', () => {
    const s = emptyState(); s.plants[0][0] = plant(4); s.plants[0][1] = plant(1); s.enemies.push(enemy('e', 4, 2, 16)); const m = new TurnManager(s, quietRules); m.perform({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });
    expect(s.events.findIndex(e => e.type === 'moyu-drop-queued')).toBeLessThan(s.events.findIndex(e => e.type === 'moyu-spawned'));
  });
  it('11 Moyu pickups never cause game over', () => { const s = emptyState(); s.plants[0][0] = plant(1); s.plants[0][1] = plant(2); s.moyuPickups.push({ id: 'm', value: 4, row: 0, col: 0, isCollected: false, spawnTurn: 0 }); const m = new TurnManager(s, quietRules); m.perform({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } }); expect(s.gameOver).toBe(false); });
  it('12 a left-edge pickup auto-recovers instead of disappearing', () => { const s = withHighest(emptyState(), 32); s.plants[1][0] = plant(1); s.plants[1][1] = plant(2); s.moyuPickups.push({ id: 'm', value: 8, row: 0, col: 0, isCollected: false, spawnTurn: 0 }); const m = new TurnManager(s, quietRules); m.perform({ from: { row: 1, col: 0 }, to: { row: 1, col: 1 } }); expect(s.moyuBank).toBe(8); expect(s.moyuPickups).toEqual([]); });
  it('13 repeated collision credits a pickup only once', () => { const s = withHighest(emptyState(), 32); s.moyuPickups.push({ id: 'm', value: 8, row: 0, col: 2, isCollected: false, spawnTurn: 0 }); const m = new TurnManager(s, quietRules); m.resolveProjectile(shot(1)); m.resolveProjectile(shot(1)); expect(s.moyuBank).toBe(8); });
  it('14 logic bank is final before any visual flight can complete', () => { const s = withHighest(emptyState(), 32); s.moyuPickups.push({ id: 'm', value: 8, row: 0, col: 2, isCollected: false, spawnTurn: 0 }); const m = new TurnManager(s, quietRules); m.resolveProjectile(shot(1)); expect(s.moyuBank).toBe(8); });
  it('15 Bank 13 extracts 8 and leaves 5', () => { const s = withHighest(emptyState(), 64); s.moyuBank = 13; s.totalMoyuEarned = 13; const m = new TurnManager(s, quietRules); expect(m.extractMoyu(8)).toBe(true); expect(s).toMatchObject({ moyuBank: 5, birthSlot: 8, totalMoyuExtracted: 8 }); });
  it('16 extraction is blocked while Spawn Slot is occupied', () => { const s = withHighest(emptyState(), 32); s.moyuBank = 8; s.totalMoyuEarned = 8; s.birthSlot = 1; expect(new TurnManager(s, quietRules).extractMoyu(8)).toBe(false); expect(s.moyuBank).toBe(8); });
  it('17 extraction does not spend a turn', () => { const s = withHighest(emptyState(), 32); s.moyuBank = 8; s.totalMoyuEarned = 8; const m = new TurnManager(s, quietRules); m.extractMoyu(8); expect(s.turn).toBe(0); });
  it('18 deployment from Spawn Slot still spends a turn', () => { const s = withHighest(emptyState(), 32); s.moyuBank = 8; s.totalMoyuEarned = 8; const m = new TurnManager(s, quietRules); m.extractMoyu(8); expect(m.perform({ from: 'birth', to: { row: 0, col: 0 } })).toBe(true); expect(s.turn).toBe(1); });
  it('19 old multi-shot count is disabled', () => { const m = new TurnManager(emptyState(), quietRules); expect([1, 2, 4, 32, 512].map(v => m.projectileCount(v))).toEqual([1, 1, 1, 1, 1]); });
  it('20 value 32 is one 32-damage projectile, not 4×8', () => { expect(new TurnManager(emptyState(), quietRules).createProjectiles(32, 0).map(p => p.damage)).toEqual([32]); });
  it('21 value 512 is one 512-damage projectile, not 4×128', () => { expect(new TurnManager(emptyState(), quietRules).createProjectiles(512, 0).map(p => p.damage)).toEqual([512]); });
  it('22 earned Moyu remains economically consistent across intercept and auto-recovery', () => { const s = withHighest(emptyState(), 64); s.moyuPickups.push({ id: 'a', value: 4, row: 0, col: 2, isCollected: false, spawnTurn: 0 }, { id: 'b', value: 8, row: 1, col: 0, isCollected: false, spawnTurn: 0 }); s.plants[2][0] = plant(1); s.plants[2][1] = plant(2); const m = new TurnManager(s, quietRules); m.resolveProjectile(shot(1)); m.perform({ from: { row: 2, col: 0 }, to: { row: 2, col: 1 } }); expect(s.moyuBank).toBe(12); expect(s.totalMoyuEarned).toBe(s.totalMoyuExtracted + s.totalMoyuDismissalCost + s.moyuBank); expect(s.moyuPickups).toEqual([]); });
  it('23 expected economy follows carrier chance and active Moyu value stage, not legacy RewardBall weights', () => {
    const stages = [{ startTurn: 1, values: [1, 2, 4], weights: [.2, .55, .25] }, { startTurn: 16, values: [2, 4, 8], weights: [.2, .55, .25] }];
    expect(expectedMoyuValueForTurn(1, .8, stages)).toBeCloseTo(.8 * 2.3);
    expect(expectedMoyuValueForTurn(16, .8, stages)).toBeCloseTo(.8 * 4.6);
    expect(cumulativeExpectedMoyuValue(16, .8, stages)).toBeGreaterThan(0);
  });
  it('24 highest extraction selects the greatest affordable power of two within the Bank cap', () => {
    for (const [bank, extracted, remaining, highest] of [[7, 4, 3, 32], [13, 8, 5, 64], [32, 32, 0, 128]]) {
      const s = withHighest(emptyState(), highest); s.moyuBank = bank; s.totalMoyuEarned = bank;
      expect(new TurnManager(s, quietRules).extractHighestMoyu(MAX_DEFENDER_VALUE)).toBe(true);
      expect(s).toMatchObject({ birthSlot: extracted, moyuBank: remaining, turn: 0 });
    }
  });
  it('25 quick deploy fills right column top-to-bottom, then left, without merging or spending a failed turn', () => {
    const s = emptyState(); s.birthSlot = 8;
    const m = new TurnManager(s, quietRules);
    expect(m.quickDeployFromBirth()).toBe(true);
    expect(s.plants[0][1]?.value).toBe(8);
    expect(s.turn).toBe(1);
    s.birthSlot = 8;
    for (let row = 1; row < 5; row++) s.plants[row][1] = plant(1);
    expect(m.quickDeployFromBirth()).toBe(true);
    expect(s.plants[0][0]?.value).toBe(8);
    s.birthSlot = 8;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 2; col++) s.plants[row][col] = plant(1);
    const turnBefore = s.turn;
    expect(m.quickDeployFromBirth()).toBe(false);
    expect(s).toMatchObject({ birthSlot: 8, turn: turnBefore });
  });
  it('26 quick deploy skips occupied cells but never uses an equal occupied cell as an automatic merge target', () => {
    const s = emptyState(); s.birthSlot = 4; s.plants[0][1] = plant(4);
    const m = new TurnManager(s, quietRules);
    expect(m.quickDeployFromBirth()).toBe(true);
    expect(s.plants[0][1]?.value).toBe(4);
    expect(s.plants[1][1]?.value).toBe(4);
    expect(s.birthSlot).toBeNull();
  });
  it('27 capacity follows the historical Defender high-water mark and caps at 32', () => {
    expect([1, 2, 4, 8, 16, 32, 64, 128, 4096].map(TurnManager.moyuCapacityFor)).toEqual([4, 4, 4, 4, 4, 8, 16, 32, 32]);
    const s = withHighest(emptyState(), 32); s.plants[0][0] = plant(32);
    const m = new TurnManager(s, quietRules);
    m.perform({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });
    s.plants[0][1] = null;
    expect(m.moyuCapacity()).toBe(8);
  });
  it('28 credit only fills available capacity and tracks overflow', () => {
    const s = withHighest(emptyState(), 32); s.moyuBank = 6; s.totalMoyuEarned = 6;
    const m = new TurnManager(s, quietRules); s.moyuPickups.push({ id: 'm', value: 4, row: 0, col: 2, isCollected: false, spawnTurn: 0 }); m.resolveProjectile(shot(1));
    expect(s).toMatchObject({ moyuBank: 8, totalMoyuEarned: 8, totalMoyuOverflow: 2 });
    expect(s.events.find(event => event.type === 'moyu-overflow')).toMatchObject({ overflowValue: 2 });
  });
  it('29 enemy Moyu value stays intact from carrier state through its delayed pickup', () => {
    for (const value of [1, 8, 32]) {
      const s = withHighest(emptyState(), 128); s.enemies.push(enemy(`carrier-${value}`, 1, 2, value));
      const m = new TurnManager(s, quietRules); m.resolveProjectile(shot(1));
      expect(TurnManager.enemyMoyuValue({ moyuValue: value })).toBe(value);
      expect(s.events.find(event => event.type === 'moyu-drop-queued')).toMatchObject({ value });
      m.finalizeProjectilePhase();
      expect(s.moyuPickups).toHaveLength(1); expect(s.moyuPickups[0].value).toBe(value);
    }
  });
  it('30 pickup credit plus capacity overflow always equals the carrier drop value', () => {
    const s = withHighest(emptyState(), 32); s.moyuBank = 6; s.totalMoyuEarned = 6;
    s.moyuPickups.push({ id: 'carrier-8', value: 8, row: 0, col: 2, isCollected: false, spawnTurn: 0 });
    const m = new TurnManager(s, quietRules); m.resolveProjectile(shot(1));
    const collected = s.events.find(event => event.type === 'moyu-collected')!;
    expect((collected.earnedValue ?? 0) + (collected.overflowValue ?? 0)).toBe(8);
  });
  it('31 opening layout provides six value-1 Defenders across five lanes with an immediate merge choice', () => {
    const s = emptyState();
    seedStartingDefenders(s);
    expect(STARTING_DEFENDER_LAYOUT).toHaveLength(6);
    expect(s.plants.flat().filter(Boolean)).toHaveLength(6);
    expect(s.plants.flat().filter(Boolean).map(defender => defender!.value)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(s.plants[2][0]?.value).toBe(1);
    expect(s.plants[2][1]?.value).toBe(1);
  });
});
