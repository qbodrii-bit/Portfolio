/* Fotoverwaltung fuer admin-fotos.html.

   Zeigt jedes Foto unter content/images nach Ordnern, mit Pixelmassen,
   Seitenverhaeltnis und wo es steckt (Arbeit oder Titelbild). Was nirgends
   steckt, laesst sich loeschen; api/delete-image.js prueft das noch einmal
   selbst am Stand auf GitHub.

   Die Liste kommt aus content/images/_sizes.json, die die Action schreibt -
   ein eben hochgeladenes Foto taucht hier also erst nach dem naechsten Bauen
   auf, ein geloeschtes verschwindet erst dann aus der Datei. */
(function () {
  'use strict';

  var state = document.getElementById('zustand');
  var check = document.getElementById('pruefung');
  var flaeche = document.getElementById('fotos');
  var liste = document.querySelector('.ed-liste');
  var nurFrei = document.getElementById('nur-frei');
  var tokenBox = document.getElementById('schluessel');
  if (!flaeche || !liste) return;

  var WURZEL = 'content/images/';
  var sizes = {};
  var web = {};
  var wo = {};            // Pfad -> [{ titel, edit }] - wer das Foto benutzt
  var weg = {};           // in dieser Sitzung geloescht, _sizes.json weiss es noch nicht
  var titel = {};         // Ordnername einer Arbeit -> ihr Titel
  var ordner = '';        // '' = alle

  // ---------------------------------------------------------------- Helfer
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }

  function relSrc(src) { return String(src || '').replace(/^\/+/, ''); }
  function webSrc(src) { var r = relSrc(src); return web[r] || r; }

  function angemeldet() { return /(^|;\s*)bp_wer=/.test(document.cookie); }

  function melden(text, schlecht) {
    check.textContent = text;
    if (schlecht) check.setAttribute('data-bad', '1');
    else check.removeAttribute('data-bad');
  }

  function json(pfad) {
    return fetch(pfad, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
  }

  // 'content/images/lebensfluss/01.jpg' -> 'lebensfluss'; direkt im Wurzel-
  // ordner liegende Fotos (aus der Zeit vor dem Editor) -> ''
  function ordnerVon(pfad) {
    var rest = pfad.slice(WURZEL.length);
    var i = rest.lastIndexOf('/');
    return i < 0 ? '' : rest.slice(0, i);
  }

  function nameVon(pfad) { return pfad.slice(pfad.lastIndexOf('/') + 1); }

  function ordnerName(o) {
    if (!o) return '폴더 밖';
    if (o === 'cover') return 'cover · 홈 표지';
    return titel[o] ? o + ' · ' + titel[o] : o;
  }

  // Links in der Liste reicht der Titel; der Ordnername steht ueber den Fotos
  function kurzName(o) {
    if (!o) return '폴더 밖';
    if (o === 'cover') return '홈 표지';
    return titel[o] || o;
  }

  // Seitenverhaeltnis so, wie man es sagt: 16:9 statt 3456:1943.
  var GELAEUFIG = [[1, 1], [5, 4], [4, 3], [3, 2], [16, 10], [5, 3], [16, 9], [2, 1], [21, 9]];
  function verhaeltnis(w, h) {
    var lang = Math.max(w, h), kurz = Math.min(w, h), r = lang / kurz;
    var best = null;
    GELAEUFIG.forEach(function (g) {
      var d = Math.abs(r - g[0] / g[1]) / (g[0] / g[1]);
      if (!best || d < best.d) best = { g: g, d: d };
    });
    if (best.d > 0.02) return (w / h).toFixed(2) + ' : 1';
    var a = best.g[0], b = best.g[1];
    var text = w >= h ? a + ':' + b : b + ':' + a;
    return (best.d < 0.002 ? '' : '약 ') + text;
  }

  // ---------------------------------------------------------------- Zeichnen
  function alle() {
    return Object.keys(sizes).filter(function (p) {
      return p.indexOf(WURZEL) === 0 && !weg[p];
    }).sort();
  }

  function frei(p) { return !(wo[p] && wo[p].length); }

  function zeichneListe(pfade) {
    var zahl = {};
    pfade.forEach(function (p) { var o = ordnerVon(p); zahl[o] = (zahl[o] || 0) + 1; });
    var namen = Object.keys(zahl).sort(function (a, b) {
      if (!a) return 1;                    // "폴더 밖" ans Ende
      if (!b) return -1;
      return a.localeCompare(b);
    });
    // "폴더 밖" heisst in der Liste '/', weil '' schon "alle" ist
    if (ordner && !zahl[ordner === '/' ? '' : ordner]) ordner = '';

    function eintrag(o, label, n) {
      return '<button type="button" class="ed-liste-eintrag" data-ordner="' + esc(o) + '"' +
             (o === ordner ? ' data-aktiv="1"' : '') + '>' + esc(label) +
             ' <span class="foto-zahl">' + n + '</span></button>';
    }
    liste.innerHTML = eintrag('', '전체', pfade.length) + namen.map(function (o) {
      return eintrag(o || '/', kurzName(o), zahl[o]);
    }).join('');
  }

  function karte(p) {
    var wh = sizes[p];
    var benutzt = wo[p] || [];
    var unten = benutzt.length
      ? '<p class="foto-wo">쓰는 곳: ' + benutzt.map(function (b) {
          return b.edit ? '<a href="' + esc(b.edit) + '">' + esc(b.titel) + '</a>' : esc(b.titel);
        }).join(', ') + '</p>'
      : '<p class="foto-wo" data-frei="1">안 쓰는 사진</p>' +
        '<button type="button" class="foto-weg" data-weg="' + esc(p) + '"' +
        (angemeldet() ? '' : ' disabled title="로그인하면 지울 수 있습니다"') + '>지우기</button>';
    return '<figure class="foto-karte">' +
      '<a class="foto-bild" href="' + esc(p) + '" target="_blank" rel="noopener" title="원본 열기">' +
      '<img src="' + esc(webSrc(p)) + '" loading="lazy" alt=""></a>' +
      '<figcaption><p class="foto-name">' + esc(nameVon(p)) + '</p>' +
      '<p class="foto-mass">' + (wh ? wh[0] + ' × ' + wh[1] + ' · ' + verhaeltnis(wh[0], wh[1]) : '') +
      '</p>' + unten + '</figcaption></figure>';
  }

  function zeichnen() {
    var pfade = alle();
    zeichneListe(pfade);

    var zeigen = pfade.filter(function (p) {
      if (nurFrei && nurFrei.checked && !frei(p)) return false;
      if (!ordner) return true;
      return ordnerVon(p) === (ordner === '/' ? '' : ordner);
    });

    var gruppen = {};
    zeigen.forEach(function (p) { (gruppen[ordnerVon(p)] = gruppen[ordnerVon(p)] || []).push(p); });
    var namen = Object.keys(gruppen).sort(function (a, b) {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });

    flaeche.innerHTML = namen.length ? namen.map(function (o) {
      return '<section class="foto-ordner"><h2 class="seiten-titel">' + esc(ordnerName(o)) +
             ' <span class="foto-zahl">' + gruppen[o].length + '장</span></h2>' +
             '<div class="foto-gitter">' + gruppen[o].map(karte).join('') + '</div></section>';
    }).join('') : '<p class="layout-note">' +
      (nurFrei && nurFrei.checked ? '안 쓰는 사진이 없습니다.' : '사진이 없습니다.') + '</p>';

    var n = pfade.filter(frei).length;
    state.textContent = '사진 ' + pfade.length + '장 · 안 쓰는 사진 ' + n + '장';
  }

  // ---------------------------------------------------------------- Loeschen
  /* Wie beim Loeschen einer Arbeit: eigenes Fenster, das Foto beim Namen
     genannt und gezeigt, bevor etwas passiert. */
  function loeschen(p) {
    var kasten = document.createElement('div');
    kasten.className = 'lay-waehler';
    kasten.innerHTML =
      '<div class="lay-waehler-innen neu-arbeit">' +
      '<p class="lay-waehler-kopf">사진 지우기' +
      '<button type="button" class="lay-waehler-zu">닫기</button></p>' +
      '<img class="foto-loesch-bild" src="' + esc(webSrc(p)) + '" alt="">' +
      '<p class="loesch-name">' + esc(nameVon(p)) + '</p>' +
      '<p class="lay-waehler-fuss" data-rolle="fuss">' + esc(ordnerName(ordnerVon(p))) +
      ' 폴더에서 이 사진을 지웁니다. 어느 작품에도 쓰이지 않는 사진입니다. ' +
      '되돌리려면 개발자에게 말씀해 주세요 — 기록에는 남아 있습니다.</p>' +
      '<p><button type="button" class="loesch-los" data-rolle="los">지웁니다</button></p>' +
      '</div>';
    document.body.appendChild(kasten);

    var fuss = kasten.querySelector('[data-rolle="fuss"]');
    var los = kasten.querySelector('[data-rolle="los"]');
    kasten.addEventListener('click', function (ev) {
      if (ev.target.closest('.lay-waehler-zu') || ev.target === kasten) kasten.remove();
    });

    los.addEventListener('click', function () {
      los.disabled = true;
      fuss.textContent = '지우는 중…';
      fetch('/api/delete-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ pfad: p })
      }).then(function (r) {
        return r.json().catch(function () { return {}; })
          .then(function (d) { return { status: r.status, d: d }; });
      }).then(function (a) {
        los.disabled = false;
        if (a.status === 200 || (a.d && a.d.fehler === 'weg')) {
          weg[p] = true;
          kasten.remove();
          zeichnen();
          melden('지웠습니다 · 사이트에는 1~2분 뒤에 반영됩니다');
          return;
        }
        if (a.d && a.d.fehler === 'benutzt') {
          fuss.textContent = '이 사진은 아직 쓰이고 있습니다: ' + (a.d.wo || []).join(', ') +
            '. 거기서 먼저 빼고 저장한 뒤에 지워 주세요.';
        } else if (a.status === 401) {
          fuss.textContent = '로그인이 풀렸습니다. 새로고침한 뒤 다시 로그인해 주세요.';
        } else {
          fuss.textContent = '지우지 못했습니다. 잠시 뒤 다시 시도해 주세요. (' + a.status +
            (a.d && a.d.fehler ? ' ' + a.d.fehler : '') + ')';
        }
      }).catch(function () {
        los.disabled = false;
        fuss.textContent = '지우지 못했습니다 — 인터넷 연결을 확인해 주세요.';
      });
    });
  }

  // ---------------------------------------------------------------- Bedienung
  liste.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ordner]');
    if (!b) return;
    ordner = b.getAttribute('data-ordner');
    zeichnen();
    window.scrollTo(0, 0);
  });

  flaeche.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-weg]');
    if (b && !b.disabled) loeschen(b.getAttribute('data-weg'));
  });

  if (nurFrei) nurFrei.addEventListener('change', zeichnen);

  if (tokenBox) {
    var da = angemeldet();
    tokenBox.setAttribute('data-hat', da ? '1' : '');
    var s = tokenBox.querySelector('.lay-key-stand');
    var m = /(^|;\s*)bp_wer=([^;]*)/.exec(document.cookie);
    if (s && da) s.textContent = decodeURIComponent(m[2]) + ' 로 로그인됨';
    tokenBox.querySelector('.lay-key-weg').addEventListener('click', function () {
      document.cookie = 'bp_wer=; Path=/; Max-Age=0';
      location.href = '/api/logout';
    });
  }

  // ---------------------------------------------------------------- Laden
  // Wer was benutzt: jede Arbeit aus der Liste im HTML, dazu das Titelbild.
  var werke = [].slice.call(document.querySelectorAll('#werke [data-path]'));
  werke.forEach(function (li) { titel[li.getAttribute('data-slug')] = li.textContent; });

  function merke(src, eintrag) {
    var p = relSrc(src);
    if (!p) return;
    wo[p] = wo[p] || [];
    if (!wo[p].some(function (x) { return x.titel === eintrag.titel; })) wo[p].push(eintrag);
  }

  Promise.all([
    json('content/images/_sizes.json'),
    json('content/images/_web.json'),
    json('content/site.json')
  ].concat(werke.map(function (li) { return json(li.getAttribute('data-path')); })))
    .then(function (a) {
      sizes = a[0] || {};
      web = a[1] || {};
      if (a[2] && a[2].cover_image) merke(a[2].cover_image, { titel: '홈 표지', edit: 'admin-seiten.html?t=home' });
      werke.forEach(function (li, i) {
        var w = a[3 + i] || {};
        var eintrag = { titel: li.textContent, edit: li.getAttribute('data-edit') };
        (Array.isArray(w.blocks) ? w.blocks : []).forEach(function (b) {
          (b && Array.isArray(b.cells) ? b.cells : []).forEach(function (c) {
            if (c && c.t === 'img') merke(c.src, eintrag);
          });
        });
      });
      if (!Object.keys(sizes).length) {
        state.textContent = '불러오지 못했습니다';
        melden('사진 목록을 불러오지 못했습니다. 새로고침해 주세요.', 1);
        return;
      }
      zeichnen();
      melden('방금 올린 사진은 1~2분 뒤에 이 목록에 나타납니다.');
    });
}());
