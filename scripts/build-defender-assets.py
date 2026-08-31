#!/usr/bin/env python3
"""Rebuild production Defender PNGs from the approved immutable source sheet."""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'art/manifests/defender_crops_v1.json'
OUTPUT = ROOT / 'public/assets/production/defenders'
ALPHA_FLOOR = 64


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel('A')
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError('crop has no visible pixels')
    return bbox


def remove_sheet_haze(image: Image.Image) -> Image.Image:
    """Discard the low-alpha sheet backdrop while retaining anti-aliased subject art."""
    alpha = image.getchannel('A').point(lambda value: 0 if value < ALPHA_FLOOR else value)
    image.putalpha(alpha)
    return image


def main() -> None:
    spec = json.loads(MANIFEST.read_text())
    source = ROOT / spec['source']
    source_image = Image.open(source).convert('RGBA')
    padding = int(spec['padding'])
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for asset in spec['assets']:
        x1, y1, x2, y2 = asset['crop']
        rough = remove_sheet_haze(source_image.crop((x1, y1, x2, y2)))
        left, top, right, bottom = alpha_bbox(rough)
        tight = rough.crop((left, top, right, bottom))
        result = Image.new('RGBA', (tight.width + padding * 2, tight.height + padding * 2))
        result.alpha_composite(tight, (padding, padding))
        filename = f"defender_{asset['value']:03d}_{asset['id']}.png"
        result.save(OUTPUT / filename)
        print(f'{filename}: {result.width}x{result.height}')


if __name__ == '__main__':
    main()
