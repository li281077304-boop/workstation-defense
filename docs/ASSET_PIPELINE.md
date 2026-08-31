# Candidate → Production Asset Pipeline

This workflow prevents temporary, candidate, and historical art from silently
becoming runtime art.

## Candidate acceptance checklist

For each approved Defender, Enemy, background, Projectile, or UI asset:

1. Record the source file and obtain the user's explicit approval for this product use.
2. If it is a sheet, crop the approved subject only; preserve original pixels,
   transparency, full silhouette, and bottom-center pivot usability.
3. Copy the approved output into the matching `public/assets/production/` category
   with its stable production filename.
4. Add an `APPROVED` row to `PRODUCTION_ASSET_MANIFEST.md`, including source and notes.
5. Add/verify the corresponding `SpriteMeta` entry when the asset is a world entity.
6. Update the runtime mapping only after the production file exists.
7. Run the asset preview, tests, build, and Android packaging verification.

## Archived material

Historical `plants/`, `d-family/`, `characters/`, and rural battlefield art are
retained without deletion. They are reference material only and must not receive
new runtime references.

## Current V0.31 block

The workspace contains office-item Projectile art, but it contains neither the
approved 13 Defender body PNGs nor an approved landscape office battlefield
background. Therefore there is no safe `ART.defenders` or production-background
runtime mapping to make yet. Switching runtime now would either show missing
files or violate the rule against substituting projectiles / historical art as
Defender bodies.
