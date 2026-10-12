// Schritt 2: GitHub schickt einen Code zurueck, der hier gegen einen Token
// getauscht wird. Der Token geht nicht an die Seite, sondern verschluesselt in
// ein HttpOnly-Cookie - Seiten-JavaScript kann ihn damit nicht lesen.
const { COOKIE, REPO, packen, kekse, setzen } = require('./_lib.js');

module.exports = async function (req, res) {
  const url = new URL(req.url, 'https://' + req.headers.host);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';

  if (!code || !state || state !== kekse(req).bp_state) {
    res.status(400).send('Anmeldung abgelaufen. Noch einmal versuchen.');
    return;
  }
  setzen(res, 'bp_state', '', 0);

  try {
    const antwort = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GH_CLIENT_ID,
        client_secret: process.env.GH_CLIENT_SECRET,
        code: code,
        redirect_uri: 'https://' + req.headers.host + '/api/callback'
      })
    });
    const daten = await antwort.json();
    if (!daten.access_token) {
      res.status(400).send('GitHub hat keinen Zugang erteilt: ' + (daten.error || '?'));
      return;
    }

    const kopf = { Authorization: 'Bearer ' + daten.access_token,
                   Accept: 'application/vnd.github+json',
                   'User-Agent': 'boram-park-editor' };

    // Prueft gleich, ob dieser Mensch ueberhaupt in das Repo schreiben darf.
    // Sonst koennte sich jeder GitHub-Nutzer anmelden und bekaeme zwar nichts
    // geschrieben, aber eine Sitzung - besser hier abweisen.
    const pruef = await fetch('https://api.github.com/repos/' + REPO, { headers: kopf });
    const repo = pruef.ok ? await pruef.json() : null;
    if (!repo || !repo.permissions || !repo.permissions.push) {
      res.status(403).send('이 계정으로는 이 사이트를 고칠 수 없습니다.');
      return;
    }

    const ich = await fetch('https://api.github.com/user', { headers: kopf });
    const wer = ich.ok ? (await ich.json()).login || 'ok' : 'ok';

    setzen(res, COOKIE, packen(daten.access_token), 60 * 60 * 24 * 365);
    // Ein zweites, bewusst lesbares Cookie nur fuer die Anzeige "angemeldet".
    // Es enthaelt keinen Zugang, nur den Namen.
    res.setHeader('Set-Cookie', [].concat(res.getHeader('Set-Cookie') || []).concat(
      'bp_wer=' + encodeURIComponent(wer) +
      '; Path=/; Secure; SameSite=Lax; Max-Age=' + 60 * 60 * 24 * 365));

    res.writeHead(302, { Location: '/admin-layout.html' });
    res.end();
  } catch (e) {
    res.status(500).send('Anmeldung fehlgeschlagen.');
  }
};
