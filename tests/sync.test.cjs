'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'supabase-sync.js'), 'utf8');
const hook = '  window.IVORY37CloudSync =';
assert.ok(source.includes(hook), 'sync test hook point exists');

function createSyncHarness() {
  const values = new Map();
  const listeners = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    key(index) { return Array.from(values.keys())[index] || null; },
    get length() { return values.size; }
  };
  const window = {
    IVORY37_SUPABASE_CONFIG: {},
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatchEvent(event) { const listener = listeners.get(event.type); if (listener) listener(event); }
  };
  const instrumented = source.replace(hook, '  window.__syncTestCore = { mergeData: mergeData, normalizeData: normalizeData, sharedBaseSnapshot: function () { return sharedBaseSnapshot; } };\n' + hook);
  vm.runInNewContext(instrumented, {
    window,
    document: { querySelector() { return null; } },
    localStorage,
    navigator: { onLine: false },
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options && options.detail; } },
    console: { warn() {}, error() {}, log() {} },
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {}
  }, { filename: 'supabase-sync.js' });
  return { sync: window.IVORY37CloudSync, core: window.__syncTestCore, localStorage };
}

const base = {
  jornadas: [{ id: 'j-1', fecha: '2026-11-16', entrada: '08:00', salida: '16:00', horas_extra: 0, notas: '' }],
  viajes: [{ id: 'v-1', fecha: '2026-11-16', concepto: 'Obra A', importe: 12 }],
  pagos: [], ausencias: [], ajustes: []
};
const key = (collection, id) => collection + '|' + id;
const metadata = (modified, deleted) => ({ modified: modified || {}, deleted: deleted || {} });
const plain = value => JSON.parse(JSON.stringify(value));

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

test('concurrent edits retain the newer version and expose the alternate', () => {
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
  assert.equal(merged.jornadas[0].notas, 'Cambio del ordenador');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].winner, 'remote');
  assert.equal(result.conflicts[0].alternate.notas, 'Cambio del móvil');
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
