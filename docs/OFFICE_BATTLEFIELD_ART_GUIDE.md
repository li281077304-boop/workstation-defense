# Office Battlefield Art Guide — V0.33

This is a construction guide for a future **background-only** 1920×1080 office
battlefield. It does not alter the game’s grid, collision, movement, or turn
rules. The rendered template is:
[`art/review/office_battlefield_geometry_guide.png`](../art/review/office_battlefield_geometry_guide.png).

## Locked geometry

| Area | Design-space rectangle | Meaning |
| --- | --- | --- |
| Header / HUD quiet zone | `x 20–1900, y 16–132` | No high-contrast background features. |
| Moyu account | `x 34–284, y 26–102` | Must remain legible and tappable. |
| Score | centered near `x 960, y 36` | Keep wall/window lighting quiet behind it. |
| Settings / pause | `x 1724–1912, y 18–128` | Keep uncluttered. |
| Spawn Slot | `x 45–195, y 350–830` | Separate UI; do **not** paint it into the background. |
| Defender grid | `x 220–540, y 150–1030` | Exactly `2 × 5`; cells are `160 × 176`. |
| Battlefield | `x 570–1870, y 150–1030` | Exactly `10 × 5`; cells are `130 × 176`. |

Rows are logically rectangular and remain equally high. Columns remain logically
orthogonal. The art may suggest shallow perspective, but must never alter these
coordinates or make a cell’s gameplay centre ambiguous.

## Current runtime note (not changed in this pass)

The Placement API already exposes `groundY` and a `depth` field. However, its
current depth expression resolves to the same base value for every integer
ground point, so it is **not yet a true row/Y sort**. This guide uses the
intended visual rule—lower ground points render in front—but V0.33 deliberately
does not change that renderer behavior. Treat the guide as the handoff baseline
for a separate, low-risk depth-sorting implementation pass.

## Ground points

For every `1 × 1` cell:

`groundX = cell left + cell width / 2`

`groundY = cell top + 176 - 4`

Defender ground X positions are `300, 460`; Battlefield ground X positions are
`635, 765, 895, 1025, 1155, 1285, 1415, 1545, 1675, 1805`.
Ground Y positions for Lane 1–5 are `322, 498, 674, 850, 1026`.

This is the only standing reference. All world sprites use a bottom-centre pivot
at that point. A 2×2 enemy uses the occupied footprint’s bottom-centre ground
point, not its visual centre.

## 2.5D rules

- The camera is a shallow 30°–35° downward feeling, never a real 3D or 45°
  isometric projection.
- Preserve the existing Ground Point, bottom-centre pivot, `artScale`, ground
  offsets, and ground-Y depth sorting.
- Use floor seams, soft light gradients, furniture perspective, contact shadows,
  and Y sorting to sell depth—not diamond tiles or transformed collision cells.
- Large objects may visually overlap neighbouring cells; their logical centre and
  footprint may not move.
- Keep the centre of each of the 60 cells visually calm. Faint carpet seams,
  tile joins, and soft light are welcome; desks, chairs, filing cabinets, posters,
  or strong text are not.

## Scene composition

**Far field (`y≈132–300`)**: glass partitions, distant desks, monitors,
filing cabinets, a whiteboard, and city-night windows. Use low contrast so the
Header and Lane 1 remain readable.

**Mid field (`y≈300–850`)**: a clear open-office aisle/floor—the game board.
Make the left side slightly warmer and more orderly; drift towards neutral/cool
light in the centre; reserve a constrained red capital-entry hint beyond the
right edge of column 10. Do not make the entrance consume a playable column.

**Near field (`y≈850–1080`)**: sparse edge-only chair legs, papers, or cable
shadows. They cannot cover ground points, value labels, or the Spawn Slot.

## Lighting and readability

The mood is “after hours, but the office is still lit”: warm-white ceiling
lights, monitor-blue accents, city-night windows, and restrained neon reflection.
Avoid horror darkness, a blue-black wash, or a large red spill across the board.
Defenders must remain the cleanest/warmest visual read; enemies should read as
dark red/gray threats; Moyu remains bright green.

## Background handoff checklist

1. Create only `battle_background.png`; do not bake HUD, Spawn Slot, grid,
   enemies, defenders, projectiles, HP, or numbers into it.
2. Test the source under the geometry guide at 1920×1080 before producing a
   runtime derivative.
3. Keep all high-detail elements outside the board or at very low contrast.
4. Let code continue to render Grid Overlay, HUD, Spawn Slot, contact shadows,
   and all gameplay entities.
5. A future background source follows the asset chain in `AGENTS.md`: source →
   candidate → approved Production → manifest → runtime → validation → Git.
