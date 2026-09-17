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
         noindex=False, header=None, script=True, lang="de"):
    """header=None nimmt die normale Navigation; die Verwaltungsseite reicht
    stattdessen eine schlichte Kopfzeile herein, laesst das Skript weg und
    steht auf Koreanisch (lang="ko") - sie richtet sich an die Kuenstlerin."""
    body_attr = f' data-section="{section}"' if section else ""
    robots = '\n<meta name="robots" content="noindex, nofollow">' if noindex else ""
    head = masthead(active, current_slug) if header is None else header
    tail = f'\n  <script src="{asset("site.js")}"></script>\n' if script else ""
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
for w in works:
    layout = w.get("layout") or {}
    base_align = as_align(layout.get("align")) or "left"
    columns = as_int(layout.get("columns"), 1, 4) or 1
    gap = as_int(layout.get("gap"), 0, 400)
    text_gap = as_int(layout.get("text_gap"), 0, 400)
    gap_after = style_attr(gap_after=None if text_gap is None else f"{text_gap}px")

    figs = []
    for im in w["images"]:
        cap = ""
        if im.get("caption_de"):
            cde = im["caption_de"]
            cen = im.get("caption_en") or cde
            cap = f'\n        <figcaption data-de="{e(cde)}" data-en="{e(cen)}">{e(cde)}</figcaption>'
        # Groesse in Prozent der Originalbreite (100 = Originalgroesse);
        # ohne bekannte Pixelmasse ersatzweise Prozent der Spalte.
        pct = as_int(im.get("width"), 10, 100)
        natural = SIZES.get(rel(im["src"]))
        if pct is None:
            size_css = None
        elif natural:
            size_css = f"{round(natural[0] * pct / 100)}px"
        else:
            size_css = f"{pct}%"
        align = as_align(im.get("align")) or base_align
        mark = "" if align == "left" else f' data-align="{align}"'
        if columns > 1 and im.get("full_row"):
            mark += ' data-full-row="true"'
        figs.append(f"""      <figure{mark}{style_attr(w=size_css)}>
        <img src="{rel(im['src'])}"{dims(im['src'])} loading="lazy" alt="{alt(w)}">{cap}
      </figure>""")

    text_block = ""
    head_style = gap_after
    if w["text_de"]:
        text_block = (f'\n    <p class="work-text"{gap_after} data-de="{e(w["text_de"])}" '
                      f'data-en="{e(w["text_en"])}">{e(w["text_de"])}</p>\n')
        head_style = ""

    grid_cols = columns if columns > 1 else None
    grid_attr = f' data-columns="{columns}"' if columns > 1 else ""

    main = f"""  <main>
    <header class="page-head"{head_style}>
      <h1 data-de="{e(w['title'])}" data-en="{e(w['title_en'])}">{e(w['title'])}</h1>
      <p class="work-meta" data-de="{e(meta_line(w, 'de'))}" data-en="{e(meta_line(w, 'en'))}">{e(meta_line(w, 'de'))}</p>
    </header>
{text_block}
    <div class="work-figures"{grid_attr}{style_attr(gap=None if gap is None else f"{gap}px", cols=grid_cols)}>
{chr(10).join(figs)}
    </div>
  </main>"""

    desc = w["text_de"][:150] if w["text_de"] else meta_line(w, "de")
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


def admin_row(title, meta, href):
    return f"""        <div class="admin-row">
          <span class="admin-row-title">{e(title)}</span>
          <span class="admin-row-meta">{e(meta)}</span>
          <a class="admin-row-link" href="{href}">보기</a>
        </div>"""


work_rows = "\n".join(
    admin_row(sub_label(w, "de"),
              f"{w['year_label']} · 이미지 {len(w['images'])}장",
              detail_href(w))
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
