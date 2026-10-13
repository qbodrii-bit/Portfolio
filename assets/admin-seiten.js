/* Formular fuer 약력/연락처 (content/artist.json) und die Startseite
   (content/site.json). Anders als bei den Arbeiten gibt es hier nichts zu
   gestalten - nur eine Handvoll Felder - deshalb ein schlichtes Formular
   statt der Buehne.

   Die Beschriftungen stehen in scripts/wire-content.py und kommen hier als
   data-Attribute an; dieses Skript enthaelt nur die Meldungen. */
(function () {
  'use strict';

  var state = document.getElementById('zustand');
  var check = document.getElementById('pruefung');
  var saveBtn = document.getElementById('speichern');
  var tokenBox = document.getElementById('schluessel');
  var werkliste = document.getElementById('werkliste');
  if (!state || !saveBtn) return;

  var lang = 'de';
  var tab = 'bio';
  var D = { artist: null, site: null };
  var sauber = { artist: '', site: '' };
  var bilder = [];
  var sperre = false;

  // ---------------------------------------------------------------- Helfer
  function hole(obj, pfad) {
    return pfad.split('.').reduce(function (o, k) {
      return o && typeof o === 'object' ? o[k] : undefined;
    }, obj);
  }

  function setze(obj, pfad, wert) {
    var teile = pfad.split('.');
    var letzte = teile.pop();
    var ziel = teile.reduce(function (o, k) {
      if (!o[k] || typeof o[k] !== 'object') o[k] = {};
      return o[k];
    }, obj);
    ziel[letzte] = wert;
  }

  // "statement_de" heisst im Englischen "statement_en" - das Suffix wird
  // getauscht, damit die Umschaltung oben ein Feld weiterreicht.
  function mitSprache(key) {
    return key.replace(/_de$/, '_' + lang).replace(/^cover_caption_title$/,
      lang === 'en' ? 'cover_caption_title_en' : 'cover_caption_title');
  }

  function welche() { return tab === 'bio' ? 'artist' : 'site'; }

  function geaendert() {
    return (D.artist && JSON.stringify(D.artist) !== sauber.artist) ||
           (D.site && JSON.stringify(D.site) !== sauber.site);
  }

  function angemeldet() { return /(^|;\s*)bp_wer=/.test(document.cookie); }

  function melden(text, schlecht) {
    check.textContent = text;
    if (schlecht) check.setAttribute('data-bad', '1');
    else check.removeAttribute('data-bad');
  }

  function stand() {
    state.textContent = geaendert() ? '저장 안 됨' : '저장됨';
    saveBtn.disabled = sperre || !geaendert() || !angemeldet();
  }

  // --------------------------------------------------------------- Felder
  function zeichneFeld(el) {
    var key = mitSprache(el.getAttribute('data-key'));
    var art = el.getAttribute('data-art');
    var label = el.getAttribute('data-label');
    var hinweis = el.getAttribute('data-hinweis') || '';
    var daten = D[welche()];
    var wert = hole(daten, key);
    wert = wert === undefined || wert === null ? '' : String(wert);

    var inner = '<label class="seiten-label">' + label + '</label>';
    if (art === 'lang') {
      inner += '<textarea class="seiten-ein" rows="5"></textarea>';
    } else if (art === 'lang_kurz') {
      inner += '<textarea class="seiten-ein" rows="2"></textarea>';
    } else if (art === 'bild') {
      inner += '<div class="seiten-bild">' +
        '<img alt="" ' + (wert ? 'src="' + wert.replace(/^\//, '') + '"' : '') + '>' +
        '<button type="button" class="seiten-waehlen">사진 고르기</button></div>';
    } else if (art === 'werk') {
      inner += '<select class="seiten-ein">' + (werkliste ? werkliste.innerHTML : '') + '</select>';
    } else {
      inner += '<input class="seiten-ein" type="' + (art === 'zahl' ? 'number' : 'text') + '">';
    }
    if (hinweis) inner += '<p class="seiten-hinweis">' + hinweis + '</p>';
    el.innerHTML = inner;

    var ein = el.querySelector('.seiten-ein');
    if (ein) {
      ein.value = wert;
      ein.addEventListener('input', function () {
        var v = art === 'zahl' ? (ein.value === '' ? '' : Number(ein.value)) : ein.value;
        setze(D[welche()], key, v);
        stand();
      });
      ein.addEventListener('change', function () {
        setze(D[welche()], key, art === 'zahl' ? Number(ein.value) : ein.value);
        stand();
      });
    }
    var knopf = el.querySelector('.seiten-waehlen');
    if (knopf) {
      knopf.addEventListener('click', function () {
        waehlen(function (src) {
          setze(D.site, key, src);
          el.querySelector('img').src = src.replace(/^\//, '');
          stand();
        });
      });
    }
  }

  // --------------------------------------------------------------- Listen
  function zeichneListe(el) {
    var key = el.id;                               // education | exhibitions
    var spalten = el.getAttribute('data-spalten').split('|').map(function (s) {
      var t = s.split(':');
      return { key: t[0], label: t[1] };
    });
    var zeilen = D.artist[key] || [];

    el.innerHTML = zeilen.map(function (z, i) {
      return '<div class="seiten-zeile">' + spalten.map(function (sp) {
        var k = mitSprache(sp.key);
        var v = z[k] === undefined || z[k] === null ? '' : String(z[k]);
        return '<label><span>' + sp.label + '</span><input type="' +
               (sp.key === 'year' ? 'number' : 'text') + '" data-i="' + i +
               '" data-k="' + k + '" value="' + v.replace(/"/g, '&quot;') + '"></label>';
      }).join('') + '<button type="button" class="seiten-weg" data-i="' + i + '">삭제</button></div>';
    }).join('') + '<button type="button" class="seiten-neu">＋ 줄 추가</button>';

    el.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var z = D.artist[key][+inp.getAttribute('data-i')];
        var k = inp.getAttribute('data-k');
        z[k] = inp.type === 'number' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
        stand();
      });
    });
    el.querySelectorAll('.seiten-weg').forEach(function (b) {
      b.addEventListener('click', function () {
        D.artist[key].splice(+b.getAttribute('data-i'), 1);
        zeichneListe(el); stand();
      });
    });
    el.querySelector('.seiten-neu').addEventListener('click', function () {
      var leer = {};
      spalten.forEach(function (sp) { leer[mitSprache(sp.key)] = ''; });
      D.artist[key].push(leer);
      zeichneListe(el); stand();
    });
  }

  function zeichnen() {
    document.querySelectorAll('.seiten-block').forEach(function (b) {
      b.hidden = b.getAttribute('data-tab') !== tab;
    });
    var block = document.querySelector('.seiten-block[data-tab="' + tab + '"]');
    block.querySelectorAll('.seiten-feld').forEach(zeichneFeld);
    block.querySelectorAll('.seiten-liste').forEach(zeichneListe);
    stand();
  }

  // ---------------------------------------------------------- Bildauswahl
  function waehlen(fertig) {
    var kasten = document.createElement('div');
    kasten.className = 'lay-waehler';
    kasten.innerHTML = '<div class="lay-waehler-innen"><p class="lay-waehler-kopf">' +
      '사진 고르기 <button type="button" class="lay-waehler-zu">닫기</button></p>' +
      '<div class="lay-waehler-gitter">' + bilder.map(function (src) {
        return '<button type="button" data-src="' + src + '"><img src="' + src +
               '" loading="lazy" alt=""></button>';
      }).join('') + '</div></div>';
    document.body.appendChild(kasten);
    kasten.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-src]');
      if (b) { kasten.remove(); fertig('/' + b.getAttribute('data-src')); return; }
      if (ev.target.closest('.lay-waehler-zu') || ev.target === kasten) kasten.remove();
    });
  }

  // ------------------------------------------------------------ Speichern
  function speichern() {
    if (!angemeldet() || !geaendert() || sperre) return;
    sperre = true; stand();
    melden('저장하는 중…');

    var auftraege = [];
    if (JSON.stringify(D.artist) !== sauber.artist) auftraege.push('artist');
    if (JSON.stringify(D.site) !== sauber.site) auftraege.push('site');

    Promise.all(auftraege.map(function (seite) {
      return fetch('/api/save-page', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ seite: seite, daten: D[seite] })
      }).then(function (r) { return { seite: seite, status: r.status }; });
    })).then(function (ergebnisse) {
      sperre = false;
      var schlimm = ergebnisse.filter(function (e) { return e.status !== 200; })[0];
      if (!schlimm) {
        auftraege.forEach(function (s) { sauber[s] = JSON.stringify(D[s]); });
        melden('저장했습니다 · 사이트를 다시 만드는 중입니다 (보통 1~2분)');
        stand();
        return;
      }
      stand();
      if (schlimm.status === 401) melden('로그인이 풀렸습니다. 다시 로그인해 주세요.', 1);
      else if (schlimm.status === 409) melden('다른 곳에서 수정되었습니다. 새로고침한 뒤 다시 해주세요.', 1);
      else melden('저장하지 못했습니다. 고친 내용은 그대로 있습니다.', 1);
    }).catch(function () {
      sperre = false; stand();
      melden('저장하지 못했습니다 — 인터넷 연결을 확인해 주세요.', 1);
    });
  }

  saveBtn.addEventListener('click', speichern);

  window.addEventListener('beforeunload', function (ev) {
    if (geaendert()) { ev.preventDefault(); ev.returnValue = ''; }
  });

  // Dieselbe Auswahl wie im Werkeditor. Fuehrt sie auf eine Arbeit, wechselt
  // die Seite; die beiden Eintraege dieser Seite schalten nur den Abschnitt um.
  var auswahl = document.getElementById('werk');
  if (auswahl) {
    auswahl.addEventListener('change', function () {
      var o = auswahl.options[auswahl.selectedIndex];
      if (o.getAttribute('data-path')) {
        if (geaendert() && !confirm('저장하지 않은 변경이 있습니다. 버리고 넘어갈까요?')) {
          auswahl.value = tab;
          return;
        }
        sauber.artist = JSON.stringify(D.artist);     // beforeunload nicht ausloesen
        sauber.site = JSON.stringify(D.site);
        location.href = o.getAttribute('data-href');
        return;
      }
      tab = o.value;
      zeichnen();
    });
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-set-lang');
      document.querySelectorAll('[data-set-lang]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      zeichnen();
    });
  });

  if (tokenBox) {
    var da = angemeldet();
    tokenBox.setAttribute('data-hat', da ? '1' : '');
    var s = tokenBox.querySelector('.lay-key-stand');
    var m = /(^|;\s*)bp_wer=([^;]*)/.exec(document.cookie);
    if (s) s.textContent = da ? decodeURIComponent(m[2]) + ' 로 로그인됨'
                              : '로그인하면 저장할 수 있습니다';
    tokenBox.querySelector('.lay-key-weg').addEventListener('click', function () {
      location.href = '/api/logout';
    });
  }

  // ---------------------------------------------------------------- Laden
  Promise.all([
    fetch('content/artist.json', { cache: 'no-store' }).then(function (r) { return r.json(); }),
    fetch('content/site.json', { cache: 'no-store' }).then(function (r) { return r.json(); }),
    fetch('content/images/_sizes.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (a) {
    D.artist = a[0];
    D.site = a[1];
    D.artist.education = D.artist.education || [];
    D.artist.exhibitions = D.artist.exhibitions || [];
    sauber.artist = JSON.stringify(D.artist);
    sauber.site = JSON.stringify(D.site);
    bilder = Object.keys(a[2] || {}).sort();
    if (new URLSearchParams(location.search).get('t') === 'home') {
      tab = 'home';
      if (auswahl) auswahl.value = 'home';
    }
    zeichnen();
  }).catch(function () {
    state.textContent = '불러오지 못했습니다';
    melden('내용을 불러오지 못했습니다. 새로고침해 주세요.', 1);
  });
}());
