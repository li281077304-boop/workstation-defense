import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../src/game/CurrentRunSave';
import {
  LOCAL_RECORDS_KEY,
  addLocalRecord,
  loadLocalRecords,
  saveLocalRecords,
  type LocalGameRecord,
} from '../src/records/LocalRecords';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const record = (score: number, turns = 10, timestamp = 1): LocalGameRecord => ({
  score,
  turns,
  highestDefenderValue: 32,
  totalMoyuEarned: 24,
  totalMoyuExtracted: 16,
  totalMoyuOverflow: 8,
  timestamp,
});

describe('LocalRecords', () => {
  it('writes and reads the first completed run', () => {
    const storage = new MemoryStorage();
    const result = addLocalRecord(record(1200, 20, 100), storage);
    expect(result.rank).toBe(1);
    expect(result.isNewBest).toBe(true);
    expect(result.enteredTop10).toBe(true);
    expect(loadLocalRecords(storage)).toEqual([record(1200, 20, 100)]);
  });

  it('retains only the best ten records', () => {
    const storage = new MemoryStorage();
    for (let score = 1; score <= 11; score += 1) addLocalRecord(record(score, score, score), storage);
    const records = loadLocalRecords(storage);
    expect(records).toHaveLength(10);
    expect(records.map(entry => entry.score)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  });

  it('sorts by score, then turns, then newer timestamp', () => {
    const storage = new MemoryStorage();
    saveLocalRecords([
      record(100, 9, 1),
      record(101, 1, 1),
      record(100, 10, 1),
      record(100, 10, 2),
    ], storage);
    expect(loadLocalRecords(storage).map(entry => [entry.score, entry.turns, entry.timestamp])).toEqual([
      [101, 1, 1],
      [100, 10, 2],
      [100, 10, 1],
      [100, 9, 1],
    ]);
  });

  it('reports a new best and a lower top-ten entry separately', () => {
    const storage = new MemoryStorage();
    addLocalRecord(record(100, 20, 1), storage);
    addLocalRecord(record(90, 20, 2), storage);
    const topTen = addLocalRecord(record(95, 20, 3), storage);
    const best = addLocalRecord(record(101, 1, 4), storage);
    expect(topTen).toMatchObject({ rank: 2, enteredTop10: true, isNewBest: false });
    expect(best).toMatchObject({ rank: 1, enteredTop10: true, isNewBest: true });
  });

  it('reports when a completed run misses an already-full top ten', () => {
    const storage = new MemoryStorage();
    for (let score = 10; score < 20; score += 1) addLocalRecord(record(score, score, score), storage);
    const missed = addLocalRecord(record(1, 100, 100), storage);
    expect(missed).toMatchObject({ rank: null, enteredTop10: false, isNewBest: false });
    expect(missed.records).toHaveLength(10);
  });

  it('falls back safely for corrupt or wrong-version stored data', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_RECORDS_KEY, '{not-json');
    expect(loadLocalRecords(storage)).toEqual([]);
    storage.setItem(LOCAL_RECORDS_KEY, JSON.stringify({ recordsVersion: 999, records: [record(4)] }));
    expect(loadLocalRecords(storage)).toEqual([]);
  });

  it('refuses malformed record fields without corrupting prior records', () => {
    const storage = new MemoryStorage();
    addLocalRecord(record(100), storage);
    const invalid = addLocalRecord({ ...record(200), timestamp: 0 }, storage);
    expect(invalid).toMatchObject({ rank: null, enteredTop10: false, isNewBest: false });
    expect(loadLocalRecords(storage)).toEqual([record(100)]);
  });
});
