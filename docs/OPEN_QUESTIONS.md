# Open Questions

This is a decision queue, not permission to implement a guessed answer. Until a
user explicitly decides an item, retain current behavior and avoid dependent
feature work.

| ID | Question | Current implementation (not a new rule) | Decision needed |
| --- | --- | --- | --- |
| Q001 | Same-cell target priority | Reward ball blocks before an enemy. | Confirm target priority from reference gameplay. |
| Q002 | Targeting past an enemy | Targets resolve left-to-right; a ball behind an enemy may be hit if damage remains. | Confirm intended geometry/order. |
| Q003 | Natural reward growth | Pool is 1/2/4/8; chance is configurable. | Decide weighting, scaling trigger, and values above 8. |
| Q004 | Enemy difficulty | A deliberately light opening is configured. | After fixes, record several runs: death score/turn, highest plant, enemy count, first 2×2 turn, and captures before tuning again. |
| Q005 | Score alternative | Default is damage score; `kill` remains configurable. | Decide whether the alternative should remain supported. |

| Q007 | RewardBall at the left boundary | Balls now move with enemies until Column 1 / zero-based `col 0`. | Decide whether an uncaptured ball holds, exits, or follows another reference-game behavior at the boundary. |

When a decision is made: add a numbered rule to `LOCKED_RULES.md`, update the
focused test, remove this row, and append the decision to `DEVLOG.md`.
