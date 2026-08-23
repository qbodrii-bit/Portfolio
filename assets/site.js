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
