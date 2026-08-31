# DEFENDER ASSET AUDIT

> Audit date: 2026-08-31. This is a factual runtime-asset audit, not a request to generate, replace, or delete art.

## Runtime source of truth today

- `src/ui/assets.ts` defines `ART.plants[value]` as `assets/plants/plant_{NNN}.png`.
- `src/game/GameScene.ts` loads the same paths as `plant-{value}` frames.
- Every required `1` through `4096` file exists and is RGBA.
- The `plants` directory name is historical. More importantly, the image contents are historical plant / D Family images, not current office-item Defender art.
- `assets/projectiles/moyu-v2/` names match the office-item projectile direction, but these are horizontal projectile assets and **must not** be used as Defender body sprites.

## Defender-by-value audit

| Value | Current runtime file | Exists | Visual meaning found | Likely correct office-item asset? | Alternative candidate | Status |
| ---: | --- | :---: | --- | :---: | --- | --- |
| 1 | `assets/plants/plant_001.png` | Yes | Green pea-shooter with leaves / green cannon | No | `assets/projectiles/moyu-v2/projectile_001_pen.png` (projectile only) | WRONG ASSET |
| 2 | `assets/plants/plant_002.png` | Yes | Jack-o'-lantern / pumpkin plant | No | `projectile_002_glue.png` (projectile only) | WRONG ASSET |
| 4 | `assets/plants/plant_004.png` | Yes | Sunflower | No | `projectile_004_fan.png` (projectile only) | WRONG ASSET |
| 8 | `assets/plants/plant_008.png` | Yes | Flowering cactus with baked `8` | No | `projectile_008_thermos.png` (projectile only) | WRONG ASSET |
| 16 | `assets/plants/plant_016.png` | Yes | Blue ice-crystal creature / plant | No | `projectile_016_energy.png` (projectile only) | WRONG ASSET |
| 32 | `assets/plants/plant_032.png` | Yes | Fire pepper with baked `32` | No | `projectile_032_staple.png` (projectile only) | WRONG ASSET |
| 64 | `assets/plants/plant_064.png` | Yes | Purple mushroom with baked `64` | No | `projectile_064_spray.png` (projectile only) | WRONG ASSET |
| 128 | `assets/plants/plant_128.png` | Yes | Child with green plant cannon / leaves | No | `projectile_128_signal.png` (projectile only) | WRONG ASSET |
| 256 | `assets/plants/plant_256.png` | Yes | Adult with green plant cannon / leaves | No | `projectile_256_data.png` (projectile only) | WRONG ASSET |
| 512 | `assets/plants/plant_512.png` | Yes | Woman, ice-blue plant cannon / plant partner / ice platform | No | `projectile_512_screen.png` (projectile only) | WRONG ASSET |
| 1024 | `assets/plants/plant_1024.png` | Yes | Carnivorous flower / vines; baked `512` is wrong for this value | No | `projectile_1024_paper.png` (projectile only) | WRONG ASSET |
| 2048 | `assets/plants/plant_2048.png` | Yes | Flower queen; baked `1024` is wrong for this value | No | `projectile_2048_shred.png` (projectile only) | WRONG ASSET |
| 4096 | `assets/plants/plant_4096.png` | Yes | Byte-identical copy of `plant_2048.png`; baked `1024` | No | `projectile_4096_core.png` (projectile only) | WRONG ASSET |

`plant_8192.png` is also byte-identical to the `2048` / `4096` image. It is a fallback asset and outside this 13-value audit.

## Consequence for the active product

The current code paths are technically valid, but **no current runtime Defender body image is a confirmed office-item asset**. A future art integration should introduce a new, explicit Defender asset map and preserve this legacy directory untouched until the new assets are ready. This cleanup pass makes no replacement.

## SpriteMeta audit

`src/game/SpriteMeta.ts` currently declares `DEFENDER_META` as an empty record. `GameScene.ts` calls `placeDefender(...)` without a value-specific meta entry, so every Defender uses the same default: `1×1`, pivot `(0.5, 1.0)`, `artScale: 1.0`, no ground offset, no depth bias.

| Scope | Current state | Follow-up needed |
| --- | --- | --- |
| `1–4096` artScale | No value-specific `artScale`; all default `1.0` | Audit again after office-item body PNGs exist. |
| Transparent padding | Existing assets range from small tight crops to `512×512` character canvases | Current Placement V1 cannot normalize their visible bounds by metadata. |
| Pivot | All Defenders use bottom-center default | Individual pivots are unverified because the runtime bodies are wrong assets. |
| Clearly abnormal art | 1024 has baked `512`; 2048 and 4096 are duplicates with baked `1024` | Do not tune around these assets; replace only in a dedicated art pass. |
