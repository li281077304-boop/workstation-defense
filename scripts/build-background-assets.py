#!/usr/bin/env python3
"""Create the review-runtime office background without changing its source."""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source/backgrounds/battlefield_office_candidate_01_b1d2b92a.png'
OUTPUT = ROOT / 'public/assets/candidates/backgrounds/battlefield_office_v1_review.png'
REVIEW = ROOT / 'art/review/background_candidates_contact_sheet.png'
TARGET = (1920, 1080)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    factor = max(size[0] / image.width, size[1] / image.height)
    scaled = image.resize((round(image.width * factor), round(image.height * factor)), Image.Resampling.LANCZOS)
    left = (scaled.width - size[0]) // 2
    top = (scaled.height - size[1]) // 2
    return scaled.crop((left, top, left + size[0], top + size[1]))


def main() -> None:
    source = Image.open(SOURCE).convert('RGB')
    output = cover(source, TARGET)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output.save(OUTPUT, optimize=True)

    # A one-candidate review image is still generated, so reviewers always have
    # a stable place to compare later alternatives.
    contact = output.resize((960, 540), Image.Resampling.LANCZOS).convert('RGB')
    draw = ImageDraw.Draw(contact)
    draw.rounded_rectangle((18, 18, 404, 58), radius=10, fill=(19, 29, 42))
    draw.text((32, 30), 'BACKGROUND-OFFICE-CANDIDATE-01', fill=(222, 238, 250))
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    contact.save(REVIEW, optimize=True)
    print(f'{OUTPUT.relative_to(ROOT)}: {output.width}x{output.height}')


if __name__ == '__main__':
    main()
