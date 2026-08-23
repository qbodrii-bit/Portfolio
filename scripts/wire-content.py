# -*- coding: utf-8 -*-
"""content/ -> HTML-Seiten im Repo-Root neu schreiben.

Aufruf: python scripts/wire-content.py      (nur Standardbibliothek)

Liest content/works/<slug>.json, content/artist.json, content/site.json und
schreibt index/work/biography/contact.html sowie werk-<slug>.html je Arbeit.
Bildgroessen kommen aus content/images/_sizes.json (scripts/prepare-images.py);
fehlt die Datei, werden width/height weggelassen.
Idempotent - mehrfaches Ausfuehren aendert nichts weiter.
"""
import glob
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = ROOT                      # Seiten liegen im Repo-Root
CONTENT = os.path.join(ROOT, "content")
e = html.escape


# ---------------------------------------------------------------- Daten laden
def load(path, default=None):
    p = os.path.join(CONTENT, path)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def rel(src):
    """CMS speichert '/content/images/...'; im HTML brauchen wir relative Pfade."""
    return src.lstrip("/")


SIZES = load(os.path.join("images", "_sizes.json"), {}) or {}
artist = load("artist.json")
site = load("site.json", {}) or {}

works = []
for path in sorted(glob.glob(os.path.join(CONTENT, "works", "*.json"))):
    with open(path, encoding="utf-8") as f:
        w = json.load(f)
    w["slug"] = os.path.splitext(os.path.basename(path))[0]
    w.setdefault("order", 999)
    w.setdefault("year_label", str(w.get("year", "")))
    for key in ("title_en", "material_de", "material_en", "medium_de", "medium_en",
                "text_de", "text_en"):
        w.setdefault(key, "")
    w["images"] = [im for im in w.get("images", []) if im.get("src")]
    works.append(w)
works.sort(key=lambda w: (w["order"], w["slug"]))

if not works:
    raise SystemExit("content/works/ ist leer - keine Arbeiten zu schreiben.")


# ------------------------------------------------------------------ Helfer
def read(name):
    with open(os.path.join(SITE, name), encoding="utf-8") as f:
        return f.read()


def write(name, text):
    with open(os.path.join(SITE, name), "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def set_main(src, main_html):
    return re.sub(r"  <main>.*?</main>", main_html.rstrip(), src, count=1, flags=re.S)


def dims(src):
    wh = SIZES.get(rel(src))
    return f' width="{wh[0]}" height="{wh[1]}"' if wh else ""


def meta_line(w, lang):
    bits = [w["material_" + lang], w["medium_" + lang], w["year_label"]]
    return " · ".join(b for b in bits if b)


def meta_short(w, lang):
    bits = [w["material_" + lang], w["medium_" + lang]]
    return " · ".join(b for b in bits if b)


def detail_href(w):
    return f"werk-{w['slug']}.html"


def alt(w):
    return f"{e(w['title'])}, {w['year_label']} — Boram Park"


# ---------------------------------------------------------------- work.html
items = []
for w in works:
    im = w["images"][0]
    items.append(f"""      <a class="work-item" href="{detail_href(w)}">
        <img class="thumb" src="{rel(im['src'])}"{dims(im['src'])} loading="lazy" alt="{alt(w)}">
        <div class="work-caption">
          <span class="work-year">{w['year_label']}</span>
          <span class="work-title" data-de="{e(w['title'])}" data-en="{e(w['title_en'])}">{e(w['title'])}</span>
        </div>
        <div class="work-medium" data-de="{e(meta_short(w, 'de'))}" data-en="{e(meta_short(w, 'en'))}">{e(meta_short(w, 'de'))}</div>
      </a>""")

work_main = ("  <main>\n"
             """    <header class="page-head">
      <h1 data-de="Work" data-en="Work">Work</h1>
    </header>

    <div class="work-grid">
""" + "\n".join(items) + """
    </div>
  </main>""")

src = read("work.html")
src = src.replace("""  .thumb {
    aspect-ratio: 4 / 5;
    background: var(--bp-hairline);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--bp-fg-muted);
    font-size: 11px;
    font-family: ui-monospace, "SF Mono", monospace;
  }""", """  .thumb {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
    object-fit: cover;
    background: var(--bp-hairline);
  }""")
YEAR_CSS = "  .work-year { color: var(--bp-fg-muted); font-weight: var(--bp-font-weight-normal); }"
MEDIUM_CSS = "  .work-medium { color: var(--bp-fg-muted); font-size: 13px; margin-top: 2px; }"
if MEDIUM_CSS not in src:
    src = src.replace(YEAR_CSS, YEAR_CSS + "\n" + MEDIUM_CSS, 1)
delays = "\n".join(
    f"  .work-grid .work-item:nth-child({n}) {{ animation-delay: {0.05 * n:.2f}s; }}"
    for n in range(1, len(works) + 1))
src = re.sub(r"(?:  \.work-grid \.work-item:nth-child\(\d+\)[^\n]*\n)+", delays + "\n", src)
write("work.html", set_main(src, work_main))

# --------------------------------------------------------------- index.html
lead = works[0]
cover = site.get("cover_image") or lead["images"][0]["src"]
cover_slug = site.get("cover_link_slug") or lead["slug"]
cover_year = site.get("cover_caption_year") or lead["year_label"]
cover_title = site.get("cover_caption_title") or lead["title"]
cover_title_en = site.get("cover_caption_title_en") or lead["title_en"]
tag_de = site.get("tagline_de", "Fotografie — Installation — Video")
tag_en = site.get("tagline_en", "Photography — Installation — Video")

index_main = f"""  <main>
    <div class="home-hero">
      <h1 class="home-name">Boram Park</h1>
      <p class="home-tagline" data-de="{e(tag_de)}" data-en="{e(tag_en)}">{e(tag_de)}</p>
    </div>

    <a class="hero-work" href="werk-{cover_slug}.html">
      <img class="hero-thumb" src="{rel(cover)}"{dims(cover)} alt="{e(cover_title)}, {cover_year} — Boram Park">
      <div class="hero-caption">
        <span class="hero-year">{cover_year}</span>
        <span class="hero-title" data-de="{e(cover_title)}" data-en="{e(cover_title_en)}">{e(cover_title)}</span>
      </div>
    </a>

    <a class="home-enter" href="work.html" data-de="Alle Arbeiten ansehen →" data-en="View all works →">Alle Arbeiten ansehen →</a>
  </main>"""

src = read("index.html")
src = src.replace("""  .hero-thumb {
    aspect-ratio: 16 / 9;
    max-height: 62vh;
    background: var(--bp-hairline);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--bp-fg-muted);
    font-size: 12px;
    font-family: ui-monospace, "SF Mono", monospace;
  }""", """  .hero-thumb {
    display: block;
    width: 100%;
    max-height: 62vh;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background: var(--bp-hairline);
  }""")
write("index.html", set_main(src, index_main))

# ----------------------------------------------------------- biography.html
edu_rows = "\n".join(f"""      <div class="exhibition-row">
        <span class="ex-date">{e(x['period'])}</span>
        <span class="ex-title" data-de="{e(x['degree_de'])}" data-en="{e(x['degree_en'])}">{e(x['degree_de'])}</span>
        <span class="ex-location">{e(x['institution_de'])}</span>
      </div>""" for x in artist["education"])

ex_rows = "\n".join(f"""      <div class="exhibition-row">
        <span class="ex-date">{x['year']}</span>
        <span class="ex-title">{e(x['title'])}</span>
        <span class="ex-location">{e(x['venue'])}</span>
      </div>""" for x in artist["exhibitions"])

stmt_de = artist.get("statement_de", "")
stmt_en = artist.get("statement_en", "")

bio_main = f"""  <main>
    <header class="page-head">
      <h1 data-de="Biography" data-en="Biography">Biography</h1>
    </header>

    <p class="bio-statement" data-de="{e(stmt_de)}" data-en="{e(stmt_en)}">{e(stmt_de)}</p>

    <h2 class="section-label" data-de="Ausbildung" data-en="Education">Ausbildung</h2>
    <div class="exhibition-list">
{edu_rows}
    </div>

    <h2 class="section-label" data-de="Ausstellungen" data-en="Exhibitions">Ausstellungen</h2>
    <div class="exhibition-list">
{ex_rows}
    </div>
  </main>"""
write("biography.html", set_main(read("biography.html"), bio_main))

# ------------------------------------------------------------- contact.html
mail = artist["email"]
note_de = artist.get("contact_note_de", "Für Ausstellungsanfragen und Presse.")
note_en = artist.get("contact_note_en", "For exhibition inquiries and press.")
place_de = artist.get("place_de", "Boram Park — Saarbrücken, Deutschland")
place_en = artist.get("place_en", "Boram Park — Saarbrücken, Germany")

contact_main = f"""  <main>
    <header class="page-head">
      <h1 data-de="Contact" data-en="Contact">Contact</h1>
    </header>

    <div class="contact-block">
      <a class="contact-email" href="mailto:{mail}">{mail}</a>
      <p class="contact-note" data-de="{e(note_de)}" data-en="{e(note_en)}">{e(note_de)}</p>
      <p class="contact-note" data-de="{e(place_de)}" data-en="{e(place_en)}">{e(place_de)}</p>
    </div>
  </main>"""
src = read("contact.html")
src = re.sub(r'\s*<div class="contact-social">.*?</div>', "", src, count=1, flags=re.S)
write("contact.html", set_main(src, contact_main))

# ------------------------------------------------- werk-<slug>.html (Detail)
base = read("work.html")
head, body_rest = base.split("</style>", 1)
DETAIL_CSS = """
  /* ---------- Work detail ---------- */
  .work-meta {
    font-size: 14px;
    color: var(--bp-fg-muted);
    margin: var(--bp-space-sm) 0 0;
  }

  .work-text {
    max-width: 640px;
    font-size: 16px;
    line-height: 1.6;
    margin: var(--bp-space-md) 0 var(--bp-space-xl);
  }

  .work-figures {
    display: flex;
    flex-direction: column;
    gap: var(--bp-space-sm);
    max-width: 1400px;
  }

  .work-figures figure { margin: 0; }

  .work-figures img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 84vh;
    object-fit: contain;
    object-position: left center;
  }

  .work-figures figcaption {
    font-size: 14px;
    color: var(--bp-fg-muted);
    margin-top: var(--bp-space-xs);
  }

  .back-link {
    display: inline-block;
    margin-top: var(--bp-space-xl);
    font-size: 14px;
    color: var(--bp-fg-muted);
  }

  .back-link:hover { color: var(--bp-fg); }
"""
head = head + DETAIL_CSS + "</style>"

for w in works:
    figs = []
    for im in w["images"]:
        cap = ""
        if im.get("caption_de"):
            cde, cen = im["caption_de"], im.get("caption_en") or im["caption_de"]
            cap = (f'\n        <figcaption data-de="{e(cde)}" data-en="{e(cen)}">{e(cde)}</figcaption>')
        figs.append(f"""      <figure>
        <img src="{rel(im['src'])}"{dims(im['src'])} loading="lazy" alt="{alt(w)}">{cap}
      </figure>""")

    text_block = ""
    if w["text_de"]:
        text_block = (f'\n    <p class="work-text" data-de="{e(w["text_de"])}" data-en="{e(w["text_en"])}">'
                      f'{e(w["text_de"])}</p>\n')

    main = f"""  <main>
    <header class="page-head">
      <h1 data-de="{e(w['title'])}" data-en="{e(w['title_en'])}">{e(w['title'])}</h1>
      <p class="work-meta" data-de="{e(meta_line(w, 'de'))}" data-en="{e(meta_line(w, 'en'))}">{e(meta_line(w, 'de'))}</p>
    </header>
{text_block}
    <div class="work-figures">
{chr(10).join(figs)}
    </div>

    <a class="back-link" href="work.html" data-de="← Alle Arbeiten" data-en="← All works">← Alle Arbeiten</a>
  </main>"""

    page = set_main(head + body_rest, main)
    page = page.replace("<title>Boram — Work</title>",
                        "<title>" + e(w["title"]) + " — Boram Park</title>", 1)
    write(detail_href(w), page)

# Detailseiten geloeschter Arbeiten entfernen
keep = {detail_href(w) for w in works}
for path in glob.glob(os.path.join(SITE, "werk-*.html")):
    name = os.path.basename(path)
    if name not in keep:
        os.remove(path)
        print("entfernt:", name)

print("Seiten geschrieben:", 4 + len(works))
