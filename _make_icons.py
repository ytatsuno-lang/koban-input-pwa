#!/usr/bin/env python3
"""
Generate KobanInput PWA icons (2x2 layout: 工番 / 入力).
Uses Pillow + Hiragino Sans (macOS system font).
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_PATH = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
BG = (79, 191, 166, 255)   # 少し濃いめのティール
FG = (255, 255, 255, 255)  # white

# Layout (fractions of canvas size)
PADDING = 0.06            # outer padding
CELL_GAP = 0.03           # gap between the 4 characters
CORNER_RADIUS = 0.22      # 角丸半径 (size に対する比率、iOS squircle 相当)

CHARS = [["工", "番"], ["入", "力"]]

def fit_font_size(draw, ch, target_size, font_path):
    """Find largest font size where the rendered glyph fits in target_size pixels (both axes)."""
    lo, hi = 8, int(target_size * 2)
    best = lo
    while lo <= hi:
        mid = (lo + hi) // 2
        font = ImageFont.truetype(font_path, mid)
        bbox = draw.textbbox((0, 0), ch, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        if w <= target_size and h <= target_size:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best

def make_icon(size: int) -> Image.Image:
    # 一旦 RGBA 透明キャンバスに角丸長方形で背景を描く
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * CORNER_RADIUS)
    draw.rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=BG)

    pad = size * PADDING
    gap = size * CELL_GAP
    inner = size - 2 * pad
    cell = (inner - gap) / 2  # each character cell is a square

    # 各字を可能な限りセルを埋めるまで拡大
    glyph_target = cell * 0.98

    for row in range(2):
        for col in range(2):
            ch = CHARS[row][col]
            # 文字ごとに独立にフィッティング（単純な字は大きく、複雑な字はそれなりに）
            fs = fit_font_size(draw, ch, glyph_target, FONT_PATH)
            font = ImageFont.truetype(FONT_PATH, fs)
            bbox = draw.textbbox((0, 0), ch, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            cell_x = pad + col * (cell + gap)
            cell_y = pad + row * (cell + gap)
            tx = cell_x + (cell - text_w) / 2 - bbox[0]
            ty = cell_y + (cell - text_h) / 2 - bbox[1]
            draw.text((tx, ty), ch, font=font, fill=FG)

    return img

def main():
    sizes = [
        ("icon-512.png", 512),
        ("icon-192.png", 192),
        ("apple-touch-icon.png", 180),
    ]
    for name, sz in sizes:
        path = os.path.join(OUT_DIR, name)
        img = make_icon(sz)
        img.save(path, "PNG", optimize=True)
        print(f"wrote {path} ({sz}x{sz}, {os.path.getsize(path)} bytes)")

if __name__ == "__main__":
    main()
