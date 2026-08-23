# -*- coding: utf-8 -*-
"""content/ -> alle HTML-Seiten im Repo-Root erzeugen.

Aufruf: python scripts/wire-content.py      (nur Standardbibliothek)

Liest content/works/<slug>.json, content/artist.json und content/site.json und
schreibt index/work/biography/contact.html sowie werk-<slug>.html je Arbeit.
Das Aussehen steckt komplett in assets/site.css - hier steht nur die Struktur.
Bildgroessen kommen aus content/images/_sizes.json (scripts/prepare-images.py);
fehlt die Datei, werden width/height weggelassen.
Die Seiten werden jedes Mal vollstaendig neu geschrieben; von Hand geaenderte
HTML-Dateien gehen dabei verloren.
"""
import glob
import hashlib
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = ROOT
CONTENT = os.path.join(ROOT, "content")
e = html.escape

FONT = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&display=swap"


def asset(name):
    """Dateiname mit kurzem Hash, damit Browser nach einer Aenderung
    nicht die alte Fassung aus dem Cache zeigen."""
    path = os.path.join(ROOT, "assets", name)
    if not os.path.exists(path):
        return f"assets/{name}"
    with open(path, "rb") as f:
        digest = hashlib.sha1(f.read()).hexdigest()[:8]
    return f"assets/{name}?v={digest}"


# ---------------------------------------------------------------- Daten laden
def load(path, default=None):
    p = os.path.join(CONTENT, path)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def rel(src):
    """Im CMS steht '/content/images/...'; die Seiten brauchen relative Pfade."""
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
works.sort(key=lambda w: (-int(w.get("year") or 0), w["order"], w["slug"]))

if not works:
    raise SystemExit("content/works/ ist leer - keine Arbeiten zu schreiben.")


# ---------------------------------------------------------------- Bausteine
NAV = [("work.html", "Work", "Work"),
       ("biography.html", "Biography", "Biography"),
       ("contact.html", "Contact", "Contact")]


ICON_MENU = ('<svg class="icon-menu" width="24" height="24" viewBox="0 0 24 24" '
             'fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
             '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>')
ICON_CLOSE = ('<svg class="icon-close" width="24" height="24" viewBox="0 0 24 24" '
              'fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
              '<path d="M5 5l14 14"/><path d="M19 5L5 19"/></svg>')

LANG_TOGGLE = """      <div class="lang-toggle" role="group" aria-label="Sprache">
        <button type="button" data-set-lang="de" aria-pressed="true">DE</button>
        <span aria-hidden="true">／</span>
        <button type="button" data-set-lang="en" aria-pressed="false">EN</button>
      </div>"""


def masthead(active):
    """Wortmarke, Navigation und Sprachwahl.

    Auf dem Telefon steckt beides unter .nav-panel hinter dem Menuknopf;
    am Rechner ist der Knopf ausgeblendet und das Panel immer offen.
    """
    links = []
    for href, de, en in NAV:
        mark = ' data-active="true"' if href == active else ""
        links.append(f'        <a class="nav-link"{mark} href="{href}" '
                     f'data-de="{de}" data-en="{en}">{de}</a>')
    return ("""  <nav class="masthead" aria-label="Hauptnavigation">
    <div class="masthead-bar">
      <a class="nav-logo" href="index.html">Boram Park</a>
      <button class="nav-toggle" type="button" aria-expanded="false"
              aria-controls="hauptmenue" aria-label="Menü">
        """ + ICON_MENU + """
        """ + ICON_CLOSE + """
      </button>
    </div>

    <div class="nav-panel" id="hauptmenue">
      <div class="nav-links">
"""
            + "\n".join(links)
            + """
      </div>

"""
            + LANG_TOGGLE
            + """
    </div>
  </nav>""")


def page(title, description, section, active, main):
    body_attr = f' data-section="{section}"' if section else ""
    return f"""<!doctype html>
<html lang="de" data-lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{e(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONT}" rel="stylesheet">
<link rel="stylesheet" href="{asset("site.css")}">
</head>
<body{body_attr}>

{masthead(active)}

{main}

  <script src="{asset("site.js")}"></script>
</body>
</html>
"""


def write(name, text):
    with open(os.path.join(SITE, name), "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


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


def thumb_src(w):
    """Vorschaubild: eigenes Feld, sonst das erste Bild der Arbeit."""
    return w.get("thumbnail") or w["images"][0]["src"]


def aspect(src):
    wh = SIZES.get(rel(src))
    return round(wh[0] / wh[1], 3) if wh and wh[1] else 1.5


def alt(w):
    return f"{e(w['title'])}, {w['year_label']} — Boram Park"


# --------------------------------------------------------------- index.html
lead = works[0]
cover = site.get("cover_image") or lead["images"][0]["src"]
cover_slug = site.get("cover_link_slug") or lead["slug"]
cover_year = site.get("cover_caption_year") or lead["year_label"]
cover_title = site.get("cover_caption_title") or lead["title"]
cover_title_en = site.get("cover_caption_title_en") or lead["title_en"]
tag_de = site.get("tagline_de", "").strip()
tag_en = site.get("tagline_en", "").strip() or tag_de

tagline_block = ""
if tag_de:
    tagline_block = ('\n    <p class="home-tagline" '
                     f'data-de="{e(tag_de)}" data-en="{e(tag_en)}">{e(tag_de)}</p>\n')

index_main = f"""  <main>
    <h1 class="visually-hidden">Boram Park — Portfolio</h1>{tagline_block}
    <a class="hero-work" href="werk-{cover_slug}.html">
      <img class="hero-thumb" src="{rel(cover)}"{dims(cover)} alt="{e(cover_title)}, {cover_year} — Boram Park">
      <div class="hero-caption">
        <span class="hero-year">{cover_year}</span>
        <span class="hero-title" data-de="{e(cover_title)}" data-en="{e(cover_title_en)}">{e(cover_title)}</span>
      </div>
    </a>

    <a class="home-enter" href="work.html" data-de="Alle Arbeiten ansehen →" data-en="View all works →">Alle Arbeiten ansehen →</a>
  </main>"""

home_desc = (f"Boram Park — {tag_de}. Arbeiten, Biografie und Kontakt." if tag_de
             else "Boram Park — Arbeiten, Biografie und Kontakt.")
write("index.html", page("Boram Park — Portfolio", home_desc, "", "", index_main))

# ---------------------------------------------------------------- work.html
items = []
for w in works:
    src = thumb_src(w)
    items.append(f"""      <a class="work-item" style="--ar: {aspect(src)}" href="{detail_href(w)}">
        <img class="thumb" src="{rel(src)}"{dims(src)} loading="lazy" alt="{alt(w)}">
        <div class="work-caption">
          <span class="work-title" data-de="{e(w['title'])}" data-en="{e(w['title_en'])}">{e(w['title'])}</span>
          <span class="work-year">{w['year_label']}</span>
        </div>
        <div class="work-medium" data-de="{e(meta_short(w, 'de'))}" data-en="{e(meta_short(w, 'en'))}">{e(meta_short(w, 'de'))}</div>
      </a>""")

work_main = ("""  <main>
    <h1 class="visually-hidden" data-de="Work" data-en="Work">Work</h1>

    <div class="work-grid">
"""
             + "\n".join(items)
             + """
    </div>
  </main>""")

write("work.html", page("Boram Park — Work",
                        "Arbeiten von Boram Park: Fotografie, Installation und Video.",
                        "work", "work.html", work_main))

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
    <h1 class="visually-hidden" data-de="Biography" data-en="Biography">Biography</h1>

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

write("biography.html", page("Boram Park — Biography",
                             "Boram Park: Ausbildung und Ausstellungen.",
                             "biography", "biography.html", bio_main))

# ------------------------------------------------------------- contact.html
mail = artist["email"]
note_de = artist.get("contact_note_de", "Für Ausstellungsanfragen und Presse.")
note_en = artist.get("contact_note_en", "For exhibition inquiries and press.")
place_de = artist.get("place_de", "Boram Park — Saarbrücken, Deutschland")
place_en = artist.get("place_en", "Boram Park — Saarbrücken, Germany")

contact_main = f"""  <main>
    <h1 class="visually-hidden" data-de="Contact" data-en="Contact">Contact</h1>

    <div class="contact-block">
      <a class="contact-email" href="mailto:{mail}">{mail}</a>
      <p class="contact-note" data-de="{e(note_de)}" data-en="{e(note_en)}">{e(note_de)}</p>
      <p class="contact-note" data-de="{e(place_de)}" data-en="{e(place_en)}">{e(place_de)}</p>
    </div>
  </main>"""

write("contact.html", page("Boram Park — Contact",
                           f"Kontakt zu Boram Park: {mail}",
                           "contact", "contact.html", contact_main))

# ------------------------------------------------- werk-<slug>.html (Detail)
for w in works:
    figs = []
    for im in w["images"]:
        cap = ""
        if im.get("caption_de"):
            cde = im["caption_de"]
            cen = im.get("caption_en") or cde
            cap = f'\n        <figcaption data-de="{e(cde)}" data-en="{e(cen)}">{e(cde)}</figcaption>'
        figs.append(f"""      <figure>
        <img src="{rel(im['src'])}"{dims(im['src'])} loading="lazy" alt="{alt(w)}">{cap}
      </figure>""")

    text_block = ""
    if w["text_de"]:
        text_block = (f'\n    <p class="work-text" data-de="{e(w["text_de"])}" '
                      f'data-en="{e(w["text_en"])}">{e(w["text_de"])}</p>\n')

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

    desc = w["text_de"][:150] if w["text_de"] else meta_line(w, "de")
    write(detail_href(w), page(f"{e(w['title'])} — Boram Park", desc,
                               "work", "work.html", main))

# Detailseiten geloeschter Arbeiten entfernen
keep = {detail_href(w) for w in works}
for path in glob.glob(os.path.join(SITE, "werk-*.html")):
    name = os.path.basename(path)
    if name not in keep:
        os.remove(path)
        print("entfernt:", name)

print("Seiten geschrieben:", 4 + len(works))
