/**
 * Compatibility facade for existing scene code. New UI/game code should use
 * AudioManager directly so settings and lifecycle ownership stay centralized.
 */
import { getAudioManager } from './audio/AudioManager';

/** Call on a trusted user gesture; it satisfies browser/WebView autoplay rules. */
export const ensureAudio = (): void => getAudioManager().registerUserGesture();

/** Legacy SFX toggle. BGM has its own independent Music setting. */
export const setAudioEnabled = (enabled: boolean): void => getAudioManager().setSfxEnabled(enabled);

export const Sfx = {
  place: () => getAudioManager().playSfx('spawnDeploy'),
  merge: () => getAudioManager().playSfx('merge'),
  volley: () => getAudioManager().playSfx('projectileFire'),
  hit: () => getAudioManager().playSfx('enemyHit'),
  kill: () => getAudioManager().playSfx('enemyDeath'),
  capture: () => getAudioManager().playSfx('moyuIntercept'),
  gameOver: () => getAudioManager().playSfx('gameOver'),
};
