/* Sincronización privada entre PWA, APK y EXE. Requiere auth y RLS en Supabase. */
(function () {
  'use strict';

  var LOCAL_KEY = '工V龱尺ㄚ㇌7_data_v1';
  var META_KEY = 'ivory37_cloud_sync_meta_v1';
  var SNAPSHOT_KEY = 'ivory37_cloud_sync_snapshot_v1';
  var config = window.IVORY37_SUPABASE_CONFIG || {};
  var client = null;
  var initialized = false;
  var session = null;
  var snapshot = null;
  var meta = { modified: {}, deleted: {} };
  var syncTimer = null;
  var pollTimer = null;
  var inFlight = null;
  var rerun = false;
  var channel = null;
  var lastSuccess = 0;

  var $ = function (selector) { return document.querySelector(selector); };
  var clone = function (value) { return JSON.parse(JSON.stringify(value)); };

  function showStatus(message, state) {
    var el = $('#cloud-status');
    if (!el) return;
    el.textContent = message;
    el.dataset.state = state || 'neutral';
  }

  function showUser(email) {
    var el = $('#cloud-user');
    if (el) el.textContent = email ? 'Conectado como ' + email : 'No has iniciado sesión.';
    var login = $('#cloud-login');
    var signup = $('#cloud-signup');
    var logout = $('#cloud-logout');
    var sync = $('#cloud-now');
    if (login) login.hidden = Boolean(email);
    if (signup) signup.hidden = Boolean(email);
    if (logout) logout.hidden = !email;
    if (sync) sync.hidden = !email;
  }

  function setBusy(busy) {
    ['#cloud-signup', '#cloud-login', '#cloud-logout', '#cloud-now'].forEach(function (selector) {
      var button = $(selector);
      if (button) button.disabled = Boolean(busy);
    });
  }

  function readJson(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn('No se pudo guardar el estado local de sincronización:', error); }
  }

  function normalizeData(input) {
    var obj = input && typeof input === 'object' ? input : {};
    var arrays = ['jornadas', 'viajes', 'pagos'];
    var out = {};
    arrays.forEach(function (key) { out[key] = Array.isArray(obj[key]) ? obj[key].filter(function (row) { return row && row.id != null; }) : []; });
    out.ajustes = Array.isArray(obj.ajustes) ? obj.ajustes.filter(function (row) { return row && typeof row.clave === 'string'; }) : [];
    out.jornadas.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
    out.viajes.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
    out.pagos.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
    out.ajustes.sort(function (a, b) { return a.clave.localeCompare(b.clave); });
    return out;
  }

  function signature(data) { return JSON.stringify(normalizeData(data)); }
  function syncKey(collection, id) { return collection + '|' + String(id); }

  function stableMeta(value) {
    var valueMeta = cleanMeta(value);
    var stable = { modified: {}, deleted: {} };
    ['modified', 'deleted'].forEach(function (kind) {
      Object.keys(valueMeta[kind]).sort().forEach(function (key) { stable[kind][key] = valueMeta[kind][key]; });
    });
    return stable;
  }

  function payloadSignature(payload) {
    return JSON.stringify({ data: normalizeData(payload), meta: stableMeta(payload && payload._ivory37_sync) });
  }

  function cleanMeta(value) {
    var input = value && typeof value === 'object' ? value : {};
    var clean = { modified: {}, deleted: {} };
    ['modified', 'deleted'].forEach(function (kind) {
      var source = input[kind] && typeof input[kind] === 'object' ? input[kind] : {};
      Object.keys(source).slice(0, 100000).forEach(function (key) {
        var time = Number(source[key]);
        if (Number.isFinite(time) && time > 0) clean[kind][key] = Math.floor(time);
      });
    });
    return clean;
  }

  function persistTracking() {
    writeJson(META_KEY, meta);
    writeJson(SNAPSHOT_KEY, snapshot);
  }

  function itemMap(data, collection) {
    var map = new Map();
    (data[collection] || []).forEach(function (item) {
      var id = collection === 'ajustes' ? item.clave : item.id;
      if (id != null) map.set(String(id), item);
    });
    return map;
  }

  function trackLocalChanges(value) {
    var current = normalizeData(value);
    if (!snapshot) {
      snapshot = current;
      persistTracking();
      return;
    }
    var now = Date.now();
    ['jornadas', 'viajes', 'pagos', 'ajustes'].forEach(function (collection) {
      var before = itemMap(snapshot, collection);
      var after = itemMap(current, collection);
      var ids = new Set(Array.from(before.keys()).concat(Array.from(after.keys())));
      ids.forEach(function (id) {
        var key = syncKey(collection, id);
        var oldItem = before.get(id);
        var newItem = after.get(id);
        if (!newItem && oldItem) {
          meta.deleted[key] = Math.max(now, (meta.deleted[key] || 0) + 1);
        } else if (newItem && (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem))) {
          meta.modified[key] = Math.max(now, (meta.modified[key] || 0) + 1);
        }
      });
    });
    snapshot = current;
    persistTracking();
  }

  function extractMeta(payload) {
    return cleanMeta(payload && payload._ivory37_sync);
  }

  function maxMaps(left, right) {
    var result = { modified: {}, deleted: {} };
    ['modified', 'deleted'].forEach(function (kind) {
      var keys = new Set(Object.keys(left[kind] || {}).concat(Object.keys(right[kind] || {})));
      keys.forEach(function (key) {
        var time = Math.max(Number(left[kind][key] || 0), Number(right[kind][key] || 0));
        if (time > 0) result[kind][key] = time;
      });
    });
    return result;
  }

  function mergeData(localInput, remoteInput, localMeta, remoteMeta) {
    var local = normalizeData(localInput);
    var remote = normalizeData(remoteInput);
    var combinedMeta = maxMaps(localMeta, remoteMeta);
    var merged = { jornadas: [], viajes: [], pagos: [], ajustes: [] };
    ['jornadas', 'viajes', 'pagos', 'ajustes'].forEach(function (collection) {
      var localRows = itemMap(local, collection);
      var remoteRows = itemMap(remote, collection);
      var ids = new Set(Array.from(localRows.keys()).concat(Array.from(remoteRows.keys())));
      ids.forEach(function (id) {
        var key = syncKey(collection, id);
        var localItem = localRows.get(id);
        var remoteItem = remoteRows.get(id);
        var localRevision = Number(localMeta.modified[key] || 0);
        var remoteRevision = Number(remoteMeta.modified[key] || 0);
        var deletedAt = Number(combinedMeta.deleted[key] || 0);
        var selected = null;
        var selectedAt = 0;
        if (localItem && remoteItem) {
          if (localRevision >= remoteRevision) { selected = localItem; selectedAt = localRevision; }
          else { selected = remoteItem; selectedAt = remoteRevision; }
        } else if (localItem) { selected = localItem; selectedAt = localRevision; }
        else if (remoteItem) { selected = remoteItem; selectedAt = remoteRevision; }
        if (selected && deletedAt <= selectedAt) merged[collection].push(selected);
      });
    });
    return { data: normalizeData(merged), meta: combinedMeta };
  }

  function payloadFor(data, syncMeta) {
    var payload = normalizeData(data);
    payload._ivory37_sync = cleanMeta(syncMeta);
    return payload;
  }

  function applyMerged(result) {
    var current = normalizeData(readJson(LOCAL_KEY, {}));
    meta = cleanMeta(result.meta);
    snapshot = normalizeData(result.data);
    persistTracking();
    if (signature(current) !== signature(result.data)) {
      window.dispatchEvent(new CustomEvent('ivory37:cloud-data', { detail: clone(result.data) }));
    }
  }

  function closeChannel() {
    if (channel && client) {
      try { client.removeChannel(channel); } catch (_) {}
    }
    channel = null;
  }

  function watchUser(userId) {
    closeChannel();
    if (!client || !userId) return;
    channel = client.channel('ivory37-sync-' + userId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ivory37_sync', filter: 'user_id=eq.' + userId
      }, function () { scheduleSync(100); })
      .subscribe(function (status) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Realtime no disponible; se mantiene la comprobación periódica.');
      });
  }

  async function fetchRemote(userId) {
    var response = await client.from('ivory37_sync')
      .select('payload,revision,updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (response.error) throw response.error;
    return response.data || null;
  }

  async function writeRemote(userId, row, mergedPayload) {
    if (!row) {
      var inserted = await client.from('ivory37_sync')
        .insert({ user_id: userId, payload: mergedPayload })
        .select('revision')
        .maybeSingle();
      if (inserted.error) {
        if (inserted.error.code === '23505') return false;
        throw inserted.error;
      }
      return true;
    }
    var updated = await client.from('ivory37_sync')
      .update({ payload: mergedPayload })
      .eq('user_id', userId)
      .eq('revision', row.revision)
      .select('revision')
      .maybeSingle();
    if (updated.error) throw updated.error;
    return Boolean(updated.data);
  }

  async function performSync() {
    if (!client) return;
    var authResult = await client.auth.getSession();
    if (authResult.error) throw authResult.error;
    session = authResult.data && authResult.data.session;
    var user = session && session.user;
    showUser(user && user.email);
    if (!user) {
      showStatus('Sin sesión · los datos siguen guardándose en este dispositivo.', 'neutral');
      return;
    }

    for (var attempt = 0; attempt < 5; attempt++) {
      var local = normalizeData(readJson(LOCAL_KEY, {}));
      trackLocalChanges(local);
      var row = await fetchRemote(user.id);
      var remotePayload = row && row.payload && typeof row.payload === 'object' ? row.payload : {};
      var remoteMeta = extractMeta(remotePayload);
      var merged = mergeData(local, remotePayload, meta, remoteMeta);
      var mergedPayload = payloadFor(merged.data, merged.meta);
      var remoteSignature = payloadSignature(remotePayload || {});
      var mergedSignature = payloadSignature(mergedPayload);
      if (row && remoteSignature === mergedSignature) {
        applyMerged(merged);
        lastSuccess = Date.now();
        showStatus('Sincronizado · ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), 'ok');
        return;
      }
      var saved = await writeRemote(user.id, row, mergedPayload);
      if (!saved) continue;
      applyMerged(merged);
      lastSuccess = Date.now();
      showStatus('Sincronizado · ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), 'ok');
      return;
    }
    throw new Error('Hay cambios simultáneos en otro dispositivo. Pulsa «Sincronizar ahora» de nuevo.');
  }

  function syncNow() {
    if (!client || !session) {
      if (client) showStatus('Inicia sesión para sincronizar. Los datos locales están guardados.', 'neutral');
      return Promise.resolve();
    }
    if (inFlight) { rerun = true; return inFlight; }
    clearTimeout(syncTimer);
    setBusy(true);
    showStatus(navigator.onLine === false ? 'Sin conexión · los cambios quedan en cola local.' : 'Sincronizando…', 'busy');
    inFlight = performSync()
      .catch(function (error) {
        console.error('Sincronización IVORY37:', error);
        showStatus(navigator.onLine === false ? 'Sin conexión · cambios guardados localmente; se reintentarán al volver internet.' : 'No se pudo sincronizar: ' + (error.message || 'error de conexión'), 'error');
      })
      .finally(function () {
        inFlight = null;
        setBusy(false);
        if (rerun) { rerun = false; scheduleSync(100); }
      });
    return inFlight;
  }

  function scheduleSync(delay) {
    if (!client || !session) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, delay == null ? 700 : delay);
  }

  function queue(data) {
    if (!initialized || !data) return;
    trackLocalChanges(data);
    scheduleSync(700);
  }

  function readCredentials() {
    var email = $('#cloud-email');
    var password = $('#cloud-password');
    return { email: email ? email.value.trim() : '', password: password ? password.value : '' };
  }

  function friendlyAuthError(error) {
    var message = String(error && error.message || 'No se pudo completar la operación.');
    if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(message)) return 'Confirma tu correo desde el mensaje de Supabase y vuelve a iniciar sesión.';
    if (/already registered|user already registered/i.test(message)) return 'Ese correo ya tiene una cuenta. Usa «Iniciar sesión». ';
    if (/password should be at least/i.test(message)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/rate limit/i.test(message)) return 'Se alcanzó el límite temporal de correos. Inténtalo más tarde.';
    if (/email_address_not_authorized/i.test(message)) return 'Supabase solo permite enviar correos a miembros de tu organización con el servicio gratuito. Usa el correo de tu cuenta Supabase o configura SMTP.';
    if (/over_email_send_rate_limit/i.test(message)) return 'Se alcanzó el límite de correos de confirmación. Espera una hora antes de volver a intentarlo.';
    return message;
  }

  function bindButtons() {
    var signup = $('#cloud-signup');
    var login = $('#cloud-login');
    var logout = $('#cloud-logout');
    var sync = $('#cloud-now');
    if (signup) signup.addEventListener('click', async function () {
      var credentials = readCredentials();
      if (!credentials.email || credentials.password.length < 6) { showStatus('Escribe un correo válido y una contraseña de al menos 6 caracteres.', 'error'); return; }
      setBusy(true); showStatus('Creando la cuenta…', 'busy');
      try {
        var result = await client.auth.signUp({ email: credentials.email, password: credentials.password });
        if (result.error) throw result.error;
        var password = $('#cloud-password'); if (password) password.value = '';
        if (result.data && result.data.session) {
          session = result.data.session;
          showUser(session.user && session.user.email);
          watchUser(session.user && session.user.id);
          showStatus('Cuenta creada. Sincronizando tus datos…', 'ok');
          await syncNow();
        } else {
          showStatus('Cuenta creada. Abre el correo de confirmación y luego vuelve aquí para iniciar sesión.', 'ok');
        }
      } catch (error) { showStatus(friendlyAuthError(error), 'error'); }
      finally { setBusy(false); }
    });
    if (login) login.addEventListener('click', async function () {
      var credentials = readCredentials();
      if (!credentials.email || !credentials.password) { showStatus('Escribe tu correo y contraseña.', 'error'); return; }
      setBusy(true); showStatus('Iniciando sesión…', 'busy');
      try {
        var result = await client.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
        if (result.error) throw result.error;
        var password = $('#cloud-password'); if (password) password.value = '';
        session = result.data.session;
        showUser(session.user && session.user.email);
        watchUser(session.user && session.user.id);
        await syncNow();
      } catch (error) { showStatus(friendlyAuthError(error), 'error'); }
      finally { setBusy(false); }
    });
    if (logout) logout.addEventListener('click', async function () {
      setBusy(true);
      try {
        var result = await client.auth.signOut();
        if (result.error) throw result.error;
        session = null; closeChannel(); showUser('');
        showStatus('Sesión cerrada. Los datos locales siguen en este dispositivo.', 'neutral');
      } catch (error) { showStatus(friendlyAuthError(error), 'error'); }
      finally { setBusy(false); }
    });
    if (sync) sync.addEventListener('click', syncNow);
  }

  function init(initialData) {
    if (initialized) return;
    initialized = true;
    meta = cleanMeta(readJson(META_KEY, {}));
    snapshot = normalizeData(readJson(SNAPSHOT_KEY, initialData || readJson(LOCAL_KEY, {})));
    if (!readJson(SNAPSHOT_KEY, null)) { snapshot = normalizeData(initialData || {}); persistTracking(); }
    if (!config.url || !config.publishableKey || !window.supabase || !window.supabase.createClient) {
      showUser(''); showStatus('La sincronización no está configurada. Esta app seguirá guardando en local.', 'error');
      return;
    }
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    bindButtons();
    showUser('');
    showStatus('Preparando la sincronización segura…', 'busy');
    client.auth.onAuthStateChange(function (event, nextSession) {
      session = nextSession;
      var user = session && session.user;
      showUser(user && user.email);
      if (user) {
        watchUser(user.id);
        setTimeout(function () { syncNow(); }, 0);
      } else {
        closeChannel();
        showStatus('Sin sesión · los datos siguen guardándose en este dispositivo.', 'neutral');
      }
    });
    client.auth.getSession().then(function (result) {
      if (result.error) throw result.error;
      session = result.data && result.data.session;
      var user = session && session.user;
      showUser(user && user.email);
      if (user) { watchUser(user.id); syncNow(); }
      else showStatus('Inicia sesión o crea una cuenta para compartir tus datos.', 'neutral');
    }).catch(function (error) {
      console.warn('No se pudo recuperar la sesión de Supabase:', error);
      showStatus('Sin conexión o sesión no disponible. Los datos locales están guardados.', 'neutral');
    });
    pollTimer = setInterval(function () { if (session) syncNow(); }, 25000);
    window.addEventListener('online', function () { if (session) syncNow(); });
    window.addEventListener('focus', function () { if (session && Date.now() - lastSuccess > 5000) syncNow(); });
  }

  window.IVORY37CloudSync = { init: init, queue: queue, syncNow: syncNow };
  window.addEventListener('ivory37:cloud-data', function (event) {
    if (!event.detail) return;
    var current = normalizeData(event.detail);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(current)); }
    catch (error) { console.error('No se pudo guardar la copia local sincronizada:', error); }
  });
})();
