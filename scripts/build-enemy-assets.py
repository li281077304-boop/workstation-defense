#!/usr/bin/env python3
"""Build the recovered approved enemy PNGs from the immutable legacy master sheet.

The master was authored as a 4 x 2 composition rather than a gameplay atlas.
The rough regions below intentionally exclude speech bubbles and neighbouring
figures; alpha trimming then gives every runtime file a usable bottom pivot.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source/enemies/enemy_sheet_legacy_approved_1270cc1d5f8e.png'
OUTPUT = ROOT / 'public/assets/production/enemies'
REVIEW = ROOT / 'art/review/enemy_candidate_contact_sheet.png'
PADDING = 14
ALPHA_FLOOR = 18

# name, semantic crop in the 1536 x 1024 approved recovery sheet.
ASSETS = [
    ('enemy_01_contract.png', (0, 56, 270, 405)),
    ('enemy_02_kpi.png', (305, 12, 620, 425)),
    ('enemy_03_meeting.png', (735, 125, 1060, 435)),
    ('enemy_04_approval.png', (1150, 22, 1536, 405)),
    ('enemy_05_report.png', (0, 450, 290, 1005)),
    ('enemy_06_ranking.png', (315, 445, 635, 1005)),
    ('enemy_07_executive.png', (660, 440, 1010, 1005)),
    ('enemy_08_system_core.png', (1050, 430, 1536, 1015)),
]


def trim_alpha(image: Image.Image) -> Image.Image:
    alpha = image.getchannel('A').point(lambda value: 0 if value < ALPHA_FLOOR else value)
    # A rough quadrant can include a clipped sliver of its neighbour. Remove
    # only small disconnected components that touch that rough-crop boundary;
    # complete character pieces and their interior floating papers remain.
    pixels = alpha.load()
    seen: set[tuple[int, int]] = set()
    for start_y in range(alpha.height):
        for start_x in range(alpha.width):
            if pixels[start_x, start_y] == 0 or (start_x, start_y) in seen:
                continue
            stack = [(start_x, start_y)]
            component: list[tuple[int, int]] = []
            touches_edge = False
            seen.add((start_x, start_y))
            while stack:
                x, y = stack.pop()
                component.append((x, y))
                touches_edge |= x in (0, alpha.width - 1) or y in (0, alpha.height - 1)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < alpha.width and 0 <= ny < alpha.height and pixels[nx, ny] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if touches_edge and len(component) < 3000:
                for x, y in component:
                    pixels[x, y] = 0
    image.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError('enemy crop has no visible pixels')
    tight = image.crop(bbox)
    result = Image.new('RGBA', (tight.width + PADDING * 2, tight.height + PADDING * 2))
    result.alpha_composite(tight, (PADDING, PADDING))
    return result


def build_contact_sheet(outputs: list[tuple[str, Image.Image]]) -> None:
    cell_w, cell_h = 360, 340
    sheet = Image.new('RGBA', (cell_w * 4, cell_h * 2), (53, 63, 74, 255))
    for index, (name, image) in enumerate(outputs):
        thumbnail = image.copy()
        thumbnail.thumbnail((cell_w - 40, cell_h - 60), Image.Resampling.LANCZOS)
        x = (index % 4) * cell_w + (cell_w - thumbnail.width) // 2
        y = (index // 4) * cell_h + 24 + (cell_h - 60 - thumbnail.height) // 2
        sheet.alpha_composite(thumbnail, (x, y))
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(REVIEW)


def main() -> None:
    source = Image.open(SOURCE).convert('RGBA')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    outputs: list[tuple[str, Image.Image]] = []
    for name, crop in ASSETS:
        result = trim_alpha(source.crop(crop))
        result.save(OUTPUT / name)
        outputs.append((name, result))
        print(f'{name}: {result.width}x{result.height}')
    build_contact_sheet(outputs)
    print(f'contact sheet: {REVIEW.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
