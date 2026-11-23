/* Durable application storage. Auth credentials remain in the SDK's own storage. */
(function () {
  'use strict';
  const legacy = window.localStorage;
  const mainKey = '工V龱尺ㄚ㇌7_data_v1';
  const ownedKeys = new Set([mainKey, mainKey + '_backup', mainKey + '_backup_date', mainKey + '_recovery',
    '工V龱尺ㄚ㇌7_reminder', 'ivory37_local_lock_v1', 'ivory37_cloud_sync_owner_v1',
    'ivory37_cloud_sync_meta_v1', 'ivory37_cloud_sync_snapshot_v1', 'ivory37_cloud_sync_base_v1', 'ivory37_cloud_sync_conflicts_v1']);
  const owned = key => ownedKeys.has(key);
  const values = new Map();
  let committed = new Map();
  let database;
  let pending = new Map();
  let active = null;
  let timer;
  let ready = false;
  const signal = (state, error) => window.dispatchEvent(new CustomEvent('ivory37:storage-state', { detail: { state, error: error && error.message } }));
  const transaction = (mode, operation) => new Promise((resolve, reject) => {
    const tx = database.transaction('kv', mode);
    let reason;
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(reason || tx.error || new Error('No se pudo guardar en el dispositivo.'));
    try { operation(tx.objectStore('kv'), tx, error => { reason = error; tx.abort(); }); }
    catch (error) { reason = error; tx.abort(); }
  });
  const api = {
    get isReady() { return ready; },
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) {
      key = String(key);
      if (!ready || !owned(key)) throw new Error('Almacenamiento no preparado o clave no permitida.');
      value = String(value); values.set(key, value); pending.set(key, value);
      signal('pending'); clearTimeout(timer);
      timer = setTimeout(() => api.flush().catch(() => {}), 0);
    },
    removeItem(key) { key = String(key); if (!owned(key)) return; values.delete(key); pending.set(key, null); clearTimeout(timer); timer = setTimeout(() => api.flush().catch(() => {}), 0); },
    clear() { for (const key of [...values.keys()]) api.removeItem(key); },
    rollback() { pending.clear(); values.clear(); for (const [key, value] of committed) values.set(key, value); },
    async flush() {
      await api.ready;
      if (active) { await active; if (pending.size) return api.flush(); return; }
      if (!pending.size) return;
      const batch = new Map(pending); pending.clear();
      active = transaction('readwrite', (store, tx, abort) => {
        for (const [key, value] of batch) {
          if (key === '工V龱尺ㄚ㇌7_data_v1') {
            const check = store.get(key);
            check.onsuccess = () => {
              if ((check.result ?? null) !== (committed.get(key) ?? null)) {
                abort(new Error('Otra ventana ha cambiado los datos. Recarga antes de guardar.'));
              } else if (value === null) store.delete(key); else store.put(value, key);
            };
          } else if (value === null) store.delete(key); else store.put(value, key);
        }
      });
      try {
        await active;
        for (const [key, value] of batch) { if (value === null) committed.delete(key); else committed.set(key, value); }
        signal('saved');
      } catch (error) {
        for (const [key, value] of batch) if (!pending.has(key)) pending.set(key, value);
        signal('error', error); throw error;
      } finally { active = null; }
      if (pending.size) return api.flush();
    }
  };
  api.ready = (async () => {
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('control-laboral-durable-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Cierra las otras ventanas para preparar el almacenamiento.'));
    });
    database.onversionchange = () => database.close();
    await transaction('readonly', store => {
      const request = store.openCursor();
      request.onsuccess = () => { const cursor = request.result; if (cursor) { values.set(cursor.key, cursor.value); cursor.continue(); } };
    });
    const migration = new Map();
    for (let index = 0; index < legacy.length; index++) {
      const key = legacy.key(index);
      if (key && owned(key) && !values.has(key)) migration.set(key, legacy.getItem(key));
    }
    if (migration.size) {
      await transaction('readwrite', store => { for (const [key, value] of migration) store.put(value, key); });
      // Read back every migrated value before reclaiming localStorage space.
      await transaction('readonly', (store, tx, abort) => {
        for (const [key, value] of migration) { const request = store.get(key); request.onsuccess = () => { if (request.result !== value) abort(new Error('No se pudo verificar la migración.')); }; }
      });
      for (const [key, value] of migration) values.set(key, value);
    }
    // Only remove legacy copies whose durable counterpart was verified.
    for (const [key, value] of values) if (legacy.getItem(key) === value) legacy.removeItem(key);
    committed = new Map(values); ready = true; signal('saved');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  })();
  api.ready.catch(error => signal('error', error));
  window.IVORY37Storage = api;
})();
