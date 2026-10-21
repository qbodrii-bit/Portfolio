# -*- coding: utf-8 -*-
"""Bildmasse einlesen und fuer grosse Originale eine Fassung fuer die Seite anlegen.

Aufruf: python scripts/prepare-images.py      (benoetigt pillow)

Die Originale fasst dieses Skript nie an - weder Aufloesung noch Farbprofil
noch Kompression. Was die Kuenstlerin hochlaedt, bleibt Byte fuer Byte im
Repo: es ist eine Kuenstlerseite, die Fotos sind die Arbeit.

Geschrieben wird:
  - content/images/_sizes.json  Pixelmasse der Originale, so wie der Browser
    sie zeigt (EXIF-Drehung beruecksichtigt). Daraus setzt
    scripts/wire-content.py die width/height-Attribute und den Deckel gegen
    Hochskalieren.
  - content/images/_web/...     fuer Originale, die gross UND schwer sind, eine
    Fassung mit WEB_PX auf der langen Seite. Die Seite zeigt dann diese.
  - content/images/_web.json    Original -> Fassung, fuer wire-content.py und
    den Editor.

Warum WEB_PX = 3000: Werke stehen hoechstens 1400 CSS-Pixel breit
(.work-blocks in site.css), auf 2x-Bildschirmen sind das 2800 Geraetepixel.
Was darueber liegt, verkleinert der Browser ohnehin, bevor es zu sehen ist.
Frueher wurde hier alles auf 2400px verkleinert - das lag unter diesen 2800
und kostete auf grossen hochaufloesenden Bildschirmen sichtbar Schaerfe.

Die Fassung soll vom Original nicht zu unterscheiden sein:
  - JPEG mit Qualitaet 92 und ohne Farbunterabtastung (4:4:4)
  - eingebettetes Farbprofil (Display P3, Adobe RGB ...) bleibt dran,
    es wird nichts nach sRGB umgerechnet
  - gleiches Format wie das Original, kein Wechsel nach WebP/AVIF
  - Lanczos beim Verkleinern

Kleine oder leichte Originale (alles, was frueher ueber 3 MB nicht
hinauskam) bekommen keine Fassung und gehen unveraendert auf die Seite.

Einmal angelegte Fassungen werden nicht neu gerechnet; verschwindet ein
Original, verschwindet auch seine Fassung. Laeuft in GitHub Actions bei jedem
Push auf content/.
"""
import json
import os

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, "content", "images")
WEB_DIR = os.path.join(IMAGES, "_web")
HEAVY_MB = 8          # ab hier nur ein Hinweis im Log
WEB_PX = 3000         # lange Seite der Fassung
WEB_AB_MB = 3         # erst ab dieser Dateigroesse lohnt eine Fassung
EXT = (".jpg", ".jpeg", ".png", ".webp")
GEDREHT = (5, 6, 7, 8)   # EXIF-Ausrichtungen, bei denen Breite und Hoehe tauschen


def rel_of(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def fassung(src, ziel):
    """Verkleinerte Fassung schreiben. False, wenn das Bild sich dagegen wehrt."""
    with Image.open(src) as im:
        icc = im.info.get("icc_profile")
        fmt = im.format
        im = ImageOps.exif_transpose(im)          # Drehung einbacken, Tag faellt weg
        im.thumbnail((WEB_PX, WEB_PX), Image.LANCZOS)
        os.makedirs(os.path.dirname(ziel), exist_ok=True)
        opts = {"icc_profile": icc} if icc else {}
        if fmt == "JPEG":
            im.save(ziel, "JPEG", quality=92, subsampling=0, optimize=True, **opts)
        elif fmt == "PNG":
            im.save(ziel, "PNG", optimize=True, **opts)
        elif fmt == "WEBP":
            im.save(ziel, "WEBP", quality=92, method=6, **opts)
        else:
            return False
    return True


sizes = {}
web = {}
heavy = []

for folder, dirs, files in os.walk(IMAGES):
    if os.path.abspath(folder) == os.path.abspath(IMAGES):
        dirs[:] = [d for d in dirs if d != "_web"]     # Fassungen sind keine Originale
    for name in sorted(files):
        if not name.lower().endswith(EXT):
            continue
        path = os.path.join(folder, name)
        rel = rel_of(path)

        with Image.open(path) as im:        # nur oeffnen, nie speichern
            w, h = im.size
            if im.getexif().get(0x0112) in GEDREHT:
                w, h = h, w
        sizes[rel] = [w, h]

        mb = os.path.getsize(path) / 1048576
        if mb > HEAVY_MB:
            heavy.append((rel, mb))

        if max(w, h) > WEB_PX and mb > WEB_AB_MB:
            ziel = os.path.join(WEB_DIR, os.path.relpath(path, IMAGES))
            try:
                ok = os.path.exists(ziel) or fassung(path, ziel)
            except (OSError, ValueError) as err:
                print(f"  Fassung fuer {rel} nicht moeglich ({err}) - Original wird gezeigt")
                ok = False
            if ok:
                web[rel] = rel_of(ziel)

# Fassungen ohne Original wegraeumen
behalten = {os.path.join(ROOT, v) for v in web.values()}
for folder, _dirs, files in os.walk(WEB_DIR, topdown=False):
    for name in files:
        p = os.path.join(folder, name)
        if p not in behalten:
            os.remove(p)
            print(f"  Fassung entfernt: {rel_of(p)}")
    if folder != WEB_DIR and not os.listdir(folder):
        os.rmdir(folder)

with open(os.path.join(IMAGES, "_sizes.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(dict(sorted(sizes.items())), f, ensure_ascii=False, indent=1)
    f.write("\n")

with open(os.path.join(IMAGES, "_web.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(dict(sorted(web.items())), f, ensure_ascii=False, indent=1)
    f.write("\n")

total = sum(os.path.getsize(os.path.join(ROOT, r)) for r in sizes) / 1048576
print(f"Bilder: {len(sizes)} | Originale unveraendert | zusammen {total:.1f} MB")
for rel, ziel in sorted(web.items()):
    a = os.path.getsize(os.path.join(ROOT, rel)) / 1048576
    b = os.path.getsize(os.path.join(ROOT, ziel)) / 1048576
    print(f"  Fassung: {rel} {a:.1f} MB -> {b:.1f} MB")
for rel, mb in sorted(heavy, key=lambda x: -x[1]):
    print(f"  Hinweis: {rel} ist {mb:.1f} MB gross")
