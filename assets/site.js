/* Menuknopf auf dem Telefon.
   Ohne JavaScript bleibt das Panel offen (siehe site.css), damit die
   Navigation in jedem Fall erreichbar ist. */
(function () {
  var masthead = document.querySelector('.masthead');
  var toggle = document.querySelector('.nav-toggle');
  var panel = document.getElementById('hauptmenue');
  if (!masthead || !toggle || !panel) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü');
    panel.setAttribute('data-open', String(open));
    masthead.setAttribute('data-open', String(open));
    document.documentElement.classList.toggle('nav-open', open);
  }

  masthead.setAttribute('data-js', 'true');
  setOpen(false);

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
})();

/* Werkliste unter "Work" auf- und zuklappen.
   Auf einer Werkseite kommt sie bereits offen aus dem Generator; sonst merkt
   sich der Browser die letzte Entscheidung fuer die Dauer des Besuchs. */
(function () {
  var branch = document.querySelector('.nav-branch');
  var list = document.getElementById('werkliste');
  if (!branch || !list) return;

  var KEY = 'bp-werkliste';

  function setOpen(open, remember) {
    branch.setAttribute('aria-expanded', String(open));
    list.setAttribute('data-open', String(open));
    if (remember) {
      try {
        sessionStorage.setItem(KEY, open ? '1' : '0');
      } catch (err) {
        /* privater Modus: gilt nur fuer diese Seite */
      }
    }
  }

  var stored = null;
  try {
    stored = sessionStorage.getItem(KEY);
  } catch (err) {
    stored = null;
  }
  // auf der Werkseite bleibt die Liste offen, auch wenn sie zuletzt zu war
  if (stored === '1' || (stored === '0' && branch.getAttribute('aria-expanded') === 'true')) {
    setOpen(true, false);
  }

  branch.addEventListener('click', function () {
    setOpen(branch.getAttribute('aria-expanded') !== 'true', true);
  });
})();

/* Sprachumschaltung DE / EN.
   Jedes Element mit data-de und data-en tauscht seinen Text;
   die Wahl bleibt im Browser gespeichert. */
(function () {
  var STORAGE_KEY = 'bp-lang';
  var buttons = document.querySelectorAll('[data-set-lang]');

  function applyLang(lang) {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang));
    });
    document.querySelectorAll('[data-de][data-en]').forEach(function (el) {
      el.textContent = el.getAttribute('data-' + lang);
    });
  }

  var saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    saved = null;
  }
  if (saved === 'de' || saved === 'en') {
    applyLang(saved);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lang = btn.getAttribute('data-set-lang');
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (err) {
        /* Privater Modus: Auswahl gilt nur für diese Seite */
      }
      applyLang(lang);
    });
  });
})();

/* Bildschutz: Rechtsklick, Ziehen und Speichern-/Drucken-Kuerzel auf den
   Werkbildern sperren; waehrend einer moeglichen Bildschirmaufnahme die Bilder
   verschleiern. Eine Bildschirmaufnahme laesst sich im Browser nicht wirklich
   verhindern (macOS/Windows/Telefon nehmen sie am System vorbei auf) - das hier
   macht es nur umstaendlich. Das Aussehen steht in site.css unter "Bildschutz". */
(function () {
  var root = document.documentElement;
  var IMAGES = '.hero-thumb, .work-figures, .hero-work';

  function onImage(target) {
    return target && target.closest && target.closest(IMAGES);
  }

  document.addEventListener('contextmenu', function (event) {
    if (onImage(event.target)) event.preventDefault();
  });

  document.addEventListener('dragstart', function (event) {
    if (onImage(event.target)) event.preventDefault();
  });

  function shield(on) {
    root.classList.toggle('bp-shield', on);
  }

  document.addEventListener('keydown', function (event) {
    var key = (event.key || '').toLowerCase();
    var mod = event.metaKey || event.ctrlKey;
    // Seite speichern / drucken / Quelltext
    if (mod && (key === 's' || key === 'p' || key === 'u')) {
      event.preventDefault();
      return;
    }
    // Cmd+Shift (macOS 3/4/5) und Win+Shift+S (Windows): die Zahl bzw. das S
    // erreicht den Browser nicht mehr, darum schon beim Modifier verschleiern
    if (event.shiftKey && event.metaKey) shield(true);
    if (key === 'printscreen') shield(true);
  });

  document.addEventListener('keyup', function (event) {
    if ((event.key || '').toLowerCase() === 'printscreen') {
      // die Taste meldet sich erst nach der Aufnahme: Zwischenablage leeren
      try {
        navigator.clipboard.writeText('');
      } catch (err) {
        /* ohne Clipboard-API nichts zu tun */
      }
    }
    if (!event.metaKey && !event.shiftKey) shield(false);
  });

  // nach Cmd+Shift+4 kommt das keyup oft nicht an: die naechste Mausbewegung
  // ohne Modifier hebt den Schleier wieder auf
  document.addEventListener('mousemove', function (event) {
    if (!event.metaKey && !event.shiftKey &&
        root.classList.contains('bp-shield')) shield(false);
  });
})();
