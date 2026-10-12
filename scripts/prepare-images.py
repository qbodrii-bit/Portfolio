# -*- coding: utf-8 -*-
"""Bildmasse aus content/images/ einlesen und nach _sizes.json schreiben.

Aufruf: python scripts/prepare-images.py      (benoetigt pillow)

Dieses Skript liest nur. Es fasst keine Bilddatei an - weder die Aufloesung
noch das Farbprofil noch die Kompression. Was die Kuenstlerin hochlaedt, geht
Byte fuer Byte so auf die Seite: es ist eine Kuenstlerseite, die Fotos sind
die Arbeit.

Geschrieben wird allein content/images/_sizes.json - die Pixelmasse, aus denen
scripts/wire-content.py die width/height-Attribute und den Deckel gegen
Hochskalieren setzt.

Frueher hat dieses Skript zwei Dinge getan, beide sind bewusst entfallen:
  - Verkleinern auf 2400px. Kostete Schaerfe auf grossen und hochaufloesenden
    Bildschirmen.
  - Umrechnen fremder Farbprofile (Display P3, Adobe RGB) nach sRGB. Dafuer
    musste die Datei neu kodiert werden. Noetig waere das nur, wenn das Profil
    fehlte - eingebettete Profile wertet jeder heutige Browser selbst aus und
    zeigt auf weiten Farbraeumen sogar mehr als sRGB hergeben wuerde.

Laeuft in GitHub Actions bei jedem Push auf content/.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, "content", "images")
HEAVY_MB = 8          # ab hier nur ein Hinweis im Log, kein Eingriff
EXT = (".jpg", ".jpeg", ".png", ".webp")

sizes = {}
heavy = []

for folder, _dirs, files in os.walk(IMAGES):
    for name in sorted(files):
        if not name.lower().endswith(EXT):
            continue
        path = os.path.join(folder, name)
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")

        with Image.open(path) as im:        # nur oeffnen, nie speichern
            sizes[rel] = list(im.size)

        mb = os.path.getsize(path) / 1048576
        if mb > HEAVY_MB:
            heavy.append((rel, mb))

with open(os.path.join(IMAGES, "_sizes.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(dict(sorted(sizes.items())), f, ensure_ascii=False, indent=1)
    f.write("\n")

total = sum(os.path.getsize(os.path.join(ROOT, r)) for r in sizes) / 1048576
print(f"Bilder: {len(sizes)} | unveraendert | zusammen {total:.1f} MB")
for rel, mb in sorted(heavy, key=lambda x: -x[1]):
    print(f"  Hinweis: {rel} ist {mb:.1f} MB gross")
