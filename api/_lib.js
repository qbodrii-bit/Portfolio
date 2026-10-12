// Gemeinsames fuer die drei Funktionen unter api/.
// Nur Node-Bordmittel, keine Abhaengigkeiten - das Repo hat bewusst keine
// package.json, damit Vercel die Seite weiter als reine statische Seite baut.
const crypto = require('crypto');

const COOKIE = 'bp_sitzung';
const REPO = 'qbodrii-bit/Portfolio';

function schluessel() {
  const roh = process.env.COOKIE_SECRET || '';
  if (roh.length < 16) throw new Error('COOKIE_SECRET fehlt');
  return crypto.createHash('sha256').update(roh).digest();   // 32 Byte fuer AES-256
}

// Der GitHub-Token liegt verschluesselt im Cookie. HttpOnly haelt ihn aus dem
// Seiten-JavaScript heraus; die Verschluesselung macht ihn auch dort unlesbar,
// wo Cookies sonst im Klartext liegen (Browserprofil, Protokolle).
function packen(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', schluessel(), iv);
  const daten = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), daten]).toString('base64url');
}

function auspacken(wert) {
  try {
    const roh = Buffer.from(String(wert), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', schluessel(), roh.subarray(0, 12));
    d.setAuthTag(roh.subarray(12, 28));
    return Buffer.concat([d.update(roh.subarray(28)), d.final()]).toString('utf8');
  } catch (e) {
    return '';
  }
}

function kekse(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function (teil) {
    const i = teil.indexOf('=');
    if (i > 0) out[teil.slice(0, i).trim()] = decodeURIComponent(teil.slice(i + 1).trim());
  });
  return out;
}

function setzen(res, name, wert, sekunden) {
  const teile = [name + '=' + encodeURIComponent(wert), 'Path=/', 'HttpOnly', 'Secure',
                 'SameSite=Lax', 'Max-Age=' + sekunden];
  const alt = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', (alt ? [].concat(alt) : []).concat(teile.join('; ')));
}

function token(req) {
  const k = kekse(req)[COOKIE];
  return k ? auspacken(k) : '';
}

module.exports = { COOKIE, REPO, packen, auspacken, kekse, setzen, token };
