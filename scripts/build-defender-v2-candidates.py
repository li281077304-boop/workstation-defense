#!/usr/bin/env python3
"""Build review-only Defender V2 sprites from preserved transparent sources."""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PADDING = 14
ASSETS = {
    "fan": (ROOT / "art/source/defenders/fan_v2_source_63dcaaa4.png", ROOT / "public/assets/candidates/defenders/defender_004_fan_v2_review.png"),
    "thermos": (ROOT / "art/source/defenders/thermos_v2_source_5dda2475.png", ROOT / "public/assets/candidates/defenders/defender_008_thermos_v2_review.png"),
}


def trim(source: Path, output: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError(f"source has no visible pixels: {source}")
    left, top, right, bottom = bbox
    crop = image.crop((max(0, left - PADDING), max(0, top - PADDING), min(image.width, right + PADDING), min(image.height, bottom + PADDING)))
    output.parent.mkdir(parents=True, exist_ok=True)
    crop.save(output)
    return crop


def review_sheet(images: dict[str, Image.Image]) -> None:
    cell_w, cell_h = 620, 700
    sheet = Image.new("RGBA", (cell_w * 2, cell_h), (35, 48, 61, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(images.items()):
        image.thumbnail((cell_w - 70, cell_h - 120), Image.Resampling.LANCZOS)
        x = index * cell_w + (cell_w - image.width) // 2
        y = 42 + (cell_h - 130 - image.height)
        sheet.alpha_composite(image, (x, y))
        draw.text((index * cell_w + cell_w // 2, cell_h - 58), f"{name.upper()} V2 · CANDIDATE / REVIEW", anchor="mm", fill=(238, 245, 255, 255))
    sheet.save(ROOT / "art/review/defender_v2_candidates_contact_sheet.png")


def main() -> None:
    images = {name: trim(source, output) for name, (source, output) in ASSETS.items()}
    review_sheet(images)


if __name__ == "__main__":
    main()
