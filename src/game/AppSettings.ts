/**
 * Small, versioned settings boundary. UI can use this without knowing which
 * platform it runs on; unsupported browser storage simply falls back to the
 * in-memory defaults.
 */
export const APP_SETTINGS_VERSION = 1;
export const APP_SETTINGS_KEY = 'workstation-defense.settings.v1';

export type AppSettings = {
  settingsVersion: typeof APP_SETTINGS_VERSION;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  vibrationEnabled: boolean;
  damageNumbersEnabled: boolean;
};

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = Object.freeze({
  settingsVersion: APP_SETTINGS_VERSION,
  musicEnabled: true,
  sfxEnabled: true,
  vibrationEnabled: true,
  damageNumbersEnabled: true,
});

export const defaultAppSettings = (): AppSettings => ({ ...DEFAULT_APP_SETTINGS });

const defaultStorage = (): SettingsStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isValidSettings = (value: unknown): value is AppSettings => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.settingsVersion === APP_SETTINGS_VERSION
    && typeof candidate.musicEnabled === 'boolean'
    && typeof candidate.sfxEnabled === 'boolean'
    && typeof candidate.vibrationEnabled === 'boolean'
    && typeof candidate.damageNumbersEnabled === 'boolean';
};

/** Returns defaults on any malformed/legacy record. Never lets JSON failures reach UI. */
export const loadAppSettings = (storage: SettingsStorage | null = defaultStorage()): AppSettings => {
  if (!storage) return defaultAppSettings();
  try {
    const raw = storage.getItem(APP_SETTINGS_KEY);
    if (!raw) return defaultAppSettings();
    const parsed: unknown = JSON.parse(raw);
    if (isValidSettings(parsed)) return { ...parsed };
  } catch {
    // A damaged preferences record must not prevent the game from opening.
  }

  const recovered = defaultAppSettings();
  // Best effort repair: private-mode WebViews may reject writes.
  try { storage.setItem(APP_SETTINGS_KEY, JSON.stringify(recovered)); } catch { /* ignore */ }
  return recovered;
};

export const saveAppSettings = (
  settings: AppSettings,
  storage: SettingsStorage | null = defaultStorage(),
): boolean => {
  if (!storage || !isValidSettings(settings)) return false;
  try {
    storage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
};

export const updateAppSettings = (
  current: AppSettings,
  patch: Partial<Omit<AppSettings, 'settingsVersion'>>,
  storage: SettingsStorage | null = defaultStorage(),
): AppSettings => {
  const next: AppSettings = { ...current, ...patch, settingsVersion: APP_SETTINGS_VERSION };
  saveAppSettings(next, storage);
  return next;
};
