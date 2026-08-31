# Production Asset Manifest

The machine-readable source of truth is
[`art/manifests/production-assets.json`](../art/manifests/production-assets.json).
It records each immutable source and SHA-256, build script, generated Production
file, generated SHA-256, semantic meaning, and lifecycle state.

## Current approved assets

| Type | Values | Source | Production output | State |
| --- | --- | --- | --- | --- |
| Defender bodies | 1–4096 (13 assets) | `workstation_defenders_sheet_candidate_03_e7d7db46a2f2.png` | `public/assets/production/defenders/defender_*.png` | APPROVED_PRODUCTION |
| Office battlefield | — | Not yet ingested | `public/assets/production/backgrounds/battlefield_office_v1.png` | MISSING_PRODUCTION_ASSET |

The Defender outputs are reproducible with `python3 scripts/build-defender-assets.py`.
The office background has not been found in Downloads. Until it is ingested and
marked `APPROVED_PRODUCTION`, runtime migration must remain pending: the game
must not silently substitute the legacy rural background.

## Lifecycle contract

`CANDIDATE` → `SELECTED` → `APPROVED_PRODUCTION` → runtime reference.

`ARCHIVED` is retained for historical comparison, never as a runtime input.
`MISSING_PRODUCTION_ASSET` is a blocker, not permission to use a legacy image.
