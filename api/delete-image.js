// Loescht ein Foto unter content/images/.
//
// Nur, wenn es nirgends mehr steckt: weder in einer Arbeit noch als Titelbild
// der Startseite. Das prueft diese Funktion selbst am Stand auf GitHub - die
// Fotoverwaltung zeigt es zwar auch an, aber die kennt nur den letzten Deploy.
//
// Die Fassung unter _web/ und die Masse in _sizes.json raeumt die Action beim
// naechsten Bauen von selbst weg (scripts/prepare-images.py). Weg ist das Foto
// nur aus dem aktuellen Stand; in der Versionsgeschichte bleibt es.
const { REPO, token } = require('./_lib.js');

const ENDUNG = /\.(jpe?g|png|webp)$/i;
const GH = 'https://api.github.com/repos/' + REPO + '/contents/';

function relSrc(src) { return String(src || '').replace(/^\/+/, ''); }

// Ordner- und Dateinamen stammen teils noch aus der Zeit vor dem Editor und
// tragen Umlaute, Hangul oder Leerzeichen - jedes Stueck einzeln kodieren.
function url(pfad) {
  return GH + pfad.split('/').map(encodeURIComponent).join('/');
}

function erlaubt(pfad) {
  if (pfad.length > 300 || !pfad.startsWith('content/images/')) return false;
  const teile = pfad.split('/');
  if (teile.some(function (t) { return !t || t === '.' || t === '..' || t.startsWith('_'); })) {
    return false;                          // auch _web/ und _sizes.json
  }
  return !/[\\\0]/.test(pfad) && ENDUNG.test(pfad);
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ fehler: 'nur POST' }); return; }

  const zugang = token(req);
  if (!zugang) { res.status(401).json({ fehler: 'anmelden' }); return; }

  let k;
  try {
    k = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (e) {
    res.status(400).json({ fehler: 'daten' }); return;
  }
  const pfad = relSrc(k.pfad);
  if (!erlaubt(pfad)) { res.status(400).json({ fehler: 'pfad' }); return; }

  const kopf = { Authorization: 'Bearer ' + zugang, Accept: 'application/vnd.github+json',
                 'User-Agent': 'boram-park-editor', 'X-GitHub-Api-Version': '2022-11-28' };
  const roh = Object.assign({}, kopf, { Accept: 'application/vnd.github.raw+json' });

  try {
    // Wer benutzt das Foto noch?
    const liste = await fetch(GH + 'content/works?ref=main', { headers: kopf });
    if (liste.status === 401) { res.status(401).json({ fehler: 'anmelden' }); return; }
    if (!liste.ok) { res.status(liste.status).json({ fehler: 'lesen' }); return; }
    const dateien = (await liste.json()).filter(function (f) {
      return f.type === 'file' && /\.json$/.test(f.name);
    });

    const benutzt = [];
    await Promise.all(dateien.map(async function (f) {
      const r = await fetch(url(f.path) + '?ref=main', { headers: roh });
      if (!r.ok) throw new Error('lesen');
      const w = JSON.parse(await r.text());
      const drin = (Array.isArray(w.blocks) ? w.blocks : []).some(function (b) {
        return b && Array.isArray(b.cells) && b.cells.some(function (c) {
          return c && relSrc(c.src) === pfad;
        });
      });
      if (drin) benutzt.push(w.title || f.name.replace(/\.json$/, ''));
    }));

    const seite = await fetch(GH + 'content/site.json?ref=main', { headers: roh });
    if (seite.ok && relSrc(JSON.parse(await seite.text()).cover_image) === pfad) {
      benutzt.push('홈 표지');
    }
    if (benutzt.length) {
      res.status(409).json({ fehler: 'benutzt', wo: benutzt.sort() }); return;
    }

    // Den sha aus dem Ordner holen, nicht von der Datei selbst: Fotos ueber
    // 1 MB liefert die Contents-API ohne Inhalt, und grosse gar nicht.
    const ordner = pfad.slice(0, pfad.lastIndexOf('/'));
    const inhalt = await fetch(url(ordner) + '?ref=main', { headers: kopf });
    if (!inhalt.ok) { res.status(inhalt.status === 404 ? 404 : inhalt.status).json({ fehler: 'weg' }); return; }
    const datei = (await inhalt.json()).filter(function (f) { return f.path === pfad; })[0];
    if (!datei) { res.status(404).json({ fehler: 'weg' }); return; }

    const weg = await fetch(url(pfad), {
      method: 'DELETE', headers: kopf,
      body: JSON.stringify({
        message: 'Delete ' + pfad + ' (via Foto-Verwaltung)',   // nie [skip ci]
        sha: datei.sha, branch: 'main'
      })
    });
    if (weg.status === 409) { res.status(409).json({ fehler: 'konflikt' }); return; }
    if (!weg.ok) { res.status(weg.status).json({ fehler: 'loeschen' }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ fehler: 'server' });
  }
};
