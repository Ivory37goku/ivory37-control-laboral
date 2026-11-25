'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'supabase-sync.js'), 'utf8');
const hook = '  window.IVORY37CloudSync =';
assert.ok(source.includes(hook), 'sync test hook point exists');

function createSyncHarness(options) {
  const values = new Map();
  const listeners = new Map();
  const events = [];
  const statusElement = { textContent: '', dataset: {} };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    key(index) { return Array.from(values.keys())[index] || null; },
    get length() { return values.size; }
  };
  const window = {
    IVORY37_SUPABASE_CONFIG: {},
    addEventListener(name, listener) { const list = listeners.get(name) || []; list.push(listener); listeners.set(name, list); },
    dispatchEvent(event) { events.push(event); (listeners.get(event.type) || []).forEach(listener => listener(event)); }
  };
  const instrumented = source.replace(hook, '  window.__syncTestCore = { bindButtons: bindButtons, validSignupPassword: validSignupPassword, assertSyncOwner: assertSyncOwner, readCredentials: readCredentials, mergeData: mergeData, normalizeData: normalizeData, sharedBaseSnapshot: function () { return sharedBaseSnapshot; }, sameBusinessRecord: sameBusinessRecord, removeNoopConflicts: removeNoopConflicts, signature: signature, applyMerged: applyMerged, syncNow: syncNow, performSync: performSync, setSyncContext: function (testClient, testSession) { client = testClient; session = testSession; } };\n' + hook);
  vm.runInNewContext(instrumented, {
    window,
    document: { querySelector(selector) { return selector === '#cloud-status' ? statusElement : (options && options.fields && options.fields[selector]) || null; } },
    localStorage,
    navigator: { onLine: Boolean(options && options.online) },
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options && options.detail; } },
    console: { warn() {}, error() {}, log() {} },
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {}
  }, { filename: 'supabase-sync.js' });
  return { sync: window.IVORY37CloudSync, core: window.__syncTestCore, localStorage, statusElement, events };
}

const base = {
  jornadas: [{ id: 'j-1', fecha: '2026-11-16', entrada: '08:00', salida: '16:00', horas_extra: 0, notas: '' }],
  viajes: [{ id: 'v-1', fecha: '2026-11-16', concepto: 'Obra A', importe: 12 }],
  pagos: [], ausencias: [], ajustes: []
};
const key = (collection, id) => collection + '|' + id;
const metadata = (modified, deleted) => ({ modified: modified || {}, deleted: deleted || {} });
const plain = value => JSON.parse(JSON.stringify(value));

test('offline installments reconcile by ID and competing edits retain unrelated receipts', () => {
  const { mergeData } = createSyncHarness().core;
  const meta = { modified: {}, deleted: {} };
  const row = (id, importe) => ({ id, importe, fecha: '2026-11-10' });
  const data = abonos => ({ pagos: [{ id: 'payroll', tipo: 'nomina_auto', importe: 1000, abonos }] });
  const base = data([row('existing', 50)]);
  const addResult = mergeData(data([row('existing', 50), row('mobile', 100)]), data([row('existing', 50), row('pc', 200)]), meta, meta, base);
  assert.equal(addResult.data.pagos[0].abonos.reduce((sum, part) => sum + part.importe, 0), 350);
  assert.equal(addResult.conflicts.length, 0);
  const conflictResult = mergeData(data([row('existing', 60), row('mobile', 100)]), data([row('existing', 70), row('pc', 200)]), meta, meta, base);
  assert.equal(conflictResult.conflicts.length, 1);
  assert.equal(conflictResult.conflicts[0].chosen.abonos.reduce((sum, part) => sum + part.importe, 0), 360);
  assert.equal(conflictResult.conflicts[0].alternate.abonos.reduce((sum, part) => sum + part.importe, 0), 370);
  const deletion = mergeData(data([]), data([row('existing', 50), row('pc', 200)]), meta, meta, base);
  assert.equal(deletion.data.pagos[0].abonos.map(part => part.id).join(','), 'pc');
  assert.equal(deletion.conflicts.length, 0);
});

test('field-by-field resolution preserves the selected mix and refuses to overwrite a newer edit', () => {
  const { core, sync, localStorage } = createSyncHarness();
  const local = { ...base, jornadas: [{ ...base.jornadas[0], salida: '17:00' }] };
  const remote = { ...base, jornadas: [{ ...base.jornadas[0], notas: 'Desde PC' }] };
  const merged = core.mergeData(local, remote, metadata(), metadata(), base);
  const conflict = merged.conflicts[0];
  localStorage.setItem('ivory37_cloud_sync_conflicts_v1', JSON.stringify([conflict]));
  const storageKey = '工V龱尺ㄚ㇌7_data_v1';
  const mixed = { ...conflict.chosen, notas: 'Desde PC' };
  localStorage.setItem(storageKey, JSON.stringify({ ...local, jornadas: [{ ...local.jornadas[0], salida: '18:00' }] }));
  assert.equal(sync.resolveConflict(conflict.id, mixed), false);
  localStorage.setItem(storageKey, JSON.stringify(local));
  assert.equal(sync.resolveConflict(conflict.id, mixed), true);
  const [saved] = JSON.parse(localStorage.getItem(storageKey)).jornadas;
  assert.equal(saved.salida, '17:00');
  assert.equal(saved.notas, 'Desde PC');
});

test('logical revisions advance past an observed future clock for edits and deletions', () => {
  const h = createSyncHarness();
  const future = 9000000000000;
  h.localStorage.setItem('ivory37_cloud_sync_meta_v1', JSON.stringify(metadata({ unrelated: future })));
  h.localStorage.setItem('工V龱尺ㄚ㇌7_data_v1', JSON.stringify(base));
  h.sync.init(base);
  const edited = plain(base); edited.jornadas[0].horas_extra = 2;
  h.sync.queue(edited);
  const first = JSON.parse(h.localStorage.getItem('ivory37_cloud_sync_meta_v1')).modified[key('jornadas', 'j-1')];
  assert.ok(first > future);
  h.sync.queue({ ...edited, jornadas: [] });
  assert.ok(JSON.parse(h.localStorage.getItem('ivory37_cloud_sync_meta_v1')).deleted[key('jornadas', 'j-1')] > first);
});

test('password recovery verifies identity, clears secrets and changes password only for the requested account', async () => {
  for (const mismatch of [false, true]) {
    const handlers = {};
    const fields = {
      '#cloud-reset': { addEventListener(_, fn) { handlers.reset = fn; } },
      '#cloud-update-password': { addEventListener(_, fn) { handlers.update = fn; } },
      '#cloud-email': { value: 'test@example.com' },
      '#cloud-recovery-token': { value: '123456' },
      '#cloud-new-password': { value: 'SafePassword123!' }
    };
    const h = createSyncHarness({ fields }); const calls = [];
    h.core.setSyncContext({ auth: {
      async resetPasswordForEmail(email) { calls.push(['reset', email]); return {}; },
      async verifyOtp(options) { calls.push(['verify', options.type]); assert.equal(fields['#cloud-recovery-token'].value, ''); assert.equal(fields['#cloud-new-password'].value, ''); return {}; },
      async getUser() { return { data: { user: { email: mismatch ? 'someone@example.com' : 'test@example.com' } } }; },
      async updateUser(options) { calls.push(['update', options.password]); return {}; },
      async signOut() { calls.push(['logout']); return {}; }
    } }, null);
    h.core.bindButtons(); await handlers.reset(); await handlers.update();
    assert.equal(calls.some(call => call[0] === 'update'), !mismatch);
    assert.deepEqual(calls.at(-1), ['logout']);
  }
});

test('offline queue records local edits and deletions without replacing local data', () => {
  const harness = createSyncHarness();
  harness.localStorage.setItem('工V龱尺ㄚ㇌7_data_v1', JSON.stringify(base));
  harness.sync.init(base);

  const edited = plain(base);
  edited.jornadas[0].horas_extra = 1.5;
  harness.sync.queue(edited);
  let meta = JSON.parse(harness.localStorage.getItem('ivory37_cloud_sync_meta_v1'));
  assert.ok(meta.modified[key('jornadas', 'j-1')] > 0);
  assert.deepEqual(JSON.parse(harness.localStorage.getItem('工V龱尺ㄚ㇌7_data_v1')), base);

  harness.sync.queue({ ...edited, jornadas: [] });
  meta = JSON.parse(harness.localStorage.getItem('ivory37_cloud_sync_meta_v1'));
  assert.ok(meta.deleted[key('jornadas', 'j-1')] > 0);
});

test('local edits do not advance the last shared cloud base before sync', () => {
  const harness = createSyncHarness();
  harness.localStorage.setItem('工V龱尺ㄚ㇌7_data_v1', JSON.stringify(base));
  harness.sync.init(base);

  const local = plain(base);
  const remote = plain(base);
  local.jornadas[0].notas = 'Cambio del móvil';
  remote.jornadas[0].notas = 'Cambio del ordenador';
  harness.sync.queue(local);

  assert.deepEqual(plain(harness.core.sharedBaseSnapshot()), base);
  const localMeta = JSON.parse(harness.localStorage.getItem('ivory37_cloud_sync_meta_v1'));
  const result = harness.core.mergeData(
    local, remote, localMeta,
    metadata({ [key('jornadas', 'j-1')]: Number(localMeta.modified[key('jornadas', 'j-1')]) + 1 }),
    harness.core.sharedBaseSnapshot()
  );
  assert.equal(result.conflicts.length, 1);
});

test('independent edits from two devices merge without losing either record', () => {
  const local = plain(base);
  const remote = plain(base);
  local.jornadas[0].notas = 'Local';
  remote.viajes[0].concepto = 'Obra B';
  const result = createSyncHarness().core.mergeData(
    local, remote,
    metadata({ [key('jornadas', 'j-1')]: 20 }),
    metadata({ [key('viajes', 'v-1')]: 30 }),
    base
  );
  const merged = plain(result.data);
  assert.equal(merged.jornadas[0].notas, 'Local');
  assert.equal(merged.viajes[0].concepto, 'Obra B');
  assert.equal(result.conflicts.length, 0);
});

test('concurrent edits retain the local version and expose the cloud alternative', () => {
  const local = plain(base);
  const remote = plain(base);
  local.jornadas[0].notas = 'Cambio del móvil';
  remote.jornadas[0].notas = 'Cambio del ordenador';
  const result = createSyncHarness().core.mergeData(
    local, remote,
    metadata({ [key('jornadas', 'j-1')]: 100 }),
    metadata({ [key('jornadas', 'j-1')]: 200 }),
    base
  );
  const merged = plain(result.data);
  assert.equal(merged.jornadas[0].notas, 'Cambio del móvil');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].winner, 'local');
  assert.equal(result.conflicts[0].alternate.notas, 'Cambio del ordenador');
});

test('a local edit beats an unchanged cloud copy even when its revision clock is ahead', () => {
  const local = plain(base);
  const remote = plain(base);
  local.jornadas[0].horas_extra = 1.5;
  const futureRemoteClock = Date.now() + 60000;
  const result = createSyncHarness().core.mergeData(
    local, remote,
    metadata({ [key('jornadas', 'j-1')]: 10 }),
    metadata({ [key('jornadas', 'j-1')]: futureRemoteClock }),
    base
  );
  assert.equal(plain(result.data).jornadas[0].horas_extra, 1.5);
  assert.equal(result.conflicts.length, 0);
  assert.ok(result.meta.modified[key('jornadas', 'j-1')] > futureRemoteClock);
});

test('a local edit restores a record against a stale cloud tombstone', () => {
  const local = plain(base);
  const remote = { jornadas: [], viajes: [], pagos: [], ausencias: [], ajustes: [] };
  local.jornadas[0].horas_extra = 1.5;
  const tombstone = Date.now() + 60000;
  const result = createSyncHarness().core.mergeData(
    local, remote,
    metadata({ [key('jornadas', 'j-1')]: 10 }),
    metadata({}, { [key('jornadas', 'j-1')]: tombstone }),
    base
  );
  assert.equal(plain(result.data).jornadas[0].horas_extra, 1.5);
  assert.equal(Object.hasOwn(plain(result.meta).deleted, key('jornadas', 'j-1')), false);
  assert.ok(plain(result.meta).modified[key('jornadas', 'j-1')] > tombstone);
});

test('device timestamps and object key order do not create false conflicts', () => {
  const local = plain(base);
  const remote = plain(base);
  local.jornadas[0].creado = '2026-11-17T08:00:00.000Z';
  remote.jornadas[0].creado = '2026-11-18T08:00:00.000Z';
  local.jornadas[0] = Object.fromEntries(Object.entries(local.jornadas[0]).reverse());
  const result = createSyncHarness().core.mergeData(
    local, remote,
    metadata({ [key('jornadas', 'j-1')]: 100 }),
    metadata({ [key('jornadas', 'j-1')]: 200 }),
    base
  );
  assert.equal(result.conflicts.length, 0);
});

test('a missing default pause and zero minutes are the same cloud record', () => {
  const core = createSyncHarness().core;
  const oldRecord = { id: 'j-1', fecha: '2026-06-30', horas_normales: 8, horas_extra: 0, notas: 'Confirmada' };
  const newRecord = { ...oldRecord, descanso_minutos: 0 };
  assert.equal(core.sameBusinessRecord(oldRecord, newRecord), true);
  assert.equal(core.signature({ jornadas: [oldRecord] }), core.signature({ jornadas: [newRecord] }));
  assert.equal(Object.hasOwn(plain(core.normalizeData({ jornadas: [newRecord] })).jornadas[0], 'descanso_minutos'), false);
  assert.equal(core.removeNoopConflicts([{
    id: 'jornadas|j-1:old', collection: 'jornadas', itemId: 'j-1', chosen: oldRecord, alternate: newRecord, createdAt: 1
  }]).length, 0);
});

test('nonzero pause remains meaningful and concurrent changes are still reported', () => {
  const core = createSyncHarness().core;
  const oldRecord = { id: 'j-1', fecha: '2026-06-30', horas_normales: 8, horas_extra: 0, notas: 'Confirmada' };
  const pauseRecord = { ...oldRecord, descanso_minutos: 30 };
  assert.equal(core.sameBusinessRecord(oldRecord, pauseRecord), false);
  assert.equal(core.removeNoopConflicts([{
    id: 'jornadas|j-1:pause', collection: 'jornadas', itemId: 'j-1', chosen: oldRecord, alternate: pauseRecord, createdAt: 1
  }]).length, 1);

  const local = { jornadas: [{ ...oldRecord, notas: 'Editada en el móvil' }], viajes: [], pagos: [], ausencias: [] };
  const remote = { jornadas: [{ ...oldRecord, notas: 'Editada en el ordenador', descanso_minutos: 30 }], viajes: [], pagos: [], ausencias: [] };
  const result = core.mergeData(
    local, remote,
    metadata({ [key('jornadas', 'j-1')]: 100 }),
    metadata({ [key('jornadas', 'j-1')]: 200 }),
    { jornadas: [oldRecord], viajes: [], pagos: [], ausencias: [] }
  );
  assert.equal(result.conflicts.length, 1);
  assert.equal(plain(result.conflicts[0].chosen).notas, 'Editada en el móvil');
  assert.equal(plain(result.conflicts[0].alternate).descanso_minutos, 30);
});

test('historical conflicts with only creation metadata differences are removed safely', () => {
  const core = createSyncHarness().core;
  const chosen = { id: 'j-1', fecha: '2026-06-30', horas_normales: 8, horas_extra: 0, notas: '[CONFIRMADO] Jornada estándar verificada.', creado: '2026-11-17T08:00:00.000Z' };
  const alternate = { ...chosen, creado: '2026-11-18T08:00:00.000Z' };
  const noOpConflict = { id: 'jornadas|j-1:1:2', collection: 'jornadas', itemId: 'j-1', chosen, alternate, createdAt: 1 };
  assert.equal(core.removeNoopConflicts([noOpConflict]).length, 0);
  assert.equal(core.removeNoopConflicts([{ ...noOpConflict, alternate: { ...alternate, horas_extra: 1 } }]).length, 1);
});

test('initialization clears old zero-pause conflicts and keeps real conflicts', () => {
  const harness = createSyncHarness();
  const chosen = { id: 'j-1', fecha: '2026-06-30', descanso_minutos: 0 };
  const noOpConflict = { id: 'jornadas|j-1:zero', collection: 'jornadas', itemId: 'j-1', chosen, alternate: { id: 'j-1', fecha: '2026-06-30' }, createdAt: 1 };
  const realConflict = { ...noOpConflict, id: 'jornadas|j-1:real', alternate: { ...chosen, descanso_minutos: 30 } };
  harness.localStorage.setItem('ivory37_cloud_sync_conflicts_v1', JSON.stringify([noOpConflict, realConflict]));

  harness.sync.init(base);

  const remaining = JSON.parse(harness.localStorage.getItem('ivory37_cloud_sync_conflicts_v1'));
  assert.deepEqual(remaining.map(item => item.id), [realConflict.id]);
});

test('cloud apply signature ignores key order and device timestamps but keeps work-hour changes', () => {
  const core = createSyncHarness().core;
  const local = { jornadas: [{ id: 'j-1', fecha: '2026-06-30', horas_normales: 8, horas_extra: 0, notas: 'Confirmada', creado: '2026-11-17T08:00:00.000Z' }] };
  const remote = { jornadas: [{ notas: 'Confirmada', horas_extra: 0, horas_normales: 8, fecha: '2026-06-30', id: 'j-1', creado: '2026-11-18T08:00:00.000Z' }] };
  assert.equal(core.signature(local), core.signature(remote));
  remote.jornadas[0].horas_extra = 1;
  assert.notEqual(core.signature(local), core.signature(remote));
});

test('applying an equivalent cloud record does not emit a re-queue event', () => {
  const harness = createSyncHarness();
  const keyName = '工V龱尺ㄚ㇌7_data_v1';
  const local = { jornadas: [{ id: 'j-1', fecha: '2026-06-30', horas_normales: 8, horas_extra: 0, notas: 'Confirmada', creado: '2026-11-17T08:00:00.000Z' }] };
  const remote = { jornadas: [{ notas: 'Confirmada', horas_extra: 0, horas_normales: 8, fecha: '2026-06-30', id: 'j-1', creado: '2026-11-18T08:00:00.000Z' }] };
  harness.localStorage.setItem(keyName, JSON.stringify(local));

  harness.core.applyMerged({ data: remote, meta: { modified: {}, deleted: {} } });

  assert.equal(harness.events.filter(event => event.type === 'ivory37:cloud-data').length, 0);
});

test('a quiet no-op cloud poll leaves the successful status unchanged', async () => {
  const harness = createSyncHarness();
  const payload = { jornadas: [], viajes: [], pagos: [], ausencias: [], ajustes: [], _ivory37_sync: { modified: {}, deleted: {} }, _ivory37_conflicts: [] };
  const testClient = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user', email: 'test@example.com' } } }, error: null }) },
    from() {
      const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: { payload, revision: 1 }, error: null }) };
      return query;
    }
  };
  harness.core.setSyncContext(testClient, { user: { id: 'test-user', email: 'test@example.com' } });
  harness.statusElement.textContent = 'Sincronizado · 07:39';
  harness.statusElement.dataset.state = 'ok';

  await harness.core.syncNow({ quiet: true });

  assert.equal(harness.statusElement.textContent, 'Sincronizado · 07:39');
  assert.equal(harness.statusElement.dataset.state, 'ok');
});

test('quiet background sync still surfaces actual cloud failures', async () => {
  const harness = createSyncHarness({ online: true });
  const testClient = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user', email: 'test@example.com' } } }, error: null }) },
    from() {
      const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: null, error: new Error('network unavailable') }) };
      return query;
    }
  };
  harness.core.setSyncContext(testClient, { user: { id: 'test-user', email: 'test@example.com' } });

  await harness.core.syncNow({ quiet: true });

  assert.equal(harness.statusElement.dataset.state, 'error');
  assert.match(harness.statusElement.textContent, /No se pudo sincronizar/);
});

test('a jornada saved during an in-flight sync is not replaced by the earlier snapshot', async () => {
  const harness = createSyncHarness({ online: true });
  const localKey = '工V龱尺ㄚ㇌7_data_v1';
  harness.localStorage.setItem(localKey, JSON.stringify(base));
  harness.sync.init(base);

  let releaseFirstFetch;
  let markFirstFetchStarted;
  const firstFetchStarted = new Promise(resolve => { markFirstFetchStarted = resolve; });
  const firstFetchGate = new Promise(resolve => { releaseFirstFetch = resolve; });
  let releaseFirstWrite;
  let markFirstWriteStarted;
  const firstWriteStarted = new Promise(resolve => { markFirstWriteStarted = resolve; });
  const firstWriteGate = new Promise(resolve => { releaseFirstWrite = resolve; });
  let fetchCount = 0;
  let writeCount = 0;
  let remoteRow = {
    payload: { ...plain(base), _ivory37_sync: metadata(), _ivory37_conflicts: [] },
    revision: 1
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user', email: 'test@example.com' } } }, error: null }) },
    from() {
      let mode = 'select';
      let writePayload = null;
      let expectedRevision = null;
      const query = {
        select() { return query; },
        update(payload) { mode = 'update'; writePayload = payload; return query; },
        insert(payload) { mode = 'insert'; writePayload = payload; return query; },
        eq(column, value) { if (column === 'revision') expectedRevision = value; return query; },
        async maybeSingle() {
          if (mode === 'select') {
            fetchCount += 1;
            if (fetchCount === 1) { markFirstFetchStarted(); await firstFetchGate; }
            return { data: remoteRow, error: null };
          }
          if (mode === 'update') {
            writeCount += 1;
            if (writeCount === 1) { markFirstWriteStarted(); await firstWriteGate; }
            if (!remoteRow || remoteRow.revision !== expectedRevision) return { data: null, error: null };
            remoteRow = { payload: writePayload.payload, revision: remoteRow.revision + 1 };
            return { data: { revision: remoteRow.revision }, error: null };
          }
          remoteRow = { payload: writePayload.payload, revision: 1 };
          return { data: { revision: remoteRow.revision }, error: null };
        }
      };
      return query;
    }
  };
  harness.core.setSyncContext(client, { user: { id: 'test-user', email: 'test@example.com' } });

  const syncing = harness.sync.syncNow({ quiet: true });
  await firstFetchStarted;
  const newlySaved = plain(base);
  newlySaved.jornadas.push({ id: 'j-2', fecha: '2026-11-17', entrada: '08:00', salida: '16:00', horas_normales: 8, horas_extra: 0, notas: '' });
  harness.localStorage.setItem(localKey, JSON.stringify(newlySaved));
  harness.sync.queue(newlySaved);
  releaseFirstFetch();
  await firstWriteStarted;
  const secondSaveDuringWrite = plain(newlySaved);
  secondSaveDuringWrite.jornadas.push({ id: 'j-3', fecha: '2026-11-18', entrada: '08:00', salida: '16:00', horas_normales: 8, horas_extra: 0, notas: '' });
  harness.localStorage.setItem(localKey, JSON.stringify(secondSaveDuringWrite));
  harness.sync.queue(secondSaveDuringWrite);
  releaseFirstWrite();
  await syncing;

  const retained = JSON.parse(harness.localStorage.getItem(localKey)).jornadas;
  assert.ok(retained.some(item => item.id === 'j-2'));
  assert.ok(retained.some(item => item.id === 'j-3'));
  assert.ok(remoteRow.payload.jornadas.some(item => item.id === 'j-2'));
  assert.ok(remoteRow.payload.jornadas.some(item => item.id === 'j-3'));
  assert.equal(fetchCount, 3);
  assert.equal(harness.events.filter(event => event.type === 'ivory37:cloud-data').length, 0);
});

test('a later tombstone wins over an older edit; a newer edit restores the record', () => {
  const empty = { jornadas: [], viajes: [], pagos: [], ausencias: [], ajustes: [] };
  const remoteEdit = plain(base);
  remoteEdit.jornadas[0].notas = 'Editado en otro dispositivo';
  const deletedFirst = createSyncHarness().core.mergeData(
    empty, remoteEdit,
    metadata({}, { [key('jornadas', 'j-1')]: 300 }),
    metadata({ [key('jornadas', 'j-1')]: 200 }),
    base
  );
  assert.equal(plain(deletedFirst.data).jornadas.length, 0);

  const editAfterDelete = createSyncHarness().core.mergeData(
    empty, remoteEdit,
    metadata({}, { [key('jornadas', 'j-1')]: 100 }),
    metadata({ [key('jornadas', 'j-1')]: 300 }),
    base
  );
  assert.equal(plain(editAfterDelete.data).jornadas[0].notas, 'Editado en otro dispositivo');
});


test('a second account cannot sync the first account local dataset', () => {
  const qa = createSyncHarness();
  qa.core.setSyncContext({}, { user: { id: 'account-a' } });
  qa.core.assertSyncOwner('account-a');
  qa.core.setSyncContext({}, { user: { id: 'account-b' } });
  assert.throws(() => qa.core.assertSyncOwner('account-b'), /otra cuenta/);
  assert.equal(qa.localStorage.getItem('ivory37_cloud_sync_owner_v1'), 'account-a');
  assert.throws(() => qa.core.assertSyncOwner('account-a'), /cuenta ha cambiado/);
});


test('reading login credentials clears the password field before the network request', () => {
  const fields = { '#cloud-email': { value: ' user@example.com ' }, '#cloud-password': { value: 'test-only-password' } };
  const qa = createSyncHarness({ fields });
  const credentials = qa.core.readCredentials();
  assert.equal(credentials.email, 'user@example.com');
  assert.equal(credentials.password, 'test-only-password');
  assert.equal(fields['#cloud-password'].value, '');
});

test('signing out during a cloud read prevents applying or uploading its result', async () => {
  const qa = createSyncHarness({ online: true });
  qa.localStorage.setItem('工V龱尺ㄚ㇌7_data_v1', JSON.stringify(base));
  qa.sync.init(base);
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const fetched = new Promise(resolve => { started = resolve; });
  const session = { user: { id: 'account-a' } };
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() {
    started(); await gate; return { data: { payload: base, revision: 1 }, error: null };
  } };
  const client = { auth: { getSession: async () => ({ data: { session } }) }, from: () => query };
  qa.core.setSyncContext(client, session);
  const pending = qa.sync.syncNow();
  await fetched;
  qa.core.setSyncContext(client, null);
  release();
  await pending;
  assert.match(qa.statusElement.textContent, /cuenta ha cambiado/);
  assert.equal(qa.events.length, 0);
  assert.deepEqual(JSON.parse(qa.localStorage.getItem('工V龱尺ㄚ㇌7_data_v1')), base);
});


test('a late getSession response cannot resurrect a signed-out session or bind its data', async () => {
  const qa = createSyncHarness({ online: true });
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const fetched = new Promise(resolve => { started = resolve; });
  const session = { user: { id: 'account-a' } };
  let queries = 0;
  const client = { auth: { getSession: async () => { started(); await gate; return { data: { session } }; } },
    from: () => { queries++; throw new Error('unexpected data access'); } };
  qa.core.setSyncContext(client, session);
  const pending = qa.sync.syncNow();
  await fetched;
  qa.core.setSyncContext(client, null);
  release(); await pending;
  assert.equal(queries, 0);
  assert.equal(qa.localStorage.getItem('ivory37_cloud_sync_owner_v1'), null);
  assert.match(qa.statusElement.textContent, /sesión ha cambiado/);
});


test('new accounts require the server password policy without changing existing login validation', () => {
  const qa = createSyncHarness();
  for (const value of ['short', 'abcdefghijklmn', 'ABCDEFGHIJKLMN', 'Abcdefghijkl12', 'Abcd1234!']) {
    assert.equal(qa.core.validSignupPassword(value), false, value);
  }
  assert.equal(qa.core.validSignupPassword('TestOnly!2026Long'), true);
  assert.equal(qa.core.validSignupPassword('TestOnly2026Long' + String.fromCharCode(92)), true);
  assert.match(source, /if \(!credentials.email \|\| !credentials.password\)/);
});
