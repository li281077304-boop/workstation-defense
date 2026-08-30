import {
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
  type SettingsStorage,
} from '../game/AppSettings';

/** Keep the sound contract stable even while individual sample assets are pending. */
export type SfxId =
  | 'uiClick'
  | 'merge'
  | 'projectileFire'
  | 'enemyHit'
  | 'enemyDeath'
  | 'moyuIntercept'
  | 'moyuEarn'
  | 'moyuOverflow'
  | 'moyuExtract'
  | 'spawnDeploy'
  | 'gameOver'
  | 'newRecord';

export const BGM_MAIN_ASSET_PATH = '/assets/audio/bgm_main.mp3';

type BgmTrack = {
  loop: boolean;
  volume: number;
  play(): Promise<void> | void;
  pause(): void;
};

type Tone = { frequency: number; duration: number; type: OscillatorType; gain: number; slideTo?: number; delay?: number };

type AudioContextLike = {
  state: string;
  currentTime: number;
  destination: AudioNode;
  resume(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
};

const tones: Record<SfxId, Tone[]> = {
  uiClick: [{ frequency: 520, duration: 0.05, type: 'sine', gain: 0.05, slideTo: 620 }],
  merge: [
    { frequency: 660, duration: 0.10, type: 'sine', gain: 0.16, slideTo: 880 },
    { frequency: 880, duration: 0.16, type: 'sine', gain: 0.12, delay: 0.06, slideTo: 1320 },
  ],
  projectileFire: [{ frequency: 500, duration: 0.07, type: 'triangle', gain: 0.05, slideTo: 700 }],
  enemyHit: [{ frequency: 170, duration: 0.06, type: 'square', gain: 0.045 }],
  enemyDeath: [{ frequency: 360, duration: 0.18, type: 'triangle', gain: 0.14, slideTo: 130 }],
  moyuIntercept: [
    { frequency: 880, duration: 0.09, type: 'sine', gain: 0.14 },
    { frequency: 1320, duration: 0.13, type: 'sine', gain: 0.12, delay: 0.07 },
  ],
  moyuEarn: [{ frequency: 740, duration: 0.10, type: 'sine', gain: 0.08, slideTo: 1040 }],
  moyuOverflow: [{ frequency: 180, duration: 0.12, type: 'square', gain: 0.05, slideTo: 110 }],
  moyuExtract: [{ frequency: 620, duration: 0.12, type: 'triangle', gain: 0.10, slideTo: 900 }],
  spawnDeploy: [{ frequency: 420, duration: 0.10, type: 'sine', gain: 0.10, slideTo: 540 }],
  gameOver: [
    { frequency: 400, duration: 0.25, type: 'sawtooth', gain: 0.10, slideTo: 80 },
    { frequency: 200, duration: 0.35, type: 'sawtooth', gain: 0.10, delay: 0.22, slideTo: 60 },
  ],
  newRecord: [
    { frequency: 660, duration: 0.08, type: 'sine', gain: 0.12, slideTo: 880 },
    { frequency: 990, duration: 0.20, type: 'sine', gain: 0.14, delay: 0.07, slideTo: 1320 },
  ],
};

export type AudioManagerOptions = {
  settings?: AppSettings;
  settingsStorage?: SettingsStorage | null;
  /** BGM is intentionally unset until a source with clear rights is supplied. */
  bgmSource?: string | null;
  bgmFactory?: (source: string) => BgmTrack | null;
  /** Useful for native bridges and deterministic tests; normal play uses WebAudio. */
  sfxPlayer?: (id: SfxId) => void;
  audioContextFactory?: () => AudioContextLike | null;
};

const resolveAudioContextFactory = (): (() => AudioContextLike | null) => () => {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return Context ? new Context() : null;
};

const defaultBgmFactory = (source: string): BgmTrack | null => {
  if (typeof Audio === 'undefined') return null;
  return new Audio(source);
};

/** The one audio owner for the app. Game/UI code never creates independent audio instances. */
export class AudioManager {
  private settings: AppSettings;
  private readonly settingsStorage: SettingsStorage | null | undefined;
  private readonly bgmFactory: (source: string) => BgmTrack | null;
  private readonly sfxPlayer?: (id: SfxId) => void;
  private readonly audioContextFactory: () => AudioContextLike | null;
  private bgmSource: string | null;
  private bgm: BgmTrack | null = null;
  private audioContext: AudioContextLike | null = null;
  private hasUserGesture = false;
  private pausedForBackground = false;

  constructor(options: AudioManagerOptions = {}) {
    this.settingsStorage = options.settingsStorage;
    this.settings = options.settings ? { ...options.settings } : loadAppSettings(this.settingsStorage);
    this.bgmSource = options.bgmSource ?? null;
    this.bgmFactory = options.bgmFactory ?? defaultBgmFactory;
    this.sfxPlayer = options.sfxPlayer;
    this.audioContextFactory = options.audioContextFactory ?? resolveAudioContextFactory();
  }

  getSettings(): AppSettings { return { ...this.settings }; }

  setMusicEnabled(enabled: boolean): void {
    if (this.settings.musicEnabled === enabled) return;
    this.settings.musicEnabled = enabled;
    this.persistSettings();
    if (!enabled) this.pauseBgm();
    else if (this.hasUserGesture && !this.pausedForBackground) this.resumeBgm();
  }

  setSfxEnabled(enabled: boolean): void {
    if (this.settings.sfxEnabled === enabled) return;
    this.settings.sfxEnabled = enabled;
    this.persistSettings();
  }

  setVibrationEnabled(enabled: boolean): void {
    if (this.settings.vibrationEnabled === enabled) return;
    this.settings.vibrationEnabled = enabled;
    this.persistSettings();
  }

  setDamageNumbersEnabled(enabled: boolean): void {
    if (this.settings.damageNumbersEnabled === enabled) return;
    this.settings.damageNumbersEnabled = enabled;
    this.persistSettings();
  }

  setBgmSource(source: string | null): void {
    if (source === this.bgmSource) return;
    this.stopBgm();
    this.bgmSource = source;
    if (source && this.settings.musicEnabled && this.hasUserGesture && !this.pausedForBackground) this.playBgm();
  }

  /** Call from the first trusted tap/drag; this is safe and idempotent. */
  registerUserGesture(): void {
    this.hasUserGesture = true;
    this.ensureAudioContext();
    if (this.settings.musicEnabled && !this.pausedForBackground) this.resumeBgm();
  }

  playBgm(): boolean {
    if (!this.settings.musicEnabled || !this.hasUserGesture || !this.bgmSource || this.pausedForBackground) return false;
    const bgm = this.ensureBgm();
    if (!bgm) return false;
    try {
      const result = bgm.play();
      if (result && typeof result.catch === 'function') void result.catch(() => { /* device fallback stays silent */ });
      return true;
    } catch {
      return false;
    }
  }

  pauseBgm(): void { try { this.bgm?.pause(); } catch { /* native media may be unavailable */ } }
  resumeBgm(): boolean { return this.playBgm(); }
  stopBgm(): void { this.pauseBgm(); this.bgm = null; }

  /** Page/WebView lifecycle hook. It does not alter the user's music setting. */
  setBackgrounded(backgrounded: boolean): void {
    this.pausedForBackground = backgrounded;
    if (backgrounded) this.pauseBgm();
    else if (this.settings.musicEnabled && this.hasUserGesture) this.resumeBgm();
  }

  /** Returns false when SFX are disabled or no device audio is available. */
  playSfx(id: SfxId): boolean {
    if (!this.settings.sfxEnabled) return false;
    if (this.sfxPlayer) {
      this.sfxPlayer(id);
      return true;
    }
    return this.playSynthesizedSfx(id);
  }

  private persistSettings(): void { saveAppSettings(this.settings, this.settingsStorage); }

  private ensureBgm(): BgmTrack | null {
    if (this.bgm) return this.bgm;
    if (!this.bgmSource) return null;
    const created = this.bgmFactory(this.bgmSource);
    if (!created) return null;
    created.loop = true;
    created.volume = 0.28;
    this.bgm = created;
    return created;
  }

  private ensureAudioContext(): AudioContextLike | null {
    if (!this.audioContext) this.audioContext = this.audioContextFactory();
    if (this.audioContext?.state === 'suspended') void this.audioContext.resume().catch(() => { /* harmless */ });
    return this.audioContext;
  }

  private playSynthesizedSfx(id: SfxId): boolean {
    const context = this.ensureAudioContext();
    if (!context) return false;
    try {
      for (const tone of tones[id]) {
        const start = context.currentTime + (tone.delay ?? 0);
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        if (tone.slideTo) oscillator.frequency.exponentialRampToValueAtTime(tone.slideTo, start + tone.duration);
        gain.gain.setValueAtTime(tone.gain, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + tone.duration + 0.02);
      }
      return true;
    } catch {
      return false;
    }
  }
}

let sharedAudioManager: AudioManager | null = null;

export const getAudioManager = (): AudioManager => {
  if (!sharedAudioManager) {
    sharedAudioManager = new AudioManager();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        sharedAudioManager?.setBackgrounded(document.visibilityState !== 'visible');
      });
    }
  }
  return sharedAudioManager;
};
