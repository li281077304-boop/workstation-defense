import { describe, expect, it } from 'vitest';
import {
  APP_SETTINGS_KEY,
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
  type SettingsStorage,
} from '../src/game/AppSettings';
import { AudioManager, type SfxId } from '../src/audio/AudioManager';

class MemoryStorage implements SettingsStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class FakeBgm {
  loop = false;
  volume = 1;
  playCount = 0;
  pauseCount = 0;
  play(): Promise<void> { this.playCount += 1; return Promise.resolve(); }
  pause(): void { this.pauseCount += 1; }
}

describe('AppSettings', () => {
  it('uses the product defaults when no preferences exist', () => {
    expect(loadAppSettings(new MemoryStorage())).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('persists all four user settings', () => {
    const storage = new MemoryStorage();
    const changed = { ...DEFAULT_APP_SETTINGS, musicEnabled: false, vibrationEnabled: false };
    expect(saveAppSettings(changed, storage)).toBe(true);
    expect(loadAppSettings(storage)).toEqual(changed);
  });

  it('recovers safely from corrupted settings data', () => {
    const storage = new MemoryStorage();
    storage.setItem(APP_SETTINGS_KEY, '{broken');
    expect(loadAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS);
    expect(JSON.parse(storage.getItem(APP_SETTINGS_KEY)!)).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('persists AudioManager setting changes through the shared settings boundary', () => {
    const storage = new MemoryStorage();
    const manager = new AudioManager({ settingsStorage: storage });
    manager.setMusicEnabled(false);
    manager.setSfxEnabled(false);
    manager.setVibrationEnabled(false);
    manager.setDamageNumbersEnabled(false);
    expect(loadAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      musicEnabled: false,
      sfxEnabled: false,
      vibrationEnabled: false,
      damageNumbersEnabled: false,
    });
  });
});

describe('AudioManager', () => {
  it('does not play SFX while SFX are off, then resumes immediately when re-enabled', () => {
    const played: SfxId[] = [];
    const manager = new AudioManager({
      settings: { ...DEFAULT_APP_SETTINGS, sfxEnabled: false },
      settingsStorage: null,
      sfxPlayer: id => played.push(id),
    });
    expect(manager.playSfx('merge')).toBe(false);
    expect(played).toEqual([]);
    manager.setSfxEnabled(true);
    expect(manager.playSfx('merge')).toBe(true);
    expect(played).toEqual(['merge']);
  });

  it('does not request BGM while music is off and never creates duplicate BGM tracks', () => {
    const track = new FakeBgm();
    let factoryCalls = 0;
    const manager = new AudioManager({
      settings: { ...DEFAULT_APP_SETTINGS, musicEnabled: false },
      settingsStorage: null,
      bgmSource: '/assets/audio/bgm_main.mp3',
      bgmFactory: () => { factoryCalls += 1; return track; },
    });
    manager.registerUserGesture();
    expect(manager.playBgm()).toBe(false);
    expect(factoryCalls).toBe(0);

    manager.setMusicEnabled(true);
    expect(factoryCalls).toBe(1);
    manager.resumeBgm();
    expect(factoryCalls).toBe(1);
    expect(track.playCount).toBe(2);
    expect(track.loop).toBe(true);

    manager.setBackgrounded(true);
    expect(track.pauseCount).toBe(1);
    manager.setBackgrounded(false);
    expect(factoryCalls).toBe(1);
    expect(track.playCount).toBe(3);
  });
});
