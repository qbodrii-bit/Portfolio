// Schritt 1 der Anmeldung: zu GitHub schicken.
// Der Zufallswert in state wird im Cookie hinterlegt und in callback.js wieder
// verglichen - sonst koennte eine fremde Seite die Anmeldung anstossen.
const crypto = require('crypto');
const { setzen } = require('./_lib.js');

module.exports = function (req, res) {
  const id = process.env.GH_CLIENT_ID;
  if (!id) {
    res.status(500).send('GH_CLIENT_ID fehlt');
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  setzen(res, 'bp_state', state, 600);

  const ziel = 'https://' + req.headers.host + '/api/callback';
  res.writeHead(302, {
    Location: 'https://github.com/login/oauth/authorize' +
      '?client_id=' + encodeURIComponent(id) +
      '&redirect_uri=' + encodeURIComponent(ziel) +
      '&state=' + state
  });
  res.end();
};
