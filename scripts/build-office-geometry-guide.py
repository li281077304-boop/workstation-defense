#!/usr/bin/env python3
"""Render the non-runtime 1920x1080 office-background construction guide."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / 'art/review/office_battlefield_geometry_guide.png'
W, H = 1920, 1080
TOP, ROW_H = 150, 176
DEF_LEFT, DEF_W, DEF_COLS = 220, 160, 2
FIELD_LEFT, FIELD_W, FIELD_COLS = 570, 130, 10
SPAWN = (45, 350, 195, 830)

try:
    font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 23)
    small = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 17)
    title = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 34)
except OSError:
    font = small = title = ImageFont.load_default()

def box(draw, rect, fill, outline, width=2):
    draw.rounded_rectangle(rect, radius=12, fill=fill, outline=outline, width=width)

def text(draw, xy, value, font, fill=(240, 245, 250, 255), anchor='la'):
    draw.text(xy, value, font=font, fill=fill, anchor=anchor)

def main():
    image = Image.new('RGBA', (W, H), (16, 26, 38, 255))
    draw = ImageDraw.Draw(image, 'RGBA')
    # atmospheric, non-gameplay backdrop: only to explain art hierarchy
    for y in range(H):
        shade = int(42 * (1 - y / H))
        draw.line((0, y, W, y), fill=(16 + shade // 4, 26 + shade // 3, 38 + shade, 255))
    draw.rectangle((0, 0, W - 1, H - 1), outline=(220, 235, 255, 200), width=3)
    text(draw, (52, 42), '《工位保卫战》办公室地面战场 — 1920 × 1080 施工模板', title)
    text(draw, (52, 88), '仅供背景美术定位；逻辑仍是正交 2×5 防守区 + 10×5 战场。', font, (186, 210, 229, 255))

    # Header and UI quiet zones
    box(draw, (20, 16, 1900, 132), (22, 34, 48, 180), (119, 171, 205, 210), 2)
    text(draw, (960, 122), 'HEADER / 背景低对比区', small, (148, 191, 222, 255), 'ma')
    for rect, label in [((28, 20, 294, 108), '摸鱼账户\n34–284 × 26–102'), ((730, 18, 1190, 108), '分数\n中心 960 × 36'), ((1712, 18, 1912, 128), '设置 / 暂停\nx≈1834')]:
        box(draw, rect, (8, 13, 20, 205), (255, 213, 118, 235), 3)
        text(draw, ((rect[0]+rect[2])//2, (rect[1]+rect[3])//2), label, small, (255, 228, 158, 255), 'mm')

    # Depth bands
    draw.rectangle((0, 132, W, 300), fill=(71, 111, 138, 28))
    draw.rectangle((0, 300, W, 850), fill=(71, 111, 138, 13))
    draw.rectangle((0, 850, W, H), fill=(115, 73, 47, 20))
    text(draw, (1890, 152), '远景：窗、玻璃隔断、远处工位\n只低对比，不进可玩区', small, (177, 220, 241, 255), 'ra')
    text(draw, (1890, 840), '近景：仅边缘小杂物 / 椅脚\n不得遮挡单位或地面落点', small, (237, 196, 162, 255), 'ra')

    # Decor allowed / quiet regions around actual playable surfaces
    for rect in [(0, 145, 208, 330), (0, 845, 208, 1045), (1882, 145, 1920, 1045), (210, 1034, 1878, 1080)]:
        draw.rectangle(rect, fill=(86, 174, 120, 46), outline=(94, 217, 136, 190), width=2)
    text(draw, (30, 168), '允许背景装饰\n低对比', small, (145, 239, 174, 255))
    text(draw, (1710, 1047), '近景边缘装饰允许', small, (145, 239, 174, 255), 'ra')

    # Spawn
    box(draw, SPAWN, (77, 114, 59, 130), (183, 224, 105, 255), 4)
    text(draw, (120, 590), 'Spawn Slot\n45–195 × 350–830\n独立 UI / 可拖拽\n不画进背景', small, (221, 255, 169, 255), 'mm')

    # Board geometry
    board_bottom = TOP + ROW_H * 5
    draw.rectangle((DEF_LEFT, TOP, DEF_LEFT + DEF_W * DEF_COLS, board_bottom), fill=(55, 131, 175, 44), outline=(86, 207, 255, 255), width=4)
    draw.rectangle((FIELD_LEFT, TOP, FIELD_LEFT + FIELD_W * FIELD_COLS, board_bottom), fill=(219, 152, 66, 28), outline=(255, 204, 78, 255), width=4)
    for row in range(5):
        y = TOP + row * ROW_H
        draw.rectangle((FIELD_LEFT, y, FIELD_LEFT + FIELD_W * FIELD_COLS, y + ROW_H), fill=((170, 205, 220, 12 if row % 2 else 4)))
        draw.line((DEF_LEFT, y, FIELD_LEFT + FIELD_W * FIELD_COLS, y), fill=(192, 228, 245, 130), width=3)
        text(draw, (FIELD_LEFT + 14, y + 12), f'Lane {row + 1}', small, (214, 234, 242, 220))
        for col in range(DEF_COLS):
            x = DEF_LEFT + col * DEF_W
            draw.rectangle((x, y, x + DEF_W, y + ROW_H), outline=(80, 202, 255, 150), width=2)
            gx, gy = x + DEF_W / 2, y + ROW_H - 4
            draw.ellipse((gx-5, gy-5, gx+5, gy+5), fill=(86, 255, 249, 255))
        for col in range(FIELD_COLS):
            x = FIELD_LEFT + col * FIELD_W
            draw.rectangle((x, y, x + FIELD_W, y + ROW_H), outline=(255, 218, 96, 74), width=1)
            gx, gy = x + FIELD_W / 2, y + ROW_H - 4
            draw.ellipse((gx-4, gy-4, gx+4, gy+4), fill=(255, 225, 112, 255))
    draw.line((DEF_LEFT, board_bottom, FIELD_LEFT + FIELD_W*FIELD_COLS, board_bottom), fill=(192, 228, 245, 130), width=3)
    text(draw, (DEF_LEFT + DEF_W, TOP - 16), 'DEFENDER 2 × 5 — 320 × 880 px', font, (100, 224, 255, 255), 'ms')
    text(draw, (FIELD_LEFT + FIELD_W*5, TOP - 16), 'BATTLEFIELD 10 × 5 — 1300 × 880 px', font, (255, 218, 106, 255), 'ms')
    text(draw, (FIELD_LEFT + FIELD_W*10 - 8, 310), '资本入口仅可在第 10 列之外的画面边缘暗示', small, (255, 179, 142, 255), 'ra')

    # Notice panel
    box(draw, (690, 920, 1240, 1048), (13, 20, 30, 225), (232, 243, 252, 190), 2)
    text(draw, (965, 945), '纹理 / 装饰禁区：全部 12×5 逻辑格', font, (255, 239, 181, 255), 'ma')
    text(draw, (965, 985), '地面可有低对比地毯、地砖接缝、光带；不得摆桌椅、柜子、强文字或高反差海报。', small, (210, 225, 236, 255), 'ma')
    text(draw, (965, 1015), '单位用 Bottom-Center Pivot 对齐圆点；Y 越大，Depth 越靠前。', small, (210, 225, 236, 255), 'ma')
    image.save(OUT)
    print(OUT)

if __name__ == '__main__':
    main()
