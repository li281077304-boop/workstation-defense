import type { KeyValueStorage } from '../game/CurrentRunSave';

/** Keep the persistent envelope separate from the current-run save. */
export const LOCAL_RECORDS_VERSION = 1;
export const LOCAL_RECORDS_KEY = 'workstation-defense.local-records.v1';
export const LOCAL_RECORDS_LIMIT = 10;

/**
 * A completed, player-visible run.  It deliberately stores only summary
 * values: records never contain resumable combat state or presentation data.
 */
export type LocalGameRecord = {
  score: number;
  turns: number;
  highestDefenderValue: number;
  totalMoyuEarned: number;
  totalMoyuExtracted: number;
  totalMoyuOverflow: number;
  timestamp: number;
};

export type LocalRecordsSave = {
  recordsVersion: typeof LOCAL_RECORDS_VERSION;
  records: LocalGameRecord[];
};

export type RecordInsertionResult = {
  records: LocalGameRecord[];
  /** One-based rank in the retained top ten, or null when the run missed it. */
  rank: number | null;
  isNewBest: boolean;
  enteredTop10: boolean;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const isLocalGameRecord = (value: unknown): value is LocalGameRecord =>
  isObject(value)
  && isNonNegativeNumber(value.score)
  && isNonNegativeNumber(value.turns)
  && isNonNegativeNumber(value.highestDefenderValue)
  && isNonNegativeNumber(value.totalMoyuEarned)
  && isNonNegativeNumber(value.totalMoyuExtracted)
  && isNonNegativeNumber(value.totalMoyuOverflow)
  && typeof value.timestamp === 'number'
  && Number.isFinite(value.timestamp)
  && value.timestamp > 0;

const isLocalRecordsSave = (value: unknown): value is LocalRecordsSave =>
  isObject(value)
  && value.recordsVersion === LOCAL_RECORDS_VERSION
  && Array.isArray(value.records)
  && value.records.length <= LOCAL_RECORDS_LIMIT
  && value.records.every(isLocalGameRecord);

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** The canonical leaderboard order: score, turns, then newest completed run. */
export const sortLocalRecords = (records: readonly LocalGameRecord[]): LocalGameRecord[] =>
  [...records].sort((left, right) =>
    right.score - left.score
    || right.turns - left.turns
    || right.timestamp - left.timestamp,
  );

/**
 * Reads a valid, versioned top ten.  A missing, old-version, or corrupt record
 * is treated as an empty leaderboard so the game can always start normally.
 */
export const loadLocalRecords = (
  storage: KeyValueStorage | null = defaultStorage(),
): LocalGameRecord[] => {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LOCAL_RECORDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isLocalRecordsSave(parsed) ? sortLocalRecords(parsed.records) : [];
  } catch {
    return [];
  }
};

/** Writes only the retained, canonically ordered top ten. */
export const saveLocalRecords = (
  records: readonly LocalGameRecord[],
  storage: KeyValueStorage | null = defaultStorage(),
): boolean => {
  if (!storage || !records.every(isLocalGameRecord)) return false;
  const payload: LocalRecordsSave = {
    recordsVersion: LOCAL_RECORDS_VERSION,
    records: sortLocalRecords(records).slice(0, LOCAL_RECORDS_LIMIT),
  };

  try {
    storage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

/**
 * Adds one completed run, persists its top-ten result, and reports the exact
 * player-facing outcome for the Game Over screen.
 */
export const addLocalRecord = (
  record: LocalGameRecord,
  storage: KeyValueStorage | null = defaultStorage(),
): RecordInsertionResult => {
  const previous = loadLocalRecords(storage);
  if (!isLocalGameRecord(record)) {
    return { records: previous, rank: null, isNewBest: false, enteredTop10: false };
  }

  // `indexOf` finds this exact newly inserted object after the stable sort,
  // avoiding ambiguity if older records happen to have equal stats.
  const sorted = sortLocalRecords([...previous, record]);
  const insertedIndex = sorted.indexOf(record);
  const retained = sorted.slice(0, LOCAL_RECORDS_LIMIT);
  const enteredTop10 = insertedIndex >= 0 && insertedIndex < LOCAL_RECORDS_LIMIT;
  const rank = enteredTop10 ? insertedIndex + 1 : null;
  const isNewBest = rank === 1;

  // Persistence failure should never block the result UI; callers still get
  // the correct in-memory ranking and can safely continue playing.
  saveLocalRecords(retained, storage);
  return { records: retained, rank, isNewBest, enteredTop10 };
};
