import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../src/game/config';
import { MOYU_DEBT_LIMIT, emptyState, TurnManager } from '../src/game/TurnManager';
import type { Projectile } from '../src/game/types';

const quietRules = { ...DEFAULT_RULES, automaticEnemySpawning: false, rewardSpawning: false };
const defender = (value: number) => ({ id: `defender-${value}`, value });
const shot = (): Projectile => ({ id: 'debt-repay', lane: 0, damage: 1, remainingDamage: 1, position: 0, isAlive: true });

describe('Defender dismissal and Moyu debt', () => {
  it('removes a Defender, charges exactly value × 2, and spends one Turn', () => {
    const state = emptyState();
    state.plants[1][0] = defender(4);
    const manager = new TurnManager(state, quietRules);
    expect(manager.dismissDefender({ row: 1, col: 0 })).toBe(true);
    expect(state.plants[1][0]).toBeNull();
    expect(state.moyuBank).toBe(-8);
    expect(state.totalMoyuDismissalCost).toBe(8);
    expect(state.turn).toBe(1);
    expect(state.events.some(event => event.type === 'defender-dismissed')).toBe(true);
  });

  it('allows debt down to -4096 exactly, but rejects a lower result atomically', () => {
    const state = emptyState();
    state.moyuBank = -4094;
    state.totalMoyuEarned = -4094;
    state.totalMoyuDismissalCost = 0;
    state.plants[0][0] = defender(1);
    const manager = new TurnManager(state, quietRules);
    expect(manager.dismissDefender({ row: 0, col: 0 })).toBe(true);
    expect(state.moyuBank).toBe(MOYU_DEBT_LIMIT);

    state.plants[0][0] = defender(1);
    const before = structuredClone(state);
    expect(manager.dismissDefender({ row: 0, col: 0 })).toBe(false);
    expect(state).toEqual(before);
  });

  it('uses normal pickup income to repay debt before restoring a positive balance', () => {
    const state = emptyState();
    state.highestDefenderValue = 128;
    state.moyuBank = -20;
    state.totalMoyuEarned = -20;
    state.moyuPickups.push({ id: 'first', value: 8, row: 0, col: 2, isCollected: false, spawnTurn: 0 });
    const manager = new TurnManager(state, quietRules);
    manager.resolveProjectile(shot());
    expect(state.moyuBank).toBe(-12);
    state.moyuPickups.push({ id: 'second', value: 16, row: 0, col: 2, isCollected: false, spawnTurn: 0 });
    manager.resolveProjectile(shot());
    expect(state.moyuBank).toBe(4);
    expect(manager.extractHighestMoyu()).toBe(true);
    expect(state.birthSlot).toBe(4);
  });

  it('blocks extraction while the account is negative', () => {
    const state = emptyState();
    state.moyuBank = -8;
    state.totalMoyuEarned = -8;
    expect(new TurnManager(state, quietRules).extractHighestMoyu()).toBe(false);
  });
});
