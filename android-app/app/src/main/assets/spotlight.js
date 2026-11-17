/* Spotlight del hero */
(function () {
  'use strict';
  var raf = null;
  document.addEventListener('pointermove', function (e) {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      var hero = document.querySelector('[data-tab-panel="dashboard"] .dash-hero');
      if (!hero) return;
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      hero.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
})();
