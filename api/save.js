// Schreibt eine Arbeit zurueck ins Repo. Der Token kommt aus dem Cookie und
// verlaesst den Server nie.
//
// Hier steht die eigentliche Schranke: egal was geschickt wird, geschrieben
// wird nur content/works/<slug>.json, und nur wenn der Inhalt wie eine Arbeit
// aussieht. Ein abhanden gekommenes Cookie kann damit das Layout einer Arbeit
// aendern - aber nicht das Repo umschreiben.
const { REPO, token } = require('./_lib.js');

const SLUG = /^[a-z0-9-]{1,64}$/;
const AUSSEN = ['order', 'title', 'title_en', 'year', 'year_label', 'material_de',
                'material_en', 'medium_de', 'medium_en', 'blocks'];

function zahl(v, lo, hi) {
  const n = Math.round(Number(v));
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}

// Prueft die Form, nicht den Geschmack: unbekannte Felder und falsche Typen
// fliegen raus, statt im Repo zu landen.
function saubereBloecke(roh) {
  if (!Array.isArray(roh) || roh.length > 200) return null;
  const out = [];
  for (const b of roh) {
    if (!b || typeof b !== 'object') return null;
    if (b.t === 'gap') {
      const h = zahl(b.h, 0, 400);
      if (h === null) return null;
      if (h) out.push({ t: 'gap', h: h });
    } else if (b.t === 'row') {
      if (!Array.isArray(b.cells) || !b.cells.length || b.cells.length > 8) return null;
      const zellen = [];
      for (const c of b.cells) {
        if (!c || typeof c !== 'object') return null;
        const z = {};
        if (c.t === 'img') {
          // Nur unterhalb von content/images, kein .. und keine Zeichen, die
          // aus dem Attribut ausbrechen koennten.
          if (typeof c.src !== 'string' || c.src.indexOf('..') >= 0 ||
              !/^\/content\/images\/[^<>"']{1,200}$/.test(c.src)) return null;
          z.t = 'img';
          z.src = c.src;
        } else if (c.t === 'text') {
          z.t = 'text';
          z.de = typeof c.de === 'string' ? c.de.slice(0, 4000) : '';
          z.en = typeof c.en === 'string' ? c.en.slice(0, 4000) : '';
        } else {
          return null;
        }
        const w = zahl(c.w, 1, 100);
        if (w !== null) z.w = w;
        const fill = zahl(c.fill, 10, 100);
        if (fill !== null) z.fill = fill;
        if (['left', 'center', 'right'].indexOf(c.align) >= 0) z.align = c.align;
        for (const k of ['caption_de', 'caption_en']) {
          if (typeof c[k] === 'string' && c[k]) z[k] = c[k].slice(0, 300);
        }
        zellen.push(z);
      }
      const zeile = { t: 'row', cells: zellen };
      const g = zahl(b.gap, 0, 400);
      if (g !== null) zeile.gap = g;
      if (b.va === 'center') zeile.va = 'center';
      out.push(zeile);
    } else {
      return null;
    }
  }
  return out;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ fehler: 'nur POST' }); return; }

  const zugang = token(req);
  if (!zugang) { res.status(401).json({ fehler: 'anmelden' }); return; }

  const koerper = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const slug = String(koerper.slug || '');
  if (!SLUG.test(slug)) { res.status(400).json({ fehler: 'slug' }); return; }

  const bloecke = saubereBloecke(koerper.blocks);
  if (!bloecke) { res.status(400).json({ fehler: 'form' }); return; }
  if (!bloecke.some(function (b) { return b.t === 'row'; })) {
    res.status(400).json({ fehler: 'leer' }); return;
  }

  const pfad = 'content/works/' + slug + '.json';
  const api = 'https://api.github.com/repos/' + REPO + '/contents/' + pfad;
  const kopf = { Authorization: 'Bearer ' + zugang, Accept: 'application/vnd.github+json',
                 'User-Agent': 'boram-park-editor', 'X-GitHub-Api-Version': '2022-11-28' };

  try {
    // Auf den frischen Stand aufsetzen, nicht blind ueberschreiben: Titel oder
    // Jahr koennten inzwischen woanders geaendert worden sein.
    const holen = await fetch(api + '?ref=main', { headers: kopf });
    if (holen.status === 401) { res.status(401).json({ fehler: 'anmelden' }); return; }
    if (!holen.ok) { res.status(holen.status).json({ fehler: 'lesen' }); return; }
    const datei = await holen.json();
    const alt = Buffer.from(datei.content, 'base64').toString('utf8');

    const arbeit = JSON.parse(alt);
    arbeit.blocks = bloecke;
    // Reihenfolge wie bisher, damit der Unterschied klein bleibt
    const sortiert = {};
    AUSSEN.forEach(function (k) { if (k in arbeit) sortiert[k] = arbeit[k]; });
    Object.keys(arbeit).forEach(function (k) { if (!(k in sortiert)) sortiert[k] = arbeit[k]; });

    const neu = JSON.stringify(sortiert, null, 2);     // = json.dumps(indent=2)
    if (neu === alt) { res.status(200).json({ ok: true, gleich: true }); return; }

    const schreiben = await fetch(api, {
      method: 'PUT', headers: kopf,
      body: JSON.stringify({
        message: 'Update ' + pfad + ' (via Layout-Editor)',   // nie [skip ci]
        content: Buffer.from(neu, 'utf8').toString('base64'),
        sha: datei.sha, branch: 'main'
      })
    });
    if (schreiben.status === 409 || schreiben.status === 422) {
      res.status(409).json({ fehler: 'konflikt' }); return;
    }
    if (!schreiben.ok) { res.status(schreiben.status).json({ fehler: 'schreiben' }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ fehler: 'server' });
  }
};
