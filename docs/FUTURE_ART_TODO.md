# Future Art TODO

This document records future visual work only. It is not a current gameplay
requirement and does not authorize changes to combat, economy, layout, or
runtime asset mappings.

## 1. Defender Art V2 — Office Supplies Characterization

Turn the current office-item Defenders into readable, appealing characters
while preserving the identity of the underlying object.

Requirements:

- Anthropomorphize the office supplies without making them plants, beans, or weapon replicas.
- Give each unit a clear personality through expression, posture, accessories, or readable gestures.
- Preserve instant recognition at small in-game sizes and make higher tiers feel like a growth path.
- Use original silhouettes, materials, effects, and animation language. Only the general principle that a functional unit can also be a character may be learned from other works; do not copy any third-party character, plant, zombie, animation, or UI design.
- Validate every new asset through source → candidate → selected → production → manifest before runtime use.

Initial anchor tiers: 1, 8, 32, 128, 512, and 4096. Do not batch-generate all 13 tiers before the style is reviewed.

V0.34 adds two review-only samples: Value 4 small fan and Value 8 thermos. They remain `ART CANDIDATE / REVIEW` until explicitly selected; normal runtime and Production assets stay unchanged.

## 2. Formal Enemy Art — Capital Pressure Characters

Replace temporary experience enemy visuals in a later art pass with original, characterful workplace pressure: KPI/performance metrics, meetings, approvals, reports, overtime, cost cutting, forced competitiveness, ranking, and replacement pressure.

Enemies should be funny, recognizable, and satisfying to defeat. Their skins must remain decoupled from HP, damage, speed, and footprint unless a future gameplay specification changes that relationship. Do not use zombies, aliens, or recognizable third-party characters as the formal direction.

## 3. Formal Office Battlefield Background

Create and approve a production office-ground battlefield background only after runtime placement and lighting are validated. It should be a readable night office/open-plan passage with warm work lights, monitor glow, and a city-night view, while keeping the 2×5 Defender area, 10×5 battlefield, safe areas, and Spawn Slot owned by runtime/UI. Use environmental perspective and furniture depth, not a real 3D camera or altered logic coordinates.

Production background acceptance requires source, repeatable build/crop, manifest lineage, runtime mapping, and asset validation. Until then, the temporary/review scene remains honestly marked as such.

## Status

- [ ] Approve Defender Art V2 anchor-tier style (Value 4 fan / Value 8 thermos candidates are ready for review)
- [ ] Produce and review characterized Defender candidates
- [ ] Design formal Capital Pressure enemy candidate set
- [ ] Approve formal enemy production set
- [ ] Produce office battlefield background candidates
- [ ] Select and ingest the formal background through the asset pipeline
