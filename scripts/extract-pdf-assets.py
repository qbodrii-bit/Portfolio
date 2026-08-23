# -*- coding: utf-8 -*-
"""content/source/*.pdf -> content/images/*  (Werkbilder und Seitenvorschauen).

Aufruf: python scripts/extract-pdf-assets.py   (benoetigt pymupdf, pillow)

Farbe: die Bilder im PDF liegen in verschiedenen Farbraeumen vor
(Adobe RGB, ProPhoto RGB, Display P3, DeviceCMYK, DeviceRGB). MuPDF rechnet
sie mit dem eingebetteten ICC-Profil nach sRGB um; das Ergebnis bekommt ein
sRGB-Profil eingebettet. Wird das uebersprungen, wirken vor allem die
ProPhoto- und CMYK-Bilder flau und zu dunkel.

Die beiden hochaufloesenden Drive-Fotos aus content/source/drive/ werden am
Ende gesetzt (Display P3 -> sRGB); sie ersetzen die kleineren PDF-Fassungen.

Achtung: ueberschreibt content/images/.
"""
import io
import json
import os

import pymupdf
from PIL import Image, ImageCms

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content")
SRC = os.path.join(OUT, "source", "Portfolio_Boram-Park_2026.pdf")
DRIVE = os.path.join(OUT, "source", "drive")
MAXDIM = 2400
Q = 88

# slug -> [(Seite ab 1, xref)] in der Reihenfolge, in der sie auf der Werkseite stehen
MAP = [
    ("cover",                  [(1, 33)]),
    ("haeutung-reispapier",    [(2, 46), (2, 43), (3, 52)]),
    ("haeutung-leuchtkasten",  [(4, 58), (5, 62)]),
    ("haeutung-kleiderbuegel", [(6, 66), (7, 70), (8, 74)]),
    ("beruehrung",             [(9, 78)]),
    ("huelle",                 [(10, 82), (10, 86)]),
    ("haeutung-kosmetikmaske", [(11, 91), (11, 95), (11, 99), (11, 103)]),
    ("ein-monat",              [(12, 109)]),
    ("lebensfluss",            [(13, 117), (13, 123), (13, 127), (13, 131)]),
    ("uebergabe",              [(14, 137), (15, 141), (15, 143), (15, 145), (15, 147)]),
    ("street-food",            [(16, 152), (17, 156), (18, 171), (19, 175)]),
    ("ein-hammer-installation", [(20, 181)]),
    ("ein-hammer-video",       [(21, 185), (22, 192), (22, 198), (22, 202), (22, 206),
                                (22, 208), (22, 212), (22, 216), (22, 218), (22, 220)]),
]

# hochaufloesende Drive-Originale: Datei -> (slug, Position in MAP)
DRIVE_IMAGES = [("ein-hammer_installationsansicht.jpg", "ein-hammer-video", 1),
                ("ein-hammer_still-ajona.jpg", "ein-hammer-video", 10)]

pymupdf.TOOLS.set_icc(True)          # Farbmanagement in MuPDF einschalten
SRGB = ImageCms.createProfile("sRGB")
SRGB_BYTES = ImageCms.ImageCmsProfile(SRGB).tobytes()


def save_web(img, path):
    """Auf MAXDIM verkleinern und als sRGB-JPEG sichern."""
    w0, h0 = img.size
    if max(img.size) > MAXDIM:
        r = MAXDIM / max(img.size)
        img = img.resize((round(w0 * r), round(h0 * r)), Image.LANCZOS)
    img.save(path, "JPEG", quality=Q, optimize=True, progressive=True,
             icc_profile=SRGB_BYTES)
    return img.size, (w0, h0), round(os.path.getsize(path) / 1024)


def to_srgb_from_pdf(doc, xref):
    """Bild aus dem PDF holen und farbrichtig nach sRGB wandeln."""
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha:                                    # Transparenz auf Weiss legen
        pix = pymupdf.Pixmap(pix, 0)
    if pix.colorspace is None or pix.colorspace.name != "DeviceRGB":
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def to_srgb_from_file(path):
    """JPEG mit eigenem Profil (hier Display P3) nach sRGB wandeln."""
    im = Image.open(path)
    icc = im.info.get("icc_profile")
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    if icc:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        im = ImageCms.profileToProfile(im, src, SRGB, outputMode="RGB")
        note = ImageCms.getProfileDescription(src).strip()
    else:
        im = im.convert("RGB")
        note = "ohne Profil"
    return im, note


doc = pymupdf.open(SRC)
manifest = {}

for slug, items in MAP:
    folder = os.path.join(OUT, "images", slug)
    os.makedirs(folder, exist_ok=True)
    files = []
    for i, (page, xref) in enumerate(items, 1):
        cs = doc.extract_image(xref).get("cs-name", "?")
        img = to_srgb_from_pdf(doc, xref)
        name = f"{i:02d}.jpg"
        size, orig, kb = save_web(img, os.path.join(folder, name))
        files.append({"file": f"content/images/{slug}/{name}", "w": size[0], "h": size[1],
                      "source_page": page, "source_colorspace": cs,
                      "orig": f"{orig[0]}x{orig[1]}", "kb": kb})
    manifest[slug] = files
    print(f"{slug:26s} {len(files):2d} Bilder  {sum(f['kb'] for f in files):5d} KB")

for filename, slug, index in DRIVE_IMAGES:
    path = os.path.join(DRIVE, filename)
    if not os.path.exists(path):
        print("fehlt, uebersprungen:", filename)
        continue
    img, note = to_srgb_from_file(path)
    name = f"{index:02d}.jpg"
    size, orig, kb = save_web(img, os.path.join(OUT, "images", slug, name))
    entry = manifest[slug][index - 1]
    entry.update(w=size[0], h=size[1], kb=kb, orig=f"{orig[0]}x{orig[1]}",
                 source_page=None, source_drive=f"drive/{filename}",
                 source_colorspace=note)
    print(f"{slug}/{name} <- {filename} ({note})")

# Seitenvorschauen zum Nachschlagen
preview = os.path.join(OUT, "source", "pages")
os.makedirs(preview, exist_ok=True)
for i, page in enumerate(doc, 1):
    pix = page.get_pixmap(dpi=110)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    im.save(os.path.join(preview, f"page-{i:02d}.jpg"), "JPEG", quality=80, optimize=True)

with open(os.path.join(OUT, "images", "_manifest.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
    f.write("\n")

total = sum(f["kb"] for v in manifest.values() for f in v)
print(f"\nBilder: {sum(len(v) for v in manifest.values())} | {total / 1024:.1f} MB | Seiten: {doc.page_count}")
