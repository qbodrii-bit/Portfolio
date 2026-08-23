# -*- coding: utf-8 -*-
"""Bilder in content/images/ fuer das Web aufbereiten.

Aufruf: python scripts/prepare-images.py      (benoetigt pillow)

1. Verkleinert jedes Bild, dessen laengere Kante ueber MAXDIM liegt (JPEG q88).
   So kann im CMS ein Foto direkt aus der Kamera hochgeladen werden.
2. Schreibt content/images/_sizes.json - die Bildmasse, aus denen
   scripts/wire-content.py die width/height-Attribute setzt.

Laeuft in GitHub Actions bei jedem Push auf content/.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, "content", "images")
MAXDIM = 2400
QUALITY = 88
EXT = (".jpg", ".jpeg", ".png", ".webp")

sizes = {}
resized = 0

for folder, _dirs, files in os.walk(IMAGES):
    for name in sorted(files):
        if not name.lower().endswith(EXT):
            continue
        path = os.path.join(folder, name)
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")

        with Image.open(path) as im:
            w, h = im.size
            too_big = max(w, h) > MAXDIM
            if too_big:
                fmt = im.format                      # Dateiname und Format bleiben,
                if fmt in ("JPEG", "MPO"):           # damit keine Verweise brechen
                    im = im.convert("RGB")
                ratio = MAXDIM / max(w, h)
                im = im.resize((round(w * ratio), round(h * ratio)), Image.LANCZOS)
                w, h = im.size
                if fmt in ("JPEG", "MPO"):
                    im.save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)
                else:
                    im.save(path, fmt, optimize=True)
                resized += 1
                print(f"verkleinert: {rel} -> {w}x{h}")

        sizes[rel] = [w, h]

with open(os.path.join(IMAGES, "_sizes.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(dict(sorted(sizes.items())), f, ensure_ascii=False, indent=1)
    f.write("\n")

print(f"Bilder: {len(sizes)} | verkleinert: {resized} | _sizes.json geschrieben")
