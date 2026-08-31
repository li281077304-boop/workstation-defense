#!/usr/bin/env python3
"""Build all review-only characterized Defender sprites from preserved masters."""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PADDING = 14
OUT = ROOT / "public/assets/candidates/defenders"
SOURCES = {
    "fan": ROOT / "art/source/defenders/fan_v2_source_63dcaaa4.png",
    "thermos": ROOT / "art/source/defenders/thermos_v2_source_5dda2475.png",
}
QUADS = {
    "pen": (ROOT / "art/source/defenders/defender_sheet_A_v1.png", 0, 0),
    "glue": (ROOT / "art/source/defenders/defender_sheet_A_v1.png", 1, 0),
    "energy": (ROOT / "art/source/defenders/defender_sheet_A_v1.png", 0, 1),
    "stapler": (ROOT / "art/source/defenders/defender_sheet_A_v1.png", 1, 1),
    "spray": (ROOT / "art/source/defenders/defender_sheet_B_v1.png", 0, 0),
    "phone_stand": (ROOT / "art/source/defenders/defender_sheet_B_v1.png", 1, 0),
    "laptop": (ROOT / "art/source/defenders/defender_sheet_B_v1.png", 0, 1),
    "monitor": (ROOT / "art/source/defenders/defender_sheet_B_v1.png", 1, 1),
    "printer": (ROOT / "art/source/defenders/defender_sheet_C_v1.png", 0, 0),
    "shredder": (ROOT / "art/source/defenders/defender_sheet_C_v1.png", 1, 0),
    "workstation_core": (ROOT / "art/source/defenders/defender_sheet_C_v1.png", 0, 1),
}
OUTPUT_NAMES = {
    "pen": "defender_001_pen_v2_review.png", "glue": "defender_002_glue_v2_review.png",
    "fan": "defender_004_fan_v2_review.png", "thermos": "defender_008_thermos_v2_review.png",
    "energy": "defender_016_energy_v2_review.png", "stapler": "defender_032_stapler_v2_review.png",
    "spray": "defender_064_spray_v2_review.png", "phone_stand": "defender_128_phone_stand_v2_review.png",
    "laptop": "defender_256_laptop_v2_review.png", "monitor": "defender_512_monitor_v2_review.png",
    "printer": "defender_1024_printer_v2_review.png", "shredder": "defender_2048_shredder_v2_review.png",
    "workstation_core": "defender_4096_workstation_core_v2_review.png",
}


def remove_checkerboard(image: Image.Image) -> Image.Image:
    """Remove only border-connected neutral checkerboard pixels; preserve enclosed white highlights."""
    image = image.convert("RGBA")
    px = image.load(); w, h = image.size
    seen = set(); stack = []
    for x in range(w): stack.extend(((x, 0), (x, h - 1)))
    for y in range(h): stack.extend(((0, y), (w - 1, y)))
    def bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and min(r, g, b) >= 210 and max(r, g, b) - min(r, g, b) <= 10
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h) or not bg(x, y): continue
        seen.add((x, y)); px[x, y] = (0, 0, 0, 0)
        stack.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return image


def trim(source: Path, output: Path, box=None) -> Image.Image:
    image = remove_checkerboard(Image.open(source))
    if box is not None: image = image.crop(box)
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
    cell_w, cell_h = 390, 390
    sheet = Image.new("RGBA", (cell_w * 5, cell_h * 3), (35, 48, 61, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(images.items()):
        image.thumbnail((cell_w - 35, cell_h - 65), Image.Resampling.LANCZOS)
        col, row = index % 5, index // 5
        x = col * cell_w + (cell_w - image.width) // 2
        y = row * cell_h + 18 + (cell_h - 65 - image.height)
        sheet.alpha_composite(image, (x, y))
        draw.text((col * cell_w + cell_w // 2, row * cell_h + cell_h - 27), f"{name.upper()} · REVIEW", anchor="mm", fill=(238, 245, 255, 255))
    sheet.save(ROOT / "art/review/defender_v2_candidates_contact_sheet.png")


def main() -> None:
    images = {}
    for name, source in SOURCES.items():
        images[name] = trim(source, OUT / OUTPUT_NAMES[name])
    for name, (source, col, row) in QUADS.items():
        base = Image.open(source)
        box = (col * (base.width // 2), row * (base.height // 2), (col + 1) * (base.width // 2), (row + 1) * (base.height // 2))
        images[name] = trim(source, OUT / OUTPUT_NAMES[name], box)
    review_sheet(images)


if __name__ == "__main__":
    main()
