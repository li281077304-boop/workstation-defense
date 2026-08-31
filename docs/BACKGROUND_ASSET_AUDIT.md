# BACKGROUND ASSET AUDIT

> Audit date: 2026-08-31. This audit does not generate or modify art.

## Current runtime background

| Field | Finding |
| --- | --- |
| Runtime review file | `public/assets/candidates/backgrounds/battlefield_office_v1_review.png` |
| Runtime references | `ART.backgrounds.officeReview` in `src/ui/assets.ts`, loaded by `GameScene` |
| Exists | Yes |
| Technical format | `1920×1080`, RGB |
| Visual content | Bright late-night open office; open central floor, glass rooms, windows, desks and restrained edge furniture |
| Product fit | Fits the office / capital-invasion direction, pending visual approval |

## Other repository candidates

| Candidate | Finding | Usable as office battlefield background? |
| --- | --- | :---: |
| `public/assets/spritesheet.png` + atlas JSON | Historical transparent plant / enemy / effect atlas | No |
| `public/assets/tiles/*` | Individual legacy cell tiles only | No |
| `public/assets/d-family/characters/*` | Historical character references | No |
| `public/assets/characters/wife_turnaround_v1.png` | Historical character reference, no alpha | No |
| `art/source/backgrounds/battlefield_office_candidate_01_b1d2b92a.png` | Immutable original V0.33 office candidate source | Candidate / review |
| `public/assets/candidates/backgrounds/battlefield_office_v1_review.png` | Reproducible 1920×1080 review runtime output | Candidate / review |
| `public/assets/backgrounds/battlefield_v0.png` | Archived daytime rural scene | No, rural theme |

## Conclusion

**CORRECT OFFICE BACKGROUND PRESENT IN REPO: CANDIDATE ONLY.**

The previous local/repository recovery did not find a prior approved office
background. V0.33 therefore adds an original candidate with full source,
derivation and SHA lineage. It cannot be called approved Production art until
the user reviews it. The rural image remains archived and has no runtime use.
