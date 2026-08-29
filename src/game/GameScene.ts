import Phaser from 'phaser';
import { DEFAULT_RULES, BOARD, ACTIVE_DIFFICULTY, ENDLESS_CURVE_V1, REWARD_ECONOMY_CURVE_V2, REWARD_ECONOMY_TEST_CONTROLS, REWARD_ECONOMY_VOLUME_PRESETS, maxRewardValueFor, restorePlayableBaselineV1, restoreRewardEconomyTestDefaults, type DifficultyMode, type RewardEconomyTestControls } from './config';
import { TurnManager, emptyState } from './TurnManager';
import type { Enemy, Move, RewardBall, TurnEvent } from './types';
import { MOBILE_LAYOUT as L } from '../ui/layout';
import { PLANT_VALUES } from '../ui/assets';
import { Sfx, ensureAudio } from '../sound';

const LEFT = L.board.defenseLeft, TOP = L.board.top, ROW = L.board.rowHeight;
const defenseX = (col: number) => LEFT + col * L.board.defenseCellWidth;
const fieldX = (col: number) => L.board.battlefieldLeft + col * L.board.battlefieldCellWidth;
const defenseColAt = (x: number) => x < LEFT || x >= LEFT + BOARD.defenseCols * L.board.defenseCellWidth ? -1 : Math.floor((x - LEFT) / L.board.defenseCellWidth);
const rowAt = (y: number) => Math.floor((y - TOP) / ROW);
/** Vite's development server is intentionally the only build exposing test controls. */
const isTestBuild = () => window.location.port === '5173';

/** A single projectile's animated journey in one lane. */
type Flight = { lane: number; frame: string; sourcePlantId: string; impacts: { x: number; type: string; value?: number; subjectId?: string; hpAfter?: number }[] };
type CombatVisualStart = { enemies: Enemy[]; rewardBalls: RewardBall[]; birthSlot: number | null };
type RunSummary = { score: number; turn: number; plantPower: number; firepowerUtilization: number; rewardCaptureRate: number; highestPlantValue: number; deathPressureRatio: number; lastTenEnemyCounts: number[] };

/** Map plant value → standalone image key. */
const PLANT_FRAME = (value: number): string => {
  const v = [...PLANT_VALUES].reverse().find(n => value >= n) ?? 1;
  return `plant-${v}`;
};

/** Cosmetic only: skin is stable and deliberately never reads HP or combat values. */
const ENEMY_VISUAL = (enemy: Pick<Enemy, 'width' | 'skin'>): { frame: string; tint?: number } => {
  if (enemy.width === 2) {
    const tints: Record<string, number> = { 'enemy-large-moss': 0xb7d99a, 'enemy-large-rust': 0xe0b07b, 'enemy-large-violet': 0xc6a5e8 };
    return { frame: 'enemy-large-01', tint: tints[enemy.skin ?? 'enemy-large-moss'] };
  }
  const legal = new Set(['enemy-basic-01', 'enemy-basic-02', 'enemy-basic-03', 'enemy-basic-04', 'enemy-basic-05', 'enemy-basic-06']);
  return { frame: legal.has(enemy.skin ?? '') ? enemy.skin! : 'enemy-basic-01' };
};

/** Original lane-colored projectile art. */
const BULLET_FRAMES = ['projectile-green', 'projectile-blue', 'projectile-orange', 'projectile-purple'];
const laneBulletFrame = (lane: number) => BULLET_FRAMES[lane % BULLET_FRAMES.length];

/** Standalone image key → asset path (complete PNGs; placeholder art is fine). */
const IMAGES: [string, string][] = [
  ...PLANT_VALUES.map<[string, string]>(v => [`plant-${v}`, `assets/plants/plant_${String(v).padStart(3, '0')}.png`]),
  ...([1, 2, 4, 8] as const).map<[string, string]>(v => [`reward-${v}`, `assets/rewards/reward_${v}.png`]),
  ['projectile-green', 'assets/projectiles/projectile_green.png'],
  ['projectile-blue', 'assets/projectiles/projectile_blue.png'],
  ['projectile-orange', 'assets/projectiles/projectile_orange.png'],
  ['projectile-purple', 'assets/projectiles/projectile_purple.png'],
  ['enemy-basic-01', 'assets/enemies/enemy_basic_01.png'],
  ['enemy-basic-02', 'assets/enemies/enemy_basic_02.png'],
  ['enemy-basic-03', 'assets/enemies/enemy_basic_03.png'],
  ['enemy-basic-04', 'assets/enemies/enemy_basic_04.png'],
  ['enemy-basic-05', 'assets/enemies/enemy_basic_05.png'],
  ['enemy-basic-06', 'assets/enemies/enemy_basic_06.png'],
  ['enemy-elite-01', 'assets/enemies/enemy_elite_01.png'],
  ['enemy-large-01', 'assets/enemies/enemy_large_01.png'],
  ['effect-merge', 'assets/effects/effect_merge.png'],
  ['effect-hit-green', 'assets/effects/effect_hit_green.png'],
  ['effect-hit-blue', 'assets/effects/effect_hit_blue.png'],
  ['effect-hit-orange', 'assets/effects/effect_hit_orange.png'],
  ['effect-hit-purple', 'assets/effects/effect_hit_purple.png'],
  ['effect-smoke-01', 'assets/effects/effect_smoke_01.png'],
  ['effect-smoke-02', 'assets/effects/effect_smoke_02.png'],
  ['defense-cell-v1', 'assets/tiles/defense_cell_v1.png'],
  ['battlefield-cell-v1', 'assets/tiles/battlefield_cell_v1.png'],
];

/** Scale a sprite to fit within (maxW, maxH) while preserving aspect ratio. */
function fitSprite(spr: Phaser.GameObjects.Sprite, maxW: number, maxH: number) {
  const f = spr.frame as Phaser.Textures.Frame;
  const fw = f.width, fh = f.height;
  const scale = Math.min(maxW / fw, maxH / fh);
  spr.setScale(scale);
}export class GameScene extends Phaser.Scene {
  private manager = new TurnManager(emptyState(), DEFAULT_RULES);
  private selected: { row: number; col: number } | 'birth' | null = null;
  private animating = false;
  private dragGhost: Phaser.GameObjects.Sprite | null = null;
  private mergePreview: Phaser.GameObjects.Container | null = null;
  private dragOrigin: { row: number; col: number } | 'birth' | null = null;
  private lastPlacement: { to: { row: number; col: number }; merged: boolean } | null = null;
  private birthSlotBefore: number | null = null;
  /**
   * The slot value the player is allowed to see.  It deliberately lags the
   * resolved game state while a captured RewardBall is still travelling.
   */
  private visualBirthSlot: number | null = null;
  private combatVisualStart: CombatVisualStart | null = null;
  private difficultyPanel: HTMLDivElement | null = null;
  private loadedRewardEconomyTestControls = false;
  private debugPanelHold: Phaser.Time.TimerEvent | null = null;
  private breathingSprites: Array<{ sprite: Phaser.GameObjects.Sprite; baseScale: number; amplitude: number; period: number; phase: number }> = [];
  private runSummaries: RunSummary[] = [];
  constructor() { super('game'); }

  update() {
    const now = this.time.now;
    for (const breath of this.breathingSprites) {
      if (!breath.sprite.active) continue;
      const wave = Math.sin((now / breath.period) * Math.PI * 2 + breath.phase);
      breath.sprite.y = wave * -breath.amplitude;
      breath.sprite.scaleX = breath.baseScale * (1 - wave * 0.01);
      breath.sprite.scaleY = breath.baseScale * (1 + wave * 0.015);
    }
  }

  preload() {
    this.load.image('battlefield-v0', 'assets/backgrounds/battlefield_v0.png');
    for (const [key, path] of IMAGES) this.load.image(key, path);
  }

  create() {
    // Fresh manager every scene (re)start — otherwise gameOver state leaks and restart never works.
    this.manager = new TurnManager(emptyState(), DEFAULT_RULES);
    this.visualBirthSlot = null;
    const s = this.manager.state;
    // Deliberately light opening: two value-1 plants, no birth-slot plant, one distant reward.
    for (const row of DEFAULT_RULES.startingPlantRows) s.plants[row][0] = { id: `start-${row}`, value: DEFAULT_RULES.startingPlantValue };
    this.manager.seedOpeningBatch(
      { id: 'opening-enemy', ...DEFAULT_RULES.openingEnemy, width: 1, height: 1, maxHp: DEFAULT_RULES.openingEnemy.hp },
      { id: 'opening-reward', ...DEFAULT_RULES.openingReward },
    );
    // scene.restart() re-runs create(): clear stale listeners first so they don't pile up (input jank).
    this.debugPanelHold?.remove(false);
    this.debugPanelHold = null;
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.keyboard?.off('keydown-R');
    this.input.keyboard?.off('keydown-D');
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handlePointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.handlePointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.handlePointerUp(p));
    this.input.keyboard?.on('keydown-R', () => this.scene.restart());
    this.input.keyboard?.on('keydown-D', () => this.toggleDifficultyPanel());
    this.createDifficultyPanel();
    this.render();
  }

  /** Test-build mobile entry: hold the score area for 1.2 seconds. */
  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    // The visible gear is the permanent APK entry for player-facing difficulty
    // tuning. Handle it before drag logic so it cannot be mistaken for a board
    // interaction.
    if (pointer.x >= L.header.settingsX - 110 && pointer.y <= 130) {
      this.cancelDrag();
      this.toggleDifficultyPanel();
      return;
    }
    // Mobile test entry: the score lives at the horizontal centre of the
    // 1280px canvas (x≈640). Keep the hit area generous after FIT scaling.
    if (isTestBuild() && pointer.x >= 480 && pointer.x <= 800 && pointer.y <= 130) {
      this.debugPanelHold = this.time.delayedCall(1200, () => {
        this.debugPanelHold = null;
        this.cancelDrag();
        this.toggleDifficultyPanel();
      });
    }
    this.beginDrag(pointer.x, pointer.y);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (this.isDifficultyPanelOpen()) return;
    if (this.debugPanelHold && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 30) {
      this.debugPanelHold.remove(false);
      this.debugPanelHold = null;
    }
    this.moveDrag(pointer.x, pointer.y);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (this.isDifficultyPanelOpen()) return;
    this.debugPanelHold?.remove(false);
    this.debugPanelHold = null;
    this.endDrag(pointer.x, pointer.y);
  }

  private beginDrag(x: number, y: number) {
    ensureAudio(); // browsers only allow audio after a user gesture
    if (this.isDifficultyPanelOpen()) return;
    if (this.animating) return;
    if (this.manager.state.gameOver) { this.scene.restart(); return; }
    const birth = this.isInSpawnSlot(x, y);
    const col = defenseColAt(x), row = rowAt(y);
    if (birth && this.manager.state.birthSlot !== null) {
      this.selected = 'birth';
      // Render FIRST so the ghost created after is not wiped by render()'s removeAll().
      this.render();
      const slot = this.getSpawnSlotCenter();
      this.spawnDragGhost(slot.x, slot.y - 35, PLANT_FRAME(this.manager.state.birthSlot), 110, 110);
      return;
    }
    if (row >= 0 && row < BOARD.rows && col >= 0 && this.manager.state.plants[row][col]) {
      this.selected = { row, col };
      const p = this.manager.state.plants[row][col];
      this.render();
      const cx = defenseX(col) + 80, cy = TOP + row * ROW + 82;
      this.spawnDragGhost(cx, cy, PLANT_FRAME(p.value), 130, 130);
    }
  }

  /** Create (or refresh) the ghost sprite that follows the pointer. */
  private spawnDragGhost(x: number, y: number, frame: string, maxW: number, maxH: number) {
    this.dragGhost?.destroy();
    this.dragGhost = this.add.sprite(x, y, frame).setDepth(80).setAlpha(0.85);
    fitSprite(this.dragGhost, maxW, maxH);
  }

  private moveDrag(x: number, y: number) {
    if (!this.selected || this.animating) return;
    if (this.dragGhost) {
      this.dragGhost.x = x;
      this.dragGhost.y = y;
    }
    this.updateMergePreview(x, y);
  }

  /**
   * A prospective merge is deliberately only a translucent prediction.  The
   * board state remains untouched until pointer-up calls TurnManager.perform.
   */
  private updateMergePreview(x: number, y: number) {
    const selected = this.selected;
    if (!selected) return;
    const row = rowAt(y), col = defenseColAt(x);
    const sourceValue = selected === 'birth'
      ? this.manager.state.birthSlot
      : this.manager.state.plants[selected.row]?.[selected.col]?.value ?? null;
    const target = row >= 0 && row < BOARD.rows && col >= 0 ? this.manager.state.plants[row][col] : null;
    const movingOntoSelf = selected !== 'birth' && selected.row === row && selected.col === col;
    if (sourceValue === null || !target || target.value !== sourceValue || movingOntoSelf) {
      this.mergePreview?.destroy();
      this.mergePreview = null;
      return;
    }
    const nextValue = sourceValue * 2;
    if (this.mergePreview?.getData('row') === row && this.mergePreview.getData('col') === col && this.mergePreview.getData('value') === nextValue) return;
    this.mergePreview?.destroy();
    const cx = defenseX(col) + 80, cy = TOP + row * ROW + 82;
    const preview = this.add.container(cx, cy).setDepth(76).setAlpha(0.7);
    preview.setData({ row, col, value: nextValue });
    const sprite = this.add.sprite(0, -8, PLANT_FRAME(nextValue));
    fitSprite(sprite, 116, 116);
    preview.add(sprite);
    preview.add(this.add.text(0, 63, `→ ${nextValue}`, { fontSize: '25px', color: '#fff4a8', stroke: '#345225', strokeThickness: 6, fontStyle: 'bold' }).setOrigin(.5));
    this.tweens.add({ targets: preview, alpha: 0.92, duration: 180, ease: 'Sine.easeOut' });
    this.mergePreview = preview;
  }

  private endDrag(x: number, y: number) {
    if (!this.selected || this.animating || this.manager.state.gameOver) return;
    const col = defenseColAt(x), row = rowAt(y);
    if (row < 0 || row >= BOARD.rows || col < 0) { this.cancelDrag(); return; }
    // Classify the move before perform() mutates the board.
    const from = this.selected;
    const to = { row, col };
    let merged = false;
    if (from === 'birth') {
      const dst = this.manager.state.plants[row][col];
      merged = !!dst && dst.value === this.manager.state.birthSlot;
    } else {
      const src = this.manager.state.plants[from.row]?.[from.col];
      const dst = this.manager.state.plants[row][col];
      merged = !!src && !!dst && src.value === dst.value;
    }
    const before = structuredClone(this.manager.state);
    const accepted = this.manager.perform({ from, to } as Move);
    this.cancelDrag();
    if (!accepted) { this.render(); return; }
    this.birthSlotBefore = from === 'birth' ? null : before.birthSlot;
    // A plant taken from the slot vanishes immediately; otherwise keep the
    // pre-combat value visible until a captured ball has actually arrived.
    this.visualBirthSlot = from === 'birth' ? null : before.birthSlot;
    this.combatVisualStart = {
      enemies: before.enemies,
      rewardBalls: before.rewardBalls,
      birthSlot: from === 'birth' ? null : before.birthSlot,
    };
    this.lastPlacement = { to, merged };
    this.animateTurn();
  }

  private cancelDrag() {
    this.selected = null;
    this.dragOrigin = null;
    this.dragGhost?.destroy();
    this.dragGhost = null;
    this.mergePreview?.destroy();
    this.mergePreview = null;
  }

  /* ─── Animation pipeline ─── */

  private animateTurn() {
    this.animating = true;
    // 1) Render post-operation plants and pre-combat enemies. New spawn events
    // are intentionally absent from this snapshot until the Spawn Phase.
    this.render(0, this.combatVisualStart ?? undefined);
    this.playPlacementAnimation();
    // 2) Every plant begins its volley together; a single plant keeps its
    // original readable cadence between its own multiple shots.
    const events = this.manager.state.events.slice();
    const gameOver = this.manager.state.gameOver;
    const flights = this.buildFlights(events);
    const advancedIds = events.filter(e => e.type === 'advance').map(e => e.subjectId!).filter(Boolean);
    const advancedRewardIds = events.filter(e => e.type === 'reward-advance').map(e => e.subjectId!).filter(Boolean);
    const fireAfter = this.lastPlacement ? 170 : 0;
    this.time.delayedCall(fireAfter, () => {
      if (flights.length) Sfx.volley();
      if (!flights.length) { this.finishTurn(gameOver, advancedIds, advancedRewardIds, events); return; }
      const flightsByPlant = new Map<string, Flight[]>();
      for (const flight of flights) {
        const volley = flightsByPlant.get(flight.sourcePlantId) ?? [];
        volley.push(flight);
        flightsByPlant.set(flight.sourcePlantId, volley);
      }
      let remaining = flights.length;
      for (const volley of flightsByPlant.values()) {
        volley.forEach((flight, index) => {
          const launch = () => this.animateOneFlight(flight, () => { if (--remaining === 0) this.finishTurn(gameOver, advancedIds, advancedRewardIds, events); });
          if (index === 0) launch();
          else this.time.delayedCall(index * 70, launch);
        });
      }
    });
  }

  /** Scale+flash the plant that just landed/merged, so placement reads as an animation. */
  private playPlacementAnimation() {
    const p = this.lastPlacement;
    if (!p) return;
    this.lastPlacement = null;
    const cx = defenseX(p.to.col) + 80, cy = TOP + p.to.row * ROW + 82;
    const spr = this.children.list.find((c): c is Phaser.GameObjects.Container =>
      c instanceof Phaser.GameObjects.Container && c.depth === 20 && Math.abs(c.x - cx) < 2 && Math.abs(c.y - cy) < 2
    );
    if (!spr) return;
    const base = spr.scale;
    spr.setScale(base * 1.35).setAlpha(0.9);
    this.tweens.add({ targets: spr, scale: base, alpha: 1, duration: 150, ease: 'Back.easeOut' });
    if (p.merged) {
      Sfx.merge();
      // Show the merged result value above the plant.
      const merged = this.manager.state.plants[p.to.row][p.to.col]?.value;
      if (merged) this.floatText(cx, cy - 78, `+${merged}`, '#ffd24d');
      const child = spr.list.find((item): item is Phaser.GameObjects.Sprite => item instanceof Phaser.GameObjects.Sprite);
      if (child) {
        child.setTint(0xffffff);
        this.tweens.add({ targets: child, tint: 0xffffff, duration: 60, yoyo: true, hold: 40 });
      }
    } else {
      Sfx.place();
    }
  }

  private finishTurn(gameOver: boolean, advancedIds: string[], advancedRewardIds: string[], events: TurnEvent[]) {
    // 3) All old survivors advance together before any new spawn becomes visible.
    this.slideBattlefieldEntities(advancedIds, advancedRewardIds, () => this.showSpawnPhase(gameOver, events));
  }

  /** Scale-bounce the birth slot sprite when its value changed this turn (refilled or upgraded). */
  private popBirthSlotIfRefreshed() {
    const now = this.manager.state.birthSlot;
    if (now === null || now === this.birthSlotBefore) return;
    const spr = this.children.list.find((c): c is Phaser.GameObjects.Container =>
      c instanceof Phaser.GameObjects.Container && c.getData('birthSlot') === true
    );
    if (!spr) return;
    const base = spr.scale;
    spr.setScale(base * 1.3);
    this.tweens.add({ targets: spr, scale: base, duration: 220, ease: 'Back.easeOut' });
  }

  /** Tween every old battlefield entity one cell left, then enter Spawn Phase. */
  private slideBattlefieldEntities(advancedIds: string[], advancedRewardIds: string[], done: () => void) {
    const advancing = new Set(advancedIds);
    const cellW = L.board.battlefieldCellWidth;
    const movers = this.manager.state.enemies.filter(enemy => advancing.has(enemy.id));
    const rewardMovers = advancedRewardIds.map(id => this.findEntity('rewardId', id)).filter((entity): entity is Phaser.GameObjects.Container => !!entity);
    if (!movers.length && !rewardMovers.length) { done(); return; }
    let remaining = movers.length + rewardMovers.length;
    for (const enemy of movers) {
      if (!advancing.has(enemy.id)) continue;
      const curX = fieldX(enemy.col) + enemy.width * cellW / 2;
      const spr = this.children.list.find((c): c is Phaser.GameObjects.Container =>
        c instanceof Phaser.GameObjects.Container && c.getData('enemyId') === enemy.id
      );
      if (!spr) { if (--remaining === 0) done(); continue; }
      // The pre-combat snapshot is already at prevX; never snap it right again.
      this.tweens.add({ targets: spr, x: curX, duration: 200, ease: 'Sine.easeOut', onComplete: () => { if (--remaining === 0) done(); } });
    }
    for (const reward of rewardMovers) {
      this.tweens.add({ targets: reward, x: reward.x - cellW, duration: 200, ease: 'Sine.easeOut', onComplete: () => { if (--remaining === 0) done(); } });
    }
  }

  private showSpawnPhase(gameOver: boolean, events: TurnEvent[]) {
    const spawned = new Set(events.filter(event => event.type === 'enemy-spawned' || event.type === 'reward-spawned').map(event => event.subjectId).filter(Boolean));
    // Do not let the resolved logical birthSlot leak into the screen here.
    // Any captured reward has already completed its flight before this phase.
    this.render();
    this.combatVisualStart = null;
    const entities = this.children.list.filter((child): child is Phaser.GameObjects.Container => child instanceof Phaser.GameObjects.Container && (spawned.has(child.getData('enemyId')) || spawned.has(child.getData('rewardId'))));
    if (!entities.length) { this.completeTurn(gameOver); return; }
    for (const entity of entities) entity.setAlpha(0).setScale(0.86);
    this.tweens.add({ targets: entities, alpha: 1, scale: 1, duration: 130, ease: 'Sine.easeOut', onComplete: () => this.completeTurn(gameOver) });
  }

  private completeTurn(gameOver: boolean) {
    // This is the first safe synchronization point: every projectile, reward
    // flight, enemy move, and spawn animation has completed.
    this.visualBirthSlot = this.manager.state.birthSlot;
    this.animating = false;
    this.popBirthSlotIfRefreshed();
    if (gameOver) { this.captureRunSummary(); Sfx.gameOver(); this.cameras.main.flash(160, 255, 120, 120); }
  }

  private captureRunSummary() {
    const metrics = this.manager.state.metrics;
    if (!metrics.length) return;
    const total = (key: 'theoreticalDamage' | 'effectiveEnemyDamage') => metrics.reduce((sum, metric) => sum + metric[key], 0);
    const theoretical = total('theoreticalDamage');
    const generated = this.manager.state.rewardLedger.reduce((sum, entry) => sum + entry.value, 0);
    const captured = this.manager.state.rewardLedger.filter(entry => entry.capturedTurn !== undefined).reduce((sum, entry) => sum + entry.value, 0);
    const last = metrics.at(-1)!;
    this.runSummaries.unshift({
      score: this.manager.state.score,
      turn: last.turn,
      plantPower: last.plantPower,
      firepowerUtilization: theoretical ? total('effectiveEnemyDamage') / theoretical : 0,
      rewardCaptureRate: generated ? captured / generated : 0,
      highestPlantValue: last.highestPlantValue,
      deathPressureRatio: last.pressureRatio,
      lastTenEnemyCounts: metrics.slice(-10).map(metric => metric.enemyCount),
    });
    this.runSummaries = this.runSummaries.slice(0, 12);
    this.refreshDifficultyPanel();
  }

  /** Group events into one flight per fired projectile. */
  private buildFlights(events: TurnEvent[]): Flight[] {
    const flights: Flight[] = [];
    let current: Flight | null = null;
    for (const e of events) {
      if (e.type === 'shot') {
        if (current) flights.push(current);
        current = { lane: e.lane ?? 0, frame: laneBulletFrame(e.lane ?? 0), sourcePlantId: e.sourcePlantId ?? `legacy-lane-${e.lane ?? 0}`, impacts: [] };
      } else if (current && (e.type === 'hit' || e.type === 'reward-captured' || e.type === 'kill')) {
        const col = e.col ?? BOARD.battlefieldCols - 1;
        current.impacts.push({ x: fieldX(col) + L.board.battlefieldCellWidth / 2, type: e.type === 'reward-captured' ? 'capture' : e.type, value: e.value, subjectId: e.subjectId, hpAfter: e.hpAfter });
      }
    }
    if (current) flights.push(current);
    return flights;
  }

  /** Animate one bullet sprite flying right along its lane, triggering impact effects at each hit point. */
  private animateOneFlight(f: Flight, done: () => void) {
    const startX = L.board.battlefieldLeft - 20;
    const y = TOP + f.lane * ROW + ROW / 2;
    const bullet = this.add.sprite(startX, y, f.frame).setDepth(50);
    bullet.setDisplaySize(60, 24);

    const rightEdge = fieldX(BOARD.battlefieldCols - 1) + L.board.battlefieldCellWidth;
    if (!f.impacts.length) {
      this.tweens.add({ targets: bullet, x: rightEdge, duration: 420, ease: 'Linear', onComplete: () => this.fadeBullet(bullet, done) });
      return;
    }
    let i = 0;
    const step = () => {
      if (i >= f.impacts.length) { this.fadeBullet(bullet, done); return; }
      const imp = f.impacts[i++];
      const dist = Math.abs(imp.x - bullet.x);
      this.tweens.add({
        targets: bullet, x: imp.x,
        duration: Math.max(130, dist * 0.55), ease: 'Linear',
        onComplete: () => this.playImpact(imp, y, bullet, imp.type === 'capture' ? done : step)
      });
    };
    step();
  }

  private fadeBullet(bullet: Phaser.GameObjects.Sprite, done: () => void) {
    this.tweens.add({ targets: bullet, alpha: 0, duration: 140, onComplete: () => { bullet.destroy(); done(); } });
  }

  /** Replay one already-calculated impact without exposing final combat state early. */
  private playImpact(imp: Flight['impacts'][number], y: number, bullet: Phaser.GameObjects.Sprite, done: () => void) {
    const { x, type, value, subjectId, hpAfter } = imp;
    if (type === 'capture') {
      // Reward captured: golden merge burst + "+N" popup
      Sfx.capture();
      const fx = this.add.sprite(x, y, 'effect-merge').setDepth(60);
      fx.setDisplaySize(110, 110);
      this.tweens.add({ targets: fx, scale: 1.7, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => fx.destroy() });
      if (value) this.floatText(x, y - 16, `+${value}`, '#ffd24d');
      bullet.destroy();
      const reward = subjectId ? this.findEntity('rewardId', subjectId) : undefined;
      // A missing container must not make the reward appear immediately.
      // Recreate a small visual proxy at the true hit point and give it the
      // same complete flight to the slot.
      const flyingReward = reward ?? this.createRewardFlightProxy(x, y, value ?? 1);
      this.flyRewardToBirthSlot(flyingReward, value ?? 1, done);
      return;
    }
    if (type === 'kill') {
      // Enemy defeated: smoke puff
      Sfx.kill();
      const fx = this.add.sprite(x, y - 10, 'effect-smoke-01').setDepth(60);
      fx.setDisplaySize(120, 120);
      this.tweens.add({ targets: fx, scale: 1.9, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => { fx.destroy(); if (subjectId) this.findEntity('enemyId', subjectId)?.destroy(); done(); } });
      return;
    }
    // Plain hit / pierce: quick impact flash
    Sfx.hit();
    const fx = this.add.sprite(x, y, 'effect-hit-green').setDepth(60);
    fx.setDisplaySize(70, 70);
    this.tweens.add({ targets: fx, scale: 1.7, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => fx.destroy() });
    this.time.delayedCall(90, () => { if (subjectId && hpAfter !== undefined) this.updateEnemyHp(subjectId, hpAfter); });
    this.time.delayedCall(130, done);
  }

  /** Small text that floats up and fades out. */
  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, { fontSize: '34px', color, stroke: '#1a1a1a', strokeThickness: 6, fontStyle: 'bold' }).setOrigin(.5).setDepth(70);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  /** Logical position stays on the container; a frame-driven child offset never resets between turns. */
  private addBreathingEntity(x: number, y: number, frame: string, maxW: number, maxH: number, depth: number, amp: number, duration: number, phaseKey: string) {
    const container = this.add.container(x, y).setDepth(depth);
    const sprite = this.add.sprite(0, 0, frame);
    fitSprite(sprite, maxW, maxH);
    container.add(sprite);
    const baseScale = sprite.scale;
    const phase = [...phaseKey].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 628, 0) / 100;
    this.breathingSprites.push({ sprite, baseScale, amplitude: amp, period: duration * 2, phase });
    return container;
  }

  private findEntity(key: 'enemyId' | 'rewardId', id: string) {
    return this.children.list.find((c): c is Phaser.GameObjects.Container => c instanceof Phaser.GameObjects.Container && c.getData(key) === id);
  }

  private updateEnemyHp(id: string, hp: number) {
    const label = this.findEntity('enemyId', id)?.getData('hpLabel') as Phaser.GameObjects.Text | undefined;
    label?.setText(String(hp));
  }

  private updateBirthSlotVisual(value: number) {
    const slot = this.getSpawnSlotCenter();
    let entity = this.children.list.find((c): c is Phaser.GameObjects.Container => c instanceof Phaser.GameObjects.Container && c.getData('birthSlot') === true);
    if (!entity) {
      entity = this.addBreathingEntity(slot.x, slot.y - 35, PLANT_FRAME(value), 110, 110, 20, 5, 1500, 'birth-slot');
      entity.setData('birthSlot', true);
      const label = this.add.text(slot.x, slot.y + 126, String(value), { fontSize: '36px', color: '#fff', stroke: '#18361d', strokeThickness: 6, fontStyle: 'bold' }).setOrigin(.5).setDepth(21);
      entity.setData('birthLabel', label);
    } else {
      const sprite = entity.list.find((item): item is Phaser.GameObjects.Sprite => item instanceof Phaser.GameObjects.Sprite);
      sprite?.setTexture(PLANT_FRAME(value));
      (entity.getData('birthLabel') as Phaser.GameObjects.Text | undefined)?.setText(String(value));
    }
    const base = entity.scale;
    entity.setScale(base * 1.3);
    this.tweens.add({ targets: entity, scale: base, duration: 220, ease: 'Back.easeOut' });
  }

  /** Fallback visual used only if a reward container was rebuilt unexpectedly. */
  private createRewardFlightProxy(x: number, y: number, value: number) {
    const proxy = this.add.container(x, y).setDepth(55);
    const sprite = this.add.sprite(0, 0, `reward-${Math.min(value, 8)}`);
    fitSprite(sprite, 56, 56);
    proxy.add(sprite);
    proxy.add(this.add.text(0, 0, String(value), { fontSize: '18px', color: '#51380a', fontStyle: 'bold' }).setOrigin(.5));
    return proxy;
  }

  /** Update the visible slot only after the captured ball reaches it. */
  private flyRewardToBirthSlot(reward: Phaser.GameObjects.Container, value: number, done: () => void) {
    const slot = this.getSpawnSlotCenter();
    const base = reward.scale;
    this.tweens.add({ targets: reward, scale: base * 1.12, duration: 80, ease: 'Sine.easeOut', onComplete: () => {
      this.tweens.add({ targets: reward, x: slot.x, y: slot.y, scale: base * 0.65, alpha: 0.3, duration: 290, ease: 'Sine.easeInOut', onComplete: () => {
        reward.destroy();
        this.visualBirthSlot = this.visualBirthSlot === null ? value : Math.max(this.visualBirthSlot, value);
        this.updateBirthSlotVisual(this.visualBirthSlot);
        done();
      } });
    } });
  }

  /** Single source of truth for every Spawn Slot visual and animation target. */
  private getSpawnSlotCenter() {
    return { x: L.spawnSlot.left + L.spawnSlot.width / 2, y: L.spawnSlot.centerY };
  }

  /** The full tall rectangle is draggable; the plant icon is not the hit target. */
  private isInSpawnSlot(x: number, y: number) {
    const slot = L.spawnSlot;
    return x >= slot.left && x <= slot.left + slot.width && y >= slot.centerY - slot.height / 2 && y <= slot.centerY + slot.height / 2;
  }

  /** Player-facing live difficulty settings, opened from the visible gear. */
  private createDifficultyPanel() {
    if (!this.loadedRewardEconomyTestControls) {
      this.loadedRewardEconomyTestControls = true;
      try {
        const saved = JSON.parse(localStorage.getItem('d-family-vs-aliens:reward-economy-v2-test-controls') ?? '{}') as Partial<RewardEconomyTestControls>;
        for (const [key, value] of Object.entries(saved)) {
          if (key in REWARD_ECONOMY_TEST_CONTROLS && typeof value === 'number' && Number.isFinite(value)) (REWARD_ECONOMY_TEST_CONTROLS as Record<string, number>)[key] = value;
        }
      } catch { /* no saved local test controls */ }
    }
    this.difficultyPanel?.remove();
    const panel = document.createElement('div');
    panel.id = 'difficulty-debug-panel';
    panel.style.cssText = 'position:fixed;z-index:2147483647;top:12px;right:12px;width:min(330px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px;background:#15221feF;color:#f7f1d0;border:1px solid #d8b969;border-radius:8px;font:14px system-ui;display:none;box-shadow:0 4px 18px #0008;pointer-events:auto;touch-action:pan-y';
    const curveKnobs: Array<[keyof typeof ENDLESS_CURVE_V1, string, number]> = [
      ['hpMultiplier', 'HP 整体倍率', 0.05], ['budgetMultiplier', '刷怪预算倍率', 0.05], ['rewardMultiplier', '奖励概率倍率', 0.05],
    ];
    const baselineFields: Array<[keyof typeof DEFAULT_RULES, string, number]> = [
      ['enemyHpBase', 'Enemy 基础 HP', 0.5], ['enemyHpGrowthPerTurn', 'Enemy HP 成长', 0.05],
      ['enemySpawnChance', '每回合刷怪概率', 0.05], ['enemiesPerTurn', '单回合最大刷怪数', 1],
      ['enemyCap', '场上怪物上限', 1], ['largeEnemySpawnChance', '2×2 满概率', 0.01],
      ['largeEnemyUnlockScore', '2×2 开始解锁分数', 50], ['largeEnemyFullChanceScore', '2×2 满概率分数', 50],
      ['largeEnemyHpMultiplier', '2×2 HP倍率', 0.05], ['normalEnemyMaxRequiredUtilization', '普通怪最大需求利用率', 0.05],
      ['largeEnemyMaxRequiredUtilization', '大怪最大需求利用率', 0.05], ['hardPressureCap', '硬压力上限', 0.05], ['rewardSpawnChance', '奖励球出现概率', 0.05],
      ['maxNaturalSpawnValue', '奖励球最高硬上限', 1],
    ];
    const knobHtml = (cfg: Record<string, number>, list: Array<[string, string, number]>) =>
      list.map(([key, label, step]) => `<label style="display:block;margin:6px 0">${label}<input data-key="${key}" type="number" step="${step}" style="float:right;width:70px" value="${cfg[key]}"></label>`).join('');
    panel.innerHTML = `<strong>难度设置</strong> <button type="button" data-close style="float:right;min-height:40px">关闭</button><hr style="border-color:#59675c"><div data-mode></div><div data-knobs></div><div data-baseline></div><div data-stats></div><div data-runs></div><button type="button" data-restore style="width:100%;min-height:44px;margin:6px 0">恢复默认参数</button><label style="display:block;margin-top:7px"><input data-metrics-log type="checkbox"> 控制台记录 Turn 指标</label><p style="margin:8px 0 0;color:#c8d8c8">修改只影响后续 Turn；按 R 重开。</p>`;
    panel.addEventListener('pointerdown', event => event.stopPropagation());
    panel.addEventListener('pointerup', event => event.stopPropagation());
    panel.addEventListener('click', event => event.stopPropagation());
    panel.querySelector<HTMLButtonElement>('[data-close]')?.addEventListener('click', () => this.toggleDifficultyPanel());
    // Mode switch (two difficulty systems)
    const modeBox = panel.querySelector<HTMLElement>('[data-mode]');
    if (modeBox) {
      const mode: DifficultyMode = ACTIVE_DIFFICULTY.mode;
      modeBox.innerHTML = `<strong>难度系统</strong><select data-mode-select style="float:right;width:160px;background:#20352e;color:#f7f1d0;border:1px solid #59675c"><option value="reward-economy" ${mode === 'reward-economy' ? 'selected' : ''}>BALANCED_V1</option><option value="endless-curve" ${mode === 'endless-curve' ? 'selected' : ''}>ENDLESS_CURVE_V1</option><option value="baseline" ${mode === 'baseline' ? 'selected' : ''}>PLAYABLE_BASELINE_V1</option></select>`;
      modeBox.querySelector<HTMLSelectElement>('[data-mode-select]')!.addEventListener('change', (e) => {
        ACTIVE_DIFFICULTY.mode = (e.target as HTMLSelectElement).value as DifficultyMode;
        this.createDifficultyPanel();
        if (this.difficultyPanel) this.difficultyPanel.style.display = 'block';
      });
    }
    // Knobs: V2 output valves, ENDLESS_CURVE_V1 (3 knobs), or baseline (many).
    const knobBox = panel.querySelector<HTMLElement>('[data-knobs]');
    const baselineBox = panel.querySelector<HTMLElement>('[data-baseline]');
    if (knobBox && baselineBox) {
      const modeNow = ACTIVE_DIFFICULTY.mode;
      if (modeNow === 'reward-economy') {
        const v2Knobs: Array<[keyof RewardEconomyTestControls, string, number, number, number]> = [
          ['enemyVolumeMultiplier', 'Enemy Volume', 0.4, 1.5, 0.1],
          ['enemyHpMultiplier', 'Enemy HP', 0.5, 1.5, 0.1],
          ['rewardRateMultiplier', 'Reward Rate', 0.5, 1.5, 0.1],
          ['largeEnemyRateMultiplier', 'Large Enemy Rate', 0, 1.5, 0.1],
          ['baselineCaptureRate', '标准奖励获取率', 0.20, 0.70, 0.05],
          ['rewardProgression', '高级球增长速度', 0.5, 2.0, 0.1],
          ['highValueBias', '高级球倾向', 0.30, 1.00, 0.05],
        ];
        const stepButton = (key: keyof RewardEconomyTestControls, delta: number) => `<button data-v2-step="${key}" data-delta="${delta}" style="width:44px;height:44px;font-size:22px">${delta < 0 ? '−' : '+'}</button>`;
        const number = (value: number) => value.toFixed(1);
        knobBox.innerHTML = `<strong>REWARD_ECONOMY_CURVE_V2</strong><div style="color:#a8d0a8;font-size:11px;margin:3px 0 7px">仅调最终输出阀门；不改经济公式</div>${v2Knobs.map(([key, label, min, max, step]) => `<div style="display:flex;align-items:center;gap:7px;margin:5px 0"><span style="width:112px">${label}</span>${stepButton(key, -step)}<strong data-v2-value="${key}" style="width:34px;text-align:center">${number(REWARD_ECONOMY_TEST_CONTROLS[key])}</strong>${stepButton(key, step)}<small style="color:#a8d0a8">${min}–${max}</small></div>`).join('')}<div style="display:flex;align-items:center;gap:7px;margin:7px 0"><span style="width:112px">Enemy Count Cap</span><button data-v2-cap="-1" style="width:32px">−</button><strong data-v2-cap-value style="width:34px;text-align:center">${REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap}</strong><button data-v2-cap="1" style="width:32px">+</button><small style="color:#a8d0a8">6/8/10/12/15</small></div><div style="display:flex;gap:4px;margin:8px 0"><button data-v2-preset="EASY_VOLUME" style="flex:1">EASY 0.6</button><button data-v2-preset="NORMAL_VOLUME" style="flex:1">NORMAL 0.8</button><button data-v2-preset="HARD_VOLUME" style="flex:1">HARD 1.0</button></div><button data-v2-restore style="width:100%;margin:3px 0">恢复V2默认值</button><button data-v2-save style="width:100%;margin:3px 0">保存当前测试参数</button><textarea data-v2-copy readonly style="width:100%;box-sizing:border-box;height:38px;font:10px monospace">enemyVolume=${number(REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier)}\nenemyHp=${number(REWARD_ECONOMY_TEST_CONTROLS.enemyHpMultiplier)} rewardRate=${number(REWARD_ECONOMY_TEST_CONTROLS.rewardRateMultiplier)} largeEnemyRate=${number(REWARD_ECONOMY_TEST_CONTROLS.largeEnemyRateMultiplier)} enemyCountCap=${REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap}</textarea>`;
        const title = knobBox.querySelector<HTMLElement>('strong');
        if (title) title.textContent = 'BALANCED_V1';
        const restoreLabel = knobBox.querySelector<HTMLButtonElement>('[data-v2-restore]');
        if (restoreLabel) restoreLabel.textContent = '恢复 BALANCED_V1';
        v2Knobs.forEach(([key]) => {
          const value = knobBox.querySelector<HTMLElement>(`[data-v2-value="${key}"]`);
          if (value) value.textContent = this.formatV2Control(key);
        });
        const copy = knobBox.querySelector<HTMLTextAreaElement>('[data-v2-copy]');
        if (copy) copy.value = this.v2ControlsSnippet();
        baselineBox.style.display = 'none';
      } else if (modeNow === 'endless-curve') {
        knobBox.innerHTML = `<strong>ENDLESS_CURVE_V1 旋钮</strong>${knobHtml(ENDLESS_CURVE_V1 as unknown as Record<string, number>, curveKnobs)}`;
        baselineBox.style.display = 'none';
      } else {
        knobBox.style.display = 'none';
        baselineBox.innerHTML = `<strong>PLAYABLE_BASELINE_V1 参数</strong>${knobHtml(DEFAULT_RULES as unknown as Record<string, number>, baselineFields)}`;
      }
    }
    panel.querySelectorAll<HTMLInputElement>('input[data-key]').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.key as string;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      if (ACTIVE_DIFFICULTY.mode === 'endless-curve' && key in ENDLESS_CURVE_V1) {
        (ENDLESS_CURVE_V1 as unknown as Record<string, number>)[key] = value;
      } else if (key in DEFAULT_RULES) {
        (DEFAULT_RULES as Record<string, unknown>)[key] = value;
      }
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-v2-step]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.v2Step as keyof RewardEconomyTestControls;
      const delta = Number(button.dataset.delta);
      console.info(`SETTINGS_CLICK ${key} ${delta < 0 ? '-' : '+'}`);
      const ranges: Record<string, [number, number]> = { enemyVolumeMultiplier: [0.4, 1.5], enemyHpMultiplier: [0.5, 1.5], rewardRateMultiplier: [0.5, 1.5], largeEnemyRateMultiplier: [0, 1.5], baselineCaptureRate: [0.20, 0.70], rewardProgression: [0.5, 2.0], highValueBias: [0.30, 1.00] };
      const [min, max] = ranges[key];
      const precision = Math.abs(delta) === 0.05 ? 2 : 1;
      REWARD_ECONOMY_TEST_CONTROLS[key] = Math.min(max, Math.max(min, +(REWARD_ECONOMY_TEST_CONTROLS[key] + delta).toFixed(precision)));
      this.manager.reconcileRewardEconomyBudgetBank();
      this.refreshV2ControlValues();
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-v2-cap]').forEach(button => button.addEventListener('click', () => {
      console.info(`SETTINGS_CLICK enemyCountCap ${Number(button.dataset.v2Cap) < 0 ? '-' : '+'}`);
      const caps = [6, 8, 10, 12, 15];
      const index = caps.indexOf(REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap);
      const next = Math.min(caps.length - 1, Math.max(0, index + Number(button.dataset.v2Cap)));
      REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap = caps[next];
      this.manager.reconcileRewardEconomyBudgetBank();
      this.refreshV2ControlValues();
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-v2-preset]').forEach(button => button.addEventListener('click', () => {
      console.info(`SETTINGS_CLICK enemyVolume preset ${button.dataset.v2Preset}`);
      REWARD_ECONOMY_TEST_CONTROLS.enemyVolumeMultiplier = REWARD_ECONOMY_VOLUME_PRESETS[button.dataset.v2Preset as keyof typeof REWARD_ECONOMY_VOLUME_PRESETS];
      this.manager.reconcileRewardEconomyBudgetBank();
      this.refreshV2ControlValues();
    }));
    panel.querySelector<HTMLButtonElement>('[data-v2-restore]')?.addEventListener('click', () => {
      console.info('SETTINGS_CLICK restoreV2');
      restoreRewardEconomyTestDefaults();
      localStorage.removeItem('d-family-vs-aliens:reward-economy-v2-test-controls');
      this.manager.reconcileRewardEconomyBudgetBank();
      this.refreshV2ControlValues();
    });
    panel.querySelector<HTMLButtonElement>('[data-v2-save]')?.addEventListener('click', async event => {
      const snippet = panel.querySelector<HTMLTextAreaElement>('[data-v2-copy]')?.value ?? '';
      localStorage.setItem('d-family-vs-aliens:reward-economy-v2-test-controls', JSON.stringify(REWARD_ECONOMY_TEST_CONTROLS));
      try { await navigator.clipboard.writeText(snippet); } catch { /* textarea remains available for manual copy */ }
      (event.currentTarget as HTMLButtonElement).textContent = '已保存并复制参数';
    });
    const logToggle = panel.querySelector<HTMLInputElement>('[data-metrics-log]');
    if (logToggle) { logToggle.checked = DEFAULT_RULES.metricsLogging || ENDLESS_CURVE_V1.metricsLogging; logToggle.addEventListener('input', () => { DEFAULT_RULES.metricsLogging = logToggle.checked; (ENDLESS_CURVE_V1 as unknown as { metricsLogging: boolean }).metricsLogging = logToggle.checked; }); }
    const genericRestore = panel.querySelector<HTMLButtonElement>('[data-restore]');
    if (ACTIVE_DIFFICULTY.mode === 'reward-economy' && genericRestore) genericRestore.style.display = 'none';
    genericRestore?.addEventListener('click', () => {
      if (ACTIVE_DIFFICULTY.mode === 'reward-economy') {
        restoreRewardEconomyTestDefaults();
        localStorage.removeItem('d-family-vs-aliens:reward-economy-v2-test-controls');
        this.manager.reconcileRewardEconomyBudgetBank();
      } else if (ACTIVE_DIFFICULTY.mode === 'endless-curve') {
        Object.assign(ENDLESS_CURVE_V1 as unknown as Record<string, number>, { hpMultiplier: 1.0, budgetMultiplier: 1.0, rewardMultiplier: 1.0 });
      } else {
        restorePlayableBaselineV1();
      }
      this.createDifficultyPanel();
      if (this.difficultyPanel) this.difficultyPanel.style.display = 'block';
    });
    panel.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.type = 'button';
      button.style.minHeight = button.style.minHeight || '44px';
      if (button.dataset.v2Cap) button.style.width = '44px';
      button.style.touchAction = 'manipulation';
      button.style.pointerEvents = 'auto';
    });
    document.body.append(panel);
    this.difficultyPanel = panel;
    this.refreshDifficultyPanel();
  }

  /** Update live V2 controls without destroying their touch targets mid-gesture. */
  private refreshV2ControlValues() {
    const panel = this.difficultyPanel;
    if (!panel) return;
    const values: Array<keyof RewardEconomyTestControls> = ['enemyVolumeMultiplier', 'enemyHpMultiplier', 'rewardRateMultiplier', 'largeEnemyRateMultiplier', 'baselineCaptureRate', 'rewardProgression', 'highValueBias'];
    for (const key of values) {
      const value = panel.querySelector<HTMLElement>(`[data-v2-value="${key}"]`);
      if (value) value.textContent = this.formatV2Control(key);
    }
    const cap = panel.querySelector<HTMLElement>('[data-v2-cap-value]');
    if (cap) cap.textContent = String(REWARD_ECONOMY_TEST_CONTROLS.enemyCountCap);
    const snippet = panel.querySelector<HTMLTextAreaElement>('[data-v2-copy]');
    if (snippet) snippet.value = this.v2ControlsSnippet();
    this.refreshDifficultyPanel();
  }

  private formatV2Control(key: keyof RewardEconomyTestControls) {
    const value = REWARD_ECONOMY_TEST_CONTROLS[key];
    return key === 'baselineCaptureRate' ? `${Math.round(value * 100)}%` : key === 'highValueBias' ? value.toFixed(2) : value.toFixed(1);
  }

  private v2ControlsSnippet() {
    const c = REWARD_ECONOMY_TEST_CONTROLS;
    return `enemyVolume=${c.enemyVolumeMultiplier.toFixed(1)}\nenemyHp=${c.enemyHpMultiplier.toFixed(1)} rewardRate=${c.rewardRateMultiplier.toFixed(1)}\nlargeEnemyRate=${c.largeEnemyRateMultiplier.toFixed(1)} enemyCountCap=${c.enemyCountCap}\nbaselineCapture=${Math.round(c.baselineCaptureRate * 100)}% progression=${c.rewardProgression.toFixed(1)} highValueBias=${c.highValueBias.toFixed(2)}`;
  }

  private isDifficultyPanelOpen() {
    return this.difficultyPanel?.style.display === 'block';
  }

  private toggleDifficultyPanel() {
    if (!this.difficultyPanel) return;
    this.difficultyPanel.style.display = this.difficultyPanel.style.display === 'none' ? 'block' : 'none';
    this.refreshDifficultyPanel();
  }

  private refreshDifficultyPanel() {
    const stats = this.difficultyPanel?.querySelector<HTMLElement>('[data-stats]');
    if (!stats) return;
    const highest = Math.max(1, ...this.manager.state.plants.flatMap(row => row.filter((plant): plant is NonNullable<typeof plant> => plant !== null).map(plant => plant.value)));
    const recent = this.manager.state.metrics.slice(-10);
    const total = (key: 'theoreticalDamage' | 'effectiveEnemyDamage' | 'rewardSpawnValue' | 'rewardCapturedValue') => recent.reduce((sum, metric) => sum + metric[key], 0);
    const theoretical = total('theoreticalDamage'), effective = total('effectiveEnemyDamage');
    const last = recent.at(-1);
    const percent = (value: number) => `${Math.round(value * 100)}%`;
    const safety = this.manager.state.spawnSafety.map(item => `${item.kind} HP${item.hp} ${item.width}×${item.height} · ${item.remainingTurns}T · Lane${item.relevantLanePower} · 需求${percent(item.requiredUtilization)} · 预测${percent(item.predictedPressureRatio)}${item.reason ? ` · 拒绝:${item.reason}` : ''}`).join('<br>') || '本 Turn 无待出生单位';
    // ENDLESS_CURVE_V1 live formula diagnostics
    let formula = '';
    if (ACTIVE_DIFFICULTY.mode === 'endless-curve') {
      const d = this.manager.formulaDiagnostics();
      formula = `<br>基础Enemy HP(T${d.turn})：${d.baseHp}<br>HP随机范围：${d.hpRange}<br>10Turn Threat Budget：${d.budget10}<br>Budget Bank：${d.budgetBank}<br>本Turn实际花费：${d.spentThisTurn}<br>2×2 Chance：${percent(d.largeChance)}<br>Reward Chance：${percent(d.rewardChance)}`;
    }
    // REWARD_ECONOMY_CURVE_V2 economy chain
    let economy = '';
    if (ACTIVE_DIFFICULTY.mode === 'reward-economy') {
      const d = this.manager.rewardEconomyDiagnostics();
      const lanes = this.manager.laneDistributionDiagnostics();
      economy = `<br><strong>经济链（V2）</strong><br>实际 PlantPower：${last?.plantPower ?? 0}<br>Expected PlantPower：${d.expectedPlantPower}（Baseline ${percent(d.baselineCaptureRate)}）<br>当前允许奖励：${[1, 2, 4, 8].filter(value => value <= d.rewardMax).join(' / ')}<br>当前奖励概率：1 ${percent(d.rewardWeights[1] ?? 0)} · 2 ${percent(d.rewardWeights[2] ?? 0)} · 4 ${percent(d.rewardWeights[4] ?? 0)} · 8 ${percent(d.rewardWeights[8] ?? 0)}<br>Expected Ball Value：${d.singleRewardExpected} · Reward Spawn Chance：${percent(d.finalRewardSpawnChance)}<br>每Turn Expected Generated Value：${d.expectedGeneratedThisTurn}<br>最近10T 生成 / 可达 / 捕获 / 投入：${last?.rollingRewardSpawnValue ?? 0} / ${last?.rollingRewardReachableValue ?? 0} / ${last?.rollingRewardCapturedValue ?? 0} / ${last?.rollingRewardRealizedValue ?? 0}<br>Raw Capture Rate：${last ? percent(last.rewardCaptureRate) : '—'} · Opportunity Capture Rate：${last ? percent(last.rewardOpportunityCaptureRate) : '—'}<br>RewardRealizationRate：${last ? percent(last.rewardRealizationRate) : '—'}<br>DifficultyFactor：${(d.difficultyFactor * 100).toFixed(1)}%<br>Enemy Volume：${d.enemyVolumeMultiplier.toFixed(1)} · Enemy HP：${d.enemyHpMultiplier.toFixed(1)}<br>Reward Rate：${d.rewardRateMultiplier.toFixed(1)} · Growth：${d.rewardProgression.toFixed(1)} · Bias：${d.highValueBias.toFixed(2)}<br>Enemy Count：${d.enemyCount} / ${d.enemyCountCap}<br>Lane Enemy Count (L1–L5)：${lanes.enemyCounts.join(' / ')}<br>最近10 Turn Spawn (L1–L5)：${lanes.recentEnemySpawns.join(' / ')}<br>本Turn理论HP Budget：${d.theoreticalHpBudget}<br>有效Budget收入：${d.effectiveHpBudgetIncome}<br>本Turn实际消费 Budget：${d.actualSpendBudget}<br>当前 Budget Bank：${d.hpBudgetBank} / ${d.maxBudgetBank}<br>普通怪目标HP：${d.normalEnemyTargetHp}`;
    }
    const firstReached = (value: number) => this.manager.state.metrics.find(metric => metric.highestPlantValue >= value)?.turn ?? '未达到';
    const stage = highest < 32 ? 'Early Game' : highest < 256 ? 'Mid Game' : highest < 512 ? 'Late Game' : 'Deep Endless';
    const displayedRewardCap = ACTIVE_DIFFICULTY.mode === 'reward-economy' ? this.manager.rewardEconomyDiagnostics().rewardMax : REWARD_ECONOMY_CURVE_V2.maxNaturalSpawnValue;
    stats.innerHTML = `分数：${this.manager.state.score}<br>当前理论总火力：${last?.plantPower ?? 0}<br>最近10 Turn 火力利用率：${theoretical ? percent(effective / theoretical) : '—'}<br>当前 BattlefieldPressure：${last?.battlefieldPressure.toFixed(1) ?? '0'}<br>Pressure / PlantPower：${last ? percent(last.pressureRatio) : '—'}<br>本 Turn 待Spawn Batch Pressure：${last?.pendingSpawnBatchPressure.toFixed(1) ?? '0'}<br>Spawn后预测PressureRatio：${last ? percent(last.predictedSpawnPressureRatio) : '—'}<br>当前最高植物：${highest} · ${stage}<br>首次达到 8 / 16 / 32 / 64：${firstReached(8)} / ${firstReached(16)} / ${firstReached(32)} / ${firstReached(64)}<br>当前奖励球自然生成上限：${displayedRewardCap}${formula}${economy}<br><small>奖励获取：&lt;20% 较差 · 20–30% 偏低 · 约30% 基准 · 30–40% 良好 · 50%+ 非常优秀</small><hr style="border-color:#59675c"><small>${safety}</small><hr style="border-color:#59675c">`;
    const runs = this.difficultyPanel?.querySelector<HTMLElement>('[data-runs]');
    if (runs) runs.innerHTML = this.runSummaries.length ? `<strong>已结束对局（死亡记录）</strong><br>${this.runSummaries.map((run, index) => `#${index + 1} 分${run.score} · Turn ${run.turn} · 最高${run.highestPlantValue}<br>PlantPower ${run.plantPower} · 奖励${percent(run.rewardCaptureRate)} · 火力${percent(run.firepowerUtilization)} · 死亡压力${percent(run.deathPressureRatio)}<br>死亡前10T敌人数 ${run.lastTenEnemyCounts.join(' → ')}`).join('<hr style="border-color:#59675c">')}<hr style="border-color:#59675c">` : '';
  }

  /* ─── Sprite-based rendering ─── */

  private render(enemyColOffset = 0, visualStart?: CombatVisualStart) {
    this.tweens.killAll();
    this.breathingSprites = [];
    this.children.removeAll();
    const s = this.manager.state;
    const visualRewards = visualStart?.rewardBalls ?? s.rewardBalls;
    const visualEnemies = visualStart?.enemies ?? s.enemies;
    // Renderer never reads the already-resolved logical slot during a turn.
    // This makes "ball arrives, then plant appears" an invariant rather than
    // a best-effort ordering of render calls.
    const visualBirthSlot = visualStart?.birthSlot ?? this.visualBirthSlot;

    // Background (bottom layer)
    this.add.image(L.width / 2, L.height / 2, 'battlefield-v0').setDisplaySize(L.width, L.height).setDepth(0);

    // Board overlay tint
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x123129, .25).fillRect(0, 0, L.width, L.height);
    g.fillStyle(0x183d35, .45).fillRoundedRect(20, 132, L.board.battlefieldLeft - 40, 918, 22);
    g.fillStyle(0x4c382b, .55).fillRoundedRect(L.board.battlefieldLeft - 14, 132, L.width - L.board.battlefieldLeft - 26, 918, 22);

    // One continuous tall Spawn Slot, centered on Defense Row 3. It is drawn
    // even while empty so its full hit area remains obvious to the player.
    const slot = L.spawnSlot;
    const slotTop = slot.centerY - slot.height / 2;
    g.fillStyle(0x294b35, .9).fillRoundedRect(slot.left, slotTop, slot.width, slot.height, 28);
    g.lineStyle(7, 0xb9d36c, .95).strokeRoundedRect(slot.left, slotTop, slot.width, slot.height, 28);
    g.lineStyle(2, 0x6d4a27, .9).strokeRoundedRect(slot.left + 10, slotTop + 10, slot.width - 20, slot.height - 20, 21);

    // UI text
    this.add.text(960, L.header.scoreY, `分数 ${s.score.toLocaleString()}`, { fontSize: '46px', color: '#ffe7a3', stroke: '#57351d', strokeThickness: 8 }).setOrigin(.5, 0).setDepth(10);
    this.add.text(L.header.settingsX, 30, '⚙', { fontSize: '50px', color: '#e4efe8' }).setDepth(10);

    // Grid lanes & cells
    for (let r = 0; r < BOARD.rows; r++) {
      const y = TOP + r * ROW;
      const laneColor = r % 2 ? 0x34543a : 0x3b6140;
      g.fillStyle(laneColor, .75).fillRect(L.board.battlefieldLeft, y, BOARD.battlefieldCols * L.board.battlefieldCellWidth, ROW);
      for (let c = 0; c < BOARD.defenseCols; c++) {
        const x = defenseX(c);
        this.add.image(x + L.board.defenseCellWidth / 2, y + ROW / 2, 'defense-cell-v1').setDisplaySize(150, 160).setDepth(2);
      }
      for (let c = 0; c < BOARD.battlefieldCols; c++) {
        const x = fieldX(c);
        this.add.image(x + L.board.battlefieldCellWidth / 2, y + ROW / 2, 'battlefield-cell-v1').setDisplaySize(L.board.battlefieldCellWidth - 6, 150).setDepth(2);
      }
    }

    // Plants — sprite based (keep aspect ratio, fit within cell)
    for (let r = 0; r < BOARD.rows; r++) {
      for (let c = 0; c < BOARD.defenseCols; c++) {
        const p = s.plants[r][c];
        if (!p) continue;
        const cx = defenseX(c) + L.board.defenseCellWidth / 2;
        const cy = TOP + r * ROW + 82;
        const frame = PLANT_FRAME(p.value);
        const entity = this.addBreathingEntity(cx, cy, frame, 128, 128, 20, 3, 700 + (r * 80 + c * 45), p.id);

        // Value label on top
        this.add.text(cx, cy - 62, String(p.value), { fontSize: '28px', color: '#fff', stroke: '#18361d', strokeThickness: 6, fontStyle: 'bold' }).setOrigin(.5).setDepth(21);

        // Selection highlight
        if (this.selected !== 'birth' && this.selected?.row === r && this.selected.col === c) {
          g.lineStyle(5, 0xffee87).strokeRoundedRect(defenseX(c) + 7, TOP + r * ROW + 10, 146, 156, 16);
        }
      }
    }

    // Tall Spawn Slot: icon slightly above centre, value below. Empty remains a
    // visible empty slot rather than showing a fake plant.
    const slotCenter = this.getSpawnSlotCenter();
    this.add.text(slotCenter.x, slotTop + 34, '出生槽', { fontSize: '24px', color: '#ffe7a3', stroke: '#57351d', strokeThickness: 5, fontStyle: 'bold' }).setOrigin(.5).setDepth(10);
    if (visualBirthSlot !== null) {
      const bspr = this.addBreathingEntity(slotCenter.x, slotCenter.y - 35, PLANT_FRAME(visualBirthSlot), 110, 110, 20, 3, 750, 'birth-slot');
      bspr.setData('birthSlot', true);
      const birthLabel = this.add.text(slotCenter.x, slotCenter.y + 126, String(visualBirthSlot), { fontSize: '36px', color: '#fff', stroke: '#18361d', strokeThickness: 6, fontStyle: 'bold' }).setOrigin(.5).setDepth(21);
      bspr.setData('birthLabel', birthLabel);
    } else {
      this.add.text(slotCenter.x, slotCenter.y + 12, '等待奖励球', { fontSize: '17px', color: '#c9d9a4', stroke: '#18361d', strokeThickness: 3 }).setOrigin(.5).setDepth(10);
    }

    // Reward balls — sprite based
    const stacks = new Map<string, number>();
    for (const b of visualRewards) {
      const key = `${b.row}:${b.col}`, index = stacks.get(key) ?? 0;
      stacks.set(key, index + 1);
      const shift: [number, number][] = [[-20, -12], [0, 0], [20, 12]];
      const sh = shift[index % 3];
      const rx = fieldX(b.col) + L.board.battlefieldCellWidth / 2 + sh[0];
      const ry = TOP + b.row * ROW + ROW / 2 + sh[1];
      const rframe = `reward-${Math.min(b.value, 8)}` as const;
      const rspr = this.addBreathingEntity(rx, ry, rframe, 56, 56, 22, 2, 600 + index * 70, b.id);
      rspr.setData('rewardId', b.id);
      rspr.add(this.add.text(0, 0, String(b.value), { fontSize: '18px', color: '#51380a', fontStyle: 'bold' }).setOrigin(.5));
    }

    // Enemies — sprite based (keep aspect ratio). enemyColOffset shifts them right so
    // the pre-advance render matches where projectiles actually hit.
    for (const e of visualEnemies) {
      const ex = fieldX(e.col + enemyColOffset) + e.width * L.board.battlefieldCellWidth / 2;
      const ey = TOP + e.row * ROW + (e.height * ROW) / 2;
      const visual = ENEMY_VISUAL(e);
      const ew = e.width * L.board.battlefieldCellWidth;
      const eh = e.height * ROW;
      const espr = this.addBreathingEntity(ex, ey, visual.frame, ew * 0.82, eh * 0.82, 30, e.width === 2 ? 4 : 3, 750 + e.row * 65, e.id);
      if (visual.tint) espr.list.filter(child => child instanceof Phaser.GameObjects.Image).forEach(child => (child as Phaser.GameObjects.Image).setTint(visual.tint!));
      espr.setData('enemyId', e.id);

      // HP label
      const hpLabel = this.add.text(0, eh * 0.28, `${e.hp}`, { fontSize: '22px', color: '#fff', backgroundColor: '#7a3131' }).setPadding(10, 4).setOrigin(.5, 0);
      espr.add(hpLabel);
      espr.setData('hpLabel', hpLabel);
    }

    // Game over overlay
    if (s.gameOver) {
      this.add.text(960, 490, 'GAME OVER\n点击任意处重开', { fontSize: '72px', color: '#ffb5a8', backgroundColor: '#491d1d', align: 'center' }).setPadding(28).setOrigin(.5).setDepth(100);
    }
    this.refreshDifficultyPanel();
  }
}
