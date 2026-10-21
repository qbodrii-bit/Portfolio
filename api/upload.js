// Legt ein Foto unter content/images/<ordner>/<name> ab.
//
// Wie bei save.js gilt: der Zugang kommt aus dem Cookie und bleibt hier. Und
// die Schranke steht auf dem Server - geschrieben wird ausschliesslich unter
// content/images, nur Bilddateien, nur mit geputztem Namen.
//
// Die Datei wird nicht veraendert; was hochgeladen wird, liegt Byte fuer Byte
// im Repo. Vercel nimmt aber hoechstens 4,5 MB im Rumpf einer Anfrage an, und
// Originale aus der Kamera sind groesser. Deshalb kommt ein Foto in Stuecken:
//
//   { schritt: 'teil', daten }            -> ein Git-Blob pro Stueck, Antwort { sha }
//   { schritt: 'fertig', ordner, name, typ, teile: [sha, ...] }
//                                         -> Stuecke bei GitHub abholen,
//                                            zusammensetzen, ein Commit
//
// Die Stueck-Blobs haengen an keinem Commit; GitHub raeumt sie selbst weg.
// Abholen ist nicht an die 4,5 MB gebunden - die gelten nur fuer das, was der
// Browser schickt.
const { REPO, token } = require('./_lib.js');

const TEIL_MAX = 3 * 1024 * 1024;         // mit Base64-Aufschlag unter 4,5 MB
const GESAMT_MAX = 40 * 1024 * 1024;
const TEILE_MAX = Math.ceil(GESAMT_MAX / (2 * 1024 * 1024)) + 1;
const ORDNER = /^[a-z0-9-]{1,64}$/;
const SHA = /^[0-9a-f]{40}$/;
const TYPEN = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const GH = 'https://api.github.com/repos/' + REPO;

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

function gh(zugang, pfad, methode, koerper) {
  return fetch(GH + pfad, {
    method: methode || 'GET',
    headers: { Authorization: 'Bearer ' + zugang, Accept: 'application/vnd.github+json',
               'User-Agent': 'boram-park-editor', 'X-GitHub-Api-Version': '2022-11-28' },
    body: koerper ? JSON.stringify(koerper) : undefined
  });
}

// Ein Fehler von GitHub wird mit seinem Status weitergereicht; 401 heisst
// immer "neu anmelden".
function abbruch(res, antwort, fehler) {
  if (antwort.status === 401) res.status(401).json({ fehler: 'anmelden' });
  else res.status(antwort.status >= 400 ? antwort.status : 502).json({ fehler: fehler });
}

async function teil(req, res, zugang, k) {
  const buf = Buffer.from(String(k.daten || ''), 'base64');
  if (!buf.length) { res.status(400).json({ fehler: 'leer' }); return; }
  if (buf.length > TEIL_MAX) { res.status(413).json({ fehler: 'gross' }); return; }

  const blob = await gh(zugang, '/git/blobs', 'POST',
                        { content: buf.toString('base64'), encoding: 'base64' });
  if (!blob.ok) { abbruch(res, blob, 'teil'); return; }
  res.status(200).json({ sha: (await blob.json()).sha });
}

async function fertig(req, res, zugang, k) {
  const ordner = String(k.ordner || '');
  const typ = String(k.typ || '');
  const teile = Array.isArray(k.teile) ? k.teile.map(String) : [];
  if (!ORDNER.test(ordner)) { res.status(400).json({ fehler: 'ordner' }); return; }
  if (!TYPEN[typ]) { res.status(400).json({ fehler: 'typ' }); return; }
  if (!teile.length || teile.length > TEILE_MAX || !teile.every(function (s) { return SHA.test(s); })) {
    res.status(400).json({ fehler: 'teile' }); return;
  }

  const name = putzen(k.name, TYPEN[typ]);
  const pfad = 'content/images/' + ordner + '/' + name;

  // Liegt dort schon etwas, wird nichts ueberschrieben - sonst verschwindet
  // unbemerkt ein Foto, das eine andere Arbeit noch benutzt.
  const da = await gh(zugang, '/contents/' + encodeURI(pfad) + '?ref=main');
  if (da.ok) { res.status(409).json({ fehler: 'vorhanden', pfad: '/' + pfad }); return; }
  if (da.status === 401) { res.status(401).json({ fehler: 'anmelden' }); return; }

  const stuecke = [];
  let summe = 0;
  for (const sha of teile) {
    const b = await gh(zugang, '/git/blobs/' + sha);
    if (!b.ok) { abbruch(res, b, 'teil-fehlt'); return; }
    const buf = Buffer.from((await b.json()).content || '', 'base64');
    summe += buf.length;
    if (summe > GESAMT_MAX) { res.status(413).json({ fehler: 'gross', max: GESAMT_MAX }); return; }
    stuecke.push(buf);
  }
  const ganz = Buffer.concat(stuecke);
  if (!istBild(ganz, typ)) { res.status(400).json({ fehler: 'kein-bild' }); return; }

  const blob = await gh(zugang, '/git/blobs', 'POST',
                        { content: ganz.toString('base64'), encoding: 'base64' });
  if (!blob.ok) { abbruch(res, blob, 'schreiben'); return; }
  const blobSha = (await blob.json()).sha;

  // Commit von Hand ueber die Git-Daten-API: die Contents-API will die ganze
  // Datei in einem Rumpf und ist fuer grosse Dateien nicht gedacht. Schiebt
  // die Action dazwischen einen Commit, ist der Ref kein Vorlauf mehr - dann
  // auf dem neuen Stand noch einmal.
  for (let versuch = 0; versuch < 3; versuch++) {
    const ref = await gh(zugang, '/git/ref/heads/main');
    if (!ref.ok) { abbruch(res, ref, 'schreiben'); return; }
    const kopf = (await ref.json()).object.sha;
    const commit = await gh(zugang, '/git/commits/' + kopf);
    if (!commit.ok) { abbruch(res, commit, 'schreiben'); return; }
    const basis = (await commit.json()).tree.sha;

    const baum = await gh(zugang, '/git/trees', 'POST', {
      base_tree: basis,
      tree: [{ path: pfad, mode: '100644', type: 'blob', sha: blobSha }]
    });
    if (!baum.ok) { abbruch(res, baum, 'schreiben'); return; }
    const neu = await gh(zugang, '/git/commits', 'POST', {
      message: 'Create ' + pfad + ' (via Layout-Editor)',   // nie [skip ci]
      tree: (await baum.json()).sha,
      parents: [kopf]
    });
    if (!neu.ok) { abbruch(res, neu, 'schreiben'); return; }

    const schieben = await gh(zugang, '/git/refs/heads/main', 'PATCH',
                              { sha: (await neu.json()).sha, force: false });
    if (schieben.ok) { res.status(200).json({ ok: true, pfad: '/' + pfad }); return; }
    if (schieben.status !== 422) { abbruch(res, schieben, 'schreiben'); return; }
  }
  res.status(409).json({ fehler: 'konflikt' });
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

  try {
    if (k.schritt === 'teil') await teil(req, res, zugang, k);
    else if (k.schritt === 'fertig') await fertig(req, res, zugang, k);
    else res.status(400).json({ fehler: 'schritt' });
  } catch (e) {
    res.status(500).json({ fehler: 'server' });
  }
};
