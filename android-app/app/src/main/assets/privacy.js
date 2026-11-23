/* Optional local screen lock. This is not encryption of the device profile. */
(function () {
  'use strict';
  const storage = window.IVORY37Storage;
  const key = 'ivory37_local_lock_v1';
  let blockedUntil = 0;
  let failed = 0;
  let hiddenAt = 0;
  let locked = false;
  const bytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const base64 = value => btoa(String.fromCharCode(...new Uint8Array(value)));
  async function derive(pin, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    return base64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes(salt), iterations: 210000, hash: 'SHA-256' }, material, 256));
  }
  const config = () => { try { return JSON.parse(storage.getItem(key)); } catch (_) { return null; } };
  function lock() {
    if (locked || !config()) return;
    locked = true;
    const overlay = document.createElement('div'); overlay.id = 'privacy-overlay';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Desbloquear Control Laboral');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0d1613;display:grid;place-items:center;padding:24px';
    overlay.innerHTML = '<div style="width:min(100%,360px)"><h1>Control Laboral</h1><p>Introduce tu PIN local.</p><label class="field"><span>PIN</span><input class="input" id="privacy-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12"></label><button class="btn primary" id="privacy-unlock" type="button">Desbloquear</button><p id="privacy-error" role="status"></p><p class="hint">Este bloqueo protege la pantalla. No cifra los archivos del dispositivo. Guarda el PIN: no puede recuperarse desde la nube.</p></div>';
    for (const child of document.body.children) if (!['SCRIPT', 'STYLE'].includes(child.tagName)) child.inert = true;
    document.body.appendChild(overlay);
    document.getElementById('privacy-pin').focus();
    document.getElementById('privacy-unlock').onclick = async () => {
      const status = document.getElementById('privacy-error'); const input = document.getElementById('privacy-pin'); const pin = input.value; input.value = '';
      if (Date.now() < blockedUntil) { status.textContent = 'Espera 30 segundos antes de reintentar.'; return; }
      const current = config();
      if (!current || await derive(pin, current.salt) !== current.hash) {
        if (++failed >= 5) { blockedUntil = Date.now() + 30000; failed = 0; }
        status.textContent = 'PIN incorrecto.'; return;
      }
      locked = false; failed = 0; overlay.remove();
      for (const child of document.body.children) child.inert = false;
    };
  }
  storage.ready.then(() => {
    const host = document.getElementById('local-lock-settings');
    if (!host) return;
    host.innerHTML = '<h3>Bloqueo local opcional</h3><p class="hint">PIN de 6–12 cifras al abrir y tras 5 minutos fuera de la app. No sustituye el bloqueo del dispositivo ni cifra las copias.</p><label class="field"><span>PIN actual, para desactivar</span><input class="input" id="lock-current" type="password" inputmode="numeric" autocomplete="off" maxlength="12"></label><label class="field"><span>Nuevo PIN</span><input class="input" id="lock-new" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12"></label><label class="field"><span>Repite el nuevo PIN</span><input class="input" id="lock-confirm" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12"></label><button class="btn ghost sm" id="lock-enable" type="button">Activar o cambiar PIN</button> <button class="btn ghost sm" id="lock-disable" type="button">Desactivar PIN</button> <button class="btn ghost sm" id="lock-now" type="button">Bloquear ahora</button><p id="lock-status" role="status"></p>';
    const message = value => { document.getElementById('lock-status').textContent = value; };
    const checkCurrent = async () => {
      const current = config(); const field = document.getElementById('lock-current'); const pin = field.value; field.value = '';
      if (current && await derive(pin, current.salt) !== current.hash) throw new Error('Indica el PIN actual.');
    };
    document.getElementById('lock-enable').onclick = async () => {
      try {
        const input = document.getElementById('lock-new'); const confirm = document.getElementById('lock-confirm'); const pin = input.value; const repeated = confirm.value; input.value = confirm.value = '';
        if (!/^\d{6,12}$/.test(pin) || pin !== repeated) throw new Error('Los PIN deben coincidir y tener 6–12 cifras.');
        await checkCurrent();
        const salt = base64(crypto.getRandomValues(new Uint8Array(16)));
        storage.setItem(key, JSON.stringify({ salt, hash: await derive(pin, salt) })); await storage.flush(); message('PIN activado. Guárdalo en un lugar seguro.');
      } catch (error) { message(error.message); }
    };
    document.getElementById('lock-disable').onclick = async () => { try { await checkCurrent(); storage.removeItem(key); await storage.flush(); message('PIN desactivado.'); } catch (error) { message(error.message); } };
    document.getElementById('lock-now').onclick = lock;
    lock();
  }).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt >= 300000) lock(); });
})();
