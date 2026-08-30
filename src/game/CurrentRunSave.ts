import { TurnManager } from './TurnManager';
import type { GameState } from './types';

/**
 * A deliberately small persistence boundary for a resumable game.
 *
 * `runtime` belongs to TurnManager (director budgets, lane history, etc.).  This
 * module treats it as opaque so that storage policy remains independent from
 * combat implementation.
 */
export type CurrentRunPayload<TRuntime> = {
  state: GameState;
  runtime: TRuntime;
};

export type CurrentRunSave<TRuntime> = {
  saveVersion: typeof CURRENT_RUN_SAVE_VERSION;
  savedAt: number;
  run: CurrentRunPayload<TRuntime>;
};

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CURRENT_RUN_SAVE_VERSION = 2;
export const CURRENT_RUN_SAVE_KEY = 'workstation-defense.current-run.v2';
export const CURRENT_RUN_SAVE_TEMP_KEY = `${CURRENT_RUN_SAVE_KEY}.pending`;
/** V0.25's storage keys remain readable exactly once through the V1 migrator. */
export const LEGACY_CURRENT_RUN_SAVE_KEY = 'workstation-defense.current-run.v1';
export const LEGACY_CURRENT_RUN_SAVE_TEMP_KEY = `${LEGACY_CURRENT_RUN_SAVE_KEY}.pending`;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPlant = (value: unknown): boolean =>
  isObject(value) && typeof value.id === 'string' && isFiniteNumber(value.value);

/**
 * Reject obviously malformed JSON before it reaches game code.  The versioned
 * outer record is intentionally strict; nested event/metric history is stored
 * as data and is only required to be an array.
 */
const isBaseResumableGameState = (value: unknown): value is Record<string, unknown> => {
  if (!isObject(value) || value.gameOver !== false) return false;
  if (!Array.isArray(value.plants) || value.plants.length !== 5) return false;
  if (!value.plants.every(row => Array.isArray(row) && row.length === 2 && row.every(cell => cell === null || isPlant(cell)))) return false;

  const requiredArrays = [
    value.enemies,
    value.rewardBalls,
    value.moyuPickups,
    value.lastLog,
    value.events,
    value.metrics,
    value.rewardLedger,
    value.spawnSafety,
    value.rewardRealized,
  ];
  if (!requiredArrays.every(Array.isArray)) return false;

  if (!isFiniteNumber(value.moyuBank) || value.moyuBank < 0) return false;
  if (value.birthSlot !== null && (!isFiniteNumber(value.birthSlot) || value.birthSlot < 1)) return false;
  return isFiniteNumber(value.score) && value.score >= 0 && isFiniteNumber(value.turn) && value.turn >= 0;
};

/** V2 has a complete, self-consistent capacity ledger. */
export const isResumableGameState = (value: unknown): value is GameState => {
  if (!isBaseResumableGameState(value)) return false;
  const ledger = ['highestDefenderValue', 'totalMoyuGenerated', 'totalMoyuEarned', 'totalMoyuExtracted', 'totalMoyuOverflow'];
  if (!ledger.every(key => isFiniteNumber(value[key]) && value[key] >= 0)) return false;
  const capacity = TurnManager.moyuCapacityFor(value.highestDefenderValue as number);
  return (value.moyuBank as number) <= capacity
    && (value.totalMoyuEarned as number) === (value.totalMoyuExtracted as number) + (value.moyuBank as number);
};

const isCurrentRunSave = <TRuntime>(value: unknown): value is CurrentRunSave<TRuntime> => {
  if (!isObject(value) || value.saveVersion !== CURRENT_RUN_SAVE_VERSION || !isFiniteNumber(value.savedAt) || value.savedAt <= 0 || !isObject(value.run)) return false;
  return Object.hasOwn(value.run, 'runtime') && isResumableGameState(value.run.state);
};

/**
 * Converts the pre-capacity V1 state into a valid V2 account. V1 did not keep
 * enough ledger information to reconstruct historical extraction, so its
 * known Bank amount becomes the start of the V2 ledger. Any amount above the
 * newly derived capacity is explicitly retained as migration overflow.
 */
const migrateV1Save = <TRuntime>(value: unknown): CurrentRunSave<TRuntime> | null => {
  if (!isObject(value) || value.saveVersion !== 1 || !isFiniteNumber(value.savedAt) || value.savedAt <= 0 || !isObject(value.run) || !Object.hasOwn(value.run, 'runtime') || !isBaseResumableGameState(value.run.state)) return null;
  const state = structuredClone(value.run.state) as GameState;
  const liveHighest = Math.max(1, ...state.plants.flatMap(row => row.flatMap(plant => plant ? [plant.value] : [])));
  const highestDefenderValue = liveHighest;
  const capacity = TurnManager.moyuCapacityFor(highestDefenderValue);
  const legacyBank = Math.max(0, Math.floor(state.moyuBank));
  const moyuBank = Math.min(legacyBank, capacity);
  const migrationOverflow = legacyBank - moyuBank;
  const migratedState: GameState = {
    ...state,
    highestDefenderValue,
    moyuBank,
    totalMoyuGenerated: moyuBank + migrationOverflow,
    totalMoyuEarned: moyuBank,
    totalMoyuExtracted: 0,
    totalMoyuOverflow: migrationOverflow,
  };
  const migrated: CurrentRunSave<TRuntime> = {
    saveVersion: CURRENT_RUN_SAVE_VERSION,
    savedAt: value.savedAt,
    run: { state: migratedState, runtime: value.run.runtime as TRuntime },
  };
  return isCurrentRunSave<TRuntime>(migrated) ? migrated : null;
};

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // WebViews can expose localStorage while denying access in private modes.
    return null;
  }
};

const parseSave = <TRuntime>(raw: string | null): CurrentRunSave<TRuntime> | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isCurrentRunSave<TRuntime>(parsed)) return parsed;
    return migrateV1Save<TRuntime>(parsed);
  } catch {
    return null;
  }
};

/**
 * Writes a temporary complete record before replacing the primary record.
 * localStorage commits individual keys atomically; keeping the temporary key
 * until the primary write succeeds means a process kill cannot erase the last
 * valid run.  The newest valid copy wins during load.
 */
export const saveCurrentRun = <TRuntime>(
  payload: CurrentRunPayload<TRuntime>,
  storage: KeyValueStorage | null = defaultStorage(),
  now = Date.now(),
): boolean => {
  if (!storage || !isResumableGameState(payload.state) || !isFiniteNumber(now) || now <= 0) return false;

  const record: CurrentRunSave<TRuntime> = {
    saveVersion: CURRENT_RUN_SAVE_VERSION,
    savedAt: now,
    run: payload,
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(record);
  } catch {
    return false;
  }

  // Validate the exact serialized representation, rather than trusting the
  // caller's object (JSON can drop undefined fields).
  if (!parseSave<TRuntime>(serialized)) return false;

  try {
    storage.setItem(CURRENT_RUN_SAVE_TEMP_KEY, serialized);
    if (!parseSave<TRuntime>(storage.getItem(CURRENT_RUN_SAVE_TEMP_KEY))) return false;
    storage.setItem(CURRENT_RUN_SAVE_KEY, serialized);
    storage.removeItem(CURRENT_RUN_SAVE_TEMP_KEY);
    return true;
  } catch {
    return false;
  }
};

/** Returns the newest valid non-game-over record, or null when none exists. */
export const loadCurrentRun = <TRuntime>(
  storage: KeyValueStorage | null = defaultStorage(),
): CurrentRunSave<TRuntime> | null => {
  if (!storage) return null;
  try {
    const candidates = [
      parseSave<TRuntime>(storage.getItem(CURRENT_RUN_SAVE_KEY)),
      parseSave<TRuntime>(storage.getItem(CURRENT_RUN_SAVE_TEMP_KEY)),
      parseSave<TRuntime>(storage.getItem(LEGACY_CURRENT_RUN_SAVE_KEY)),
      parseSave<TRuntime>(storage.getItem(LEGACY_CURRENT_RUN_SAVE_TEMP_KEY)),
    ].filter((candidate): candidate is CurrentRunSave<TRuntime> => candidate !== null);
    return candidates.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
  } catch {
    return null;
  }
};

export const clearCurrentRun = (storage: KeyValueStorage | null = defaultStorage()): void => {
  if (!storage) return;
  try {
    storage.removeItem(CURRENT_RUN_SAVE_KEY);
    storage.removeItem(CURRENT_RUN_SAVE_TEMP_KEY);
    storage.removeItem(LEGACY_CURRENT_RUN_SAVE_KEY);
    storage.removeItem(LEGACY_CURRENT_RUN_SAVE_TEMP_KEY);
  } catch {
    // Clearing stale data is best-effort; never block the game over it.
  }
};
