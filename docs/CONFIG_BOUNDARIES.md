# Configuration Boundaries

These are temporary defaults, not confirmed gameplay rules. Their code source of
truth is `src/game/config.ts`. Do not change them without an explicit task.

| Area | Current default | Status / decision boundary |
| --- | --- | --- |
| Opening layout | Two value-1 plants (lanes 2 and 4), empty birth slot, and one far 1×1 HP-4 enemy batch with a value-1 reward ball | Chosen for this first playable tutorial pass. |
| Enemy spawning | enabled; chance 0.45; cap 4; base HP 4; growth 0.35 | Tune only after user playtesting. |
| Large enemies | chance ramps from score 100 to 800, then reaches 8%; HP is normal HP × 1.15 | Footprint and HP are independently controlled. |
| Reward spawning | enabled; chance 0.4 when an enemy batch spawns; ceiling follows highest plant ÷ 4 | Weights are configurable in `DifficultyConfig`; high values stay uncommon. |
| Score alternative | default `damage`; `kill` option retained | User must decide whether `kill` remains supported. |
| Same-cell targeting | reward ball blocks before enemy | Needs reference-game observation. |
| Playtest target | A normal first run should usually reach roughly 1000–2000 score; score under 400 should not be a high-pressure wall. | Experience target, not a deterministic test threshold. |
| Spawn safety | Normal ≤55% required utilization; large ≤60%; hard batch pressure cap 75% | Guard clamps new HP, falls back from large to normal, or rejects the spawn. It never edits existing enemies. |

See `DIFFICULTY.md` for the live-tuning panel and plain-language parameter guide.

Configuration does not grant permission to add new systems or change locked rules.
