# PRODUCTION ASSET MANIFEST

> Asset-pipeline status for 《工位保卫战》. A `MISSING_PRODUCTION_ASSET` row is deliberately not a runtime substitution instruction.

## Contract

1. Only files under `public/assets/production/**` may become new runtime art.
2. A production file needs an approved manifest row, stable name, source record, and a confirmed intended use.
3. `public/assets/plants/`, `public/assets/d-family/`, and `public/assets/characters/` are historical reference only; they are not acceptable Defender body sources.
4. Office-semantic Projectile files are attack visuals, not Defender body art.
5. A missing approved asset must remain missing; do not silently substitute a legacy plant, D Family character, or Projectile.

## Defender bodies

| Type | Value / ID | Production file | Source | Status | Notes |
| --- | ---: | --- | --- | --- | --- |
| Defender | 1 | `assets/production/defenders/defender_001_pen.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Pen body required; existing pen file is Projectile-only. |
| Defender | 2 | `assets/production/defenders/defender_002_glue.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Glue body required. |
| Defender | 4 | `assets/production/defenders/defender_004_fan.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Fan body required. |
| Defender | 8 | `assets/production/defenders/defender_008_thermos.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Thermos body required. |
| Defender | 16 | `assets/production/defenders/defender_016_energy.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Generic energy-drink body required. |
| Defender | 32 | `assets/production/defenders/defender_032_stapler.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Stapler body required. |
| Defender | 64 | `assets/production/defenders/defender_064_spray.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Spray-bottle body required. |
| Defender | 128 | `assets/production/defenders/defender_128_phone_stand.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Phone-stand / signal-office-item body required. |
| Defender | 256 | `assets/production/defenders/defender_256_laptop.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Laptop / data-office-item body required. |
| Defender | 512 | `assets/production/defenders/defender_512_monitor.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Monitor body required. |
| Defender | 1024 | `assets/production/defenders/defender_1024_printer.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Printer / paper-office-item body required. |
| Defender | 2048 | `assets/production/defenders/defender_2048_shredder.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Shredder body required. |
| Defender | 4096 | `assets/production/defenders/defender_4096_workstation_core.png` | No approved body source found | MISSING_PRODUCTION_ASSET | Workstation-core body required. |

## Background

| Type | Value / ID | Production file | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Background | battlefield-office-v1 | `assets/production/backgrounds/battlefield_office_v1.png` | No approved landscape office battlefield source found | MISSING_PRODUCTION_ASSET | Do not replace with the legacy rural `battlefield_v0.png` or the unrelated portrait `bg_office.png`. |

## Current migration state

The Production directory structure and manifest are established. Runtime migration is intentionally blocked until approved source files exist; `ART.plants`, legacy background references, and empty `DEFENDER_META` remain unchanged in this setup commit to avoid a false art migration.
