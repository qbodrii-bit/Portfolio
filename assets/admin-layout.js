/* Layout-Editor, Schritt 2: zeigt die Bloecke einer Arbeit an.
   Noch ohne Knoepfe und ohne Speichern - das kommt in Schritt 3.

   Wichtig: dieses Skript baut dasselbe HTML wie scripts/wire-content.py
   (cell_html / block_html) und laedt dasselbe assets/site.css. Nur so sieht
   der Editor aus wie die fertige Seite. Bei Aenderungen an einer der beiden
   Stellen die andere mitziehen - pruefen() unten vergleicht beide bei jedem
   Laden und meldet sich, wenn sie auseinanderlaufen. */
(function () {
  'use strict';

  var sel = document.getElementById('werk');
  var stage = document.getElementById('buehne');
  var state = document.getElementById('zustand');
  var check = document.getElementById('pruefung');
  if (!sel || !stage) return;

  var lang = 'de';
  var sizes = {};
  // Zaehler gegen verspaetete Antworten: wer beim Eintreffen nicht mehr der
  // aktuelle Ladevorgang ist, schreibt nichts mehr. Ohne das ueberschreibt
  // beim schnellen Blaettern die Antwort der vorigen Arbeit die neue Anzeige.
  var ladung = 0;

  // ---------------------------------------------------------------- Helfer
  function asInt(value, lo, hi) {                 // = as_int() in wire-content.py
    var n = Math.round(Number(value));
    if (!isFinite(n)) return null;
    return Math.max(lo, Math.min(hi, n));
  }

  function asAlign(value) {                       // = as_align()
    return value === 'left' || value === 'center' || value === 'right' ? value : null;
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

  function dims(src) {                            // = dims()
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

  // ------------------------------------------------- Bloecke -> HTML
  // Zeile fuer Zeile dasselbe wie cell_html() / block_html() in wire-content.py
  function cellHtml(cell, work) {
    var ratio = asInt(cell.w, 1, 100);
    var style = { col: ratio === null ? null : ratio };

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
             ' loading="lazy" alt="' + esc(altText(work)) + '">' + cap + '\n' +
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

  function blockHtml(block, work) {
    if (block.t === 'gap') {
      return '    <div class="work-space" style="--h: ' + block.h + 'px"></div>';
    }
    var gap = asInt(block.gap, 0, 400);
    if (gap === null) gap = 16;                   // = GAP_DEFAULT
    var cols = block.cells.map(function (c) {
      return (asInt(c.w, 1, 100) || 1) + 'fr';
    }).join(' ');
    var mark = block.va === 'center' ? ' data-va="center"' : '';
    var cells = block.cells.map(function (c) { return cellHtml(c, work); }).join('\n');
    return '    <div class="work-row"' + mark + ' style="--gap: ' + gap + 'px; --cols: ' +
           cols + '">\n' + cells + '\n    </div>';
  }

  function altText(work) {                        // = alt()
    return work.title + ', ' + (work.year_label || work.year || '') + ' — Boram Park';
  }

  // ------------------------------------------------------------ Anzeigen
  function applyLang() {
    stage.querySelectorAll('[data-de][data-en]').forEach(function (el) {
      el.textContent = el.getAttribute('data-' + lang);
    });
  }

  function label(block) {
    if (block.t === 'gap') return '여백 ' + block.h + 'px';
    var n = block.cells.length;
    var kinds = block.cells.map(function (c) { return c.t === 'img' ? '사진' : '글'; });
    return '줄 · ' + n + '칸 (' + kinds.join(' + ') + ')';
  }

  function render(work) {
    // Erst das reine HTML - genau das, was wire-content.py schreiben wuerde.
    // Es wird zurueckgegeben, damit pruefen() den unberuehrten Stand vergleicht.
    var plain = work.blocks.map(function (b) { return blockHtml(b, work); }).join('\n');
    stage.innerHTML = plain;
    // Umrisse und Beschriftung kommen erst danach dazu und liegen ueber dem
    // Inhalt (outline/absolute), damit sie den Aufbau nicht verschieben.
    var nodes = stage.children;
    work.blocks.forEach(function (b, i) {
      var el = nodes[i];
      if (!el) return;
      el.classList.add('layout-block');
      el.setAttribute('data-kind', b.t);
      el.setAttribute('data-label', label(b));
    });
    applyLang();
    return plain;
  }

  /* Laeuft bei jedem Laden: vergleicht das hier gebaute HTML mit dem, was
     wire-content.py fuer dieselbe Arbeit geschrieben hat. Weicht es ab, sind
     Editor und Seitenbau auseinandergelaufen - genau das soll nie unbemerkt
     passieren. */
  function pruefen(option, mine, meine) {
    check.textContent = '';
    check.removeAttribute('data-bad');
    fetch(option.dataset.page, { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.text() : null;
    }).then(function (html) {
      if (!html || meine !== ladung) return;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var real = doc.querySelector('.work-blocks');
      if (!real) return;
      // Beide Seiten durch denselben Parser schicken. Ein roher String gegen
      // innerHTML zu vergleichen geht schief: der Browser gibt beim Auslesen
      // z.B. &#x27; wieder als ' aus, der gebaute String behaelt die Entitaet.
      var huelse = doc.createElement('div');
      huelse.innerHTML = mine;
      var a = real.innerHTML.replace(/\s+/g, ' ').trim();
      var b = huelse.innerHTML.replace(/\s+/g, ' ').trim();
      if (a === b) {
        check.textContent = '이 화면은 실제 작품 페이지와 같은 내용입니다.';
      } else {
        check.textContent = '주의: 이 화면이 실제 작품 페이지와 다릅니다. 개발자에게 알려주세요.';
        check.setAttribute('data-bad', '1');
        if (window.console) console.warn('[layout] editor != seite\n--- seite ---\n' + a +
                                         '\n--- editor ---\n' + b);
      }
    }).catch(function () { /* offline: still bleiben, die Anzeige stimmt trotzdem */ });
  }

  // -------------------------------------------------------------- Laden
  function load(slug) {
    var option = sel.querySelector('option[value="' + CSS.escape(slug) + '"]');
    if (!option) option = sel.options[0];
    sel.value = option.value;
    state.textContent = '불러오는 중…';
    stage.innerHTML = '';
    check.textContent = '';
    var meine = ++ladung;

    fetch(option.dataset.path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (work) {
      if (meine !== ladung) return;             // inzwischen andere Arbeit gewaehlt
      work.blocks = cleanBlocks(work.blocks);
      if (!work.blocks.length) {
        state.textContent = '내용이 없습니다';
        stage.innerHTML = '<p class="layout-note">이 작품에는 아직 아무것도 없습니다. ' +
                          '사진은 Pages CMS에서 올립니다.</p>';
        return;
      }
      var plain = render(work);
      var rows = work.blocks.filter(function (b) { return b.t === 'row'; }).length;
      var imgs = work.blocks.reduce(function (n, b) {
        return n + (b.t === 'row' ? b.cells.filter(function (c) { return c.t === 'img'; }).length : 0);
      }, 0);
      state.textContent = rows + '줄 · 사진 ' + imgs + '장';
      pruefen(option, plain, meine);
      if (history.replaceState) history.replaceState(null, '', '?w=' + option.value);
    }).catch(function () {
      if (meine !== ladung) return;
      state.textContent = '불러오지 못했습니다';
      stage.innerHTML = '<p class="layout-note">작품을 불러오지 못했습니다. ' +
                        '인터넷 연결을 확인하고 새로고침해 주세요.</p>';
    });
  }

  sel.addEventListener('change', function () { load(sel.value); });

  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-set-lang');
      document.querySelectorAll('[data-set-lang]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      applyLang();
    });
  });

  // Bildmasse zuerst - ohne sie fehlen width/height und der Deckel --max,
  // und der Vergleich mit der echten Seite schlaege faelschlich an.
  fetch('content/images/_sizes.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (data) {
      sizes = data || {};
      var want = new URLSearchParams(location.search).get('w') || '';
      load(want);
    });
}());
