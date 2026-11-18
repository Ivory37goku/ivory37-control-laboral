'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DATA_KEY = '工V龱尺ㄚ㇌7_data_v1';
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function appHarness(seed, options = {}) {
  const storage = new Map([[DATA_KEY, JSON.stringify(seed)]]);
  const listeners = new Map();
  const fields = new Map();
  const toasts = [];
  let failWrite = false;
  const window = {
    IVORY37DesktopBridge: options.desktop,
    IVORY37CloudSync: { queue() {} },
    addEventListener(name, handler) { listeners.set(name, handler); }
  };
  const localStorage = {
    get length() { return storage.size; },
    key(index) { return [...storage.keys()][index]; },
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) {
      if (failWrite && key === DATA_KEY) throw new Error('QuotaExceededError');
      storage.set(key, value);
    },
    clear() { storage.clear(); }
  };
  const suffix = '  init();\n})();';
  const source = read('app.js').replace(/\r\n/g, '\n');
  assert.ok(source.includes(suffix));
  const entry = `
    openModal = (options) => { window.dialog = options; };
    toast = (message) => window.notify(message);
    renderAll = renderAjustes = applyBranding = updateStorageUsage = () => {};
    data = loadData();
    window.qa = {
      jornadaModal, extraModal, tripModal, payrollModal, syncPayrolls, effectivePayments, totals,
      monthBreakdown, restoreNativeStorage,
      loadError: () => loadError,
      saved: () => JSON.parse(localStorage.getItem(KEY)),
      current: () => JSON.parse(JSON.stringify(data))
    };
  })();`;
  window.notify = (message) => toasts.push(message);
  const context = vm.createContext({
    window, localStorage, URLSearchParams,
    location: { protocol: 'file:', search: options.desktop ? '?nativeRestore=1' : '' },
    document: {
      querySelector(selector) { return fields.get(selector) || null; },
      addEventListener() {}
    },
    console: { warn() {}, error() {} }
  });
  for (const file of ['rates.js', 'calendar.js', 'work-hours.js', 'overtime-tools.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  vm.runInContext(source.replace(suffix, entry), context, { filename: 'app.js' });
  return {
    ...window.qa, toasts, get dialog() { return window.dialog; },
    fields(values) { for (const [id, value] of Object.entries(values)) fields.set('#' + id, { value: String(value) }); },
    cloud(data) { listeners.get('ivory37:cloud-data')({ detail: data }); },
    failWrites(value) { failWrite = value; }
  };
}

const shift = { id: 'jornada', fecha: '2026-11-04', entrada: '08:00', salida: '17:00', horas_normales: 8, horas_extra: 1,
  descanso_minutos: 0, estado: 'confirmado', notas: '', creado: '2026-11-04T17:00:00.000Z' };

function shiftFields(qa, extra = '2') {
  qa.fields({ 'f-fecha': shift.fecha, 'f-entrada': shift.entrada, 'f-salida': shift.salida, 'f-normales': '8',
    'f-extra': extra, 'f-pausa': '0', 'f-estado': 'confirmado', 'f-notas': '' });
}

test('saving a jornada after cloud refresh updates the current record and preserves unrelated remote edits', () => {
  const qa = appHarness({ jornadas: [shift] });
  qa.jornadaModal(shift.id);
  shiftFields(qa);
  qa.cloud({ jornadas: [{ ...shift, notas: 'Nota desde la nube' }] });
  assert.equal(qa.dialog.onSave(), true);
  const [saved] = qa.saved().jornadas;
  assert.equal(saved.horas_extra, 2);
  assert.equal(saved.notas, 'Nota desde la nube');
});

test('a conflicting edit or a deletion leaves the form open and keeps the latest record', () => {
  const qa = appHarness({ jornadas: [shift] });
  qa.jornadaModal(shift.id);
  shiftFields(qa);
  qa.cloud({ jornadas: [{ ...shift, horas_extra: 3 }] });
  assert.equal(qa.dialog.onSave(), false);
  assert.equal(qa.saved().jornadas[0].horas_extra, 3);
  assert.match(qa.toasts.at(-1), /cambió/);

  qa.cloud({ jornadas: [], viajes: [] });
  assert.equal(qa.dialog.onSave(), false);
  assert.equal(qa.saved().jornadas.length, 0);
  assert.match(qa.toasts.at(-1), /eliminó/);
});

test('a full disk returns failure and the same form can retry without adding extras twice', () => {
  const qa = appHarness({ jornadas: [shift] });
  qa.extraModal(shift.id);
  const modal = qa.dialog;
  qa.fields({ 'x-hours': '1,5', 'x-note': 'Refuerzo' });
  qa.failWrites(true);
  assert.equal(modal.onSave(), false);
  assert.equal(qa.saved().jornadas[0].horas_extra, 1);
  assert.match(qa.toasts.at(-1), /No se pudo guardar/);
  qa.failWrites(false);
  assert.equal(modal.onSave(), true);
  assert.equal(qa.saved().jornadas[0].horas_extra, 2.5);
});

test('a viaje edit preserves a payment recorded by another device with the form open', () => {
  const v = { id: 'viaje', fecha: shift.fecha, concepto: 'Dieta', importe: 20, pagado: 0, notas: '' };
  const qa = appHarness({ viajes: [v] });
  qa.tripModal(v.id);
  qa.fields({ 't-concepto': v.concepto, 't-fecha': v.fecha, 't-importe': '25', 't-notas': '' });
  qa.cloud({ viajes: [{ ...v, pagado: 1, fecha_pago: v.fecha }] });
  assert.equal(qa.dialog.onSave(), true);
  assert.equal(qa.saved().viajes[0].importe, 25);
  assert.equal(qa.saved().viajes[0].pagado, 1);
});

test('two offline shifts merge into one automatic payroll in the dashboard', () => {
  const seedA = { jornadas: [{ ...shift, horas_extra: 0 }] };
  const seedB = { jornadas: [{ ...shift, id: 'j2', fecha: '2026-11-06', horas_extra: 0 }] };
  const a = appHarness(seedA);
  const b = appHarness(seedB);
  a.syncPayrolls();
  b.syncPayrolls();
  const local = a.current();
  const remote = b.current();
  const sync = { window: { addEventListener() {} } };
  const source = read('supabase-sync.js').replace('  window.IVORY37CloudSync =', '  window.mergeData = mergeData;\n  window.IVORY37CloudSync =');
  vm.runInNewContext(source, sync);
  const meta = { modified: {}, deleted: {} };
  a.cloud(sync.window.mergeData(local, remote, meta, meta, {}).data);
  assert.equal(a.saved().pagos.length, 2, 'retains both original IDs for offline confirmation');
  assert.equal(a.effectivePayments().length, 1);
  assert.equal(a.effectivePayments()[0].importe, 200);
  assert.equal(a.totals().pending, 200);
  assert.equal(a.monthBreakdown('2026-11').total, 200);
});

test('a generated duplicate cannot inflate pending balances beside confirmed or manual payrolls', () => {
  const common = { tipo: 'nomina_auto', mes_key: '2026-11', fecha: '2026-11-28', concepto: 'Nómina', importe: 100 };
  const qa = appHarness({ jornadas: [{ ...shift, horas_extra: 0 }], pagos: [
    { ...common, id: 'pending' },
    { ...common, id: 'confirmed', confirmado: true },
    { ...common, id: 'manual', importe: 30, manual_edit: true }
  ] });
  qa.syncPayrolls();
  const result = qa.totals();
  assert.equal(result.collected, 100);
  assert.equal(result.pending, 30);
  assert.equal(qa.effectivePayments().length, 2);
  assert.equal(qa.current().pagos.length, 3);
});

test('Windows restores an existing copy on the bundled page without blocking writes', () => {
  let marked = false;
  const qa = appHarness({}, { desktop: {
    getLocalStorageSnapshot: () => JSON.stringify({ [DATA_KEY]: JSON.stringify({ jornadas: [shift] }) }),
    completeLocalStorageMigration: () => { marked = true; return true; }
  } });
  assert.equal(qa.restoreNativeStorage(), true);
  assert.equal(qa.loadError(), false);
  assert.equal(marked, true);
  assert.equal(qa.saved().jornadas[0].id, shift.id);
});

test('Windows keeps the previous local data if the migration copy contains an invalid date', () => {
  let marked = false;
  const qa = appHarness({ jornadas: [shift] }, { desktop: {
    getLocalStorageSnapshot: () => JSON.stringify({ [DATA_KEY]: JSON.stringify({ jornadas: [{ ...shift, fecha: '2026-02-30' }] }) }),
    completeLocalStorageMigration: () => { marked = true; return true; }
  } });
  assert.equal(qa.restoreNativeStorage(), false);
  assert.equal(qa.loadError(), true);
  assert.equal(marked, false);
  assert.equal(qa.saved().jornadas[0].fecha, shift.fecha);
});
