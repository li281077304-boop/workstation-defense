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

## Current V0.33 state

- 13 Defender bodies are approved Production assets.
- 8 recovered capital-pressure enemies are approved Production assets.
- The office background has complete source and reproducible review output, but
  its state is `PRODUCTION_CANDIDATE_REVIEW`: only the clearly labelled V0.33
  art-review runtime may use it until the user approves it.

The archived rural background and old plant/d-family art remain historical
reference only; they may never become a silent runtime fallback.
