// Legt eine neue Arbeit an: content/works/<slug>.json.
//
// Sie startet mit einer leeren Textzeile. Alles weitere - Bilder, Aufteilung,
// Abstaende - macht die Kuenstlerin danach im Editor.
const { REPO, token } = require('./_lib.js');

const SLUG = /^[a-z0-9-]{1,64}$/;

function txt(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// Aus dem deutschen Titel wird der Dateiname. Umlaute werden ausgeschrieben,
// wie bei den bestehenden Arbeiten auch (Übergabe -> uebergabe,
// Häutung · Kleiderbügel -> haeutung-kleiderbuegel).
function slugAus(titel) {
  return String(titel || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ fehler: 'nur POST' }); return; }

  const zugang = token(req);
  if (!zugang) { res.status(401).json({ fehler: 'anmelden' }); return; }

  const k = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const titel = txt(k.title, 200);
  if (!titel) { res.status(400).json({ fehler: 'titel' }); return; }

  const jahr = Math.round(Number(k.year));
  if (!isFinite(jahr) || jahr < 1900 || jahr > 2999) {
    res.status(400).json({ fehler: 'jahr' }); return;
  }

  const ordnung = Math.round(Number(k.order));

  // Mehrere Arbeiten teilen sich einen Titel - die vier "Haeutung" etwa
  // unterscheiden sich nur im Material. Aus dem Titel allein entstuende
  // derselbe Dateiname. Deshalb kann ein unterscheidendes Wort dazukommen,
  // genau wie bei den bestehenden Dateien (haeutung-kleiderbuegel).
  const zusatz = txt(k.suffix, 60);
  const slug = slugAus(zusatz ? titel + ' ' + zusatz : titel);
  if (!SLUG.test(slug)) { res.status(400).json({ fehler: 'slug' }); return; }

  const arbeit = {
    order: isFinite(ordnung) && ordnung >= 1 && ordnung <= 999 ? ordnung : 1,
    title: titel,
    title_en: txt(k.title_en, 200) || titel,
    year: jahr,
    year_label: String(jahr),
    material_de: '', material_en: '',
    medium_de: '', medium_en: '',
    blocks: [{ t: 'row', cells: [{ t: 'text', de: '', en: '' }] }]
  };

  const pfad = 'content/works/' + slug + '.json';
  const api = 'https://api.github.com/repos/' + REPO + '/contents/' + pfad;
  const kopf = { Authorization: 'Bearer ' + zugang, Accept: 'application/vnd.github+json',
                 'User-Agent': 'boram-park-editor', 'X-GitHub-Api-Version': '2022-11-28' };

  try {
    // Nichts ueberschreiben - bei gleichem Titel entstuende sonst derselbe
    // Dateiname und die bestehende Arbeit waere weg.
    const da = await fetch(api + '?ref=main', { headers: kopf });
    if (da.ok) { res.status(409).json({ fehler: 'vorhanden', slug: slug }); return; }
    if (da.status === 401) { res.status(401).json({ fehler: 'anmelden' }); return; }

    const text = JSON.stringify(arbeit, null, 2);     // = json.dumps(indent=2)
    const schreiben = await fetch(api, {
      method: 'PUT', headers: kopf,
      body: JSON.stringify({
        message: 'Create ' + pfad + ' (via Layout-Editor)',   // nie [skip ci]
        content: Buffer.from(text, 'utf8').toString('base64'), branch: 'main'
      })
    });
    if (!schreiben.ok) { res.status(schreiben.status).json({ fehler: 'schreiben' }); return; }
    res.status(200).json({ ok: true, slug: slug });
  } catch (e) {
    res.status(500).json({ fehler: 'server' });
  }
};
