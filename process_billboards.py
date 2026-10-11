"""
Billboard-Sprites fuer die First-Person-Version (v2, mit Presets).

Nutzung (process_sprites.py muss im selben Ordner liegen):
    python process_billboards.py BLATT.jpeg [preset]

Presets:
  chars  (Standard) 3x2: albert_back, ebike_back, hiker_back,
                         cow_front, sign_front, kevin_back
  world             3x2: tree, tree_burning, meteor, tower, banana, crack
  anim              4x3: je 2 Frames fuer albert, kevin, ebike, hiker, cow
"""
import sys
from pathlib import Path

from PIL import Image

import process_sprites as ps

SIZE = 64

PRESETS = {
    "chars": {
        "grid": (3, 2),
        "names": ["albert_back", "ebike_back", "hiker_back",
                  "cow_front", "sign_front", "kevin_back"],
        "groups": [[i] for i in range(6)],
    },
    "world": {
        "grid": (3, 2),
        "names": ["tree", "tree_burning", "meteor",
                  "tower", "banana", "crack"],
        "groups": [[i] for i in range(6)],
    },
    "anim": {
        "grid": (4, 3),
        "names": ["albert_back_1", "albert_back_2", "kevin_back_1", "kevin_back_2",
                  "ebike_back_1", "ebike_back_2", "hiker_back_1", "hiker_back_2",
                  "cow_front_1", "cow_front_2", "sign_front", "unused"],
        "groups": [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10], [11]],
    },
}


def main():
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        sys.exit(1)
    preset_name = sys.argv[2] if len(sys.argv) == 3 else "chars"
    if preset_name not in PRESETS:
        print(f"Unbekanntes Preset '{preset_name}'. Erlaubt: {', '.join(PRESETS)}")
        sys.exit(1)
    p = PRESETS[preset_name]
    ps.COLS, ps.ROWS = p["grid"]

    out_dir = Path("assets")
    out_dir.mkdir(exist_ok=True)

    sprites = ps.cut_cells(sys.argv[1], p["names"], p["groups"])
    final = ps.posterize(ps.shrink(sprites, SIZE))
    final.pop("unused", None)

    for name, im in final.items():
        im.save(out_dir / f"{name}.png")

    tiles = list(final.values())
    prev = Image.new("RGBA", (sum(t.width for t in tiles), SIZE), (90, 140, 200, 255))
    x = 0
    for t in tiles:
        prev.paste(t, (x, 0), t)
        x += t.width
    prev = prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST)
    prev.save(out_dir / f"_preview_{preset_name}.png")
    print(f"Fertig: {len(final)} Sprites in {out_dir}/ (Vorschau: _preview_{preset_name}.png)")


if __name__ == "__main__":
    main()
