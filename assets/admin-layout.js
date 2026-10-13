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
             '        <img src="' + esc(relSrc(cell.src)) + '"' + dims(cell.src) +
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
      // Steht ein Bild allein in der Zeile, gibt es keinen Trenner - dann sitzt
      // der Griff an seiner rechten Kante und aendert fill. Fuer die Hand ist
      // es dieselbe Bewegung; welches Feld dahinter steht, muss niemand wissen.
      if (b.cells.length === 1 && b.cells[0].t === 'img') {
        el.insertAdjacentHTML('beforeend',
          '<span class="lay-trenner" data-tat="fuellen" data-i="' + i +
          '" style="left:' + (asInt(b.cells[0].fill, 10, 100) || 100) + '%"></span>');
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
    if (saveBtn) saveBtn.disabled = sperre || !geaendert() || !angemeldet();
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
    var el = ev.target.closest('[data-tat="breite"], [data-tat="hoehe"], [data-tat="fuellen"]');
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

    if (art === 'fuellen') {
      var zelle = block.cells[0];
      var voll = node.getBoundingClientRect();
      move(function (ev2) {
        var pct = Math.round((ev2.clientX - voll.left) / voll.width * 100);
        pct = Math.max(10, Math.min(100, pct));
        zelle.fill = pct === 100 ? undefined : pct;
        if (zelle.fill === undefined) delete zelle.fill;
        var fig = node.querySelector('.work-cell');
        if (fig) fig.style.setProperty('--w', pct + '%');
        el.style.left = pct + '%';
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
      '사진 고르기 <span><label class="lay-waehler-neu">사진 올리기' +
      '<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label> ' +
      '<button type="button" class="lay-waehler-zu">닫기</button></span></p>' +
      '<div class="lay-waehler-gitter">' + bilder.map(function (src) {
        return '<button type="button" data-src="' + esc(src) + '"><img src="' + esc(src) +
               '" loading="lazy" alt=""></button>';
      }).join('') + '</div>' +
      '<p class="lay-waehler-fuss" data-rolle="fuss">올린 사진은 바로 쓸 수 있습니다. ' +
      '사진 크기는 3MB까지입니다.</p></div>';
    document.body.appendChild(kasten);

    var fuss = kasten.querySelector('[data-rolle="fuss"]');
    kasten.querySelector('.lay-waehler-neu input').addEventListener('change', function (ev) {
      var datei = ev.target.files && ev.target.files[0];
      if (!datei) return;
      if (datei.size > 3 * 1024 * 1024) {
        fuss.textContent = '이 사진은 ' + Math.round(datei.size / 1048576 * 10) / 10 +
          'MB 라 올릴 수 없습니다 (3MB까지). 더 작은 파일로 올려주세요.';
        return;
      }
      fuss.textContent = '올리는 중…';
      var leser = new FileReader();
      leser.onload = function () {
        // Nur der Teil hinter dem Komma ist der Inhalt
        var daten = String(leser.result).split(',')[1] || '';
        fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ ordner: W.slug, name: datei.name, typ: datei.type, daten: daten })
        }).then(function (r) {
          return r.json().then(function (d) { return { status: r.status, d: d }; });
        }).then(function (a) {
          if (a.status === 200) {
            kasten.remove();
            fertig(a.d.pfad);
            return;
          }
          if (a.status === 409) {
            fuss.textContent = '같은 이름의 사진이 이미 있습니다. 파일 이름을 바꿔서 올려주세요.';
          } else if (a.status === 401) {
            fuss.textContent = '로그인이 풀렸습니다. 새로고침한 뒤 다시 로그인해 주세요.';
          } else if (a.d && a.d.fehler === 'kein-bild') {
            fuss.textContent = '사진 파일이 아닙니다 (jpg, png, webp 만 됩니다).';
          } else {
            fuss.textContent = '올리지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
          }
        }).catch(function () {
          fuss.textContent = '올리지 못했습니다 — 인터넷 연결을 확인해 주세요.';
        });
      };
      leser.readAsDataURL(datei);
    });

    kasten.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-src]');
      if (b) { kasten.remove(); fertig('/' + b.getAttribute('data-src')); return; }
      if (ev.target.closest('.lay-waehler-zu') || ev.target === kasten) kasten.remove();
    });
  }

  // ------------------------------------------------------------- Anmeldung
  /* Der Zugang liegt in einem HttpOnly-Cookie, das dieses Skript nicht lesen
     kann - genau das ist der Punkt. Ob jemand angemeldet ist, verraet ein
     zweites, harmloses Cookie mit dem Namen. */
  function angemeldet() {
    return /(^|;\s*)bp_wer=/.test(document.cookie);
  }

  function werBinIch() {
    var m = /(^|;\s*)bp_wer=([^;]*)/.exec(document.cookie);
    return m ? decodeURIComponent(m[2]) : '';
  }

  function anmeldeStand() {
    if (!tokenBox) return;
    var da = angemeldet();
    tokenBox.setAttribute('data-hat', da ? '1' : '');
    var s = tokenBox.querySelector('.lay-key-stand');
    if (s) s.textContent = da ? werBinIch() + ' 로 로그인됨' : '로그인하면 저장할 수 있습니다';
  }

  if (tokenBox) {
    var ab = tokenBox.querySelector('.lay-key-weg');
    if (ab) ab.addEventListener('click', function () {
      document.cookie = 'bp_wer=; Path=/; Max-Age=0';
      // Das eigentliche Cookie kann nur der Server loeschen.
      location.href = '/api/logout';
    });
    anmeldeStand();
  }

  // ---------------------------------------------------------------- Speichern
  function melden(text, schlecht) {
    check.textContent = text;
    if (schlecht) check.setAttribute('data-bad', '1');
    else check.removeAttribute('data-bad');
  }

  /* Geschrieben wird ueber /api/save auf derselben Adresse. Der GitHub-Zugang
     bleibt dort; hier geht nur raus, was angezeigt wird. Die Funktion laesst
     ausserdem nur content/works/<slug>.json zu und prueft die Form - ein
     abhanden gekommenes Cookie kann so nicht das Repo umschreiben. */
  function speichern() {
    if (!angemeldet() || !geaendert() || sperre) return;
    sperre = true; stand();
    melden('저장하는 중…');

    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ slug: W.slug, blocks: W.blocks })
    }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, d: d }; });
    }).then(function (a) {
      if (a.status === 200) {
        sauber = JSON.stringify(W.blocks);
        if (a.d.gleich) { melden('바뀐 것이 없습니다.'); sperre = false; stand(); return; }
        melden('저장했습니다 · 사이트를 다시 만드는 중입니다 (보통 1~2분)');
        stand();
        warten(0);
        setTimeout(function () { sperre = false; stand(); }, 10000);
        return;
      }
      sperre = false; stand();
      if (a.status === 401) { anmeldeStand(); melden('로그인이 풀렸습니다. 다시 로그인해 주세요.', 1); }
      else if (a.status === 409) melden('다른 곳에서 같은 작품이 수정되었습니다. 새로고침한 뒤 다시 해주세요.', 1);
      else if (a.d && a.d.fehler === 'form') melden('저장할 수 없는 모양입니다. 개발자에게 알려주세요.', 1);
      else melden('저장하지 못했습니다. 고친 내용은 그대로 있습니다.', 1);
    }).catch(function () {
      sperre = false; stand();
      melden('저장하지 못했습니다 — 인터넷 연결을 확인해 주세요.', 1);
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

  if (saveBtn) saveBtn.addEventListener('click', function () { speichern(); });

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

  /* Neue Arbeit anlegen. Sie entsteht leer - Titel und Jahr genuegen, alles
     weitere macht die Kuenstlerin danach hier im Editor.

     Mehrere Arbeiten teilen sich einen Titel (die vier "Haeutung"), und der
     Titel bestimmt die Adresse. Taucht sie schon auf, fragt das Fenster nach
     einem unterscheidenden Wort statt die bestehende Arbeit zu ueberschreiben. */
  function neueArbeit() {
    var kasten = document.createElement('div');
    kasten.className = 'lay-waehler';
    kasten.innerHTML =
      '<div class="lay-waehler-innen neu-arbeit">' +
      '<p class="lay-waehler-kopf">새 작품 만들기' +
      '<button type="button" class="lay-waehler-zu">닫기</button></p>' +
      '<div class="seiten-feld"><label class="seiten-label">제목 (독일어)</label>' +
      '<input class="seiten-ein" data-f="title" placeholder="Übergabe"></div>' +
      '<div class="seiten-feld"><label class="seiten-label">제목 (영어)</label>' +
      '<input class="seiten-ein" data-f="title_en" placeholder="Handover"></div>' +
      '<div class="seiten-feld"><label class="seiten-label">연도</label>' +
      '<input class="seiten-ein" data-f="year" type="number" value="' +
      new Date().getFullYear() + '"></div>' +
      '<div class="seiten-feld" data-rolle="zusatz" hidden>' +
      '<label class="seiten-label">구분할 말</label>' +
      '<input class="seiten-ein" data-f="suffix" placeholder="Kleiderbügel">' +
      '<p class="seiten-hinweis">같은 제목의 작품이 이미 있습니다. ' +
      '재료처럼 구분할 말을 덧붙여 주세요.</p></div>' +
      '<p class="lay-waehler-fuss" data-rolle="fuss">만들면 빈 작품이 생기고 ' +
      '바로 그 화면으로 넘어갑니다.</p>' +
      '<p><button type="button" class="layout-save" data-rolle="los">만들기</button></p>' +
      '</div>';
    document.body.appendChild(kasten);

    var fuss = kasten.querySelector('[data-rolle="fuss"]');
    var los = kasten.querySelector('[data-rolle="los"]');
    var feld = function (n) { return kasten.querySelector('[data-f="' + n + '"]'); };

    function zu() { kasten.remove(); sel.value = W ? 'w:' + W.slug : sel.options[0].value; }
    kasten.addEventListener('click', function (ev) {
      if (ev.target.closest('.lay-waehler-zu') || ev.target === kasten) zu();
    });

    los.addEventListener('click', function () {
      var titel = feld('title').value.trim();
      var jahr = Number(feld('year').value);
      if (!titel) { fuss.textContent = '제목을 적어 주세요.'; return; }
      if (!(jahr >= 1900 && jahr <= 2999)) { fuss.textContent = '연도를 확인해 주세요.'; return; }

      // Innerhalb eines Jahres sortiert "order"; die neue Arbeit kommt ans Ende.
      var hoechste = 0;
      [].forEach.call(sel.querySelectorAll('option[data-year]'), function (o) {
        if (+o.getAttribute('data-year') === jahr) {
          hoechste = Math.max(hoechste, +o.getAttribute('data-order') || 0);
        }
      });

      los.disabled = true;
      fuss.textContent = '만드는 중…';
      fetch('/api/new-work', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: titel, title_en: feld('title_en').value.trim(), year: jahr,
          order: hoechste + 1, suffix: feld('suffix').value.trim()
        })
      }).then(function (r) {
        return r.json().then(function (d) { return { status: r.status, d: d }; });
      }).then(function (a) {
        los.disabled = false;
        if (a.status === 200) {
          // Die Werkseite entsteht erst mit dem naechsten Aufbau; bis dahin
          // laesst sich die Arbeit hier schon fuellen.
          sauber = W ? JSON.stringify(W.blocks) : '';
          location.href = 'admin-layout.html?w=' + a.d.slug;
          return;
        }
        if (a.status === 409) {
          kasten.querySelector('[data-rolle="zusatz"]').hidden = false;
          fuss.textContent = '같은 주소(' + a.d.slug + ')가 이미 있습니다.';
          feld('suffix').focus();
        } else if (a.status === 401) {
          fuss.textContent = '로그인이 풀렸습니다. 새로고침한 뒤 다시 로그인해 주세요.';
        } else {
          fuss.textContent = '만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
        }
      }).catch(function () {
        los.disabled = false;
        fuss.textContent = '만들지 못했습니다 — 인터넷 연결을 확인해 주세요.';
      });
    });
  }

  // ------------------------------------------------------------------ Laden
  function laden(slug) {
    if (W && geaendert() && !confirm('저장하지 않은 변경이 있습니다. 버리고 넘어갈까요?')) {
      sel.value = 'w:' + W.slug;
      return;
    }
    var option = sel.querySelector('option[value="w:' + CSS.escape(slug) + '"]') ||
                 sel.querySelector('option[data-path]');
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
        if (history.replaceState) {
          history.replaceState(null, '', '?w=' + option.value.replace(/^w:/, ''));
        }
      })
      .catch(function () {
        if (meine !== ladung) return;
        state.textContent = '불러오지 못했습니다';
        stage.innerHTML = '';
        melden('작품을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.', 1);
      });
  }

  sel.addEventListener('change', function () {
    var o = sel.options[sel.selectedIndex];
    // Die Auswahl fuehrt auch auf das Formular fuer Lebenslauf und Startseite.
    // Beides sind eigene Adressen - die eine traegt eine Buehne, die andere ein
    // Formular - aber zum Wechseln soll dieses eine Feld reichen.
    if (o.value === 'neu') { neueArbeit(); return; }
    if (!o.getAttribute('data-path')) {
      if (geaendert() && !confirm('저장하지 않은 변경이 있습니다. 버리고 넘어갈까요?')) {
        sel.value = 'w:' + W.slug;
        return;
      }
      sauber = JSON.stringify(W.blocks);         // beforeunload nicht ausloesen
      location.href = o.getAttribute('data-href');
      return;
    }
    laden(o.value.replace(/^w:/, ''));
  });

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
