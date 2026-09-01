# Locked Game Rules

Only confirmed, implementation-binding rules belong here. A change requires an
explicit user decision and matching test updates.

## R001–R006: Board and turns

- R001: The game is endless; it has no levels.
- R002: The defense board is exactly 2 columns by 5 rows; Defenders may occupy only it.
- R003: The battlefield is exactly 10 columns by 5 rows for enemies, reward balls, projectiles, and effects.
- R004: A legal move, swap, merge, birth-slot placement, legal birth-slot merge, or successful Defender dismissal consumes one turn. Illegal/cancelled actions consume none.
- R005: A turn resolves: player operation; post-operation board; all Defenders fire; projectiles resolve; surviving enemies move left one cell; world stops.
- R006: Without a player operation, the world does not advance.

## R007–R012: Defenders and projectiles

- R007: An enemy entering the defense area immediately ends the game; there are no player lives or leak damage.
- R008: Defender values are powers of two. Art currently covers 1–8192; game logic has no hard value cap and uses the 8192 appearance above that.
- R009: Each attacking Defender fires exactly one Projectile per turn. Projectile damage equals the Defender value; a value of 512 creates one Projectile with 512 damage, not four split projectiles.
- R010: Projectiles pierce enemies using their remaining damage.
- R011: A Projectile hitting a MoyuPickup captures it and is fully consumed; no remaining damage continues.
- R012: Every Defender fires each turn, not only a Defender involved in the operation.

## R013–R016: Legacy RewardBall and birth slot

- R013: The birth slot starts empty. In Moyu Economy V2 it is filled only by active extraction from Moyu Bank, not by enemy death or pickup capture.
- R014: The birth slot may hold only one extracted Defender. While non-empty, another extraction is forbidden; there is no overwrite, max-register update, automatic merge, or automatic replacement.
- R015: Extraction does not consume a turn. Deploying the extracted Defender, or merging it with an equal board value, follows the existing legal-operation turn rule.
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
- R022 (legacy RewardBall): Reward generation does not grant a birth-slot plant. A reward ball remains in the battlefield until a projectile hits and captures it; only then may the slot update by Max Register. Moyu Economy V2 supersedes this path with Moyu Bank and active extraction.
- R023 (legacy RewardBall): A RewardBall is a 1×1 battlefield unit: it spawns at the last column, moves with the enemy phase, blocks and consumes the entire projectile that captures it, but has no HP and never causes Game Over. Moyu Economy V2 uses `MoyuPickup` dropped by defeated carriers instead.

## R024–R034: Moyu Economy V2

- R024: A legal Enemy may carry `moyuValue` of 0 or a power of two. The carrier rate and value-growth table are configuration, not enemy-type guarantees.
- R025: When a carried-value Enemy dies, it creates exactly one MoyuPickup at its death position if `moyuValue > 0`, then clears the carrier value to prevent duplicate drops. Death does not directly increase Moyu Bank.
- R026: The pickup appears immediately during projectile resolution. The Projectile that killed the carrier cannot collect its own newly created pickup; later projectiles in the same Turn may capture it.
- R027: MoyuPickup is a 1×1 battlefield entity. It does not attack, has no HP, does not cause Game Over, and cannot overlap Enemy or another MoyuPickup footprint.
- R028: A MoyuPickup moves with the enemy movement phase, using the existing battlefield movement rules. If it reaches the recovery boundary, it is automatically recovered into Moyu Bank and must not be lost.
- R029: Any Projectile can collect any MoyuPickup regardless of Projectile damage, remaining damage, or pickup value. No damage threshold or pickup HP exists.
- R030: On collection, the pickup is marked collected exactly once; its value is added to Moyu Bank immediately, the Projectile remaining damage is set to zero, and the Projectile is destroyed. The later fly-to-bank animation is visual only and cannot add value again.
- R031: Interrupted pickup animations, cleanup, turn transitions, and duplicate collision callbacks must preserve the same one-time bank result. A dropped Moyu value may be delayed but may never be permanently lost.
- R032: A Projectile ending because it collected Moyu records its pre-collision remaining damage as `MoyuInterceptWaste`; that remainder must not also be counted as `OverkillWaste`.
- R033: The combat economy records Projectile count and damage potential, Enemy damage, OverkillWaste, MoyuInterceptWaste, MoyuCollectedValue, pickup count, and AutoRecoveredMoyuValue independently.
- R034: Moyu Economy V2 generation stages are configurable and default to: T1–15 values 1/2/4, T16–35 values 2/4/8, T36–60 values 4/8/16, T61–100 values 8/16/32, and T101+ values 16/32/64, with default low/mid/high weights 20%/55%/25% and `moyuCarrierChance = 0.80`.

## R035–R038: Moyu capacity and product persistence

- R035: Moyu Bank capacity is `clamp(highestDefenderValue / 4, 4, 32)`, where `highestDefenderValue` is the historical maximum reached in the run and never decreases after a merge or move. A new run therefore starts at capacity 4.
- R036: A collected or auto-recovered MoyuPickup credits only the remaining Bank capacity. The remainder is immediately lost and recorded as overflow; it is never queued, auto-extracted, or deferred.
- R037: Extraction remains a no-Turn action and removes the highest affordable power of two from the current Moyu Bank. Because Bank capacity is capped at 32, current extraction cannot exceed 32. It records the extracted value but is forbidden while the Spawn Slot is occupied.
- R038: A non-ended run is saved at stable logic points and may resume locally. Game Over and an explicit restart are never resumable. The local Top 10 stores summaries only and has no network component.

## R039–R042: Defender dismissal and Moyu debt

- R039: A board Defender may be dragged into the separate Dismiss Slot. It is removed only when the operation is valid, costs exactly `Defender value × 2` Moyu, and consumes one turn. The Spawn Slot cannot be dismissed.
- R040: Moyu Bank is the only account and may enter debt down to `-4096`. A dismissal that would produce a lower balance is rejected atomically: no Defender is removed, no Moyu changes, and no turn is consumed.
- R041: Pickup income always applies to the same Moyu Bank, so it repays debt before the balance becomes positive. Extraction remains unavailable unless the Bank is positive and the Spawn Slot is empty.
- R042: The account ledger remains auditable: `Total Moyu Earned = Total Moyu Extracted + Total Moyu Dismissal Cost + Current Moyu Bank`.

## Explicitly out of scope

No levels, shop, gacha, upgrade tree, equipment, skills, ads, accounts,
networking, ranking, quests, achievements, energy, lives, speed controls,
auto-battle, AI strategy, MCTS, reinforcement learning, or large simulations.
