# -*- coding: utf-8 -*-
"""content/works.json + content/artist.json -> Seiten im Repo-Root neu schreiben.

Aufruf: python scripts/wire-content.py
Schreibt index/work/biography/contact.html und werk-<slug>.html (12 Stueck).
Idempotent - mehrfaches Ausfuehren aendert nichts weiter.
"""
import json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = ROOT  # 사이트 페이지는 리포 루트에 있다
CONTENT = os.path.join(ROOT, "content")
REL = ""  # 페이지와 content/ 가 같은 루트

works = json.load(open(os.path.join(CONTENT, "works.json"), encoding="utf-8"))["works"]
artist = json.load(open(os.path.join(CONTENT, "artist.json"), encoding="utf-8"))
e = html.escape


def read(p):
    return open(os.path.join(SITE, p), encoding="utf-8").read()


def write(p, s):
    open(os.path.join(SITE, p), "w", encoding="utf-8", newline="\n").write(s)


def set_main(src, main_html):
    return re.sub(r"  <main>.*?</main>", main_html.rstrip(), src, count=1, flags=re.S)


def meta_line(w, lang):
    bits = [w["material_" + lang], w["medium_" + lang], w["year_label"]]
    return " · ".join(b for b in bits if b)


def meta_short(w, lang):
    bits = [w["material_" + lang], w["medium_" + lang]]
    return " · ".join(b for b in bits if b)


def detail_href(w):
    return f"werk-{w['slug']}.html"


# ---------------------------------------------------------------- work.html
items = []
for i, w in enumerate(works, 1):
    im = w["images"][0]
    med_de, med_en = meta_short(w, "de"), meta_short(w, "en")
    items.append(f"""      <a class="work-item" href="{detail_href(w)}">
        <img class="thumb" src="{REL}{im['src']}" width="{im['width']}" height="{im['height']}" loading="lazy" alt="{e(w['title'])}, {w['year_label']} — Boram Park">
        <div class="work-caption">
          <span class="work-year">{w['year_label']}</span>
          <span class="work-title" data-de="{e(w['title'])}" data-en="{e(w['title_en'])}">{e(w['title'])}</span>
        </div>
        <div class="work-medium" data-de="{e(med_de)}" data-en="{e(med_en)}">{e(med_de)}</div>
      </a>""")

work_main = "  <main>\n" + """    <header class="page-head">
      <h1 data-de="Work" data-en="Work">Work</h1>
    </header>

    <div class="work-grid">
""" + "\n".join(items) + """
    </div>
  </main>"""

src = read("work.html")
# thumbnails are now images, not placeholder boxes
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
# reveal delays for all works
delays = "\n".join(
    f"  .work-grid .work-item:nth-child({n}) {{ animation-delay: {0.05 * n:.2f}s; }}"
    for n in range(1, len(works) + 1))
src = re.sub(r"(?:  \.work-grid \.work-item:nth-child\(\d+\)[^\n]*\n)+", delays + "\n", src)
write("work.html", set_main(src, work_main))

# ------------------------------------------------------------- index.html
man = json.load(open(os.path.join(CONTENT, "images", "_manifest.json"), encoding="utf-8"))
cover = man["cover"][0]
cover = {"src": cover["file"], "width": cover["w"], "height": cover["h"]}
index_main = f"""  <main>
    <div class="home-hero">
      <h1 class="home-name">Boram Park</h1>
      <p class="home-tagline" data-de="Fotografie — Installation — Video" data-en="Photography — Installation — Video">Fotografie — Installation — Video</p>
    </div>

    <a class="hero-work" href="{detail_href(works[0])}">
      <img class="hero-thumb" src="{REL}{cover['src']}" width="{cover['width']}" height="{cover['height']}" alt="Häutung, 2025 — Boram Park">
      <div class="hero-caption">
        <span class="hero-year">{works[0]['year_label']}</span>
        <span class="hero-title" data-de="{e(works[0]['title'])}" data-en="{e(works[0]['title_en'])}">{e(works[0]['title'])}</span>
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

# --------------------------------------------------------- biography.html
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

stmt_de = ("Boram Park, geboren 1991 in Seoul, Südkorea. Sie studierte Bildhauerei an der Kyung Hee University "
           "in Seoul und studiert seit 2023 Freie Kunst an der Hochschule der Bildenden Künste Saar in Saarbrücken. "
           "Ihre Arbeiten bewegen sich zwischen Fotografie, Installation und Video und untersuchen die Grenze "
           "zwischen Material und Körper.")
stmt_en = ("Boram Park, born 1991 in Seoul, South Korea. She studied sculpture at Kyung Hee University in Seoul "
           "and has been studying Fine Arts at the Hochschule der Bildenden Künste Saar in Saarbrücken since 2023. "
           "Her work moves between photography, installation and video and examines the boundary between material "
           "and body.")

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

# ----------------------------------------------------------- contact.html
mail = artist["email"]
contact_main = f"""  <main>
    <header class="page-head">
      <h1 data-de="Contact" data-en="Contact">Contact</h1>
    </header>

    <div class="contact-block">
      <a class="contact-email" href="mailto:{mail}">{mail}</a>
      <p class="contact-note" data-de="Für Ausstellungsanfragen und Presse." data-en="For exhibition inquiries and press.">Für Ausstellungsanfragen und Presse.</p>
      <p class="contact-note" data-de="Boram Park — Saarbrücken, Deutschland" data-en="Boram Park — Saarbrücken, Germany">Boram Park — Saarbrücken, Deutschland</p>
    </div>
  </main>"""
src = read("contact.html")
src = re.sub(r'\s*<div class="contact-social">.*?</div>', "", src, count=1, flags=re.S)
write("contact.html", set_main(src, contact_main))

# ------------------------------------------------- werk-<slug>.html (detail)
base = read("work.html")
head, rest = base.split("</style>", 1)
extra_css = """
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
head = head + extra_css + "</style>"
body_rest = rest  # from </head> onwards

for idx, w in enumerate(works):
    parts = {p["image"]: p for p in w.get("parts", [])}
    figs = []
    for n, im in enumerate(w["images"], 1):
        cap = ""
        if n in parts:
            p = parts[n]
            cap = (f'\n        <figcaption data-de="{e(p["title"])} · {e(p["medium_de"])} · {p["year"]}"'
                   f' data-en="{e(p["title"])} · {e(p["medium_en"])} · {p["year"]}">'
                   f'{e(p["title"])} · {e(p["medium_de"])} · {p["year"]}</figcaption>')
        figs.append(f"""      <figure>
        <img src="{REL}{im['src']}" width="{im['width']}" height="{im['height']}" loading="lazy" alt="{e(w['title'])}, {w['year_label']} — Boram Park">{cap}
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

    page = head + body_rest
    page = set_main(page, main)
    page = page.replace("<title>Boram — Work</title>",
                        "<title>" + e(w["title"]) + " — Boram Park</title>", 1)
    write(detail_href(w), page)

print("pages written:", 4 + len(works))
