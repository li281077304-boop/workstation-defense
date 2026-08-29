#!/usr/bin/env python3
"""Per-frame background strip + precise bbox detection.

Phase 1: for each frame's rough region, flood-fill from that region's border
         and remove only white connected to the region edge (keeps white
         highlights *inside* the sprite).
Phase 2: compute the tight non-transparent bbox of each frame and rewrite
         the atlas JSON with exact coordinates.
"""
from PIL import Image
from collections import deque
import json

ASSET = '/Users/macos/Documents/Codex/2026-08-27/referenced-chatgpt-conversation-this-is-an/public/assets/'
SRC = ASSET + 'spritesheet.png'
ATLAS = ASSET + 'spritesheet-atlas.json'

THRESHOLD = 24

img = Image.open(SRC).convert('RGBA')
w, h = img.size
px = img.load()

atlas = json.load(open(ATLAS))
frames = atlas['frames']

def near_white(r, g, b):
    return r >= 255 - THRESHOLD and g >= 255 - THRESHOLD and b >= 255 - THRESHOLD

# --- Phase 1: per-frame flood fill to strip background white ---
for name, data in frames.items():
    f = data['frame']
    x, y, fw, fh = f['x'], f['y'], f['w'], f['h']
    visited = [[False] * fw for _ in range(fh)]
    q = deque()
    for xx in range(x, x + fw):
        for yy in (y, y + fh - 1):
            if 0 <= xx < w and 0 <= yy < h:
                r, g, b, a = px[xx, yy]
                if a > 10 and near_white(r, g, b) and not visited[yy - y][xx - x]:
                    visited[yy - y][xx - x] = True
                    q.append((xx, yy))
    for yy in range(y, y + fh):
        for xx in (x, x + fw - 1):
            if 0 <= xx < w and 0 <= yy < h:
                r, g, b, a = px[xx, yy]
                if a > 10 and near_white(r, g, b) and not visited[yy - y][xx - x]:
                    visited[yy - y][xx - x] = True
                    q.append((xx, yy))
    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if x <= nx < x + fw and y <= ny < y + fh:
                r, g, b, a = px[nx, ny]
                if a > 10 and near_white(r, g, b) and not visited[ny - y][nx - x]:
                    visited[ny - y][nx - x] = True
                    q.append((nx, ny))
    for yy in range(y, y + fh):
        for xx in range(x, x + fw):
            if visited[yy - y][xx - x]:
                px[xx, yy] = (255, 255, 255, 0)

img.save(SRC)

# --- Phase 2: tight bbox detection ---
updates = {}
for name, data in frames.items():
    f = data['frame']
    x, y, fw, fh = f['x'], f['y'], f['w'], f['h']
    min_x, min_y, max_x, max_y = x + fw, y + fh, -1, -1
    for yy in range(y, y + fh):
        for xx in range(x, x + fw):
            if px[xx, yy][3] > 10:
                if xx < min_x: min_x = xx
                if xx > max_x: max_x = xx
                if yy < min_y: min_y = yy
                if yy > max_y: max_y = yy
    if max_x >= min_x:
        updates[name] = {'x': min_x, 'y': min_y, 'w': max_x - min_x + 1, 'h': max_y - min_y + 1}

# Rewrite atlas with tight frames
for name, f in updates.items():
    atlas['frames'][name]['frame'] = f
json.dump(atlas, open(ATLAS, 'w'))

print(f'Stripped per-frame bg and rewrote {len(updates)} frames with tight bboxes.')
for name in sorted(updates):
    f = updates[name]
    print(f'{name:20s} {f["x"]:4d},{f["y"]:4d} {f["w"]:4d}x{f["h"]:4d}')
