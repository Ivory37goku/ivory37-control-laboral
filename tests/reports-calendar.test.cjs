'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, exportName) {
  const context = { window: {}, Date, Map };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return context.window[exportName];
}
const reports = load('reports.js', 'IVORY37Reports');
const calendar = load('calendar.js', 'IVORY37Calendar');
const dateOK = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
const parse = s => new Date(s + 'T12:00:00');
const key = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
const add = (d, days) => { const next = new Date(d); next.setDate(next.getDate() + days); return next; };

test('CSV export protects spreadsheet formulas', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-10+20', '@cmd', '  =HYPERLINK("x")']) {
    assert.ok(reports.csvCell(value).startsWith('"\''), value);
  }
  assert.equal(reports.csvCell('hola "mundo"'), '"hola ""mundo"""');
});

test('CSV has UTF-8 BOM and semicolon-separated columns', () => {
  assert.equal(reports.toCsv([['fecha', 'horas'], ['2026-11-17', 8]]), '\uFEFF"fecha";"horas"\r\n"2026-11-17";"8"');
});

test('calendar normalizes duplicates and invalid types', () => {
  let id = 0;
  const rows = calendar.normalize([
    { id: 'a', fecha: '2026-11-17', tipo: 'descanso' },
    { id: 'b', fecha: '2026-11-17', tipo: 'vacaciones' },
    { id: 'c', fecha: '2026-11-18', tipo: 'inventado' }
  ], dateOK, () => String(++id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tipo, 'vacaciones');
  assert.equal(calendar.hasDate(rows, '2026-11-17'), true);
});

test('calendar range includes both ends and caps excessive ranges', () => {
  assert.deepEqual(Array.from(calendar.datesInRange('2026-11-17', '2026-11-19', parse, key, add, 10)), ['2026-11-17', '2026-11-18', '2026-11-19']);
  assert.equal(calendar.datesInRange('2026-01-01', '2026-12-31', parse, key, add, 10).length, 0);
});

test('calendar rejects reversed, malformed and impossible start dates', () => {
  assert.equal(calendar.datesInRange('2026-11-20', '2026-11-17', parse, key, add, 10).length, 0);
  assert.equal(calendar.datesInRange('bad', '2026-11-17', parse, key, add, 10).length, 0);
  assert.equal(calendar.datesInRange('2026-02-30', '2026-03-03', parse, key, add, 10).length, 0);
});

test('calendar does not hang if the date increment fails to progress', () => {
  assert.equal(calendar.datesInRange('2026-11-17', '2026-11-19', parse, key, d => d, 10).length, 0);
});

test('CSV escapes formulas hidden behind invisible Unicode characters', () => {
  for (const prefix of ['\u200b', '\u200e', '\u202e', '\u2060', '\ufeff']) {
    assert.ok(reports.csvCell(prefix + '=2+2').startsWith('"\''), 'unsafe prefix: ' + prefix.codePointAt(0).toString(16));
  }
  assert.equal(reports.csvCell('Factura normal'), '"Factura normal"');
});
