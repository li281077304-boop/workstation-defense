import { describe, expect, it } from 'vitest';
import {
  CURRENT_RUN_SAVE_KEY,
  CURRENT_RUN_SAVE_TEMP_KEY,
  V2_CURRENT_RUN_SAVE_KEY,
  LEGACY_CURRENT_RUN_SAVE_KEY,
  clearCurrentRun,
  loadCurrentRun,
  saveCurrentRun,
  type KeyValueStorage,
} from '../src/game/CurrentRunSave';
import { emptyState, TurnManager } from '../src/game/TurnManager';
import { DEFAULT_RULES } from '../src/game/config';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('CurrentRunSave', () => {
  it('round-trips the complete resumable GameState with opaque runtime data', () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.turn = 12;
    state.highestDefenderValue = 64;
    state.moyuBank = 13;
    state.totalMoyuEarned = 13;
    state.birthSlot = 64;
    const runtime = { hpBudgetBank: 18.2, recentLaneSpawns: [1, 0, 2, 0, 0] };

    expect(saveCurrentRun({ state, runtime }, storage, 100)).toBe(true);
    expect(loadCurrentRun<typeof runtime>(storage)).toEqual({
      saveVersion: 3,
      savedAt: 100,
      run: { state, runtime },
    });
    expect(storage.getItem(CURRENT_RUN_SAVE_TEMP_KEY)).toBeNull();
  });

  it('rejects a Game Over state so a death screen can never be resumed', () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.gameOver = true;
    expect(saveCurrentRun({ state, runtime: {} }, storage, 100)).toBe(false);
    expect(loadCurrentRun(storage)).toBeNull();
  });

  it('uses a valid pending record if a newer save was interrupted before primary replacement', () => {
    const storage = new MemoryStorage();
    const oldState = emptyState();
    oldState.turn = 3;
    expect(saveCurrentRun({ state: oldState, runtime: {} }, storage, 100)).toBe(true);

    const newState = emptyState();
    newState.turn = 4;
    const pending = { saveVersion: 3, savedAt: 200, run: { state: newState, runtime: { laneSeed: 4 } } };
    storage.setItem(CURRENT_RUN_SAVE_TEMP_KEY, JSON.stringify(pending));

    expect(loadCurrentRun<{ laneSeed: number }>(storage)?.run.state.turn).toBe(4);
  });

  it('returns null for corrupted records and clears both safe-write keys', () => {
    const storage = new MemoryStorage();
    storage.setItem(CURRENT_RUN_SAVE_KEY, '{not json');
    storage.setItem(CURRENT_RUN_SAVE_TEMP_KEY, JSON.stringify({ saveVersion: 1, savedAt: 1, run: { state: {}, runtime: {} } }));
    expect(loadCurrentRun(storage)).toBeNull();
    clearCurrentRun(storage);
    expect(storage.getItem(CURRENT_RUN_SAVE_KEY)).toBeNull();
    expect(storage.getItem(CURRENT_RUN_SAVE_TEMP_KEY)).toBeNull();
  });

  it('round-trips a completed TurnManager snapshot, including a live Moyu pickup and director state', () => {
    const storage = new MemoryStorage();
    const manager = new TurnManager(emptyState(), { ...DEFAULT_RULES, automaticEnemySpawning: false });
    manager.state.moyuPickups.push({ id: 'pickup', value: 32, row: 2, col: 7, isCollected: false, spawnTurn: 3 });
    manager.state.enemies.push({ id: 'enemy', row: 1, col: 6, width: 1, height: 1, hp: 17, maxHp: 20, moyuValue: 16 });
    manager.state.turn = 10;
    expect(saveCurrentRun(manager.exportRunSnapshot(), storage, 200)).toBe(true);
    const saved = loadCurrentRun<ReturnType<typeof manager.exportRunSnapshot>['runtime']>(storage)!;
    const restored = new TurnManager(emptyState(), DEFAULT_RULES);
    restored.restoreRunSnapshot(saved.run);
    expect(restored.exportRunSnapshot()).toEqual(manager.exportRunSnapshot());
  });

  it('migrates a V1 save by deriving capacity and recording trimmed balance as overflow', () => {
    const storage = new MemoryStorage();
    const legacy = emptyState();
    legacy.moyuBank = 73;
    // V1 did not have these fields on disk.
    delete (legacy as Partial<typeof legacy>).highestDefenderValue;
    delete (legacy as Partial<typeof legacy>).totalMoyuGenerated;
    delete (legacy as Partial<typeof legacy>).totalMoyuEarned;
    delete (legacy as Partial<typeof legacy>).totalMoyuExtracted;
    delete (legacy as Partial<typeof legacy>).totalMoyuDismissalCost;
    delete (legacy as Partial<typeof legacy>).totalMoyuOverflow;
    storage.setItem(LEGACY_CURRENT_RUN_SAVE_KEY, JSON.stringify({ saveVersion: 1, savedAt: 100, run: { state: legacy, runtime: {} } }));
    expect(loadCurrentRun(storage)?.run.state).toMatchObject({ highestDefenderValue: 1, moyuBank: 4, totalMoyuEarned: 4, totalMoyuOverflow: 69 });
  });

  it('migrates a V2 save by adding a zero dismissal ledger', () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.highestDefenderValue = 32;
    state.moyuBank = 8;
    state.totalMoyuEarned = 8;
    delete (state as Partial<typeof state>).totalMoyuDismissalCost;
    storage.setItem(V2_CURRENT_RUN_SAVE_KEY, JSON.stringify({ saveVersion: 2, savedAt: 120, run: { state, runtime: {} } }));
    expect(loadCurrentRun(storage)?.run.state).toMatchObject({ moyuBank: 8, totalMoyuDismissalCost: 0 });
  });

  it('round-trips a negative Moyu balance with its dismissal ledger', () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.moyuBank = -8;
    state.totalMoyuDismissalCost = 8;
    expect(saveCurrentRun({ state, runtime: {} }, storage, 150)).toBe(true);
    expect(loadCurrentRun(storage)?.run.state).toMatchObject({ moyuBank: -8, totalMoyuDismissalCost: 8 });
  });
});
