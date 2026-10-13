// Legt ein Foto unter content/images/<ordner>/<name> ab.
//
// Wie bei save.js gilt: der Zugang kommt aus dem Cookie und bleibt hier. Und
// die Schranke steht auf dem Servers - geschrieben wird ausschliesslich unter
// content/images, nur Bilddateien, nur mit geputztem Namen.
//
// Die Datei wird nicht veraendert. Das Verkleinern wurde bewusst abgeschafft
// (siehe scripts/prepare-images.py); was hochgeladen wird, geht so auf die
// Seite. Deshalb gibt es hier nur eine harte Grenze: Vercel nimmt hoechstens
// 4,5 MB im Rumpf einer Anfrage an, Base64 blaeht um ein Drittel auf.
const { REPO, token } = require('./_lib.js');

const MAX_BYTES = 3 * 1024 * 1024;        // mit Base64-Aufschlag unter 4,5 MB
const ORDNER = /^[a-z0-9-]{1,64}$/;
const TYPEN = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Erste Bytes der Datei gegen den angegebenen Typ halten - der Browser sagt
// nur, was er vermutet, und auf die Endung ist erst recht kein Verlass.
function istBild(buf, typ) {
  if (buf.length < 12) return false;
  if (typ === 'image/jpeg') return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  if (typ === 'image/png') {
    return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  }
  if (typ === 'image/webp') {
    return buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
           buf.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  return false;
}

// Aus dem Dateinamen wird ein ruhiger Name: keine Pfade, keine Umlaute, keine
// Leerzeichen. Die Endung kommt aus dem geprueften Typ, nicht aus dem Namen.
function putzen(name, endung) {
  const roh = String(name || '').split(/[\\/]/).pop().replace(/\.[^.]*$/, '');
  const basis = roh.normalize('NFKD').replace(/[^\w-]+/g, '-')
                   .replace(/^-+|-+$/g, '').slice(0, 60).toLowerCase();
  return (basis || 'foto') + endung;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ fehler: 'nur POST' }); return; }

  const zugang = token(req);
  if (!zugang) { res.status(401).json({ fehler: 'anmelden' }); return; }

  const k = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const ordner = String(k.ordner || '');
  const typ = String(k.typ || '');
  if (!ORDNER.test(ordner)) { res.status(400).json({ fehler: 'ordner' }); return; }
  if (!TYPEN[typ]) { res.status(400).json({ fehler: 'typ' }); return; }

  let buf;
  try {
    buf = Buffer.from(String(k.daten || ''), 'base64');
  } catch (e) {
    res.status(400).json({ fehler: 'daten' }); return;
  }
  if (!buf.length) { res.status(400).json({ fehler: 'leer' }); return; }
  if (buf.length > MAX_BYTES) {
    res.status(413).json({ fehler: 'gross', max: MAX_BYTES, ist: buf.length }); return;
  }
  if (!istBild(buf, typ)) { res.status(400).json({ fehler: 'kein-bild' }); return; }

  const name = putzen(k.name, TYPEN[typ]);
  const pfad = 'content/images/' + ordner + '/' + name;
  const api = 'https://api.github.com/repos/' + REPO + '/contents/' + pfad;
  const kopf = { Authorization: 'Bearer ' + zugang, Accept: 'application/vnd.github+json',
                 'User-Agent': 'boram-park-editor', 'X-GitHub-Api-Version': '2022-11-28' };

  try {
    // Liegt dort schon etwas, wird nichts ueberschrieben - sonst verschwindet
    // unbemerkt ein Foto, das eine andere Arbeit noch benutzt.
    const da = await fetch(api + '?ref=main', { headers: kopf });
    if (da.ok) { res.status(409).json({ fehler: 'vorhanden', pfad: '/' + pfad }); return; }
    if (da.status === 401) { res.status(401).json({ fehler: 'anmelden' }); return; }

    const schreiben = await fetch(api, {
      method: 'PUT', headers: kopf,
      body: JSON.stringify({
        message: 'Create ' + pfad + ' (via Layout-Editor)',   // nie [skip ci]
        content: buf.toString('base64'), branch: 'main'
      })
    });
    if (!schreiben.ok) { res.status(schreiben.status).json({ fehler: 'schreiben' }); return; }
    res.status(200).json({ ok: true, pfad: '/' + pfad });
  } catch (e) {
    res.status(500).json({ fehler: 'server' });
  }
};
