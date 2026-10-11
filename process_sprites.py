"""
Sprite-Aufbereitung fuer "Marko am Schauinsland" (v2).

Nutzung:
    python process_sprites.py sprites_raw/marko_albert.jpeg sprites_raw/hindernisse.jpeg

sheet_a = Marko (Zeile 1) + Albert (Zeile 2), 4 Spalten x 2 Zeilen
sheet_b = Hindernisse, 4 Spalten x 2 Zeilen

Aenderungen gegenueber v1:
- Farben werden pro Sprite reduziert (Trikotfarben bleiben erhalten)
- Frames einer Animation teilen sich denselben Zuschnitt (kein Wackeln)
- Farben leicht aufgefrischt
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

# ---- Einstellungen -------------------------------------------------------
SIZE_A = 64      # Kantenlaenge Marko/Albert (48 = kleiner, 64 = sauberer)
SIZE_B = 48      # Kantenlaenge Hindernisse
COLORS = 24      # Farben pro Sprite (mehr = weicher, weniger = haerter)
SATURATION = 1.15
COLS, ROWS = 4, 2
MARGIN = 6
OUTLINE = (28, 24, 36)

NAMES_A = [
    "marko_ride_1", "marko_ride_2", "marko_jump", "marko_cry",
    "albert_ride_1", "albert_ride_2", "albert_look", "albert_chair",
]
# Indizes, die sich denselben Zuschnitt teilen (gleiche Position im Bild)
GROUPS_A = [[0, 1, 2, 3], [4, 5, 6], [7]]

NAMES_B = [
    "cow", "hiker", "ebike_opa", "strava_guy",
    "rider_dark_spare", "kevin", "sign_umleitung", "pothole",
]
GROUPS_B = [[i] for i in range(8)]
# --------------------------------------------------------------------------


def remove_magenta(im):
    a = np.array(im.convert("RGBA")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (g < np.minimum(r, b) - 50) & (r > 120) & (b > 120)
    a[..., 3] = np.where(mag, 0, 255)
    a[mag, 0], a[mag, 1], a[mag, 2] = OUTLINE
    return Image.fromarray(a.astype("uint8"), "RGBA")


def cut_cells(sheet_path, names, groups):
    sheet = Image.open(sheet_path).convert("RGB")
    w, h = sheet.size
    cw, ch = w / COLS, h / ROWS
    cells, bboxes = {}, {}
    for i, name in enumerate(names):
        r, c = divmod(i, COLS)
        box = (
            int(c * cw) + MARGIN, int(r * ch) + MARGIN,
            int((c + 1) * cw) - MARGIN, int((r + 1) * ch) - MARGIN,
        )
        cell = remove_magenta(sheet.crop(box))
        cells[i] = cell
        bboxes[i] = cell.getchannel("A").getbbox()

    sprites = {}
    for group in groups:
        valid = [i for i in group if bboxes[i] is not None]
        if not valid:
            continue
        x0 = min(bboxes[i][0] for i in valid)
        y0 = min(bboxes[i][1] for i in valid)
        x1 = max(bboxes[i][2] for i in valid)
        y1 = max(bboxes[i][3] for i in valid)
        for i in valid:
            sprites[names[i]] = cells[i].crop((x0, y0, x1, y1))
    return sprites


def shrink(sprites, size):
    biggest = max(max(s.size) for s in sprites.values())
    scale = size / biggest
    out = {}
    for name, im in sprites.items():
        nw = max(1, round(im.width * scale))
        nh = max(1, round(im.height * scale))
        small = im.resize((nw, nh), Image.LANCZOS)
        a = small.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
        small.putalpha(a)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.paste(small, ((size - nw) // 2, size - nh), small)
        out[name] = canvas
    return out


def posterize(sprites):
    out = {}
    for name, im in sprites.items():
        rgb = ImageEnhance.Color(im.convert("RGB")).enhance(SATURATION)
        q = rgb.quantize(colors=COLORS, method=Image.MEDIANCUT, dither=Image.NONE)
        rgba = q.convert("RGBA")
        rgba.putalpha(im.getchannel("A"))
        out[name] = rgba
    return out


def strip(frames):
    w, h = frames[0].size
    s = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * w, 0))
    return s


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    path_a, path_b = sys.argv[1], sys.argv[2]
    out_dir = Path("assets")
    out_dir.mkdir(exist_ok=True)

    print("Blatt A (Marko/Albert) ...")
    a = shrink(cut_cells(path_a, NAMES_A, GROUPS_A), SIZE_A)
    print("Blatt B (Hindernisse) ...")
    b = shrink(cut_cells(path_b, NAMES_B, GROUPS_B), SIZE_B)

    allsp = posterize({**a, **b})
    for name, im in allsp.items():
        im.save(out_dir / f"{name}.png")

    strip([allsp["marko_ride_1"], allsp["marko_ride_2"]]).save(out_dir / "marko_ride.png")
    strip([allsp["albert_ride_1"], allsp["albert_ride_2"]]).save(out_dir / "albert_ride.png")

    tiles = list(allsp.values())
    prev = Image.new("RGBA", (sum(t.width for t in tiles), max(t.height for t in tiles)),
                     (90, 140, 200, 255))
    x = 0
    for t in tiles:
        prev.paste(t, (x, 0), t)
        x += t.width
    prev = prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST)
    prev.save(out_dir / "_preview.png")
    print(f"Fertig: {len(allsp)} Sprites in {out_dir}/ (Vorschau: _preview.png)")


if __name__ == "__main__":
    main()
