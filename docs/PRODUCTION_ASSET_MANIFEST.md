# Production Asset Manifest

The machine-readable source of truth is
[`art/manifests/production-assets.json`](../art/manifests/production-assets.json).
It records each immutable source and SHA-256, build script, generated Production
file, generated SHA-256, semantic meaning, and lifecycle state.

## Current approved assets

| Type | Values | Source | Production output | State |
| --- | --- | --- | --- | --- |
| Defender bodies | 1–4096 (13 assets) | `workstation_defenders_sheet_candidate_03_e7d7db46a2f2.png` | `public/assets/production/defenders/defender_*.png` | APPROVED_PRODUCTION |
| Capital-pressure enemies | 01–08 (8 assets) | `enemy_sheet_legacy_approved_1270cc1d5f8e.png` | `public/assets/production/enemies/enemy_*.png` | APPROVED_PRODUCTION (recovered prior approved master) |
| Office battlefield | — | `battlefield_office_candidate_01_b1d2b92a.png` | `public/assets/candidates/backgrounds/battlefield_office_v1_review.png` | PRODUCTION_CANDIDATE_REVIEW |

The Defender and enemy outputs are reproducible with `python3
scripts/build-defender-assets.py` and `python3 scripts/build-enemy-assets.py`.
The review background is reproducible with `python3
scripts/build-background-assets.py`. It is available in the V0.33 art-review
build, but cannot be described as approved Production art until the user says
so. Runtime never falls back to the archived rural background.

## Lifecycle contract

`CANDIDATE` → `SELECTED` → `APPROVED_PRODUCTION` → runtime reference.

`PRODUCTION_CANDIDATE_REVIEW` may be used only in a clearly labelled art-review
build. It has full source and derivation lineage, but is not approved art.

`ARCHIVED` is retained for historical comparison, never as a runtime input.
`MISSING_PRODUCTION_ASSET` is a blocker, not permission to use a legacy image.
