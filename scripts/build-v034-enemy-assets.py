#!/usr/bin/env python3
"""Derive V0.34 review-approved enemy skins from the preserved 2x4 source sheet."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source/enemies/enemy_sheet_v2_source_13142f5bd002.png'
OUTPUT = ROOT / 'public/assets/production/enemies'
PADDING = 14
NAMES = [
    'enemy_01_kpi_specialist.png', 'enemy_02_meeting_enthusiast.png',
    'enemy_03_approval_supervisor.png', 'enemy_04_overtime_care.png',
    'enemy_05_progress_pusher.png', 'enemy_06_cost_cut_manager.png',
    'enemy_07_ranking_manager.png', 'enemy_08_capital_system_boss.png',
]

def trim(image: Image.Image) -> Image.Image:
    alpha = image.getchannel('A')
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError('enemy quadrant contains no alpha pixels')
    tight = image.crop(bbox)
    out = Image.new('RGBA', (tight.width + 2 * PADDING, tight.height + 2 * PADDING))
    out.alpha_composite(tight, (PADDING, PADDING))
    return out

def main() -> None:
    src = Image.open(SOURCE).convert('RGBA')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(NAMES):
        col, row = i % 4, i // 4
        x0, y0 = col * src.width // 4, row * src.height // 2
        x1, y1 = (col + 1) * src.width // 4, (row + 1) * src.height // 2
        result = trim(src.crop((x0, y0, x1, y1)))
        result.save(OUTPUT / name)
        print(f'{name}: {result.width}x{result.height}')

if __name__ == '__main__':
    main()
