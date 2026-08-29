#!/usr/bin/env python3
"""Extract every atlas frame from spritesheet.png into standalone PNG files
under public/assets/<plants|enemies|rewards|projectiles|effects>/.

This replaces runtime atlas cropping with real, complete image files (placeholders
are fine) so any AI or human can swap a single PNG without touching coordinates.
"""
from PIL import Image
import json
import os

ASSET = '/Users/macos/Documents/Codex/2026-08-27/referenced-chatgpt-conversation-this-is-an/public/assets/'
SRC = ASSET + 'spritesheet.png'
ATLAS = ASSET + 'spritesheet-atlas.json'
PAD = 8  # transparent padding around each sprite

img = Image.open(SRC).convert('RGBA')
atlas = json.load(open(ATLAS))
frames = atlas['frames']

# frame-name -> relative path (folders below public/assets/)
MAP = {
    # plants
    'plant-1': 'plants/plant_001.png', 'plant-2': 'plants/plant_002.png',
    'plant-4': 'plants/plant_004.png', 'plant-8': 'plants/plant_008.png',
    'plant-16': 'plants/plant_016.png', 'plant-32': 'plants/plant_032.png',
    'plant-64': 'plants/plant_064.png', 'plant-128': 'plants/plant_128.png',
    'plant-256': 'plants/plant_256.png', 'plant-512': 'plants/plant_512.png',
    'plant-1024': 'plants/plant_1024.png',
    # rewards
    'reward-1': 'rewards/reward_1.png', 'reward-2': 'rewards/reward_2.png',
    'reward-4': 'rewards/reward_4.png', 'reward-8': 'rewards/reward_8.png',
    # projectiles
    'bullet-green': 'projectiles/projectile_green.png',
    'bullet-blue': 'projectiles/projectile_blue.png',
    'bullet-orange': 'projectiles/projectile_orange.png',
    'bullet-purple': 'projectiles/projectile_purple.png',
    # enemies
    'zombie-1x1-0': 'enemies/enemy_basic_01.png',
    'zombie-1x1-1': 'enemies/enemy_basic_02.png',
    'zombie-1x1-2': 'enemies/enemy_basic_03.png',
    'zombie-1x1-3': 'enemies/enemy_basic_04.png',
    'zombie-1x1-4': 'enemies/enemy_basic_05.png',
    'zombie-1x1-5': 'enemies/enemy_basic_06.png',
    'zombie-elite-1x1': 'enemies/enemy_elite_01.png',
    'boss-2x2': 'enemies/enemy_large_01.png',
    # effects
    'effect-merge': 'effects/effect_merge.png',
    'effect-hit-green': 'effects/effect_hit_green.png',
    'effect-hit-blue': 'effects/effect_hit_blue.png',
    'effect-hit-orange': 'effects/effect_hit_orange.png',
    'effect-hit-purple': 'effects/effect_hit_purple.png',
    'effect-smoke-1': 'effects/effect_smoke_01.png',
    'effect-smoke-2': 'effects/effect_smoke_02.png',
}

written = []
for name, rel in MAP.items():
    f = frames[name]['frame']
    x, y, w, h = f['x'], f['y'], f['w'], f['h']
    crop = img.crop((x, y, x + w, y + h))
    canvas = Image.new('RGBA', (w + PAD * 2, h + PAD * 2), (0, 0, 0, 0))
    canvas.paste(crop, (PAD, PAD), crop)
    out = ASSET + rel
    os.makedirs(os.path.dirname(out), exist_ok=True)
    canvas.save(out)
    written.append(rel)

print(f'Extracted {len(written)} standalone images:')
for w in sorted(written):
    print(' ', w)
