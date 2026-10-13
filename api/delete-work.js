// Loescht eine Arbeit: content/works/<slug>.json.
//
// Die Fotos bleiben liegen. Sie koennen in einer anderen Arbeit stecken, und
// weg ist weg - anders als die Arbeit selbst, die in der Versionsgeschichte
// steht und sich zurueckholen laesst.
const { REPO, token } = require('./_lib.js');

const SLUG = /^[a-z0-9-]{1,64}$/;

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ fehler: 'nur POST' }); return; }

  const zugang = token(req);
  if (!zugang) { res.status(401).json({ fehler: 'anmelden' }); return; }

  const k = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const slug = String(k.slug || '');
  if (!SLUG.test(slug)) { res.status(400).json({ fehler: 'slug' }); return; }

  const basis = 'https://api.github.com/repos/' + REPO + '/contents/';
  const kopf = { Authorization: 'Bearer ' + zugang, Accept: 'application/vnd.github+json',
                 'User-Agent': 'boram-park-editor', 'X-GitHub-Api-Version': '2022-11-28' };

  try {
    // Die letzte Arbeit darf nicht weg: scripts/wire-content.py bricht ab,
    // wenn content/works leer ist, und dann baut die Seite nicht mehr.
    const liste = await fetch(basis + 'content/works?ref=main', { headers: kopf });
    if (liste.status === 401) { res.status(401).json({ fehler: 'anmelden' }); return; }
    if (!liste.ok) { res.status(liste.status).json({ fehler: 'lesen' }); return; }
    const dateien = (await liste.json()).filter(function (f) {
      return f.type === 'file' && /\.json$/.test(f.name);
    });
    if (dateien.length <= 1) { res.status(409).json({ fehler: 'letzte' }); return; }

    const datei = dateien.filter(function (f) { return f.name === slug + '.json'; })[0];
    if (!datei) { res.status(404).json({ fehler: 'weg' }); return; }

    // Haengt die Startseite an dieser Arbeit, zeigt ihr Titelbild sonst ins
    // Leere. Lieber vorher dort umstellen lassen, als still etwas zu kappen.
    const seite = await fetch(basis + 'content/site.json?ref=main', { headers: kopf });
    if (seite.ok) {
      const inhalt = JSON.parse(Buffer.from((await seite.json()).content, 'base64').toString('utf8'));
      if (inhalt.cover_link_slug === slug) {
        res.status(409).json({ fehler: 'startseite' }); return;
      }
    }

    const weg = await fetch(basis + 'content/works/' + slug + '.json', {
      method: 'DELETE', headers: kopf,
      body: JSON.stringify({
        message: 'Delete content/works/' + slug + '.json (via Layout-Editor)',
        sha: datei.sha, branch: 'main'
      })
    });
    if (!weg.ok) { res.status(weg.status).json({ fehler: 'loeschen' }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ fehler: 'server' });
  }
};
