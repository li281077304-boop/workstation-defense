# Locked Game Rules

Only confirmed, implementation-binding rules belong here. A change requires an
explicit user decision and matching test updates.

## R001–R006: Board and turns

- R001: The game is endless; it has no levels.
- R002: The defense board is exactly 2 columns by 5 rows; plants may occupy only it.
- R003: The battlefield is exactly 10 columns by 5 rows for enemies, reward balls, projectiles, and effects.
- R004: A legal move, swap, merge, birth-slot placement, or legal birth-slot merge consumes one turn. Illegal/cancelled actions consume none.
- R005: A turn resolves: player operation; post-operation board; all plants fire; projectiles resolve; surviving enemies move left one cell; world stops.
- R006: Without a player operation, the world does not advance.

## R007–R012: Plants and projectiles

- R007: An enemy entering the defense area immediately ends the game; there are no player lives or leak damage.
- R008: Plant values are powers of two. Art currently covers 1–8192; game logic has no hard value cap and uses the 8192 appearance above that.
- R009: A plant fires `min(value, 4)` projectiles, each dealing `value / projectileCount` damage.
- R010: Projectiles pierce enemies using their remaining damage.
- R011: A projectile hitting a reward ball captures the ball and is fully consumed; no remaining damage continues.
- R012: Every plant fires each turn, not only a plant involved in the operation.

## R013–R016: Reward balls and birth slot

- R013: The birth slot starts empty. Only a projectile capture may write to it; captures update it as a max register across the turn.
- R014: Equal/lower captures do not merge, lower, or clear the birth slot.
- R015: The player may leave the birth slot unused across turns.
- R016: In `REWARD_ECONOMY_CURVE_V2`, natural RewardBalls unlock by Turn:
  1 (T1–20), 1/2 (T21–40), 1/2/4 (T41–60), then 1/2/4/8 (T61+, hard cap 8).
  Dynamic progress-based weights apply only inside the unlocked set. In legacy
  modes, the ceiling remains `max(1, highestPlantValue / 4)`.

## R017–R019: Enemies and score

- R017: Enemies are 1×1 or 2×2. A 2×2 enemy has shared HP and can take fire from both occupied lanes.
- R018: New enemies enter from the far right when spawning is enabled.
- R019: The default score mode is actual HP damage: one point per damage dealt.
- R020: Enemy and RewardBall footprints may never overlap with any Enemy or RewardBall footprint. A spawn or advance whose full footprint is occupied is skipped/held rather than forced.
- R021: The renderer replays combat events in order: projectile impact, hit feedback, HP update, then death/removal. It must not show final HP or remove an enemy early, and the projectile impact must use the same grid-to-world coordinate as the enemy.
- R022: Reward generation does not grant a birth-slot plant. A reward ball remains in the battlefield until a projectile hits and captures it; only then may the slot update by Max Register.
- R023: A RewardBall is a 1×1 battlefield unit: it spawns at the last column, moves with the enemy phase, blocks and consumes the entire projectile that captures it, but has no HP and never causes Game Over.

## Explicitly out of scope

No levels, shop, gacha, upgrade tree, equipment, skills, ads, accounts,
networking, ranking, quests, achievements, energy, lives, speed controls,
auto-battle, AI strategy, MCTS, reinforcement learning, or large simulations.
