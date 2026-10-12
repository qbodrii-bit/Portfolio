# -*- coding: utf-8 -*-
"""content/ -> alle HTML-Seiten im Repo-Root erzeugen.

Aufruf: python scripts/wire-content.py      (nur Standardbibliothek)

Liest content/works/<slug>.json, content/artist.json und content/site.json und
schreibt index/biography/contact.html sowie werk-<slug>.html je Arbeit.
Eine Uebersichtsseite gibt es nicht - die Werkliste steht in der Navigation.
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

# Verwaltungsseite (admin.html): steht in keinem Menue und traegt noindex.
# Sie ist nur ueber ihre Adresse erreichbar - absichtlich auch nicht in einer
# robots.txt, denn die ist oeffentlich und wuerde die Adresse erst verraten.
REPO = "qbodrii-bit/Portfolio"
WORKFLOW = "build.yml"
# Die Sammlung laesst sich spaeter noch direkter ansteuern; die Adresse dafuer
# nach dem ersten Login aus der Adresszeile uebernehmen.
CMS_URL = "https://app.pagescms.org/"


def asset(name):
    """Dateiname mit kurzem Hash, damit Browser nach einer Aenderung
    nicht die alte Fassung aus dem Cache zeigen."""
    path = os.path.join(ROOT, "assets", name)
    if not os.path.exists(path):
        return f"assets/{name}"
    with open(path, "rb") as f:
        content = f.read().replace(b"\r\n", b"\n")   # plattformunabhaengig
    return f"assets/{name}?v={hashlib.sha1(content).hexdigest()[:8]}"


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

# Layout aus dem CMS. Leere oder unsinnige Werte fallen stillschweigend auf die
# Vorgaben in site.css zurueck, damit ein Tippfehler nie den Aufbau bricht.
ALIGNS = ("left", "center", "right")


def as_int(value, lo, hi):
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return max(lo, min(hi, n))


def as_align(value):
    return value if value in ALIGNS else None


def style_attr(**props):
    """style="--w: 60%; ..." nur mit gesetzten Werten, sonst gar nichts."""
    bits = [f"--{k.replace('_', '-')}: {v}" for k, v in props.items() if v is not None]
    return f' style="{"; ".join(bits)}"' if bits else ""


def clean_blocks(raw):
    """Nur Bloecke behalten, die sich zeichnen lassen.

    Bildzellen ohne src fallen weg, Zeilen ohne Zellen auch. Zwei Leerraeume
    nebeneinander werden einer (der groessere), und am Anfang oder Ende steht
    keiner - sonst haengt die Seite vorne oder hinten durch. Dieselbe Regel
    gilt im Editor, siehe assets/admin-layout.js.
    """
    blocks = []
    for b in raw if isinstance(raw, list) else []:
        if not isinstance(b, dict):
            continue
        if b.get("t") == "gap":
            h = as_int(b.get("h"), 0, 400)
            if h:
                blocks.append({"t": "gap", "h": h})
        elif b.get("t") == "row":
            cells = [c for c in b.get("cells", [])
                     if isinstance(c, dict) and (c.get("t") != "img" or c.get("src"))]
            if cells:
                blocks.append({"t": "row", "gap": b.get("gap"), "va": b.get("va"),
                               "cells": cells})
    merged = []
    for b in blocks:
        if b["t"] == "gap" and merged and merged[-1]["t"] == "gap":
            merged[-1]["h"] = max(merged[-1]["h"], b["h"])
        else:
            merged.append(b)
    while merged and merged[0]["t"] == "gap":
        merged.pop(0)
    while merged and merged[-1]["t"] == "gap":
        merged.pop()
    return merged


def block_images(w):
    """Alle Bildzellen in Reihenfolge - fuer Startbild und Verwaltungsliste."""
    return [c for b in w["blocks"] if b["t"] == "row"
            for c in b["cells"] if c.get("t") == "img"]


def block_text(w, lang):
    """Erster nicht leerer Text - fuer die Seitenbeschreibung."""
    for b in w["blocks"]:
        if b["t"] != "row":
            continue
        for c in b["cells"]:
            if c.get("t") == "text" and (c.get(lang) or "").strip():
                return c[lang].strip()
    return ""


works = []
for path in sorted(glob.glob(os.path.join(CONTENT, "works", "*.json"))):
    with open(path, encoding="utf-8") as f:
        w = json.load(f)
    w["slug"] = os.path.splitext(os.path.basename(path))[0]
    w.setdefault("order", 999)
    w.setdefault("year_label", str(w.get("year", "")))
    for key in ("title_en", "material_de", "material_en", "medium_de", "medium_en"):
        w.setdefault(key, "")
    w["blocks"] = clean_blocks(w.get("blocks"))
    works.append(w)
works.sort(key=lambda w: (-int(w.get("year") or 0), w["order"], w["slug"]))

if not works:
    raise SystemExit("content/works/ ist leer - keine Arbeiten zu schreiben.")




# ---------------------------------------------------------------- Bausteine
# "Work" ist kein Link mehr, sondern klappt die Werkliste auf.
NAV = [("biography.html", "Biography", "Biography"),
       ("contact.html", "Contact", "Contact")]


ICON_MENU = ('<svg class="icon-menu" width="24" height="24" viewBox="0 0 24 24" '
             'fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
             '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>')
ICON_CLOSE = ('<svg class="icon-close" width="24" height="24" viewBox="0 0 24 24" '
              'fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
              '<path d="M5 5l14 14"/><path d="M19 5L5 19"/></svg>')

LANG_TOGGLE = """      <div class="lang-toggle" role="group" aria-label="Sprache">
        <button type="button" data-set-lang="de" aria-pressed="true">DE</button>
        <span class="lang-sep" aria-hidden="true">/</span>
        <button type="button" data-set-lang="en" aria-pressed="false">EN</button>
      </div>"""


def _short_title(w, lang):
    """Untertitel nach dem Doppelpunkt weglassen - die Liste ist schmal."""
    title = w["title"] if lang == "de" else (w["title_en"] or w["title"])
    return title.split(":")[0].strip()


def _qualifiers(w, lang):
    """Kandidaten, um gleichnamige Arbeiten auseinanderzuhalten.

    Beim Material der letzte Bestandteil (die Reispapier-Arbeiten teilen den
    ersten), bei der Technik der erste, sonst das Jahr.
    """
    def tidy(value):
        value = value.strip()
        return value[:1].upper() + value[1:]      # "light box" -> "Light box"

    material = tidy((w["material_" + lang] or "").split(",")[-1])
    medium = tidy((w["medium_" + lang] or "").split(",")[0])
    return [material, medium, w["year_label"]]


def _build_sub_labels():
    """Beschriftungen der Werkliste, je Sprache einmal vorberechnet."""
    labels = {}
    for lang in ("de", "en"):
        groups = {}
        for w in works:
            groups.setdefault(_short_title(w, lang), []).append(w)
        for base, members in groups.items():
            if len(members) == 1:
                labels[(members[0]["slug"], lang)] = base
                continue
            pick = None
            for index in range(3):
                values = [_qualifiers(m, lang)[index] for m in members]
                if all(values) and len(set(values)) == len(values):
                    pick = index
                    break
            for m in members:
                q = _qualifiers(m, lang)[pick if pick is not None else 2]
                labels[(m["slug"], lang)] = f"{base} · {q}" if q else base
    return labels


SUB_LABELS = _build_sub_labels()


def sub_label(w, lang):
    return SUB_LABELS[(w["slug"], lang)]


def masthead(active, current_slug=None):
    """Wortmarke, Navigation und Sprachwahl.

    "Work" klappt die Werkliste auf; jeder Eintrag fuehrt direkt auf die
    Werkseite. Auf einer Werkseite ist die Liste von Anfang an offen.
    Auf dem Telefon steckt alles unter .nav-panel hinter dem Menuknopf;
    am Rechner ist der Knopf ausgeblendet und das Panel immer offen.
    """
    on_work = current_slug is not None
    sub = []
    for w in works:
        mark = ' data-active="true"' if w["slug"] == current_slug else ""
        sub.append(f'            <li><a class="nav-sub-link"{mark} href="{detail_href(w)}" '
                   f'data-de="{e(sub_label(w, "de"))}" data-en="{e(sub_label(w, "en"))}">'
                   f'{e(sub_label(w, "de"))}</a></li>')

    links = [f'''        <button class="nav-link nav-branch" type="button"
                aria-expanded="{"true" if on_work else "false"}" aria-controls="werkliste"
                {'data-active="true"' if on_work else ""} data-de="Work" data-en="Work">Work</button>
        <div class="nav-sub" id="werkliste" data-open="{"true" if on_work else "false"}">
          <ul class="nav-sub-list">
{chr(10).join(sub)}
          </ul>
        </div>''']
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


def page(title, description, section, active, main, current_slug=None,
         noindex=False, header=None, script=True, lang="de", js=None):
    """header=None nimmt die normale Navigation; die Verwaltungsseite reicht
    stattdessen eine schlichte Kopfzeile herein, laesst das Skript weg und
    steht auf Koreanisch (lang="ko") - sie richtet sich an die Kuenstlerin.

    js nimmt ein zusaetzliches Skript nur fuer diese eine Seite auf. Der Editor
    laeuft bewusst ohne site.js: dessen Tastenfang nimmt Strg+S weg (site.js,
    Abschnitt Bildschutz), und das waere im Editor gerade die falsche Taste."""
    body_attr = f' data-section="{section}"' if section else ""
    robots = '\n<meta name="robots" content="noindex, nofollow">' if noindex else ""
    head = masthead(active, current_slug) if header is None else header
    tail = f'\n  <script src="{asset("site.js")}"></script>\n' if script else ""
    if js:
        tail += f'  <script src="{asset(js)}"></script>\n'
    return f"""<!doctype html>
<html lang="{lang}" data-lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{e(description)}">{robots}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONT}" rel="stylesheet">
<link rel="stylesheet" href="{asset("site.css")}">
</head>
<body{body_attr}>

{head}

{main}
{tail}</body>
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


def detail_href(w):
    return f"werk-{w['slug']}.html"


def alt(w):
    return f"{e(w['title'])}, {w['year_label']} — Boram Park"


# --------------------------------------------------------------- index.html
lead = works[0]
cover = site.get("cover_image") or (block_images(lead) or [{"src": ""}])[0]["src"]
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
  </main>"""

home_desc = (f"Boram Park — {tag_de}. Arbeiten, Biografie und Kontakt." if tag_de
             else "Boram Park — Arbeiten, Biografie und Kontakt.")
write("index.html", page("Boram Park — Portfolio", home_desc, "", "", index_main))

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
# Eine Arbeit ist eine Folge von Bloecken: Zeilen mit Zellen (Bild oder Text)
# und ausdrueckliche Leerraeume dazwischen. Die Zuordnung Block -> HTML steht
# doppelt - bei Aenderungen beide anfassen:
#   hier (erzeugt die Seite) und assets/admin-layout.js (zeigt dasselbe im Editor)
GAP_DEFAULT = 16
NL = "\n"


def cell_html(cell, w):
    """Eine Zelle: Bild mit optionaler Bildunterschrift, oder Text."""
    # Das Verhaeltnis steht als fr-Wert in --cols der Zeile; die Zelle selbst
    # braucht es nicht noch einmal.
    style = {}

    if cell.get("t") == "img":
        # fill = Anteil der Zelle, den das Bild einnimmt (100 = ganze Zelle).
        # Getrennt vom Spaltenverhaeltnis: das teilt die Zeile auf, fill sagt,
        # wie viel davon das Bild davon braucht.
        fill = as_int(cell.get("fill"), 10, 100)
        style["w"] = None if fill is None else f"{fill}%"
        # Deckel gegen Hochskalieren - greift nur bei zu kleinen Dateien
        natural = SIZES.get(rel(cell["src"]))
        style["max"] = f"{natural[0]}px" if natural else None
        align = as_align(cell.get("align"))
        mark = f' data-align="{align}"' if align else ""
        cap = ""
        if cell.get("caption_de"):
            cde = cell["caption_de"]
            cen = cell.get("caption_en") or cde
            cap = (NL + f'        <figcaption data-de="{e(cde)}" data-en="{e(cen)}">'
                   f'{e(cde)}</figcaption>')
        img = f'{rel(cell["src"])}'
        return (f'      <figure class="work-cell"{mark}{style_attr(**style)}>' + NL
                + f'        <img src="{img}"{dims(cell["src"])} '
                  f'loading="lazy" alt="{alt(w)}">{cap}' + NL
                + '      </figure>')

    de = (cell.get("de") or "").strip()
    en = (cell.get("en") or "").strip() or de
    align = as_align(cell.get("align"))
    mark = f' data-align="{align}"' if align else ""
    if not de:
        return f'      <div class="work-cell"{mark}{style_attr(**style)}></div>'
    return (f'      <div class="work-cell"{mark}{style_attr(**style)}>' + NL
            + f'        <p class="work-text" data-de="{e(de)}" data-en="{e(en)}">'
              f'{e(de)}</p>' + NL
            + '      </div>')


def block_html(block, w):
    if block["t"] == "gap":
        return f'    <div class="work-space" style="--h: {block["h"]}px"></div>'
    gap = as_int(block.get("gap"), 0, 400)
    gap = GAP_DEFAULT if gap is None else gap
    cols = " ".join(str(as_int(c.get("w"), 1, 100) or 1) + "fr" for c in block["cells"])
    mark = ' data-va="center"' if block.get("va") == "center" else ""
    cells = NL.join(cell_html(c, w) for c in block["cells"])
    return (f'    <div class="work-row"{mark} style="--gap: {gap}px; --cols: {cols}">' + NL
            + cells + NL + '    </div>')


for w in works:
    body = NL.join(block_html(b, w) for b in w["blocks"])
    main = f"""  <main>
    <header class="page-head">
      <h1 data-de="{e(w['title'])}" data-en="{e(w['title_en'])}">{e(w['title'])}</h1>
      <p class="work-meta" data-de="{e(meta_line(w, 'de'))}" data-en="{e(meta_line(w, 'en'))}">{e(meta_line(w, 'de'))}</p>
    </header>

    <div class="work-blocks">
{body}
    </div>
  </main>"""

    first_text = block_text(w, "de")
    desc = first_text[:150] if first_text else meta_line(w, "de")
    write(detail_href(w), page(f"{e(w['title'])} — Boram Park", desc,
                               "work", "", main, current_slug=w["slug"]))

# ------------------------------------------------------------- admin.html
# Interne Uebersicht fuer die Kuenstlerin: ein Weg ins Pages CMS, der Stand des
# letzten Aufbaus und eine Liste aller Seiten. Bewusst ohne Navigation, ohne
# Sprachumschalter und mit noindex - sie gehoert nicht zum Portfolio.
ADMIN_HEADER = """  <nav class="masthead" aria-label="Kopfzeile">
    <div class="masthead-bar">
      <a class="nav-logo" href="index.html">Boram Park</a>
    </div>
  </nav>"""

BADGE = f"https://github.com/{REPO}/actions/workflows/{WORKFLOW}"


def admin_row(title, meta, href, edit=None):
    extra = (f'\n          <a class="admin-row-link" href="{edit}">편집</a>'
             if edit else "")
    return f"""        <div class="admin-row">
          <span class="admin-row-title">{e(title)}</span>
          <span class="admin-row-meta">{e(meta)}</span>
          <span class="admin-row-links">
            <a class="admin-row-link" href="{href}">보기</a>{extra}
          </span>
        </div>"""


work_rows = "\n".join(
    admin_row(sub_label(w, "de"),
              f"{w['year_label']} · 이미지 {len(block_images(w))}장",
              detail_href(w), edit=f"admin-layout.html?w={w['slug']}")
    for w in works)

other_rows = "\n".join([
    admin_row("약력",
              f"학력 {len(artist['education'])}건, "
              f"전시 {len(artist['exhibitions'])}건",
              "biography.html"),
    admin_row("연락처", artist.get("email", ""), "contact.html"),
    admin_row("홈", "표지 이미지와 이름 아래 문구", "index.html"),
])

admin_main = f"""  <main>
    <header class="page-head">
      <h1>관리</h1>
      <p class="admin-lead">작가용 내부 페이지입니다. 메뉴에 없고 검색에도 잡히지 않습니다.
        이 주소를 아는 사람만 볼 수 있습니다. 내용을 고치려면 GitHub 로그인이 필요하므로,
        페이지가 보인다고 해서 남이 수정할 수는 없습니다.</p>
    </header>

    <div class="admin-block">
      <a class="admin-button" href="{CMS_URL}">사이트 편집하기</a>
      <p class="admin-note">GitHub 계정으로 로그인합니다. 작품, 이미지, 약력, 홈 화면을
        모두 폼으로 고칠 수 있습니다. 코드는 볼 일이 없습니다.</p>
    </div>

    <section class="admin-block">
      <h2 class="admin-heading">사이트 상태</h2>
      <a href="{BADGE}"><img class="admin-badge" src="{BADGE}/badge.svg"
        alt="마지막 업데이트 상태" width="164" height="20"></a>
      <p class="admin-note">저장하고 1~2분이 지나면 사이트에 반영됩니다.
        여기가 <em>passing</em>이면 정상입니다. <em>failing</em>이면 문제가 생긴 것이니
        알려주세요.</p>
    </section>

    <section class="admin-block">
      <h2 class="admin-heading">작품 <span class="admin-row-meta">{len(works)}</span></h2>
      <div class="admin-list">
{work_rows}
      </div>
      <p class="admin-note">연도 뒤 숫자는 그 작품 페이지에 실린 이미지 장수입니다.
        업로드가 제대로 들어갔는지 여기서 확인하세요.</p>
    </section>

    <section class="admin-block">
      <h2 class="admin-heading">다른 페이지</h2>
      <div class="admin-list">
{other_rows}
      </div>
    </section>
  </main>"""

write("admin.html", page("관리 — Boram Park", "작가용 내부 페이지.",
                         "", "", admin_main,
                         noindex=True, header=ADMIN_HEADER, script=False, lang="ko"))



# --------------------------------------------------------- admin-layout.html
# Der Editor. Die Werkliste steht hier im HTML und nicht im Skript: so ist sie
# zugleich die erlaubte Liste. Aus "?w=" wird nie ein Pfad gebaut, sondern nur
# ein Eintrag dieser Liste ausgewaehlt.
layout_options = "\n".join(
    f'          <option value="{w["slug"]}" data-path="content/works/{w["slug"]}.json" '
    f'data-page="{detail_href(w)}">{e(sub_label(w, "de"))}</option>'
    for w in works)

TOKEN_URL = (f"https://github.com/settings/personal-access-tokens/new")

layout_main = f"""  <main class="layout-main">
    <div class="layout-bar">
      <select id="werk" class="layout-select" aria-label="작품">
{layout_options}
      </select>
      <span class="layout-state" id="zustand">불러오는 중…</span>
      <div class="layout-lang" role="group" aria-label="Sprache">
        <button type="button" data-set-lang="de" aria-pressed="true">DE</button>
        <button type="button" data-set-lang="en" aria-pressed="false">EN</button>
      </div>
      <a class="layout-link" href="{CMS_URL}">사진 올리러 가기</a>
      <button type="button" class="layout-save" id="speichern" disabled>저장</button>
    </div>

    <div class="layout-stage">
      <div class="work-blocks" id="buehne" data-repo="{REPO}"></div>
    </div>

    <p class="layout-check" id="pruefung"></p>

    <details class="lay-key" id="schluessel">
      <summary>저장용 열쇠 <span class="lay-key-stand">열쇠 없음 — 지금은 보기만 됩니다</span></summary>
      <div class="lay-key-body">
        <p>저장하려면 GitHub 열쇠가 한 번 필요합니다. 이 브라우저에만 저장되고,
          사이트나 저장소에는 들어가지 않습니다.
          <strong>공용 컴퓨터에서는 쓰지 마세요.</strong></p>
        <p class="lay-key-zeile">
          <input type="password" class="lay-key-feld" autocomplete="off"
                 spellcheck="false" placeholder="열쇠를 붙여넣으세요">
          <button type="button" class="lay-key-save">등록</button>
          <button type="button" class="lay-key-weg">지우기</button>
        </p>
        <p class="lay-key-hilfe">열쇠가 만료되었을 때만 새로 만들면 됩니다 —
          <a href="{TOKEN_URL}">새 열쇠 만들기</a> →
          Repository access는 <em>Only select repositories</em>에서 이 저장소,
          Permissions는 <em>Contents: Read and write</em> 하나만 켭니다.</p>
      </div>
    </details>

    <noscript><p class="layout-note">이 화면은 자바스크립트가 필요합니다.
      <a href="admin.html">관리 화면으로 돌아가기</a></p></noscript>
  </main>"""

write("admin-layout.html", page("배치 — Boram Park", "작가용 내부 페이지.",
                                "layout", "", layout_main, noindex=True,
                                header=ADMIN_HEADER, script=False, lang="ko",
                                js="admin-layout.js"))

# die fruehere Uebersichtsseite gibt es nicht mehr
old_index = os.path.join(SITE, "work.html")
if os.path.exists(old_index):
    os.remove(old_index)
    print("entfernt: work.html")

# Detailseiten geloeschter Arbeiten entfernen
keep = {detail_href(w) for w in works}
for path in glob.glob(os.path.join(SITE, "werk-*.html")):
    name = os.path.basename(path)
    if name not in keep:
        os.remove(path)
        print("entfernt:", name)

print("Seiten geschrieben:", 3 + len(works))
