# Future Art TODO

This document records future visual work only. It is not a current gameplay
requirement and does not authorize changes to combat, economy, layout, or
runtime asset mappings.

## 1. Defender Art V2 — Office Supplies Characterization

Turn the current office-item Defenders into readable, appealing characters
while preserving the identity of the underlying object.

Requirements:

- Anthropomorphize the office supplies without making them plants, beans, or
  weapon replicas.
- Give each unit a clear personality through expression, posture, accessories,
  or small readable gestures.
- Preserve instant recognition of the base item at small in-game sizes.
- Make higher tiers feel like a visible growth path, not merely a larger or
  brighter copy.
- Keep the existing power-of-two semantic chain unless a separate gameplay
  decision explicitly changes it.
- Use original silhouettes, materials, effects, and animation language. Take
  only the general design principle that a functional unit can also be a
  character; do not copy any third-party character, plant, zombie, animation,
  or UI design.
- Validate every new asset through the existing source → candidate → selected
  → production → manifest pipeline before runtime use.

Initial design pass to plan later: 1, 8, 32, 128, 512, and 4096 as anchor
tiers, then fill the intervening tiers after the visual language is approved.
Do not batch-generate all 13 tiers before these anchors are reviewed.

## 2. Formal Enemy Art — Capital Pressure Characters

Replace temporary experience enemy visuals in a later art pass with original,
characterful representations of workplace pressure:

- KPI / performance metrics
- meetings and calendar pressure
- approvals and paperwork
- reports and status tracking
- overtime systems
- cost cutting / “efficiency” pressure
- forced competitiveness and ranking
- elimination / replacement pressure

Design goals:

- Enemies should be funny, recognizable, and emotionally satisfying to defeat.
- Each archetype needs a distinct silhouette and behavior-readable visual
  language, without implying mechanics that do not exist.
- Visual skin must remain decoupled from HP, damage, speed, and footprint unless
  a future gameplay specification explicitly introduces that relationship.
- Preserve current logical enemy types and 2×2 handling during the art-only
  replacement.
- Do not use zombies, aliens, or recognizable third-party characters as the
  formal direction.

The current temporary enemy art remains explicitly `TEMP / EXPERIENCE ONLY`
until an approved production set is ingested.

## 3. Formal Office Battlefield Background

Create and approve a production office-ground battlefield background after the
runtime placement and lighting have been validated.

Direction:

- Night office / open-plan workplace with warm work lights, monitor glow, and
  a readable city-night window view.
- The playable area should read as an office floor or passage, not a desktop
  and not a flat spreadsheet.
- Keep the 2×5 Defender area and 10×5 battlefield visually connected while
  leaving the logical grid, lanes, safe areas, and Spawn Slot to runtime/UI.
- Use environmental perspective, floor seams, contact lighting, and furniture
  depth to support the pseudo-2.5D placement system; do not introduce a real
  3D camera or alter logical coordinates.
- Keep the play area visually calm enough that Defender, Enemy, Projectile, and
  Moyu assets remain the focus.
- Extend background art into wide-screen and notch regions where safe, without
  placing interactive content outside the gameplay safe area.

Production background acceptance requires a source file, repeatable build or
crop step, manifest lineage, runtime mapping, and asset validation. Until then,
the existing temporary/review scene and missing-production status must remain
honest.

## Status

- [ ] Approve Defender Art V2 anchor-tier style
- [ ] Produce and review characterized Defender candidates
- [ ] Design formal Capital Pressure enemy candidate set
- [ ] Approve formal enemy production set
- [ ] Produce office battlefield background candidates
- [ ] Select and ingest the formal background through the asset pipeline
