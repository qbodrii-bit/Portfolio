/* Layout-Editor fuer admin-layout.html.

   Eine Arbeit ist eine Folge von Bloecken: Zeilen mit Zellen (Bild oder Text)
   und ausdrueckliche Leerraeume dazwischen.

   Zwei Regeln, die den Editor tragen:

   1. Die Buehne zeigt echte Werk-Bausteine. blockHtml/cellHtml hier bauen
      Zeile fuer Zeile dasselbe HTML wie cell_html/block_html in
      scripts/wire-content.py, und es gilt dasselbe assets/site.css. Wird dort
      etwas geaendert, muss es hier mit - pruefen() vergleicht bei jedem Laden
      und meldet, wenn beide auseinanderlaufen.
   2. Alles Bedienbare liegt ueber dem Inhalt: outline und absolute Position,
      nie Rahmen oder Innenabstand. Sonst verschoebe die Bedienung genau das,
      was sie zeigen soll. */
(function () {
  'use strict';

  var sel = document.getElementById('werk');
  var stage = document.getElementById('buehne');
  var state = document.getElementById('zustand');
  var check = document.getElementById('pruefung');
  var saveBtn = document.getElementById('speichern');
  var tokenBox = document.getElementById('schluessel');
  if (!sel || !stage) return;

  var GAP_DEFAULT = 16;
  var SPEICHER = 'bp-gh-token';
  var REPO = stage.getAttribute('data-repo') || '';
  var API = 'https://api.github.com/repos/' + REPO + '/contents/';

  var lang = 'de';
  var sizes = {};
  var bilder = [];        // alle hochgeladenen Bilder, fuer die Auswahl
  var ladung = 0;         // verwirft verspaetete Antworten
  var W = null;           // aktuelle Arbeit
  var pfad = '';          // content/works/<slug>.json
  var seite = '';         // werk-<slug>.html
  var sauber = '';        // Stand beim Laden, fuer "geaendert?"
  var sperre = false;     // kurz nach dem Speichern
  var knoten = [];        // Element je Block - nicht stage.children benutzen,
                          // dort kommen spaeter noch Bedienelemente dazu

  // ------------------------------------------------------------- Helfer
  function asInt(v, lo, hi) {                     // = as_int()
    var n = Math.round(Number(v));
    if (!isFinite(n)) return null;
    return Math.max(lo, Math.min(hi, n));
  }

  function asAlign(v) {                           // = as_align()
    return v === 'left' || v === 'center' || v === 'right' ? v : null;
  }

  function esc(s) {                               // = html.escape(quote=True)
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }

  function relSrc(src) { return String(src || '').replace(/^\/+/, ''); }

  function styleAttr(props) {                     // = style_attr()
    var bits = [];
    Object.keys(props).forEach(function (k) {
      if (props[k] !== null && props[k] !== undefined) {
        bits.push('--' + k.replace(/_/g, '-') + ': ' + props[k]);
      }
    });
    return bits.length ? ' style="' + bits.join('; ') + '"' : '';
  }

  function dims(src) {
    var wh = sizes[relSrc(src)];
    return wh ? ' width="' + wh[0] + '" height="' + wh[1] + '"' : '';
  }

  function cleanBlocks(raw) {                     // = clean_blocks()
    var blocks = [];
    (Array.isArray(raw) ? raw : []).forEach(function (b) {
      if (!b || typeof b !== 'object') return;
      if (b.t === 'gap') {
        var h = asInt(b.h, 0, 400);
        if (h) blocks.push({ t: 'gap', h: h });
      } else if (b.t === 'row') {
        var cells = (b.cells || []).filter(function (c) {
          return c && typeof c === 'object' && (c.t !== 'img' || c.src);
        });
        if (cells.length) blocks.push({ t: 'row', gap: b.gap, va: b.va, cells: cells });
      }
    });
    var merged = [];
    blocks.forEach(function (b) {
      var last = merged[merged.length - 1];
      if (b.t === 'gap' && last && last.t === 'gap') last.h = Math.max(last.h, b.h);
      else merged.push(b);
    });
    while (merged.length && merged[0].t === 'gap') merged.shift();
    while (merged.length && merged[merged.length - 1].t === 'gap') merged.pop();
    return merged;
  }

  function altText(w) { return w.title + ', ' + (w.year_label || w.year || '') + ' — Boram Park'; }

  // ------------------------------------------------- Bloecke -> HTML
  function cellHtml(cell, w) {
    // Das Verhaeltnis steht als fr-Wert in --cols der Zeile - hier nicht noetig.
    var style = {};

    if (cell.t === 'img') {
      var fill = asInt(cell.fill, 10, 100);
      style.w = fill === null ? null : fill + '%';
      var natural = sizes[relSrc(cell.src)];
      style.max = natural ? natural[0] + 'px' : null;
      var align = asAlign(cell.align);
      var mark = align ? ' data-align="' + align + '"' : '';
      var cap = '';
      if (cell.caption_de) {
        var cde = cell.caption_de;
        var cen = cell.caption_en || cde;
        cap = '\n        <figcaption data-de="' + esc(cde) + '" data-en="' + esc(cen) +
              '">' + esc(cde) + '</figcaption>';
      }
      return '      <figure class="work-cell"' + mark + styleAttr(style) + '>\n' +
             '        <img src="' + relSrc(cell.src) + '"' + dims(cell.src) +
             ' loading="lazy" alt="' + esc(altText(w)) + '">' + cap + '\n' +
             '      </figure>';
    }

    var de = String(cell.de || '').trim();
    var en = String(cell.en || '').trim() || de;
    var al = asAlign(cell.align);
    var m = al ? ' data-align="' + al + '"' : '';
    if (!de) return '      <div class="work-cell"' + m + styleAttr(style) + '></div>';
    return '      <div class="work-cell"' + m + styleAttr(style) + '>\n' +
           '        <p class="work-text" data-de="' + esc(de) + '" data-en="' + esc(en) +
           '">' + esc(de) + '</p>\n      </div>';
  }

  function blockHtml(block, w) {
    if (block.t === 'gap') {
      return '    <div class="work-space" style="--h: ' + block.h + 'px"></div>';
    }
    var gap = asInt(block.gap, 0, 400);
    if (gap === null) gap = GAP_DEFAULT;
    var cols = block.cells.map(function (c) { return (asInt(c.w, 1, 100) || 1) + 'fr'; }).join(' ');
    var mark = block.va === 'center' ? ' data-va="center"' : '';
    var cells = block.cells.map(function (c) { return cellHtml(c, w); }).join('\n');
    return '    <div class="work-row"' + mark + ' style="--gap: ' + gap + 'px; --cols: ' +
           cols + '">\n' + cells + '\n    </div>';
  }

  function plainHtml() {
    return W.blocks.map(function (b) { return blockHtml(b, W); }).join('\n');
  }

  // ----------------------------------------------------------- Bedienung
  var VORLAGEN = [
    { k: 'one',   w: [1],       d: 'M2 3h16v10H2z' },
    { k: 'two',   w: [1, 1],    d: 'M2 3h7v10H2z M11 3h7v10h-7z' },
    { k: 'three', w: [1, 1, 1], d: 'M2 3h4.6v10H2z M8.2 3h4.6v10H8.2z M14.4 3h4.6v10h-4.6z' },
    { k: 'lr',    w: [2, 1],    d: 'M2 3h11v10H2z M15 3h4v10h-4z' },
    { k: 'rl',    w: [1, 2],    d: 'M2 3h4v10H2z M8 3h11v10H8z' }
  ];

  function icon(d) {
    return '<svg width="20" height="16" viewBox="0 0 20 16" fill="none" ' +
           'stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
           d.split(' M').map(function (p, i) {
             return '<path d="' + (i ? 'M' + p : p) + '"/>';
           }).join('') + '</svg>';
  }

  function rowBar(i, block) {
    var jetzt = block.cells.map(function (c) { return asInt(c.w, 1, 100) || 1; }).join();
    var gap = asInt(block.gap, 0, 400);
    if (gap === null) gap = GAP_DEFAULT;
    var knoepfe = VORLAGEN.map(function (v) {
      var on = v.w.length === block.cells.length && v.w.join() === jetzt ? ' data-on=""' : '';
      return '<button type="button" data-tat="vorlage" data-i="' + i + '" data-k="' + v.k +
             '"' + on + ' title="' + v.w.length + '칸">' + icon(v.d) + '</button>';
    }).join('');
    return '<div class="lay-bar" contenteditable="false">' + knoepfe +
      '<span class="lay-sep"></span>' +
      '<label class="lay-num">칸 간격<input type="number" min="0" max="200" value="' + gap +
      '" data-tat="gap" data-i="' + i + '">px</label>' +
      '<span class="lay-sep"></span>' +
      '<button type="button" data-tat="va" data-i="' + i + '"' +
      (block.va === 'center' ? ' data-on=""' : '') + ' title="세로 가운데">⇕</button>' +
      '<button type="button" data-tat="weg" data-i="' + i + '" title="줄 삭제">🗑</button>' +
      '</div>';
  }

  function cellBar(i, j, cell) {
    var tausch = cell.t === 'img'
      ? '<button type="button" data-tat="zuText" data-i="' + i + '" data-j="' + j + '">글로</button>' +
        '<button type="button" data-tat="bild" data-i="' + i + '" data-j="' + j + '">사진 교체</button>'
      : '<button type="button" data-tat="zuBild" data-i="' + i + '" data-j="' + j + '">사진으로</button>';
    return '<div class="lay-cellbar" contenteditable="false">' + tausch + '</div>';
  }

  function schmuecken() {
    W.blocks.forEach(function (b, i) {
      var el = knoten[i];
      if (!el) return;
      el.insertAdjacentHTML('beforeend',
        '<button type="button" class="lay-plus" data-i="' + i + '" title="여기에 줄 추가">+</button>');
      el.classList.add('lay-block');
      el.setAttribute('data-kind', b.t);
      el.setAttribute('data-i', i);

      if (b.t === 'gap') {
        el.insertAdjacentHTML('beforeend',
          '<span class="lay-gaplabel" contenteditable="false">여백 ' + b.h + 'px</span>' +
          '<button type="button" class="lay-gapdel" data-tat="weg" data-i="' + i + '">삭제</button>' +
          '<span class="lay-griff" data-tat="hoehe" data-i="' + i + '"></span>');
        return;
      }

      el.insertAdjacentHTML('beforeend', rowBar(i, b));
      // Trenner zwischen den Zellen: ziehen aendert das Verhaeltnis
      for (var t = 1; t < b.cells.length; t++) {
        el.insertAdjacentHTML('beforeend',
          '<span class="lay-trenner" data-tat="breite" data-i="' + i + '" data-t="' + t +
          '" style="left:' + (anteil(b, t) * 100) + '%"></span>');
      }
      [].forEach.call(el.querySelectorAll(':scope > .work-cell'), function (zelle, j) {
        var c = b.cells[j];
        if (!c) return;
        zelle.insertAdjacentHTML('beforeend', cellBar(i, j, c));
        if (c.t === 'text') {
          var feld = document.createElement('textarea');
          feld.className = 'lay-feld';
          feld.rows = 2;
          feld.placeholder = lang === 'de' ? '여기에 독일어 글' : '여기에 영어 글';
          feld.value = c[lang] || '';
          feld.setAttribute('data-tat', 'text');
          feld.setAttribute('data-i', i);
          feld.setAttribute('data-j', j);
          zelle.insertAdjacentElement('afterbegin', feld);
          var p = zelle.querySelector('.work-text');
          if (p) p.remove();                  // der Text steht jetzt im Feld
          wachsen(feld);
        }
      });
    });
  }

  function anteil(block, t) {
    var sum = 0, bis = 0;
    block.cells.forEach(function (c, k) {
      var v = asInt(c.w, 1, 100) || 1;
      sum += v;
      if (k < t) bis += v;
    });
    return bis / sum;
  }

  function wachsen(feld) {
    feld.style.height = 'auto';
    feld.style.height = feld.scrollHeight + 'px';
  }

  function applyLang() {
    stage.querySelectorAll('[data-de][data-en]').forEach(function (el) {
      el.textContent = el.getAttribute('data-' + lang);
    });
  }

  function zeichnen() {
    var scroll = window.scrollY;
    stage.innerHTML = plainHtml();
    knoten = [].slice.call(stage.children);
    applyLang();
    schmuecken();
    stage.insertAdjacentHTML('beforeend',
      '<button type="button" class="lay-plus lay-plus-ende" data-i="' + W.blocks.length +
      '" title="맨 아래에 줄 추가">+</button>');
    window.scrollTo(0, scroll);
    stand();
  }

  // ------------------------------------------------------------ Aenderungen
  function geaendert() { return !!W && JSON.stringify(W.blocks) !== sauber; }

  function stand() {
    var rows = W.blocks.filter(function (b) { return b.t === 'row'; }).length;
    var imgs = W.blocks.reduce(function (n, b) {
      return n + (b.t === 'row' ? b.cells.filter(function (c) { return c.t === 'img'; }).length : 0);
    }, 0);
    state.textContent = rows + '줄 · 사진 ' + imgs + '장' + (geaendert() ? ' · 저장 안 됨' : '');
    if (saveBtn) saveBtn.disabled = sperre || !geaendert() || !token();
  }

  function aufraeumen() {                      // = clean_blocks(), nach jeder Aenderung
    W.blocks = cleanBlocks(W.blocks);
  }

  var TATEN = {
    vorlage: function (b, el) {
      var v = VORLAGEN.filter(function (x) { return x.k === el.getAttribute('data-k'); })[0];
      var alt = b.cells.slice();
      b.cells = v.w.map(function (breite, j) {
        var c = alt[j] || { t: 'text', de: '', en: '' };
        c.w = breite;
        return c;
      });
    },
    va: function (b) { if (b.va === 'center') delete b.va; else b.va = 'center'; },
    zuText: function (b, el) {
      var j = +el.getAttribute('data-j');
      b.cells[j] = { t: 'text', de: '', en: '', w: b.cells[j].w };
    },
    zuBild: function (b, el) {
      var j = +el.getAttribute('data-j');
      waehlen(function (src) {
        b.cells[j] = { t: 'img', src: src, w: b.cells[j].w };
        aufraeumen(); zeichnen();
      });
      return true;                              // Auswahl laeuft, nicht neu zeichnen
    },
    bild: function (b, el) {
      var j = +el.getAttribute('data-j');
      waehlen(function (src) { b.cells[j].src = src; aufraeumen(); zeichnen(); });
      return true;
    },
    weg: function (b, el) {
      W.blocks.splice(+el.getAttribute('data-i'), 1);
    }
  };

  stage.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-tat]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
    var tat = el.getAttribute('data-tat');
    if (!TATEN[tat]) return;
    ev.preventDefault();
    var b = W.blocks[+el.getAttribute('data-i')];
    if (!b) return;
    if (TATEN[tat](b, el)) return;
    aufraeumen();
    zeichnen();
  });

  stage.addEventListener('input', function (ev) {
    var el = ev.target;
    var tat = el.getAttribute && el.getAttribute('data-tat');
    if (tat === 'text') {
      var b = W.blocks[+el.getAttribute('data-i')];
      var c = b && b.cells[+el.getAttribute('data-j')];
      if (c) { c[lang] = el.value; wachsen(el); stand(); }
    } else if (tat === 'gap') {
      var row = W.blocks[+el.getAttribute('data-i')];
      var n = asInt(el.value, 0, 200);
      if (row && n !== null) {
        row.gap = n;
        var ziel = knoten[+el.getAttribute('data-i')];
        if (ziel) ziel.style.setProperty('--gap', n + 'px');
        stand();
      }
    }
  });

  // Ziehen: Trenner zwischen Zellen, und die Unterkante eines Leerraums
  stage.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest('[data-tat="breite"], [data-tat="hoehe"]');
    if (!el) return;
    ev.preventDefault();
    var art = el.getAttribute('data-tat');
    var i = +el.getAttribute('data-i');
    var block = W.blocks[i];
    var node = knoten[i];
    if (!block || !node) return;

    if (art === 'hoehe') {
      var y0 = ev.clientY, h0 = block.h;
      var label = node.querySelector('.lay-gaplabel');
      move(function (ev2) {
        block.h = Math.max(0, Math.min(400, Math.round(h0 + ev2.clientY - y0)));
        node.style.setProperty('--h', block.h + 'px');
        if (label) label.textContent = '여백 ' + block.h + 'px';
        stand();
      });
      return;
    }

    var t = +el.getAttribute('data-t');
    var breite = node.getBoundingClientRect().width;
    var x0 = ev.clientX;
    var links = asInt(block.cells[t - 1].w, 1, 100) || 1;
    var rechts = asInt(block.cells[t].w, 1, 100) || 1;
    var paar = links + rechts;
    move(function (ev2) {
      // nur die beiden Nachbarn tauschen Anteile, der Rest der Zeile bleibt
      var summe = block.cells.reduce(function (s, c) { return s + (asInt(c.w, 1, 100) || 1); }, 0);
      var d = Math.round((ev2.clientX - x0) / breite * summe);
      var l = Math.max(1, Math.min(paar - 1, links + d));
      block.cells[t - 1].w = l;
      block.cells[t].w = paar - l;
      node.style.setProperty('--cols', block.cells.map(function (c) {
        return (asInt(c.w, 1, 100) || 1) + 'fr';
      }).join(' '));
      el.style.left = (anteil(block, t) * 100) + '%';
      stand();
    });
  });

  function move(auf) {
    function ab() {
      document.removeEventListener('pointermove', auf);
      document.removeEventListener('pointerup', ab);
      zeichnen();
    }
    document.addEventListener('pointermove', auf);
    document.addEventListener('pointerup', ab);
  }

  // Neue Zeile zwischen zwei Bloecken
  stage.addEventListener('click', function (ev) {
    var el = ev.target.closest('.lay-plus');
    if (!el) return;
    var i = +el.getAttribute('data-i');
    W.blocks.splice(i, 0, { t: 'gap', h: 56 },
                          { t: 'row', gap: GAP_DEFAULT, cells: [{ t: 'text', de: '', en: '' }] });
    aufraeumen();
    zeichnen();
  });

  // ------------------------------------------------------------ Bildauswahl
  function waehlen(fertig) {
    var kasten = document.createElement('div');
    kasten.className = 'lay-waehler';
    kasten.innerHTML = '<div class="lay-waehler-innen"><p class="lay-waehler-kopf">' +
      '사진 고르기 <button type="button" class="lay-waehler-zu">닫기</button></p>' +
      '<div class="lay-waehler-gitter">' + bilder.map(function (src) {
        return '<button type="button" data-src="' + esc(src) + '"><img src="' + esc(src) +
               '" loading="lazy" alt=""></button>';
      }).join('') + '</div>' +
      '<p class="lay-waehler-fuss">여기에 없는 사진은 Pages CMS에서 먼저 올려야 합니다.</p></div>';
    document.body.appendChild(kasten);
    kasten.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-src]');
      if (b) { kasten.remove(); fertig('/' + b.getAttribute('data-src')); return; }
      if (ev.target.closest('.lay-waehler-zu') || ev.target === kasten) kasten.remove();
    });
  }

  // ---------------------------------------------------------------- Schluessel
  function token() {
    try { return localStorage.getItem(SPEICHER) || ''; } catch (e) { return ''; }
  }

  function tokenSetzen(wert) {
    try {
      if (wert) localStorage.setItem(SPEICHER, wert);
      else localStorage.removeItem(SPEICHER);
    } catch (e) { /* privates Fenster: dann eben nur fuer diese Sitzung */ }
    tokenStand();
    stand();
  }

  function tokenStand() {
    if (!tokenBox) return;
    var da = !!token();
    tokenBox.setAttribute('data-hat', da ? '1' : '');
    var s = tokenBox.querySelector('.lay-key-stand');
    if (s) s.textContent = da ? '열쇠 등록됨 — 저장할 수 있습니다'
                              : '열쇠 없음 — 지금은 보기만 됩니다';
  }

  if (tokenBox) {
    // Nur auf den bekannten Adressen anbieten. Eine Kopie dieser Seite auf
    // einer fremden Domain bekommt so kein Eingabefeld fuer den Schluessel.
    var host = location.hostname;
    var erlaubt = host === 'www.boram-park.com' || host === 'boram-park.com' ||
                  host === 'localhost' || host === '127.0.0.1';
    if (!erlaubt) {
      tokenBox.remove();
      tokenBox = null;
    } else {
      tokenBox.querySelector('.lay-key-save').addEventListener('click', function () {
        var feld = tokenBox.querySelector('.lay-key-feld');
        tokenSetzen(feld.value.trim());
        feld.value = '';
      });
      tokenBox.querySelector('.lay-key-weg').addEventListener('click', function () {
        tokenSetzen('');
      });
      tokenStand();
    }
  }

  // ---------------------------------------------------------------- Speichern
  function b64(text) {
    // btoa allein geht schief: 'Ü' liegt unter 256 und wirft keinen Fehler,
    // erzeugt aber die falschen Bytes. Erst nach UTF-8 kodieren.
    var bytes = new TextEncoder().encode(text), s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function entb64(s) {
    var bin = atob(String(s).replace(/\s/g, ''));
    return new TextDecoder('utf-8').decode(
      Uint8Array.from(bin, function (c) { return c.charCodeAt(0); }));
  }

  function kopf() {
    return { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json',
             'X-GitHub-Api-Version': '2022-11-28' };
  }

  function melden(text, schlecht) {
    check.textContent = text;
    if (schlecht) check.setAttribute('data-bad', '1');
    else check.removeAttribute('data-bad');
  }

  function speichern(nochmal) {
    if (!token() || !geaendert() || sperre) return;
    sperre = true; stand();
    melden('저장하는 중…');

    fetch(API + pfad + '?ref=main', { headers: kopf(), cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) throw new Error('401');
        if (r.status === 404) throw new Error('404');
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (datei) {
        // Auf den frischen Stand aufsetzen, nicht blind ueberschreiben: Titel
        // oder Jahr koennten inzwischen anderswo geaendert worden sein.
        var frisch = JSON.parse(entb64(datei.content));
        frisch.blocks = W.blocks;
        var text = JSON.stringify(frisch, null, 2);     // wie json.dumps(indent=2)
        if (text === entb64(datei.content)) {
          sperre = false; melden('바뀐 것이 없습니다.'); stand(); return null;
        }
        return fetch(API + pfad, {
          method: 'PUT', headers: kopf(),
          body: JSON.stringify({
            message: 'Update ' + pfad + ' (via Layout-Editor)',   // nie [skip ci]
            content: b64(text), sha: datei.sha, branch: 'main'
          })
        });
      })
      .then(function (r) {
        if (!r) return;
        if (r.status === 409 || r.status === 422) {
          if (nochmal) throw new Error('konflikt');
          sperre = false;
          return speichern(true);                       // einmal mit frischem sha
        }
        if (!r.ok) throw new Error(String(r.status));
        sauber = JSON.stringify(W.blocks);
        melden('저장했습니다 · 사이트를 다시 만드는 중입니다 (보통 1~2분)');
        stand();
        warten(0);
        setTimeout(function () { sperre = false; stand(); }, 10000);
      })
      .catch(function (err) {
        sperre = false; stand();
        var m = String(err.message);
        if (m === '401') { tokenSetzen(''); melden('열쇠가 만료되었거나 취소되었습니다. 다시 등록해 주세요.', 1); }
        else if (m === '404') melden('이 열쇠로는 저장소에 접근할 수 없습니다. 권한을 확인해 주세요.', 1);
        else if (m === 'konflikt') melden('다른 곳에서 같은 작품이 수정되었습니다. 새로고침한 뒤 다시 해주세요.', 1);
        else melden('저장하지 못했습니다 (' + m + '). 고친 내용은 그대로 있습니다.', 1);
      });
  }

  /* Nicht die API fragen, sondern die fertige Seite: erst wenn dort dieselben
     Bloecke stehen, ist wirklich alles durch - Action und Auslieferung. */
  function warten(versuch) {
    if (versuch > 36) { melden('아직 반영되지 않았습니다. 사이트 상태를 확인해 주세요.'); return; }
    setTimeout(function () {
      fetch(seite + '?v=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var echt = doc.querySelector('.work-blocks');
          var huelse = doc.createElement('div');
          huelse.innerHTML = plainHtml();
          if (echt && gleich(echt.innerHTML, huelse.innerHTML)) {
            melden('사이트에 반영되었습니다 ✓');
          } else {
            warten(versuch + 1);
          }
        })
        .catch(function () { warten(versuch + 1); });
    }, 5000);
  }

  function gleich(a, b) {
    return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
  }

  if (saveBtn) saveBtn.addEventListener('click', function () { speichern(false); });

  window.addEventListener('beforeunload', function (ev) {
    if (geaendert()) { ev.preventDefault(); ev.returnValue = ''; }
  });

  // --------------------------------------------------------------- Pruefung
  function pruefen(meine) {
    fetch(seite, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html || meine !== ladung || geaendert()) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var echt = doc.querySelector('.work-blocks');
        if (!echt) return;
        // Beide Seiten durch denselben Parser: ein roher String gegen innerHTML
        // geht nicht auf, der Browser gibt z.B. &#x27; wieder als ' aus.
        var huelse = doc.createElement('div');
        huelse.innerHTML = plainHtml();
        if (gleich(echt.innerHTML, huelse.innerHTML)) {
          melden('이 화면은 실제 작품 페이지와 같은 내용입니다.');
        } else {
          melden('주의: 이 화면이 실제 작품 페이지와 다릅니다. 개발자에게 알려주세요.', 1);
        }
      })
      .catch(function () { /* offline: Anzeige stimmt trotzdem */ });
  }

  // ------------------------------------------------------------------ Laden
  function laden(slug) {
    if (W && geaendert() && !confirm('저장하지 않은 변경이 있습니다. 버리고 넘어갈까요?')) {
      sel.value = W.slug;
      return;
    }
    var option = sel.querySelector('option[value="' + CSS.escape(slug) + '"]') || sel.options[0];
    sel.value = option.value;
    pfad = option.getAttribute('data-path');
    seite = option.getAttribute('data-page');
    state.textContent = '불러오는 중…';
    stage.innerHTML = '';
    melden('');
    var meine = ++ladung;

    fetch(pfad, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (work) {
        if (meine !== ladung) return;
        W = work;
        W.slug = option.value;
        W.blocks = cleanBlocks(work.blocks);
        sauber = JSON.stringify(W.blocks);
        zeichnen();
        pruefen(meine);
        if (history.replaceState) history.replaceState(null, '', '?w=' + option.value);
      })
      .catch(function () {
        if (meine !== ladung) return;
        state.textContent = '불러오지 못했습니다';
        stage.innerHTML = '';
        melden('작품을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.', 1);
      });
  }

  sel.addEventListener('change', function () { laden(sel.value); });

  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-set-lang');
      document.querySelectorAll('[data-set-lang]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      zeichnen();
    });
  });

  fetch('content/images/_sizes.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (data) {
      sizes = data || {};
      bilder = Object.keys(sizes).sort();
      laden(new URLSearchParams(location.search).get('w') || '');
    });
}());
