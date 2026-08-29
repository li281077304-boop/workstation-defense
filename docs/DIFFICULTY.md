# Difficulty Tuning

All live difficulty defaults are in `src/game/config.ts` as `DifficultyConfig`.
Tap the **gear** in the game to open Difficulty Settings. Changes apply to later
turns; restart a run before judging a new curve.

| Setting | What increasing it does |
| --- | --- |
| `enemyHpBase` | Makes every new ordinary enemy tougher immediately. |
| `enemyHpGrowthPerTurn` | Makes enemy HP rise faster as turns pass. |
| `enemySpawnChance` | Makes a spawn attempt more likely each turn. |
| `enemiesPerTurn` | Allows more enemy spawn attempts in a single turn. |
| `enemyCap` | Lets the battlefield hold more enemies at once. |
| `largeEnemySpawnChance` | Makes 2×2 enemies more likely after they unlock. |
| `largeEnemyMinScore` | Delays 2×2 enemies until this score is reached. |
| `rewardSpawnChance` | Makes a reward ball more likely when an enemy batch spawns. |
| `maxNaturalSpawnValue` | A hard ceiling; it cannot override the player-growth ceiling below. |

## Reward-ball ceiling and weights

`maxRewardValue = max(1, highestPlantValue / 4)` controls the largest value a
new reward ball may have. It is a ceiling, not a likelihood. The current
`rewardWeights` control likelihood among allowed values: high values can be
allowed but still uncommon. For example, a highest plant of 32 allows rewards
up to 8; it does not make 8 common.

Keep opening plants weak. Adjust enemy pressure and reward supply first; do not
start a run with 4 or 8 merely to compensate for an overtuned enemy curve.

## Observation metrics (no automatic director)

The game records one metric row after every successful turn. These metrics are
observation only: they never change enemy HP, spawn chance, or any other
difficulty setting.

- **Firepower utilization** = actual enemy HP damage / theoretical attack damage.
  Reward-ball blocks, empty lanes, and unused piercing damage count as waste.
- **Reward capture rate** = value captured / value generated, evaluated over the
  rolling window of reward balls generated in the last ten turns. A missed 8
  therefore matters more than a missed 1.
- **Battlefield pressure** = the sum of `enemy HP / turns before defense` for
  every enemy currently on the field. `Pressure / PlantPower` estimates the
  fraction of theoretical firepower a player must convert into real damage.

Read the panel as a diagnostic, not a hidden balancing system. Reward capture
below 20% is poor, 20–30% is low, about 30% is the standard-player baseline,
30–40% is good play, and 50%+ is exceptional. Enable **控制台记录 Turn 指标** only
when a per-turn log is useful.

## Playable baseline V1

`PLAYABLE_BASELINE_V1` is a frozen copy of the approved configuration from the
2,510-score playtest (61% recent firepower utilization, 57% reward capture,
49% pressure ratio). The local Debug Panel includes **恢复 PLAYABLE_BASELINE_V1**
to undo temporary tuning and restore every difficulty field in one action.

Each completed local run is retained in the panel with final score, average
firepower utilization, average reward capture rate, average pressure ratio,
highest plant, pressure ratio at death, and the final ten-turn enemy-count
trace. These records are session-local observations, not persistent player data.

## Spawn Safety Guard

Before a new enemy is created, the game calculates the power of the lane(s) it
occupies and its remaining turns before reaching the defense. Its required
utilization is `HP / (relevant lane plant power × remaining turns)`. Normal
enemies must require no more than 55%; 2×2 enemies no more than 60%.

The whole pending batch is also checked against the hard pressure cap (75% of
current PlantPower). If necessary, the guard lowers only the new enemy's HP,
falls back from a 2×2 to a normal enemy, or rejects that spawn. Existing enemy
HP is never rewritten. The Debug Panel lists each attempted spawn's footprint,
HP, remaining turns, relevant lane power, required utilization, and predicted
pressure ratio. These checks prevent random dead-on-arrival waves; they are not
an automatic difficulty director.

---

## BALANCED_V1 (current playable baseline, 2026-08-29)

`BALANCED_V1` is the approved normal-start reference: **206,102 score, Turn
574, highest plant 512, PlantPower 844**, ending only after sustained pressure
reached 102%. Its locked default controls are Enemy Volume .4, Enemy HP 1.0,
Reward Rate 1.0, Large Enemy Rate 1.0, Baseline Reward Capture 45%, Reward
Growth 1.0, High Value Bias .70, and Enemy Count Cap 10. The underlying system
remains `REWARD_ECONOMY_CURVE_V2`; the two older modes remain Debug-only
historical comparisons.

Difficulty is derived BACKWARD from the reward economy, because RewardBall is the
player's ONLY source of new board power (merging never increases total power:
1+1→2 still totals 2). Enemy strength NEVER reads the player's actual power —
it follows a STANDARD player growth curve.

### Economy chain (four separate metrics)
- `rewardGeneratedValue` — value spawned as balls.
- `rewardReachableValue` — value of balls that entered a lane with at least one
  plant at the start of an attack phase.
- `rewardCapturedValue` — value hit by projectiles (ball flies to Spawn Slot).
- `rewardRealizedValue` — value ACTUALLY placed onto the Defense Board from the
  Spawn Slot. These three are deliberately tracked separately: generating ≠
  capturing ≠ realizing.

### Formulas (see src/game/difficulty.ts)
- Reward spawn chance per turn: **0.80** + bad-luck protection (force a ball
  after 1 dry turn).
- Natural values unlock first: T1–20 **{1}**; T21–40 **{1,2}**;
  T41–60 **{1,2,4}**; T61+ **{1,2,4,8}** (hard cap 8). 1 never disappears.
- `alpha(T) = alphaMax × (1 − exp(−T / (tau / progression)))`; default
  `alphaMax=.70`, `tau=100`, `progression=1.0`.
- `weight(value,T) = value^(alpha(T) − 1)`, normalized. The opening is about
  53/27/13/7%; the late distribution tends to 33/27/22/18%.
- ExpectedPlantPower(T) = **2 + BaselineRewardCapture × cumulative expected
  generated reward**. The provisional test default is **45%**, separately
  adjustable in settings without reading a real player's power or capture rate.
- DifficultyFactor(T) = **0.45 + 0.20(1 − exp(−T/150))** → 45% slowly → 65%.
- EnemyHpIncomeBudget(T) = ExpectedPlantPower(T) × DifficultyFactor(T), accrued
  into hpBudgetBank; Spawn Director spends it across turns (natural ebb/flow,
  capped by maxSpendPerTurn).
- Normal enemy HP ≈ **ExpectedPlantPower × 0.9**, ±15% roll at spawn.
- 2×2 enemy HP ≈ normal × **1.1** (space/lane pressure is the real cost), but
  consumes **1.8×** the spawn budget of a normal enemy.

### Growth-stage observation targets

The panel records the first turn a run reaches 8, 16, 32, and 64, then writes a
full death record (score, turn, highest plant, plant power, reward capture,
firepower utilization, and pressure ratio). Treat highest plant **32** as entry
to the mid game:

- below 32 — Early Game
- 32–128 — Mid Game
- 256+ — Late Game
- 512+ — Deep Endless

With the 30% standard-player capture baseline, a normal careful run should not
most often end before reaching 32. This is a playtest target, not a runtime
rubber-band rule.

### Test output valves (Debug Panel, REWARD_ECONOMY_V2 mode)
The V2 formulas stay closed-form. The local-only Debug Panel adds output valves
so playtests can distinguish a bad economy curve from excessive on-screen volume:

- `Enemy Volume` (0.4–1.5, default **0.4**): scales the V2 budget income before
  it enters the bank; it does not alter individual enemy HP.
- `Enemy HP` (0.5–1.5, default 1.0): multiplies only the final normal/2×2 HP
  after the unchanged V2 target formula and variance roll.
- `Reward Rate` (0.5–1.5, default 1.0): multiplies final ball-spawn chance
  (clamped at 100%) and the matching expected generated value.
- `Large Enemy Rate` (0–1.5, default 1.0): multiplies final 2×2 spawn chance;
  zero disables 2×2 units.
- `Enemy Count Cap` (6/8/10/12/15, default 10): caps entities on the field;
  a 2×2 is one entity and RewardBalls do not count.
- `Baseline Reward Capture` (20%–70%, default 45%): changes only the standard
  player used by ExpectedPlantPower, enemy budget, and target HP.
- `Reward Progression` (0.5–2.0, default 1.0): changes how quickly the weight
  curve matures; higher is sooner.
- `High Value Bias` (0.30–1.00, default .70): changes the late-game alpha cap.

The budget bank is capped at two turns of the current effective HP income
(`theoretical income × Enemy Volume`). Excess is discarded rather than repaid
as a later burst; lowering Volume immediately clamps old banked pressure.
Presets change only
Enemy Volume: `EASY_VOLUME=0.6`, `NORMAL_VOLUME=0.8`, `HARD_VOLUME=1.0`.
The panel exposes theoretical/allowed/actual spend and bank/cap each turn, and
can save a local test snippet without affecting production gameplay.

### Mode switch
Press D → dropdown: `BALANCED_V1` (normal default) / `ENDLESS_CURVE_V1` /
`PLAYABLE_BASELINE_V1` (the confirmed-fun 2,510-score version). Old versions are
never overwritten.
