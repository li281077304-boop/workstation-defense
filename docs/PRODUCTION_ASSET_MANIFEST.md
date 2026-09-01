# Production Asset Manifest

The machine-readable source of truth is
[`art/manifests/production-assets.json`](../art/manifests/production-assets.json).
It records each immutable source and SHA-256, build script, generated Production
file, generated SHA-256, semantic meaning, and lifecycle state.

## Current approved assets

| Type | Values | Source | Production output | State |
| --- | --- | --- | --- | --- |
| Defender bodies | 1–4096 (13 assets) | `public/assets/candidates/defenders/*_v2_review.png` plus Laptop V4 | `public/assets/production/defenders/defender_*.png` | APPROVED_PRODUCTION |
| Capital-pressure enemies | 01–08 (8 visual skins) | `art/source/enemies/enemy_sheet_v2_source_13142f5bd002.png` | `public/assets/production/enemies/enemy_*.png` | APPROVED_PRODUCTION |
| Office battlefield | — | `art/source/backgrounds/office_battlefield_v2_source_542b07a613e5.png` | `public/assets/production/backgrounds/battlefield_office_v1.png` | APPROVED_PRODUCTION |

The eight new enemy skins are reproducible with `python3
scripts/build-v034-enemy-assets.py`. Runtime now uses the approved office
background directly; the archived rural background remains unused.

## Lifecycle contract

`CANDIDATE` → `SELECTED` → `APPROVED_PRODUCTION` → runtime reference.

`PRODUCTION_CANDIDATE_REVIEW` may be used only in a clearly labelled art-review
build. It has full source and derivation lineage, but is not approved art.

`ARCHIVED` is retained for historical comparison, never as a runtime input.
`MISSING_PRODUCTION_ASSET` is a blocker, not permission to use a legacy image.
