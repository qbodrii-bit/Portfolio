// Schreibt content/artist.json oder content/site.json zurueck.
//
// Dieselbe Schranke wie in save.js: der Zugang bleibt auf dem Server, und
// geschrieben wird nur, was hier beschrieben steht. Jedes Feld hat seinen
// Typ und seine Laenge; alles andere faellt weg, statt im Repo zu landen.
const { REPO, token } = require('./_lib.js');

function txt(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function jahr(v) {
  const n = Math.round(Number(v));
  return isFinite(n) && n >= 1000 && n <= 2999 ? n : null;
}

// Nur Felder, die der Editor auch anbietet. Reihenfolge wie bisher in den
// Dateien, damit der Unterschied klein bleibt.
const SEITEN = {
  artist: {
    pfad: 'content/artist.json',
    pruefen: function (d) {
      const o = {};
      o.name = txt(d.name, 120);
      const b = d.born && typeof d.born === 'object' ? d.born : {};
      const j = jahr(b.year);
      o.born = {};
      if (j !== null) o.born.year = j;
      o.born.place_de = txt(b.place_de, 120);
      o.born.place_en = txt(b.place_en, 120);
      o.email = txt(d.email, 160);
      o.place_de = txt(d.place_de, 200);
      o.place_en = txt(d.place_en, 200);
      o.statement_de = txt(d.statement_de, 4000);
      o.statement_en = txt(d.statement_en, 4000);
      o.contact_note_de = txt(d.contact_note_de, 400);
      o.contact_note_en = txt(d.contact_note_en, 400);

      if (!Array.isArray(d.education) || d.education.length > 50) return null;
      o.education = d.education.map(function (e) {
        return { period: txt(e && e.period, 40),
                 institution_de: txt(e && e.institution_de, 200),
                 institution_en: txt(e && e.institution_en, 200),
                 degree_de: txt(e && e.degree_de, 200),
                 degree_en: txt(e && e.degree_en, 200) };
      });

      if (!Array.isArray(d.exhibitions) || d.exhibitions.length > 200) return null;
      o.exhibitions = d.exhibitions.map(function (e) {
        const r = {};
        const y = jahr(e && e.year);
        if (y !== null) r.year = y;
        r.title = txt(e && e.title, 300);
        r.venue = txt(e && e.venue, 300);
        if (e && typeof e.source_note === 'string' && e.source_note) {
          r.source_note = e.source_note.slice(0, 300);     // interne Notiz, bleibt
        }
        return r;
      });
      return o;
    }
  },
  site: {
    pfad: 'content/site.json',
    pruefen: function (d) {
      const o = {};
      if (typeof d.cover_image === 'string' && d.cover_image) {
        if (d.cover_image.indexOf('..') >= 0 ||
            !/^\/content\/images\/[^<>"']{1,200}$/.test(d.cover_image)) return null;
        o.cover_image = d.cover_image;
      }
      o.cover_caption_title = txt(d.cover_caption_title, 200);
      o.cover_caption_title_en = txt(d.cover_caption_title_en, 200);
      o.cover_caption_year = txt(d.cover_caption_year, 40);
      if (typeof d.cover_link_slug === 'string' && d.cover_link_slug) {
        if (!/^[a-z0-9-]{1,64}$/.test(d.cover_link_slug)) return null;
        o.cover_link_slug = d.cover_link_slug;
      }
      o.tagline_de = txt(d.tagline_de, 300);
      o.tagline_en = txt(d.tagline_en, 300);
      return o;
    }
  }
};

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ fehler: 'nur POST' }); return; }

  const zugang = token(req);
  if (!zugang) { res.status(401).json({ fehler: 'anmelden' }); return; }

  const k = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const seite = SEITEN[String(k.seite || '')];
  if (!seite) { res.status(400).json({ fehler: 'seite' }); return; }

  const sauber = seite.pruefen(k.daten && typeof k.daten === 'object' ? k.daten : {});
  if (!sauber) { res.status(400).json({ fehler: 'form' }); return; }

  const api = 'https://api.github.com/repos/' + REPO + '/contents/' + seite.pfad;
  const kopf = { Authorization: 'Bearer ' + zugang, Accept: 'application/vnd.github+json',
                 'User-Agent': 'boram-park-editor', 'X-GitHub-Api-Version': '2022-11-28' };

  try {
    const holen = await fetch(api + '?ref=main', { headers: kopf });
    if (holen.status === 401) { res.status(401).json({ fehler: 'anmelden' }); return; }
    if (!holen.ok) { res.status(holen.status).json({ fehler: 'lesen' }); return; }
    const datei = await holen.json();
    const alt = Buffer.from(datei.content, 'base64').toString('utf8');

    // artist.json und site.json enden mit einem Zeilenumbruch, die Werkdateien
    // nicht. Den Stand uebernehmen, sonst taucht bei jedem Speichern die letzte
    // Zeile im Unterschied auf.
    const ende = alt.slice(-1) === '\n' ? '\n' : '';
    const neu = JSON.stringify(sauber, null, 2) + ende;
    if (neu === alt) { res.status(200).json({ ok: true, gleich: true }); return; }

    const schreiben = await fetch(api, {
      method: 'PUT', headers: kopf,
      body: JSON.stringify({
        message: 'Update ' + seite.pfad + ' (via Layout-Editor)',   // nie [skip ci]
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
