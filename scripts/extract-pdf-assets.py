"""content/source/*.pdf -> content/images/*  (Werkbilder + Seitenvorschauen neu erzeugen).
Aufruf: python scripts/extract-pdf-assets.py   (benoetigt pymupdf, pillow)
Achtung: ueberschreibt content/images/. Danach die zwei Drive-Hires-Bilder
(ein-hammer-video/01.jpg und /10.jpg) wieder aus content/source/drive/ setzen.
"""
import io, os, json
import pymupdf
from PIL import Image

SRC = None  # set after OUT (see below)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content")
MAXDIM = 2400
Q = 88

# slug -> list of (page_number_1based, xref) in presentation order
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
    ("ein-hammer-installation",[(20, 181)]),
    ("ein-hammer-video",       [(21, 185), (22, 192), (22, 198), (22, 202), (22, 206),
                                (22, 208), (22, 212), (22, 216), (22, 218), (22, 220)]),
]

SRC = os.path.join(OUT, "source", "Portfolio_Boram-Park_2026.pdf")
doc = pymupdf.open(SRC)
os.makedirs(OUT, exist_ok=True)
manifest = {}

for slug, items in MAP:
    d = os.path.join(OUT, "images", slug)
    os.makedirs(d, exist_ok=True)
    files = []
    for i, (page, xref) in enumerate(items, 1):
        info = doc.extract_image(xref)
        img = Image.open(io.BytesIO(info["image"]))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        w0, h0 = img.size
        if max(img.size) > MAXDIM:
            r = MAXDIM / max(img.size)
            img = img.resize((round(w0 * r), round(h0 * r)), Image.LANCZOS)
        name = f"{i:02d}.jpg"
        path = os.path.join(d, name)
        img.save(path, "JPEG", quality=Q, optimize=True, progressive=True)
        files.append({
            "file": f"content/images/{slug}/{name}",
            "w": img.size[0], "h": img.size[1],
            "source_page": page,
            "orig": f"{w0}x{h0}",
            "kb": round(os.path.getsize(path) / 1024),
        })
    manifest[slug] = files
    print(slug, len(files), sum(f["kb"] for f in files), "KB")

# page previews for reference
pd = os.path.join(OUT, "source", "pages")
os.makedirs(pd, exist_ok=True)
for i, p in enumerate(doc, 1):
    pix = p.get_pixmap(dpi=110)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    im.save(os.path.join(pd, f"page-{i:02d}.jpg"), "JPEG", quality=80, optimize=True)
print("pages rendered:", doc.page_count)

with open(os.path.join(OUT, "images", "_manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
