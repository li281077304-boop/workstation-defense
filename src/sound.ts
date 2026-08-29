/**
 * Placeholder sound effects synthesized with WebAudio (no audio files needed).
 *
 * These are NES-style bleeps — intentionally simple. They exist so the game
 * is not silent while real audio assets are pending. The Sfx API is the
 * contract; swap the internals for real samples later without touching scenes.
 */

let ctx: AudioContext | null = null;
let enabled = true;

/** Call on first user gesture so the browser allows audio. Safe to call repeatedly. */
export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

/** Set false to mute everything (future settings toggle). */
export function setAudioEnabled(on: boolean) { enabled = on; }

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number) {
  if (!ctx || !enabled) return;
  try {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* audio not available — silent is fine */ }
}

export const Sfx = {
  /** Plant placed into an empty cell. */
  place() { tone(420, 0.1, 'sine', 0.10, 0, 540); },
  /** Two equal plants merged. */
  merge() { tone(660, 0.10, 'sine', 0.16, 0, 880); tone(880, 0.16, 'sine', 0.12, 0.06, 1320); },
  /** All plants fire this turn (played once per turn, not per bullet). */
  volley() { tone(500, 0.07, 'triangle', 0.05, 0, 700); },
  /** Bullet hits an enemy (wounded). */
  hit() { tone(170, 0.06, 'square', 0.045); },
  /** Enemy defeated. */
  kill() { tone(360, 0.18, 'triangle', 0.14, 0, 130); },
  /** Reward ball captured. */
  capture() { tone(880, 0.09, 'sine', 0.14); tone(1320, 0.13, 'sine', 0.12, 0.07); },
  /** Game over. */
  gameOver() { tone(400, 0.25, 'sawtooth', 0.10, 0, 80); tone(200, 0.35, 'sawtooth', 0.10, 0.22, 60); },
};
