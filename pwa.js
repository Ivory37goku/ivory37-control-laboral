/* PWA: Service Worker, Instalación y Actualización */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  var updateBanner = document.getElementById('pwa-update-banner');
  var updateBtn = document.getElementById('pwa-update-btn');
  var installBtn = document.getElementById('pwa-install-btn');
  var waitingWorker = null;
  var appVersion = (document.querySelector('meta[name="app-version"]') || {}).content || '0.0.0';
  var deferredPrompt = null;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var nativeAndroid = Boolean(window.AndroidBridge);
  var nativeDesktop = Boolean(window.IVORY37DesktopBridge);
  var nativeWrapper = nativeAndroid || nativeDesktop;
  var hostedApp = location.hostname === 'ivory37goku.github.io' && location.pathname.indexOf('/ivory37-control-laboral/') === 0;
  if (installBtn && nativeWrapper) { installBtn.classList.remove('show'); installBtn.hidden = true; }
  else if (installBtn && !standalone) installBtn.classList.add('show');
  if (nativeAndroid && !hostedApp) return;
  function hideUpdate() { if (updateBanner) updateBanner.classList.remove('show'); }
  function compareVersions(left, right) {
    var a = String(left || '').match(/\d+/g) || [];
    var b = String(right || '').match(/\d+/g) || [];
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var diff = Number(a[i] || 0) - Number(b[i] || 0);
      if (diff) return diff > 0 ? 1 : -1;
    }
    return 0;
  }
  function readWorkerVersion(worker) {
    return new Promise(function (resolve) {
      if (!worker || typeof MessageChannel !== 'function') { resolve(''); return; }
      var channel = new MessageChannel();
      var timeout = setTimeout(function () { channel.port1.close(); resolve(''); }, 1500);
      channel.port1.onmessage = function (event) {
        clearTimeout(timeout);
        channel.port1.close();
        resolve(event.data && typeof event.data.version === 'string' ? event.data.version : '');
      };
      try { worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]); }
      catch (_) { clearTimeout(timeout); channel.port1.close(); resolve(''); }
    });
  }
  function inspectWaitingWorker(worker) {
    waitingWorker = null;
    hideUpdate();
    readWorkerVersion(worker).then(function (version) {
      if (!version || compareVersions(version, appVersion) <= 0) return;
      waitingWorker = worker;
      scheduleSafeUpdate();
    });
  }
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (reg) {
    if (reg.waiting) inspectWaitingWorker(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', function () {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) inspectWaitingWorker(newWorker);
      });
    });
    reg.update().catch(function () {});
  }).catch(function (err) { console.warn('SW error:', err); });
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (refreshing) return; refreshing = true; window.location.reload(); });
  function safeToUpdate() {
    var modal = document.getElementById('modal');
    if (modal && !modal.hidden) return false;
    var focused = document.activeElement;
    if (focused && focused.matches && focused.matches('input,textarea,select,[contenteditable="true"]')) return false;
    var settings = document.querySelector('[data-tab-panel="ajustes"]');
    if (settings && !settings.hidden) return false;
    return true;
  }
  function scheduleSafeUpdate() {
    if (!waitingWorker || !safeToUpdate()) { hideUpdate(); return; }
    // No reiniciar la aplicación automáticamente: el usuario decide cuándo actualizar.
    if (updateBanner) updateBanner.classList.add('show');
  }
  if (updateBtn) { updateBtn.addEventListener('click', function () { if (waitingWorker && safeToUpdate()) waitingWorker.postMessage({ type: 'SKIP_WAITING' }); else if (waitingWorker) window.alert('Cierra el formulario antes de actualizar.'); }); }
  window.setInterval(scheduleSafeUpdate, 8000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') scheduleSafeUpdate(); });
  document.addEventListener('click', function () { setTimeout(scheduleSafeUpdate, 0); }, true);
  document.addEventListener('focusin', function () { setTimeout(scheduleSafeUpdate, 0); });
  document.addEventListener('focusout', function () { setTimeout(scheduleSafeUpdate, 0); });
  document.addEventListener('click', function (event) { if (event.target.closest && event.target.closest('.nav button')) setTimeout(scheduleSafeUpdate, 400); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); if (nativeWrapper) return; deferredPrompt = e; if (installBtn) installBtn.classList.add('show'); });
  function showInstallHelp() {
    var ua = navigator.userAgent || '';
    var isiOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var message = isiOS
      ? 'En Safari, toca Compartir y elige «Añadir a pantalla de inicio».'
      : 'Abre el menú del navegador y elige «Instalar app» o «Añadir a pantalla principal». Usa la dirección segura de GitHub Pages.';
    window.alert(message);
  }
  if (installBtn && !nativeWrapper) { installBtn.addEventListener('click', function () {
    if (!deferredPrompt) { showInstallHelp(); return; }
    var promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();
    promptEvent.userChoice.then(function (choice) { if (choice.outcome === 'accepted') installBtn.classList.remove('show'); });
  }); }
  window.addEventListener('appinstalled', function () { deferredPrompt = null; if (installBtn) installBtn.classList.remove('show'); });
})();
