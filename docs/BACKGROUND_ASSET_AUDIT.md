# BACKGROUND ASSET AUDIT

> Audit date: 2026-08-31. This audit does not generate or modify art.

## Current runtime background

| Field | Finding |
| --- | --- |
| Runtime file | `public/assets/backgrounds/battlefield_v0.png` |
| Runtime references | `src/game/GameScene.ts` preload / render; `src/style.css` page background |
| Exists | Yes |
| Technical format | `1672×941`, RGB, no alpha |
| Visual content | Daytime rural / farm scene with greenery, a house, windmill, paths and flowers |
| Product fit | Does **not** match the current office / capital-invasion world |

## Other repository candidates

| Candidate | Finding | Usable as office battlefield background? |
| --- | --- | :---: |
| `public/assets/spritesheet.png` + atlas JSON | Historical transparent plant / enemy / effect atlas | No |
| `public/assets/tiles/*` | Individual legacy cell tiles only | No |
| `public/assets/d-family/characters/*` | Historical character references | No |
| `public/assets/characters/wife_turnaround_v1.png` | Historical character reference, no alpha | No |
| `public/assets/backgrounds/battlefield_v0.png` | Only complete scene background tracked in the repository | No, rural theme |

## Conclusion

**CORRECT OFFICE BACKGROUND PRESENT IN REPO: NO.**

The requested office background may exist only on the local machine outside this checkout, in a chat attachment, or as an uncommitted asset not visible in Git. This pass does not fabricate a replacement and does not remove the current background.
