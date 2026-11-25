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
    crypto: require('node:crypto').webcrypto,
    AndroidBridge: options.android,
    print: options.print,
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
      monthBreakdown, restoreNativeStorage, storageSnapshot, renderTodayClock,
      num, uid, rateOn, setSetting, printPreparedReport, notify, requestNotifications, notificationState, renderNotifState,
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
    ...window.qa, toasts, storage, element: (selector, element) => fields.set(selector, element), get dialog() { return window.dialog; },
    fields(values) { for (const [id, value] of Object.entries(values)) fields.set('#' + id, { value: String(value) }); },
    cloud(data) { listeners.get('ivory37:cloud-data')({ detail: data }); },
    failWrites(value) { failWrite = value; }
  };
}

const shift = { id: 'jornada', fecha: '2026-11-04', entrada: '08:00', salida: '17:00', horas_normales: 8, horas_extra: 1,
  descanso_minutos: 0, estado: 'confirmado', notas: '', creado: '2026-11-04T17:00:00.000Z' };

test('Spanish comma is always decimal, including three decimal places', () => {
  const qa = appHarness({});
  for (const [input, expected] of [['1,234', 1.234], ['1.234', 1.234], ['1.234,56 €', 1234.56], ['-1,234', -1.234], ['12,50', 12.5], ['1,234.56', 1234.56], [1234.56, 1234.56]]) {
    assert.equal(qa.num(input, NaN), expected, String(input));
  }
  for (const input of ['1,234,567', '1,,2', 'NaN', 'Infinity']) assert.ok(Number.isNaN(qa.num(input, NaN)), input);
});

test('new record IDs use UUID v4 without changing existing IDs', () => {
  const qa = appHarness({ jornadas: [shift] });
  const ids = new Set(Array.from({ length: 1000 }, () => qa.uid()));
  assert.equal(ids.size, 1000);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(qa.current().jornadas[0].id, shift.id);
});

test('rate lookup cache invalidates for edited history and fallback settings', () => {
  const qa = appHarness({});
  qa.setSetting('hora_extra_euros', '20');
  assert.equal(qa.rateOn('2026-11-04', 'extra'), 20);
  qa.setSetting('hora_extra_euros', '21');
  assert.equal(qa.rateOn('2026-11-04', 'extra'), 21);
  qa.setSetting('tarifa_historial', JSON.stringify([{ desde: '2026-11-01', normal: 10, extra: 25, jornada: 8 }]));
  assert.equal(qa.rateOn('2026-11-04', 'extra'), 25);
  assert.equal(qa.rateOn('2026-10-31', 'extra'), 21);
  qa.setSetting('tarifa_historial', JSON.stringify([{ desde: '2026-11-01', normal: 10, extra: 30, jornada: 8 }]));
  assert.equal(qa.rateOn('2026-11-04', 'extra'), 30);
});

test('Android PDF and notifications use native bridge without web APIs', () => {
  const calls = [];
  let state = 'Sin activar';
  const qa = appHarness({}, { android: {
    printReport() { calls.push('print'); },
    getNotificationState() { return state; },
    requestNotifications() { calls.push('permission'); state = 'Activados'; },
    showNotification(title, body) { calls.push([title, body]); }
  }, print() { throw new Error('Web print must not run on Android'); } });
  qa.printPreparedReport();
  qa.notify('Entrada', '08:00');
  assert.deepEqual(calls, ['print']);
  qa.requestNotifications();
  qa.notify('Salida', '16:00');
  assert.deepEqual(calls, ['print', 'permission', ['Salida', '16:00']]);
  assert.equal(qa.notificationState(), 'Activados');
});

test('desktop PDF retains browser printing and reports failures', () => {
  let printed = 0;
  appHarness({}, { print() { printed++; } }).printPreparedReport();
  assert.equal(printed, 1);
  const qa = appHarness({}, { print() { throw new Error('Unavailable'); } });
  qa.printPreparedReport();
  assert.match(qa.toasts.at(-1), /No se pudo abrir/);
});

test('overlapping automatic shifts retain their extras and payment evidence for review without inflating payroll', () => {
  const automatic = { ...shift, id: 'automatic', auto: true, horas_extra: 3, pagado_extras: true,
    fecha_pago_extras: '2026-11-05', notas: 'Extra revisada por el trabajador' };
  const qa = appHarness({ jornadas: [shift, automatic] });
  qa.syncPayrolls();
  const rows = qa.current().jornadas;
  assert.equal(rows.length, 2);
  const preserved = rows.find(row => row.id === 'automatic');
  assert.equal(preserved.estado, 'provisional');
  assert.equal(preserved.horas_extra, 3);
  assert.equal(preserved.pagado_extras, true);
  assert.equal(preserved.fecha_pago_extras, automatic.fecha_pago_extras);
  assert.equal(preserved.notas, automatic.notas);
  assert.equal(qa.totals().extraH, 1);
  assert.equal(qa.totals().earned, Math.round((qa.totals().collected + qa.totals().pending) * 100) / 100);
});

test('accounting identity holds across historical rates, paid extras, trips and confirmed or pending payrolls', () => {
  for (let scenario = 0; scenario < 50; scenario++) {
    const qa = appHarness({
      jornadas: [{ ...shift, horas_extra: scenario / 4, pagado_extras: scenario % 2 === 0 }],
      viajes: [{ id: 'trip', fecha: shift.fecha, importe: 12.37 + scenario, pagado: scenario % 3 === 0 }],
      pagos: [{ id: 'pay', fecha: shift.fecha, tipo: 'nomina_auto', mes_key: '2026-11', importe: 100 + scenario / 10, confirmado: scenario % 2 === 0, manual_edit: true }],
      ajustes: [{ clave: 'tarifa_historial', valor: JSON.stringify([{ desde: '2026-01-01', normal: 12.5, extra: 19.69, jornada: 8 }]) }]
    });
    const totals = qa.totals();
    assert.ok(Math.abs(totals.earned - totals.collected - totals.pending) < 0.000001, 'scenario ' + scenario);
    assert.ok(Math.abs(totals.extraValue - totals.extraPaid - totals.extraPending) < 0.000001, 'extras ' + scenario);
  }
});

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


test('native backups omit auth tokens and migration never restores them', () => {
  const saved = { [DATA_KEY]: JSON.stringify({ jornadas: [shift] }),
    'sb-test-auth-token': 'secret-refresh-token', 'unrelated-password': 'secret',
    ivory37_cloud_sync_owner_v1: 'owner-a' };
  const qa = appHarness({ jornadas: [] }, { desktop: {
    getLocalStorageSnapshot: () => JSON.stringify(saved), completeLocalStorageMigration: () => true
  } });
  qa.storage.set('sb-current-auth-token', 'active-session');
  assert.equal(qa.storageSnapshot()['sb-current-auth-token'], undefined);
  assert.equal(qa.restoreNativeStorage(), true);
  assert.equal(qa.storage.has('sb-test-auth-token'), false);
  assert.equal(qa.storage.has('unrelated-password'), false);
  assert.equal(qa.storage.get('ivory37_cloud_sync_owner_v1'), 'owner-a');
  assert.equal(qa.saved().jornadas.length, 1);
});


test('an overnight open shift stays accessible even beside a closed record for today', () => {
  const now = new Date();
  const key = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  const qa = appHarness({ jornadas: [
    { ...shift, id: 'today-closed', fecha: key(now), salida: '08:00' },
    { ...shift, id: 'overnight', fecha: key(yesterday), entrada: '23:00', salida: '' }
  ] });
  const state = { textContent: '', dataset: {} };
  const label = { textContent: '' };
  const button = { dataset: { action: 'clock-in' }, hidden: false,
    querySelector: selector => selector === 'span' ? label : { setAttribute() {} } };
  qa.element('#hero-clock-state', state);
  qa.element('#hero-clock-action', button);
  qa.renderTodayClock();
  assert.equal(button.hidden, false);
  assert.equal(button.dataset.action, 'clock-out');
  assert.equal(label.textContent, 'Fichar salida');
  assert.equal(state.textContent, 'Trabajando');
});
