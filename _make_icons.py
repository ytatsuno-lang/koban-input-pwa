#!/usr/bin/env python3
"""
Generate KobanInput PWA icons using Python stdlib only.
Creates a 512x512 PNG with a colored background and a stylized "工" glyph,
then derives 192x192 and 180x180 via the same generator.
"""
import struct, zlib, os, sys

OUT_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT_DIR, exist_ok=True)

# Color palette
BG = (0, 122, 255)         # iOS system blue
FG = (255, 255, 255)
ACCENT = (255, 220, 90)    # subtle yellow corner

def make_image(size: int) -> bytes:
    """Return raw RGB byte rows for a size x size image with a '工' glyph."""
    w = h = size
    rows = []

    # Glyph layout (in fractions of size)
    # '工' = two horizontal bars + central vertical bar
    margin = size * 0.18
    bar_h = size * 0.10
    bar_top_y = margin
    bar_bot_y = size - margin - bar_h
    vert_w = size * 0.10
    vert_x = (size - vert_w) / 2
    vert_top = bar_top_y + bar_h
    vert_bot = bar_bot_y

    # Top-right tiny accent square (visual interest)
    acc_size = size * 0.10
    acc_x = size - margin - acc_size
    acc_y = margin - acc_size * 0.6 if margin - acc_size * 0.6 > 0 else margin * 0.3

    for y in range(h):
        row = bytearray()
        for x in range(w):
            # Default: background
            r, g, b = BG

            # Glyph: top bar
            if bar_top_y <= y < bar_top_y + bar_h and margin <= x < size - margin:
                r, g, b = FG
            # Glyph: bottom bar
            elif bar_bot_y <= y < bar_bot_y + bar_h and margin <= x < size - margin:
                r, g, b = FG
            # Glyph: vertical bar
            elif vert_top <= y < vert_bot and vert_x <= x < vert_x + vert_w:
                r, g, b = FG
            # Accent square (small, top-right)
            elif acc_y <= y < acc_y + acc_size and acc_x <= x < acc_x + acc_size:
                r, g, b = ACCENT

            row.append(r); row.append(g); row.append(b)
        rows.append(bytes(row))

    return rows

def write_png(path: str, size: int) -> None:
    rows = make_image(size)
    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

    # IHDR: width(4) height(4) bitdepth(1) colortype(1) compression(1) filter(1) interlace(1)
    # color type 2 = truecolor RGB
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)

    # IDAT: each scanline prefixed by filter byte (0 = None)
    raw = b''.join(b'\x00' + row for row in rows)
    idat = zlib.compress(raw, 9)

    with open(path, 'wb') as f:
        f.write(sig)
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', idat))
        f.write(chunk(b'IEND', b''))

    print(f"wrote {path} ({size}x{size}, {os.path.getsize(path)} bytes)")

if __name__ == "__main__":
    write_png(os.path.join(OUT_DIR, "icon-512.png"), 512)
    write_png(os.path.join(OUT_DIR, "icon-192.png"), 192)
    write_png(os.path.join(OUT_DIR, "apple-touch-icon.png"), 180)
