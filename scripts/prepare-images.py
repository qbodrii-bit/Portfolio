# -*- coding: utf-8 -*-
"""Bilder in content/images/ fuer das Web aufbereiten.

Aufruf: python scripts/prepare-images.py      (benoetigt pillow)

1. Rechnet Bilder mit fremdem Farbprofil (Display P3 vom Telefon, Adobe RGB aus
   Lightroom) nach sRGB um. Ohne diesen Schritt zeigt der Browser die Zahlen als
   sRGB an und die Farben kippen - meist flauer und kuehler als das Original.
2. Verkleinert alles, dessen laengere Kante ueber MAXDIM liegt (JPEG q88).
   Fotos duerfen also direkt aus der Kamera hochgeladen werden.
3. Schreibt content/images/_sizes.json - die Bildmasse, aus denen
   scripts/wire-content.py die width/height-Attribute setzt.

Neu geschrieben wird eine Datei nur, wenn sie wirklich verkleinert oder
umgerechnet werden muss; sonst bleibt sie unangetastet.
Laeuft in GitHub Actions bei jedem Push auf content/.
"""
import io
import json
import os

from PIL import Image, ImageCms

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, "content", "images")
MAXDIM = 2400
QUALITY = 88
EXT = (".jpg", ".jpeg", ".png", ".webp")

SRGB = ImageCms.createProfile("sRGB")
SRGB_BYTES = ImageCms.ImageCmsProfile(SRGB).tobytes()


def profile_name(icc_bytes):
    try:
        return ImageCms.getProfileDescription(
            ImageCms.ImageCmsProfile(io.BytesIO(icc_bytes))).strip()
    except Exception:
        return "unbekannt"


def is_srgb(name):
    # unlesbare Profile werden in Ruhe gelassen, statt eine Umrechnung zu riskieren
    return "srgb" in name.lower() or name == "unbekannt"


sizes = {}
resized = converted = 0

for folder, _dirs, files in os.walk(IMAGES):
    for name in sorted(files):
        if not name.lower().endswith(EXT):
            continue
        path = os.path.join(folder, name)
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")

        with Image.open(path) as im:
            fmt = im.format
            w, h = im.size
            icc = im.info.get("icc_profile")
            needs_color = bool(icc) and not is_srgb(profile_name(icc))
            needs_resize = max(w, h) > MAXDIM

            if needs_color or needs_resize:
                work = im
                if needs_color:
                    src_name = profile_name(icc)
                    if work.mode not in ("RGB", "L"):
                        work = work.convert("RGB")
                    work = ImageCms.profileToProfile(
                        work, ImageCms.ImageCmsProfile(io.BytesIO(icc)), SRGB,
                        outputMode="RGB")
                    converted += 1
                    print(f"Farbe {src_name} -> sRGB: {rel}")
                if needs_resize:
                    ratio = MAXDIM / max(w, h)
                    work = work.resize((round(w * ratio), round(h * ratio)), Image.LANCZOS)
                    resized += 1
                    print(f"verkleinert: {rel} -> {work.size[0]}x{work.size[1]}")

                w, h = work.size
                if fmt in ("JPEG", "MPO"):        # Dateiname und Format bleiben,
                    if work.mode not in ("RGB", "L"):   # damit keine Verweise brechen
                        work = work.convert("RGB")
                    work.save(path, "JPEG", quality=QUALITY, optimize=True,
                              progressive=True, icc_profile=SRGB_BYTES)
                else:
                    work.save(path, fmt, optimize=True, icc_profile=SRGB_BYTES)

        sizes[rel] = [w, h]

with open(os.path.join(IMAGES, "_sizes.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(dict(sorted(sizes.items())), f, ensure_ascii=False, indent=1)
    f.write("\n")

print(f"Bilder: {len(sizes)} | verkleinert: {resized} | nach sRGB gewandelt: {converted}")
