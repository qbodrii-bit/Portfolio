// Abmelden: beide Cookies raeumen. Das eigentliche Zugangs-Cookie ist HttpOnly,
// deshalb kann nur der Server es loeschen.
const { COOKIE } = require('./_lib.js');

module.exports = function (req, res) {
  res.setHeader('Set-Cookie', [
    COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'bp_wer=; Path=/; Secure; SameSite=Lax; Max-Age=0'
  ]);
  res.writeHead(302, { Location: '/admin-layout.html' });
  res.end();
};
